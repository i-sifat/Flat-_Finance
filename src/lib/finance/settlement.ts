/**
 * Pure functions for FlatFinance balance + settlement math.
 * Kept side-effect free so they're easy to test and reuse in charts.
 */

import type {
  CarryForwardRecord,
  ExpenseRecord,
  GuestRecord,
  LoanRecord,
  MealEntryRecord,
  MemberRecord,
  PaymentRecord,
} from "@/store/types";

export interface MemberMonthlySummary {
  memberId: string;
  totalMeals: number;
  guestMealsCharged: number; // meals billed to this member from guests
  mealCost: number;
  totalPaid: number;
  carryForwardApplied: number; // positive = credit brought in, negative = debit
  proRateDays: number | null; // null = full month active, number = days they were active
  proRateFraction: number;    // 1.0 = full month, <1 = partial
  balance: number; // positive = advance/credit, negative = dues
}

export interface MonthlySettlement {
  month: string; // YYYY-MM
  totalExpenses: number;
  totalMeals: number;
  mealRate: number; // ৳ per meal
  summaries: MemberMonthlySummary[];
}

export function sumMealsForEntry(entry: MealEntryRecord): number {
  return entry.breakfast + entry.lunch + entry.dinner + entry.guestMeals;
}

/** Days in a given YYYY-MM month */
function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Calculate what fraction of a month a member was active.
 * - If joinedAt is in the month, they joined mid-month.
 * - If leftAt is in the month, they left mid-month.
 * - Otherwise full month (1.0).
 */
function proRateFractionFor(
  member: MemberRecord,
  month: string,
): { days: number | null; fraction: number } {
  const total = daysInMonth(month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(total).padStart(2, "0")}`;

  let start = monthStart;
  let end = monthEnd;
  let partial = false;

  if (member.joinedAt > monthStart && member.joinedAt <= monthEnd) {
    start = member.joinedAt;
    partial = true;
  }
  if (member.leftAt && member.leftAt >= monthStart && member.leftAt <= monthEnd) {
    end = member.leftAt;
    partial = true;
  }

  if (!partial) return { days: null, fraction: 1.0 };

  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1,
  );
  return { days, fraction: Math.min(1, days / total) };
}

/** Guest meals that should be charged to a specific member this month */
function guestMealsBilledToMember(
  memberId: string,
  guests: GuestRecord[],
  month: string,
  totalActiveMembers: number,
): number {
  let total = 0;
  for (const g of guests) {
    // only guests whose stay overlaps with this month
    const guestStart = g.arrivalDate.slice(0, 7);
    const guestEnd = g.departureDate.slice(0, 7);
    if (guestStart > month || guestEnd < month) continue;

    const guestTotal = g.meals.breakfast + g.meals.lunch + g.meals.dinner;
    if (g.splitAmongAll) {
      total += guestTotal / Math.max(1, totalActiveMembers);
    } else if (g.hostMemberId === memberId) {
      total += guestTotal;
    }
  }
  return total;
}

export function computeMonthlySettlement(
  month: string,
  members: MemberRecord[],
  expenses: ExpenseRecord[],
  meals: MealEntryRecord[],
  payments: PaymentRecord[],
  guests: GuestRecord[] = [],
  carryForwards: CarryForwardRecord[] = [],
): MonthlySettlement {
  const monthExpenses = expenses.filter(
    (e) => !e.deleted && e.approved && e.date.startsWith(month),
  );
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);

  // Members who were active at any point this month (joined before end, not left before start)
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const relevantMembers = members.filter((m) => {
    if (m.joinedAt > monthEnd) return false; // joined after month ended
    if (m.leftAt && m.leftAt < `${month}-01`) return false; // left before month started
    return true;
  });

  const mealCounts = new Map<string, number>();
  for (const entry of meals) {
    if (!entry.date.startsWith(month)) continue;
    mealCounts.set(entry.memberId, (mealCounts.get(entry.memberId) ?? 0) + sumMealsForEntry(entry));
  }

  // Add guest meal totals into global meal count
  const guestMealTotal = guests
    .filter((g) => g.arrivalDate.slice(0, 7) <= month && g.departureDate.slice(0, 7) >= month)
    .reduce((s, g) => s + g.meals.breakfast + g.meals.lunch + g.meals.dinner, 0);

  const totalMeals =
    Array.from(mealCounts.values()).reduce((s, n) => s + n, 0) + guestMealTotal;

  const mealRate = totalMeals > 0 ? totalExpenses / totalMeals : 0;

  const summaries: MemberMonthlySummary[] = relevantMembers.map((m) => {
    const { days, fraction } = proRateFractionFor(m, month);
    const memberMeals = mealCounts.get(m.id) ?? 0;

    // Guest meals billed to this member
    const guestCharged = guestMealsBilledToMember(m.id, guests, month, relevantMembers.length);

    // Carry-forward credits/debits for this member in this month
    const carryForwardApplied = carryForwards
      .filter((cf) => cf.memberId === m.id && cf.toMonth === month)
      .reduce((s, cf) => s + cf.amount, 0);

    const memberPaid = payments
      .filter((p) => p.memberId === m.id && p.month === month)
      .reduce((s, p) => s + p.amount, 0);

    // For fixed costs (rent, utilities), pro-rate by active fraction
    // Meal cost is purely consumption-based (no pro-rating needed)
    const fixedExpenses = monthExpenses
      .filter((e) => e.category === "Rent" || e.category === "Utilities")
      .reduce((s, e) => s + e.amount, 0);
    const variableExpenses = totalExpenses - fixedExpenses;

    const myFixedShare = relevantMembers.length > 0
      ? (fixedExpenses / relevantMembers.length) * fraction
      : 0;

    // Variable expenses allocated by meal share
    const myMealShare = (memberMeals + guestCharged) * mealRate;

    // If no meal data at all, fall back to equal split of variable expenses
    const myVariableShare =
      totalMeals > 0 ? myMealShare : variableExpenses / Math.max(1, relevantMembers.length);

    const mealCost = myFixedShare + myVariableShare;

    return {
      memberId: m.id,
      totalMeals: memberMeals,
      guestMealsCharged: guestCharged,
      mealCost,
      totalPaid: memberPaid,
      carryForwardApplied,
      proRateDays: days,
      proRateFraction: fraction,
      balance: memberPaid + carryForwardApplied - mealCost,
    };
  });

  return { month, totalExpenses, totalMeals: totalMeals - guestMealTotal, mealRate, summaries };
}

export function computeMemberLifetimeBalance(
  memberId: string,
  expenses: ExpenseRecord[],
  meals: MealEntryRecord[],
  payments: PaymentRecord[],
  members: MemberRecord[],
): number {
  const activeMembers = members.filter((m) => m.status === "active");
  const totalExpenses = expenses
    .filter((e) => !e.deleted && e.approved)
    .reduce((s, e) => s + e.amount, 0);
  const allMealCounts = new Map<string, number>();
  for (const entry of meals) {
    allMealCounts.set(entry.memberId, (allMealCounts.get(entry.memberId) ?? 0) + sumMealsForEntry(entry));
  }
  const totalMeals = Array.from(allMealCounts.values()).reduce((s, n) => s + n, 0);
  const rate = totalMeals > 0 ? totalExpenses / totalMeals : 0;
  const myMeals = allMealCounts.get(memberId) ?? 0;
  const myCost = myMeals * rate;
  const myPaid = payments
    .filter((p) => p.memberId === memberId)
    .reduce((s, p) => s + p.amount, 0);
  void activeMembers;
  return myPaid - myCost;
}

export interface SettlementTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

/**
 * Greedy who-pays-whom: take the biggest debtor and biggest creditor,
 * net them, repeat until everything is settled. Minimises number of transfers.
 */
export function deriveSettlementTransfers(summaries: MemberMonthlySummary[]): SettlementTransfer[] {
  const creditors = summaries
    .filter((s) => s.balance > 0.01)
    .map((s) => ({ id: s.memberId, amount: s.balance }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = summaries
    .filter((s) => s.balance < -0.01)
    .map((s) => ({ id: s.memberId, amount: -s.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    transfers.push({ fromMemberId: debtors[i].id, toMemberId: creditors[j].id, amount: pay });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return transfers;
}

export function computeLoanOutstanding(loan: LoanRecord): number {
  const totalOwed = loan.amount + (loan.amount * loan.interestRate) / 100;
  return Math.max(0, totalOwed - loan.paidAmount);
}

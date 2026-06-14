/**
 * Pure functions for FlatFinance balance + settlement math.
 * Kept side-effect free so they're easy to test and reuse in charts.
 */

import type {
  ExpenseRecord,
  LoanRecord,
  MealEntryRecord,
  MemberRecord,
  PaymentRecord,
} from "@/store/types";

export interface MemberMonthlySummary {
  memberId: string;
  totalMeals: number;
  mealCost: number;
  totalPaid: number;
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

export function computeMonthlySettlement(
  month: string,
  members: MemberRecord[],
  expenses: ExpenseRecord[],
  meals: MealEntryRecord[],
  payments: PaymentRecord[],
): MonthlySettlement {
  const monthExpenses = expenses.filter(
    (e) => !e.deleted && e.approved && e.date.startsWith(month),
  );
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const activeMembers = members.filter((m) => m.status === "active");

  const mealCounts = new Map<string, number>();
  for (const entry of meals) {
    if (!entry.date.startsWith(month)) continue;
    mealCounts.set(entry.memberId, (mealCounts.get(entry.memberId) ?? 0) + sumMealsForEntry(entry));
  }

  const totalMeals = Array.from(mealCounts.values()).reduce((s, n) => s + n, 0);
  const mealRate = totalMeals > 0 ? totalExpenses / totalMeals : 0;

  const summaries: MemberMonthlySummary[] = activeMembers.map((m) => {
    const memberMeals = mealCounts.get(m.id) ?? 0;
    const memberPaid = payments
      .filter((p) => p.memberId === m.id && p.month === month)
      .reduce((s, p) => s + p.amount, 0);
    const mealCost = memberMeals * mealRate;
    return {
      memberId: m.id,
      totalMeals: memberMeals,
      mealCost,
      totalPaid: memberPaid,
      balance: memberPaid - mealCost,
    };
  });

  return { month, totalExpenses, totalMeals, mealRate, summaries };
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

  // Touch members to keep signature stable; reserved for future per-member overrides.
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

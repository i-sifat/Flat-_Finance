import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Receipt,
  UtensilsCrossed,
  Users,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { MoneyCell } from "@/components/app/MoneyCell";
import { EmptyState } from "@/components/app/EmptyState";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { Button } from "@/components/ui/button";
import {
  selectCurrentMember,
  useFlatFinanceStore,
} from "@/store/useFlatFinanceStore";
import {
  computeMemberLifetimeBalance,
  computeMonthlySettlement,
} from "@/lib/finance/settlement";
import { currentMonth, formatDateShort, formatRelative, monthLabel } from "@/lib/format";

export const Route = createFileRoute("/app/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — FlatFinance" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const me = useFlatFinanceStore(selectCurrentMember);
  const members = useFlatFinanceStore((s) => s.members);
  const expenses = useFlatFinanceStore((s) => s.expenses);
  const meals = useFlatFinanceStore((s) => s.meals);
  const payments = useFlatFinanceStore((s) => s.payments);
  const activity = useFlatFinanceStore((s) => s.activity);

  const month = currentMonth();
  const settlement = useMemo(
    () => computeMonthlySettlement(month, members, expenses, meals, payments),
    [month, members, expenses, meals, payments],
  );

  const myBalance = useMemo(
    () => (me ? computeMemberLifetimeBalance(me.id, expenses, meals, payments, members) : 0),
    [me, expenses, meals, payments, members],
  );

  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses.filter((x) => !x.deleted && x.approved)) {
      buckets.set(e.date, (buckets.get(e.date) ?? 0) + e.amount);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, total]) => ({ date: formatDateShort(date), total }));
  }, [expenses]);

  const recentExpenses = expenses.filter((e) => !e.deleted).slice(0, 5);
  const recentActivity = activity.slice(0, 6);
  const activeMemberCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello, ${me?.name.split(" ")[0] ?? "there"}`}
        description={`${monthLabel(month)} · ${activeMemberCount} active member${activeMemberCount === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/app/expenses">Add expense</Link>
            </Button>
            <Button asChild className="gradient-primary text-primary-foreground hover:brightness-110">
              <Link to="/app/settlement">
                Settle up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {/* hero balance */}
      <section className="card-elevated relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.66 0.22 287 / 0.45), transparent 60%)" }}
        />
        <div className="relative grid gap-6 sm:grid-cols-2 sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Your standing
            </p>
            <p className="mt-3 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
              <MoneyCell amount={myBalance} tone="auto" signed />
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {myBalance >= 0
                ? "You're in credit with the flat."
                : "You owe this much to the flat pool."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniMetric label="Meals this month" value={settlement.totalMeals} />
            <MiniMetric
              label="Meal rate"
              value={settlement.mealRate > 0 ? `৳${settlement.mealRate.toFixed(1)}` : "—"}
            />
            <MiniMetric
              label="Total spend"
              value={`৳${settlement.totalExpenses.toLocaleString("en-BD")}`}
            />
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={settlement.totalExpenses}
          asMoney
          icon={<Receipt className="h-4 w-4" />}
          hint={monthLabel(month)}
        />
        <StatCard
          label="Meals logged"
          value={settlement.totalMeals}
          icon={<UtensilsCrossed className="h-4 w-4" />}
          hint="across all flatmates"
        />
        <StatCard
          label="Active members"
          value={activeMemberCount}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Your balance"
          value={myBalance}
          asMoney
          tone={myBalance >= 0 ? "positive" : "negative"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      {/* trend + recent */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card-elevated lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Spending trend</p>
              <p className="text-xs text-muted-foreground">Last 14 days of approved expenses</p>
            </div>
          </div>
          <div className="mt-4 h-56">
            {trend.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No expenses yet — add your first one to see the trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.66 0.22 287)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.66 0.22 287)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.02 260)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ stroke: "oklch(0.66 0.22 287 / 0.4)" }}
                    contentStyle={{
                      background: "oklch(0.22 0.04 264)",
                      border: "1px solid oklch(1 0 0 / 0.08)",
                      borderRadius: 12,
                      color: "oklch(0.96 0.01 250)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`৳${value.toLocaleString("en-BD")}`, "Spend"]}
                  />
                  <Area type="monotone" dataKey="total" stroke="oklch(0.66 0.22 287)" strokeWidth={2} fill="url(#spendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-elevated p-6">
          <p className="text-sm font-semibold">Recent activity</p>
          <p className="text-xs text-muted-foreground">Across the whole flat</p>
          <ul className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <li className="text-xs text-muted-foreground">Nothing yet. Actions you take will appear here.</li>
            ) : (
              recentActivity.map((a) => {
                const actor = members.find((m) => m.id === a.memberId);
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    {actor ? (
                      <MemberAvatar member={actor} size="sm" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--color-accent)] text-foreground/70">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{a.details}</p>
                      <p className="text-[11px] text-muted-foreground">{formatRelative(a.timestamp)}</p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <Link
            to="/app/activity"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)] hover:underline"
          >
            See all activity
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* recent expenses */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Latest expenses</h2>
          <Link to="/app/expenses" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No expenses yet"
            description="Add a grocery run, rent, or utility bill to get started."
            action={
              <Button asChild className="gradient-primary text-primary-foreground hover:brightness-110">
                <Link to="/app/expenses">Add expense</Link>
              </Button>
            }
          />
        ) : (
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {recentExpenses.map((e) => {
              const actor = members.find((m) => m.id === e.addedBy);
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--color-accent)] text-foreground/70">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category} · {formatDateShort(e.date)} · by {actor?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <MoneyCell amount={e.amount} className="text-sm font-semibold" />
                    {e.approved ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[color:var(--color-positive)]">
                        <CheckCircle2 className="h-3 w-3" />
                        approved
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[10px] text-[color:var(--color-warning)]">pending</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-[color:var(--color-surface-elevated)] p-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
    </div>
  );
}

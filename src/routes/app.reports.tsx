import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { PageHeader } from "@/components/app/PageHeader";
import { MoneyCell } from "@/components/app/MoneyCell";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3 } from "lucide-react";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { currentMonth, monthLabel } from "@/lib/format";

export const Route = createFileRoute("/app/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reports — FlatFinance" }] }),
  component: ReportsPage,
});

const COLORS = ["oklch(0.66 0.22 287)", "oklch(0.72 0.18 155)", "oklch(0.78 0.16 75)", "oklch(0.66 0.20 220)", "oklch(0.62 0.22 22)"];

function ReportsPage() {
  const expenses = useFlatFinanceStore((s) => s.expenses);
  const [month, setMonth] = useState(currentMonth());

  const monthly = useMemo(() => expenses.filter((e) => !e.deleted && e.approved && e.date.startsWith(month)), [expenses, month]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthly) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return Array.from(map.entries()).map(([category, total]) => ({ category, total }));
  }, [monthly]);

  const total = monthly.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Spending overview for ${monthLabel(month)}`}
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="rep-month" className="text-xs text-muted-foreground">Month</Label>
            <Input id="rep-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Total spend</p><p className="mt-2 font-mono text-2xl font-semibold"><MoneyCell amount={total} /></p></div>
        <div className="card-elevated p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Transactions</p><p className="mt-2 font-mono text-2xl font-semibold">{monthly.length}</p></div>
        <div className="card-elevated p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Average</p><p className="mt-2 font-mono text-2xl font-semibold"><MoneyCell amount={monthly.length ? total / monthly.length : 0} /></p></div>
      </section>

      <section className="card-elevated p-6">
        <p className="text-sm font-semibold">Spend by category</p>
        <div className="mt-4 h-72">
          {byCategory.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No data yet for this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <XAxis dataKey="category" tick={{ fill: "oklch(0.7 0.02 260)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 260)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${v}`} />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                  contentStyle={{ background: "oklch(0.22 0.04 264)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 12, color: "oklch(0.96 0.01 250)", fontSize: 12 }}
                  formatter={(value: number) => [`৳${value.toLocaleString("en-BD")}`, "Spend"]}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {byCategory.length === 0 ? (
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Nothing to report" description="Approve expenses to see analytics here." />
      ) : null}
    </div>
  );
}

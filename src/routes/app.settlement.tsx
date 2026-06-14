import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Scale, ArrowRight, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { MoneyCell } from "@/components/app/MoneyCell";
import { EmptyState } from "@/components/app/EmptyState";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { computeMonthlySettlement, deriveSettlementTransfers } from "@/lib/finance/settlement";
import { currentMonth, monthLabel, todayIso } from "@/lib/format";

export const Route = createFileRoute("/app/settlement")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settlement — FlatFinance" }] }),
  component: SettlementPage,
});

function SettlementPage() {
  const members = useFlatFinanceStore((s) => s.members);
  const expenses = useFlatFinanceStore((s) => s.expenses);
  const meals = useFlatFinanceStore((s) => s.meals);
  const payments = useFlatFinanceStore((s) => s.payments);
  const recordPayment = useFlatFinanceStore((s) => s.recordPayment);
  const [month, setMonth] = useState(currentMonth());
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const settlement = useMemo(
    () => computeMonthlySettlement(month, members, expenses, meals, payments),
    [month, members, expenses, meals, payments],
  );

  const transfers = useMemo(
    () => deriveSettlementTransfers(settlement.summaries),
    [settlement],
  );

  const [payMemberId, setPayMemberId] = useState(members[0]?.id ?? "");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("bKash");

  const submitPayment = async () => {
    if (!payMemberId || payAmount <= 0) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    recordPayment({
      memberId: payMemberId, amount: payAmount, date: todayIso(), method: payMethod, note: "Settlement", month,
    });
    setBusy(false);
    setPayOpen(false);
    setPayAmount(0);
    toast.success("Payment recorded");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlement"
        description={`Who pays whom for ${monthLabel(month)}`}
        actions={
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground hover:brightness-110" disabled={members.length === 0}>
                  <Plus className="mr-1.5 h-4 w-4" /> Record payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>From member</Label>
                    <Select value={payMemberId} onValueChange={setPayMemberId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (৳)</Label>
                    <Input type="number" min={0} step="0.01" value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["bKash", "Nagad", "Rocket", "Bank Transfer", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
                  <Button onClick={submitPayment} disabled={busy} className="gradient-primary text-primary-foreground">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total expenses" value={<MoneyCell amount={settlement.totalExpenses} />} />
        <Stat label="Total meals" value={settlement.totalMeals.toString()} />
        <Stat label="Meal rate" value={settlement.mealRate > 0 ? `৳${settlement.mealRate.toFixed(2)}` : "—"} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Member summaries</h2>
        {settlement.summaries.length === 0 ? (
          <EmptyState icon={<Scale className="h-5 w-5" />} title="No data for this month" />
        ) : (
          <div className="card-elevated overflow-hidden">
            <div className="grid grid-cols-[1fr,auto,auto,auto,auto] gap-3 border-b border-border px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Member</span><span>Meals</span><span>Cost</span><span>Paid</span><span>Balance</span>
            </div>
            <div className="divide-y divide-border">
              {settlement.summaries.map((s) => {
                const member = members.find((m) => m.id === s.memberId);
                if (!member) return null;
                return (
                  <div key={s.memberId} className="grid grid-cols-[1fr,auto,auto,auto,auto] items-center gap-3 px-5 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <MemberAvatar member={member} size="sm" />
                      <span className="truncate text-sm">{member.name}</span>
                    </div>
                    <span className="font-mono text-sm">{s.totalMeals}</span>
                    <MoneyCell amount={s.mealCost} className="text-sm" />
                    <MoneyCell amount={s.totalPaid} className="text-sm" />
                    <MoneyCell amount={s.balance} tone="auto" signed className="text-sm font-semibold" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Suggested transfers</h2>
        {transfers.length === 0 ? (
          <EmptyState icon={<Scale className="h-5 w-5" />} title="All settled" description="No transfers needed this month." />
        ) : (
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {transfers.map((t, i) => {
              const from = members.find((m) => m.id === t.fromMemberId);
              const to = members.find((m) => m.id === t.toMemberId);
              if (!from || !to) return null;
              return (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={from} size="sm" />
                    <span className="text-sm">{from.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <MemberAvatar member={to} size="sm" />
                    <span className="text-sm">{to.name}</span>
                  </div>
                  <MoneyCell amount={t.amount} className="text-sm font-semibold" tone="positive" />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

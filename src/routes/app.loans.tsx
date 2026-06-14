import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HandCoins, Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { MoneyCell } from "@/components/app/MoneyCell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { selectActiveMembers, useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { computeLoanOutstanding } from "@/lib/finance/settlement";
import { formatDateShort, todayIso } from "@/lib/format";

export const Route = createFileRoute("/app/loans")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loans — FlatFinance" }] }),
  component: LoansPage,
});

const schema = z.object({
  lenderId: z.string().min(1, "Pick a lender"),
  borrowerId: z.string().min(1, "Pick a borrower"),
  amount: z.coerce.number().positive().max(10_000_000),
  interestRate: z.coerce.number().min(0).max(100),
  description: z.string().trim().min(2).max(120),
  date: z.string(),
  dueDate: z.string().optional().or(z.literal("")),
}).refine((d) => d.lenderId !== d.borrowerId, { message: "Lender and borrower must differ", path: ["borrowerId"] });
type Values = z.infer<typeof schema>;

function LoansPage() {
  const members = useFlatFinanceStore(selectActiveMembers);
  const loans = useFlatFinanceStore((s) => s.loans);
  const addLoan = useFlatFinanceStore((s) => s.addLoan);
  const repay = useFlatFinanceStore((s) => s.repayLoan);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalOutstanding = useMemo(
    () => loans.reduce((s, l) => s + computeLoanOutstanding(l), 0),
    [loans],
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      lenderId: members[0]?.id ?? "",
      borrowerId: members[1]?.id ?? "",
      amount: 0,
      interestRate: 0,
      description: "",
      date: todayIso(),
      dueDate: "",
    },
  });

  const onSubmit = async (v: Values) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    addLoan({
      lenderId: v.lenderId, borrowerId: v.borrowerId, amount: v.amount,
      interestRate: v.interestRate, description: v.description, date: v.date,
      dueDate: v.dueDate || undefined,
    });
    setBusy(false);
    setOpen(false);
    toast.success("Loan recorded");
    form.reset();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Peer loans"
        description="Track money lent between flatmates."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground hover:brightness-110" disabled={members.length < 2}>
                <Plus className="mr-1.5 h-4 w-4" /> New loan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record a loan</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormSelect label="Lender" onChange={(v) => form.setValue("lenderId", v)} defaultValue={form.getValues("lenderId")} members={members} />
                  <FormSelect label="Borrower" onChange={(v) => form.setValue("borrowerId", v)} defaultValue={form.getValues("borrowerId")} members={members} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Amount (৳)</Label>
                    <Input type="number" min={0} step="0.01" {...form.register("amount")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interest %</Label>
                    <Input type="number" min={0} step="0.1" {...form.register("interestRate")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input placeholder="Emergency funds" {...form.register("description")} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" {...form.register("date")} /></div>
                  <div className="space-y-1.5"><Label>Due (optional)</Label><Input type="date" {...form.register("dueDate")} /></div>
                </div>
                {form.formState.errors.borrowerId ? (
                  <p className="text-xs text-[color:var(--color-destructive)]">{form.formState.errors.borrowerId.message}</p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record loan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-elevated p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Total outstanding</p>
        <p className="mt-1 font-mono text-3xl font-semibold"><MoneyCell amount={totalOutstanding} /></p>
      </div>

      {loans.length === 0 ? (
        <EmptyState icon={<HandCoins className="h-5 w-5" />} title="No loans recorded" description="Track who lent what to whom." />
      ) : (
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {loans.map((l) => {
            const lender = members.find((m) => m.id === l.lenderId);
            const borrower = members.find((m) => m.id === l.borrowerId);
            const outstanding = computeLoanOutstanding(l);
            return (
              <div key={l.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr,auto] sm:items-center">
                <div>
                  <p className="text-sm font-medium">{lender?.name ?? "—"} → {borrower?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.description} · {formatDateShort(l.date)}{l.dueDate ? ` · due ${formatDateShort(l.dueDate)}` : ""}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <Badge variant={l.status === "paid" ? "secondary" : "default"} className="text-[10px] capitalize">{l.status}</Badge>
                    <span className="text-muted-foreground">Paid <MoneyCell amount={l.paidAmount} className="text-xs" /> of <MoneyCell amount={l.amount + l.amount * l.interestRate / 100} className="text-xs" /></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MoneyCell amount={outstanding} tone={outstanding > 0 ? "negative" : "positive"} className="text-sm font-semibold" />
                  {l.status !== "paid" ? (
                    <Button size="sm" variant="secondary" onClick={() => { repay(l.id, outstanding); toast.success("Loan settled"); }}>
                      Mark paid
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormSelect({ label, members, defaultValue, onChange }: { label: string; members: { id: string; name: string }[]; defaultValue: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select defaultValue={defaultValue} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

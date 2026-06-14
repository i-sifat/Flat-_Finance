import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Receipt, Check, Trash2, Filter, Loader2, Camera, Image, X, ZoomIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { PageHeader } from "@/components/app/PageHeader";
import { MoneyCell } from "@/components/app/MoneyCell";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { selectCurrentMember, selectIsAdmin, useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { formatDateShort, todayIso } from "@/lib/format";
import type { ExpenseCategory } from "@/store/types";

export const Route = createFileRoute("/app/expenses")({
  ssr: false,
  head: () => ({ meta: [{ title: "Expenses — FlatFinance" }] }),
  component: ExpensesPage,
});

const CATEGORIES: ExpenseCategory[] = ["Grocery", "Rent", "Utilities", "Maintenance", "Miscellaneous"];

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be positive").max(10_000_000, "Too large"),
  category: z.enum(["Grocery", "Rent", "Utilities", "Maintenance", "Miscellaneous"] as const),
  description: z.string().trim().min(2, "Add a short description").max(120),
  date: z.string().min(8),
});
type Values = z.infer<typeof schema>;

/** Read a File as a base64 data URL */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ExpensesPage() {
  const me = useFlatFinanceStore(selectCurrentMember);
  const isAdmin = useFlatFinanceStore(selectIsAdmin);
  const expenses = useFlatFinanceStore((s) => s.expenses);
  const members = useFlatFinanceStore((s) => s.members);
  const addExpense = useFlatFinanceStore((s) => s.addExpense);
  const approveExpense = useFlatFinanceStore((s) => s.approveExpense);
  const updateExpense = useFlatFinanceStore((s) => s.updateExpense);
  const softDelete = useFlatFinanceStore((s) => s.softDeleteExpense);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  // Receipt handling
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Receipt lightbox for viewing existing receipts
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleFileSelect = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setReceiptLoading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      setReceiptPreview(dataUrl);
    } catch {
      toast.error("Failed to read image");
    } finally {
      setReceiptLoading(false);
    }
  };

  const visible = useMemo(
    () =>
      expenses
        .filter((e) => !e.deleted)
        .filter((e) =>
          filter === "all" ? true : filter === "approved" ? e.approved : !e.approved,
        ),
    [expenses, filter],
  );

  const totals = useMemo(() => {
    const all = expenses.filter((e) => !e.deleted && e.approved).reduce((s, e) => s + e.amount, 0);
    const pending = expenses.filter((e) => !e.deleted && !e.approved).reduce((s, e) => s + e.amount, 0);
    return { all, pending };
  }, [expenses]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, category: "Grocery", description: "", date: todayIso() },
  });

  const onSubmit = async (v: Values) => {
    if (!me) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 350));
    addExpense({
      amount: v.amount,
      category: v.category,
      description: v.description,
      date: v.date,
      addedBy: me.id,
      approved: isAdmin,
      receiptDataUrl: receiptPreview ?? undefined,
    });
    toast.success("Expense added", {
      description: `৳${v.amount.toLocaleString("en-BD")} — ${v.description}${receiptPreview ? " · with receipt" : ""}`,
    });
    setSubmitting(false);
    setOpen(false);
    setReceiptPreview(null);
    form.reset({ amount: 0, category: "Grocery", description: "", date: todayIso() });
  };

  const onOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setReceiptPreview(null);
      form.reset({ amount: 0, category: "Grocery", description: "", date: todayIso() });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Every grocery run, bill and miscellaneous spend — split fairly at month-end."
        actions={
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground hover:brightness-110">
                <Plus className="mr-1.5 h-4 w-4" />
                Add expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New expense</DialogTitle>
                <DialogDescription>
                  {isAdmin ? "Admins auto-approve." : "Submitted expenses await admin approval."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount (৳)</Label>
                    <Input id="amount" type="number" min={0} step="0.01" inputMode="decimal" {...form.register("amount")} />
                    {form.formState.errors.amount ? (
                      <p className="text-xs text-[color:var(--color-destructive)]">{form.formState.errors.amount.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select defaultValue="Grocery" onValueChange={(v) => form.setValue("category", v as ExpenseCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem value={c} key={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" rows={2} placeholder="Monthly grocery run from Agora" {...form.register("description")} />
                  {form.formState.errors.description ? (
                    <p className="text-xs text-[color:var(--color-destructive)]">{form.formState.errors.description.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" {...form.register("date")} />
                </div>

                {/* ── Receipt capture ── */}
                <div className="space-y-2">
                  <Label>Receipt photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <AnimatePresence mode="wait">
                    {receiptPreview ? (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative"
                      >
                        <img
                          src={receiptPreview}
                          alt="Receipt"
                          className="w-full rounded-xl border border-border object-cover max-h-48"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full"
                          onClick={() => setReceiptPreview(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="buttons"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex gap-2"
                      >
                        {/* Camera capture (mobile) */}
                        <Button
                          type="button"
                          variant="secondary"
                          className="flex-1"
                          disabled={receiptLoading}
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
                          Take photo
                        </Button>
                        {/* File picker */}
                        <Button
                          type="button"
                          variant="secondary"
                          className="flex-1"
                          disabled={receiptLoading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Image className="mr-1.5 h-4 w-4" />
                          Upload
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hidden inputs */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground hover:brightness-110">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add expense"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-elevated p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Approved total</p>
          <p className="mt-2 font-mono text-2xl font-semibold"><MoneyCell amount={totals.all} /></p>
        </div>
        <div className="card-elevated p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pending approval</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-[color:var(--color-warning)]">
            <MoneyCell amount={totals.pending} tone="neutral" />
          </p>
        </div>
        <div className="card-elevated flex items-center gap-2 p-5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-1 gap-1">
            {(["all", "pending", "approved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${
                  filter === f
                    ? "bg-[color:var(--color-primary)] text-primary-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-accent)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="No expenses to show"
          description="Add your first expense to start tracking spending."
        />
      ) : (
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {visible.map((e) => {
            const actor = members.find((m) => m.id === e.addedBy);
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 px-5 py-4"
              >
                {/* Receipt thumbnail or icon */}
                {e.receiptDataUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(e.receiptDataUrl!)}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border group"
                    aria-label="View receipt"
                  >
                    <img src={e.receiptDataUrl} alt="Receipt" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="h-4 w-4 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-accent)]">
                    <Receipt className="h-4 w-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                    {e.receiptDataUrl ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Camera className="h-3 w-3" /> Receipt
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(e.date)} · {actor?.name ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <MoneyCell amount={e.amount} className="text-sm font-semibold" />
                  <p className={`mt-0.5 text-[10px] ${e.approved ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-warning)]"}`}>
                    {e.approved ? "approved" : "pending"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!e.approved && isAdmin ? (
                    <Button size="icon" variant="ghost" onClick={() => { approveExpense(e.id); toast.success("Expense approved"); }} aria-label="Approve">
                      <Check className="h-4 w-4 text-[color:var(--color-positive)]" />
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                          <AlertDialogDescription>This will soft-delete the expense and exclude it from settlements.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => { softDelete(e.id); toast.success("Expense removed"); }}
                            className="bg-[color:var(--color-destructive)] text-destructive-foreground hover:brightness-110"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Receipt lightbox */}
      <AnimatePresence>
        {lightboxUrl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-h-[90vh] max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lightboxUrl} alt="Receipt" className="rounded-xl max-h-[85vh] object-contain" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 rounded-full"
                onClick={() => setLightboxUrl(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

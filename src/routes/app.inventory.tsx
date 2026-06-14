import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";

export const Route = createFileRoute("/app/inventory")({
  ssr: false,
  head: () => ({ meta: [{ title: "Inventory — FlatFinance" }] }),
  component: InventoryPage,
});

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1).max(10),
  costPerUnit: z.coerce.number().min(0),
  lowThreshold: z.coerce.number().min(0),
});
type Values = z.infer<typeof schema>;

function InventoryPage() {
  const inventory = useFlatFinanceStore((s) => s.inventory);
  const add = useFlatFinanceStore((s) => s.addInventoryItem);
  const update = useFlatFinanceStore((s) => s.updateInventoryItem);
  const remove = useFlatFinanceStore((s) => s.deleteInventoryItem);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", quantity: 0, unit: "kg", costPerUnit: 0, lowThreshold: 1 },
  });

  const onSubmit = async (v: Values) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 250));
    add(v);
    setBusy(false);
    setOpen(false);
    toast.success(`${v.name} added to inventory`);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Pantry items, quantities and low-stock alerts."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground hover:brightness-110">
                <Plus className="mr-1.5 h-4 w-4" /> Add item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add inventory item</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Item name</Label>
                  <Input placeholder="Rice" {...form.register("name")} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" step="0.1" min={0} {...form.register("quantity")} /></div>
                  <div className="space-y-1.5"><Label>Unit</Label><Input placeholder="kg / L / pcs" {...form.register("unit")} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Cost / unit (৳)</Label><Input type="number" min={0} step="0.01" {...form.register("costPerUnit")} /></div>
                  <div className="space-y-1.5"><Label>Low-stock threshold</Label><Input type="number" min={0} step="0.1" {...form.register("lowThreshold")} /></div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {inventory.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="Pantry is empty" description="Add rice, oil, lentils, and other staples to track stock." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inventory.map((i) => {
            const low = i.quantity <= i.lowThreshold;
            return (
              <div key={i.id} className="card-elevated p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <MoneyCell amount={i.costPerUnit} className="text-xs" /> / {i.unit}
                    </p>
                  </div>
                  {low ? <Badge className="bg-[color:var(--color-warning)] text-[color:var(--color-warning-foreground)] text-[10px]">Low</Badge> : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update(i.id, { quantity: Math.max(0, i.quantity - 1) })}>−</Button>
                  <span className="min-w-12 text-center font-mono text-lg">{i.quantity} <span className="text-xs text-muted-foreground">{i.unit}</span></span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update(i.id, { quantity: i.quantity + 1 })}>+</Button>
                  <div className="ml-auto">
                    <Button size="icon" variant="ghost" onClick={() => { remove(i.id); toast.success(`${i.name} removed`); }}>
                      <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

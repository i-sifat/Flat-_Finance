import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UtensilsCrossed, Plus, Minus, Check, Loader2, Users2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  selectActiveMembers,
  selectCurrentMember,
  selectIsAdmin,
  useFlatFinanceStore,
} from "@/store/useFlatFinanceStore";
import { currentMonth, formatDateLong, formatDateShort, todayIso } from "@/lib/format";
import type { GuestRecord, MealEntryRecord } from "@/store/types";

export const Route = createFileRoute("/app/meals")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meals — FlatFinance" }] }),
  component: MealsPage,
});

// ─── Guest form schema ────────────────────────────────────────────────────────
const guestSchema = z.object({
  name: z.string().trim().min(1, "Enter guest name").max(60),
  hostMemberId: z.string().min(1, "Select a host"),
  splitAmongAll: z.boolean(),
  arrivalDate: z.string().min(8),
  departureDate: z.string().min(8),
  breakfastTotal: z.coerce.number().int().min(0),
  lunchTotal: z.coerce.number().int().min(0),
  dinnerTotal: z.coerce.number().int().min(0),
  note: z.string().max(200).optional(),
}).refine((v) => v.departureDate >= v.arrivalDate, {
  message: "Departure must be on or after arrival",
  path: ["departureDate"],
});
type GuestValues = z.infer<typeof guestSchema>;

function MealsPage() {
  const me = useFlatFinanceStore(selectCurrentMember);
  const isAdmin = useFlatFinanceStore(selectIsAdmin);
  const members = useFlatFinanceStore(selectActiveMembers);
  const allMembers = useFlatFinanceStore((s) => s.members);
  const meals = useFlatFinanceStore((s) => s.meals);
  const guests = useFlatFinanceStore((s) => s.guests);
  const upsert = useFlatFinanceStore((s) => s.upsertMealEntry);
  const approve = useFlatFinanceStore((s) => s.approveMealEntry);
  const addGuest = useFlatFinanceStore((s) => s.addGuest);
  const updateGuest = useFlatFinanceStore((s) => s.updateGuest);
  const deleteGuest = useFlatFinanceStore((s) => s.deleteGuest);

  const [date, setDate] = useState(todayIso());
  const [guestOpen, setGuestOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestRecord | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);

  const dayEntries = useMemo(
    () => new Map(meals.filter((m) => m.date === date).map((m) => [m.memberId, m])),
    [meals, date],
  );

  const monthEntries = useMemo(
    () => meals.filter((m) => m.date.startsWith(currentMonth())),
    [meals],
  );

  const monthTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of monthEntries) {
      map.set(m.memberId, (map.get(m.memberId) ?? 0) + m.breakfast + m.lunch + m.dinner + m.guestMeals);
    }
    return map;
  }, [monthEntries]);

  const handleAdjust = (memberId: string, field: keyof Pick<MealEntryRecord, "breakfast" | "lunch" | "dinner" | "guestMeals">, delta: number) => {
    const existing = dayEntries.get(memberId);
    const current = existing?.[field] ?? 0;
    const next = Math.max(0, current + delta);
    const isLate = date !== todayIso();
    upsert({
      memberId, date,
      breakfast: existing?.breakfast ?? 0,
      lunch: existing?.lunch ?? 0,
      dinner: existing?.dinner ?? 0,
      guestMeals: existing?.guestMeals ?? 0,
      [field]: next,
      approved: !isLate || isAdmin,
      isLateEntry: isLate,
    });
  };

  // Guest form
  const guestForm = useForm<GuestValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: "", hostMemberId: me?.id ?? members[0]?.id ?? "", splitAmongAll: false,
      arrivalDate: todayIso(), departureDate: todayIso(),
      breakfastTotal: 0, lunchTotal: 0, dinnerTotal: 0, note: "",
    },
  });

  const openGuestDialog = (guest?: GuestRecord) => {
    if (guest) {
      setEditingGuest(guest);
      guestForm.reset({
        name: guest.name,
        hostMemberId: guest.hostMemberId,
        splitAmongAll: guest.splitAmongAll,
        arrivalDate: guest.arrivalDate,
        departureDate: guest.departureDate,
        breakfastTotal: guest.meals.breakfast,
        lunchTotal: guest.meals.lunch,
        dinnerTotal: guest.meals.dinner,
        note: guest.note ?? "",
      });
    } else {
      setEditingGuest(null);
      guestForm.reset({
        name: "", hostMemberId: me?.id ?? members[0]?.id ?? "", splitAmongAll: false,
        arrivalDate: todayIso(), departureDate: todayIso(),
        breakfastTotal: 0, lunchTotal: 0, dinnerTotal: 0, note: "",
      });
    }
    setGuestOpen(true);
  };

  const onGuestSubmit = async (v: GuestValues) => {
    setGuestBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    const payload = {
      name: v.name,
      hostMemberId: v.hostMemberId,
      splitAmongAll: v.splitAmongAll,
      arrivalDate: v.arrivalDate,
      departureDate: v.departureDate,
      meals: { breakfast: v.breakfastTotal, lunch: v.lunchTotal, dinner: v.dinnerTotal },
      note: v.note || undefined,
    };
    if (editingGuest) {
      updateGuest(editingGuest.id, payload);
      toast.success("Guest updated");
    } else {
      addGuest(payload);
      toast.success(`${v.name} added as guest`);
    }
    setGuestBusy(false);
    setGuestOpen(false);
  };

  if (members.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meals" description="Log daily meals for the flat." />
        <EmptyState
          icon={<UtensilsCrossed className="h-5 w-5" />}
          title="No active members yet"
          description="Add flatmates first, then come back to log meals."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meals"
        description="Log per-flatmate meals and manage guests."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="meal-date" className="text-xs text-muted-foreground">Date</Label>
            <Input
              id="meal-date" type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayIso()} className="w-44"
            />
          </div>
        }
      />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily log</TabsTrigger>
          <TabsTrigger value="guests">
            Guests
            {guests.length > 0 ? (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">{guests.length}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Daily log ── */}
        <TabsContent value="daily" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Entries for <span className="text-foreground font-medium">{formatDateLong(date)}</span>
            {date !== todayIso() ? <span className="ml-2 text-[color:var(--color-warning)]">· late entry (needs approval)</span> : null}
          </p>
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {members.map((m) => {
              const entry = dayEntries.get(m.id);
              const monthTotal = monthTotals.get(m.id) ?? 0;
              const dayTotal = (entry?.breakfast ?? 0) + (entry?.lunch ?? 0) + (entry?.dinner ?? 0) + (entry?.guestMeals ?? 0);
              return (
                <div key={m.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr,auto] sm:items-center">
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={m} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.name}
                        {m.id === me?.id ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">Today {dayTotal} · This month {monthTotal}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    <MealCounter label="B'fast" value={entry?.breakfast ?? 0} onAdd={() => handleAdjust(m.id, "breakfast", 1)} onSub={() => handleAdjust(m.id, "breakfast", -1)} />
                    <MealCounter label="Lunch" value={entry?.lunch ?? 0} onAdd={() => handleAdjust(m.id, "lunch", 1)} onSub={() => handleAdjust(m.id, "lunch", -1)} />
                    <MealCounter label="Dinner" value={entry?.dinner ?? 0} onAdd={() => handleAdjust(m.id, "dinner", 1)} onSub={() => handleAdjust(m.id, "dinner", -1)} />
                    <MealCounter label="Guest" value={entry?.guestMeals ?? 0} onAdd={() => handleAdjust(m.id, "guestMeals", 1)} onSub={() => handleAdjust(m.id, "guestMeals", -1)} />
                  </div>
                  {entry && entry.isLateEntry && !entry.approved ? (
                    <div className="sm:col-span-2 flex items-center justify-end gap-2">
                      <span className="text-[11px] text-[color:var(--color-warning)]">Late entry — pending</span>
                      {isAdmin ? (
                        <Button size="sm" variant="secondary" onClick={() => { approve(entry.id); toast.success("Late entry approved"); }}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Guest management ── */}
        <TabsContent value="guests" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Guests whose meal costs are billed to a host or split among all flatmates.
            </p>
            <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
              <DialogTrigger asChild>
                <Button
                  className="gradient-primary text-primary-foreground hover:brightness-110"
                  onClick={() => openGuestDialog()}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add guest
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingGuest ? "Edit guest" : "Add guest"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={guestForm.handleSubmit(onGuestSubmit)} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label>Guest name</Label>
                    <Input placeholder="e.g. Rahim's cousin" {...guestForm.register("name")} />
                    {guestForm.formState.errors.name ? (
                      <p className="text-xs text-[color:var(--color-destructive)]">{guestForm.formState.errors.name.message}</p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Arrival date</Label>
                      <Input type="date" {...guestForm.register("arrivalDate")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Departure date</Label>
                      <Input type="date" {...guestForm.register("departureDate")} />
                      {guestForm.formState.errors.departureDate ? (
                        <p className="text-xs text-[color:var(--color-destructive)]">{guestForm.formState.errors.departureDate.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4 space-y-3 bg-[color:var(--color-surface)]">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total meals during stay</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Breakfasts</Label>
                        <Input type="number" min={0} {...guestForm.register("breakfastTotal")} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lunches</Label>
                        <Input type="number" min={0} {...guestForm.register("lunchTotal")} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dinners</Label>
                        <Input type="number" min={0} {...guestForm.register("dinnerTotal")} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-border p-4 bg-[color:var(--color-surface)]">
                    <Switch
                      id="split-all"
                      checked={guestForm.watch("splitAmongAll")}
                      onCheckedChange={(v) => guestForm.setValue("splitAmongAll", v)}
                    />
                    <div>
                      <Label htmlFor="split-all" className="cursor-pointer">Split cost among all flatmates</Label>
                      <p className="text-xs text-muted-foreground">Off = host pays the full guest meal cost</p>
                    </div>
                  </div>

                  {!guestForm.watch("splitAmongAll") ? (
                    <div className="space-y-1.5">
                      <Label>Host member (pays for the guest)</Label>
                      <Select
                        value={guestForm.watch("hostMemberId")}
                        onValueChange={(v) => guestForm.setValue("hostMemberId", v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allMembers.filter((m) => m.status === "active").map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Textarea rows={2} placeholder="e.g. Staying for Eid holiday" {...guestForm.register("note")} />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setGuestOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={guestBusy} className="gradient-primary text-primary-foreground">
                      {guestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : editingGuest ? "Save changes" : "Add guest"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {guests.length === 0 ? (
            <EmptyState
              icon={<Users2 className="h-5 w-5" />}
              title="No guests yet"
              description="Add a guest to track their meals and bill the cost to a host or split it."
              action={
                <Button
                  className="gradient-primary text-primary-foreground hover:brightness-110"
                  onClick={() => openGuestDialog()}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add first guest
                </Button>
              }
            />
          ) : (
            <div className="card-elevated divide-y divide-border overflow-hidden">
              {guests.map((g) => {
                const host = allMembers.find((m) => m.id === g.hostMemberId);
                const totalMeals = g.meals.breakfast + g.meals.lunch + g.meals.dinner;
                return (
                  <div key={g.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--color-accent)] font-semibold text-sm">
                      {g.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{g.name}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {g.splitAmongAll ? "Split all" : `Host: ${host?.name ?? "—"}`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateShort(g.arrivalDate)} → {formatDateShort(g.departureDate)}
                        {" · "}
                        {totalMeals} meals total
                        {" · "}
                        B{g.meals.breakfast} / L{g.meals.lunch} / D{g.meals.dinner}
                      </p>
                      {g.note ? <p className="text-xs text-muted-foreground mt-0.5 italic">{g.note}</p> : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => openGuestDialog(g)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Delete">
                            <Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove guest "{g.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>Their meal costs will be removed from this month's settlement.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { deleteGuest(g.id); toast.success("Guest removed"); }}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MealCounter({
  label, value, onAdd, onSub,
}: {
  label: string; value: number; onAdd: () => void; onSub: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void) => { setBusy(true); fn(); requestAnimationFrame(() => setBusy(false)); };
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-[color:var(--color-surface-elevated)] p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(onSub)} disabled={value === 0}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span key={value} className="animate-pop-in min-w-5 text-center font-mono text-base font-semibold">{value}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(onAdd)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

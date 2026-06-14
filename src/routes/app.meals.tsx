import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UtensilsCrossed, Plus, Minus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import {
  selectActiveMembers,
  selectCurrentMember,
  selectIsAdmin,
  useFlatFinanceStore,
} from "@/store/useFlatFinanceStore";
import { currentMonth, formatDateLong, todayIso } from "@/lib/format";
import type { MealEntryRecord } from "@/store/types";

export const Route = createFileRoute("/app/meals")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meals — FlatFinance" }] }),
  component: MealsPage,
});

function MealsPage() {
  const me = useFlatFinanceStore(selectCurrentMember);
  const isAdmin = useFlatFinanceStore(selectIsAdmin);
  const members = useFlatFinanceStore(selectActiveMembers);
  const meals = useFlatFinanceStore((s) => s.meals);
  const upsert = useFlatFinanceStore((s) => s.upsertMealEntry);
  const approve = useFlatFinanceStore((s) => s.approveMealEntry);

  const [date, setDate] = useState(todayIso());

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
      memberId,
      date,
      breakfast: existing?.breakfast ?? 0,
      lunch: existing?.lunch ?? 0,
      dinner: existing?.dinner ?? 0,
      guestMeals: existing?.guestMeals ?? 0,
      [field]: next,
      approved: !isLate || isAdmin,
      isLateEntry: isLate,
    });
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
        description="Tap to log breakfast, lunch, dinner and guest meals per flatmate."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="meal-date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input
              id="meal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayIso()}
              className="w-44"
            />
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">
        Showing entries for <span className="text-foreground font-medium">{formatDateLong(date)}</span>
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
                  <p className="truncate text-sm font-medium">{m.name}{m.id === me?.id ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}</p>
                  <p className="text-xs text-muted-foreground">
                    Today {dayTotal} · This month {monthTotal}
                  </p>
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
    </div>
  );
}

function MealCounter({
  label,
  value,
  onAdd,
  onSub,
}: {
  label: string;
  value: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void) => {
    setBusy(true);
    fn();
    requestAnimationFrame(() => setBusy(false));
  };
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-[color:var(--color-surface-elevated)] p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(onSub)} disabled={value === 0}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span key={value} className="animate-pop-in min-w-5 text-center font-mono text-base font-semibold">
          {value}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(onAdd)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

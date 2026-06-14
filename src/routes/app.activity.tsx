import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/app/activity")({
  ssr: false,
  head: () => ({ meta: [{ title: "Activity — FlatFinance" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const activity = useFlatFinanceStore((s) => s.activity);
  const members = useFlatFinanceStore((s) => s.members);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity log" description="A complete audit trail of every action in the flat." />
      {activity.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="No activity yet" />
      ) : (
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {activity.map((a) => {
            const actor = members.find((m) => m.id === a.memberId);
            return (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                {actor ? <MemberAvatar member={actor} size="sm" /> : <div className="h-8 w-8 rounded-full bg-[color:var(--color-accent)]" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{a.details}</p>
                  <p className="text-[11px] text-muted-foreground">{a.action.replace(/_/g, " ").toLowerCase()} · {formatRelative(a.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

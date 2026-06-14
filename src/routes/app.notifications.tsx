import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { formatRelative } from "@/lib/format";
import type { NotificationType } from "@/store/types";

export const Route = createFileRoute("/app/notifications")({
  ssr: false,
  head: () => ({ meta: [{ title: "Notifications — FlatFinance" }] }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationType, React.ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <AlertOctagon className="h-4 w-4" />,
};

const TONE: Record<NotificationType, string> = {
  info: "text-[color:var(--color-primary)]",
  success: "text-[color:var(--color-positive)]",
  warning: "text-[color:var(--color-warning)]",
  error: "text-[color:var(--color-destructive)]",
};

function NotificationsPage() {
  const items = useFlatFinanceStore((s) => s.notifications);
  const markAll = useFlatFinanceStore((s) => s.markAllNotificationsRead);
  const mark = useFlatFinanceStore((s) => s.markNotificationRead);
  const clear = useFlatFinanceStore((s) => s.clearNotification);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Updates from across your flat."
        actions={items.length > 0 ? (
          <Button variant="secondary" onClick={markAll}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
          </Button>
        ) : null}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="You're all caught up" description="New activity will show up here." />
      ) : (
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {items.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read ? "" : "bg-[color:var(--color-accent)]/30"}`}>
              <div className={`grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--color-accent)] ${TONE[n.type]}`}>{ICONS[n.type]}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1">
                {!n.read ? <Button size="sm" variant="ghost" onClick={() => mark(n.id)}>Mark read</Button> : null}
                <Button size="icon" variant="ghost" onClick={() => clear(n.id)}><Trash2 className="h-4 w-4 text-[color:var(--color-destructive)]" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

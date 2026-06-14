import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("flatfinance:v1");
      if (!raw) throw redirect({ to: "/auth" });
      const parsed = JSON.parse(raw) as {
        state?: { currentMemberId?: string | null; flat?: unknown | null };
      };
      if (!parsed.state?.currentMemberId) throw redirect({ to: "/auth" });
      if (!parsed.state?.flat) throw redirect({ to: "/onboarding" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

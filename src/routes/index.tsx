import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("flatfinance:v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { currentMemberId?: string | null; flat?: unknown | null } };
        if (parsed.state?.currentMemberId && parsed.state?.flat) {
          throw redirect({ to: "/app" });
        }
        if (parsed.state?.currentMemberId && !parsed.state?.flat) {
          throw redirect({ to: "/onboarding" });
        }
      }
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});

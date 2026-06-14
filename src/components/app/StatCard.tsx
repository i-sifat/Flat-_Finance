import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatTaka } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
  asMoney?: boolean;
  className?: string;
}

const toneText: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-[color:var(--color-positive)]",
  negative: "text-[color:var(--color-destructive)]",
  warning: "text-[color:var(--color-warning)]",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  asMoney = false,
  className,
}: StatCardProps) {
  const display =
    asMoney && typeof value === "number" ? formatTaka(value) : String(value);

  return (
    <div
      className={cn(
        "card-elevated relative overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon ? (
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--color-accent)] text-foreground/80">
            {icon}
          </div>
        ) : null}
      </div>
      <p className={cn("mt-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl", toneText[tone])}>
        {display}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { formatTaka } from "@/lib/format";

interface MoneyCellProps {
  amount: number;
  tone?: "auto" | "positive" | "negative" | "neutral";
  signed?: boolean;
  className?: string;
}

export function MoneyCell({ amount, tone = "neutral", signed, className }: MoneyCellProps) {
  const resolved =
    tone === "auto"
      ? amount > 0.01
        ? "positive"
        : amount < -0.01
          ? "negative"
          : "neutral"
      : tone;
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        resolved === "positive" && "text-[color:var(--color-positive)]",
        resolved === "negative" && "text-[color:var(--color-destructive)]",
        resolved === "neutral" && "text-foreground",
        className,
      )}
    >
      {formatTaka(amount, { signed })}
    </span>
  );
}

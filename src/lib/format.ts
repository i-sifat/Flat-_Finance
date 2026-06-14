/**
 * Money & date formatting helpers for FlatFinance (Bangladesh, ৳ TAKA).
 * Always use formatTaka() — never inline ৳ + number formatting in components.
 */

const takaFormatter = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const takaSignedFormatter = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export function formatTaka(amount: number, options?: { signed?: boolean; compact?: boolean }): string {
  if (!Number.isFinite(amount)) return "৳0";
  if (options?.compact && Math.abs(amount) >= 1000) {
    const value = amount / (Math.abs(amount) >= 100000 ? 100000 : 1000);
    const suffix = Math.abs(amount) >= 100000 ? "L" : "k";
    return `৳${value.toFixed(value < 10 ? 1 : 0)}${suffix}`;
  }
  const fmt = options?.signed ? takaSignedFormatter : takaFormatter;
  return `৳${fmt.format(amount)}`;
}

export function parseTakaInput(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateShort(iso);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) return yyyyMm;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function createId(prefix = "id"): string {
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}_${t}${r}`;
}

export function createInviteCode(): string {
  // 8-char alphanumeric, easy to read, no ambiguous chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

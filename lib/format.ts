// Display formatting only. KASH amounts are decimal strings end-to-end and are
// never parsed for arithmetic — parseFloat here exists purely to prettify.

export function formatKash(amount: string): string {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return `${amount} KASH`;
  const text = n % 1 === 0 ? String(n) : amount.replace(/0+$/, "").replace(/\.$/, "");
  return `${text} KASH`;
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

const UNITS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.34, "week"],
  [12, "month"],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  let delta = (then - now) / 1000;
  for (const [step, unit] of UNITS) {
    if (Math.abs(delta) < step) return rtf.format(Math.round(delta), unit);
    delta /= step;
  }
  return rtf.format(Math.round(delta), "year");
}

// Date only — for anniversaries and billing dates, where a clock time is
// noise. Invalid input yields "" so callers can render nothing.
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "02:41:09" style countdown for scheduled streams. Negative distances clamp
// to zero so a stream that just flipped live never shows "-0:01".
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

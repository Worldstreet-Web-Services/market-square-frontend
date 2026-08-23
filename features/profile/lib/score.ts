// Spotlight scores arrive as decimal strings. Display-only parse — never
// arithmetic on the parsed number.
export function formatKashScore(score: string): string {
  const n = Number.parseFloat(score);
  if (!Number.isFinite(n)) return score;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

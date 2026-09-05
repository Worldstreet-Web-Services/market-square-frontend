/**
 * The stamp on a conversation row.
 *
 * Node 15:1302 uses the inbox convention that WhatsApp, iMessage, Telegram
 * and Slack all use, and it is visible in the file's own five rows: today's
 * threads carry a CLOCK — `21:47`, `16:58`, `11:39` — and older ones carry an
 * AGE, `2d` and `5d`. The two are answering different questions. Within today
 * "16:58" is placeable against your own memory of the day; "7h ago" makes you
 * do the arithmetic. Past today the clock is worthless and the gap is the
 * whole point.
 *
 * `relativeTime` in `lib/format.ts` renders "10 minutes ago", which is right
 * for a post — a post is an event, and how long ago it happened is the fact.
 * A conversation is a place you left, so this is deliberately its own
 * function rather than a parameter on that one.
 *
 * WIDTH is why the units are single letters. The column reserves 12–25px for
 * this and the file's own rows are `2d` and `5d`; "5 days ago" would either
 * wrap or push the unread pill off the row.
 *
 * Local time, and local midnight, on purpose: "today" means the reader's
 * today. That makes the output machine-dependent, so `now` is injectable and
 * the tests pin every boundary rather than trusting the host clock.
 */
export function inboxTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const then = new Date(iso);
  const at = then.getTime();
  if (Number.isNaN(at)) return "";

  // A stamp in the future is a clock-skew artefact, not a prediction. Reading
  // it as "today" shows the clock, which is the least confusing thing a
  // slightly-fast server timestamp can do.
  if (at > now) return clock(then);

  const today = startOfDay(new Date(now));
  if (at >= today.getTime()) return clock(then);

  // Whole CALENDAR days back, not 86_400_000-second buckets: something sent
  // at 23:50 last night is "1d" at 00:10 this morning, not "0d". Computed
  // from local midnights so a DST change cannot make a day 23 or 25 hours
  // long and shift the answer.
  const days = Math.round((today.getTime() - startOfDay(then).getTime()) / 86_400_000);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  // Past a month the gap stops being useful and the date is the better
  // answer. No year: a conversation this old is already "a long time ago",
  // and the row has no room for one.
  return then.toLocaleDateString("en", { month: "short", day: "numeric" });
}

/** 24-hour, zero-padded — `21:47` and `09:05`, as the file writes them. */
function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

import type { Message } from "./types.ts";

/**
 * The thread's day separators and clock times.
 *
 * The design draws the thread as day sections — a centred "Yesterday" and
 * "Today" over their messages — and stamps every bubble with a wall-clock time
 * rather than the "5d" relative form the inbox uses. Both are pure functions
 * of the message's `createdAt` and the current time, so they live here and are
 * tested rather than being inlined into the view.
 *
 * Everything below reads LOCAL calendar days. A thread is read by one person
 * in one place, and "Today" has to mean their today, not UTC's.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day as `YYYY-MM-DD` — the grouping key. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole calendar days between two instants, ignoring the time of day.
    Both sides are flattened to local midnight first, so an 23:59 → 00:01 pair
    is one day apart rather than zero, and `Math.round` absorbs the hour that a
    daylight-saving boundary adds or removes. */
function daysApart(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * What the separator over a day's messages reads.
 *
 * "Today" and "Yesterday" are the file's own two labels. Anything older gets a
 * date — the file never shows one, so this is ours: month and day, plus the
 * year only when it is not the current one, because "12 March" in a thread you
 * are reading in a later year is a lie by omission.
 */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date(now);
  const delta = daysApart(date, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";

  return date.toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Wall-clock time for a bubble — `17:25`.
 *
 * 24-hour, which is what the file draws, and assembled by hand rather than
 * through `Intl` so it does not become 5:25 PM under a US locale and stop
 * matching the design. Two digits either side, local time.
 */
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface DayGroup<T> {
  /** `YYYY-MM-DD` for a real date, `unknown` for an unparseable one. */
  key: string;
  /** Empty when the timestamp could not be read — the view draws no separator
      rather than an empty one. */
  label: string;
  messages: T[];
}

/**
 * Split a thread into the day sections the design draws.
 *
 * Consecutive runs, NOT a global bucket-by-day. The service returns messages
 * ordered by `createdAt`, so the two are the same on real data; they differ
 * only if an out-of-order message arrives, and then a run keeps it next to the
 * messages it actually arrived beside instead of teleporting it into a section
 * further up the thread. A repeated label is a visible, honest artefact of
 * out-of-order data; a message under the wrong heading is not.
 *
 * `now` is injectable so the "Today"/"Yesterday" boundary is testable.
 */
export function groupMessagesByDay<T extends Pick<Message, "createdAt">>(
  messages: T[],
  now: number = Date.now()
): Array<DayGroup<T>> {
  const groups: Array<DayGroup<T>> = [];

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? dayKey(date) : "unknown";

    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
      continue;
    }

    groups.push({
      key,
      label: valid ? dayLabel(message.createdAt, now) : "",
      messages: [message],
    });
  }

  return groups;
}

import type { Message } from "./types.ts";

/** A day's worth of messages, under the label the thread prints above them. */
export interface DayGroup<T> {
  /** Stable key — the ISO date, not the label, which repeats every year. */
  key: string;
  /** "Today", "Yesterday", or the date written out. */
  label: string;
  items: T[];
}

const DAY = 86_400_000;

/** Midnight local time, as a number, so two instants can be compared by day. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Split a thread into day groups, oldest first.
 *
 * The design prints "Yesterday" and "Today" above each run of messages, which
 * is the only thing that makes a long thread readable — without it a reply
 * sent a week later sits flush against the one it answers.
 *
 * Comparison is by LOCAL midnight, not by elapsed hours: 23:59 and 00:01 are
 * four hours apart in a naive difference and belong to different days to every
 * person reading them. `now` is injected so the grouping is testable without
 * waiting for midnight.
 *
 * A message with an unparseable timestamp keeps its place in the thread under
 * an "Earlier" heading rather than being dropped — a message that exists must
 * be readable even when its clock is not.
 */
export function groupByDay<T extends Pick<Message, "createdAt">>(
  messages: T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const today = startOfDay(now);
  const groups: DayGroup<T>[] = [];

  for (const message of messages) {
    const at = new Date(message.createdAt);
    const valid = !Number.isNaN(at.getTime());
    const key = valid ? new Date(startOfDay(at)).toISOString().slice(0, 10) : "unknown";

    let label = "Earlier";
    if (valid) {
      const day = startOfDay(at);
      if (day === today) label = "Today";
      else if (day === today - DAY) label = "Yesterday";
      else {
        label = at.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          // The year only when it is not this one — "3 March 2025" reads as
          // history, "3 March" reads as recent, and printing the year on
          // everything makes this year look like history too.
          ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
        });
      }
    }

    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(message);
    else groups.push({ key, label, items: [message] });
  }

  return groups;
}

/** 24-hour clock, as the design prints it: 17:25, 21:38. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

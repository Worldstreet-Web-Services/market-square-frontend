/**
 * THE MONTH GRID AND THE CLOCK, AS ARITHMETIC.
 *
 * A native `datetime-local` is the browser's own control: it renders
 * `dd/mm/yyyy, --:--` in the platform's chrome, ignores every token this app
 * paints with, and reads as a form field borrowed from another product. So the
 * picker is ours — and the part that is genuinely easy to get wrong is the
 * date arithmetic, not the markup, which is why all of it lives here as pure
 * functions `node --test` can pin.
 *
 * Everything is LOCAL time. A room opens at nine o'clock where the host is
 * standing, so a UTC round-trip in the middle would move it.
 */

export interface CalendarCell {
  /** Day of the month, or null for the leading/trailing blanks. */
  day: number | null;
  /** `YYYY-MM-DD` for a real day, so a cell carries its own identity. */
  iso: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` in LOCAL time — `toISOString` would shift the day across UTC. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Days in a month, 1-indexed month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * The cells of a month, Monday-first, padded to whole weeks.
 *
 * Monday-first because the product's audience writes dates that way; the blank
 * cells are real entries rather than a shorter row so the grid keeps its
 * columns and the weekday headings stay over the right days.
 */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const total = daysInMonth(year, month);
  // getDay() is Sunday-0; shift so Monday is 0.
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push({ day: null, iso: null });
  for (let day = 1; day <= total; day += 1) {
    cells.push({ day, iso: `${year}-${pad(month)}-${pad(day)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
  return cells;
}

/** The month before/after, rolling the year over. */
export function stepMonth(year: number, month: number, by: 1 | -1): { year: number; month: number } {
  const index = (year * 12 + (month - 1)) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * A `YYYY-MM-DD` and an `HH:MM` joined into the `datetime-local` string the
 * sheet already submits, so the picker is a drop-in for the native control and
 * nothing downstream changes. Either half missing means no value at all.
 */
export function composeLocal(dateKey: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  return `${dateKey}T${time}`;
}

/** The two halves back out of that string, for re-opening the picker on a value. */
export function splitLocal(value: string): { dateKey: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? { dateKey: match[1], time: match[2] } : { dateKey: "", time: "" };
}

/**
 * Is this day before today? Compared as day keys rather than instants, so
 * "today" stays selectable all day instead of expiring at the current minute.
 */
export function isPastDay(dateKey: string, now: number = Date.now()): boolean {
  return dateKey < localDateKey(new Date(now));
}

/** "Sat, 19 Sep 2026" — what the closed field shows once a day is chosen. */
export function fieldLabel(value: string, locale?: string): string {
  const { dateKey, time } = splitLocal(value);
  if (!dateKey || !time) return "";
  const at = new Date(`${dateKey}T${time}`);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

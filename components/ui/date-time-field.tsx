"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClock } from "@/components/ui/icons";
import {
  composeLocal,
  fieldLabel,
  isPastDay,
  localDateKey,
  monthGrid,
  splitLocal,
  stepMonth,
} from "@/lib/calendar";

/**
 * WHEN SOMETHING STARTS — the app's own date and time control.
 *
 * It replaces `<input type="datetime-local">`, which renders the browser's own
 * `dd/mm/yyyy, --:--` chrome: a control painted by the platform, in the
 * platform's type, that no token in this app can reach. Inside a sheet built to
 * a design file it reads as a field borrowed from another product.
 *
 * This is deliberately NOT a dependency. The repo's standing rule is no
 * component library, and the hard part of a calendar is the arithmetic — which
 * lives in `lib/calendar.ts` as pure functions with tests, the pattern this
 * codebase already uses. What is left is markup, and markup is exactly the part
 * a library would get wrong here, since it would arrive with its own styling to
 * fight.
 *
 * The value is the same `YYYY-MM-DDTHH:MM` local string the native control
 * produced, so every caller's validation and submit stay as they were.
 */
export function DateTimeField({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name — the visible label sits outside, as the sheet draws it. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const gridId = useId();
  const { dateKey, time } = splitLocal(value);

  // Which month the grid shows: the chosen day's, else this one.
  const initial = dateKey ? new Date(`${dateKey}T00:00`) : new Date();
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() + 1 });

  // Escape closes, and so does a click outside — the same dismissal the sheet
  // itself has, so the two do not behave differently on the same screen.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const cells = monthGrid(view.year, view.month);
  const monthName = new Date(view.year, view.month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const today = localDateKey(new Date());

  const pickDay = (iso: string) => {
    // A day with no time yet opens at 09:00 rather than midnight — nobody
    // schedules a room for 00:00, and a silent midnight is a wrong answer that
    // looks like a chosen one.
    onChange(composeLocal(iso, time || "09:00"));
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center gap-2 rounded-[30px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[14px] text-white outline-none transition-colors hover:bg-white/[0.07] focus-visible:border-white/30"
      >
        <IconCalendar className="h-4 w-4 shrink-0 text-white/60" />
        <span className={cn("flex-1 truncate", !value && "text-white/50")}>
          {value ? fieldLabel(value) : "Pick a date and time"}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-[16px] border border-white/10 bg-[#121214] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center justify-between pb-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView(stepMonth(view.year, view.month, -1))}
              className="ws-press flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
            >
              <IconChevronLeft className="h-4 w-4 text-white/70" />
            </button>
            <span aria-live="polite" className="text-[13px] font-semibold text-white">
              {monthName}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(stepMonth(view.year, view.month, 1))}
              className="ws-press flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
            >
              <IconChevronRight className="h-4 w-4 text-white/70" />
            </button>
          </div>

          <div aria-hidden className="grid grid-cols-7 gap-1 pb-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}${index}`} className="text-center text-[11px] text-white/40">
                {day}
              </span>
            ))}
          </div>

          <div id={gridId} role="grid" className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (!cell.iso) return <span key={`blank${index}`} />;
              const past = isPastDay(cell.iso);
              const chosen = cell.iso === dateKey;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  disabled={past}
                  aria-selected={chosen}
                  aria-current={cell.iso === today ? "date" : undefined}
                  onClick={() => pickDay(cell.iso!)}
                  className={cn(
                    "flex aspect-square w-full items-center justify-center justify-self-center rounded-full text-[13px] transition-colors",
                    past && "cursor-not-allowed text-white/20",
                    !past && !chosen && "text-white/85 hover:bg-white/10",
                    chosen && "bg-spotlight font-semibold text-white",
                    !chosen && cell.iso === today && "ring-1 ring-inset ring-white/25"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-[30px] border border-white/10 bg-white/[0.04] px-3 py-2">
            <IconClock className="h-4 w-4 shrink-0 text-white/60" />
            <span className="text-[13px] text-white/60">Time</span>
            <input
              type="time"
              value={time}
              // The time half of the native control is a spinner, not a
              // calendar — it carries no platform chrome worth replacing.
              onChange={(event) => onChange(composeLocal(dateKey || today, event.target.value))}
              className="ml-auto bg-transparent text-[14px] text-white outline-none [color-scheme:dark]"
            />
          </label>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ws-press rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/80 hover:bg-white/10"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

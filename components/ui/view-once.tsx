"use client";

import { cn } from "@/lib/cn";

/**
 * ONE MARK AND ONE SWITCH FOR "SEEN ONCE, THEN GONE".
 *
 * View-once grew in two places at once — a toggle on the staged attachment and
 * a toggle in the camera's preview — and the same square was drawn three
 * separate times: on the bubble, in the camera, and in the composer. Three
 * drawings of one idea is how two of them end up different sizes, and how a
 * fourth gets invented next time.
 *
 * ─── WHY THE SENDER'S CONTROL WEARS THE RECEIVER'S MARK ──────────────────────
 * The square is what the OTHER person sees on the bubble: solid while it is
 * waiting, hollow once it has been opened. Putting the same mark on the
 * control means the sender recognises the thing they sent when it lands, which
 * is the cheapest kind of continuity a product can have.
 *
 * It is deliberately NOT a flame. A flame means streak — the thing that
 * happens when two people keep sending these — and a flame on the control
 * conflated the consequence with the act (ogazboiz, 2026-09-21: "can't you see
 * what is the purpose of fire there"). The flame belongs where a streak is
 * actually counted: the inbox row and the thread header.
 *
 * ─── AND WHY THE LABELS ARE NOT THE SAME WORD TWICE ──────────────────────────
 * A switch labelled "View once" in both states says what it IS in one and what
 * it WOULD DO in the other, and the reader cannot tell which. So each state
 * names itself: "View once" when armed, "Keep in chat" when not.
 */

/** Solid while it waits to be opened, hollow once it has been. */
export function ViewOnceMark({
  opened = false,
  className,
}: {
  opened?: boolean;
  className?: string;
}) {
  const solid = !opened;
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      fill="none"
    >
      <rect
        x={solid ? 1 : 1.6}
        y={solid ? 1 : 1.6}
        width={solid ? 12 : 10.8}
        height={solid ? 12 : 10.8}
        rx={solid ? 3.5 : 3}
        fill={solid ? "currentColor" : "none"}
        stroke={solid ? "none" : "currentColor"}
        strokeWidth={1.4}
      />
    </svg>
  );
}

/**
 * The switch, wherever an attachment is about to be sent.
 *
 * A `role="switch"` rather than two buttons: it is one fact about the file the
 * sender has already chosen, and a second send button would make "send" mean
 * different things depending on which one was hit.
 */
export function ViewOnceToggle({
  on,
  onChange,
  className,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={
        on
          ? "Sending as view once — tap to keep it in the chat instead"
          : "Keeping it in the chat — tap to send as view once"
      }
      onClick={() => onChange(!on)}
      className={cn(
        "ws-press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
        on
          ? "bg-spotlight/20 text-create ring-1 ring-create/40"
          : "text-white/60 hover:bg-white/10 hover:text-white",
        className
      )}
    >
      {on ? (
        <>
          <ViewOnceMark className="h-3.5 w-3.5" />
          View once
        </>
      ) : (
        "Keep in chat"
      )}
    </button>
  );
}

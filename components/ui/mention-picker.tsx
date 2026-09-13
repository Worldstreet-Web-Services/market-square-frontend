"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { placeAnchored } from "@/lib/anchored-popover";
import type { FieldRect, MentionTyping } from "@/hooks/use-mention-typing";

/**
 * The candidate list for an @-token — one list for the post composer, the
 * thread's comment box, the card's inline pill and the chat composer. Render
 * it while `typing.token` is open.
 *
 * Lifted from the feed slice (which re-exports it) because the chat composer
 * needs the same list and slices never import each other.
 *
 * ─── IT OPENS ABOVE THE FIELD, THROUGH A PORTAL ─────────────────────────────
 * Every field that takes a mention sits at the foot of something: the pill at
 * the bottom of a post card, the reply box at the bottom of the comments
 * sheet, the composer near the bottom of a phone. A list that dropped down
 * from the field was clipped by the sheet's overflow or pushed off-screen.
 * So it is portalled to the body, fixed in viewport coordinates, and placed
 * ABOVE the field by `placeAnchored` — flipping below only when the field is
 * so near the top that the list would run off the top edge. Same mechanics
 * as the emoji picker (`anchorAbove`) and the profile's more menu.
 *
 * Width: the field's own width where the field is wide (the thread box), and
 * 288 where it is narrow (the card's 220 pill) — never a list narrower than
 * a name and a handle need.
 *
 * Scroll CLOSES it rather than chasing the field — a list drifting away from
 * the caret reads as a fault — and resize re-places it.
 *
 * `onMouseDown` prevents the field losing focus before the click lands,
 * which is what made a pick close the list without inserting.
 */
const MIN_W = 288;
const MAX_H = 256;
const MARGIN = 12;

function place(anchor: FieldRect, viewport: { width: number; height: number }) {
  const width = Math.min(anchor.width >= MIN_W ? anchor.width : MIN_W, viewport.width - MARGIN * 2);
  // Decided against the list's CAP, not its current height, so the side
  // never flips as "Searching…" turns into rows.
  return {
    ...placeAnchored({ trigger: anchor, width, height: MAX_H, viewport, align: "left", margin: MARGIN }),
    width,
  };
}

export function MentionPicker({
  typing,
  className,
  heading = "People and groups",
  emptyLabel = "No matching people or groups.",
}: {
  typing: MentionTyping;
  className?: string;
  /** The list's caption — a chat composer says "Members". */
  heading?: string;
  emptyLabel?: string;
}) {
  const { results, items, anchor } = typing;
  // Resize re-measures the field (an event, so the hook may read its ref);
  // scroll closes — a list drifting away from the caret reads as a fault.
  // Both go through a ref so the subscription is made once, not per keystroke.
  const latest = useRef(typing);
  // Written in an effect, never during render — the rule the compiler enforces.
  useEffect(() => {
    latest.current = typing;
  });
  useEffect(() => {
    const onResize = () => latest.current.remeasure();
    const onScroll = () => latest.current.dismiss();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // Pure: the rect was measured when the token opened, the viewport is read
  // here. The list only exists while a token is open, which is client state
  // set from a keystroke, so `window` is always present.
  const at =
    anchor && typeof window !== "undefined"
      ? place(anchor, { width: window.innerWidth, height: window.innerHeight })
      : null;

  if (!at) return null;

  // A caller that narrows the list locally can have rows before the search
  // answers, so "Searching…" only shows while there is nothing else to show.
  const searching = results.isPending && items.length === 0;
  const empty = !results.isPending && items.length === 0;

  return createPortal(
    <div
      role="listbox"
      aria-label="People to mention"
      style={{
        left: at.left,
        width: at.width,
        ...(at.side === "above" ? { bottom: at.bottom } : { top: at.top }),
      }}
      className={cn(
        "ws-popover ws-popover-enter fixed z-[60] max-h-64 overflow-y-auto overscroll-contain rounded-2xl p-1.5",
        at.side === "above" ? "origin-bottom-left" : "origin-top-left",
        className
      )}
    >
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-meta">
        {heading}
      </p>
      {searching && <p className="px-3 py-3 text-xs text-meta">Searching…</p>}
      {items.map((mention) => (
        <button
          key={`${mention.type}:${mention.id}`}
          type="button"
          role="option"
          aria-selected={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => typing.pick(mention)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/8"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-xs font-bold text-accent">
            {mention.type === "group" ? "GR" : mention.label.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-heading">{mention.label}</span>
            <span className="block truncate text-xs text-meta">
              @{mention.handle} · {mention.type === "group" ? "Group" : "Person"}
            </span>
          </span>
        </button>
      ))}
      {empty && <p className="px-3 py-3 text-xs text-meta">{emptyLabel}</p>}
    </div>,
    document.body
  );
}

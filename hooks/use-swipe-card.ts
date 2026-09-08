"use client";

import { useCallback, useRef, useState } from "react";
import {
  COMMIT_RATIO,
  exitOffset,
  isHorizontalGesture,
  swipeDecision,
  swipeProgress,
  swipeRotation,
  type SwipeDecision,
} from "@/lib/swipe-deck";

/**
 * DRAG A CARD TO DECIDE ABOUT IT — the listeners, not the judgements.
 *
 * Every decision (where the threshold is, when a flick beats distance, what
 * counts as a scroll rather than a swipe) lives in `lib/swipe-deck.ts` where it
 * can be tested without a browser. This is the pointer plumbing and the
 * transform, and it is a hook rather than a component so the card keeps its own
 * markup — the friends deck applies it to the FRONT card of a fan that is
 * otherwise unchanged.
 *
 * ─── IT DOES NOT FIGHT THE PAGE ─────────────────────────────────────────────
 * The pointer is only captured once the gesture is horizontal enough to be a
 * decision. Until then the browser keeps it, so a vertical scroll that happens
 * to start on the card scrolls the timeline. A drag that resolves as vertical
 * is abandoned rather than contested. Pair with `touch-action: pan-y`.
 */
export function useSwipeCard({
  width,
  onDecide,
  disabled = false,
  settleMs = 180,
}: {
  /** The card's own width — the threshold is a fraction of it. */
  width: number;
  onDecide: (decision: Exclude<SwipeDecision, null>) => void;
  disabled?: boolean;
  settleMs?: number;
}) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [committing, setCommitting] = useState<SwipeDecision>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<{ x: number; t: number } | null>(null);
  const claimed = useRef(false);

  const release = useCallback(() => {
    setDx(0);
    setDy(0);
    claimed.current = false;
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled || committing) return;
      start.current = { x: event.clientX, y: event.clientY };
      last.current = { x: event.clientX, t: event.timeStamp };
    },
    [committing, disabled]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const from = start.current;
      if (!from || committing) return;
      const nextDx = event.clientX - from.x;
      const nextDy = event.clientY - from.y;

      if (!claimed.current) {
        if (!isHorizontalGesture(nextDx, nextDy)) {
          // Committed to a vertical direction: this is the page, not the card.
          if (Math.abs(nextDy) > 12) start.current = null;
          return;
        }
        claimed.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }

      last.current = { x: event.clientX, t: event.timeStamp };
      setDx(nextDx);
      setDy(nextDy);
    },
    [committing]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const from = start.current;
      if (!from || committing) return release();
      const prev = last.current;
      const elapsed = Math.max(1, event.timeStamp - (prev?.t ?? event.timeStamp));
      const velocity = (event.clientX - (prev?.x ?? event.clientX)) / elapsed;
      const decision = swipeDecision({ dx, dy, width, velocity });
      if (!decision) return release();

      setCommitting(decision);
      start.current = null;
      claimed.current = false;
      // Let it fly before the deck moves on.
      window.setTimeout(() => {
        setCommitting(null);
        setDx(0);
        setDy(0);
        onDecide(decision);
      }, settleMs);
    },
    [committing, dx, dy, onDecide, release, settleMs, width]
  );

  const offset = committing ? exitOffset(committing, width) : dx;
  const progress = swipeProgress(dx, width);

  return {
    /** Spread onto the draggable element. */
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    /** Prepend to the element's own transform so it moves in screen space. */
    transform: `translateX(${offset}px) rotate(${swipeRotation(offset, width)}deg)`,
    /** True while a finger is actually dragging — kill the transition then. */
    dragging: claimed.current && !committing,
    committing,
    /** -1..1, for the verdict stamps. */
    progress,
    /** 0..1 as the drag approaches the threshold. */
    verdict: Math.min(1, Math.abs(progress) / COMMIT_RATIO),
  };
}

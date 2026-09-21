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
 * ─── THE SWITCH ITSELF LIVES IN THE SEND BAR ─────────────────────────────────
 * `MediaSendBar` owns the control, because a photo and a capture now go out
 * through the same send preview. This module owns the MARK, which both the
 * control and the receiver's bubble draw — so what the sender armed and what
 * lands are visibly the same thing.
 */

/**
 * The mark: a "1" in a ring — filled once it is armed, a dashed outline while
 * the shot would stay in the chat.
 *
 * THE GLYPH IS THE ONE THE COMPOSER SETTLED ON (staging, 2026-09-21), not the
 * square this module first drew. Two designs for one idea is the thing this
 * file exists to prevent, and between a mark the sender has been iterating on
 * and a mark only the bubble used, the sender's wins.
 */
export function ViewOnceMark({
  opened = false,
  className,
}: {
  opened?: boolean;
  className?: string;
}) {
  if (opened) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={cn("h-3.5 w-3.5 shrink-0", className)} fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.3} strokeDasharray="2 2.4" strokeLinecap="round" />
        <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="currentColor">
          1
        </text>
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("h-3.5 w-3.5 shrink-0", className)}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" className="fill-ink">
        1
      </text>
    </svg>
  );
}

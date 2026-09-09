"use client";

import { cn } from "@/lib/cn";

/**
 * THE SWIPE VERDICT STAMPS — nodes 856:23668 (left) and 856:23693 (right),
 * SQUARE 2.0 (Copy).
 *
 * A drag on the front card of `/pals` brightens a stamp over the photograph
 * before it commits: RED FLAG going left, GREEN FLAG going right. It is the
 * Tinder grammar — the decision is announced while the finger is still down,
 * so a swipe can be abandoned by letting go before the threshold rather than
 * being discovered after the card has flown.
 *
 * ─── WHAT THE FILE SAYS, AND THE ONE TRAP IN IT ─────────────────────────────
 * Red Flag  (856:23728): fill `rgba(255, 56, 60, 0.09)`, label `#FF050A` at
 *                       Roboto 400, glyph 856:23730.
 * Green Flag (856:23723): fill `#34C759` SOLID, label `#FFFFFF` at Roboto 700,
 *                       glyph 856:23725.
 *
 * THE RED PILL HAS NO BORDER. Its node carries `strokes: rgba(177,17,47,0)`
 * with a `strokeWeight` of 2.86 — a real weight, and an ALPHA OF ZERO, so it
 * paints nothing. Read as "there is a stroke, therefore draw a border" it
 * becomes a crimson ring the design does not have. This is the same trap the
 * gist room's circular controls carry, wearing the opposite disguise: there
 * the weight was zero and the colour real, here the weight is real and the
 * colour is not. Either way the product is nothing.
 *
 * ─── SCALE, AND WHY THE TWO FRAMES DISAGREE ─────────────────────────────────
 * The two states are drawn at different zooms — the red frame's photo is 671
 * wide, the green frame's 658.76 — so their raw numbers cannot be compared to
 * each other or used directly. Each is normalised through its OWN frame: the
 * card is the photo divided by our card's photo ratio (496.13/543.42), giving
 * 735 for the red frame and 721.5 for the green, and every number below is the
 * file's times 543.42 over that. So both stamps end up in the same units as
 * `DECK_CARD` and scale with the deck's `k` like everything else.
 *
 * Normalised that way the two agree where it matters and the agreement is the
 * evidence the reading is right: red centres at 57.4% of the card's height and
 * green at 58.0%. Drawn at a shared 57.5%.
 *
 * ─── TWO JUDGEMENT CALLS, STATED ────────────────────────────────────────────
 * · BOTH ARE CENTRED HORIZONTALLY. Normalised, the green pill's centre lands
 *   on the card's to within a pixel (270.9 against 271.7) while the red sits
 *   29 to the right of it. One of those is a measurement and the other is a
 *   hand-placed mock; a stamp that jumps sideways depending on which way you
 *   swipe would read as a bug, so both are centred.
 * · TYPE IS GEIST, not the file's Roboto. Two words at a stamp size carry no
 *   information Roboto's metrics own, and the app has one face.
 */

/** The file's own numbers, normalised into `DECK_CARD`'s 543.42 × 718 units. */
const STAMP = {
  /** Both stamps' centre, as a fraction of the card's height. */
  centerY: 0.575,
  red: {
    width: 295.2,
    height: 150.4,
    padLeft: 25.36,
    padRight: 8.45,
    gap: 16.91,
    font: 25.36,
    leading: 33.82,
    glyph: 61.5,
  },
  green: {
    width: 220.9,
    height: 108.7,
    padX: 20.81,
    gap: 12.14,
    font: 20.81,
    leading: 27.74,
    glyph: 48.8,
  },
} as const;

export function SwipeVerdict({
  /** -1..1 from `useSwipeCard`: negative dragging left, positive right. */
  progress,
  /** 0..1 as the drag approaches the commit threshold — this is the brighten. */
  verdict,
  /** The deck's scale, so the stamp rides the card rather than the viewport. */
  k,
  className,
}: {
  progress: number;
  verdict: number;
  k: number;
  className?: string;
}) {
  // Below this the stamp is noise under a finger that has barely moved — a
  // stamp that appears on a 2px twitch reads as the card being jumpy.
  if (Math.abs(progress) < 0.02) return null;
  const right = progress > 0;
  const s = right ? STAMP.green : STAMP.red;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute left-1/2 z-30", className)}
      style={{
        top: `${STAMP.centerY * 100}%`,
        // Centred on both axes about that point, then scaled with the deck.
        transform: `translate(-50%, -50%) scale(${k})`,
        // THE BRIGHTEN. Opacity tracks the drag so the reader sees the verdict
        // firm up as they commit to it, and can back out by easing off.
        opacity: verdict,
        // A touch of growth with it: the stamp arrives rather than blinks.
        // Bounded so it never overshoots the card at the threshold.
        transition: "none",
      }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: right ? STAMP.green.width : STAMP.red.width,
          height: right ? STAMP.green.height : STAMP.red.height,
          // Solid green; the red is a 9% wash of the same red as its label.
          // NO BORDER on either — see the note above.
          background: right ? "#34C759" : "rgba(255, 56, 60, 0.09)",
          paddingLeft: right ? STAMP.green.padX : STAMP.red.padLeft,
          paddingRight: right ? STAMP.green.padX : STAMP.red.padRight,
          gap: right ? STAMP.green.gap : STAMP.red.gap,
          transform: `scale(${0.9 + 0.1 * verdict})`,
        }}
      >
        <span
          style={{
            color: right ? "#FFFFFF" : "#FF050A",
            fontSize: s.font,
            lineHeight: `${s.leading}px`,
            fontWeight: right ? 700 : 400,
            whiteSpace: "nowrap",
          }}
        >
          {right ? "Green Flag" : "Red Flag"}
        </span>
        {/* The file's own glyphs, exported rather than redrawn — they are
            multi-path artwork with their own fills, so they ship as files in
            `public/pals/` exactly as the gift art does. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={right ? "/pals/green-flag.svg" : "/pals/red-flag.svg"}
          alt=""
          style={{ width: s.glyph, height: s.glyph }}
        />
      </div>
    </div>
  );
}

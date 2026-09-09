import { cn } from "@/lib/cn";
import { x, y } from "@/components/layout/welcome/welcome-art";

/**
 * THE GIST CARD — `Group 1000002777`, rebuilt from its parts.
 *
 * ─── WHY THIS IS NOT ONE IMAGE ──────────────────────────────────────────────
 * It was, and it had to stop being one. A flat export cannot animate its own
 * insides, and overlaying the three photos on top of a baked copy of themselves
 * only works while nothing moves — the moment a photo shifts, the version
 * printed into the background slides out from under it.
 *
 * So the card is built the way the file builds it. Its background is the one
 * part that is trivially reproducible: a rounded rectangle with a plain
 * top-to-bottom gradient, plus three translucent bars stacked behind it. Every
 * other part — the photos, their badges, the heading, the chips, the button,
 * the mic — is its own export at its own coordinates, exactly as the rest of
 * the screen's artwork is. Nothing is approximated; the only thing that stopped
 * being a picture is a gradient.
 *
 * ─── THE BARS' CORNERS COME FROM THE RENDER, NOT THE FILE ───────────────────
 * All three report `rectangleCornerRadii: [0, 0, 17.37, 17.37]`, which in
 * Figma's order is square top and rounded bottom. The render shows the
 * opposite, and their bottoms are hidden behind the card where a radius could
 * not be seen anyway. The picture wins.
 *
 * Their alphas are the product of two numbers the file keeps apart: a node
 * opacity and a paint opacity. 0.53x0.18, 0.53x0.33, 0.45x0.33.
 */

/** The file's own coordinates, in the 1440x1024 stage space. */
const CARD = { left: 356, top: 317.02, w: 677.43, h: 288.78, radius: 30.4 };

const BARS = [
  { left: 463.01, top: 257, w: 481.99, h: 78, alpha: 0.53 * 0.18 },
  { left: 415.88, top: 272, w: 575.38, h: 52.11, alpha: 0.53 * 0.33 },
  { left: 392.0, top: 293.71, w: 623.15, h: 52.11, alpha: 0.45 * 0.33 },
];

/** A photo and the badge pinned to its corner, which travel together. */
const PAIRS = [
  {
    photo: { src: "s1-photo-a", left: 448.3, top: 357.2, w: 112.9, h: 122.7 },
    badge: { src: "s1-badge-a", left: 540.6, top: 360.4, w: 22.8, h: 22.8 },
    float: "ws-float-a",
  },
  {
    photo: { src: "s1-photo-b", left: 381.0, top: 450.5, w: 112.9, h: 122.7 },
    badge: { src: "s1-badge-b", left: 377.7, top: 465.7, w: 22.8, h: 22.8 },
    float: "ws-float-b",
  },
  {
    photo: { src: "s1-photo-c", left: 535.1, top: 418.0, w: 112.9, h: 122.7 },
    badge: { src: "s1-badge-c", left: 630.7, top: 508.1, w: 22.8, h: 22.8 },
    float: "ws-float-c",
  },
];

/**
 * The card's right-hand column, which does not move: heading, topic chips and
 * the Join button. Motion here would be motion on READING MATTER, and a line of
 * copy that drifts while you are reading it is an irritation, not a flourish.
 */
const STATIC = [
  { src: "s1-card-mic", left: 657.8, top: 363.7, w: 66, h: 66 },
  { src: "s1-card-head", left: 724.0, top: 376.7, w: 246.6, h: 41 },
  { src: "s1-card-chips", left: 671.9, top: 438.6, w: 307, h: 24.2 },
  { src: "s1-card-join", left: 668.7, top: 500.5, w: 248.6, h: 45.1 },
];

function Part({
  src,
  left,
  top,
  w,
  h,
}: {
  src: string;
  left: number;
  top: number;
  w: number;
  h: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size
    <img
      src={`/onboarding/welcome/${src}.webp`}
      alt=""
      className="absolute"
      style={{ left: x(left), top: y(top), width: x(w), height: y(h) }}
    />
  );
}

export function GistCard() {
  return (
    // The whole card breathes as ONE object. Three photos twitching inside a
    // dead rectangle reads as a broken carousel; a card that is alive and has
    // life inside it reads as a product.
    <div className="ws-float-card absolute inset-0">
      {BARS.map((b) => (
        <div
          key={b.top}
          className="absolute"
          style={{
            left: x(b.left),
            top: y(b.top),
            width: x(b.w),
            height: y(b.h),
            background: `rgba(159, 101, 253, ${b.alpha.toFixed(4)})`,
            borderRadius: "17.37px 17.37px 0 0",
          }}
        />
      ))}

      <div
        className="absolute"
        style={{
          left: x(CARD.left),
          top: y(CARD.top),
          width: x(CARD.w),
          height: y(CARD.h),
          borderRadius: CARD.radius,
          background: "linear-gradient(180deg, #FFFFFF 0%, #D0B3FF 100%)",
        }}
      />

      {PAIRS.map((p) => (
        /*
          Photo and badge share a wrapper so the badge stays pinned to the
          corner it belongs to. Regrouping them is safe: neither badge overlaps
          a photo other than its own, so the file's paint order is preserved.

          `absolute inset-0` is LOAD-BEARING, not tidiness. The moment this
          wrapper animates it carries a transform, and a transformed element
          becomes the containing block for its absolutely positioned children —
          so as a bare `<div>` it collapsed to zero height and every percentage
          `top` and `height` inside it resolved against nothing. The photos
          vanished, and only while the animation was running: under
          `prefers-reduced-motion` there was no transform, no containing block,
          and they rendered correctly. Giving it the same box as its parent
          makes the percentages mean the same thing either way.
        */
        <div key={p.photo.src} className={cn("absolute inset-0", p.float)}>
          <Part {...p.photo} />
          <Part {...p.badge} />
        </div>
      ))}

      {STATIC.map((s) => (
        <Part key={s.src} {...s} />
      ))}
    </div>
  );
}

/**
 * `Frame 2147230497` — the LIVE ON pill, and the frontmost thing on the screen.
 *
 * It is the one element that is claiming something is HAPPENING, so it is the
 * one that gets a heartbeat: a soft purple bloom behind it on a 2.2s beat,
 * which is the cadence a broadcast indicator uses, over a slower 5.4s drift so
 * it never sits perfectly still. The bloom is a separate blurred layer rather
 * than a box-shadow on the pill, because animating a shadow's spread repaints
 * every frame while a blurred div only composites.
 */
export function LiveOnPill() {
  const p = { left: 922, top: 551, w: 195.5, h: 100 };
  return (
    <div
      className="ws-live-pill absolute"
      style={{ left: x(p.left), top: y(p.top), width: x(p.w), height: y(p.h) }}
    >
      <div aria-hidden className="ws-live-bloom" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size */}
      <img
        src="/onboarding/welcome/s1-live-on.webp"
        alt=""
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

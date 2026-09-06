import { useId } from "react";

import { cn } from "@/lib/cn";

/**
 * THE SQUARE MARK — `Group 48098404`, drawn from the file's own `fillGeometry`.
 *
 * Four surfaces draw this: the boot splash, the three welcome screens' header
 * lockup, the fourth welcome screen's big centred mark, and the sign-in card.
 * They are all the SAME artwork at different sizes and, on the splash, in an
 * inverted palette — so it is one component with a palette, not four copies
 * that drift.
 *
 * ─── WHY IT IS NOT AN <img> ─────────────────────────────────────────────────
 * `public/onboarding/logo-3d.png` is the same mark as a bitmap. It is not used
 * here because the splash SCALES this 3.3x and the welcome screens draw it at
 * four different sizes; a raster would be soft at every one of them. Vector is
 * also smaller than the PNG it replaces.
 *
 * ─── THINGS THE FILE SAYS THAT ARE NOT TRUE OF THE PICTURE ──────────────────
 * · `Union` is a BOOLEAN_OPERATION and the three ellipses beneath it are its
 *   OPERANDS. Figma paints the merged silhouette in the PARENT's fill and never
 *   a child's, so those ellipses' `#D9D9D9` appears nowhere on screen — the
 *   dots are `ink`. Reading them as layers gives a bar with grey dots on it.
 * · The mirror is applied TWICE — on the group and again on `Vector 430` and
 *   `Vector 431` — so those two compose to the identity and sit where their
 *   local paths already are. Applying only the group's flips the whole mark.
 *   `Union` is the one child without its own flip, so it alone inherits the
 *   group's; its matrix below is the composition, and the 4 degrees in it are
 *   what tilt the three dots into their slight rise.
 * · `Vector 431` carries a black stroke at `strokeWeight: 0`, which paints
 *   nothing.
 */
export interface SquareMarkPalette {
  /** Card gradient: the lit face, then the shadowed one. */
  cardA: string;
  cardB: string;
  /** Bubble gradient. Both stops sit outside the shape, so it renders flat. */
  bubbleA: string;
  bubbleB: string;
  /** The three dots. */
  ink: string;
}

/** The mark as it appears everywhere except mid-splash: purple on a dark ground. */
export const SQUARE_MARK_BRAND: SquareMarkPalette = {
  cardA: "#7E3BEB",
  cardB: "#472185",
  bubbleA: "#999999",
  bubbleB: "#FFFFFF",
  ink: "#7E3BEB",
};

/** 176.03 x 131 — the mark is NOT square, so callers size it by width alone. */
export const SQUARE_MARK_RATIO = 176.03 / 131;

const CARD =
  "M99.4686 0.101419L5.15303 11.6503C2.21103 12.0105 0 14.5088 0 17.4728L0 125.134C0 128.374 2.62629 131 5.86599 131L102.344 131L170.165 131C173.405 131 176.031 128.374 176.031 125.134L176.031 17.2726C176.031 14.3954 173.944 11.9428 171.104 11.4823L101.121 0.13357C100.574 0.0449692 100.018 0.0341451 99.4686 0.101419Z";
const BUBBLE =
  "M0 86.0572L0 15.4578C0 12.4802 2.23081 9.97498 5.18847 9.63106L81.4721 0.760874C84.9568 0.355677 88.0156 3.07943 88.0156 6.58761L88.0156 96.1057C88.0156 101.054 82.2651 103.779 78.4351 100.646L67.201 91.4542C66.1042 90.5569 64.7197 90.0869 63.3032 90.1311L6.04921 91.9203C2.73933 92.0238 0 89.3687 0 86.0572Z";
const DOTS =
  "M38.8896 0.00390625C42.281 0.00390625 45.0303 2.75316 45.0303 6.14453C45.0303 9.5359 42.281 12.2852 38.8896 12.2852C35.4985 12.2849 32.75 9.53574 32.75 6.14453C32.75 2.75333 35.4985 0.00416961 38.8896 0.00390625ZM6.14062 0.00292969C9.53192 0.00292969 12.2811 2.75229 12.2812 6.14355C12.2812 9.53493 9.532 12.2842 6.14062 12.2842C2.74928 12.2842 0 9.53491 0 6.14355C0.000126711 2.75231 2.74935 0.00295719 6.14062 0.00292969ZM22.5156 0C25.9069 0 28.6561 2.74936 28.6562 6.14062C28.6562 9.532 25.907 12.2812 22.5156 12.2812C19.1243 12.2812 16.375 9.53197 16.375 6.14062C16.3751 2.74939 19.1244 0 22.5156 0Z";

export function SquareMark({
  width,
  palette = SQUARE_MARK_BRAND,
  className,
}: {
  /** Width in px. Height follows from `SQUARE_MARK_RATIO`. */
  width: number;
  palette?: SquareMarkPalette;
  className?: string;
}) {
  // Two marks on one page would otherwise share gradient ids, and the second
  // would silently take the first's colours.
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      width={width}
      height={width / SQUARE_MARK_RATIO}
      viewBox="0 0 176.03 131"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        {/* The file's handle positions verbatim. They are normalised to each
            shape's own box, which is exactly SVG's default objectBoundingBox
            space, so they transfer without conversion. */}
        <linearGradient id={`${uid}-card`} x1="0.5233" y1="0.75" x2="1.0814" y2="0.75">
          <stop offset="0" stopColor={palette.cardA} />
          <stop offset="0.171" stopColor={palette.cardB} />
        </linearGradient>
        {/* This one runs right-to-left and starts past the shape's right edge
            (x = 1.4419), so the whole bubble sits beyond its end stop and
            renders flat. Kept as the file states it rather than collapsed to a
            solid: it is one edit away from being a visible ramp again. */}
        <linearGradient id={`${uid}-bubble`} x1="1.4419" y1="0.4906" x2="1" y2="0.5">
          <stop offset="0" stopColor={palette.bubbleA} />
          <stop offset="1" stopColor={palette.bubbleB} />
        </linearGradient>
      </defs>
      {/* Vector 430 — the card. Net transform is the identity; see above. */}
      <path d={CARD} fill={`url(#${uid}-card)`} />
      {/* Vector 431 — the bubble, at the file's 10.24 / 16.38 offset. */}
      <path d={BUBBLE} transform="translate(10.23563 16.37719)" fill={`url(#${uid}-bubble)`} />
      {/* Union — three r=6.14 circles at x = 6.14, 22.52, 38.89, merged and
          painted ONCE in the parent's fill. */}
      <path
        d={DOTS}
        transform="matrix(-0.99756 0.06976 0.06976 0.99756 69.16686 57.31153)"
        fill={palette.ink}
      />
    </svg>
  );
}

/**
 * The mark beside the word — `Group 1000002773`, the header of every welcome
 * screen and of the sign-in card.
 *
 * The file draws the type as ` Square` in Geist 900 at 38.84/103.1 of the
 * mark's width, with a LEADING SPACE doing the work of the gap between them.
 * That space is a text-editor artefact, not a measurement, so the gap is a real
 * one here (0.1 of the mark, which is what the space rendered as) and the
 * string is the word alone — a leading space in a heading is read aloud by some
 * screen readers and is invisible to everyone else.
 *
 * Both halves are driven by ONE custom property, `--lockup-mark`, so a caller
 * resizes the lockup responsively with a single class
 * (`[--lockup-mark:72px] lg:[--lockup-mark:103.1px]`) and the type, the gap and
 * the mark stay in proportion. Sizing them separately is how a lockup ends up
 * with the right mark beside the wrong type at one breakpoint.
 */
export function SquareLockup({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[calc(var(--lockup-mark)*0.1)]",
        className
      )}
    >
      <span className="block" style={{ width: "var(--lockup-mark)" }}>
        <SquareMark width={103.1} className="h-auto w-full" />
      </span>
      <span
        className="font-black leading-none text-white"
        style={{
          // 38.84 at a 103.1 mark, kept as a ratio so the lockup scales as one
          // thing from a single custom property.
          fontSize: "calc(var(--lockup-mark) * 0.3767)",
          // The word is NOT centred on the mark. The file sets its baseline 5px
          // below where `items-center` puts it at a 103.1 mark — measured, by
          // diffing the two renders: the mark and the bubble land pixel-identical
          // and the type alone comes out 5px high. Expressed as a ratio of the
          // mark so it survives the lockup's other sizes.
          transform: "translateY(calc(var(--lockup-mark) * 0.0485))",
        }}
      >
        Square
      </span>
    </span>
  );
}

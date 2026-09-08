import { cn } from "@/lib/cn";
import { bandCapWidth, welcomeAir } from "@/lib/welcome-fit";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * THE WELCOME SCREENS' ARTWORK — Desktop 35, 33, 36 and 34.
 *
 * ─── WHAT IS AN ASSET AND WHAT IS CODE ──────────────────────────────────────
 * One rule, applied everywhere: PHOTOGRAPHIC and MOCK-UI content is an exported
 * asset; GEOMETRY is code.
 *
 * So the people, the tilted photo tiles with their gradient rims, the "Join the
 * Gist Space" card, the dotted world map, the "Hi" bubble and the round icon
 * badges are all `.webp` cut from the file — they are pictures, and a picture
 * rebuilt in markup is a worse picture. The concentric wash, the four-point
 * sparkles, the stage itself and every piece of chrome (type, buttons, dots,
 * lockup) are drawn here, because those must scale, recolour and reflow.
 *
 * The exports are the file's own AABBs with each node's ROTATION AND OPACITY
 * ALREADY BAKED IN — a Figma node export renders the node as it appears. So
 * every piece below is placed with a plain top/left/width and no `rotate` and
 * no `opacity`: adding either would apply it twice.
 *
 * 580KB for all four screens, and only the screen you are looking at is
 * mounted, so a reader who taps Skip on the first one never fetches the rest.
 *
 * ─── HOW IT STAYS EXACT AND STILL RESPONDS ──────────────────────────────────
 * The artwork lives on a 1440x1024 STAGE that keeps that exact aspect ratio and
 * COVERS the viewport — the `background-size: cover` behaviour, done with
 * `aspect-ratio` plus a `min-width` driven by viewport height. Every piece is
 * then placed in PERCENT of that stage, straight from the file's coordinates.
 *
 * That buys two things at once. At the design's own 1440x1024 the composition
 * is exact to the pixel. At any other size it scales as one picture rather than
 * distorting, and the overflow is cropped from the edges inward — which is the
 * right thing to lose, because every one of these four screens puts its subject
 * in the middle and its scatter at the rim.
 *
 * The stage is `aria-hidden` and `pointer-events-none` throughout: it is
 * decoration sitting under real content, and it must never take a tap meant for
 * the button on top of it.
 */
export const DESIGN_W = 1440;
export const DESIGN_H = 1024;
const W = DESIGN_W;
const H = DESIGN_H;

export const x = (v: number) => `${(v / W) * 100}%`;
export const y = (v: number) => `${(v / H) * 100}%`;

export interface ArtPiece {
  /** File name under `/onboarding/welcome`, without extension. */
  src: string;
  /** The file's own AABB, top-left and width. Height comes from the asset. */
  left: number;
  top: number;
  width: number;
  /** An animation class from globals.css — see the motion note there. */
  motion?: string;
  /** For `ws-pop`: [duration s, delay s, peak scale]. */
  pop?: [number, number, number];
  /** For `ws-drift`: [dx %, dy %, duration s, delay s] — see globals.css. */
  drift?: [number, number, number, number];
}

/**
 * A four-point sparkle — `Star 1` through `Star 5`, one shape at two sizes.
 *
 * Placed by CENTRE, not by corner, and at 33/38 of its box. Figma reports a
 * STAR's box (17 or 38) while its `fillGeometry` — and therefore the exported
 * SVG — is the glyph's tight bounds, which sit INSIDE that box: measuring the
 * render gives a 32px glyph in a 38 box and 15 in a 17. Drawing the SVG at the
 * box size makes every sparkle ~15% too big.
 *
 * The rotated one is worse than that. `Star 2` on screen 1 is a 38 box turned
 * -17.04 degrees, which Figma reports as a 47.47 absoluteBoundingBox — that
 * number is the ROTATED BOX's extent, not the star. Drawing the SVG at 47.47
 * and unrotated put a sparkle on screen half again too large and at the wrong
 * angle. Centre + size + rotation is the only description that survives.
 */
const STAR_GLYPH = 33 / 38;

export interface Sparkle {
  /** Centre of the star's own box, in design coordinates. */
  cx: number;
  cy: number;
  /** The box Figma reports in `size` — 17 or 38 — NOT the rotated AABB. */
  size: number;
  rotate?: number;
}

export function WelcomeStage({
  pieces,
  sparkles = [],
  children,
}: {
  pieces: ArtPiece[];
  sparkles?: Sparkle[];
  /** Rendered in the stage's own 1440x1024 space, over the flat pieces. */
  children?: React.ReactNode;
}) {
    return (
    /*
      NOT `overflow-hidden`. Clipping here cuts the artwork at the FRAME's edge,
      and the frame is contain-fitted — so on any window wider than 1.41:1 the
      outermost cards ended in a hard vertical line with dead ground beyond it.
      The file runs those cards off the edge on purpose (the left one starts at
      x=-104), so letting them overflow lets them reach the real screen edge and
      fill that ground. The screen wrapper clips instead.
    */
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="ws-welcome-stage">
        {pieces.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size
          <img
            key={p.src + p.left}
            src={`/onboarding/welcome/${p.src}.webp`}
            alt=""
            className={cn("absolute", p.motion)}
            style={{
              left: x(p.left),
              top: y(p.top),
              width: x(p.width),
              ...(p.pop && {
                animationDuration: `${p.pop[0]}s`,
                animationDelay: `${p.pop[1]}s`,
                "--ws-pop": p.pop[2],
              }),
              ...(p.drift && {
                "--ws-dx": `${p.drift[0]}%`,
                "--ws-dy": `${p.drift[1]}%`,
                animationDuration: `${p.drift[2]}s`,
                animationDelay: `${p.drift[3]}s`,
              }),
            } as React.CSSProperties}
          />
        ))}
        {sparkles.map((s, i) => {
          const g = s.size * STAR_GLYPH;
          return (
            // eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size
            <img
              key={`star-${s.cx}-${s.cy}`}
              src="/onboarding/welcome/star.svg"
              alt=""
              className="ws-twinkle absolute"
              style={{
                left: x(s.cx - g / 2),
                top: y(s.cy - g / 2),
                width: x(g),
                // The file's own rotation, kept as an INDIVIDUAL property so the
                // twinkle keyframe (opacity + scale) cannot clobber it.
                rotate: s.rotate ? `${s.rotate}deg` : undefined,
                // Every sparkle on its own clock. A negative delay starts it
                // mid-cycle, so they are already out of step on the first frame
                // rather than blinking in unison and then drifting apart.
                animationDuration: `${2.9 + i * 0.7}s`,
                animationDelay: `${-1.3 * i - 0.4}s`,
              }}
            />
          );
        })}
        {children}
      </div>
    </div>
  );
}

/**
 * The concentric wash, on its OWN full-bleed layer rather than on the stage.
 *
 * The stage is contain-fitted (see `WelcomeFrame`), so on a window wider than
 * 1.406:1 it stops short of the left and right edges. Everything on it should:
 * it is a composition, and a composition has edges. The wash should not — it is
 * ground, and ground that stops two hundred pixels from the edge reads as a
 * letterboxed picture rather than a page. So it is sized off the VIEWPORT and
 * always covers, while the artwork scales with the design.
 *
 * It carries its own 30% group opacity and 14% per-ring alpha, already baked in.
 */
export function WelcomeWash() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size
    <img
      aria-hidden
      src="/onboarding/rings.svg"
      alt=""
      className="pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      style={{ width: "max(127.5vw, 127.5vh)" }}
    />
  );
}

/**
 * THE DESIGN FRAME — the file's 1440x1024, scaled to fit as one picture.
 *
 * ─── THE BUG THIS FIXES ─────────────────────────────────────────────────────
 * The artwork and the copy were laid out independently: the artwork on a stage
 * that covered the viewport, the copy in a normal bottom-anchored flow. At the
 * design's own size those agree exactly, and they survive a NARROW screen
 * fine. They do not survive a SHORT one. At 1280x700 — an ordinary laptop
 * window — the stage is width-driven and 910 tall, so the "Join the Gist Space"
 * card lands 514px down while the headline starts at 473, and the two print on
 * top of each other.
 *
 * That is not a tuning problem. The copy block is 387px tall whatever the
 * window does — 37.8% of 1024, exactly the proportion the file gives it, but
 * 55% of 700. Two independently-positioned layers can only agree at one height,
 * and the file says which: 1024.
 *
 * ─── SO: ONE PICTURE, OR A REFLOW, DECIDED BY ASPECT ────────────────────────
 * When the window is at least as wide-to-tall as the design (1440/1024, about
 * 1.41:1), HEIGHT is the scarce dimension and the whole screen — artwork and
 * copy together — is laid out at 1440x1024 and scaled by
 * `min(vw/1440, vh/1024)`. Contain, not cover: cover on a short window
 * reintroduces the very overflow being fixed. Every proportion in the file then
 * holds at every size, with no second layout to keep in step.
 *
 * When the window is TALLER than that — a phone, a tablet held upright — there
 * is vertical room to spare and the reflowed layout is the better answer, so
 * nothing is scaled and the copy keeps readable sizes. Scaling a 1440-wide
 * design onto a 390-wide screen would set the body copy at 4px.
 *
 * The threshold is the design's own aspect ratio rather than a width
 * breakpoint, because the failure was never about width: a 1000x627 window is
 * "small" but needs the frame, and a 768x1024 tablet is narrower still and does
 * not.
 *
 * Measured in a LAYOUT effect, which runs before paint, so the corrected size
 * is the first thing drawn rather than a jump on the following frame.
 *
 * ─── AND WHY THE SCREEN USES CONTAINER QUERIES ──────────────────────────────
 * Both branches are `@container`, and everything inside sizes off THAT rather
 * than off the viewport. It has to: inside the frame the box is 1440 wide no
 * matter how small the window is, so a viewport-based `lg:` would hand a
 * 1440-wide layout the phone's type scale — 32px headlines and a 72px lockup
 * inside a frame built for 49px and 103px. The container is the thing the
 * layout actually lives in, so the container is what it should measure.
 */
const DESIGN_ASPECT = DESIGN_W / DESIGN_H;

/**
 * THE REFLOWED COLUMN'S FIT PASS — what makes the phone screens FIT.
 *
 * ─── THE PROBLEM ────────────────────────────────────────────────────────────
 * The reflowed column is: wordmark, a fixed art band, stepper, headline, copy,
 * a spring, then Continue and Skip. Everything except the band and the spring
 * is fixed, and together they come to about 506px. The band asks for 191 more.
 * On a phone showing the browser's own chrome — 375x553, 390x664, 360x620, all
 * of them ordinary — that overflows, and what falls off the bottom is Skip.
 * Measured before this existed: 143px over at 375x553, 85 at 390x664, 69 at
 * 360x620, on all three carousel screens.
 *
 * `min-h-dvh` cannot fix this. It says "at least the viewport" and then lets
 * the content push past it, which is precisely what was happening.
 *
 * ─── WHAT THIS PUBLISHES, AND WHY IT IS TWO THINGS ──────────────────────────
 * · `--ws-air` — a 0.55..1 factor on every GAP in the column (its two
 *   paddings, the space above the picture, under the stepper and above the
 *   buttons). 1 at 844 and above, which is the phone the design was tuned for,
 *   so nothing that fits today moves by a pixel. It is computed here rather
 *   than in CSS because CSS cannot divide a length by a length to get the bare
 *   number `calc()` needs to multiply a px value by.
 *
 * · `--ws-band-cap` — the room GENUINELY left for the art band once that
 *   trimmed column is laid out, converted back into the stage width that would
 *   fill it. The stylesheet takes the smaller of it and the design's 130vw, so
 *   it only ever bites on a screen that could not have fitted anyway.
 *
 * THE ART IS NOT FITTED TO THE VIEWPORT, and that distinction is the whole
 * reason this measures the COLUMN instead. Screen two's fan of pals is drawn
 * 188% of the stage wide because the file runs those cards off both edges on
 * purpose; measuring the picture and shrinking until it fitted turned that
 * deliberate bleed into a row of thumbnails once before. What is measured here
 * is the space the TEXT needs — the picture then gets what is left, and is
 * still free to bleed off both edges inside it.
 *
 * ─── WHY :root AND NOT THE FRAME ────────────────────────────────────────────
 * The stylesheet derives `--ws-stage-w`, `--ws-stage-h`, `--ws-art-band-h` and
 * `--ws-art-band-top` from these two on `:root`. A custom property is resolved
 * where it is USED, so a value set on the frame — a descendant — would be
 * invisible to that computation and every derived var would silently fall back.
 * Nothing else in the app declares either name, so there is no shadowing here;
 * they are cleared on unmount so they cannot outlive the overlay.
 *
 * A ResizeObserver rather than a `resize` listener, because the column's height
 * also changes when the STEP does — a two-line headline and a three-line one
 * are 44px apart — and a step change fires no window event.
 */
function fitReflowedColumn(root: HTMLElement) {
  const air = welcomeAir(window.innerHeight);
  const style = document.documentElement.style;
  // Set FIRST, then measure: the paddings and margins below are multiplied by
  // it, and reading a rect after a style write forces the layout that applies
  // it. Measuring before would size the band against gaps about to change.
  style.setProperty("--ws-air", String(air));

  const col = root.querySelector<HTMLElement>(".ws-welcome-bottom");
  // The finale (Desktop 34) has no column and no band — it must not inherit a
  // cap measured from the screen before it.
  if (!col) {
    style.removeProperty("--ws-band-cap");
    return;
  }

  const cs = getComputedStyle(col);
  let room =
    col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

  for (const el of Array.from(col.children) as HTMLElement[]) {
    const k = getComputedStyle(el);
    const margins = (parseFloat(k.marginTop) || 0) + (parseFloat(k.marginBottom) || 0);
    // The band is what is being solved for, so only its margin is spent here.
    if (el.classList.contains("ws-welcome-art-gap")) {
      room -= margins;
      continue;
    }
    // The spring is the give that already collapsed to nothing.
    if (el.classList.contains("ws-welcome-spring")) continue;
    room -= el.getBoundingClientRect().height + margins;
  }

  style.setProperty("--ws-band-cap", `${bandCapWidth(room)}px`);
}

export function WelcomeFrame({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<number | null>(null);

  /*
    A CALLBACK REF, for the same reason the friends deck uses one: the reflow
    branch is not always what renders, so an effect keyed on anything but the
    node itself can run against nothing and never fire again when the node
    arrives.
  */
  const root = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const fitRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      document.documentElement.style.removeProperty("--ws-air");
      document.documentElement.style.removeProperty("--ws-band-cap");
      return;
    }
    if (typeof ResizeObserver === "undefined") return;
    const run = () => fitReflowedColumn(el);
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const col = el.querySelector(".ws-welcome-bottom");
    if (col) ro.observe(col);
    observer.current = ro;
    root.current = el;
  }, []);

  /*
    AND AFTER EVERY RENDER, because a step change is not a resize.

    The observer is bound to the nodes present when the ref fired. Continuing
    from the last carousel screen to the finale swaps the whole branch — the
    column with the art band disappears — and nothing about that changes the
    frame's size, so no ResizeObserver entry is delivered. Without this the
    finale inherited the previous screen's `--ws-band-cap` and positioned its
    artwork against a band that is no longer on the page.
  */
  useLayoutEffect(() => {
    if (root.current) fitReflowedColumn(root.current);
  });

  useLayoutEffect(() => {
    const measure = () => {
      const { innerWidth: w, innerHeight: h } = window;
      setScale(
        w / h >= DESIGN_ASPECT ? Math.min(w / DESIGN_W, h / DESIGN_H) : null
      );
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  // Also the server render. That is deliberate: the reflow layout is the one
  // that is correct at ANY size, so the frame before measurement is never
  // broken — only unscaled.
  if (scale === null) {
    /*
      `h-dvh`, not `min-h-dvh`, and `min-h-0` on the column inside it: the fit
      pass below needs a DEFINITE height to subtract from, and a flex item's
      `min-height: auto` would otherwise let the column grow to its content and
      report the room it wants rather than the room it has. Overflow past this
      is not clipped — the gate around it scrolls — so an extreme viewport
      degrades to the behaviour it had before rather than losing a button.
    */
    return (
      <div ref={fitRef} className="@container relative flex h-dvh w-full flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        data-fit="frame"
        className="ws-welcome-frame @container relative flex shrink-0 flex-col"
        style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── The four screens' pieces, in the file's own back-to-front order ────────
   Figma lists children back-first, so this order IS the z-order: on screen 2
   Diva's card is last and therefore overlaps Crón's, which is what the render
   shows. Reversing it would put the wrong card on top at every overlap. */

/**
 * Screen 1's flat pieces. The gist card is NOT here — it is built out of its
 * real parts in `gist-card.tsx` so they can move independently; see the note
 * there for why a single flat export could not be animated.
 */
export const ART_GIST_ROOMS: ArtPiece[] = [
  { src: "badge-chat-lg", left: 189.6, top: 420.6, width: 103.1, motion: "ws-orbit-a" },
  { src: "badge-mic-md", left: 1038, top: 206, width: 75.3, motion: "ws-orbit-b" },
];
export const SPARKLES_GIST_ROOMS: Sparkle[] = [
  // `Star 2` — a 38 box at -17.04deg, whose rotated AABB Figma reports as 47.47.
  { cx: 378.03, cy: 218.03, size: 38, rotate: -17.04 },
  { cx: 1118.5, cy: 399.5, size: 17 },
  { cx: 288.5, cy: 682.5, size: 17 },
];

/**
 * Screen 2's flat pieces. The five people cards are NOT here — they circulate,
 * and live in `pals-arc.tsx`.
 *
 * The reactions each carry their own pop period. They are deliberately not
 * multiples of one another, so the five never swell together; `--ws-pop` scales
 * the swell down for the two large ones, because the same 14% on a 160px emoji
 * is a lurch while on a 68px badge it is a blink.
 */
export const ART_REAL_PALS: ArtPiece[] = [
  { src: "world-map", left: 149, top: 71, width: 1058.5 },
  { src: "badge-profile-add-lg", left: 207, top: 304, width: 83, motion: "ws-pop", pop: [5.3, -0.6, 1.16] },
  { src: "s2-hi", left: 92, top: 157, width: 130, motion: "ws-pop", pop: [7.1, -2.4, 1.08] },
  { src: "s2-wink", left: 1156, top: 160, width: 159.7, motion: "ws-pop", pop: [8.3, -5.1, 1.07] },
  { src: "badge-love-lg", left: 168.7, top: 795.7, width: 84.1, motion: "ws-pop", pop: [6.2, -3.7, 1.16] },
  { src: "badge-thumbs-md", left: 1072, top: 838, width: 68, motion: "ws-pop", pop: [4.7, -1.9, 1.18] },
];
export const SPARKLES_REAL_PALS: Sparkle[] = [
  { cx: 1161.5, cy: 768.5, size: 17 },
  { cx: 288.5, cy: 682.5, size: 17 },
];

/**
 * Screen 3's flat pieces. The five tiles are NOT here — they orbit, and live in
 * `communities.tsx`.
 */
export const ART_COMMUNITIES: ArtPiece[] = [
  { src: "badge-map-lg", left: 1093, top: 358, width: 88, motion: "ws-pop", pop: [6.7, -2.2, 1.14] },
  { src: "badge-thumbs-lg", left: 230, top: 401, width: 71.2, motion: "ws-pop", pop: [5.9, -4.6, 1.16] },
];
export const SPARKLES_COMMUNITIES: Sparkle[] = [
  { cx: 1227, cy: 686, size: 38 },
  { cx: 386, cy: 186, size: 38 },
  { cx: 235.5, cy: 744.5, size: 17 },
  { cx: 1051.5, cy: 166.5, size: 17 },
];

/**
 * Screen 4's pieces. The six tiles ease out and back along their own radius
 * from the arrangement's centre — (712.2, 532.0), the mean of the six — and the
 * five badges pop, the same vocabulary screens 2 and 3 use for reactions.
 *
 * Six periods, five pop periods, none shared and none a multiple of another.
 */
export const ART_WELCOME: ArtPiece[] = [
  { src: "s4-tile-a", left: 298.1, top: 162, width: 219.4, motion: "ws-drift", drift: [-2.409, -2.17, 12.5, -3.1] },
  { src: "s4-tile-b", left: 1044.3, top: 467.5, width: 128.6, motion: "ws-drift", drift: [5.443, -0.008, 9.5, -7.8] },
  { src: "s4-tile-c", left: 261, top: 465.9, width: 134.5, motion: "ws-drift", drift: [-5.204, -0.02, 14, -1.4] },
  { src: "s4-tile-d", left: 979.1, top: 682, width: 199.9, motion: "ws-drift", drift: [2.899, 1.989, 10.5, -9.2] },
  { src: "s4-tile-e", left: 306, top: 711.2, width: 143.7, motion: "ws-drift", drift: [-3.906, 2.986, 13, -5.6] },
  { src: "s4-tile-f", left: 875, top: 208, width: 192.9, motion: "ws-drift", drift: [2.706, -2.522, 11, -11.7] },
  { src: "badge-mic-sm", left: 1214, top: 260, width: 60.8, motion: "ws-pop", pop: [6.1, -1.3, 1.18] },
  { src: "badge-map-sm", left: 1235, top: 736, width: 60.8, motion: "ws-pop", pop: [7.3, -5.2, 1.18] },
  { src: "badge-chat-sm", left: 699, top: 91, width: 72, motion: "ws-pop", pop: [5.4, -3.9, 1.16] },
  { src: "badge-nav-sm", left: 121, top: 730, width: 72, motion: "ws-pop", pop: [8.2, -6.7, 1.16] },
  { src: "badge-love-sm", left: 131, top: 329, width: 58.9, motion: "ws-pop", pop: [4.9, -2.5, 1.18] },
];

/**
 * Warm the NEXT screen's pictures while the reader is still on this one.
 *
 * Mounting one screen at a time is what keeps the first paint cheap, but it
 * also means Continue would otherwise be followed by a screen assembling itself
 * from blank rectangles. Decoding ahead costs nothing visible and removes that
 * entirely. It is best-effort: no state, no error path, and a browser that
 * ignores it simply loads on arrival as before.
 */
export function prefetchArt(pieces: ArtPiece[]) {
  if (typeof window === "undefined") return;
  for (const p of pieces) {
    const img = new window.Image();
    img.src = `/onboarding/welcome/${p.src}.webp`;
  }
}

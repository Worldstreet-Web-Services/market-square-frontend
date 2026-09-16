"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DeckDots } from "@/components/ui/deck-dots";
import { asset } from "@/lib/square-path";

/**
 * HOME'S BANNER — three slides, nodes 1676:17254, 1682:17344 and 1683:17370
 * (2026-09-16). They replace the single "Create your Gistroom now" card.
 *
 * ─── THE FILE'S NUMBERS, READ FROM THE RAW NODES ────────────────────────────
 * Each slide is a 342 x 98 column: the card (342 x 86, radius 15, clipped),
 * then 8, then the pager row (4 tall). Every position below is the child's
 * `absoluteBoundingBox` minus the card's origin.
 *
 *   · house (1676:17255): the ramp `#AD46FF` → `#682A99` with the same handles
 *     as the old banner — the width handle sits straight below the start, so
 *     the bands are vertical and it runs 90deg, -16.5% to 82%. Two soft-light
 *     arcs (Vector 449 at (-47, -65), Vector 448 at (11, 12), RIGHT-anchored),
 *     a 83 x 4 black/25 shadow at (241, 82) under a 4 layer blur (CSS takes
 *     half), the copy at (16, 16) in a 194 x 54 box, and the chat cube
 *     (Group 48098403) at (238, 2), 110.79 x 81.57, CENTER-anchored and cut by
 *     the card's right edge exactly as the frame clips it.
 *   · gistrooms (1683:17477): two fills — the same ramp UNDER a solid
 *     `#F84538`. The last visible fill paints on top, so the card is solid red.
 *     Arcs at (-25, -29) and (59, 0) at 65%, the copy at (16, 21) in 204 x 44,
 *     the faces (Group 1000002879) RIGHT-anchored at (217, 10), 114.58 x 68.96.
 *   · explore (1683:17468, the complete version from file VRZ9LeofsP5lmWPT7kMV4b):
 *     the ramp under a solid `#0DCF51`, so green. One arc at (107, -56), the
 *     copy at (16, 28) in 210 x 40 at Geist 700 14/20, the clouds (Group
 *     1000002912, three white ellipses at 25% soft-light) at (12, 62), the
 *     torn paper (Layer 2) at (-43, -78), and the people with the mic
 *     (Frame 1000002913, 108 x 86, clipped) against the right edge. The file's
 *     two hidden layers (image 94 and its vectorised copy, Asset 40) are not
 *     drawn.
 *
 * The arcs and clouds are the file's SVG exports, which carry their own
 * `opacity` and `mix-blend-mode`. A blend inside an `<img>` blends against
 * nothing, so the element carries `mix-blend-soft-light` too. The cube is an
 * SVG export; the faces are a 4x PNG export, since they are photographs.
 *
 * ─── TYPE ────────────────────────────────────────────────────────────────────
 * The house copy is ONE text node, Geist 500 14/18.2, with overrides: "house"
 * is Inter ExtraBold Italic 800 and "people" / "community" Inter Bold Italic
 * 700 (`styleOverrideTable` 1488 / 1487). Inter is loaded for exactly those
 * runs rather than faking an italic out of Geist. The other two are Geist 700
 * 14/22 (explore 14/20). Every line break is the render's own: the gistroom copy carries a
 * `\n`, and the other two wrap in their fixed boxes — pinned with `<br />`
 * so a font-metric difference cannot rewrap them.
 *
 * ─── WIDER THAN 342 ──────────────────────────────────────────────────────────
 * The file draws only the 342 artboard. Wider columns follow each layer's own
 * `constraints`, never a scale: the card stretches, height stays 86, LEFT
 * layers keep their left offset, RIGHT layers their right offset and the
 * CENTER-anchored cube its offset from the middle. That is Figma's own resize
 * rule for these nodes, so the composition is drawn, not zoomed.
 *
 * ─── PAGING ──────────────────────────────────────────────────────────────────
 * The slides sit in one scroll-snap track: a swipe (or trackpad) moves between
 * them, and the pager follows the scroll. The pills are the file's (20 x 4
 * active in `#7E3BEB`, 8 x 4 in `#D9D9D9`, 2.71 apart) and are buttons.
 *
 * It also ROTATES on its own every `BANNER_AUTOPLAY_MS`, looping, held while
 * a pointer rests on it, a finger is on it, focus is inside it or the tab is
 * hidden, and never under prefers-reduced-motion.
 *
 * NO SLIDE LINKS ANYWHERE. None of the three nodes carries an interaction and
 * none draws a button, so nothing here invents a destination.
 */

const SOFT = "pointer-events-none absolute max-w-none select-none mix-blend-soft-light";
const ART = "pointer-events-none absolute max-w-none select-none";

function HouseSlide() {
  return (
    <div className="relative h-[86px] overflow-hidden rounded-[15px] bg-[linear-gradient(90deg,#AD46FF_-16.5%,#682A99_82%)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Vector 449) */}
      <img src={asset("/home/slides/house-arc-top.svg")} alt="" aria-hidden className={`${SOFT} left-[-47px] top-[-65px] h-[115px] w-[272px]`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Vector 448), right-anchored */}
      <img src={asset("/home/slides/house-arc-bottom.svg")} alt="" aria-hidden className={`${SOFT} right-[-59px] top-[12px] h-[165px] w-[390px]`} />
      {/* Ellipse 1282 — the shadow the cube stands on. The node is LEFT-anchored
          while the cube is CENTER-anchored, so on a wider card the file's own
          constraints would leave the shadow behind; it rides with the cube
          instead (241 is 70 right of the 342 card's middle). */}
      <span aria-hidden className="pointer-events-none absolute left-[calc(50%+70px)] top-[82px] h-1 w-[83px] rounded-[50%] bg-black/25 blur-[2px]" />
      <p className="absolute left-4 top-4 flex h-[54px] w-[194px] items-center text-[14px] font-medium leading-[18.2px] text-white">
        <span>
          Build your own{" "}
          <em className="font-[family-name:var(--font-inter)] font-extrabold italic">house</em>.
          <br />
          Gather your <em className="font-[family-name:var(--font-inter)] font-bold italic">people</em>, and keep
          <br />
          the <em className="font-[family-name:var(--font-inter)] font-bold italic">community</em> going
        </span>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Group 48098403), centre-anchored */}
      <img src={asset("/home/slides/house-chat-cube.svg")} alt="" aria-hidden className={`${ART} left-[calc(50%+67px)] top-[2px] h-[82px] w-[111px]`} />
    </div>
  );
}

function GistSlide() {
  return (
    <div className="relative h-[86px] overflow-hidden rounded-[15px] bg-[#F84538]">
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Vector 450) */}
      <img src={asset("/home/slides/gist-arc-short.svg")} alt="" aria-hidden className={`${SOFT} left-[-25px] top-[-29px] h-[77px] w-[112px]`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Vector 449) */}
      <img src={asset("/home/slides/gist-arc-loop.svg")} alt="" aria-hidden className={`${SOFT} left-[59px] top-0 h-[148px] w-[284px]`} />
      <p className="absolute left-4 top-[21px] flex h-[44px] w-[204px] items-center text-[14px] font-bold leading-[22px] text-white">
        <span>
          Vibe in gistrooms, and
          <br />
          make fresh connections.
        </span>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Group 1000002879), right-anchored */}
      <img src={asset("/home/slides/gist-faces.png")} alt="" aria-hidden draggable={false} className={`${ART} right-[10.42px] top-[10px] h-[68.96px] w-[114.58px]`} />
    </div>
  );
}

function ExploreSlide() {
  return (
    <div className="relative h-[86px] overflow-hidden rounded-[15px] bg-[#0DCF51]">
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Vector 449) */}
      <img src={asset("/home/slides/explore-arc.svg")} alt="" aria-hidden className={`${SOFT} left-[107px] top-[-56px] h-[115px] w-[272px]`} />
      <p className="absolute left-4 top-[28px] flex h-[40px] w-[210px] items-center text-[14px] font-bold leading-[20px] text-white">
        <span>
          Explore what’s trending and
          <br />
          join conversations that matter.
        </span>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Group 1000002912) */}
      <img src={asset("/home/slides/explore-clouds.svg")} alt="" aria-hidden className={`${SOFT} left-[12px] top-[62px] h-[48px] w-[94px]`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Layer 2), the torn paper over the corner */}
      <img src={asset("/home/slides/explore-paper.svg")} alt="" aria-hidden className={`${ART} left-[-43px] top-[-78px] h-[121px] w-[121px]`} />
      {/* Frame 1000002913 — the people and the mic, flush with the card's right
          edge (234 + 108 = 342). The node is LEFT-anchored, which on a wider
          card would strand it mid-banner, so it holds the right edge instead. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export (Frame 1000002913) */}
      <img src={asset("/home/slides/explore-people.png")} alt="" aria-hidden draggable={false} className={`${ART} right-0 top-0 h-[86px] w-[108px]`} />
    </div>
  );
}

const SLIDES = [
  { id: "house", label: "Build your own house", Slide: HouseSlide },
  { id: "gistrooms", label: "Vibe in gistrooms", Slide: GistSlide },
  { id: "explore", label: "Explore what's trending", Slide: ExploreSlide },
] as const;

/**
 * How long a slide stays before the banner moves on by itself. Not in the
 * file (no timer, no prototype reaction on any of the three nodes); asked for
 * on 2026-09-16 ("is they not animation that it changes on it own too").
 */
export const BANNER_AUTOPLAY_MS = 10000;

export function HomeBanner() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Reasons the rotation is held, never one flag: a pointer resting on the
  // card, a finger on it, keyboard focus inside it, or the tab being hidden
  // can overlap, and releasing one must not restart a slide another still holds.
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  const hold = useCallback((reason: string, on: boolean) => {
    setHeld((current) => {
      if (current.has(reason) === on) return current;
      const next = new Set(current);
      if (on) next.add(reason);
      else next.delete(reason);
      return next;
    });
  }, []);

  // The pager follows the track, so a swipe and a tap agree on where we are.
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const onScroll = () => {
      const width = node.clientWidth;
      if (width > 0) setIndex(Math.round(node.scrollLeft / width));
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  const go = useCallback((next: number) => {
    const node = track.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ left: next * node.clientWidth, behavior: reduce ? "auto" : "smooth" });
    setIndex(next);
  }, []);

  useEffect(() => {
    const onVisibility = () => hold("hidden", document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [hold]);

  // Moves on by itself, looping from the last slide back to the first. The
  // timer restarts whenever the slide changes — by the timer, a swipe or a
  // pill — so every slide gets its full time. Under prefers-reduced-motion it
  // never rotates on its own: moving content the reader did not ask for is
  // exactly what that setting turns off.
  useEffect(() => {
    if (held.size > 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go((index + 1) % SLIDES.length), BANNER_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, held, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Square"
      // pointermove, not pointerenter: enter also fires when the card scrolls
      // or renders under a cursor that never moved, and nothing would release it.
      onPointerMove={(event) => event.pointerType === "mouse" && hold("hover", true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && hold("hover", false)}
      onTouchStart={() => hold("touch", true)}
      onTouchEnd={() => hold("touch", false)}
      onTouchCancel={() => hold("touch", false)}
      onFocus={() => hold("focus", true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hold("focus", false);
      }}
    >
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[15px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map(({ id, label, Slide }, i) => (
          <div
            key={id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}: ${label}`}
            className="w-full shrink-0 snap-start"
          >
            <Slide />
          </div>
        ))}
      </div>
      {/* 8 under the card to the pills: the button is 16 tall around a 4 pill,
          so 6 of the gap is already inside it. */}
      <DeckDots variant="banner" count={SLIDES.length} active={index} onSelect={go} className="pt-[2px]" />
    </section>
  );
}

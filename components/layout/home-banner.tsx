"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGate } from "@/hooks/use-gate";
import { DeckDots } from "@/components/ui/deck-dots";
import { asset, sq } from "@/lib/square-path";

/**
 * "CREATE YOUR GISTROOM NOW" — node 1305:149178, the first section of the
 * 2026-09-12 Home, directly under the search row.
 *
 * ─── THE FILE'S NUMBERS, READ FROM THE RAW NODE ──────────────────────────────
 *   · the card (1295:147718): 573 x 102, radius 10, `clipsContent`, and a
 *     linear gradient `#AD46FF` → `#682A99` whose handles run (-0.165, 0.144) →
 *     (0.820, 0.856) with the width handle straight BELOW the start. On a
 *     573 x 102 box that third handle makes the colour bands vertical, so the
 *     ramp runs left to right: `90deg`, `#AD46FF` at -16.5% and `#682A99` at
 *     82%. (The render agrees: the left column is one colour top to bottom.)
 *     Read as a square-space angle it comes out as 126deg, which is not what
 *     the file draws;
 *   · two soft-light arcs at 25% (1295:147719 under everything, 1295:147727
 *     over): the exported SVGs are trimmed to the stroke, so each sits at its
 *     stroke's own bounds — worked from `strokeGeometry` and checked against
 *     `absoluteRenderBounds` to the hundredth. 147727 is the same vector turned
 *     180°; its export already carries the turn. The file bakes `opacity 0.25`
 *     into both, so only the blend is applied here: `mix-blend-mode` inside an
 *     `<img>` blends against nothing, it has to be on the element;
 *   · the mascot (1295:147726) 98.96 x 96.29 at (5, -12), its top 12 clipped by
 *     the card. Its fill is STRETCH under `imageTransform [[1,0,0],[0,0.6486,0]]`
 *     — the source's top 64.86% filling the box — so the image is drawn at its
 *     full height (96.29 / 0.6486 = 148.46) and the box clips the rest. The
 *     2x node export was diffed against this and is the same picture;
 *   · the shadow it stands on (1295:147725): a 42.39 x 6.06 black/25 ellipse
 *     at (33.74, 88.63) under a 6.056 layer blur (CSS takes half);
 *   · the copy (1295:147720) at (103.55, 27.76), a 329 x 44 box, vertically
 *     centred: ONE text node in two runs per `styleOverrideTable` — override 29
 *     is Manrope Bold 24/32.784 in white, override 53 Geist Medium 10 in
 *     `#E9CEFF` (line-height inherited, 14.51). The runs sum to 47.3 in a 44
 *     box, which is the file's own clipping; the PNG wins and the box is 44;
 *   · the button (1295:147721) 90 x 38 at (458, 32) — 25 from the right edge,
 *     which is what it is anchored to here, since the card is the column's
 *     width: white, full radius, a 2px INSIDE stroke `#C2A0FA` at 55%,
 *     `0 6 6.2 rgba(0,0,0,.25)`, the label at 12.44/16.59 bold in `#682A98`.
 *     The file sets it in Roboto; it is Geist here, the repo's standing rule.
 *     The transparent `Button:shadow` rectangle inside it carries two more
 *     shadows, but a shadow is cast from the layer's alpha and the layer has
 *     none — nothing is drawn from it;
 *   · the dots (1295:147729) 9 under the card, `DeckDots`' own geometry (the
 *     4.33 pills at radius 13.54, 2.71 apart, the active one 27.08).
 *
 * ─── IT IS A CAROUSEL, AND THE DOTS ARE HONEST ───────────────────────────────
 * The file draws four dots with the first lit, and ONE slide. A row of dots
 * over a single slide promises pages that do not exist, so the dots render
 * only when there is more than one slide — today there is one, so there are
 * none. `slides` is the seam: a second slide is a second entry in
 * `HOME_BANNER_SLIDES`, and the dots appear with it, as buttons.
 *
 * Every slide is the file's one composition — the ramp, the arcs, the mascot,
 * the white pill — with its own words and destination; the file gives no
 * second artwork to make anything else of.
 *
 * ─── WHERE HOST ROOM GOES ────────────────────────────────────────────────────
 * The sidebar's "Start Gistroom" is `/gist-rooms?open=1`, which opens the room
 * composer on the rooms page. This calls the same thing, through `useGate`, so
 * a signed-out reader is asked to sign in rather than meeting a dead control
 * (the banner shows to everyone; the tap is the gate).
 *
 * ─── PHONES ──────────────────────────────────────────────────────────────────
 * The file gives no phone frame. Below `md` the composition cannot hold —
 * 329 of copy beside a 99 mascot and a 90 button do not fit in 358 — and
 * scaling the artboard to that width puts the sub-line at 6px. So the phone
 * keeps a compact strip on the same ramp, with the file's own words, mascot
 * and button; it is not a measured node and is marked as such.
 */
export type HomeBannerSlide = {
  id: string;
  title: string;
  subtitle: string;
  action: { label: string; href: string };
};

/** 1305:149178's one slide. */
export const HOME_BANNER_SLIDES: HomeBannerSlide[] = [
  {
    id: "host-gistroom",
    title: "Create your Gistroom now",
    subtitle: "Host live GistTalk sessions and watch your community thrive instantly.",
    action: { label: "Host Room", href: sq("/gist-rooms?open=1") },
  },
];

const GROUND = "bg-[linear-gradient(90deg,#AD46FF_-16.5%,#682A99_82%)]";

export function HomeBanner({ slides }: { slides: HomeBannerSlide[] }) {
  const gate = useGate();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  if (!slide) return null;
  const open = () => gate(() => router.push(slide.action.href));
  const paged = slides.length > 1;

  return (
    <section aria-label={slide.title}>
      {/* The phone strip — not a node; see the note above. */}
      <div className={`relative flex h-[66px] items-center rounded-[10px] pl-[72px] pr-4 md:hidden ${GROUND}`}>
        <span className="pointer-events-none absolute bottom-[9px] left-[30px] h-1 w-7 rounded-[50%] bg-black/25 blur-[1px]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- the file's own art */}
        <img
          src={asset("/home/banner-mascot.png")}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute bottom-0 left-4 h-[62px] w-[58px] select-none object-contain object-top"
        />
        <p className="min-w-0 flex-1 font-[family-name:var(--font-heading)] text-[13px] font-bold leading-[16px] text-white">
          {slide.title}
        </p>
        <button
          type="button"
          onClick={open}
          className="ws-press ml-3 flex h-7 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold leading-none text-[#682A98] transition-opacity hover:opacity-90"
        >
          {slide.action.label}
        </button>
      </div>

      {/* 1295:147718 — the card, clipped as the frame is. */}
      <div className={`relative hidden h-[102px] overflow-hidden rounded-[10px] md:block ${GROUND}`}>
        {/* 1295:147719 — the arc under everything, at its stroke's bounds. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export */}
        <img
          src={asset("/home/banner-arc-left.svg")}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-[-4.12px] top-[-57.22px] h-[106px] w-[256px] max-w-none select-none mix-blend-soft-light"
        />

        {/* 1295:147725 — the shadow the mascot stands on. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[33.74px] top-[88.63px] h-[6.06px] w-[42.39px] rounded-[50%] bg-black/25 blur-[3.03px]"
        />
        {/* 1295:147726 — the mascot: the source's top 64.86% in a 98.96 x 96.29
            box at (5, -12). */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[5px] top-[-12px] h-[96.29px] w-[98.96px] overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the file's own art */}
          <img
            src={asset("/home/banner-mascot.png")}
            alt=""
            draggable={false}
            className="h-[148.46px] w-[98.96px] max-w-none select-none"
          />
        </span>

        {/* 1295:147720 — one text node, two runs, centred in its 44. */}
        <p className="absolute left-[103.55px] top-[27.76px] flex h-[44px] w-[329px] flex-col justify-center">
          <span className="font-[family-name:var(--font-heading)] text-[24px] font-bold leading-[32.784px] text-white">
            {slide.title}
          </span>
          <span className="text-[10px] font-medium leading-[14.51px] text-[#E9CEFF]">{slide.subtitle}</span>
        </p>

        {/* 1295:147727 — the arc over everything, at its stroke's bounds. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export */}
        <img
          src={asset("/home/banner-arc-right.svg")}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-[204.87px] top-[16.41px] h-[153px] w-[369px] max-w-none select-none mix-blend-soft-light"
        />

        {/* 1295:147721 — Host Room, 25 from the right edge. */}
        <button
          type="button"
          onClick={open}
          className="ws-press absolute right-[25px] top-[32px] flex h-[38px] w-[90px] items-center justify-center rounded-full bg-white text-[12.44px] font-bold leading-[16.59px] text-[#682A98] shadow-[inset_0_0_0_2px_rgba(194,160,250,0.55),0_6px_6.2px_rgba(0,0,0,0.25)] transition-opacity hover:opacity-90"
        >
          {slide.action.label}
        </button>
      </div>

      {/* 1295:147729 — the pager, 9 under the card. Only while there is
          something to page through. */}
      {paged && <DeckDots count={slides.length} active={index} onSelect={setIndex} className="pt-[9px]" />}
    </section>
  );
}

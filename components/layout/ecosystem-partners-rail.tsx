"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { IconExportArrow } from "@/components/ui/icons";

/**
 * "Ecosystem Partners" — the rail's card for the products around the square.
 *
 * Two slides, exactly as the file draws them, and the numbers here are its
 * numbers: a 156px card at radius 22 over `rgba(16,16,18,0.62)` with a 1px
 * 18%-white rim and a 7px backdrop blur; copy block 195px wide inset 16/24;
 * art 96×96 inset at x=235.
 *
 * TYPE: the file names Roboto for the section heading and the button, Geist
 * for the card's own copy. The app is Geist throughout — the same call the
 * topic picker and the person row already made — so this renders at the file's
 * weights, sizes and line-heights in the house face rather than forking the
 * type system for one card.
 */
interface PartnerSlide {
  /** Split so the accent word can carry its own colour, as the file does. */
  headline: { lead: string; accent?: string; tail?: string };
  body: string;
  /** The file gives each slide its own CTA colour. */
  accent: string;
  /** Where "Join now" goes — the product the slide is actually about. */
  href: string;
  art: string;
  alt: string;
}

/** The platform itself, for the slide that is about the platform itself. */
const WORLDSTREET_URL =
  process.env.NEXT_PUBLIC_WORLDSTREET_URL ?? "https://worldstreetgold.com";

const SLIDES: PartnerSlide[] = [
  {
    headline: { lead: "Welcome to\nthe New ", accent: "Economy" },
    body: "Build the life you want with all the tools you could ever need… all from one account.",
    accent: "#FFD230",
    href: WORLDSTREET_URL,
    art: "/ecosystem/partner-slide-1.svg",
    alt: "WorldStreet",
  },
  {
    headline: { lead: "One Platform. Every Currency. Every Asset." },
    body: "Send, pay bills, and save together — all in one app.",
    accent: "#D4F84A",
    // LinkPay — the slide's own copy is about sending, paying bills and
    // saving together, which is that product rather than the platform as a
    // whole. A carousel where every card leads to the same place is a banner
    // with extra steps.
    href: "https://linkpay-lemon.vercel.app/en",
    art: "/ecosystem/partner-slide-2.svg",
    alt: "LinkPay",
  },
];

/** How long a slide holds before the next one. */
const SLIDE_MS = 7000;

export function EcosystemPartnersRail() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0];

  /**
   * The file draws two variants of one card and an indicator that moves
   * between them; it cannot draw the passage of time, so the interval is ours.
   * Seven seconds is long enough to read 20 words at a glance and short enough
   * that the second slide is not a secret.
   *
   * It stops entirely for a reader who has asked for less motion — a card that
   * rewrites itself under the cursor is exactly what that setting is for — and
   * the dots stay operable either way.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      SLIDE_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  if (!slide) return null;

  return (
    <section
      aria-label="Ecosystem Partners"
      className="rounded-[22px] bg-[rgba(16,16,18,0.62)] pb-0 pt-[17px] backdrop-blur-[7px]"
    >
      {/* The heading is inset 17px; the card is NOT — it runs the full width of
          the block, which is why the two cannot share one padding. */}
      <h2 className="px-[17px] text-[14px] font-bold leading-5 text-white">Ecosystem Partners</h2>

      {/* The card's top edge sits 49px down the block: 17 of inset, a 20px
          heading, 12 of gap. */}
      {/*
        MIN height, not a fixed one, and the children FLOW.

        This was `h-[156px] overflow-hidden` with both columns absolutely
        positioned at `top-6`. 156 is the height the file draws, and it holds
        only while the headline is two lines: "One Platform. Every Currency.
        Every Asset." wraps to THREE in the rail's real width, which pushed the
        block past the card and `overflow-hidden` cut "Join now" in half. The
        card looked fine and the call to action was the thing that disappeared.

        A fixed height plus absolute children cannot report that it does not
        fit — it just hides the overflow, silently, and only at some rail
        widths and for some copy. So the height is a floor, the columns are a
        flex row, and a longer headline makes the card taller instead of eating
        the link. `overflow-hidden` is gone with it: nothing should be able to
        be clipped here without somebody choosing it.
      */}
      <div className="relative mt-3 flex min-h-[156px] gap-4 rounded-[22px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)] p-4 pt-6 backdrop-blur-[7px]">
        {/*
          Takes the room the art does not, at every rail width.

          The text box was a fixed 195px with the art pinned off the right —
          fine on the 347px card the design was drawn at, six pixels of gutter
          at the rail's real 331px, so the headline read as if it were touching
          the logo. As a flex child it simply gets what is left after the art's
          96px and the row's 16px gap, and `min-w-0` is what lets it actually
          rewrap rather than refusing to shrink below its longest word.
        */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="whitespace-pre-line text-[18px] font-bold leading-6 tracking-[-0.008em] text-white">
              {slide.headline.lead}
              {slide.headline.accent && (
                <span style={{ color: slide.accent }}>{slide.headline.accent}</span>
              )}
              {slide.headline.tail}
            </p>
            <p className="mt-1 text-[10px] font-normal leading-[14px] tracking-[-0.002em] text-white/70">
              {slide.body}
            </p>
          </div>

          {/* Hug-width, fully rounded, and transparent: the file's fill on this
              control is empty — the shadow rectangle behind the label is what
              gives it its edge, and the label carries the colour. */}
          <a
            href={slide.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ws-press flex w-fit items-center gap-2 rounded-full px-0 py-0 text-[12px] font-bold leading-4 transition-opacity hover:opacity-80"
            style={{ color: slide.accent }}
          >
            Join now
            <IconExportArrow className="h-3 w-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        {/* The art column: 96 of mark plus the dots under it. `shrink-0` so a
            long headline takes the card taller rather than squeezing the
            logo — the row's padding gives it the file's 16px inset. */}
        <div className="flex w-24 shrink-0 flex-col items-center gap-2">
          <Image
            src={slide.art}
            alt={slide.alt}
            width={96}
            height={96}
            // Each slide carries its own mark now that they lead to different
            // products — the platform on one, LinkPay on the other. Neither is
            // preloaded: the card sits below the fold on every surface that
            // shows it.
            priority={false}
          />

          {/* The file's own indicator: the CURRENT slide is the small light
              dot, the other is a wide dark pill. That is the inverse of the
              usual arrangement, and it is what the file draws — the light mark
              is the one you can see against this surface. */}
          <div className="flex items-center gap-1">
            {SLIDES.map((entry, at) => (
              <button
                key={entry.art}
                onClick={() => setIndex(at)}
                aria-label={`Show partner ${at + 1} of ${SLIDES.length}`}
                aria-current={at === index ? "true" : undefined}
                className={cn(
                  "h-1 rounded-lg transition-all",
                  at === index ? "w-1 bg-[#BFBFBF]" : "w-4 bg-[#3C3C3C]"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

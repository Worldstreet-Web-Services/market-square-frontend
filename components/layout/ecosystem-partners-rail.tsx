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
  art: string;
  alt: string;
}

const SLIDES: PartnerSlide[] = [
  {
    headline: { lead: "Welcome to\nthe New ", accent: "Economy" },
    body: "Build the life you want with all the tools you could ever need… all from one account.",
    accent: "#FFD230",
    art: "/ecosystem/partner-slide-1.svg",
    alt: "WorldStreet",
  },
  {
    headline: { lead: "One Platform. Every Currency. Every Asset." },
    body: "Send, pay bills, and save together — all in one app.",
    accent: "#D4F84A",
    art: "/ecosystem/partner-slide-2.svg",
    alt: "WorldStreet",
  },
];

/** Where "Join now" goes. The same product the sidebar's WorldStreet entry opens. */
const JOIN_URL = process.env.NEXT_PUBLIC_WORLDSTREET_URL ?? "https://worldstreetgold.com";

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
      <div className="relative mt-3 h-[156px] overflow-hidden rounded-[22px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)] backdrop-blur-[7px]">
        <div className="absolute left-4 top-6 flex w-[195px] max-w-[calc(100%-128px)] flex-col gap-4">
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
            href={JOIN_URL}
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

        {/* x=235 in a 347 card is 16 from the RIGHT edge. Anchored to that
            edge rather than the left one, so a rail that is not exactly 347
            keeps the art's inset instead of pushing it off. */}
        <div className="absolute right-4 top-6 flex w-24 flex-col items-center gap-2">
          <Image
            src={slide.art}
            alt={slide.alt}
            width={96}
            height={96}
            // The art is the same mark on both slides, so it is not swapped
            // per render; only the second draws the wordmark over it.
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

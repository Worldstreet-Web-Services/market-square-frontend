"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { IconMsPlay } from "@/components/ui/design-icons";
import { useFeed } from "@/features/feed/hooks/use-feed";
import type { FeedItem } from "@/features/feed/lib/types";

interface Slide {
  key: string;
  eyebrow: string;
  reference: string;
  title: string;
  href: string;
  action: string;
  price: string | null;
  meta: string | null;
  seed: string;
}

// The hero draws from the live lane — the things on the square that expire.
// A stream becomes "join live"; a scheduled activity becomes "reserve".
function toSlide(item: FeedItem): Slide | null {
  if (item.stream) {
    const stream = item.stream;
    return {
      key: stream.id,
      // The design names the surface, not the record: the hero is the arena.
      eyebrow: "Native Live & Arcade Arena",
      reference: stream.owner ? `Hosted by ${stream.owner.displayName}` : "",
      title: stream.title,
      href: `/live/${stream.id}?source=home:featured`,
      action: stream.status === "live" ? "Join Live Arena" : "View session",
      price: stream.ticketPriceKash ? formatKash(stream.ticketPriceKash) : null,
      // The feed payload carries PEAK viewers, not the live count — labelling
      // it "watching" beside a live dot overstated the room every time.
      meta: stream.peakViewers > 0 ? `peak ${formatCount(stream.peakViewers)} viewers` : null,
      seed: stream.id,
    };
  }
  if (item.activity) {
    const activity = item.activity;
    return {
      key: activity.id,
      eyebrow: "Native Live & Arcade Arena",
      reference: activity.owner ? `Hosted by ${activity.owner.displayName}` : "",
      title: activity.title,
      href: "/schedule",
      action: "Reserve a seat",
      price: null,
      meta: formatDateTime(activity.startsAt),
      seed: activity.id,
    };
  }
  return null;
}

export function FeaturedArena() {
  const feed = useFeed("live");
  const [index, setIndex] = useState(0);

  const slides = (feed.data?.pages[0]?.items ?? [])
    .map(toSlide)
    .filter((slide): slide is Slide => slide !== null)
    .slice(0, 5);

  if (feed.isPending) return <Skeleton className="h-[148px] w-full rounded-[21px]" />;
  if (slides.length === 0) return null;

  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <section aria-label="Featured on the square">
      {/* The design's hero: a 21px-radius slab washed left-to-right from 25% to
          72% black, ringed in mid grey, with the artwork inset on the left. */}
      <div className="flex items-center gap-5 rounded-[21px] border border-[#999999] bg-[linear-gradient(90deg,rgba(0,0,0,0.25),rgba(0,0,0,0.72))] p-4">
        <GradientThumb seed={slide.seed} className="h-[129px] w-[125px] shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="truncate bg-[linear-gradient(135deg,#3C3C3C,#7A7A7A_45%,#5A5A5A)] bg-clip-text text-[10px] font-bold uppercase tracking-[0.025em] text-transparent">
            {slide.eyebrow}
          </p>
          {slide.meta && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5">
              <span className="h-[3px] w-[3px] rounded-full bg-[#00D492]" aria-hidden />
              <span className="text-[10px] leading-none text-white/50">{slide.meta}</span>
            </span>
          )}
          <p className="mt-2 line-clamp-2 text-[14.7px] font-bold leading-[1.15] text-white">
            {slide.title}
          </p>
          {slide.reference && (
            <p className="mt-1.5 truncate text-[10px] text-white/80">{slide.reference}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-full bg-[linear-gradient(180deg,#D4D4D8,#3C3C3C)] py-2.5 pl-4 pr-2.5">
          <Link href={slide.href} className="ws-press flex items-center gap-1.5">
            <IconMsPlay className="h-[18px] w-[18px] text-grey-700" />
            <span className="text-[14px] font-bold leading-5 text-white">{slide.action}</span>
          </Link>
          {slide.price && (
            <span className="tnum rounded-full bg-black/20 px-3.5 py-0.5 text-[12px] font-bold text-white">
              {slide.price}
            </span>
          )}
        </div>
      </div>

      {/* Carousel dots, only once there is more than one thing to feature. */}
      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-[7px]">
          {slides.map((item, i) => (
            <button
              key={item.key}
              onClick={() => setIndex(i)}
              aria-label={`Show featured item ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-[7px] rounded-full transition-all",
                i === index ? "w-[22px] bg-grey-600" : "w-[7px] bg-grey-800 hover:bg-grey-700"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

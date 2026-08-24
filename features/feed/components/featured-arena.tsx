"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { cn } from "@/lib/cn";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { IconEye } from "@/components/ui/icons";
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
      eyebrow: `Spotlight · ${stream.category || "live"} · Market Square`,
      reference: `#${stream.id.slice(0, 8).toUpperCase()}`,
      title: stream.title,
      href: `/live/${stream.id}?source=home:featured`,
      action: stream.status === "live" ? "Join Live Arena" : "View session",
      price: stream.ticketPriceKash ? formatKash(stream.ticketPriceKash) : null,
      meta: stream.peakViewers > 0 ? `${formatCount(stream.peakViewers)} watching` : null,
      seed: stream.id,
    };
  }
  if (item.activity) {
    const activity = item.activity;
    return {
      key: activity.id,
      eyebrow: `Spotlight · ${activity.type} · Market Square`,
      reference: `#${activity.id.slice(0, 8).toUpperCase()}`,
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

  if (feed.isPending) return <Skeleton className="h-[92px] w-full rounded-2xl" />;
  if (slides.length === 0) return null;

  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <section aria-label="Featured on the square">
      <div className="ws-post flex items-center gap-3 p-3">
        <GradientThumb seed={slide.seed} className="h-14 w-14 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-featured">
            {slide.eyebrow}
          </p>
          <p className="tnum truncate text-[9px] text-meta">{slide.reference}</p>
          <p className="mt-1 truncate text-[14px] font-bold text-heading">{slide.title}</p>
          {slide.meta && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-meta">
              <IconEye className="h-3 w-3" />
              {slide.meta}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Link
            href={slide.href}
            className="ws-press rounded-full bg-accent px-4 py-1.5 text-[12px] font-bold text-ink transition-colors hover:bg-white"
          >
            {slide.action}
          </Link>
          {slide.price && <span className="tnum text-[11px] text-meta">{slide.price}</span>}
        </div>
      </div>

      {/* Carousel dots, only once there is more than one thing to feature. */}
      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((item, i) => (
            <button
              key={item.key}
              onClick={() => setIndex(i)}
              aria-label={`Show featured item ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-accent" : "w-1.5 bg-white/25 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

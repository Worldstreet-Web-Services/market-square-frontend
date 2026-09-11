"use client";

import { useRef, useState } from "react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { cn } from "@/lib/cn";
import { railDotWidth, railIndexAt, type PostMediaLike } from "@/lib/post-media";

/**
 * A POST'S PHOTOS, SIDE BY SIDE — node 1029:22591.
 *
 * Dots on top, then 20 below them a row of 250.93 × 352.22 tiles at radius
 * 20.72, 10.36 apart, that runs off the card's right edge and scrolls. The
 * file draws the row past the card, clipped; here the row bleeds out to the
 * card's edge (the negative right margin) so the next photo peeks in exactly
 * there, and it snaps a whole tile at a time. The current dot is 31.17 wide in
 * #9F5AFF, the file's next one 11.85, the rest 10.60 in #D9D9D9 — geometry in
 * `lib/post-media.ts`.
 *
 * Only ever photos: the service refuses a video in a post of two or more. A
 * tap opens that photo full size in the shared viewer.
 */
export function MediaRail({ items }: { items: PostMediaLike[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    setActive(railIndexAt(node.scrollLeft, node.scrollWidth - node.clientWidth, items.length));
  };

  return (
    <div>
      <div className="flex items-center gap-[3.12px]" aria-hidden>
        {items.map((item, index) => (
          <span
            key={`${item.url}-${index}`}
            className={cn(
              "h-[4.99px] rounded-[15.59px] transition-[width,background-color] duration-200 motion-reduce:transition-none",
              index === active ? "bg-[#9F5AFF]" : "bg-[#D9D9D9]"
            )}
            style={{ width: railDotWidth(index, active) }}
          />
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        aria-label={`${items.length} photos`}
        className="-mr-4 mt-5 flex snap-x snap-mandatory gap-[10.36px] overflow-x-auto pr-4 [scrollbar-width:none] md:-mr-[39px] md:pr-[39px] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <button
            key={`${item.url}-${index}`}
            type="button"
            onClick={() => setOpen(index)}
            aria-label={`View photo ${index + 1} of ${items.length}`}
            className="ws-press h-[352.22px] w-[250.93px] shrink-0 snap-start overflow-hidden rounded-[20.72px] bg-white/[0.04]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- service-issued media URL */}
            <img
              src={item.url}
              alt=""
              decoding="async"
              loading={index > 2 ? "lazy" : undefined}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      {open !== null && items[open] && (
        <ImageViewer
          src={items[open].url}
          alt={`Photo ${open + 1} of ${items.length}`}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

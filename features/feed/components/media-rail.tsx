"use client";

import { useRef, useState } from "react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { cn } from "@/lib/cn";
import { RAIL_SIZES, railDotWidth, railIndexAt, type PostMediaLike, type RailSize } from "@/lib/post-media";
import { IconPlay } from "@/components/ui/icons";
import { isVideoUrl } from "@/lib/media";

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
export function MediaRail({ items, size = "post" }: { items: PostMediaLike[]; size?: RailSize }) {
  const g = RAIL_SIZES[size];
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    setActive(railIndexAt(node.scrollLeft, node.scrollWidth - node.clientWidth, items.length, size));
  };

  return (
    <div className={cn(size === "compact" && "flex min-h-0 flex-1 flex-col")}>
      <div className="flex items-center" style={{ gap: g.dotGap }} aria-hidden>
        {items.map((item, index) => (
          <span
            key={`${item.url}-${index}`}
            className={cn(
              "rounded-[15.59px] transition-[width,background-color] duration-200 motion-reduce:transition-none",
              index === active ? "bg-[#9F5AFF]" : "bg-[#D9D9D9]"
            )}
            style={{ width: railDotWidth(index, active, size), height: g.dotHeight }}
          />
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        aria-label={`${items.length} photos`}
        style={{ gap: g.gap, marginTop: size === "compact" ? 10.7 : 20 }}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          size === "compact" && "min-h-0 flex-1",
          // The column's rail bleeds to the card's edge so the next photo peeks
          // in; the compact one sits inside its own card and does not.
          size === "post" && "-mr-4 pr-4 md:-mr-[39px] md:pr-[39px]"
        )}
      >
        {items.map((item, index) => {
          // A VIDEO IS NOT AN IMAGE. The column's rail only ever gets photos —
          // the service refuses a video in a post of two or more — but the
          // card in Home's row rails a single item too, and a clip's URL in an
          // <img> is the broken tile ogazboiz saw. A clip shows its poster
          // with a play mark, and the tap falls through to the card, which
          // opens the post where the player is.
          const video = item.kind === "video" || isVideoUrl(item.url);
          const poster = item.thumbnailUrl ?? null;
          return (
          <button
            key={`${item.url}-${index}`}
            type="button"
            disabled={video}
            onClick={() => setOpen(index)}
            aria-label={video ? `Video ${index + 1} of ${items.length}` : `View photo ${index + 1} of ${items.length}`}
            style={{
              width: g.tile,
              // Fixed in the column; in the rail the tile fills the height the
              // card has left, so the caption is never squeezed out.
              ...(size === "compact" ? {} : { height: g.tileHeight }),
              borderRadius: g.radius,
            }}
            className={cn(
              "ws-press shrink-0 snap-start overflow-hidden bg-white/[0.04]",
              size === "compact" && "h-full"
            )}
          >
            {video ? (
              <span className="relative block h-full w-full">
                {poster ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- service-issued poster */
                  <img
                    src={poster}
                    alt=""
                    decoding="async"
                    loading={index > 2 ? "lazy" : undefined}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // No poster is a real answer: draw the ground rather than a
                  // broken picture.
                  <span className="block h-full w-full bg-white/[0.06]" />
                )}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="ws-glass flex h-9 w-9 items-center justify-center rounded-full text-white">
                    <IconPlay className="h-4 w-4" />
                  </span>
                </span>
              </span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- service-issued media URL */
              <img
                src={item.url}
                alt=""
                decoding="async"
                loading={index > 2 ? "lazy" : undefined}
                className="h-full w-full object-cover"
              />
            )}
          </button>
          );
        })}
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

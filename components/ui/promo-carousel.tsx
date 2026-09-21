"use client";

import { Children } from "react";
import useEmblaCarousel from "embla-carousel-react";

/**
 * Horizontal promo rail — shows the first card fully, with ~20% of the next
 * card peeking in from the right. Swipe to scroll through the rest.
 * No dots, no chrome — just the cards and the peek.
 */
export function PromoCarousel({ children }: { children: React.ReactNode }) {
  const [emblaRef] = useEmblaCarousel({
    align: "start",
    loop: false,
    containScroll: "trimSnaps",
  });
  const slides = Children.toArray(children);

  return (
    <div ref={emblaRef} className="overflow-hidden">
      <div className="flex touch-pan-y gap-3">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="min-w-0 shrink-0"
            // ~80% width so the next card peeks ~20%
            style={{ flexBasis: "82%" }}
          >
            {slide}
          </div>
        ))}
      </div>
    </div>
  );
}

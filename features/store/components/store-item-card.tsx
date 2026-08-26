"use client";

import Link from "next/link";
import { formatCount, formatKash } from "@/lib/format";
import { Pill } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { CATEGORY_GLYPH, type StoreItem } from "@/features/store/lib/types";

export function storePriceLabel(item: Pick<StoreItem, "pricing" | "priceKash">): string {
  return item.pricing === "free" || !item.priceKash ? "Free" : formatKash(item.priceKash);
}

/**
 * ONE card for a store item, wherever store items are listed.
 *
 * The ARK Store grid and Explore's Products tab both render this. It used to
 * be private to `store-page`; Explore needed the same object and a second
 * variant is how two cards with two different prices-and-installs treatments
 * end up shipping.
 *
 * A missing artwork gets the seeded gradient, never a blank tile, and the
 * install tally comes from the payload — never invented.
 */
export function StoreItemCard({ item }: { item: StoreItem }) {
  return (
    <Link
      href={`/store/${item.slug}`}
      className="ws-hair ws-rail-row block overflow-hidden rounded-2xl border"
    >
      <GradientThumb
        seed={item.slug}
        glyph={CATEGORY_GLYPH[item.category]}
        className="aspect-[16/9] w-full"
      />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-heading">{item.name}</p>
          <Pill tone={item.pricing === "free" ? "neutral" : "accent"}>
            {storePriceLabel(item)}
          </Pill>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] text-meta">{item.tagline}</p>
        <p className="tnum mt-2 text-[11px] text-grey-600">
          {formatCount(item.installCount)} installs · {item.category}
        </p>
      </div>
    </Link>
  );
}

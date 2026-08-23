"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount, formatKash } from "@/lib/format";
import { Pill } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useStoreItems } from "@/features/store/hooks/use-store";
import { CATEGORY_GLYPH, type StoreCategory, type StoreItem } from "@/features/store/lib/types";

// Backend category enum is singular: app | product | service.
const CATEGORIES: Array<{ value: StoreCategory | undefined; label: string }> = [
  { value: undefined, label: "All" },
  { value: "app", label: "Apps" },
  { value: "product", label: "Products" },
  { value: "service", label: "Services" },
];

export function storePriceLabel(item: Pick<StoreItem, "pricing" | "priceKash">): string {
  return item.pricing === "free" || !item.priceKash ? "Free" : formatKash(item.priceKash);
}

function StoreCard({ item }: { item: StoreItem }) {
  return (
    <Link
      href={`/store/${item.slug}`}
      className="ws-card block overflow-hidden transition-colors hover:bg-white/8"
    >
      <GradientThumb seed={item.slug} glyph={CATEGORY_GLYPH[item.category]} className="h-28 w-full" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <Pill tone={item.pricing === "free" ? "neutral" : "accent"}>{storePriceLabel(item)}</Pill>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-grey-500">{item.tagline}</p>
        <p className="mt-2 text-[11px] text-grey-600">
          {formatCount(item.installCount)} installs · {item.category}
        </p>
      </div>
    </Link>
  );
}

const PAGE_SIZE = 12;

export function StorePage() {
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const items = useStoreItems(category);
  const all = items.data?.items ?? [];
  const shown = all.slice(0, visible);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-6">
      <div>
        <h1 className="ws-display text-2xl">ARK Store</h1>
        <p className="mt-1 text-sm text-grey-500">Apps, products and services. Cheap, fast, simple.</p>
      </div>

      <div className="ws-inset flex max-w-md gap-1 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => {
              setCategory(c.value);
              setVisible(PAGE_SIZE);
            }}
            className={cn(
              "flex-1 rounded-full py-2 text-xs font-semibold transition-colors sm:text-sm",
              category === c.value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {items.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ws-card overflow-hidden">
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      {items.isError && (
        <ErrorState error={items.error} fallback="Couldn't load the store." onRetry={() => items.refetch()} />
      )}
      {items.isSuccess && items.data.items.length === 0 && (
        <EmptyState glyph="◈" title="Nothing in this category yet" body="New listings land every week." />
      )}
      {items.isSuccess && all.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item) => (
              <div key={item.id} className="ws-enter">
                <StoreCard item={item} />
              </div>
            ))}
          </div>
          {/* Load-more, never infinite scroll: commerce needs position memory
              and a reachable end. */}
          {visible < all.length ? (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Load more ({all.length - visible} left)
              </Button>
            </div>
          ) : (
            all.length > PAGE_SIZE && (
              <p className="pt-2 text-center text-xs text-meta">That&apos;s everything.</p>
            )
          )}
        </>
      )}
    </div>
  );
}

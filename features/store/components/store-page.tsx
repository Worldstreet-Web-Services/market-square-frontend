"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
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
      className="ws-hair ws-rail-row block overflow-hidden rounded-2xl border"
    >
      <GradientThumb seed={item.slug} glyph={CATEGORY_GLYPH[item.category]} className="aspect-[16/9] w-full" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-bold text-heading">{item.name}</p>
          <Pill tone={item.pricing === "free" ? "neutral" : "accent"}>{storePriceLabel(item)}</Pill>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] text-meta">{item.tagline}</p>
        <p className="tnum mt-2 text-[11px] text-grey-600">
          {formatCount(item.installCount)} installs · {item.category}
        </p>
      </div>
    </Link>
  );
}

export function StorePage() {
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined);
  const items = useStoreItems(category);
  const all = items.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {/* Wide route: the header still uses the column chrome so the store
          reads as part of the same product, then the grid spreads. */}
      <ColumnHeader title="ARK Store" subtitle="Apps, products and services. Cheap, fast, simple.">
        <div className="max-w-lg">
          <ColumnTabs
            tabs={CATEGORIES.map((c) => ({ value: c.value ?? "all", label: c.label }))}
            value={category ?? "all"}
            onChange={(next) => setCategory(next === "all" ? undefined : (next as StoreCategory))}
          />
        </div>
      </ColumnHeader>

      <div className="space-y-5 px-4 py-5 lg:px-6">
      {items.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ws-hair overflow-hidden rounded-2xl border">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
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
      {items.isSuccess && all.length === 0 && (
        <EmptyState glyph="◈" title="Nothing in this category yet" body="New listings land every week." />
      )}
      {items.isSuccess && all.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {all.map((item) => (
              <div key={item.id} className="ws-enter">
                <StoreCard item={item} />
              </div>
            ))}
          </div>
          {/* Load-more, never infinite scroll: commerce needs position memory
              and a reachable end. */}
          {items.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                loading={items.isFetchingNextPage}
                onClick={() => void items.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : (
            <p className="pt-2 text-center text-sm text-meta">That&apos;s everything.</p>
          )}
        </>
      )}
      </div>
    </>
  );
}

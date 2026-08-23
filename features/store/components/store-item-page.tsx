"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, formatKash } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconChevronLeft } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, InlineError } from "@/components/ui/states";
import { useMyOrderFor, usePlaceOrder, useStoreItem } from "@/features/store/hooks/use-store";
import { storePriceLabel } from "@/features/store/components/store-page";
import { CATEGORY_GLYPH, type StoreItem } from "@/features/store/lib/types";

// ≤ 2 taps from card to confirmed order: free items order on the first tap
// and open; paid items show one confirm sheet, then order.
function OrderCta({ item }: { item: StoreItem }) {
  const order = usePlaceOrder(item.slug);
  const gate = useGate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Owned state comes from /me/orders — items don't embed the viewer's order.
  const myOrder = useMyOrderFor(item.id);

  const openAction = () => {
    if (item.actionUrl) window.open(item.actionUrl, "_blank", "noopener");
  };

  if (myOrder) {
    return (
      <Button size="lg" className="w-full sm:w-auto" onClick={openAction}>
        Open
      </Button>
    );
  }

  if (item.pricing === "free" || !item.priceKash) {
    return (
      <div className="space-y-2">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          loading={order.isPending}
          onClick={() =>
            gate(() =>
              order.mutate(undefined, {
                onSuccess: openAction,
              })
            )
          }
        >
          Get — Free
        </Button>
        {order.isError && <InlineError error={order.error} fallback="Couldn't complete the order." />}
      </div>
    );
  }

  return (
    <>
      <Button size="lg" className="w-full sm:w-auto" onClick={() => gate(() => setConfirmOpen(true))}>
        Buy · {formatKash(item.priceKash)}
      </Button>
      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm purchase">
        <div className="space-y-4">
          <p className="text-sm text-grey-400">{item.name}</p>
          <div className="ws-inset flex items-center justify-between px-4 py-3">
            <span className="text-sm text-grey-400">Price</span>
            <span className="tnum text-base font-bold">{formatKash(item.priceKash)}</span>
          </div>
          {order.isError && (
            <InlineError error={order.error} fallback="KASH payment failed — check your balance." />
          )}
          <Button
            size="lg"
            className="w-full"
            loading={order.isPending}
            onClick={() =>
              order.mutate(undefined, {
                onSuccess: () => setConfirmOpen(false),
              })
            }
          >
            {order.isError ? "Try again" : `Confirm · ${formatKash(item.priceKash)}`}
          </Button>
          <p className="text-center text-[11px] text-grey-600">Paid from your KASH balance.</p>
        </div>
      </Sheet>
    </>
  );
}

export function StoreItemPage({ slug }: { slug: string }) {
  const item = useStoreItem(slug);
  const myOrder = useMyOrderFor(item.data?.id);

  if (item.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 lg:px-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (item.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <ErrorState error={item.error} fallback="Couldn't load this listing." onRetry={() => item.refetch()} />
      </div>
    );
  }
  const data = item.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Link href="/store" className="mb-3 inline-flex items-center gap-1 text-xs text-grey-400 hover:text-white">
        <IconChevronLeft className="h-4 w-4" /> Store
      </Link>
      <GradientThumb seed={data.slug} glyph={CATEGORY_GLYPH[data.category]} className="h-44 w-full rounded-2xl" />
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="ws-display text-2xl">{data.name}</h1>
          <p className="mt-1 text-sm text-grey-400">{data.tagline}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-grey-600">
            <Pill className="px-2 py-0 text-[10px] capitalize">{data.category}</Pill>
            {formatCount(data.installCount)} installs
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone={data.pricing === "free" ? "neutral" : "accent"} className="px-3 py-1 text-sm">
            {storePriceLabel(data)}
          </Pill>
          {myOrder && <span className="text-[11px] text-up">Owned</span>}
        </div>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-grey-200">{data.description}</p>
      <div className="mt-6">
        <OrderCta item={data} />
      </div>
    </div>
  );
}

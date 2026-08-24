"use client";

import { useState } from "react";
import { formatCount, formatKash } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconCheck } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { ColumnHeader } from "@/components/layout/column-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, InlineError } from "@/components/ui/states";
import { useMyOrderFor, usePlaceOrder, useStoreItem } from "@/features/store/hooks/use-store";
import { storePriceLabel } from "@/features/store/components/store-page";
import { CATEGORY_GLYPH, type StoreItem } from "@/features/store/lib/types";
import { trackMarketEvent, useMarketView } from "@/lib/analytics";

// ≤ 2 taps from card to confirmed order: free items order on the first tap
// and open; paid items show one confirm sheet, then order.
function OrderCta({ item }: { item: StoreItem }) {
  const order = usePlaceOrder(item.slug);
  const gate = useGate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
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
      <Button size="lg" className="w-full sm:w-auto" onClick={() => gate(() => { trackMarketEvent("content_opened", { surface: "store_checkout", entityType: "store_item", entityId: item.id }); setConfirmedOrderId(null); setConfirmOpen(true); })}>
        Buy · {formatKash(item.priceKash)}
      </Button>
      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm purchase">
        {confirmedOrderId ? (
          <div className="space-y-5 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-up/15 text-up"><IconCheck className="h-8 w-8" /></span>
            <div><p className="ws-display text-xl">Purchase confirmed</p><p className="mt-1 text-sm text-grey-400">{item.name} is now in your account.</p></div>
            <div className="ws-inset p-4 text-left text-xs"><p className="text-grey-600">Receipt and support</p><p className="tnum mt-1 break-all text-white">{confirmedOrderId} · SUP-{confirmedOrderId.toUpperCase()}</p></div>
            <Button size="lg" className="w-full" onClick={() => { setConfirmOpen(false); openAction(); }}>Open {item.name}</Button>
          </div>
        ) : <div className="space-y-4">
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
                onSuccess: (confirmedOrder) => setConfirmedOrderId(confirmedOrder.id),
              })
            }
          >
            {order.isError ? "Try again" : `Confirm · ${formatKash(item.priceKash)}`}
          </Button>
          <p className="text-center text-[11px] text-grey-600">Paid from your KASH balance.</p>
          <p className="text-center text-[11px] text-grey-600">The displayed total is final. No added checkout fees.</p>
        </div>}
      </Sheet>
    </>
  );
}

export function StoreItemPage({ slug }: { slug: string }) {
  const item = useStoreItem(slug);
  const myOrder = useMyOrderFor(item.data?.id);
  useMarketView("store_item_viewed", { surface: "store_detail", entityType: "store_item", entityId: item.data?.id, source: typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("source") ?? undefined }, Boolean(item.data));

  if (item.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 lg:px-6">
        <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  if (item.isError) {
    return (
      <>
        <ColumnHeader title="Store" back />
        <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
          <ErrorState error={item.error} fallback="Couldn't load this listing." onRetry={() => item.refetch()} />
        </div>
      </>
    );
  }
  const data = item.data;

  return (
    <>
      {/* Pushed detail view: the sticky header carries the identity and the
          way back, so the listing itself opens straight onto its artwork. */}
      <ColumnHeader title={data.name} subtitle={data.tagline ?? undefined} back />

      <div className="mx-auto max-w-3xl px-4 py-5 lg:px-6">
      <GradientThumb seed={data.slug} glyph={CATEGORY_GLYPH[data.category]} className="aspect-[3/1] w-full rounded-2xl" />
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="ws-display text-2xl">{data.name}</h1>
          <p className="mt-1 text-[15px] text-meta">{data.tagline}</p>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-meta">
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
      <p className="mt-5 whitespace-pre-wrap text-[15px] leading-normal text-body">{data.description}</p>
      <dl className="ws-hair mt-5 grid gap-3 rounded-2xl border bg-white/[0.03] p-4 text-[13px] sm:grid-cols-2">
        <div><dt className="text-grey-600">Published by</dt><dd className="mt-1 font-semibold text-white">{data.ownerTeam}</dd></div>
        <div><dt className="text-grey-600">Availability</dt><dd className="mt-1 font-semibold text-white">{data.availability}</dd></div>
        <div className="sm:col-span-2"><dt className="text-grey-600">Support and entitlement</dt><dd className="mt-1 leading-relaxed text-grey-300">{data.supportPolicy}</dd></div>
      </dl>
      <div className="mt-6">
        <OrderCta item={data} />
      </div>
      </div>
    </>
  );
}

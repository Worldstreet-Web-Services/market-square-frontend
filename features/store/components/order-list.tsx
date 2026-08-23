"use client";

import Link from "next/link";
import { formatKash, relativeTime } from "@/lib/format";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMyOrders } from "@/features/store/hooks/use-store";
import { CATEGORY_GLYPH } from "@/features/store/lib/types";

// The store-purchase half of /tickets; the route composes it with the ticket
// wallet from the streams slice.
export function OrderList() {
  const orders = useMyOrders();

  return (
    <section>
      <h2 className="ws-display mb-3 text-lg">Store purchases</h2>
      {orders.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}
      {orders.isError && (
        <ErrorState error={orders.error} fallback="Couldn't load your purchases." onRetry={() => orders.refetch()} />
      )}
      {orders.isSuccess && orders.data.orders.length === 0 && (
        <EmptyState
          glyph="◈"
          title="No purchases yet"
          body="Anything you get from the ARK Store shows up here."
          action={
            <Link href="/store" className="text-sm font-semibold text-accent hover:underline">
              Browse the Store →
            </Link>
          }
        />
      )}
      <ul className="space-y-3">
        {orders.data?.orders.map((order) => (
          <li key={order.id} className="ws-card flex items-center gap-4 p-3">
            <GradientThumb
              seed={order.item?.slug ?? order.id}
              glyph={order.item ? CATEGORY_GLYPH[order.item.category] : undefined}
              className="h-14 w-14 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{order.item?.name ?? "Store item"}</p>
              <p className="text-xs text-grey-500">
                <span className="capitalize">{order.status}</span> · {formatKash(order.priceKash)} ·{" "}
                {relativeTime(order.createdAt)}
              </p>
            </div>
            {order.item && (
              <Link
                href={`/store/${order.item.slug}`}
                className="shrink-0 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-grey-200 transition-colors hover:bg-white/10"
              >
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import Link from "next/link";
import { formatKash, relativeTime } from "@/lib/format";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMyOrders } from "@/features/store/hooks/use-store";
import { IconStore } from "@/components/ui/icons";
import { CATEGORY_GLYPH } from "@/features/store/lib/types";

// The store-purchase half of /tickets; the route composes it with the ticket
// wallet from the streams slice.
export function OrderList() {
  const orders = useMyOrders();

  return (
    <section>
      <h2 className="ws-hair flex items-center gap-2 border-b px-4 py-3 text-[17px] font-bold text-heading">
        <IconStore className="h-5 w-5 text-accent" />
        Store purchases
      </h2>
      {orders.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}
      {orders.isError && (
        <div className="p-4">
          <ErrorState error={orders.error} fallback="Couldn't load your purchases." onRetry={() => orders.refetch()} />
        </div>
      )}
      {orders.isSuccess && orders.data.orders.length === 0 && (
        <div className="p-4">
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
        </div>
      )}
      <ul>
        {orders.data?.orders.map((order) => (
          <li key={order.id} className="ws-row flex items-center gap-3 px-4 py-3">
            <GradientThumb
              seed={order.item?.slug ?? order.id}
              glyph={order.item ? CATEGORY_GLYPH[order.item.category] : undefined}
              className="h-14 w-14 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-heading">{order.item?.name ?? "Store item"}</p>
              <p className="text-[13px] text-meta">
                <span className="capitalize">{order.status}</span> · {formatKash(order.priceKash)} ·{" "}
                {relativeTime(order.createdAt)}
              </p>
              <p className="tnum mt-1 text-[10px] text-grey-600">Receipt {order.id} · Support SUP-{order.id.toUpperCase()}</p>
            </div>
            {order.item && (
              <Link
                href={`/store/${order.item.slug}`}
                className="ws-press shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-sm font-bold text-body transition-colors hover:bg-white/10"
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

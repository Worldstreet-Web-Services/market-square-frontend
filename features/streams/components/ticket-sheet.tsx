"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatKash } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import { usePurchaseTicket, useTicketQuote } from "@/features/streams/hooks/use-streams";
import type { Stream, TicketTier } from "@/features/streams/lib/types";

// Quote first, then confirm — the quote sheet is the moment of truth for the
// price. Purchase re-POSTs are idempotent upstream, so retry is always safe.
export function TicketSheet({
  stream,
  open,
  onClose,
}: {
  stream: Stream;
  open: boolean;
  onClose: () => void;
}) {
  const tiers: Array<{ tier: TicketTier; price: string; label: string }> = [];
  if (stream.ticketPriceKash)
    tiers.push({ tier: "standard", price: stream.ticketPriceKash, label: "Standard" });
  if (stream.vipPriceKash) tiers.push({ tier: "vip", price: stream.vipPriceKash, label: "VIP" });

  const [tier, setTier] = useState<TicketTier>(tiers[0]?.tier ?? "standard");
  const quote = useTicketQuote(stream.id, tier, open && tiers.length > 0);
  const purchase = usePurchaseTicket(stream.id);

  return (
    <Sheet open={open} onClose={onClose} title="Get a ticket">
      <div className="space-y-4">
        <p className="text-sm text-grey-400">{stream.title}</p>

        {tiers.length > 1 && (
          <div className="ws-inset flex gap-1 p-1">
            {tiers.map((t) => (
              <button
                key={t.tier}
                onClick={() => setTier(t.tier)}
                className={cn(
                  "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
                  tier === t.tier ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
                )}
              >
                {t.label} · {formatKash(t.price)}
              </button>
            ))}
          </div>
        )}

        <div className="ws-inset flex items-center justify-between px-4 py-3">
          <span className="text-sm text-grey-400">Price</span>
          {quote.isPending ? (
            <Skeleton className="h-4 w-20" />
          ) : quote.data ? (
            <span className="tnum text-base font-bold">{formatKash(quote.data.priceKash)}</span>
          ) : (
            <span className="text-sm text-grey-500">—</span>
          )}
        </div>
        {quote.isError && (
          <InlineError error={quote.error} fallback="Couldn't fetch a price quote." />
        )}
        {purchase.isError && (
          <InlineError error={purchase.error} fallback="KASH payment failed — check your balance." />
        )}

        <Button
          className="w-full"
          size="lg"
          loading={purchase.isPending}
          disabled={!quote.data}
          onClick={() =>
            purchase.mutate(tier, {
              onSuccess: onClose,
            })
          }
        >
          {purchase.isError ? "Try again" : quote.data ? `Confirm · ${formatKash(quote.data.priceKash)}` : "Confirm"}
        </Button>
        <p className="text-center text-[11px] text-grey-600">
          Paid from your KASH balance. One tap, no gas, instant access.
        </p>
      </div>
    </Sheet>
  );
}

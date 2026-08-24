"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatKash } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

export interface LiveGift {
  id: string;
  emoji: string;
  name: string;
  priceKash: string;
  color: string;
}

export const LIVE_GIFTS: LiveGift[] = [
  { id: "rose", emoji: "🌹", name: "Rose", priceKash: "1", color: "#fb7185" },
  { id: "spark", emoji: "✨", name: "Spark", priceKash: "5", color: "#facc15" },
  { id: "fire", emoji: "🔥", name: "Fire", priceKash: "10", color: "#fb923c" },
  { id: "crown", emoji: "👑", name: "Crown", priceKash: "25", color: "#c084fc" },
  { id: "rocket", emoji: "🚀", name: "Rocket", priceKash: "50", color: "#22d3ee" },
  { id: "diamond", emoji: "💎", name: "Diamond", priceKash: "100", color: "#60a5fa" },
];

const QUANTITIES = [1, 5, 10] as const;

export function GiftSheet({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (gift: LiveGift, quantity: number) => void;
}) {
  const [selectedId, setSelectedId] = useState(LIVE_GIFTS[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  const selected = LIVE_GIFTS.find((gift) => gift.id === selectedId) ?? LIVE_GIFTS[0];
  const total = String(Number(selected.priceKash) * quantity);

  return (
    <Sheet open={open} onClose={onClose} title="Send a live gift">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {LIVE_GIFTS.map((gift) => (
            <button
              key={gift.id}
              onClick={() => setSelectedId(gift.id)}
              aria-pressed={selectedId === gift.id}
              className={cn(
                "ws-press flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-colors",
                selectedId === gift.id
                  ? "border-accent bg-accent/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
              )}
            >
              <span className="text-3xl" role="img" aria-label={gift.name}>{gift.emoji}</span>
              <span className="mt-1 text-xs font-semibold text-white">{gift.name}</span>
              <span className="tnum text-[11px]" style={{ color: gift.color }}>
                {formatKash(gift.priceKash)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-grey-400">Quantity</span>
          <div className="ws-inset flex gap-1 p-1">
            {QUANTITIES.map((value) => (
              <button
                key={value}
                onClick={() => setQuantity(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  quantity === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
                )}
              >
                ×{value}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            onSend(selected, quantity);
            onClose();
          }}
        >
          Send {selected.emoji} · {formatKash(total)}
        </Button>
        <p className="text-center text-[11px] text-grey-600">
          KASH settlement activates when live gifting is connected to the platform gateway.
        </p>
      </div>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { TipSheet, type LiveGift } from "@/features/streams/components/tip-sheet";

export function TipPreview() {
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState<{ gift: LiveGift; quantity: number } | null>(null);

  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm text-meta">
          Tip tray preview — dev only. {sent ? "" : "Pick a gift and send to see what it returns."}
        </p>
        {sent && (
          <p className="mt-2 text-sm text-heading">
            Sent {sent.gift.name} ×{sent.quantity} · {sent.gift.priceKash} KASH each
          </p>
        )}
        <button
          onClick={() => setOpen(true)}
          className="ws-btn-create ws-press mt-4 rounded-full px-5 py-2.5 text-sm font-bold"
        >
          Open the tray
        </button>
      </div>
      <TipSheet
        open={open}
        onClose={() => setOpen(false)}
        onSend={(gift, quantity) => setSent({ gift, quantity })}
      />
    </main>
  );
}

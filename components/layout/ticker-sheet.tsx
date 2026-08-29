"use client";

import { BuySheet } from "@/features/trade";
import { closeTicker, useTickerSelection } from "@/lib/ticker-store";

/**
 * The shell's global ticker sheet.
 *
 * Buying lives in the trade slice, but tapping a `$TICKER` is not a trade act —
 * it happens in a caption, and captions render on every surface in the app.
 * `components/layout/` is the documented place to join slices, so the shell
 * pulls `BuySheet` from the trade barrel and mounts exactly one of them, rather
 * than every post card owning a dialog it will almost never open.
 *
 * The same shape as `ComposeSheet`, and for the same reason: three unrelated
 * entry points, one sheet, opened in place so tapping a coin never costs the
 * reader the page they were on.
 */
export function TickerSheet() {
  // The store keeps the symbol after closing so the exit animation has
  // something to draw — which is why there is no mirror state here, and no
  // effect syncing one to the other.
  const { symbol, open, epoch } = useTickerSelection();
  if (!symbol) return null;

  return (
    // Keyed on the OPENING, not the symbol: reopening the same ticker is a new
    // purchase, and a sheet carrying a previous order's progress would show
    // somebody a finished transaction as though it were the one they just
    // started.
    <BuySheet key={epoch} symbol={symbol} open={open} onClose={closeTicker} />
  );
}

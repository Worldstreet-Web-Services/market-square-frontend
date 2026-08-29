"use client";

import { useSyncExternalStore } from "react";
import { normaliseTicker } from "@/lib/ticker";

/**
 * Which ticker's buy sheet is open — one answer for the whole app.
 *
 * ── WHY A STORE AND NOT A PROP ─────────────────────────────────────────────
 * A `$TICKER` can be tapped from anywhere a post body renders: the timeline, a
 * reel, a comment, a profile, the coin chips under a card. All of those go
 * through `components/ui/post-text.tsx`, which sits BELOW `features/` in the
 * import order and therefore cannot reach the trade slice — and threading an
 * `onTicker` callback through every surface that happens to render a caption
 * would be a prop nobody reads passing through a dozen components.
 *
 * So the shell owns the sheet and this is the doorbell. It is exactly the
 * pattern CLAUDE.md already describes for composing ("Composing is global, and
 * the shell owns it"): one `ComposeSheet` mounted in `AppShell`, opened in
 * place from three unrelated entry points.
 *
 * It is a module-level value behind `useSyncExternalStore`, not a context and
 * not a store library (CLAUDE.md: no global state manager) — the same shape
 * `lib/api/circuit-store.ts` and the stories rail's seen state already use.
 *
 * ── WHY THE EPOCH ──────────────────────────────────────────────────────────
 * The sheet holds an amount and, once a purchase starts, an order it is
 * following. Reopening it must start clean, and reopening the SAME ticker has
 * to count as a new opening — so the shell keys the sheet on this counter
 * rather than on the symbol. A sheet that reopened still holding a previous
 * order would show somebody a finished purchase as though it were theirs.
 */

export interface TickerSelection {
  /**
   * The last ticker opened — KEPT after it closes.
   *
   * `Sheet` animates out, and it cannot animate a dialog whose contents have
   * already been unmounted: dropping the symbol the instant it closed left the
   * panel blank for the length of the exit. So closing flips `open` and the
   * symbol stays, which also means the shell needs no mirror state of its own.
   */
  symbol: string | null;
  open: boolean;
  /** Increments on every opening, including a repeat of the same symbol. */
  epoch: number;
}

const CLOSED: TickerSelection = { symbol: null, open: false, epoch: 0 };

let snapshot: TickerSelection = CLOSED;
const listeners = new Set<() => void>();

function publish(next: TickerSelection) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/**
 * Open the buy sheet for a ticker.
 *
 * The symbol is CANONICALISED here rather than trusted: this is called from
 * post text, which is arbitrary content, and everything downstream — the
 * catalogue lookup, the route match, the payment's hold key — keys off it.
 * Something that is not a ticker opens nothing at all.
 */
export function openTicker(symbol: string): void {
  const canonical = normaliseTicker(symbol);
  if (!canonical) return;
  publish({ symbol: canonical, open: true, epoch: snapshot.epoch + 1 });
}

/**
 * Dismiss it.
 *
 * The symbol and the epoch both survive: the symbol so the exit animation has
 * something to draw, the epoch so the next opening is still counted as new.
 */
export function closeTicker(): void {
  if (!snapshot.open) return;
  publish({ ...snapshot, open: false });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Server snapshot: nothing is open during a server render, and the constant
 *  identity keeps hydration from seeing two different values. */
function serverSnapshot(): TickerSelection {
  return CLOSED;
}

export function useTickerSelection(): TickerSelection {
  return useSyncExternalStore(subscribe, () => snapshot, serverSnapshot);
}

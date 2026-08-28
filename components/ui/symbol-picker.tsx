"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anchorAbove, type AnchorPosition } from "@/lib/anchored-popover";
import { cn } from "@/lib/cn";
import { useTradeableMarkets, useTradeableSymbols } from "@/hooks/use-tradeable-symbols";

/**
 * The `$` tool: pick a coin, get a cashtag.
 *
 * Ark's composer has one, and a caption written there arrives here already
 * carrying tickers. Without the same tool, writing the same post on the square
 * meant knowing the exact symbol and typing it correctly — and a symbol typed
 * wrong is not marked up at all, so the mistake is invisible until it is
 * published.
 *
 * It only ever offers what the platform can actually trade, so a chosen ticker
 * always resolves. That is the same catalogue the renderer checks against, so
 * the tool cannot suggest something the post would then render as plain text.
 */
/** One number for the panel's width, shared by the render and the maths. */
const PANEL_W = 260;

export function SymbolPicker({ onPick }: { onPick: (fragment: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [at, setAt] = useState<AnchorPosition | null>(null);

  // Portalled and positioned in viewport coordinates, for the same reason as
  // the emoji picker beside it: inside the compose sheet, which scrolls its
  // body and hides its overflow, an absolutely positioned panel is sliced off
  // at the toolbar and spills past the sheet's edge.
  const place = useCallback(() => {
    const node = trigger.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setAt(
      anchorAbove({
        trigger: { left: rect.left, right: rect.right, top: rect.top },
        width: Math.min(PANEL_W, window.innerWidth - 24),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align: "left",
      })
    );
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const symbols = useTradeableSymbols();
  const markets = useTradeableMarkets();

  const results = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const rows = symbols.map((symbol) => ({
      symbol,
      name: markets.get(symbol)?.name ?? symbol,
    }));
    if (!needle) return rows.slice(0, 40);
    return rows
      .filter((row) => row.symbol.includes(needle) || row.name.toUpperCase().includes(needle))
      .slice(0, 40);
  }, [symbols, markets, query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      // The panel is portalled, so an outside tap has to miss BOTH it and the
      // trigger's wrapper.
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Focus the search rather than the list: people arrive knowing the coin.
    field.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // No catalogue, no tool. A picker that opens on an empty list is a dead end,
  // and the ticker would render as plain text anyway.
  if (symbols.length === 0) return null;

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Add a coin"
        aria-expanded={open}
        className={cn(
          "ws-press flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold transition-colors",
          open ? "bg-spotlight/30 text-spotlight-chip-ink" : "text-grey-400 hover:bg-white/10"
        )}
      >
        $
      </button>

      {open &&
        at &&
        createPortal(
        <div
          role="dialog"
          aria-label="Add a coin"
          ref={panel}
          style={{ left: at.left, bottom: at.bottom, width: PANEL_W }}
          className="ws-glass fixed z-[60] max-w-[calc(100vw-24px)] rounded-2xl p-2"
        >
          <input
            ref={field}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a coin"
            aria-label="Search a coin"
            className="ws-inset mb-1.5 w-full rounded-xl px-2.5 py-1.5 text-[12.5px] text-heading outline-none placeholder:text-grey-700"
          />
          <div className="max-h-56 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {results.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12px] text-meta">Nothing listed by that name.</p>
            ) : (
              results.map((row) => (
                <button
                  key={row.symbol}
                  type="button"
                  onClick={() => {
                    // A trailing space, so the next word is not swallowed into
                    // the ticker and quietly stop it matching.
                    onPick(`$${row.symbol} `);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                >
                  <span className="text-[12.5px] font-semibold text-spotlight-chip-ink">
                    ${row.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-meta">{row.name}</span>
                </button>
              ))
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}

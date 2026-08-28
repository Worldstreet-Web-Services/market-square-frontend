"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
export function SymbolPicker({ onPick }: { onPick: (fragment: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

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
      if (!root.current?.contains(event.target as Node)) setOpen(false);
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

      {open && (
        <div
          role="dialog"
          aria-label="Add a coin"
          className="ws-glass absolute bottom-full left-0 z-50 mb-2 w-[260px] rounded-2xl p-2"
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
        </div>
      )}
    </div>
  );
}

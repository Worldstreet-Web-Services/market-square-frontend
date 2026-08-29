"use client";

import { parsePostText } from "@/lib/post-segments";
import { arkAppConfigured } from "@/lib/deeplink";
import { openTicker } from "@/lib/ticker-store";
import { useTradeableMarkets, useTradeableSymbols } from "@/hooks/use-tradeable-symbols";

/**
 * The coins a post mentions, with what they are doing.
 *
 * The same row Ark draws under a post, for the same reason: on a finance
 * platform, "$ETH" and "$ETH, up 0.7% today" are different posts. The square
 * showed the first and Ark the second, which made one caption read as two.
 *
 * Deduplicated and capped: a post naming one coin six times is about one coin,
 * and a post listing twenty is not worth twenty chips — the row would outweigh
 * the words that earned it.
 */
const MAX_CHIPS = 4;

export function CoinChips({ text }: { text: string }) {
  const symbols = useTradeableSymbols();
  const markets = useTradeableMarkets();
  if (!text || symbols.length === 0 || !arkAppConfigured()) return null;

  const seen = new Set<string>();
  const shown = [];
  for (const segment of parsePostText(text, { tradeable: symbols })) {
    if (segment.kind !== "cashtag" || seen.has(segment.symbol)) continue;
    seen.add(segment.symbol);
    // No price, no chip. A chip is a claim about a number, and an empty one
    // says nothing the ticker in the text has not already said.
    const market = markets.get(segment.symbol);
    if (market) shown.push(market);
    if (shown.length >= MAX_CHIPS) break;
  }
  if (shown.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {shown.map((market) => {
        const up = market.change24h >= 0;
        return (
          <button
            key={market.symbol}
            type="button"
            // The same destination the ticker in the text now has. A caption
            // and the chip under it must not disagree about what tapping a
            // coin does — that difference is what made one post read as two
            // products.
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openTicker(market.symbol);
            }}
            aria-label={`Buy ${market.symbol}`}
            className="ws-press inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 transition-colors hover:bg-white/8"
          >
            <span className="text-[12.5px] font-semibold text-white">{market.symbol}</span>
            {/* Signed, always. "0.69%" and "+0.69%" read the same at a glance
                and only one of them is the answer. */}
            <span className={`tnum text-[12.5px] font-semibold ${up ? "text-up" : "text-down"}`}>
              {up ? "+" : "−"}
              {Math.abs(market.change24h).toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

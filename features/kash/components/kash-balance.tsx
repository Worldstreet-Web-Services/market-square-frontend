"use client";

import { useState } from "react";
import { formatKash } from "@/lib/format";
import { exceedsBalance } from "@/lib/kash-amount";
import { KashCoin } from "@/components/ui/kash-coin";
import { useKashAccount, useKashStatus } from "@/features/kash/hooks/use-kash";
import { KashBuySheet } from "@/features/kash/components/kash-buy-sheet";

/**
 * What the reader actually has, beside the thing they are about to spend.
 *
 * The tip sheet asked people to choose an amount without ever telling them
 * their balance — so the only way to discover you could not afford a tip was
 * to send it and read the failure. This is that number, plus a way to fix it
 * when it is short.
 *
 * ── WHY IT RENDERS NOTHING SO OFTEN ────────────────────────────────────────
 * Silence is the correct output in every unknown case, and there are several:
 * no wallet, the engine not deployed on this environment, the account read
 * failing. A balance line is a claim about somebody's money, and the one thing
 * it must never do is fill a gap with `0` — "we could not reach the engine"
 * and "you have nothing" look identical on screen and demand opposite
 * reactions. So an unknown balance shows no balance.
 *
 * The `status` read is what makes that cheap: it is public, wallet-free and
 * shared across every KASH surface, so all of them learn the engine is absent
 * from one cached request rather than each discovering it alone.
 */
export function KashBalance({
  /**
   * The amount the reader is about to spend, canonical, or null while they are
   * still typing. Used only to warn — never to block. The service is the only
   * thing that can actually refuse a spend, and a client-side veto based on a
   * balance that might be one poll stale would stop a tip that would have
   * worked.
   */
  amountKash,
  className,
}: {
  amountKash?: string | null;
  className?: string;
}) {
  const status = useKashStatus();
  const account = useKashAccount();
  const [buyOpen, setBuyOpen] = useState(false);
  const [opened, setOpened] = useState(0);

  // No wallet, no engine, or no answer: say nothing at all.
  if (!account.wallet || status.isError || account.isError) return null;

  const balance = account.data?.balance ?? null;
  const short = exceedsBalance(amountKash ?? null, balance);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KashCoin size={14} className="shrink-0" />
          {balance === null ? (
            // Loading. A dash, not a zero — the difference matters here more
            // than anywhere else in the app.
            <span className="text-[13px] text-white/30">Balance …</span>
          ) : (
            <span className="truncate text-[13px] text-white/50">
              You have{" "}
              <span className="tnum font-semibold text-white">{formatKash(balance)}</span>
              {account.data?.balanceUsd ? (
                // The engine's own valuation of the SAME balance it just
                // reported, never a figure derived here from a price.
                <span className="tnum text-white/30"> · ${account.data.balanceUsd}</span>
              ) : null}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setOpened((n) => n + 1);
            setBuyOpen(true);
          }}
          className="ws-press shrink-0 rounded-full border border-spotlight-chip-ink/60 px-3 py-1 text-[12px] font-semibold text-spotlight-chip-ink transition-colors hover:bg-spotlight/25"
        >
          Get KASH
        </button>
      </div>

      {/* A WARNING, not a disabled button. The balance can be a poll stale and
          the service is the only thing that can truly refuse a spend — vetoing
          here would block a tip that would have gone through. `exceedsBalance`
          never guesses either: an unknown balance produces no warning rather
          than a fabricated shortfall. */}
      {short && (
        <p role="status" className="mt-2 text-[13px] text-down">
          That&apos;s more than your balance. Get KASH first, or choose less.
        </p>
      )}

      {/* In the tree only once opened, and keyed on the opening so each one
          starts clean — the same discipline the tip sheet uses, and it matters
          more here: a sheet that reopened on a half-finished purchase is one
          tap from paying. */}
      {opened > 0 && (
        <KashBuySheet key={opened} open={buyOpen} onClose={() => setBuyOpen(false)} />
      )}
    </div>
  );
}

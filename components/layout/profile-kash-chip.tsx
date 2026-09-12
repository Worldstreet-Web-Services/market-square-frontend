"use client";

import Link from "next/link";
import { formatKash } from "@/lib/format";
import { useKashAccount, useKashStatus } from "@/features/kash";

/**
 * THE BALANCE CHIP ON A PROFILE COVER — node 435:27523.
 *
 * 94x24 at a full round over 10% white, 8 and 5 of padding, the amount at Geist
 * 600 12/14 and a chevron after it. The chevron is not decoration: it goes to
 * the Earnings tab further down this same page, which is where the balance
 * actually lives.
 *
 * ─── THE NUMBER IS THE ENGINE'S, AND IT IS YOURS ALONE ──────────────────────
 * It reads `useKashAccount`, which resolves the viewer's own embedded wallet —
 * so this appears on YOUR profile and nowhere else. There is no route that
 * answers "what is that person's balance", and there should not be: somebody
 * else's money is not a fact about them that a profile publishes.
 *
 * Absent rather than zero in every uncertain case — no wallet, no engine, no
 * answer yet. "0 KASH+" on a profile whose balance simply has not loaded is a
 * claim about somebody's money that the client cannot make.
 *
 * Composed in the layout layer because the profile slice may not import kash.
 */
export function ProfileKashChip() {
  const status = useKashStatus();
  const account = useKashAccount();

  if (!account.wallet || status.isError || account.isError) return null;
  const balance = account.data?.balance ?? null;
  if (balance === null) return null;

  return (
    <Link
      href="?tab=earnings"
      scroll={false}
      className="ws-press flex h-6 shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-[5px] transition-colors hover:bg-white/20"
    >
      <span className="tnum text-[12px] font-semibold leading-[14px] tracking-[-0.05px] text-white">
        {formatKash(balance)}
      </span>
      {/* 1097:23691 — the node's own chevron, 1.5 stroke at 60% white. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/profile/kash-chevron.svg" alt="" aria-hidden className="h-4 w-4 shrink-0" />
    </Link>
  );
}

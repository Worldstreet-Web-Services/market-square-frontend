"use client";

import Link from "next/link";
import { useState } from "react";
import { IconMic } from "@/components/ui/icons";
import { formatKash, relativeTime } from "@/lib/format";
import { LIVE_GIFTS } from "@/lib/gifts";
import { useKashAccount, useKashStatus, KashBuySheet } from "@/features/kash";
import { useReceivedTips } from "@/features/tips";

/**
 * THE EARNINGS PANEL — nodes 492:46239 (empty) and 492:46539 (populated).
 *
 * A gold balance card, then either the "No earnings yet" state or a
 * "Recently earned" list. Both states share the card; only what sits under it
 * changes, which is why they are one component and not two.
 *
 * ─── WHAT IS REAL, AND THE ONE THING THAT IS NOT ────────────────────────────
 * The BALANCE is the KASH engine's, through the same `useKashAccount` the
 * cover chip reads — not a second query and not a number assembled here.
 *
 * The LIST is `GET /me/tips/received`, whose own summary in the served spec is
 * "the caller's confirmed tips received (earnings)". This is the route that
 * panel was always going to need, and it already existed.
 *
 * THE FILE'S ROW NAMES THE SENDER — "Ellaine gifted you Tscion car!" — AND WE
 * CANNOT. A tip carries `fromUserId` and nothing else about the person, and
 * there is no route that turns a user id into a profile: `/profiles/{username}`
 * is keyed on the USERNAME, and the whole spec has no id lookup. So the row
 * says what is true — which gift arrived, what it was worth, when — and names
 * nobody. Inventing "Ellaine", or hydrating a face from an id we cannot
 * resolve, would put a stranger's name on somebody's money.
 *
 * For the same reason the row's source line ("Daily Devotion: Where Spiritual
 * Intelligence Begin") is absent: a tip carries `postId` at most, gifts sent
 * from a live room carry no post at all, and a title per row would be a fetch
 * per row for a string the payload does not have.
 *
 * Requested from the service: `fromUser` hydrated onto a tip, or a
 * profile-by-id route. The moment either lands the row gains its face and its
 * name and nothing else here changes.
 */

/** The gift a tip carried, resolved from the catalogue both send paths use. */
function giftOf(giftId: string | null) {
  return giftId ? (LIVE_GIFTS.find((gift) => gift.id === giftId) ?? null) : null;
}

/** 435:27558 — 741x62 at a 15 radius, 3% white behind a 10% hairline. */
function EarnedRow({
  amountKash,
  giftId,
  createdAt,
}: {
  amountKash: string;
  giftId: string | null;
  createdAt: string | null;
}) {
  const gift = giftOf(giftId);
  return (
    <li className="relative flex items-center gap-4 rounded-[15px] border border-white/10 bg-white/[0.03] px-4 py-[11px]">
      {/*
        THE DISC HOLDS THE GIFT, NOT A FACE.

        The file puts the sender's photograph here; we do not know who they
        are (see the module note), and a seeded avatar keyed on an
        unresolvable id would be a made-up face beside a real payment. The
        gift IS the thing that arrived, and we know exactly which one — so the
        disc carries it, and a plain tip with no gift stays empty rather than
        borrowing a picture.
      */}
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10">
        {gift && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gift.art} alt="" aria-hidden className="h-full w-full object-contain p-1" />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[12px] font-bold leading-4 text-white">
          {gift ? `You were gifted a ${gift.name}` : "You received a tip"}
        </p>
        {/* The amount and the file's own coin. The 18px node between this and
            the source line is an EMPTY text node — a spacer, drawn as
            nothing, which is why there is no separator character here. */}
        <span className="flex items-center gap-1">
          <span className="tnum text-[12px] leading-5 text-white/50">
            {formatKash(amountKash)}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gifts/coin-stack.svg" alt="" aria-hidden className="h-3 w-3 shrink-0" />
        </span>
      </div>

      {/* 435:27559 — top right, 16 and 16 in, not vertically centred. */}
      {createdAt && (
        <time
          dateTime={createdAt}
          className="absolute right-4 top-4 text-[10px] leading-[15px] text-white/50"
        >
          {relativeTime(createdAt)}
        </time>
      )}
    </li>
  );
}

export function ProfileEarnings() {
  const status = useKashStatus();
  const account = useKashAccount();
  const tips = useReceivedTips(true);
  const [buyOpen, setBuyOpen] = useState(false);

  // Only confirmed tips are earnings. The service's own words on `pending` are
  // that it "must never be presented to a user as though the money arrived",
  // and a failed tip moved nothing at all.
  const earned = (tips.data ?? [])
    .filter((tip) => tip.status === "confirmed")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const balance = account.data?.balance ?? null;
  const engineDown = !account.wallet || status.isError || account.isError;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      {/* 432:25745 — 741x112 at a 20 radius on the gold ramp. */}
      <div className="ws-kash-card flex items-center gap-4 rounded-[20px] px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/gifts/kash-balance-art.png"
          alt=""
          aria-hidden
          className="h-20 w-20 shrink-0 object-contain"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[16px] font-medium leading-6 text-white">Available balance</p>
          {/*
            `#6C2B09` — dark type on the gold, which is the only place in the
            app that inverts. The file sets Clash Display here; this repo does
            not load it and `ws-display` is the bold display face it does have,
            so the weight and the tracking carry rather than the face.

            ABSENT RATHER THAN ZERO, the same rule as the cover chip: "0 KASH+"
            on a balance that has simply not loaded is a claim about somebody's
            money that the client cannot make.
          */}
          <p className="ws-display truncate text-[32px] leading-[37.5px] !text-[#6C2B09]">
            {engineDown || balance === null ? "—" : formatKash(balance)}
          </p>
        </div>

        {/* 435:26851 — 131x34, `#F5F5F5` inside a THREE pixel 20%-white ring. */}
        <button
          type="button"
          onClick={() => setBuyOpen(true)}
          className="ws-press flex h-[34px] shrink-0 items-center gap-2 rounded-full border-[3px] border-white/20 bg-[#F5F5F5] px-4 text-[13px] font-semibold leading-5 text-[#0A0A0A] transition-opacity hover:opacity-90"
        >
          Buy KASH+
        </button>
      </div>

      {earned.length === 0 ? (
        /* 435:26118 — 486 wide, centred, 24 between each block. */
        <div className="mx-auto flex max-w-[486px] flex-col items-center gap-6 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gifts/earnings-empty.svg" alt="" aria-hidden className="h-[120px] w-[120px]" />
          <div className="flex flex-col gap-2">
            <h3 className="text-[20px] font-bold leading-[23.4px] text-white">No earnings yet</h3>
            {/* The file breaks this line itself, after "keep track". Kept as a
                soft wrap rather than a hard one: at our column width a forced
                break would land in the wrong place. */}
            <p className="text-[16px] leading-6 text-white/50">
              Once you start getting gifts from your loved ones, you can keep track of your history
              here
            </p>
          </div>
          {/*
            492:46825 — 213x48 on `--color-spotlight`, and the file draws FOUR
            children of which TWO are `visible: false`: the leading User avatar
            and the trailing ArrowRight. Only the mic and the label render, so
            only those are built.

            The CTA is a gist room because that is where gifts come from — the
            empty state points at the thing that would fill it, which is the
            one useful thing an empty state can do.
          */}
          <Link
            href="/gist-rooms"
            className="ws-press flex h-12 items-center gap-2.5 rounded-full bg-spotlight px-5 text-[16px] font-bold leading-[22px] text-white transition-opacity hover:opacity-90"
          >
            <IconMic className="h-6 w-6 shrink-0" />
            Start Gistroom
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <h3 className="text-[16px] leading-6 text-white/50">Recently earned</h3>
          <ul className="flex flex-col gap-4">
            {earned.map((tip) => (
              <EarnedRow
                key={tip.id}
                amountKash={tip.amountKash}
                giftId={tip.giftId}
                createdAt={tip.createdAt}
              />
            ))}
          </ul>
        </section>
      )}

      <KashBuySheet open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

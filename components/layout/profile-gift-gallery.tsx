"use client";

import { LIVE_GIFTS } from "@/lib/gifts";
import { useReceivedTips } from "@/features/tips";

/**
 * THE GIFT GALLERY — node 492:41810, the panel under the account strip.
 *
 * A grid of 129x160 tiles at a 15 radius on `--color-spotlight`, five to a row
 * and 24 apart, each holding the gift's artwork on a `#1C1C1C` plate, its KASH
 * price beside the coin, and how many of it this person has been sent.
 *
 * ─── WHAT IS REAL HERE, AND WHAT IS NOT ─────────────────────────────────────
 * THE CATALOGUE IS OURS. `LIVE_GIFTS` is the one list both places KASH changes
 * hands already read — the same fourteen objects, the same artwork, the same
 * prices, cheapest first. So the tiles are not invented content: they are the
 * gift tray, laid out as a gallery. Nothing is seeded.
 *
 * THE COUNTS ARE THE LEDGER'S, AND THEY ARE YOURS ALONE. `GET /me/tips/received`
 * answers the caller's own tips, each carrying the `giftId` that was chosen —
 * so counting them by gift is exactly "how many of this have I been sent".
 * There is no route that answers that about anybody else, which is why this is
 * an own-profile surface: on a visitor's view every tile would read zero, and a
 * grid of zeros is a claim about a stranger that we cannot make.
 *
 * ONLY `confirmed` TIPS ARE COUNTED. The service's own words on `pending` are
 * that it "must never be presented to a user as though the money arrived", and
 * a gift counted before it settles is exactly that. A tip that later fails
 * would otherwise have to be counted back down.
 *
 * A gift nobody has sent shows NO count rather than a zero — same rule as the
 * balance chip and the house member line. The file draws a "0" on two tiles;
 * that is a mock with mock data behind it, and it is the one place this
 * deliberately does not follow it.
 */

/** 485:40571 — a 16px white disc holding a 12px `+` in `--color-spotlight`. */
function AddGiftButton({ name, reason }: { name: string; reason: string }) {
  return (
    <button
      type="button"
      disabled
      title={reason}
      aria-label={`Send a ${name}`}
      className="grid h-4 w-4 shrink-0 cursor-not-allowed place-items-center rounded-full bg-white opacity-60"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path d="M6 2.625v6.75M2.625 6h6.75" stroke="#7E3BEB" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * WHY THE `+` IS INERT.
 *
 * It is a send control — the file puts it beside the count, on a gallery of
 * priced gifts — and sending a gift to a PROFILE has no route. The served spec
 * carries `/posts/{id}/tips`, `/streams/{id}/gifts` and both of their
 * `/transfer` steps, and nothing under `/profiles/{id}/tips`; the branch for it
 * in `sendTip` is a path the service has never answered. Worse, the settle
 * step is explicitly absent, so even a created profile tip could not be paid.
 *
 * So it renders, disabled, saying why — never a control that looks tappable
 * and quietly does nothing. It comes alive the day the two routes land.
 */
const NO_PROFILE_GIFTS = "Sending a gift straight to a profile isn't available yet";

export function ProfileGiftGallery() {
  /*
    NO `isMe` PROP, DELIBERATELY.

    It took one, and the call site passed a hardcoded `isMe` — a value that was
    only true because the profile page already refuses to mount this anywhere
    but your own profile. That is a lie waiting to come true: move the slot
    outside that gate and the prop still says "yes", so the component would ask
    `/me/tips/received` on a stranger's page and print YOUR gift counts under
    THEIR name.

    The gate belongs in one place, and it is the one that knows: the page,
    which compares the viewer's id to the profile's. Here the question is
    settled by construction, so the query is simply on.
  */
  const tips = useReceivedTips(true);

  const counts = new Map<string, number>();
  for (const tip of tips.data ?? []) {
    if (tip.status !== "confirmed" || !tip.giftId) continue;
    counts.set(tip.giftId, (counts.get(tip.giftId) ?? 0) + 1);
  }

  return (
    /*
      THE TILE IS A FIXED 129, AND THE GRID FITS AS MANY AS THE COLUMN HOLDS.
      543:42098 lays five across a 741 column (5 x 129 + 4 x 24 = 741 exactly).
      This used to be `lg:grid-cols-5`, which was right at 741 and wrong the day
      the column became 600: five cells in 488 of content squeezed every tile
      to 78 wide under a 160 height, and the gallery read as a row of purple
      slivers. `auto-fill` keeps the file's tile and its 24 gap and lets the
      count per row follow the width — three here, five at the file's.

      CENTRED. The file's five fill its 741 exactly, so there is no slack to
      place; three of ours leave 53 in a 488 column, and packed left that read
      as a grid hanging off one side. `justify-center` splits the slack, so
      the rows sit under the middle of the strip above them.
    */
    <div className="grid grid-cols-[repeat(auto-fill,129px)] justify-center gap-6 px-8 py-6">
      {LIVE_GIFTS.map((gift) => {
        const received = counts.get(gift.id) ?? null;
        return (
          <div
            key={gift.id}
            className="flex h-[160px] w-[129px] flex-col rounded-[15px] bg-spotlight p-1"
          >
            {/* 485:40486 — 121x120 at a 12 radius on `#1C1C1C`, and it CLIPS:
                the artwork is drawn larger than the plate and cropped by it. */}
            <div className="grid flex-1 place-items-center overflow-hidden rounded-[12px] bg-grey-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gift.art}
                alt={gift.name}
                // 543:42114 — the artwork is 98x119 on the 121x120 plate: one
                // pixel short of the plate's full height, centred, and NOT
                // inset. It shipped with 8px of padding on every side, which
                // shrank every gift by a fifth and left a ring of plate around
                // it that the file does not draw.
                className="h-[119px] w-auto max-w-full object-contain"
                loading="lazy"
              />
            </div>

            {/* The footer row: price left, count and the send control right,
                both inset 8 from the tile and 12 under the plate. */}
            {/*
              543:42115 / 543:42196 — the price and the count are a 16-tall
              row 12 under the plate, 8 in from the tile's sides and 8 above
              its foot (the tile's own 4 plus 4 here). It shipped as a 16px
              box carrying 12 + 4 of PADDING, which under border-box sizing
              leaves no room for the text at all: both labels overflowed the
              row and sat hard against the plate, and the space the file
              draws around them was gone. Margins keep the row 16 and the
              gaps outside it.
            */}
            <div className="mb-1 mt-3 flex h-4 items-center justify-between px-1">
              <span className="flex items-center gap-1">
                <span className="tnum text-[12px] font-bold leading-4 text-white">
                  {gift.priceKash}
                </span>
                {/* The file's own coin, exported rather than substituted — the
                    line-art `IconCoin` is a different object. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gifts/coin-stack.svg" alt="" aria-hidden className="h-3 w-3 shrink-0" />
              </span>

              <span className="flex items-center gap-1">
                {received !== null && (
                  <span className="tnum text-[12px] font-semibold leading-4 text-white">
                    {received}
                  </span>
                )}
                <AddGiftButton name={gift.name} reason={NO_PROFILE_GIFTS} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

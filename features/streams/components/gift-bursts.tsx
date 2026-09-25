"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LIVE_GIFTS, type LiveGift } from "@/lib/gifts";
import type { LiveGiftPacket } from "@/features/streams/hooks/use-live-reactions";

/**
 * GIFTS FLYING OVER A ROOM — the shared moment, drawn once for both rooms.
 *
 * This lived inline in `stream-room` and could not be reached from the gist
 * room, which is why a gist room had no gifts at all. It is lifted here rather
 * than copied, for the reason the house profile and the rail card were merged:
 * a second copy is how one of them ends up drawing a different burst for the
 * same packet.
 *
 * WHAT MAKES IT A GIFT RATHER THAN AN ANIMATION: the sender's name. TikTok's
 * whole gift moment is "NAME sent a Phoenix", and a burst nobody can attribute
 * is a screensaver — the host cannot thank anyone for it. So `from` is not
 * decoration, it is the payload, and it is drawn larger than the gift's own
 * name is.
 *
 * ONE PATH FOR BOTH DIRECTIONS. A gift you send and a gift that arrives on the
 * data channel go through the same `spawn`, so they cannot look different and
 * a local tap cannot double-draw against its own echo.
 */
export interface GiftBurst {
  id: number;
  gift: LiveGift;
  quantity: number;
  /** Who sent it — "You" on your own screen, their name on everyone else's. */
  from: string;
}

let seq = 0;

/** Three on screen at once; past that they stack into an unreadable pile. */
const MAX_ON_SCREEN = 3;
/** How long one burst stays up. Matches the `ws-gift-burst` keyframe. */
const BURST_MS = 3200;

export function useGiftBursts() {
  const [items, setItems] = useState<GiftBurst[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    []
  );

  const spawn = useCallback((gift: LiveGift, quantity: number, from: string) => {
    const burst: GiftBurst = { id: seq++, gift, quantity, from };
    setItems((current) => [...current.slice(-(MAX_ON_SCREEN - 1)), burst]);
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== burst.id));
      timers.current = timers.current.filter((id) => id !== timer);
    }, BURST_MS);
    timers.current.push(timer);
  }, []);

  /**
   * A packet off the wire. The id is resolved against OUR catalogue — a gift
   * this build has never heard of draws NOTHING rather than an empty frame,
   * because the sender is another browser and its build may be ahead of this
   * one. Artwork and prices never come off the wire for the same reason.
   */
  const receive = useCallback(
    ({ giftId, quantity, from }: LiveGiftPacket) => {
      const gift = LIVE_GIFTS.find((item) => item.id === giftId);
      if (!gift) return;
      spawn(gift, quantity, from);
    },
    [spawn]
  );

  return { items, spawn, receive };
}

/**
 * The overlay. `pointer-events-none` throughout so it never sits between the
 * reader and a control underneath it, and positioned by the caller's own
 * container rather than fixed to the viewport — a broadcast puts it over the
 * video, a gist room over the table.
 */
export function GiftBursts({ items }: { items: GiftBurst[] }) {
  if (items.length === 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[28%] z-30 flex flex-col items-center gap-3 px-4"
    >
      {items.map((burst) => (
        <div
          key={burst.id}
          className="ws-gift-burst flex items-center gap-3 rounded-full border border-white/20 bg-black/65 py-2 pl-3 pr-5 shadow-2xl backdrop-blur-md"
        >
          {/* The burst shows the gift that was actually sent, not a stand-in
              for it — the same artwork the tray offered. */}
          <span className="relative block h-9 w-9 shrink-0">
            <Image src={burst.gift.art} alt="" fill sizes="36px" className="object-contain" />
          </span>
          <span className="min-w-0">
            {/* "Gift sent" said nothing — every burst is a gift being sent.
                The SENDER is the information, and it is what lets a host thank
                somebody by name without stopping the room. */}
            <span className="block max-w-[160px] truncate text-xs font-semibold text-grey-300">
              {burst.from}
            </span>
            <span className="block text-sm font-bold text-white">
              {burst.gift.name}{" "}
              {burst.quantity > 1 && <span className="text-accent">×{burst.quantity}</span>}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

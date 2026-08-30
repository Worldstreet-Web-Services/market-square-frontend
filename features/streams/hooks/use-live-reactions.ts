"use client";

import { useCallback, useEffect, useRef } from "react";
import { RoomEvent, type Room } from "livekit-client";

/**
 * Floating reactions that everybody in the room actually sees.
 *
 * They used to be local decoration: a tap floated a heart on your own screen
 * and nobody else knew. That is the complaint — you react and the room stays
 * silent, so reacting stops feeling like being somewhere with other people.
 *
 * Sent over the room's DATA CHANNEL, not through an endpoint. A reaction is
 * ephemeral by nature: it means "right now, at this moment of the stream", and
 * a heart that arrives after a database round trip has already missed the
 * moment it was about. It also must not be stored — nobody wants to page
 * through the history of ten thousand hearts, and writing them would put a row
 * per tap into a table for something that is over in two seconds.
 *
 * LOSSY on purpose: dropped under congestion rather than queued. A late heart
 * is worse than no heart, and the video must never stall to deliver one.
 */
const TOPIC = "reaction";
const GIFT_TOPIC = "gift";

/** Cap what one sender can claim, so a crafted packet cannot flood a room. */
const MAX_BURST = 10;
/** A display name is a label, not prose — anything longer is a flood attempt. */
const MAX_NAME = 40;

/**
 * A gift somebody in the room just sent.
 *
 * Gifts ride the SAME data channel as hearts, and for the same reason: the
 * point of a gift on a live stream is the moment everyone sees it happen. It
 * used to be drawn locally and nowhere else — the sender saw their own phoenix
 * fly and the host, the person it was for, saw nothing at all. A gift only the
 * giver can see is not a gift, it is a screensaver.
 *
 * `giftId` is a catalogue key, never artwork or a price off the wire: the
 * sender is another browser, so it names WHICH gift and the receiver looks it
 * up locally. A peer that could hand us an image URL could point every screen
 * in the room at anything it liked.
 */
export interface LiveGiftPacket {
  giftId: string;
  quantity: number;
  from: string;
}

export interface LiveReactionsOptions {
  /** Called for reactions from OTHER people, with how many to draw. */
  onReceive: (burst: number) => void;
  /** Called for gifts from OTHER people. Absent on surfaces that draw none. */
  onGift?: (packet: LiveGiftPacket) => void;
}

export function useLiveReactions(room: Room | null, { onReceive, onGift }: LiveReactionsOptions) {
  // Held in a ref so re-rendering the room does not re-subscribe: a new
  // listener per render would draw one heart per render for every packet.
  const receive = useRef(onReceive);
  useEffect(() => {
    receive.current = onReceive;
  }, [onReceive]);
  const receiveGift = useRef(onGift);
  useEffect(() => {
    receiveGift.current = onGift;
  }, [onGift]);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      if (topic === GIFT_TOPIC) {
        try {
          const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
          if (typeof parsed !== "object" || parsed === null) return;
          const { giftId, quantity, from } = parsed as Record<string, unknown>;
          // Same rule as the burst above: a peer is not our server. The id is
          // resolved against the local catalogue by the caller, so an unknown
          // one draws nothing rather than an empty frame.
          if (typeof giftId !== "string" || giftId.length === 0 || giftId.length > 64) return;
          const count = Number(quantity);
          if (!Number.isFinite(count) || count < 1) return;
          receiveGift.current?.({
            giftId,
            quantity: Math.min(Math.floor(count), MAX_BURST),
            from: typeof from === "string" ? from.slice(0, MAX_NAME) : "Someone",
          });
        } catch {
          // A malformed packet is not worth surfacing to anyone.
        }
        return;
      }
      if (topic !== TOPIC) return;
      try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
        const burst =
          typeof parsed === "object" && parsed !== null && "burst" in parsed
            ? Number((parsed as { burst: unknown }).burst)
            : 1;
        // Anything a peer sends is untrusted: it is another browser, not our
        // server. Clamp rather than trust, or one participant can spray the
        // whole room's screens.
        if (!Number.isFinite(burst) || burst < 1) return;
        receive.current(Math.min(Math.floor(burst), MAX_BURST));
      } catch {
        // A malformed packet is not worth surfacing to anyone.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const react = useCallback(
    (burst = 1) => {
      const local = room?.localParticipant;
      if (!local) return;
      const capped = Math.min(Math.max(Math.floor(burst), 1), MAX_BURST);
      void local
        .publishData(new TextEncoder().encode(JSON.stringify({ burst: capped })), {
          reliable: false,
          topic: TOPIC,
        })
        // A reaction that does not send is not worth a message. The sender
        // already saw their own heart, and there is nothing to retry.
        .catch(() => {});
    },
    [room]
  );

  /**
   * RELIABLE, unlike a heart.
   *
   * A dropped heart is one of hundreds and nobody can tell. A dropped gift is
   * the single thing that viewer did all stream, aimed at the host — losing it
   * under congestion is losing the whole event. It is still ephemeral (nothing
   * is stored, and a late gift is never replayed), just not discardable.
   */
  const gift = useCallback(
    (giftId: string, quantity: number, from: string) => {
      const local = room?.localParticipant;
      if (!local) return;
      const capped = Math.min(Math.max(Math.floor(quantity), 1), MAX_BURST);
      void local
        .publishData(
          new TextEncoder().encode(
            JSON.stringify({ giftId, quantity: capped, from: from.slice(0, MAX_NAME) })
          ),
          { reliable: true, topic: GIFT_TOPIC }
        )
        .catch(() => {});
    },
    [room]
  );

  return { react, gift };
}

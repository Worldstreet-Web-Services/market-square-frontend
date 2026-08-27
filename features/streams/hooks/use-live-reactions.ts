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

/** Cap what one sender can claim, so a crafted packet cannot flood a room. */
const MAX_BURST = 10;

export interface LiveReactionsOptions {
  /** Called for reactions from OTHER people, with how many to draw. */
  onReceive: (burst: number) => void;
}

export function useLiveReactions(room: Room | null, { onReceive }: LiveReactionsOptions) {
  // Held in a ref so re-rendering the room does not re-subscribe: a new
  // listener per render would draw one heart per render for every packet.
  const receive = useRef(onReceive);
  useEffect(() => {
    receive.current = onReceive;
  }, [onReceive]);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
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

  return useCallback(
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
}

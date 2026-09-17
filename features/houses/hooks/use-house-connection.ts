"use client";

import { useEffect, useState } from "react";
import type { Room } from "livekit-client";
import { registerRoom, unregisterRoom } from "@/features/streams/lib/live-room";

/**
 * Listener-side connect, with nothing rendered.
 *
 * This is `LiveKitPlayer`'s connect effect, verbatim in behaviour: claim the
 * registry slot BEFORE connecting, narrate reconnects, and refuse to fight a
 * duplicate identity. What it does not do is render — `LiveKitPlayer` exists to
 * mount `LiveStage`, which is video all the way down (tile backdrops, fit
 * choices, screen-share branches, self-view mirroring), and importing it here
 * is precisely how a camera affordance comes back into a room that must never
 * have one.
 *
 * So the effect is copied and the component is not. That is a duplication, and
 * it is the cheaper of the two: the alternative is a shared component whose
 * every future change has to be checked against a surface with no video.
 *
 * ONE Room per stream, still. The registry (features/streams/lib/live-room.ts)
 * is the structural guard, and a house uses the same one — a host publishes on
 * the room it registers, a listener registers the room its playback token
 * opened, never two.
 */
export type HouseConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "failed"
  /**
   * The server evicted us because another connection joined with our identity.
   * Reconnecting would evict that one back, so this is terminal by design —
   * retrying IS the eviction loop.
   */
  | "duplicate";

export interface HouseConnection {
  room: Room | null;
  state: HouseConnectionState;
}

export function useHouseConnection({
  houseId,
  url,
  token,
  enabled,
}: {
  houseId: string;
  url: string;
  token: string;
  enabled: boolean;
}): HouseConnection {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<HouseConnectionState>("connecting");

  /*
    THE TOKEN IS FOR JOINING, NOT FOR STAYING.

    The playback token is short-lived and refetched before it expires, every
    few minutes. Keying the connect effect on `token` meant every refresh tore
    down a healthy room and connected again — an audible drop and a flash of
    "Connecting…" on a schedule (ogazboiz: "any small things it breaks"). A
    LiveKit connection keeps itself authorised once it is up; the SDK's own
    reconnects do not need our token.

    So the effect is keyed on `connectToken`, which takes the first token and
    then only a token that arrives after the connection has FAILED — that is
    the Retry path (a refetch hands a fresh token to a dead room). Adjusted
    during render, React's pattern for state that follows a prop.
  */
  const [connectToken, setConnectToken] = useState(token);
  if (token && token !== connectToken && (connectToken === "" || state === "failed")) {
    setConnectToken(token);
  }

  useEffect(() => {
    if (!enabled || !url || !connectToken) return;
    let room: Room | null = null;
    let cancelled = false;

    void import("livekit-client").then(async ({ Room, RoomEvent, DisconnectReason }) => {
      if (cancelled) return;
      // Announced here rather than in the effect body: a synchronous setState
      // on mount is a second render for a value the state already holds, and
      // on a retry after a failure it would flash "Connecting…" a render early.
      setState("connecting");
      // adaptiveStream is a video optimisation and there is no video here, but
      // it costs nothing and keeps the two connect paths identical rather than
      // subtly different for no stated reason.
      const instance = new Room({ adaptiveStream: true });
      room = instance;
      try {
        registerRoom(houseId, instance);
      } catch {
        setState("duplicate");
        room = null;
        return;
      }
      setRoom(instance);

      instance
        .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
        .on(RoomEvent.Reconnected, () => setState("live"))
        .on(RoomEvent.Disconnected, (reason) => {
          setState(reason === DisconnectReason.DUPLICATE_IDENTITY ? "duplicate" : "failed");
        });

      try {
        // autoSubscribe is the default and is load-bearing: when the host
        // approves somebody, the server-side publish grant pushes that person's
        // mic to us with no reconnect, no new token, and nothing to do here.
        await instance.connect(url, connectToken);
        if (cancelled) {
          void instance.disconnect();
          return;
        }
        setState("live");
      } catch {
        if (!cancelled) setState("failed");
      }
    });

    return () => {
      cancelled = true;
      setRoom(null);
      if (room) unregisterRoom(houseId, room);
      void room?.disconnect();
    };
  }, [houseId, url, connectToken, enabled]);

  return { room, state };
}

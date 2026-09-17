"use client";

import type { Room, RoomOptions } from "livekit-client";
import type { SessionRoom } from "@/lib/room-session/controller";
import { classifyDisconnect, type SessionTarget } from "@/lib/room-session/reducer";

/**
 * A gist room's LiveKit Room, built for the session the SHELL owns.
 *
 * This was `useHouseConnection`, a hook whose effect connected on mount and
 * disconnected on unmount — which is precisely why Back, a DM or a profile hung
 * up the call. It is now an imperative constructor the RoomSessionProvider
 * (components/layout/room-session.tsx) hands to the session controller
 * (lib/room-session/controller.ts). The controller decides WHEN to connect,
 * retry and tear down; this file only knows HOW a Room is made and which SDK
 * events mean what.
 *
 * Its rules are unchanged, and now tested behaviourally in
 * lib/room-session.test.ts:
 *   · the registry slot is claimed before connecting (the controller does it);
 *   · reconnects are narrated;
 *   · DUPLICATE_IDENTITY is terminal — retrying IS the eviction loop;
 *   · THE TOKEN IS FOR JOINING, NOT FOR STAYING: a refreshed token never
 *     reconnects a healthy room, only a failed one.
 *
 * Still no video anywhere: a host's Room carries the speech capture profile
 * and nothing else, and a listener's Room subscribes. That profile belongs to
 * the streams slice (`publisherRoomOptions`), and slices never import each
 * other — so the shell, which composes both, hands it in as `hostRoomOptions`.
 */
type HostRoomOptions = (
  livekit: Pick<typeof import("livekit-client"), "AudioPresets">,
  preferredMic?: string
) => RoomOptions;

export async function connectRoom(
  target: SessionTarget,
  { preferredMic, hostRoomOptions }: { preferredMic?: string; hostRoomOptions: HostRoomOptions }
): Promise<SessionRoom<Room>> {
  const livekit = await import("livekit-client");
  const { Room: RoomClass, RoomEvent, DisconnectReason } = livekit;
  const room =
    target.role === "host"
      ? new RoomClass(hostRoomOptions(livekit, preferredMic))
      : // adaptiveStream is a video optimisation and there is no video here,
        // but it costs nothing and keeps the paths identical to the player's.
        new RoomClass({ adaptiveStream: true });

  return {
    handle: room,
    // autoSubscribe is the default and is load-bearing: when the host approves
    // somebody, the server-side publish grant pushes that person's mic to us
    // with no reconnect, no new token, and nothing to do here.
    connect: (url, token) => room.connect(url, token),
    disconnect: () => room.disconnect(),
    listen(signals) {
      const onReconnecting = () => signals.reconnecting();
      const onReconnected = () => signals.reconnected();
      const onDisconnected = (reason?: number) =>
        signals.disconnected(classifyDisconnect(reason === undefined ? undefined : DisconnectReason[reason]));
      room.on(RoomEvent.Reconnecting, onReconnecting);
      room.on(RoomEvent.Reconnected, onReconnected);
      room.on(RoomEvent.Disconnected, onDisconnected);
      return () => {
        room.off(RoomEvent.Reconnecting, onReconnecting);
        room.off(RoomEvent.Reconnected, onReconnected);
        room.off(RoomEvent.Disconnected, onDisconnected);
      };
    },
  };
}

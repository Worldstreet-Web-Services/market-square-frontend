"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { Spinner } from "@/components/ui/button";
import { LiveStage } from "@/features/streams/components/live-stage";
import type { StageSlot } from "@/features/streams/lib/stage";
import { registerRoom, unregisterRoom } from "@/features/streams/lib/live-room";

type ViewerState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "failed"
  /**
   * The server evicted us because another connection joined with our identity.
   * Reconnecting would just evict that one back, so this state is terminal by
   * design and says what actually happened.
   */
  | "duplicate";

/**
 * Subscriber-side LiveKit playback.
 *
 * This component now owns only the CONNECTION: connect, narrate reconnects,
 * refuse to fight a duplicate identity, release the registry slot. What is on
 * screen is `LiveStage`, which derives its tiles from every participant with a
 * publish grant.
 *
 * It used to own the rendering too, and did it by attaching whatever arrived on
 * `TrackSubscribed`. That had two holes that together produced the reported
 * bug: nothing was ever attached for a track that had already been published
 * before the handler was registered, and a viewer's own "is anything playing"
 * check keyed off video, so an audio-only guest was neither seen nor heard.
 */
export function LiveKitPlayer({
  streamId,
  hostIdentity,
  url,
  token,
  onPlayingChange,
  onSourceAspect,
  fill = false,
  onRemoveGuest,
  removing,
}: {
  /** Claims this stream's single Room slot — see lib/live-room.ts. */
  streamId: string;
  /** The stream's ownerId: the identity that holds stage slot 0. */
  hostIdentity: string;
  url: string;
  token: string;
  onPlayingChange?: (playing: boolean) => void;
  /**
   * The shape of a solo publisher's video, forwarded straight from the stage.
   * The page above sizes its frame with it — see `stageFrameAspect`.
   */
  onSourceAspect?: (aspect: number | null) => void;
  /** Full-bleed mode: fills the parent instead of a rounded 16:9 box. */
  fill?: boolean;
  /** Host moderation, when the viewer owns the stream. Absent for everyone else. */
  onRemoveGuest?: (identity: string) => void;
  removing?: boolean;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<ViewerState>("connecting");
  const [publishers, setPublishers] = useState(0);
  const playingRef = useRef(onPlayingChange);
  useEffect(() => {
    playingRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;

    void import("livekit-client").then(async ({ Room, RoomEvent, DisconnectReason }) => {
      if (cancelled) return;
      const instance = new Room({ adaptiveStream: true });
      room = instance;
      // Claim the slot BEFORE connecting: if something else already holds it,
      // we must not put a second participant on this identity.
      try {
        registerRoom(streamId, instance);
      } catch {
        setState("duplicate");
        room = null;
        return;
      }
      setRoom(instance);

      instance
        .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
        .on(RoomEvent.Reconnected, () => setState("live"))
        // DisconnectReason.DUPLICATE_IDENTITY means someone connected as us.
        // The SDK does not retry this, and neither should we — an automatic
        // reconnect here is precisely the loop that killed the mobile
        // renderer. Name it instead.
        .on(RoomEvent.Disconnected, (reason) => {
          setState(reason === DisconnectReason.DUPLICATE_IDENTITY ? "duplicate" : "failed");
        });

      try {
        // autoSubscribe is the default and is load-bearing: a server-side
        // publish grant then pushes the new guest's tracks to us with no
        // reconnect, no new token and no action on our side.
        await instance.connect(url, token);
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
      if (room) unregisterRoom(streamId, room);
      void room?.disconnect();
    };
  }, [streamId, url, token]);

  // "Playing" is now anyone on stage sending media — a stage carrying only an
  // audio-only guest is still a live session and still earns a heartbeat.
  const onStageChange = useCallback((slots: StageSlot[]) => {
    const live = slots.filter((slot) => slot.state === "live").length;
    setPublishers(live);
    playingRef.current?.(live > 0);
  }, []);

  useEffect(() => () => playingRef.current?.(false), []);

  const overlay = state !== "live" || publishers === 0;

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden bg-[#0A0A0B]"
          : "relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0A0A0B]"
      }
    >
      <LiveStage
        room={room}
        hostIdentity={hostIdentity}
        onStageChange={onStageChange}
        onSourceAspect={onSourceAspect}
        onRemoveGuest={onRemoveGuest}
        removing={removing}
      />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
          {state === "connecting" && <Spinner className="h-8 w-8 text-grey-500" />}
          {state === "reconnecting" && (
            <>
              <Spinner className="h-6 w-6 text-grey-500" />
              <p className="text-xs text-grey-400">Reconnecting…</p>
            </>
          )}
          {state === "live" && publishers === 0 && (
            <p className="text-sm text-grey-400">The host&apos;s camera is off — hang tight.</p>
          )}
          {state === "failed" && (
            <>
              <p className="text-sm text-down">Couldn&apos;t connect to the stream.</p>
              <p className="text-xs text-grey-500">Refresh to try again.</p>
            </>
          )}
          {state === "duplicate" && (
            <>
              <p className="text-sm text-down">This stream is open somewhere else.</p>
              <p className="max-w-xs text-xs text-grey-500">
                You can only watch from one tab or device at a time. Close the other
                one and refresh.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

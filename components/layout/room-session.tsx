"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import { HouseAudioSinks, connectRoom, houseTopic } from "@/features/houses";
import {
  fetchPlaybackToken,
  getRoom,
  goLive,
  registerRoom,
  sendHeartbeat,
  startPublishing,
  subscribeRoom,
  unregisterRoom,
  useMySpeakerRequest,
  useResolveSpeakerRequest,
  useStage,
  useStream,
} from "@/features/streams";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
import { classifyCaptureError } from "@/lib/media-errors";
import { asRoomFailure, type RoomFailure } from "@/lib/room-connection-copy";
import { RoomSessionController, type SessionToken } from "@/lib/room-session/controller";
import { IDLE_SESSION, isHolding } from "@/lib/room-session/reducer";
import { REJOIN_KEY, parseRejoin, serializeRejoin, type RejoinRecord } from "@/lib/room-session/rejoin";
import { publishRoomSession, type RoomSessionView } from "@/lib/room-session-store";

/**
 * ONE ROOM PER TAB, OWNED BY THE SHELL.
 *
 * Mounted once, inside `AppShell`, which the root layout keeps alive across
 * every client navigation. A gist room's connection used to live in the room
 * page's effects, so Back, a DM, a profile — anything that unmounted the page —
 * hung up the call (the product owner's regression: winked back into a DM and
 * the room dropped). This is now the ONLY owner of:
 *
 *   · the LiveKit Room, through the session controller (lib/room-session/) and
 *     still registered in features/streams/lib/live-room.ts, the one-Room guard;
 *   · the host's publisher (go-live, then the mic — OPEN only on the host's own
 *     fresh open, MUTED after a reload, a retry or a reconnect);
 *   · the listener's connection and the 15 s heartbeat, for every role;
 *   · the seated guest's stage (`useStage` — which never opens a mic by itself
 *     here: no intent is passed, so every speaker taps to talk);
 *   · the remote audio sinks, in a hidden div;
 *   · the stream poll (10 s, to notice the room ending off-route) and the
 *     speaker-request poll (8 s);
 *   · media-session metadata and hang-up, autoplay recovery ("Tap to listen"),
 *     and tab close.
 *
 * The room VIEW (features/houses/components/house-room.tsx) and the
 * mini-player only read `lib/room-session-store.ts` and call its verbs.
 * Unmounting either never disconnects anything. The cadences that exist only
 * to paint (the level pump, the speaking sweep, the hand tick) live in the view
 * and so run only while the room is on screen.
 *
 * Only these end a session: Leave / Close, the mini-player's hang-up, the room
 * ending, removal, a duplicate identity (terminal), logout and tab close.
 */
const ENDED_DISMISS_MS = 5_000;

/** The captures that mean "your microphone", as opposed to the network. */
const MIC_FAILURES = new Set(["denied", "device-busy", "device-missing"]);

/*
  The rejoin record, behind a `useSyncExternalStore` so the chip is read from
  storage without an effect and without a server/client mismatch (the server
  snapshot is null). sessionStorage can throw (private mode, storage off); a
  lost chip is not worth a crash.
*/
let rejoinCache: RejoinRecord | null | undefined;
const rejoinListeners = new Set<() => void>();

function readRejoin(): RejoinRecord | null {
  if (rejoinCache === undefined) {
    try {
      rejoinCache = parseRejoin(window.sessionStorage.getItem(REJOIN_KEY));
    } catch {
      rejoinCache = null;
    }
  }
  return rejoinCache;
}

function writeRejoin(record: RejoinRecord | null) {
  try {
    if (record) window.sessionStorage.setItem(REJOIN_KEY, serializeRejoin(record));
    else window.sessionStorage.removeItem(REJOIN_KEY);
  } catch {
    // As above.
  }
  const current = readRejoin();
  if (current?.streamId === record?.streamId && current?.title === record?.title) return;
  rejoinCache = record;
  for (const listener of rejoinListeners) listener();
}

function subscribeRejoin(listener: () => void) {
  rejoinListeners.add(listener);
  return () => {
    rejoinListeners.delete(listener);
  };
}

function playbackToken(grant: Awaited<ReturnType<typeof fetchPlaybackToken>>): SessionToken {
  return { url: grant.url, token: grant.token, expiresAt: grant.expiresAt, captionUrl: grant.captionUrl };
}

export function RoomSessionProvider({ children }: { children: React.ReactNode }) {
  /*
    The host's publish outcome reaches React through this ref: the controller
    outlives renders and its deps are fixed at construction.
  */
  const onPublishRef = useRef<(failure: RoomFailure | null) => void>(() => {});

  const [controller] = useState(
    () =>
      new RoomSessionController<Room>({
        createRoom: (target, options) => connectRoom(target, options),
        fetchToken: async (target) => {
          if (target.role === "host") {
            // go-live is idempotent by design: a host who reloads a live room
            // gets a fresh publisher token for the room they never left.
            const result = await goLive(target.streamId);
            if (!result.ingest?.url || !result.ingest.roomToken) {
              throw new Error("The gist room has no audio connection yet.");
            }
            return { url: result.ingest.url, token: result.ingest.roomToken };
          }
          return playbackToken(await fetchPlaybackToken(target.streamId));
        },
        sendHeartbeat: (streamId, sessionId) => sendHeartbeat(streamId, sessionId, "live"),
        // BACKEND B3: there is no `/leave` route yet, so a closed tab lapses
        // out of the count on the missed heartbeats. The call site is kept so
        // the beacon is one line when the route ships.
        sendLeaveBeacon: () => {},
        clock: {
          setInterval: (callback, ms) => window.setInterval(callback, ms),
          clearInterval: (handle) => window.clearInterval(handle as number),
        },
        register: registerRoom,
        unregister: unregisterRoom,
        afterConnect: async (room, target, { resumed }) => {
          if (target.role !== "host") return;
          try {
            await startPublishing(room.handle, { micOn: !resumed });
            onPublishRef.current(null);
          } catch (error) {
            onPublishRef.current(asRoomFailure(classifyCaptureError(error)));
          }
        },
      })
  );

  const state = useSyncExternalStore(controller.subscribe, controller.getState, () => IDLE_SESSION);
  const target = state.target;
  const streamId = target?.streamId ?? "";
  const holding = isHolding(state.connection);
  const isHost = target?.role === "host";

  const room = useSyncExternalStore(
    useCallback((listener) => (streamId ? subscribeRoom(streamId, listener) : () => {}), [streamId]),
    useCallback(() => (streamId ? getRoom(streamId) : null), [streamId]),
    () => null
  );

  const [publishFailure, setPublishFailure] = useState<RoomFailure | null>(null);
  useEffect(() => {
    onPublishRef.current = setPublishFailure;
  }, []);

  /* ---- the polls ------------------------------------------------------ */

  const stream = useStream(streamId, 10_000, Boolean(streamId) && holding);
  const mine = useMySpeakerRequest(streamId, holding && !isHost);
  const resolve = useResolveSpeakerRequest(streamId);
  const approved = mine.data?.status === "approved";

  // The room ended while the reader was somewhere else. ROOM_DELETED says the
  // same thing from the SDK; whichever arrives first ends the session.
  const status = stream.data?.status;
  useEffect(() => {
    if (!holding) return;
    if (status === "ended" || status === "cancelled") controller.onRoomEnded();
  }, [controller, holding, status]);

  // "Room ended" is said, then cleared.
  useEffect(() => {
    if (state.connection !== "ended") return;
    const timer = setTimeout(() => controller.dismiss(), ENDED_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [controller, state.connection]);

  /* ---- the stage ------------------------------------------------------ */

  /*
    The host counts as approved: their token carries the grant, and an
    unapproved stage turns the local mic OFF. No `consumeIntent` — nobody's
    mic is opened for them in a gist room.
  */
  const stage = useStage({
    streamId,
    approved: isHost || approved,
    withCamera: false,
  });

  const presence: RoomSessionView["presence"] = !target
    ? null
    : isHost
      ? "host"
      : approved && stage.state === "live"
        ? "speaker"
        : "listener";

  const stageFailure = MIC_FAILURES.has(stage.state) ? asRoomFailure(stage.state) : null;
  const micFailure = isHost ? (stageFailure ?? publishFailure) : null;

  /* ---- the shell's "you're live" -------------------------------------- */

  useEffect(() => {
    if (!isHost || state.connection !== "live") return;
    setBroadcastLive(streamId);
    return () => setBroadcastLive(null);
  }, [isHost, state.connection, streamId]);

  /* ---- autoplay -------------------------------------------------------- */

  const [canPlayAudio, setCanPlayAudio] = useState(true);
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      const sync = () => setCanPlayAudio(room.canPlaybackAudio);
      room.on(RoomEvent.AudioPlaybackStatusChanged, sync);
      off = () => room.off(RoomEvent.AudioPlaybackStatusChanged, sync);
      sync();
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [room]);
  const startAudio = useCallback(() => {
    void room?.startAudio().catch(() => undefined);
  }, [room]);

  /* ---- tap to rejoin after a reload ------------------------------------ */

  /*
    The record IS the offer: it is written while a room is held, and the
    mini-player only offers it back while the session is idle — which, with a
    record still standing, means a reload interrupted the room.
  */
  const rejoinOffer = useSyncExternalStore(subscribeRejoin, readRejoin, () => null);
  const liveTitle = state.connection === "live" && stream.data ? houseTopic(stream.data) : null;
  useEffect(() => {
    if (!liveTitle || !streamId) return;
    writeRejoin({ streamId, title: liveTitle });
  }, [liveTitle, streamId]);
  // The room ending, or another tab taking it, is not something to offer back.
  useEffect(() => {
    if (state.connection === "ended" || state.connection === "duplicate") writeRejoin(null);
  }, [state.connection]);
  const dismissRejoin = useCallback(() => writeRejoin(null), []);

  /* ---- verbs ----------------------------------------------------------- */

  const requestId = mine.data && (mine.data.status === "approved" || mine.data.status === "pending") ? mine.data.id : null;
  const leave = useCallback(async () => {
    // A seated person frees their seat on the way out, and a raised hand comes
    // down, so the host's tray never holds somebody who has gone.
    if (requestId) resolve.mutate({ requestId, action: "leave" });
    writeRejoin(null);
    await controller.leave();
  }, [controller, requestId, resolve]);

  const enter = useCallback<RoomSessionView["enter"]>(
    (id, role, options) => {
      void controller.enter(id, role, options);
    },
    [controller]
  );

  /* ---- tab close and the OS media controls ----------------------------- */

  useEffect(() => {
    const onPageHide = () => controller.pageHide();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [controller]);

  const topic = stream.data ? houseTopic(stream.data) : null;
  const host = stream.data?.owner?.displayName ?? null;
  useEffect(() => {
    if (!holding || !topic || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({ title: topic, artist: host ?? "Gist room" });
      session.setActionHandler("hangup" as MediaSessionAction, () => void leave());
    } catch {
      // An action this browser does not know is not worth failing over.
    }
    return () => {
      try {
        session.metadata = null;
        session.setActionHandler("hangup" as MediaSessionAction, null);
      } catch {
        // As above.
      }
    };
  }, [holding, topic, host, leave]);

  /* ---- publish --------------------------------------------------------- */

  const view = useMemo<RoomSessionView>(
    () => ({
      state,
      room,
      stream: stream.data ?? null,
      presence,
      micOn: stage.micOn,
      micDisabled: !room || !stage.canPublishMic,
      toggleMic: stage.toggleMic,
      micFailure,
      stage: { state: stage.state, error: stage.error, retry: stage.retry, rejoin: () => void controller.reconnect() },
      captionUrl: controller.token?.captionUrl ?? null,
      canPlayAudio,
      startAudio,
      enter,
      leave,
      end: () => {
        writeRejoin(null);
        return controller.end();
      },
      // Sign-out: a host's connection comes down (closing the room stays an
      // explicit act); anyone else leaves properly, freeing a held seat while
      // the session that authorises that call still exists.
      logout: () => {
        writeRejoin(null);
        return isHost ? controller.logout() : leave();
      },
      confirmConflict: () => controller.confirmConflict(),
      dismissConflict: () => controller.dismissConflict(),
      dismiss: () => {
        writeRejoin(null);
        controller.dismiss();
      },
      retry: () => void controller.retry(),
      rejoinOffer,
      dismissRejoin,
    }),
    [
      state,
      room,
      stream.data,
      presence,
      stage.micOn,
      stage.canPublishMic,
      stage.toggleMic,
      stage.state,
      stage.error,
      stage.retry,
      micFailure,
      controller,
      canPlayAudio,
      startAudio,
      enter,
      leave,
      rejoinOffer,
      dismissRejoin,
      isHost,
    ]
  );

  // Layout effect: published before any child's passive effect can read it,
  // so a room view mounting in the same commit never calls the idle no-ops.
  useLayoutEffect(() => {
    publishRoomSession(view);
  }, [view]);

  return (
    <>
      {children}
      {/* The audio itself, outside every route. Mounted from its own map so it
          can never become conditional on anything visual. */}
      {room && stream.data && (
        <HouseAudioSinks room={room} streamId={streamId} ownerId={stream.data.ownerId} />
      )}
    </>
  );
}

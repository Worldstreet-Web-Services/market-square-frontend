"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import { HouseAudioSinks, connectRoom, houseTopic } from "@/features/houses";
import {
  fetchPlaybackToken,
  getRoom,
  goLive,
  publisherRoomOptions,
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
import { useAuth } from "@/hooks/use-auth";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
import { classifyCaptureError } from "@/lib/media-errors";
import { asRoomFailure, type RoomFailure } from "@/lib/room-connection-copy";
import { RoomSessionController, type SessionToken } from "@/lib/room-session/controller";
import { mediaSessionMetadata } from "@/lib/room-session/media-session";
import { stagePresence } from "@/lib/room-session/presence";
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
  return { url: grant.url, token: grant.token, captionUrl: grant.captionUrl };
}

/*
  ONE CONTROLLER PER PAGE, NOT PER MOUNT.

  The provider is mounted once, but "once" is not "forever": a render error
  that reaches app/global-error.tsx replaces the root layout, and a hot reload
  of the shell remounts it. A controller held in component state died with
  that mount while its Room, its heartbeat and its registry entry lived on —
  an open mic with no mini-player, and the room reporting "open somewhere
  else" in the very tab that held it. Held here, a remounted provider adopts
  the live session instead. The server builds a throwaway per render: a module
  singleton there would be shared between requests.
*/
const publishOutcome: { current: (failure: RoomFailure | null) => void } = { current: () => {} };
let sharedController: RoomSessionController<Room> | null = null;

function sessionController(): RoomSessionController<Room> {
  if (typeof window === "undefined") return createController();
  sharedController ??= createController();
  return sharedController;
}

function createController(): RoomSessionController<Room> {
  const onPublishRef = publishOutcome;
  return new RoomSessionController<Room>({
    // The host's speech profile is the streams slice's; the houses slice
    // builds the Room. Composed here, where both may be imported.
    createRoom: (target, options) => connectRoom(target, { ...options, hostRoomOptions: publisherRoomOptions }),
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
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (handle) => window.clearTimeout(handle as number),
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
  });
}

export function RoomSessionProvider({ children }: { children: React.ReactNode }) {
  const [controller] = useState(sessionController);

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
    publishOutcome.current = setPublishFailure;
  }, []);

  /* ---- the polls ------------------------------------------------------ */

  // Not once the automatic retries have given up: nothing is connected, and a
  // request that fails for a reason no retry fixes (a private room's 403) must
  // not go on polling from every page of the tab. A Retry, the network or the
  // tab coming back starts them again with the connect.
  const polling = holding && !state.retriesExhausted;
  const stream = useStream(streamId, 10_000, Boolean(streamId) && polling);
  const mine = useMySpeakerRequest(streamId, polling && !isHost);
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

  // Seated is the approval AND the mic grant — a failed tap to talk does not
  // hand the seat back (lib/room-session/presence.ts).
  const presence: RoomSessionView["presence"] = stagePresence({
    role: target?.role ?? null,
    approved,
    stageState: stage.state,
    canPublishMic: stage.canPublishMic,
  });

  const stageFailure = MIC_FAILURES.has(stage.state) ? asRoomFailure(stage.state) : null;
  /*
    The go-live publish failure is about a mic that could not be opened; once
    it IS open the banner has nothing left to say. Adjusted during render,
    React's pattern for state that follows another value.
  */
  if (stage.micOn && publishFailure) setPublishFailure(null);
  const micFailure = isHost ? (stageFailure ?? publishFailure) : null;
  // The banner's Try again: an explicit OPEN, never the toggle — a second tap
  // on a toggle mutes the host under a banner saying the mic would not open.
  const stageRetry = stage.retry;
  const retryMic = useCallback(() => {
    setPublishFailure(null);
    stageRetry();
  }, [stageRetry]);

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

  /*
    "Leave and join" is a LEAVE of the room being left, and does what every
    other leave does: the seat or the raised hand in it comes down, and the
    rejoin record stops pointing at it. After the switch the streamId is the
    new room's, so this is the last moment the old request can be reached.
  */
  const confirmConflict = useCallback(async () => {
    if (!state.pending) return;
    if (requestId) resolve.mutate({ requestId, action: "leave" });
    writeRejoin(null);
    await controller.confirmConflict();
  }, [controller, requestId, resolve, state.pending]);

  // Stable: the room view clears its own question in an effect cleanup, and a
  // new function per render would run that cleanup — and dismiss the question
  // — on every state change while it is open.
  const dismissConflict = useCallback((id?: string) => controller.dismissConflict(id), [controller]);

  /* ---- signed out by any route ----------------------------------------- */

  /*
    useLogout brings the room down before it signs out. Everything else that
    ends the account — the /auth page's button, Privy's session expiring, a
    sign-out in another tab — reaches this only as `authenticated` going
    false, and the room must not go on talking for a signed-out browser (or
    the next person in it). By then there is no session to free a seat with;
    the connection comes down and the rejoin record goes.

    BACKEND B5: A SEAT HELD THROUGH A SIGN-OUT NOBODY PRESSED IS NOT FREED
    HERE. Every sign-out that goes through a button (the shell's menus, the
    /auth page) runs useLogout, which leaves the room — freeing the seat —
    while the token still exists. Privy's session expiring, or a sign-out in
    another tab, is only seen after the token is gone: the leave call would be
    refused, and its error toast would land on a signed-out reader. Until the
    service releases a speaker request whose holder has left the LiveKit room
    (the participant-left webhook) or stopped heartbeating, that seat stays in
    the host's tray until the host removes it.
  */
  const auth = useAuth();
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (!auth.ready) return;
    if (auth.authenticated) {
      wasAuthenticated.current = true;
      return;
    }
    if (!wasAuthenticated.current) return;
    wasAuthenticated.current = false;
    writeRejoin(null);
    void controller.logout();
  }, [auth.ready, auth.authenticated, controller]);

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

  /*
    A FAILED ROOM COMES BACK BY ITSELF. The controller retries on a capped
    backoff; the network returning, or the tab coming back into view, is the
    moment most likely to work, so those retry at once.
  */
  useEffect(() => {
    const onOnline = () => void controller.onNetworkBack();
    const onVisible = () => {
      if (document.visibilityState === "visible") void controller.onNetworkBack();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [controller]);

  // A private room is named neutrally wherever the OS shows what is playing.
  const metadata = stream.data ? mediaSessionMetadata(stream.data) : null;
  const metaTitle = metadata?.title ?? null;
  const metaArtist = metadata?.artist ?? null;
  useEffect(() => {
    if (!holding || !metaTitle || !metaArtist || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({ title: metaTitle, artist: metaArtist });
    } catch {
      // A browser without MediaMetadata is not worth failing over.
    }
    try {
      session.setActionHandler("hangup" as MediaSessionAction, () => void leave());
    } catch {
      // An action this browser does not know is not worth failing over.
    }
    return () => {
      try {
        session.metadata = null;
      } catch {
        // As above.
      }
      try {
        session.setActionHandler("hangup" as MediaSessionAction, null);
      } catch {
        // As above.
      }
    };
  }, [holding, metaTitle, metaArtist, leave]);

  /*
    THE LOCK SCREEN'S PAUSE NEVER LEAVES A MIC OPEN. Without a handler the
    browser's pause silences the incoming audio and nothing else — to the
    reader it feels like they left, while their mic goes on publishing. With
    the mic open, pause MUTES it (the room keeps playing, which is honest). A
    muted or listening reader gets the browser's own pause back.
  */
  const hotMic = holding && (isHost || presence === "speaker") && stage.micOn;
  const toggleMic = stage.toggleMic;
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession as MediaSession & { setMicrophoneActive?: (active: boolean) => void };
    try {
      session.setMicrophoneActive?.(hotMic);
    } catch {
      // As above.
    }
    if (!hotMic) return;
    try {
      session.setActionHandler("pause", () => void toggleMic());
    } catch {
      // As above.
    }
    return () => {
      try {
        session.setActionHandler("pause", null);
        session.setMicrophoneActive?.(false);
      } catch {
        // As above.
      }
    };
  }, [hotMic, toggleMic]);

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
      stage: { state: stage.state, error: stage.error, retry: retryMic, rejoin: () => void controller.reconnect() },
      // The live room's own captions, never the previous room's while the next connects.
      captionUrl: controller.captionUrl,
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
      confirmConflict,
      dismissConflict,
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
      retryMic,
      micFailure,
      controller,
      canPlayAudio,
      startAudio,
      enter,
      leave,
      confirmConflict,
      dismissConflict,
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

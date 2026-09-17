"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import { serverClockOffset } from "@/lib/server-clock";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HouseAudioSinks, connectRoom, houseTopic } from "@/features/houses";
import {
  fetchPlaybackToken,
  getRoom,
  goLive,
  publisherRoomOptions,
  registerRoom,
  releaseCapture,
  sendHeartbeat,
  startPublishing,
  stopPublishing,
  subscribeRoom,
  unregisterRoom,
  useAnswerInvite,
  useMySpeakerRequest,
  useResolveSpeakerRequest,
  useEndStream,
  useStage,
  useStream,
} from "@/features/streams";
import { useAuth } from "@/hooks/use-auth";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
import { classifyCaptureError } from "@/lib/media-errors";
import { asRoomFailure, type RoomFailure } from "@/lib/room-connection-copy";
import { RoomSessionController, type SessionToken } from "@/lib/room-session/controller";
import { mediaSessionMetadata, osHangUpAllowed, sharedSurfaceTitle } from "@/lib/room-session/media-session";
import { stagePresence } from "@/lib/room-session/presence";
import { IDLE_SESSION, isHolding } from "@/lib/room-session/reducer";
import { REJOIN_KEY, parseRejoin, rejoinOfferFor, serializeRejoin, type RejoinRecord } from "@/lib/room-session/rejoin";
import { useMe } from "@/hooks/use-me";
import { publishRoomSession, type RoomSessionView } from "@/lib/room-session-store";
import { MARKET_FLAGS } from "@/lib/market-config";
import {
  INITIAL_INVITE_ANNOUNCER,
  createAnswerLatch,
  inviteView,
  liveInviteRow,
  createInflightAnswers,
  releaseOnLeave,
  type ReleasableRow,
  stepInviteAnnouncer,
  type InviteAnnouncerState,
} from "@/lib/speaker-invite";
import { HOST_MUTE_TOAST, INITIAL_HOST_MUTE_TOAST, hostMuteOf, hostMuteToken, stepHostMuteToast } from "@/lib/host-mute";
import { speakerSignalOf, userTopic } from "@/lib/ws-gateway";
import { sharedGateway } from "@/lib/ws-gateway-shared";
import { AboveModals } from "@/components/ui/modal-layer";

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
 *   · media-session metadata and hang-up, autoplay recovery ("Listen"),
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
  if (
    current?.streamId === record?.streamId &&
    current?.title === record?.title &&
    current?.userId === record?.userId
  ) {
    return;
  }
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
/*
  The end-stream call a host's switch runs before it lets go of their room.
  The mounted provider points it at `useEndStream` (the toast, the cache).
  Until then it refuses: a switch that cannot close the room must not happen.
*/
const closeRoomCall: { current: (streamId: string) => Promise<void> } = {
  current: () => Promise.reject(new Error("The gist room could not be closed.")),
};
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
    closeRoom: (streamId) => closeRoomCall.current(streamId),
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
    afterConnect: async (room, target, { resumed, isCurrent }) => {
      if (target.role !== "host") return;
      /*
        A PUBLISH THAT OUTLIVED ITS ROOM SAYS NOTHING. The permission prompt
        can stay up while the connection drops and is replaced, or while the
        host closes or signs out. Its outcome belonged to a Room that is gone:
        a failure must not raise "mic couldn't open" over the room that works,
        and a capture that did open is turned off.
      */
      try {
        await startPublishing(room.handle, { micOn: !resumed });
        if (!isCurrent()) {
          await releaseCapture(room.handle);
          return;
        }
        onPublishRef.current(null);
      } catch (error) {
        if (!isCurrent()) {
          await releaseCapture(room.handle);
          return;
        }
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
  // A mic banner belongs to its room: it never follows the host into another
  // one. Adjusted during render, React's pattern for state that follows a value.
  const [publishFailureFor, setPublishFailureFor] = useState(streamId);
  if (publishFailureFor !== streamId) {
    setPublishFailureFor(streamId);
    setPublishFailure(null);
  }

  /*
    A PROVIDER THAT UNMOUNTS LEAVES NO OPEN MIC BEHIND IT. The controller
    outlives this mount on purpose (a render error reaching global-error, a
    hot reload), and so does its Room — but the mute control, the lock-screen
    pause and the mini-player go with the mount. The mic is muted, not the
    connection dropped: a remounted provider adopts the session with the mic
    OFF, which is the tap-to-talk rule.
  */
  useEffect(
    () => () => {
      const held = controller.room;
      if (held) void stopPublishing(held);
    },
    [controller]
  );

  const endRoom = useEndStream({ successMessage: "Gist room closed" });
  const endRoomAsync = endRoom.mutateAsync;
  useEffect(() => {
    closeRoomCall.current = async (id) => {
      await endRoomAsync(id);
    };
  }, [endRoomAsync]);
  /** A host's switch is closing their room: the sheet's button waits on it. */
  const [switching, setSwitching] = useState(false);

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

  /*
    A HOST'S INVITATION TO SPEAK, read off the same 8 s poll as everything
    else about the reader's own row — so it reaches them on any page, with
    the room minimised. The banner (room view, mini-player) renders from THIS,
    never from the push that may have prompted the read. Accepting seats them
    through `approved` above, with the mic off: `useStage` below is given no
    intent, so nothing opens it until they tap.
  */
  const answer = useAnswerInvite(streamId);
  const answerInviteAsync = answer.mutateAsync;
  // Only while the row is still being read: a room that ended or a reconnect
  // that gave up leaves the last data cached (lib/speaker-invite.ts `liveInviteRow`).
  const invitedRow = liveInviteRow(mine.data, { polling, isHost });
  const inviteId = invitedRow?.id ?? null;
  // `inviteExpiresAt`, never `expiresAt`: on this row that is the join token's.
  const inviteExpiresAt = invitedRow?.inviteExpiresAt ?? null;
  const inviteCreatedAt = invitedRow?.createdAt ?? null;
  /*
    When THIS tab first saw the invitation — the one reading the countdown is
    taken from (lib/speaker-invite.ts `inviteDeadline`), so a device clock
    that is off cannot hide it or run it past the server. It is the moment
    the response that first carried it arrived (`dataUpdatedAt`). Held here
    rather than in a banner, so moving between the room and the mini-player
    does not restart it. Adjusted during render, React's pattern for state
    that follows a value.
  */
  const [inviteSeen, setInviteSeen] = useState<{ id: string | null; at: number; offset: number | null }>({
    id: null,
    at: 0,
    offset: null,
  });
  // The server's clock as read off the response that carried the row (lib/server-clock.ts).
  if (inviteSeen.id !== inviteId) setInviteSeen({ id: inviteId, at: mine.dataUpdatedAt, offset: serverClockOffset() });
  const inviteSeenAt = inviteSeen.id === inviteId ? inviteSeen.at : 0;
  const inviteOffset = inviteSeen.id === inviteId ? inviteSeen.offset : null;
  const invite = useMemo(
    () =>
      inviteId
        ? { requestId: inviteId, inviteExpiresAt, createdAt: inviteCreatedAt, seenAt: inviteSeenAt, clockOffsetMs: inviteOffset }
        : null,
    [inviteId, inviteExpiresAt, inviteCreatedAt, inviteSeenAt, inviteOffset]
  );
  // Which invitation the reader answered: its end is then no news to announce.
  const [answeredInviteId, setAnsweredInviteId] = useState<string | null>(null);
  // Same-frame taps: the banner's `busy` arrives a render late (lib/speaker-invite.ts `createAnswerLatch`).
  const [answerLatch] = useState(createAnswerLatch);
  // The answer on the wire, so a leave during it can wait (lib/speaker-invite.ts `releaseOnLeave`).
  const [inflightAnswers] = useState(createInflightAnswers);
  // An answer that went through lets go once its invitation is off screen,
  // so a re-invite on the same row id can be answered (`AnswerLatch.follow`).
  useEffect(() => {
    answerLatch.follow(inviteId);
  }, [answerLatch, inviteId]);
  const answerInvite = useCallback(
    (action: "accept" | "reject") => {
      if (!inviteId || !streamId || !answerLatch.claim(inviteId)) return;
      setAnsweredInviteId(inviteId);
      // Pinned to this room: the session may have moved on when it comes back.
      const answer = inflightAnswers.track(inviteId, action, answerInviteAsync({ requestId: inviteId, action, room: streamId }));
      void answer.settled.then((row) => {
        if (!row) answerLatch.release(inviteId);
      });
    },
    [answerInviteAsync, answerLatch, inflightAnswers, inviteId, streamId]
  );

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
  const auth = useAuth();
  const me = useMe();
  const meId = me.data?.id ?? null;
  const storedRejoin = useSyncExternalStore(subscribeRejoin, readRejoin, () => null);
  // Only to the signed-in account that was in the room (lib/room-session/rejoin.ts).
  const rejoinOffer = rejoinOfferFor({
    record: storedRejoin,
    authReady: auth.ready,
    authenticated: auth.authenticated,
    meId,
  });
  // A private room is remembered by the neutral name the lock screen uses:
  // the chip is a surface anyone at the screen can read.
  const liveTitle =
    state.connection === "live" && stream.data ? sharedSurfaceTitle(stream.data, houseTopic(stream.data)) : null;
  useEffect(() => {
    if (!liveTitle || !streamId || !meId) return;
    writeRejoin({ streamId, title: liveTitle, userId: meId });
  }, [liveTitle, streamId, meId]);
  // The room ending, or another tab taking it, is not something to offer back.
  useEffect(() => {
    if (state.connection === "ended" || state.connection === "duplicate") writeRejoin(null);
  }, [state.connection]);
  const dismissRejoin = useCallback(() => writeRejoin(null), []);

  /* ---- the speaker signals on the reader's own topic -------------------- */

  /*
    `user:<did>` on the ws-gateway says "your row, or your mic, just changed".
    It is a REFETCH SIGNAL (lib/ws-gateway.ts `speakerSignalOf` keeps only the
    stream id): the 8 s poll stays the floor, and a frame about another room,
    a forged one or a malformed one does nothing a read would not. The
    gateway hands a personal topic only to a socket authenticated as its
    owner, so the shared socket carries the reader's Privy token
    (lib/ws-gateway-shared.ts). Off unless the gateway is configured, and a
    refused socket is invisible.
  */
  const queryClient = useQueryClient();
  const myTopic = userTopic(meId);
  const muteSignal = useRef<() => void>(() => {});
  useEffect(() => {
    if (!holding || !streamId || !myTopic || !MARKET_FLAGS.wsGatewayUrl) return;
    return sharedGateway().subscribe(myTopic, (frame) => {
      const signal = speakerSignalOf(frame);
      if (!signal || signal.streamId !== streamId) return;
      if (signal.kind === "mute") {
        muteSignal.current();
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "speaker-request", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "speaker-requests"] });
    });
  }, [holding, streamId, myTopic, queryClient]);

  /*
    "THE HOST MUTED YOUR MIC." Said once per mute, on whatever page the reader
    is on, from the room's own truth: the `hostMuted` attribute on our
    participant and our microphone publication (lib/host-mute.ts). The push
    only asks to look. A connect or a reconnect starts the reading over, so
    its replay of the attribute is never news. Nobody mutes the host.
  */
  useEffect(() => {
    if (!room || isHost) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    let toastState = INITIAL_HOST_MUTE_TOAST;
    const check = (signalled: boolean) => {
      const local = room.localParticipant;
      const step = stepHostMuteToast(toastState, {
        current: hostMuteOf(local.attributes),
        token: hostMuteToken(local.attributes),
        micOn: local.isMicrophoneEnabled,
        signalled,
        now: Date.now(),
      });
      toastState = step.state;
      if (step.toast) toast(HOST_MUTE_TOAST);
    };
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      // Both events hand the participant LAST: (changed, participant) and
      // (publication, participant). Only our own changes are ours to announce.
      const onChange = (...args: unknown[]) => {
        const who = args[args.length - 1] as { isLocal?: boolean } | undefined;
        if (who?.isLocal !== true) return;
        check(false);
      };
      const onReconnected = () => {
        toastState = INITIAL_HOST_MUTE_TOAST;
        check(false);
      };
      room.on(RoomEvent.ParticipantAttributesChanged, onChange);
      room.on(RoomEvent.TrackMuted, onChange);
      room.on(RoomEvent.Reconnected, onReconnected);
      muteSignal.current = () => check(true);
      off = () => {
        room.off(RoomEvent.ParticipantAttributesChanged, onChange);
        room.off(RoomEvent.TrackMuted, onChange);
        room.off(RoomEvent.Reconnected, onReconnected);
      };
      check(false);
    });
    return () => {
      cancelled = true;
      muteSignal.current = () => {};
      off?.();
    };
  }, [room, isHost]);

  /* ---- verbs ----------------------------------------------------------- */

  // A seat or a hand comes down; an unanswered invitation is answered (lib/speaker-invite.ts).
  /*
    A seated person frees their seat on the way out, and a raised hand comes
    down, so the host's tray never holds somebody who has gone. An invitation
    still open is answered reject — unless "Join as speaker" is on the wire:
    then the release waits for it and sends `leave` once it seated them, not
    the reject the stale `invited` row asked for (which the service refuses
    once the accept lands, keeping the seat). Pinned to the room being left.
  */
  const myRow = mine.data ?? null;
  const resolveMutate = resolve.mutate;
  const releaseSeat = useCallback(() => {
    const room = streamId;
    if (!room) return;
    void releaseOnLeave({
      row: myRow,
      inflight: inflightAnswers.current(),
      latest: () => queryClient.getQueryData<ReleasableRow>(["ms", "stream", room, "speaker-request", "me"]),
      send: (requestId, action) => resolveMutate({ requestId, action, room }),
    });
  }, [inflightAnswers, myRow, queryClient, resolveMutate, streamId]);
  const leave = useCallback(async () => {
    releaseSeat();
    writeRejoin(null);
    await controller.leave();
  }, [controller, releaseSeat]);

  /*
    "Leave and join" is a LEAVE of the room being left, and does what every
    other leave does: the seat or the raised hand in it comes down, and the
    rejoin record stops pointing at it. After the switch the streamId is the
    new room's, so this is the last moment the old request can be reached.
  */
  /*
    A HOST'S "Leave and join" CLOSES THEIR ROOM (the controller runs the
    end-stream call first). If the close fails, nothing moves: the toast says
    so, and the rejoin record goes back to the room they are still in.
  */
  const confirmConflict = useCallback(async () => {
    if (!state.pending) return;
    releaseSeat();
    const previous = readRejoin();
    writeRejoin(null);
    setSwitching(true);
    try {
      await controller.confirmConflict();
    } catch {
      // useEndStream has already said why.
      writeRejoin(previous);
    } finally {
      setSwitching(false);
    }
  }, [controller, releaseSeat, state.pending]);

  /*
    Making way for a room the reader opens themselves (Backstage). The same
    leave as every other: a seat comes down, the rejoin record goes — and a
    host's room is closed for everyone first. Rejects when that close fails.
  */
  const vacate = useCallback(async () => {
    releaseSeat();
    const previous = readRejoin();
    writeRejoin(null);
    try {
      await controller.vacate();
    } catch (error) {
      writeRejoin(previous);
      throw error;
    }
  }, [controller, releaseSeat]);

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
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (!auth.ready) return;
    // Settled signed out — including a page that LOADED signed out after a
    // sign-out this tab never saw — keeps no record of anybody's room.
    if (!auth.authenticated) writeRejoin(null);
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
    return () => {
      try {
        session.metadata = null;
      } catch {
        // As above.
      }
    };
  }, [holding, metaTitle, metaArtist]);

  /*
    THE OS HANG-UP IS A LISTENER'S LEAVE, AND NOBODY ELSE'S. It carries no
    confirmation, so a host pressing it in Chrome's media hub or on a headset
    was disconnected with their room left live for everyone, and a speaker
    gave up their seat on one tap. Those two close or leave in the app, where
    the mini-player asks first (lib/room-session/media-session.ts).
  */
  const hangUpAllowed = osHangUpAllowed(presence);
  useEffect(() => {
    if (!holding || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (hangUpAllowed) {
      try {
        session.setActionHandler("hangup" as MediaSessionAction, () => void leave());
      } catch {
        // An action this browser does not know is not worth failing over.
      }
    }
    return () => {
      try {
        session.setActionHandler("hangup" as MediaSessionAction, null);
      } catch {
        // As above.
      }
    };
  }, [holding, hangUpAllowed, leave]);

  /*
    THE BROWSER'S MIC CONTROL. Chrome draws a microphone toggle in its media
    hub and Picture-in-Picture for the `togglemicrophone` action, and reads
    its state from `setMicrophoneActive`. Registered for anybody with a mic
    to toggle — whether it is on or off, so the same button unmutes what it
    muted — and for anybody whose mic is still open whatever their seat says.
  */
  const micOn = stage.micOn;
  const micControllable = holding && (isHost || presence === "speaker" || stage.micOn);
  const toggleMic = stage.toggleMic;
  useEffect(() => {
    if (!micControllable || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession as MediaSession & { setMicrophoneActive?: (active: boolean) => void };
    try {
      session.setMicrophoneActive?.(micOn);
    } catch {
      // As above.
    }
    try {
      session.setActionHandler("togglemicrophone" as MediaSessionAction, () => void toggleMic());
    } catch {
      // An action this browser does not know is not worth failing over.
    }
    return () => {
      try {
        session.setActionHandler("togglemicrophone" as MediaSessionAction, null);
        session.setMicrophoneActive?.(false);
      } catch {
        // As above.
      }
    };
  }, [micControllable, micOn, toggleMic]);

  /*
    THE LOCK SCREEN'S PAUSE NEVER LEAVES A MIC OPEN. Most lock screens have no
    mic toggle, only pause — and without a handler the browser's pause
    silences the incoming audio and nothing else: to the reader it feels like
    they left, while their mic goes on publishing. So while a mic is open,
    pause MUTES it (the room keeps playing, which is honest). Kept alongside
    the mic toggle above, deliberately: a pause that could leave a hot mic
    behind is the worse failure. Muted, the reader gets the browser's own
    pause back.
  */
  const hotMic = holding && stage.micOn;
  useEffect(() => {
    if (!hotMic || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.setActionHandler("pause", () => void toggleMic());
    } catch {
      // As above.
    }
    return () => {
      try {
        session.setActionHandler("pause", null);
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
      // Sign-out, while the session that authorises calls still exists: a
      // host's room is closed for everyone (they can never come back to it),
      // anyone else leaves properly, freeing a held seat.
      logout: () => {
        writeRejoin(null);
        return isHost ? controller.signOut() : leave();
      },
      confirmConflict,
      switching,
      vacate,
      dismissConflict,
      dismiss: () => {
        writeRejoin(null);
        controller.dismiss();
      },
      retry: () => void controller.retry(),
      rejoinOffer,
      dismissRejoin,
      invite,
      answerInvite,
      answeringInvite: answer.isPending,
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
      switching,
      vacate,
      dismissConflict,
      rejoinOffer,
      dismissRejoin,
      isHost,
      invite,
      answerInvite,
      answer.isPending,
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
      {/* The ONE place the invitation is announced, whichever surface draws it. */}
      <InviteAnnouncer
        invite={invite}
        hostName={stream.data?.owner?.displayName || stream.data?.owner?.username || null}
        // Leaving the room ends the invitation too; that is not news either.
        answered={!holding || (invite !== null && answeredInviteId === invite.requestId)}
      />
      {/* The audio itself, outside every route. Mounted from its own map so it
          can never become conditional on anything visual. */}
      {room && stream.data && (
        <HouseAudioSinks room={room} streamId={streamId} ownerId={stream.data.ownerId} />
      )}
    </>
  );
}

/**
 * THE INVITATION, SAID ONCE. It used to be announced by the room page (on
 * mount, and again after a reconnect) and by the mini-player (whenever the
 * reader left the room's page), so moving around the Square repeated it. The
 * session is always mounted, so it says it: the invitation with its deadline,
 * one warning near the end, and a closing line when it ends unanswered
 * (lib/speaker-invite.ts `stepInviteAnnouncer`).
 */
function InviteAnnouncer({
  invite,
  hostName,
  answered,
}: {
  invite: RoomSessionView["invite"];
  hostName: string | null;
  answered: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = invite !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ticking]);

  const view = invite
    ? inviteView(
        { id: invite.requestId, status: "invited", inviteExpiresAt: invite.inviteExpiresAt, createdAt: invite.createdAt },
        now,
        invite.seenAt,
        invite.clockOffsetMs
      )
    : null;
  const secondsLeft = view?.state === "open" ? view.secondsLeft : null;
  const [spoken, setSpoken] = useState<{ state: InviteAnnouncerState; text: string }>({
    state: INITIAL_INVITE_ANNOUNCER,
    text: "",
  });
  const step = stepInviteAnnouncer(spoken.state, {
    requestId: invite && view?.state !== "expired" ? invite.requestId : null,
    hostName,
    secondsLeft,
    answered,
  });
  const changed =
    step.say !== null ||
    step.state.requestId !== spoken.state.requestId ||
    step.state.warned !== spoken.state.warned ||
    step.state.answered !== spoken.state.answered;
  // Adjusted during render, React's pattern for state that follows a value.
  if (changed) setSpoken({ state: step.state, text: step.say ?? spoken.text });

  // In the open sheet's dialog while there is one: a live region outside an
  // aria-modal dialog is not read, and the deadline is the news.
  return (
    <AboveModals>
      <p role="status" aria-live="polite" className="sr-only">
        {spoken.text}
      </p>
    </AboveModals>
  );
}

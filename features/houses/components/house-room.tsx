"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room } from "livekit-client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";
import { IconLink } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { getRoom, subscribeRoom } from "@/features/streams/lib/live-room";
import { RemoteAudio } from "@/features/streams/components/remote-audio";
import { baseIdentity, remoteAudioSlots, type StageSlot } from "@/features/streams/lib/stage";
import { useStageSlots } from "@/features/streams/hooks/use-stage-slots";
import { usePublisher } from "@/features/streams/hooks/use-publisher";
import { useStage } from "@/features/streams/hooks/use-stage";
import { usePlaybackToken } from "@/features/streams/hooks/use-playback";
import { useLiveReactions } from "@/features/streams/hooks/use-live-reactions";
import {
  useEndStream,
  useGoLive,
  useMySpeakerRequest,
  useRequestToSpeak,
  useResolveSpeakerRequest,
  useSpeakerRequests,
  useStream,
} from "@/features/streams/hooks/use-streams";
import type { Ingest, Stream } from "@/features/streams/lib/types";
import { AudienceBands } from "@/features/houses/components/audience-band";
import { Backstage } from "@/features/houses/components/backstage";
import { CaptionRail } from "@/features/houses/components/caption-rail";
import { CopyRow } from "@/features/houses/components/copy-row";
import { HandTray } from "@/features/houses/components/hand-tray";
import { HouseControls } from "@/features/houses/components/house-controls";
import { HouseHeader } from "@/features/houses/components/house-header";
import { OpenHouseSheet } from "@/features/houses/components/open-house-sheet";
import { PersonSheet, type PersonTarget } from "@/features/houses/components/person-sheet";
import { OverflowRow, SeatRing } from "@/features/houses/components/seat-ring";
import { TableEdge } from "@/features/houses/components/table-edge";
import { useAudience, useAudienceBands, type AudienceMember } from "@/features/houses/hooks/use-audience";
import { useHouseAnnouncer } from "@/features/houses/hooks/use-house-announcer";
import { useHouseAudio } from "@/features/houses/hooks/use-house-audio";
import { useHouseConnection } from "@/features/houses/hooks/use-house-connection";
import { ANNOUNCE_STABLE_MS } from "@/features/houses/lib/audio-levels";
import { houseShareUrl, houseTopic, isHouse } from "@/features/houses/lib/house";
import { parseParticipantMeta, participantName } from "@/features/houses/lib/participant-meta";
import {
  getMutes,
  getServerMutes,
  setMutes,
  subscribeMutes,
  toggleMute as toggleMuteSet,
} from "@/features/houses/lib/muted-for-me";
import {
  SEAT_AVATAR,
  SEAT_COUNT,
  SEAT_POSITIONS,
  buildSeating,
  seatsFull,
} from "@/features/houses/lib/seating";

/**
 * A house: eight seats round a table, an audience below, and no camera
 * anywhere in the tree.
 *
 * The direction is THE TABLE. Speakers sit in a ring of equal places; the
 * empty chair is both the invitation and the raise-hand control; the audience
 * is a real, tappable band rather than a number. Audio only, permanently — for
 * the host as much as for a guest, and not as a degraded fallback.
 *
 * Almost none of the machinery below is new. The LiveKit room, the one-room
 * registry, the stage model, the speaker-request flow (ask → host approves →
 * the grant lands on the connection the guest already has), the moderation
 * calls and the reaction channel are all the stream slice's, reused as they
 * are. What Houses adds is a different SEATING of the same facts, plus one
 * boolean threaded through the two publish hooks that makes the camera
 * structurally absent rather than merely unused.
 */
interface SlotProps {
  /** Composed in components/layout — slices never import each other. */
  followSlot: (username: string) => React.ReactNode;
  safetySlot: (
    username: string,
    mute: { muted: boolean; onToggle: () => void } | undefined
  ) => React.ReactNode;
}

export function HouseRoom({
  houseId,
  followSlot,
  safetySlot,
}: { houseId: string } & SlotProps) {
  const stream = useStream(houseId, 10_000);
  const me = useMe();

  if (stream.isPending) return <RoomSkeleton />;

  if (stream.isError) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-10">
        <ErrorState
          error={stream.error}
          fallback="Couldn't open this house."
          onRetry={() => stream.refetch()}
        />
      </div>
    );
  }

  const data = stream.data;
  const isHost = me.data?.id === data.ownerId;

  // A stream that is not a house has no ring, no audience band and — the part
  // that matters — a camera. Sending it here would render a video broadcast in
  // a surface with no video code path, so it is redirected rather than
  // half-rendered.
  if (!isHouse(data)) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-10 text-center">
        <p className="text-sm text-body">This is a stream, not a house.</p>
        <Link
          href={`/live/${data.id}`}
          className="ws-press mt-3 inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3.5 text-xs font-semibold text-white"
        >
          Watch it instead
        </Link>
      </div>
    );
  }

  if (data.status === "ended" || data.status === "cancelled") return <ClosedHouse stream={data} />;

  if (data.status === "scheduled") {
    return isHost ? (
      <HostScheduled stream={data} followSlot={followSlot} safetySlot={safetySlot} />
    ) : (
      <NotOpenYet stream={data} />
    );
  }

  return (
    <LiveHouse
      key={data.id}
      stream={data}
      isHost={isHost}
      followSlot={followSlot}
      safetySlot={safetySlot}
    />
  );
}

/* ------------------------------------------------------------------ states */

/**
 * The skeleton draws the EIGHT EMPTY CHAIRS.
 *
 * That is what a house is, so showing it immediately is truthful rather than
 * decorative — and it removes the layout jump a spinner would create when the
 * ring lands. There is no spinner in the ring at any point in this feature.
 */
function RoomSkeleton() {
  return (
    <div className="ws-wash mx-auto w-full max-w-[520px]" aria-busy="true">
      <div className="px-4 pb-3 pt-3">
        <div className="ws-skeleton h-6 w-3/5" />
        <div className="ws-skeleton mt-2 h-3 w-2/5" />
      </div>
      <EmptyRing />
    </div>
  );
}

/** The ring at rest: eight dashed places, in position, at full size. */
function EmptyRing() {
  return (
    <div className="px-5 pb-4 pt-6">
      <ul aria-label="Speakers" className="relative mx-auto aspect-square w-full max-w-[340px]">
        {SEAT_POSITIONS.map((point, index) => (
          <li
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.22]"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              height: SEAT_AVATAR,
              width: SEAT_AVATAR,
            }}
          />
        ))}
      </ul>
    </div>
  );
}


function HostScheduled({
  stream,
  followSlot,
  safetySlot,
}: {
  stream: Stream;
  followSlot: SlotProps["followSlot"];
  safetySlot: SlotProps["safetySlot"];
}) {
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [micId, setMicId] = useState("");
  // Once the host opens the house, the stream poll flips it to `live` within
  // ten seconds and HouseRoom re-renders into LiveHouse. Holding the ingest
  // here means the publisher connects on the first render after that, with the
  // microphone the host just checked, rather than waiting for another round
  // trip.
  const [opened, setOpened] = useState(false);
  if (opened && ingest) {
    return (
      <LiveHouse
        // go-live has returned, so the host IS live — our cached stream object
        // just has not caught up. Rendering from the ingest already in hand
        // opens their microphone now rather than on the next ten-second poll,
        // which is the difference between "I opened a gist room" and "did that
        // work?".
        stream={{ ...stream, status: "live" }}
        isHost
        ingest={ingest}
        micId={micId}
        followSlot={followSlot}
        safetySlot={safetySlot}
      />
    );
  }
  return (
    <Backstage
      stream={stream}
      onOpened={(freshIngest, chosenMic) => {
        setIngest(freshIngest);
        setMicId(chosenMic);
        setOpened(true);
      }}
    />
  );
}

function NotOpenYet({ stream }: { stream: Stream }) {
  return (
    <div className="ws-wash mx-auto w-full max-w-[520px]">
      <div className="px-4 pb-3 pt-4">
        <h1 className="ws-display text-[22px] leading-7">{houseTopic(stream)}</h1>
        <p className="ws-meta mt-2">
          {stream.owner ? `${stream.owner.displayName} · ` : ""}Not open yet
        </p>
      </div>
      {/* The eight dashed seats, again. No spinner, and no ghost faces
          standing in for people who are not there. */}
      <EmptyRing />
      <p className="px-4 pb-10 text-center text-[13px] leading-5 text-meta">
        This house has not opened. When it does, you will be able to listen and ask to speak.
      </p>
    </div>
  );
}

function ClosedHouse({ stream }: { stream: Stream }) {
  const [reopening, setReopening] = useState(false);
  const gate = useGate();
  return (
    <div className="ws-wash mx-auto w-full max-w-[520px]">
      <div className="px-4 pb-3 pt-4">
        {/* The header keeps the topic, so the page is still ABOUT something
            rather than a tombstone. */}
        <h1 className="ws-display text-[22px] leading-7">{houseTopic(stream)}</h1>
      </div>
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-bold text-heading">This house has closed.</p>
        <p className="ws-meta mt-2">
          {stream.owner ? `Hosted by ${stream.owner.displayName}` : "Closed"}
        </p>
        {/* No replay surface. Recording is not provisioned, MARKET_FLAGS.replays
            is off, and a recording is a consent and moderation surface rather
            than a free win — so nothing here promises one. */}
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={() => gate(() => setReopening(true))}
        >
          Open a gist room about this
        </Button>
      </div>
      {stream.owner && (
        <Link
          href={`/u/${stream.owner.username}`}
          className="ws-row flex items-center gap-3 px-4 py-3.5 text-[13px] font-semibold text-body"
        >
          Visit @{stream.owner.username}
        </Link>
      )}
      <OpenHouseSheet
        open={reopening}
        onClose={() => setReopening(false)}
        initialTopic={houseTopic(stream)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- the room */

type RoomState = "connecting" | "live" | "reconnecting" | "failed" | "duplicate";

function LiveHouse({
  stream,
  isHost,
  ingest: initialIngest = null,
  micId = "",
  followSlot,
  safetySlot,
}: {
  stream: Stream;
  isHost: boolean;
  ingest?: Ingest | null;
  micId?: string;
} & SlotProps) {
  const router = useRouter();
  const gate = useGate();
  const { message, announce } = useHouseAnnouncer();

  /* ---- the one connection ------------------------------------------- */

  /**
   * A host who reloads a live house has no ingest — go-live is what mints it,
   * and it is idempotent by design (the studio's "rejoin" does exactly this).
   * So it is fired once, automatically, rather than making the host tap
   * "rejoin" to get back into a room they never left.
   */
  const [ingest, setIngest] = useState<Ingest | null>(initialIngest);
  const rejoin = useGoLive();
  const rejoined = useRef(false);
  useEffect(() => {
    if (!isHost || ingest || rejoined.current) return;
    rejoined.current = true;
    rejoin.mutate(stream.id, { onSuccess: (result) => setIngest(result.ingest) });
  }, [isHost, ingest, rejoin, stream.id]);

  const publisher = usePublisher({
    ingest: isHost ? ingest : null,
    enabled: isHost,
    streamId: stream.id,
    // The whole promise, in one argument. See features/streams/lib/capture-plan.ts.
    audioOnly: true,
    preferredMic: micId || undefined,
  });

  const playback = usePlaybackToken(stream.id, !isHost);
  const connection = useHouseConnection({
    houseId: stream.id,
    url: playback.data?.url ?? "",
    token: playback.data?.token ?? "",
    enabled: !isHost,
  });

  /**
   * The room, whichever path opened it.
   *
   * Read from the registry rather than from either hook's return, so this
   * component does not have to know which one is driving. The registry is also
   * the structural guard that there is only ever ONE — a host publishes on the
   * room it registers, a listener registers the room its playback token
   * opened, never two.
   */
  const room = useSyncExternalStore(
    useCallback((listener) => subscribeRoom(stream.id, listener), [stream.id]),
    useCallback(() => getRoom(stream.id), [stream.id]),
    () => null as Room | null
  );

  const state: RoomState = isHost
    ? publisher.state === "publishing"
      ? "live"
      : publisher.state === "reconnecting"
        ? "reconnecting"
        : publisher.state === "idle" || publisher.state === "connecting"
          ? "connecting"
          : "failed"
    : playback.isError
      ? "failed"
      : connection.state;

  /* ---- who is at the table ------------------------------------------ */

  const slots = useStageSlots(room, stream.ownerId);
  const seating = useMemo(() => buildSeating(slots), [slots]);
  const audio = useHouseAudio(room);
  const audience = useAudience(room);
  const bands = useAudienceBands(audience, audio.recentSpeakers);
  const full = seatsFull(seating);

  const loudestSlot = useMemo(
    () => slots.find((slot) => slot.identity === audio.loudest) ?? null,
    [slots, audio.loudest]
  );

  /* ---- asking for the floor ------------------------------------------ */

  const asking = stream.status === "live" && !isHost;
  const mine = useMySpeakerRequest(stream.id, asking);
  const request = useRequestToSpeak(stream.id);
  const resolve = useResolveSpeakerRequest(stream.id);
  const approved = mine.data?.status === "approved";
  const pendingMine = mine.data?.status === "pending";

  /**
   * The approved guest publishes over the connection they ALREADY have.
   *
   * No second token and no second room: the playback token and a speaker token
   * carry the same LiveKit identity, so connecting twice evicts the viewer and
   * starts the reconnect loop the registry exists to prevent. `withCamera:
   * false` makes the camera absent from this path rather than skipped.
   */
  const stage = useStage({
    streamId: stream.id,
    approved: asking && approved,
    withCamera: false,
  });

  /** The host's own view of the queue, for the counted button and the tray. */
  const hostRequests = useSpeakerRequests(stream.id, isHost && stream.status === "live");
  const handsUp = (hostRequests.data?.items ?? []).filter((item) => item.status === "pending");

  /**
   * BACKEND B4. `PATCH /streams/:id { requestsOpen }` does not exist, so this
   * is client-local and session-only: it stops THIS client offering the chair.
   * It does not stop the service accepting requests, and the tray says so.
   */
  const [requestsOpen, setRequestsOpen] = useState(true);

  const onStage = isHost || (approved && stage.state === "live");
  const canAsk = !isHost && !onStage;

  const askReason = !requestsOpen
    ? "The host isn't taking requests right now."
    : full
      ? `All ${SEAT_COUNT} seats are taken.`
      : null;

  const ask = useCallback(() => {
    if (askReason) return;
    gate(() => request.mutate());
  }, [askReason, gate, request]);

  /**
   * `?seat=1` — the host's speaker link.
   *
   * NOT pre-approval, which needs a backend delta. It raises the arriving
   * guest's hand automatically so the host's own invitee is at the front of
   * the tray rather than lost in it, then strips the parameter so a refresh
   * does not ask again.
   */
  const seatParamUsed = useRef(false);
  useEffect(() => {
    // Read off `location` rather than `useSearchParams`, which would force this
    // whole room behind a Suspense boundary for a value that is only ever read
    // once, on mount, on the client.
    if (seatParamUsed.current || isHost || mine.isPending) return;
    if (new URLSearchParams(window.location.search).get("seat") !== "1") return;
    seatParamUsed.current = true;
    router.replace(`/gist-rooms/${stream.id}`, { scroll: false });
    if (!mine.data || mine.data.status === "denied" || mine.data.status === "withdrawn") {
      request.mutate();
    }
  }, [isHost, mine.isPending, mine.data, request, router, stream.id]);

  /* ---- mute for me ---------------------------------------------------- */

  /**
   * Client-local silence, held OUTSIDE React (lib/muted-for-me.ts).
   *
   * Not `useState` plus an effect that reads storage: the stored set is not
   * state arriving late, it is state that existed before this render. Reading
   * it in an effect gives a first paint where somebody is audible and a second
   * where they are not — and for a mute that is not a layout jump, it is a
   * person you asked to silence still talking.
   */
  const mutedForMe = useSyncExternalStore(
    subscribeMutes,
    useCallback(() => getMutes(stream.id), [stream.id]),
    getServerMutes
  );
  const toggleMute = useCallback(
    (identity: string) => setMutes(stream.id, toggleMuteSet(getMutes(stream.id), identity)),
    [stream.id]
  );

  /* ---- reactions ------------------------------------------------------ */

  const [incoming, setIncoming] = useState(0);
  const live = useLiveReactions(room, {
    onReceive: (burst) => setIncoming((current) => current + burst),
  });

  /* ---- announcements --------------------------------------------------- */

  // Seat changes. Compared against the previous render's occupants rather than
  // derived from an event, so a promotion, a demotion and a disconnect all
  // announce through one path.
  const seatedBefore = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const now = new Map(
      seating.seats
        .filter((seat) => seat.slot)
        .map((seat) => [seat.slot!.identity, participantName(seat.slot!.name) ?? seat.slot!.name])
    );
    const before = seatedBefore.current;
    seatedBefore.current = now;
    // The first pass is the room as we found it, not a sequence of arrivals.
    if (before === null) return;
    for (const [identity, name] of now) {
      if (!before.has(identity)) announce(`${name} is now speaking`);
    }
    for (const [identity, name] of before) {
      if (!now.has(identity)) announce(`${name} left the seat`);
    }
  }, [seating, announce]);

  // Your own lift.
  const wasOnStage = useRef(onStage);
  useEffect(() => {
    if (onStage && !wasOnStage.current) {
      announce("You're on the stage. Your microphone is open.");
    }
    wasOnStage.current = onStage;
  }, [onStage, announce]);

  // Your own hand.
  const handWas = useRef<string | null>(null);
  useEffect(() => {
    const status = mine.data?.status ?? null;
    const before = handWas.current;
    handWas.current = status;
    if (before === status) return;
    if (status === "pending") announce("Your hand is up.");
    else if (before === "pending" && status !== "approved") announce("Your hand is lowered.");
    // §4.10: your face returns to the audience band, the mic is dropped by
    // useStage's own teardown, and this is the ONE thing said about it. No
    // modal, and no explanation of why — the host does not owe one and the app
    // must not invent one.
    if (status === "removed" && before === "approved") {
      toast("You're back in the audience.");
    }
  }, [mine.data?.status, announce]);

  // The host's queue.
  const announcedRequests = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isHost) return;
    if (announcedRequests.current === null) {
      announcedRequests.current = new Set(handsUp.map((item) => item.id));
      return;
    }
    const fresh = handsUp.filter((item) => !announcedRequests.current!.has(item.id));
    for (const item of fresh) announcedRequests.current.add(item.id);
    if (fresh.length === 0) return;
    const name = fresh[0].profile?.displayName ?? "Someone";
    announce(`${name} is asking to speak. ${handsUp.length} waiting.`);
  }, [isHost, handsUp, announce]);

  // The connection.
  const stateWas = useRef<RoomState | null>(null);
  useEffect(() => {
    const before = stateWas.current;
    stateWas.current = state;
    if (before === null || before === state) return;
    if (state === "reconnecting") announce("Reconnecting");
    else if (state === "live" && before === "reconnecting") announce("Connected");
    else if (state === "failed") announce("Lost connection to the gist room");
  }, [state, announce]);

  /**
   * The talking line, announced only once a voice has HELD the floor.
   *
   * The visible strip updates immediately — a sighted reader follows
   * turn-taking at conversational speed. A screen reader cannot: a live region
   * firing on every turn in a lively conversation produces a wall of "Ada.
   * Tobi. Ada. Kemi." that buries whatever is being said.
   */
  const announcedLoudest = useRef<string | null>(null);
  useEffect(() => {
    const identity = audio.loudest;
    if (!identity || identity === announcedLoudest.current) return;
    const timer = setTimeout(() => {
      const slot = slots.find((item) => item.identity === identity);
      if (!slot) return;
      announcedLoudest.current = identity;
      announce(`${participantName(slot.name) ?? slot.name} is speaking`);
    }, ANNOUNCE_STABLE_MS);
    return () => clearTimeout(timer);
  }, [audio.loudest, slots, announce]);

  /* ---- leaving --------------------------------------------------------- */

  /**
   * "Hand up · 4m" has to keep counting, and it is the only clock in the room.
   * Fifteen seconds: fast enough that the number is never visibly wrong, slow
   * enough that a room open for an hour costs 240 renders rather than 3,600.
   */
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!pendingMine) return;
    const timer = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, [pendingMine]);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const LEAVE_SEEN = "ms:house:leave-seen";

  // Read out of `mine.data` up here rather than inside the callback: the
  // compiler infers the whole object as the dependency otherwise, which does
  // not match a hand-written `mine.data?.id` and costs the memo entirely.
  const myRequestId = mine.data?.status === "approved" ? mine.data.id : null;
  const leaveNow = useCallback(() => {
    // A seated person frees their seat on the way out, so the chair is
    // available to the next person rather than held by somebody who has gone.
    if (!isHost && myRequestId) {
      resolve.mutate({ requestId: myRequestId, action: "leave" });
    }
    router.push("/gist-rooms");
  }, [isHost, myRequestId, resolve, router]);

  const leave = useCallback(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(LEAVE_SEEN) === "1";
    } catch {
      seen = false;
    }
    if (seen) {
      leaveNow();
      return;
    }
    setConfirmLeave(true);
  }, [leaveNow]);

  const endHouse = useEndStream();

  /* ---- sheets ---------------------------------------------------------- */

  const [tray, setTray] = useState(false);
  const [overflowSheet, setOverflowSheet] = useState(false);
  const [person, setPerson] = useState<PersonTarget | null>(null);

  const openSlot = useCallback(
    (slot: StageSlot) => {
      const meta = parseParticipantMeta(slot.metadata);
      setPerson({
        identity: slot.identity,
        name: participantName(slot.name) ?? slot.name,
        meta,
        seated: true,
        pendingRequestId: null,
      });
    },
    []
  );

  const openMember = useCallback(
    (member: AudienceMember) => {
      const waiting = handsUp.find((item) => item.userId === member.userId);
      setPerson({
        identity: member.identity,
        name: member.name,
        meta: member.meta,
        seated: false,
        pendingRequestId: waiting?.id ?? null,
      });
    },
    [handsUp]
  );

  /* ---- keyboard --------------------------------------------------------- */

  const micToggle = isHost ? publisher.toggleMic : stage.toggleMic;
  const micOn = isHost ? publisher.micOn : stage.micOn;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal a keystroke from something somebody is typing into.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "m" && onStage) {
        event.preventDefault();
        void micToggle();
        announce(micOn ? "Microphone muted" : "Microphone on");
      } else if (key === "h" && canAsk) {
        event.preventDefault();
        if (pendingMine && mine.data?.id) {
          resolve.mutate({ requestId: mine.data.id, action: "leave" });
        } else if (!askReason) {
          ask();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStage, canAsk, micOn, micToggle, announce, pendingMine, mine.data?.id, resolve, askReason, ask]);

  /* ---- render ----------------------------------------------------------- */

  const shareOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const listening = audience.length;
  const speaking = slots.length;

  return (
    <main
      aria-label={houseTopic(stream)}
      className="ws-wash mx-auto w-full max-w-[520px] pb-[calc(var(--ws-nav-h)+72px)]"
    >
      {/* The audio itself. Mounted from its OWN map so it can never become
          conditional on anything visual — the reason RemoteAudio is its own
          file at all. */}
      {remoteAudioSlots(slots).map((slot) => (
        <RemoteAudio key={slot.identity} slot={slot} mutedForMe={mutedForMe.has(slot.identity)} />
      ))}

      {/* One polite region for the whole room. Never assertive: everything
          here is ambient, and assertive interrupts whatever is being read. */}
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>

      <HouseHeader
        topic={houseTopic(stream)}
        live={stream.status === "live"}
        meta={
          <>
            <span className="tnum">{listening}</span> listening ·{" "}
            <span className="tnum">{speaking}</span> speaking
          </>
        }
        onOverflow={() => setOverflowSheet(true)}
      />

      <TableEdge
        audio={audio}
        loudest={loudestSlot}
        connecting={state === "connecting"}
        reconnecting={state === "reconnecting"}
      />

      <div className={cn("px-5 pb-4 pt-6", state === "failed" && "opacity-40")}>
        <SeatRing
          seating={seating}
          audio={audio}
          // BACKEND: `GET /streams/:id/speaker-requests` is host-scoped
          // (authedGet, verified), so a listener cannot know how many hands
          // are up — only their own. So the chair shows the host the real
          // count and shows everyone else their own hand, which is the honest
          // subset rather than a number nobody can check.
          pending={isHost ? handsUp.length : pendingMine ? 1 : 0}
          seatsDisabled={!canAsk || askReason !== null}
          askLabel={canAsk ? "Ask to speak" : "Free seat"}
          mutedForMe={mutedForMe}
          onAsk={ask}
          onOpenPerson={openSlot}
        />
      </div>

      {state === "failed" && (
        <div className="ws-inset mx-4 mb-4 px-4 py-3">
          <p className="text-[13px] leading-5 text-body">Lost connection to the gist room.</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => (isHost ? publisher.retry() : playback.refetch())}
          >
            Try again
          </Button>
        </div>
      )}

      {state === "duplicate" && (
        <div className="ws-inset mx-4 mb-4 px-4 py-3">
          {/* Terminal by design. Retrying evicts the other tab, whose own
              reconnect evicts this one — retrying IS the eviction loop. */}
          <p className="text-[13px] leading-5 text-body">
            This house is open somewhere else. You can only be in a house from one tab or device
            at a time.
          </p>
        </div>
      )}

      <OverflowRow overflow={seating.overflow} onOpenPerson={openSlot} />

      {stream.description?.trim() && (
        <div className="ws-row flex items-start gap-3 px-4 py-3">
          <IconLink className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
          <p className="min-w-0 flex-1 text-[13px] leading-5 text-body">
            {stream.description.trim()}
          </p>
        </div>
      )}

      <CaptionRail captionUrl={playback.data?.captionUrl ?? null} />

      <AudienceBands
        bands={bands}
        total={listening}
        onOpen={openMember}
        emptyAction={
          <>
            <p className="text-[15px] font-bold text-heading">Nobody is here yet.</p>
            <p className="mt-1 text-[13px] leading-5 text-meta">
              Your voice is live. Share the link and people can walk straight in.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() =>
                void navigator.clipboard
                  .writeText(houseShareUrl(shareOrigin, stream.id))
                  .then(() => toast.success("Link copied"))
              }
            >
              Copy invite link
            </Button>
          </>
        }
      />

      <HouseControls
        mic={
          onStage
            ? {
                on: micOn,
                toggle: () => void micToggle(),
                disabled: state === "reconnecting" || state === "failed",
              }
            : null
        }
        ask={
          canAsk
            ? {
                label: pendingMine ? handLabel(mine.data?.createdAt) : "Ask to speak",
                reason: pendingMine ? null : askReason,
                pending: pendingMine,
                busy: request.isPending || resolve.isPending || state !== "live",
                onAsk: ask,
                onLower: () =>
                  mine.data?.id && resolve.mutate({ requestId: mine.data.id, action: "leave" }),
              }
            : null
        }
        tray={isHost ? { count: handsUp.length, onOpen: () => setTray(true) } : null}
        onReact={() => live.react(1)}
        incoming={incoming}
        leave={
          isHost
            ? { label: "Close the gist room", onLeave: () => setConfirmLeave(true) }
            : // Naming the absence of a notification is free retention, and it
              // is the truth. Do not soften it to "Leave".
              { label: "Leave quietly", onLeave: leave }
        }
      />

      {isHost && (
        <HandTray
          stream={stream}
          open={tray}
          onOpen={() => setTray(true)}
          onClose={() => setTray(false)}
          seatsFull={full}
          requestsOpen={requestsOpen}
          onRequestsOpenChange={setRequestsOpen}
        />
      )}

      <PersonSheet
        person={person}
        open={person !== null}
        onClose={() => setPerson(null)}
        isHost={isHost}
        hostBusy={resolve.isPending}
        onMoveDown={(target) => {
          // An approved speaker's LiveKit identity is `<did>#speaker`; the
          // request row is keyed on the bare DID. Comparing them raw never
          // matched, which is a bug this codebase has already fixed once.
          const seated = (hostRequests.data?.items ?? []).find(
            (item) =>
              item.status === "approved" &&
              baseIdentity(item.userId) === baseIdentity(target.identity)
          );
          if (!seated) {
            toast.error("Couldn't find their seat.");
            return;
          }
          resolve.mutate({ requestId: seated.id, action: "remove" });
          setPerson(null);
        }}
        onSeat={(target) => {
          if (!target.pendingRequestId) return;
          resolve.mutate({ requestId: target.pendingRequestId, action: "approve" });
          setPerson(null);
        }}
        mute={
          // Only a person with a seat is publishing, so only they have audio to
          // silence. Offering the row over an audience member would be a
          // control that does nothing.
          person?.seated
            ? { muted: mutedForMe.has(person.identity), onToggle: () => toggleMute(person.identity) }
            : null
        }
        followSlot={followSlot}
        safetySlot={safetySlot}
      />

      <Sheet open={overflowSheet} onClose={() => setOverflowSheet(false)} title="This house">
        <CopyRow
          label="Listener link"
          hint="Anyone with this can walk in and listen."
          url={houseShareUrl(shareOrigin, stream.id)}
        />
        {isHost && (
          <CopyRow
            label="Speaker link"
            hint="Puts their hand up the moment they arrive, so they are at the front of your tray. It does not seat them."
            url={houseShareUrl(shareOrigin, stream.id, true)}
          />
        )}
        <div className="mt-5">
          <p className="ws-meta mb-2">Keyboard</p>
          {/* An undiscoverable shortcut is not a feature. */}
          <ul className="space-y-1 text-[13px] text-body">
            <li>
              <kbd className="tnum font-semibold">M</kbd> — mute or unmute, when you have a seat
            </li>
            <li>
              <kbd className="tnum font-semibold">H</kbd> — raise or lower your hand
            </li>
          </ul>
        </div>
        {isHost && (
          <Button
            variant="secondary"
            className="mt-6 w-full"
            loading={endHouse.isPending}
            onClick={() => {
              setOverflowSheet(false);
              setConfirmLeave(true);
            }}
          >
            Close the gist room
          </Button>
        )}
      </Sheet>

      <Sheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={isHost ? "Close the gist room?" : "Leave quietly?"}
      >
        <p className="text-[13px] leading-5 text-body">
          {isHost
            ? "Everyone will be sent out and the gist room will be closed."
            : "Nobody is told you left."}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button
            className="flex-1"
            loading={endHouse.isPending}
            onClick={() => {
              if (isHost) {
                endHouse.mutate(stream.id, { onSuccess: () => router.push("/gist-rooms") });
                return;
              }
              try {
                localStorage.setItem(LEAVE_SEEN, "1");
              } catch {
                // Asking again next time is a smaller cost than not leaving.
              }
              leaveNow();
            }}
          >
            {isHost ? "Close it" : "Leave"}
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

/**
 * "Hand up · 4m".
 *
 * Elapsed only. POSITION ("2nd of 5") needs backend B3 —
 * `GET /speaker-requests/me` returning `position` and `total` — and the
 * host-scoped list cannot be read from here to compute it. It is absent rather
 * than invented: a queue position that is wrong is worse than no position,
 * because somebody will wait on it.
 */
function handLabel(createdAt: string | undefined): string {
  if (!createdAt) return "Hand up";
  const ms = Date.now() - Date.parse(createdAt);
  if (!Number.isFinite(ms) || ms < 0) return "Hand up";
  const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? "Hand up · now" : `Hand up · ${minutes}m`;
}

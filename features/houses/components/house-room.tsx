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
import { baseIdentity, participantLabel, remoteAudioSlots, type StageSlot } from "@/features/streams/lib/stage";
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
import { RoomPeopleSection, type RoomPerson } from "@/features/houses/components/room-people";
import { RoomRosterPanel } from "@/features/houses/components/room-roster-panel";
import { ChatPanel } from "@/features/streams/components/chat-panel";
import { Backstage } from "@/features/houses/components/backstage";
import { CaptionRail } from "@/features/houses/components/caption-rail";
import { CopyRow } from "@/features/houses/components/copy-row";
import { HandTray } from "@/features/houses/components/hand-tray";
import { HouseControls } from "@/features/houses/components/house-controls";
import { HouseHeader } from "@/features/houses/components/house-header";
import { RecordGistButton, RoomDock } from "@/features/houses/components/room-dock";
import { SpeakerRequestPanel } from "@/features/houses/components/speaker-request-panel";
import { OpenHouseSheet } from "@/features/houses/components/open-house-sheet";
import { PersonSheet, type PersonTarget } from "@/features/houses/components/person-sheet";
import { useAudience, type AudienceMember } from "@/features/houses/hooks/use-audience";
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
  /**
   * The roster of the HOUSE GROUP this room belongs to — the file's "House
   * Members", which is a different list from the audience: a member may not be
   * here, and somebody here may not be a member.
   *
   * A slot rather than an import, because the roster is a CONVERSATION and
   * slices never import each other. It renders nothing when the room has no
   * house group (one opened from the street belongs to none), so the section
   * simply does not appear rather than appearing empty.
   */
  /**
   * The HOUSE MEMBERS grid — and ONLY that, now.
   *
   * The house's NAME and its partner COUNT used to come through here too,
   * read from the conversation. They no longer do: `GET /streams/:id` carries
   * a `house` doorplate inline, so the header names the house for anybody who
   * can see the room. That is the whole point — the conversation read is
   * membership-gated, so the header worked only for people already inside, and
   * "Join House" had nothing to name for exactly the person it is aimed at.
   *
   * The ROSTER is still a conversation read and still gated, which is correct:
   * who is in a house is the members' business. So this stays a slot (slices
   * never import each other) and the grid is simply absent for a non-member,
   * while the name and the count are not.
   */
  houseSlot?: (
    conversationId: string,
    stage: {
      /**
       * Profile ids on stage right now. House Members EXCLUDES them: a person
       * cannot be in two of the room's three lists at once, and the file draws
       * Speakers, House Members and Audience as three disjoint sets.
       */
      speakerIds: ReadonlySet<string>;
      /**
       * Reports the roster's profile ids back to the room, which is what lets
       * the AUDIENCE stay external — the people listening who are not members
       * of this house. Without it a member who is listening appears twice.
       */
      onRoster: (ids: ReadonlySet<string>) => void;
      /**
       * Opens the roster panel (369:8741) over the chat column with this list.
       *
       * The panel lives in the ROOM, because it takes the room's right column —
       * but House Members is the slot's list and the room never sees it. So the
       * slot hands the people up when its "View all" is pressed, rather than
       * the room reaching down for a roster it is not allowed to fetch.
       */
      onViewAll: (title: string, people: RoomPerson[]) => void;
    }
  ) => React.ReactNode;
  /**
   * The wink + follow pair on a person's card (node 169:13368). A slot, because
   * both are the profile slice's actions and slices never import each other.
   */
  personActionsSlot?: (
    username: string,
    variant?: "compact" | "labelled"
  ) => React.ReactNode;
  /**
   * "Give a tip" — node 121:10996, the AUDIENCE's left-hand pill in the bottom
   * bar, where the host has Record Gist.
   *
   * A slot because tipping is the tips slice's flow and slices never import
   * each other. It is handed the room and its host, which is the tip's
   * recipient; the control renders nothing on your own room or where the
   * service refuses the recipient, so the host never sees it either way.
   */
  tipSlot?: (streamId: string, owner: Stream["owner"]) => React.ReactNode;
  /**
   * Joining the house group — `POST /conversations/:id/join`.
   *
   * A slot because a house group is a CONVERSATION and slices never import
   * each other. The room decides WHETHER to offer it (a public house this
   * viewer is not in); the layout owns the mutation and its toast.
   */
  joinHouse?: { onJoin: (conversationId: string) => void; pending: boolean };
  safetySlot: (
    username: string,
    mute: { muted: boolean; onToggle: () => void } | undefined
  ) => React.ReactNode;
}

/** One frozen empty set, so an unresolved roster is not a new value per render. */
const EMPTY_IDS: ReadonlySet<string> = new Set();

/** Two rows of six — what 369:9221 draws before it stops and offers View all. */
const GRID_TILES = 12;

export function HouseRoom({
  houseId,
  followSlot,
  safetySlot,
  houseSlot,
  personActionsSlot,
  tipSlot,
  joinHouse,
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
      <HostScheduled stream={data} followSlot={followSlot} safetySlot={safetySlot} tipSlot={tipSlot} />
    ) : (
      <NotOpenYet stream={data} />
    );
  }

  return (
    <LiveHouse houseSlot={houseSlot} personActionsSlot={personActionsSlot} tipSlot={tipSlot} joinHouse={joinHouse}
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
    <div className="mx-auto w-full max-w-[520px] bg-chrome" aria-busy="true">
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
  houseSlot,
  personActionsSlot,
  safetySlot,
  tipSlot,
}: {
  stream: Stream;
  followSlot: SlotProps["followSlot"];
  safetySlot: SlotProps["safetySlot"];
  houseSlot?: SlotProps["houseSlot"];
  personActionsSlot?: SlotProps["personActionsSlot"];
  tipSlot?: SlotProps["tipSlot"];
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
      <LiveHouse houseSlot={houseSlot} personActionsSlot={personActionsSlot} tipSlot={tipSlot}
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
    <div className="mx-auto w-full max-w-[520px] bg-chrome">
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
    <div className="mx-auto w-full max-w-[520px] bg-chrome">
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
  houseSlot,
  personActionsSlot,
  tipSlot,
  joinHouse,
}: {
  stream: Stream;
  isHost: boolean;
  ingest?: Ingest | null;
  micId?: string;
} & SlotProps) {
  const router = useRouter();
  const gate = useGate();
  const me = useMe();
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

  /**
   * THE ROOM'S THREE LISTS ARE DISJOINT, and these two sets are what keeps
   * them that way.
   *
   * `speakerIds` are the people on stage, keyed on the BARE user id — an
   * approved speaker's LiveKit identity is `<did>#speaker`, so comparing raw
   * identities against a roster of profile ids never matches. House Members
   * drops anyone in this set.
   *
   * `houseMemberIds` comes back from the roster slot, and the Audience drops
   * anyone in it: an audience member who is also in the house is already drawn
   * under House Members, and the file's Audience is the people listening from
   * OUTSIDE — which is exactly who a public room lets in.
   */
  const speakerIds = useMemo(
    () =>
      new Set(
        slots.map((slot) =>
          // The host's publisher token has NO user id in it — its identity is
          // the literal string `broadcaster` — so the host slot is keyed on the
          // stream's own `ownerId` instead. Without this the host matched
          // nothing in the roster and appeared under Speakers AND House
          // Members, which is two records for one person.
          slot.role === "host" ? stream.ownerId : baseIdentity(slot.identity)
        )
      ),
    [slots, stream.ownerId]
  );

  /* Our own identity, read once. See the note on `isMe` below for why the
     token cannot supply it. */
  const myId = me.data?.id;
  const myName = me.data?.displayName || me.data?.username || null;
  const myAvatar = me.data?.avatarUrl ?? null;
  const [houseMemberIds, setHouseMemberIds] = useState<ReadonlySet<string>>(EMPTY_IDS);

  /*
    The house's DOORPLATE, straight off the room — id, title, picture, member
    count, visibility, and whether this viewer is already in it. Null for a
    room opened from the street, which belongs to no house.
  */
  const house = stream.house;
  /*
    WHICH ROSTER IS OPEN OVER THE CHAT — node 369:8741.

    One piece of state for both lists, because the panel takes the same column
    and only one can be in it. Holding the PEOPLE rather than a discriminator
    is what lets House Members — a list this component is not allowed to fetch —
    open the same panel as the Audience.
  */
  const [roster, setRoster] = useState<{ title: string; people: RoomPerson[] } | null>(
    null
  );
  const openRoster = useCallback(
    (title: string, people: RoomPerson[]) => setRoster({ title, people }),
    []
  );
  const closeRoster = useCallback(() => setRoster(null), []);

  const houseMembers = stream.houseConversationId
    ? (houseSlot?.(stream.houseConversationId, {
        speakerIds,
        onRoster: setHouseMemberIds,
        onViewAll: openRoster,
      }) ?? null)
    : null;

  const seating = useMemo(() => buildSeating(slots), [slots]);
  const audio = useHouseAudio(room);
  const audience = useAudience(room);

  const full = seatsFull(seating);

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

  /*
    THE FILE'S THREE LISTS, from the state the room already had.

    `Speakers` is the stage; `Audience` is everyone else in the room. They come
    from different sources on purpose — a slot is somebody publishing, an
    audience member is somebody connected — and the old ring collapsed both
    into one arrangement of eight chairs, which is why there was nowhere to put
    a room of thirty.

    `muted` reads the audio map rather than being inferred from silence: a
    person who simply is not talking is not muted, and drawing them as muted
    would be a claim about their microphone we did not check.
  */
  const speakerPeople: RoomPerson[] = useMemo(
    () =>
      seating.seats
        .filter((seat) => seat.slot !== null)
        .map((seat) => {
          const slot = seat.slot as StageSlot;
          // Null until the token carries it (B1). No username, no actions —
          // rather than a wink aimed at nobody.
          const meta = parseParticipantMeta(slot.metadata);
          const username = meta?.username ?? null;
          /*
            OUR OWN NAME COMES FROM `/me`, NEVER FROM THE TOKEN.

            The room token's `name` is the publisher label the service mints —
            literally the string "broadcaster" — so the host saw themselves
            listed as `broadcaster` in their own room. The token metadata that
            would name everybody else is backend B1 and has not shipped, but we
            have never needed it for OURSELVES: `/me` is already loaded. So the
            local participant is named and pictured from the signed-in profile,
            and everyone else still degrades to the token then to `Guest 4B2C`.
          */
          /*
            THE HOST IS NAMED FROM THE STREAM, NOT FROM THE TOKEN.

            `GET /streams/:id` already carries `owner` — id, username,
            displayName, avatarUrl — and the host's room token carries none of
            that: it is minted with the literal identity `broadcaster`. So the
            host tile reads the stream's owner, which works for EVERY viewer
            rather than only for the host looking at their own screen.

            An approved guest speaker still joins as `<did>#speaker`, so the
            `isMe` path below covers naming ourselves when we are that guest.
            Everyone else waits on token metadata (backend B1).
          */
          const owner = slot.role === "host" ? stream.owner : null;
          const isMe = myId !== undefined && baseIdentity(slot.identity) === myId;
          const ownerName = owner ? owner.displayName || owner.username : null;
          return {
            id: slot.identity,
            // The connection identifies the TILE; the person identifies the
            // FACE. `slot.identity` carries a `#broadcaster` / `#speaker`
            // suffix, and seeding generated artwork with it drew the host as
            // somebody else than the sidebar does.
            userId: owner ? owner.id : baseIdentity(slot.identity),
            name:
              ownerName ??
              (isMe && myName ? myName : participantLabel(slot.name, slot.identity)),
            avatarUrl: owner ? (owner.avatarUrl ?? null) : isMe ? myAvatar : (meta?.avatarUrl ?? null),
            speaking: audio.loudest === slot.identity,
            // The file draws a microphone on every speaker's plate. It reads
            // the PUBLICATION (`slot.isMuted`), which is their real microphone,
            // and falls back to muted when this viewer has silenced them — a
            // person you cannot hear must not be drawn as talking.
            mic: slot.isMuted || mutedForMe.has(slot.identity) ? "muted" : "on",
            // No wink-and-follow aimed at yourself.
            actions:
              owner && owner.id !== myId
                ? personActionsSlot?.(owner.username)
                : isMe || !username
                  ? undefined
                  : personActionsSlot?.(username),
            onOpen: () => openSlot(slot),
          };
        }),
    [seating, audio.loudest, mutedForMe, openSlot, personActionsSlot, myId, myName, myAvatar, stream.owner]
  );

  const audiencePeople: RoomPerson[] = useMemo(
    () =>
      audience
        // EXTERNAL ONLY. Somebody who belongs to this house is already drawn
        // under House Members; listing them again put the same face in two
        // sections of one screen. What is left is what the file's Audience
        // actually means — the people a PUBLIC room let in from outside.
        .filter((member: AudienceMember) => !houseMemberIds.has(member.userId))
        .map((member: AudienceMember) => {
          const isMe = myId !== undefined && member.userId === myId;
          return {
            id: member.identity,
            userId: member.userId,
            name: isMe && myName ? myName : member.name,
            avatarUrl: isMe ? myAvatar : (member.meta?.avatarUrl ?? null),
            actions:
              isMe || !member.meta?.username
                ? undefined
                : personActionsSlot?.(member.meta.username),
            onOpen: () => openMember(member),
          };
        }),
    [audience, houseMemberIds, openMember, personActionsSlot, myId, myName, myAvatar]
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
    /*
      NODE 129:11748. The room is TWO columns, not one narrow one.

      The file draws them 805 and 411 inside a 1440 frame. Only the CHAT is
      fixed at 411 — the stage takes whatever is left, which is why it has no
      max-width. Capping it at the file's 805 left everything past 1216px of
      pane as dead black parked on the right edge, which is exactly the bug the
      shell removed its own max-widths to fix.

      The people grid still reads from 744 up: six 104px cards on a 24px gutter
      is 6*104 + 5*24, and a wider stage simply wraps a seventh onto the row
      rather than leaving a margin nobody asked for.

      Below `xl` the right column drops under the left rather than squeezing:
      a 411px chat beside a 744px grid needs 1155px of room before the shell's
      own rail, and cramming it makes both unusable.
    */
    <main
      aria-label={houseTopic(stream)}
      /* `bg-chrome` (#0f0f0f) is the file's own frame fill, not `ws-wash`.
         The wash paints pure #000 with a radial highlight, which made the
         left column DARKER than the page it sits on and flattened the step up
         to the chat column's #121214 — the two read as one surface. Flat
         ground on the left, `--color-chrome` on the right, exactly as
         129:11887 and 129:12852 are painted. */
      className="flex w-full flex-col bg-chrome pb-[calc(var(--ws-nav-h)+72px)] xl:h-[calc(100dvh-var(--ws-crumb-h))] xl:flex-row xl:overflow-hidden xl:pb-0"
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

      {/* LEFT COLUMN — 805 in the file, 744 of content inside 32px gutters.
          A COLUMN, not a plain block: the file's bottom bar (129:12197) is the
          last thing in it, and it has to sit on the column's own bottom edge
          rather than beside the chat. */}
      <div className="ws-hair flex min-w-0 flex-1 flex-col xl:overflow-y-auto xl:border-r">

      <HouseHeader
        topic={houseTopic(stream)}
        house={house?.title}
        meta={
          // The file's line is the HOUSE's partner count. A room with no house
          // has no partners to count, so it falls back to what it does know:
          // who is actually in the room right now.
          (house && house.memberCount !== null ? (
            <>
              <span className="tnum">{house.memberCount}</span> gist{" "}
              {house.memberCount === 1 ? "partner" : "partners"}
            </>
          ) : null) ?? (
            <>
              <span className="tnum">{listening}</span> listening ·{" "}
              <span className="tnum">{speaking}</span> speaking
            </>
          )
        }
        onLeave={isHost ? () => setConfirmLeave(true) : leave}
        // The file's row 2 has two circles, not three. The overflow sheet the
        // third one opened is this one — both room links and the keyboard
        // shortcuts — so nothing was lost when the dots went.
        onShare={() => setOverflowSheet(true)}
        /*
          JOIN HOUSE IS NOW A REAL JOIN.

          It used to fire a speaker request, because there was no way to join a
          house group — which meant a button labelled "Join House" asked for a
          microphone instead. `POST /conversations/:id/join` exists, and the
          room now knows enough to offer it honestly:

            · absent once you are already a member — a Join button on something
              you have joined is the surest way to make a control look broken;
            · absent on a PRIVATE house, where the service would refuse with
              "ask a member to add you". The name still shows; the invitation
              does not, because there is nothing to accept.

          Asking for the floor is a different act and has its own control — the
          raised hand in the bottom bar.
        */
        join={
          joinHouse && house && house.visibility === "public" && !house.viewerIsMember
            ? {
                onJoin: () => gate(() => joinHouse?.onJoin(house.id)),
                state: joinHouse?.pending ? "pending" : "idle",
                reason: null,
              }
            : undefined
        }
      />

      {/*
        The cover: 741x200 at radius 24, and ONLY when there is one.

        A room without a picture used to get an empty 200px panel in its
        place. The file fills that rectangle white because it is drawing a room
        that HAS a cover; an empty tinted slab is not what it specifies, it is
        our stand-in for something that does not exist — and it reads as an
        image that failed to load rather than as a room that never had one. It
        also pushed Speakers 216px down the page to make room for nothing.

        So the whole block is absent, padding included: there is no gap where
        the cover would have been, and the section below simply starts higher.
      */}
      {stream.thumbnailUrl && (
        <div className="px-4 pt-4 xl:px-8">
          {/* A plain <img>: the host uploads this and the store types it, so
              `next/image` handed something it cannot decode is a crash this
              repo has already shipped twice. */}
          <img
            src={stream.thumbnailUrl}
            alt=""
            className="h-[200px] w-full rounded-3xl object-cover"
          />
        </div>
      )}

      <div className={cn("flex flex-col gap-6 px-4 pb-6 pt-10 xl:px-8", state === "failed" && "opacity-40")}>
        <RoomPeopleSection
          title="Speakers"
          rule={false}
          people={speakerPeople}
          empty="Nobody has the floor yet."
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

      <div className="flex flex-col gap-6 px-4 pb-6 xl:px-8">
        {/*
          HOUSE MEMBERS is the roster of the group this room belongs to, and it
          is genuinely a different list from the AUDIENCE: a member may not be
          here, and somebody here may not be a member. It renders only when the
          room HAS a house group — a room opened from the street belongs to no
          house, and an empty "House Members" would invent one.

          The roster arrives through a slot, because it is a conversation and
          slices never import each other.
        */}
        {houseMembers}

        <RoomPeopleSection
          title="Audience"
          people={audiencePeople}
          /* The file ends a full grid with "View all" (369:9337) and opens the
             roster over the chat. It appears only when there IS more than the
             grid shows — a control that opens a panel identical to what you are
             already looking at is a control that lies about having more. */
          onViewAll={
            audiencePeople.length > GRID_TILES
              ? () => openRoster("Audience", audiencePeople)
              : undefined
          }
          empty={
            house
              ? "Nobody from outside the house is listening yet."
              : "Nobody is listening yet."
          }
        />
      </div>

      {stream.description?.trim() && (
        <div className="ws-row flex items-start gap-3 px-4 py-3 xl:px-8">
          <IconLink className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
          <p className="min-w-0 flex-1 text-[13px] leading-5 text-body">
            {stream.description.trim()}
          </p>
        </div>
      )}

      <CaptionRail captionUrl={playback.data?.captionUrl ?? null} />

      {/* Everything above scrolls; the bar below is pinned to the column's
          bottom edge. `mt-auto` rather than `sticky`, because the column is
          only viewport-tall from `xl` — on a phone the page scrolls as one and
          the bar belongs at the end of it, under the mobile control pill. */}
      <div className="mt-auto" />
      <RoomDock
        /* The host records; everyone else tips (129:12198 / 121:10996). The
           tip control is the tips slice's and comes in through a slot, and it
           removes itself where a tip could not be taken — so a room with no
           tippable host simply has an empty left edge, as the file's host
           frame does before Record Gist is pressed. */
        primary={isHost ? <RecordGistButton /> : (tipSlot?.(stream.id, stream.owner) ?? null)}
        mic={
          onStage
            ? {
                on: micOn,
                toggle: () => void micToggle(),
                disabled: state === "reconnecting" || state === "failed",
              }
            : null
        }
        /* The same request state the header's "Join House" pill drives, and
           the same mutations — one queue, one poll, two places to reach it. */
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
        onReact={() => live.react(1)}
        className="xl:sticky xl:bottom-0"
      />

      </div>
      {/* ── END LEFT COLUMN ──────────────────────────────────────────────── */}

      {/*
        RIGHT COLUMN — 411, painted `--color-chrome`, carrying the host's
        Speaker Request panel over the room's chat. It is a column on a wide
        screen and a stacked block below `xl`; it is never hidden, because the
        chat is the only way somebody without a seat can say anything.
      */}
      <aside className="ws-hair flex w-full shrink-0 flex-col border-t bg-chrome xl:h-[calc(100dvh-var(--ws-crumb-h))] xl:w-[411px] xl:border-l xl:border-t-0 xl:overflow-hidden">
        {/*
          THE ROSTER TAKES THIS COLUMN WHILE IT IS OPEN — 369:8740.

          Not a dialog: the stage keeps playing beside it and the room is still
          audible, which is the whole reason the file puts it here rather than
          over the middle. Closing puts the chat back exactly as it was, because
          the chat is not unmounted by this — it is `hidden`, so its scroll
          position and its poll survive being covered.
        */}
        {roster && (
          <div className="min-h-0 flex-1 p-6">
            <RoomRosterPanel
              title={roster.title}
              people={roster.people}
              onClose={closeRoster}
              actionsSlot={(username) => personActionsSlot?.(username, "labelled")}
            />
          </div>
        )}
        <div className={cn("flex min-h-0 flex-1 flex-col", roster && "hidden")}>
        {/* SPEAKER REQUEST — node 129:12809, host only, above the chat. It used
            to be the tray SHEET mounted here, which renders nothing until it
            opens, so the band the file draws was simply a 48px hole. */}
        {isHost && (
          <SpeakerRequestPanel
            stream={stream}
            seatsFull={full}
            onManage={() => setTray(true)}
          />
        )}

        {/* The file's "Gistroom Chat". A gist room IS a stream, so this is the
            same chat endpoint every stream has — not a second one. The heading
            is the file's own 24px row over a hairline; the panel below it draws
            the room's purple bubbles and pill composer (variant "room"). */}
        <div className="flex min-h-0 flex-1 flex-col">
          <h2 className="shrink-0 border-b border-white/10 px-6 py-6 text-[14px] font-bold leading-5 text-white">
            Gistroom Chat
          </h2>
          <div className="min-h-0 flex-1">
            <ChatPanel stream={stream} variant="room" />
          </div>
        </div>
        </div>
      </aside>

      {/*
        THE FLOATING CONTROL PILL IS A PHONE PATTERN, and from `xl` it is gone.

        Every one of its controls has a place in the file's own desktop chrome:
        the microphone and the heart are in the bottom bar (129:12197), leaving
        is the header's red circle (129:11905), asking for the floor is
        "Join House" (129:11893), and the host's queue is the Speaker Request
        band (129:12809). Keeping it as well would draw each of them twice, one
        of the two floating over the file's layout.

        Below `xl` there is no such chrome — the columns stack, the bar is at
        the very bottom of a long page, and this pill is the only thing within
        reach — so it stays exactly as it was.
      */}
      <HouseControls
        className="xl:hidden"
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

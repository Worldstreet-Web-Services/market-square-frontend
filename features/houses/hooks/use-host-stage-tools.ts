"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useInviteToSpeak,
  useMuteSpeaker,
  useResolveSpeakerRequest,
  useSpeakerInvites,
} from "@/features/streams/hooks/use-streams";
import { baseIdentity, type StageSlot } from "@/features/streams/lib/stage";
import { participantName } from "@/features/houses/lib/participant-meta";
import type { SpeakerRequest, Stream } from "@/features/streams/lib/types";
import type { PersonHostActions, PersonTarget } from "@/features/houses/components/person-sheet";
import type { InvitedList } from "@/features/houses/components/invited-group";
import { SEAT_COUNT } from "@/features/houses/lib/seating";
import {
  hostOutcomeLabel,
  inviteControl,
  invitesByUser,
  settleInvites,
  type TrackedInvite,
} from "@/lib/speaker-invite";
import { hostMuteControl } from "@/lib/host-mute";

const NO_REQUESTS: readonly SpeakerRequest[] = [];
const NO_IDS: ReadonlySet<string> = new Set();

/**
 * THE HOST'S STAGE TOOLS: invite to speak and the soft mute.
 *
 * Every decision is in lib/ (speaker-invite, host-mute); this hook only holds
 * the reads, the writes and the clock they need, so the room view draws what
 * it is handed. All of it is AHEAD OF THE BACKEND and goes quiet for the page
 * load the moment the service says a route is not deployed: the controls
 * disappear, and nothing claims an invitation or a mute that did not happen.
 *
 * What the host is told when an invitation ends without a seat is the same
 * whether it was refused or ran out — "<name> isn't available to speak right
 * now" — and is settled by what happened to the PERSON (`settleInvites`):
 * seated says nothing, a Cancel says nothing, and a grace keeps an accept seen
 * in one read before the seat lands in another from reading as a refusal.
 */
export function useHostStageTools({
  stream,
  isHost,
  myId,
  slots,
  seatedUserIds,
  stageFull,
  sheetOpen,
}: {
  stream: Stream;
  isHost: boolean;
  myId: string | undefined;
  slots: readonly StageSlot[];
  /** Everybody on a seat or approved for one, by bare user id. */
  seatedUserIds: ReadonlySet<string>;
  stageFull: boolean;
  /** A person sheet is open: a cooldown's countdown keeps counting. */
  sheetOpen: boolean;
}) {
  const live = isHost && stream.status === "live";
  const invites = useSpeakerInvites(stream.id, live);
  const invite = useInviteToSpeak(stream.id);
  const mute = useMuteSpeaker(stream.id);
  const resolve = useResolveSpeakerRequest(stream.id);

  const unavailable = invite.unavailable || invites.unavailable;
  const items = unavailable ? NO_REQUESTS : (invites.data?.items ?? NO_REQUESTS);
  const openInvites = useMemo(() => invitesByUser(items), [items]);

  /* ---- cancel, and the host's outcome line ------------------------------ */

  const resolveMutate = resolve.mutate;
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(NO_IDS);
  const cancel = useCallback(
    (requestId: string) => {
      setCancelled((current) => new Set(current).add(requestId));
      resolveMutate({ requestId, action: "cancel" });
    },
    [resolveMutate]
  );

  const tracked = useRef<TrackedInvite[]>([]);
  const settle = useCallback(() => {
    const step = settleInvites(tracked.current, {
      open: items.map((item) => ({
        id: item.id,
        userId: baseIdentity(item.userId),
        name: item.profile?.displayName || item.profile?.username || "",
      })),
      seatedUserIds,
      cancelledIds: cancelled,
      now: Date.now(),
    });
    tracked.current = step.tracked;
    for (const gone of step.unavailable) toast(hostOutcomeLabel(gone.name));
  }, [items, seatedUserIds, cancelled]);
  const settling = live && !unavailable;
  useEffect(() => {
    if (!settling) return;
    settle();
    // The grace runs out between polls, so the reading is repeated.
    const timer = setInterval(settle, 2_000);
    return () => clearInterval(timer);
  }, [settling, settle]);

  /* ---- the clock a cooldown reads ---------------------------------------- */

  const [now, setNow] = useState(() => Date.now());
  const ticking = isHost && sheetOpen;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ticking]);

  /* ---- what the surfaces are handed ------------------------------------- */

  const inviteMutate = invite.mutate;
  const muteMutate = mute.mutate;
  const busy = invite.isPending || mute.isPending || resolve.isPending;

  /** The host's rows in the person sheet. Null for anyone but a live room's host. */
  const actionsFor = (person: PersonTarget | null): PersonHostActions | null => {
    if (!person || !live) return null;
    const userId = person.isRoomHost ? stream.ownerId : baseIdentity(person.identity);
    const isSelf = person.isRoomHost || userId === myId;
    return {
      invite: inviteControl({
        viewerIsHost: true,
        isSelf,
        target: {
          identity: person.identity,
          seated: person.seated,
          pendingRequestId: person.pendingRequestId,
          openInviteId: openInvites.get(userId)?.id ?? null,
        },
        stageFull,
        seatCount: SEAT_COUNT,
        unavailable,
        refused: invite.refused.has(userId),
        cooldownUntil: invite.cooldowns.get(userId) ?? null,
        now,
      }),
      onInvite: () => inviteMutate({ userId, name: person.name }),
      onCancelInvite: cancel,
      mute: hostMuteControl({
        viewerIsHost: true,
        seated: person.seated,
        targetIsHost: person.isRoomHost,
        isSelf,
        micMuted: person.micMuted,
        unavailable: mute.unavailable,
      }),
      onMute: () => muteMutate({ userId, name: person.name }),
      busy,
    };
  };

  /** The tray's Seated rows: the same soft mute, read off the seat's live mic. */
  const muteFor = (userId: string) => {
    const base = baseIdentity(userId);
    const slot = slots.find((item) => item.role !== "host" && baseIdentity(item.identity) === base);
    const name = slot ? (participantName(slot.name) ?? slot.name) : "them";
    return {
      control: hostMuteControl({
        viewerIsHost: live,
        seated: slot !== undefined,
        targetIsHost: base === stream.ownerId,
        isSelf: base === myId,
        micMuted: slot ? slot.isMuted : true,
        unavailable: mute.unavailable,
      }),
      onMute: () => muteMutate({ userId: base, name }),
    };
  };

  const invited: InvitedList = {
    items,
    busy: resolve.isPending,
    onCancel: (item) => cancel(item.id),
  };

  return { openInvites, actionsFor, muteFor, invited };
}

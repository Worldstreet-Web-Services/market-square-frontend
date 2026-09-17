"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { inviteMemoryFor, rememberEndedInvite } from "@/features/streams/lib/invite-memory";
import { serverClockOffset } from "@/lib/server-clock";
import {
  cancelFailedForReal,
  hostOutcomeLabel,
  inviteControl,
  settleInvites,
  visibleInvites,
  type ApiErrorLike,
  type TrackedInvite,
} from "@/lib/speaker-invite";
import { hostMuteControl } from "@/lib/host-mute";

const NO_REQUESTS: readonly SpeakerRequest[] = [];

// The host's invitations and what the service said about people are held per
// stream for the page load, outside this hook (features/streams/lib/invite-memory.ts).
const memoryFor = inviteMemoryFor;

function sameIds(a: readonly TrackedInvite[], b: readonly TrackedInvite[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id && item.deadline === b[index]?.deadline);
}

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
 * seated says nothing, a Cancel says nothing. It is never said, and the row
 * never leaves the screen, before the invitation's own deadline: when it
 * went would otherwise tell the host a refusal from a lapse.
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
  const streamId = stream.id;

  /* ---- tracking, cancel, and the host's outcome line --------------------- */

  const [visible, setVisible] = useState<TrackedInvite[]>(() => visibleInvites(memoryFor(streamId).tracked, Date.now()));
  const settle = useCallback(() => {
    const now = Date.now();
    const memory = memoryFor(streamId);
    for (const item of items) memory.rows.set(item.id, item);
    const step = settleInvites(memory.tracked, {
      open: items.map((item) => ({
        id: item.id,
        userId: baseIdentity(item.userId),
        name: item.profile?.displayName || item.profile?.username || "",
        inviteExpiresAt: item.inviteExpiresAt,
        createdAt: item.createdAt,
      })),
      seatedUserIds,
      cancelledIds: memory.cancelled,
      endedIds: memory.ended,
      offsetMs: serverClockOffset(),
      now,
    });
    memory.tracked = step.tracked;
    for (const gone of step.unavailable) {
      memory.ended.add(gone.id);
      // The service's cooldown started when it ended: the control says so now.
      rememberEndedInvite(memory, gone);
    }
    const keep = new Set(step.tracked.map((item) => item.id));
    for (const id of memory.rows.keys()) if (!keep.has(id)) memory.rows.delete(id);
    const shown = visibleInvites(step.tracked, now);
    setVisible((current) => (sameIds(current, shown) ? current : shown));
    for (const gone of step.unavailable) toast(hostOutcomeLabel(gone.name));
  }, [items, seatedUserIds, streamId]);
  const settling = live && !unavailable;
  useEffect(() => {
    if (!settling) return;
    // Every second: the deadline and the grace run out between polls.
    const timer = setInterval(settle, 1_000);
    return () => clearInterval(timer);
  }, [settling, settle]);

  const resolveMutateAsync = resolve.mutateAsync;
  const cancel = useCallback(
    (requestId: string) => {
      memoryFor(streamId).cancelled.add(requestId);
      settle();
      // A Cancel on an invitation that already ended answers INVITE_NOT_OPEN,
      // which useResolveSpeakerRequest takes as the success it is. Any other
      // failure leaves the invitation open on the server, so it comes back on
      // the host's screen (the next settle re-reads it) rather than staying
      // hidden and uncancellable. The promise, not a per-call onError: that
      // one is dropped if the room page unmounts first.
      resolveMutateAsync({ requestId, action: "cancel" }).catch((error: unknown) => {
        if (cancelFailedForReal(error as ApiErrorLike)) memoryFor(streamId).cancelled.delete(requestId);
      });
    },
    [streamId, settle, resolveMutateAsync]
  );

  const shownRows = useMemo(
    () =>
      visible.flatMap((tracked) => {
        const request = memoryFor(streamId).rows.get(tracked.id);
        return request ? [{ request, deadline: tracked.deadline, timed: tracked.timed }] : [];
      }),
    [visible, streamId]
  );
  /** Open invitations by bare user id — the card badge and the sheet's Cancel. */
  const openInvites = useMemo(() => new Map(visible.map((tracked) => [tracked.userId, tracked])), [visible]);

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

  /** The live seat behind a user id — never a snapshot taken when a sheet opened. */
  const seatOf = (base: string) => slots.find((item) => item.role !== "host" && baseIdentity(item.identity) === base);

  /** The host's rows in the person sheet. Null for anyone but a live room's host. */
  const actionsFor = (person: PersonTarget | null): PersonHostActions | null => {
    if (!person || !live) return null;
    const userId = person.isRoomHost ? stream.ownerId : baseIdentity(person.identity);
    const isSelf = person.isRoomHost || userId === myId;
    const seat = person.isRoomHost ? undefined : seatOf(userId);
    const seated = person.isRoomHost || seat !== undefined;
    return {
      invite: inviteControl({
        viewerIsHost: true,
        isSelf,
        target: {
          identity: person.identity,
          seated,
          pendingRequestId: person.pendingRequestId,
          openInviteId: openInvites.get(userId)?.id ?? null,
          present: person.present,
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
        seated,
        targetIsHost: person.isRoomHost,
        isSelf,
        // Read off the seat as it is NOW: after a mute lands the row turns to
        // "Their mic is already off" instead of inviting a second one.
        micMuted: seat ? seat.isMuted : true,
        unavailable: mute.unavailable,
      }),
      onMute: () => muteMutate({ userId, name: person.name }),
      busy,
    };
  };

  /** The tray's Seated rows: the same soft mute, read off the seat's live mic. */
  const muteFor = (userId: string) => {
    const base = baseIdentity(userId);
    const slot = seatOf(base);
    const name = slot ? (participantName(slot.name) ?? slot.name) : "them";
    return {
      name,
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
    items: shownRows,
    busy: resolve.isPending,
    onCancel: (item) => cancel(item.request.id),
  };

  return { openInvites, actionsFor, muteFor, invited };
}

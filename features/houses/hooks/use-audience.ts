"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Participant, Room } from "livekit-client";
import { baseIdentity, participantLabel } from "@/features/streams/lib/stage";
import {
  parseParticipantMeta,
  participantName,
  type ParticipantMeta,
} from "@/features/houses/lib/participant-meta";

/**
 * Everyone in the room who is NOT on a seat.
 *
 * The brief's core loop lives here: "tapping any face opens that person's
 * profile — this is the main discovery path". So three rules hold, and none of
 * them is negotiable:
 *
 *   1. The band NEVER collapses to a number. `+412` is where this product
 *      dies — the whole point is that the audience is people, and a count is
 *      the one rendering that says it is not.
 *   2. Every face is tappable, all the way down. A link when we know the
 *      handle (backend B1), a button onto what we do know when we do not.
 *      Never an inert div.
 *   3. Joins and leaves are SILENT. No toast, no announcement, no join line.
 *      Discord silences stage audiences on purpose, and a three-hundred-person
 *      room with polite announcements is unusable with a screen reader.
 */

export interface AudienceMember {
  identity: string;
  /** The user id behind the identity — an approved speaker joins as `<did>#speaker`. */
  userId: string;
  name: string;
  /** Null until backend B1 ships. Null means "no profile link", not "no profile". */
  meta: ParticipantMeta | null;
  joinedAt: number;
  isLocal: boolean;
}

export interface AudienceBand {
  /** Null renders the grid with NO header — never an empty band header. */
  title: string | null;
  members: AudienceMember[];
}

/**
 * How many faces render before the room asks.
 *
 * A cap, not a collapse: past it there is a full-width row reading "Show 240
 * more", which raises the cap by another 240. No windowing library, no new
 * dependency, and — the part that matters — no number standing in for people.
 */
export const AUDIENCE_PAGE = 240;

function toMember(participant: Participant): AudienceMember {
  const meta = parseParticipantMeta(participant.metadata);
  const joined = participant.joinedAt;
  return {
    identity: participant.identity,
    userId: baseIdentity(participant.identity),
    // The token's own name first (B1), then the shared label helper — which
    // already knows never to render a raw `did:privy:…` at anybody.
    name: participantName(participant.name) ?? participantLabel(undefined, participant.identity),
    meta,
    joinedAt:
      joined instanceof Date
        ? joined.getTime()
        : typeof joined === "number"
          ? joined
          : Number.MAX_SAFE_INTEGER,
    isLocal: participant.isLocal === true,
  };
}

export function useAudience(room: Room | null): AudienceMember[] {
  const [members, setMembers] = useState<AudienceMember[]>([]);

  const recompute = useCallback(() => {
    if (!room) return;
    const everyone: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    const next = everyone
      // Membership is the publish GRANT, exactly as the stage reads it: anyone
      // who can publish is at the table, everyone else is in the room. Keying
      // off "has an audio track" would drop a seated speaker who is muted back
      // into the audience while they are still in their chair.
      .filter((participant) => participant.permissions?.canPublish !== true)
      .map(toMember)
      .sort((a, b) => (a.joinedAt === b.joinedAt ? a.identity.localeCompare(b.identity) : a.joinedAt - b.joinedAt));
    setMembers((previous) => (same(previous, next) ? previous : next));
  }, [room]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      const events = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        // The demotion/promotion signal. Somebody moving between the table and
        // the room is already in it, so no connect event will ever fire again.
        RoomEvent.ParticipantPermissionsChanged,
        RoomEvent.ParticipantNameChanged,
        RoomEvent.ParticipantMetadataChanged,
        RoomEvent.Connected,
        RoomEvent.Reconnected,
      ] as const;
      for (const event of events) room.on(event, recompute);
      unsubscribe = () => {
        for (const event of events) room.off(event, recompute);
      };
      // Enumerate what is already there. Everyone in an in-progress room joined
      // before we did, so an event-only reader sees an empty audience forever.
      recompute();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [room, recompute]);

  return room ? members : EMPTY;
}

const EMPTY: AudienceMember[] = [];

function same(a: readonly AudienceMember[], b: readonly AudienceMember[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((member, index) => {
    const other = b[index];
    return (
      member.identity === other.identity &&
      member.name === other.name &&
      member.meta?.username === other.meta?.username
    );
  });
}

/**
 * The bands, in order.
 *
 * Each one is omitted entirely when it cannot be computed — never rendered
 * empty, and never invented. With none of them computable the answer is ONE
 * unheaded grid, which is a complete, correct rendering rather than a
 * degraded one.
 */
export function useAudienceBands(
  members: readonly AudienceMember[],
  recentSpeakers: ReadonlySet<string>
): AudienceBand[] {
  return useMemo(() => {
    const bands: AudienceBand[] = [];
    const placed = new Set<string>();

    // PEOPLE YOU FOLLOW needs the follow edge, which rides in on the token's
    // metadata (B1). `isFollowing` is deliberately never defaulted anywhere in
    // this app: undefined means "this payload does not carry the edge", which
    // is not "you do not follow them", and defaulting it would render a band
    // that quietly claims you follow nobody here.
    const following = members.filter((member) => member.meta?.isFollowing === true);
    if (following.length > 0) {
      bands.push({ title: "People you follow", members: following });
      for (const member of following) placed.add(member.identity);
    }

    const spoke = members.filter(
      (member) => !placed.has(member.identity) && recentSpeakers.has(member.identity)
    );
    if (spoke.length > 0) {
      bands.push({ title: "Spoke recently", members: spoke });
      for (const member of spoke) placed.add(member.identity);
    }

    const rest = members.filter((member) => !placed.has(member.identity));
    // Unheaded. When it is the only band this is the whole grid, and a lone
    // header reading "Everyone else" over the complete list would be furniture.
    if (rest.length > 0) bands.push({ title: null, members: rest });
    return bands;
  }, [members, recentSpeakers]);
}

"use client";

import Link from "next/link";
import { atHandle } from "@/lib/handle";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconChevronRight } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { ParticipantMeta } from "@/features/houses/lib/participant-meta";

/**
 * A profile, OVER the room.
 *
 * The room does not unmount and the audio does not cut. That is load-bearing
 * rather than a nicety: the discovery loop the brief describes is "listen to
 * someone, look them up, keep listening", and a full-page navigation breaks it
 * in the middle — you lose the conversation that made you curious in the first
 * place. Exactly one thing here navigates, and it says so.
 *
 * Composed with the profile slice through render-prop slots, because slices
 * never import each other; `components/layout/house-room-screen.tsx` is the one
 * place allowed to join the two.
 */
export interface PersonTarget {
  identity: string;
  name: string;
  meta: ParticipantMeta | null;
  /** Present when this person is on a seat — the host may move them down. */
  seated: boolean;
  /** Present when this person is in the audience with a hand up. */
  pendingRequestId: string | null;
}

export function PersonSheet({
  person,
  open,
  onClose,
  isHost,
  hostBusy,
  onMoveDown,
  onSeat,
  mute,
  followSlot,
  safetySlot,
}: {
  person: PersonTarget | null;
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  hostBusy: boolean;
  onMoveDown: (person: PersonTarget) => void;
  onSeat: (person: PersonTarget) => void;
  mute: { muted: boolean; onToggle: () => void } | null;
  followSlot: (username: string) => React.ReactNode;
  safetySlot: (
    username: string,
    mute: { muted: boolean; onToggle: () => void } | undefined
  ) => React.ReactNode;
}) {
  if (!person) return null;
  const username = person.meta?.username ?? null;

  return (
    <Sheet open={open} onClose={onClose} title={person.name}>
      <div className="flex items-start gap-3">
        <Avatar
          name={person.name}
          seed={username ?? person.identity}
          src={person.meta?.avatarUrl}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[15px] font-bold text-heading">{person.name}</span>
            {person.meta && (
              <>
                <VerifiedBadge
                  verification={person.meta.verification}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <OrgBadgeChip orgBadge={person.meta.orgBadge} />
                <RoleChip role={person.meta.role} />
              </>
            )}
          </div>
          {atHandle(username) && <p className="truncate text-[12px] text-meta">{atHandle(username)}</p>}
          {person.meta?.bio && (
            <p className="mt-1 text-[13px] leading-5 text-body">{person.meta.bio}</p>
          )}
        </div>
        {username && followSlot(username)}
      </div>

      {/* BACKEND B1. Without identity on the LiveKit token there is no handle,
          so there is no profile to open and no safety action to key on. Say so
          plainly rather than rendering controls that cannot resolve. */}
      {!username && (
        <p className="mt-4 text-[12px] leading-5 text-meta">
          We only know this person by their seat in the room. Their profile will open here once
          the service puts identity on the room token.
        </p>
      )}

      <div className="ws-hair mt-4 border-t pt-2">
        {/* Host actions first: they are the ones with a decision to make, and
            they are the ones this sheet was opened FOR mid-conversation. */}
        {isHost && person.seated && (
          <button
            type="button"
            disabled={hostBusy}
            onClick={() => onMoveDown(person)}
            className="ws-row flex w-full items-center px-1 py-3 text-left text-[13px] font-semibold text-body transition-colors disabled:opacity-50"
          >
            Move down to audience
          </button>
        )}
        {isHost && !person.seated && person.pendingRequestId && (
          <button
            type="button"
            disabled={hostBusy}
            onClick={() => onSeat(person)}
            className="ws-row flex w-full items-center px-1 py-3 text-left text-[13px] font-semibold text-body transition-colors disabled:opacity-50"
          >
            Seat them
          </button>
        )}

        {username && (
          <Link
            href={`/u/${username}`}
            className="ws-row flex w-full items-center gap-3 px-1 py-3 text-[13px] font-semibold text-body"
          >
            {/* The ONE thing here that navigates, and the label says so. */}
            <span className="min-w-0 flex-1">View full profile</span>
            <IconChevronRight className="h-4 w-4 text-meta" />
          </Link>
        )}

        {/* Mute · Block · Report, in that order. Mute is first because
            blocking in a room of twelve is a public act with a social cost, so
            people do not do it and eat the harassment instead. */}
        {username
          ? safetySlot(username, mute ?? undefined)
          : mute && (
              <button
                type="button"
                onClick={mute.onToggle}
                className="ws-row flex w-full items-center px-1 py-3 text-left text-[13px] font-semibold text-body"
              >
                {mute.muted ? "Unmute for me" : "Mute for me"}
              </button>
            )}
      </div>
    </Sheet>
  );
}

"use client";

import Link from "next/link";
import { atHandle } from "@/lib/handle";
import { Avatar } from "@/components/ui/avatar";
import { RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconChevronRight } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { ParticipantMeta } from "@/features/houses/lib/participant-meta";
import { sq } from "@/lib/square-path";
import type { InviteControl } from "@/lib/speaker-invite";
import type { HostMuteControl } from "@/lib/host-mute";

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
  /** Their microphone is muted or not published (seated people only). */
  micMuted: boolean;
  /** This seat is the room's host — whom nobody mutes. */
  isRoomHost: boolean;
}

/** The host's rows over one person, decided in lib/ (speaker-invite, host-mute) and only drawn here. */
export interface PersonHostActions {
  invite: InviteControl;
  onInvite: () => void;
  onCancelInvite: (requestId: string) => void;
  mute: HostMuteControl;
  onMute: () => void;
  busy: boolean;
}

export function PersonSheet({
  person,
  open,
  onClose,
  isHost,
  hostBusy,
  onMoveDown,
  onSeat,
  hostActions,
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
  hostActions: PersonHostActions | null;
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
        {/* Soft only: the speaker may unmute themselves. There is no lock and
            no host unmute; the escalation is "Move down to audience". */}
        {isHost && hostActions && hostActions.mute.kind === "mute" && (
          <HostRow
            label={hostActions.mute.label}
            hint={hostActions.mute.disabled ? hostActions.mute.reason : "They can unmute when it's their turn."}
            disabled={hostActions.mute.disabled || hostActions.busy}
            onClick={hostActions.onMute}
          />
        )}
        {isHost && person.seated && (
          <HostRow label="Move down to audience" disabled={hostBusy} onClick={() => onMoveDown(person)} />
        )}
        {isHost && !person.seated && hostActions?.invite.kind === "seat" && (
          <HostRow label="Seat them" disabled={hostBusy} onClick={() => onSeat(person)} />
        )}
        {/* Without the invite routes (not deployed) a raised hand still seats. */}
        {isHost && !person.seated && !hostActions && person.pendingRequestId && (
          <HostRow label="Seat them" disabled={hostBusy} onClick={() => onSeat(person)} />
        )}
        {isHost && hostActions?.invite.kind === "invite" && (
          <HostRow
            label="Invite to speak"
            hint={hostActions.invite.disabled ? hostActions.invite.reason : "They'll be asked first. Their mic stays off until they tap it."}
            disabled={hostActions.invite.disabled || hostActions.busy}
            onClick={hostActions.onInvite}
          />
        )}
        {isHost && hostActions?.invite.kind === "invited" && (
          <HostRow
            label="Cancel invitation"
            hint="Invited. Waiting for them to answer."
            disabled={hostActions.busy}
            onClick={() => {
              if (hostActions.invite.kind === "invited") hostActions.onCancelInvite(hostActions.invite.requestId);
            }}
          />
        )}

        {username && (
          <Link
            href={sq(`/u/${username}`)}
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
                {mute.muted ? "Unmute for me" : "Mute for me only"}
              </button>
            )}
      </div>
    </Sheet>
  );
}

function HostRow({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="ws-row flex w-full flex-col items-start px-1 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-[13px] font-semibold text-body">{label}</span>
      {hint && <span className="mt-0.5 text-[11px] leading-4 text-meta">{hint}</span>}
    </button>
  );
}

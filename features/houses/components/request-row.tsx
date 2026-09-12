"use client";

import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import type { SpeakerRequest } from "@/features/streams/lib/types";

/**
 * One person asking to speak — node 129:12815's row.
 *
 * THE FILE'S NUMBERS: a 315×54.5 row at `white/3` inside a 1px `white/10` at a
 * 12px radius, a 38px avatar (`white/10` fill, `white/20` ring), the name at
 * Bold 12/16 and "N followers" at 11/16.5 in 50% white, then a Reject/Accept
 * pair at 4px 8px with an 8px gap. Reject is a transparent pill with
 * `#FF383C` (`--color-danger`); Accept is a white pill with black ink, both at
 * SemiBold 11/16. All verbatim.
 *
 * It lives in its OWN file because two surfaces draw it: the always-present
 * Speaker Request panel in the room's right column (129:12809) and the host's
 * triage sheet. One row, one set of numbers — the alternative is two that
 * drift.
 *
 * The bio line an earlier version carried is gone: the file gives this row 54px
 * and three lines of text do not fit in it. The follower count replaces it,
 * which is what a host actually weighs when deciding whether to hand somebody a
 * microphone. Verification and org badges stay — they sit inline with the name
 * and cost no height.
 */
export function RequestRow({
  request,
  disabled,
  disabledReason,
  onSeat,
  onDismiss,
  busy,
}: {
  request: SpeakerRequest;
  disabled: boolean;
  disabledReason: string | undefined;
  onSeat: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const profile = request.profile;
  return (
    <div className="flex h-[54.5px] items-center gap-[9px] rounded-xl border border-white/10 bg-white/[0.03] px-3">
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[25%] border border-white/20 bg-white/10">
        <Avatar
          name={profile?.displayName ?? "Listener"}
          seed={request.userId}
          src={profile?.avatarUrl}
          size={38}
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          {/* Never fabricated: with no hydrated profile the row says
              "Listener" rather than inventing a name from an id. */}
          <span className="truncate text-[12px] font-bold leading-4 text-white">
            {profile?.displayName ?? "Listener"}
          </span>
          {profile && (
            <>
              <VerifiedBadge verification={profile.verification} className="h-3 w-3 shrink-0" />
              <OrgBadgeChip orgBadge={profile.orgBadge} />
              <RoleChip role={profile.role} />
            </>
          )}
        </div>
        {/* The file shows a follower count; the handle is the fallback when the
            directory reports none, because "0 followers" says less about a
            person than their handle does. */}
        <span className="block truncate text-[11px] leading-[16.5px] text-white/50">
          {profile && profile.followerCount > 0
            ? `${profile.followerCount.toLocaleString()} followers`
            : profile
              ? `@${profile.username}`
              : "Asking to speak"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="ws-press rounded-full px-2 py-1 text-[11px] font-semibold leading-4 text-danger transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onSeat}
          disabled={busy || disabled}
          title={disabled ? disabledReason : undefined}
          className="ws-press rounded-full bg-white px-2 py-1 text-[11px] font-semibold leading-4 text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Accept
        </button>
      </div>
    </div>
  );
}

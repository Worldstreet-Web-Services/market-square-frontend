"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { useFollow } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

/**
 * ONE row for a person, wherever people are listed.
 *
 * Explore's People results are the first caller; the who-to-follow rail and
 * follower lists are the obvious next ones. It is built once here rather than
 * styled again per surface, because a second variant is how two follow
 * controls with two different behaviours end up shipping.
 *
 * Geometry is the design's: 38px avatar, the text block starting 47px in
 * (38 + 9 gap), name 700 12/16 and handle 400 11/16 at 50% white, and a 60×24
 * white pill on the right.
 *
 * The spec's 39px is the CONTENT height, not the row height — at 39px a 38px
 * avatar has half a pixel above and below it, so it touches both edges and the
 * list reads as one solid block. The row therefore carries 12px of its own
 * vertical padding (~62px total) and the divider spans the full width beneath
 * it rather than hugging the content. A design gives you the content box; the
 * whitespace around it is ours to get right.
 *
 * TYPE: the spec names Roboto; the app is Geist throughout, so this renders at
 * the specified weights and sizes in the house face rather than forking the
 * type system for one row — the same call already made for the topic picker's
 * chips, which come from the same design dump.
 *
 * LAYOUT: the spec draws a fixed ~503px gap between the text and the button.
 * That is Figma's absolute positioning, not a rule — the button is pinned
 * right with `justify-between` and the text block flexes, so it holds at any
 * column width. The text truncates; the button never shrinks.
 */
export function PersonRow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const me = useMe();
  // Hooks must all run before any early return.
  const isFollowing = useIsFollowing(profile);
  // Never offer to follow yourself. Compared against the real viewer rather
  // than assumed impossible — you can absolutely match your own search.
  const isMe = me.data?.id === profile.id;

  return (
    <div className="ws-row flex items-center gap-[9px] px-4 py-3">
      {/* The row links to the profile — except the button, which is why the
          link wraps the identity block rather than the whole row. */}
      <Link href={`/u/${profile.username}`} className="flex min-w-0 flex-1 items-center gap-[9px]">
        <span className="shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
          <Avatar
            name={profile.displayName}
            seed={profile.id}
            src={profile.avatarUrl}
            size={38}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[12px] font-bold leading-4 text-white">
              {profile.displayName}
            </span>
            {/* Three independent signals that can co-exist; none is derived
                from another, and an absent one renders nothing. */}
            <VerifiedBadge verification={profile.verification} className="h-3 w-3 shrink-0" />
            <OrgBadgeChip orgBadge={profile.orgBadge} />
            <RoleChip role={profile.role} />
          </span>
          <span className="truncate text-[11px] font-normal leading-4 text-white/50">
            @{profile.username}
          </span>
        </span>
      </Link>

      {!isMe && (
        <button
          aria-pressed={isFollowing}
          onClick={() => gate(() => follow.mutate(!isFollowing))}
          className={cn(
            "ws-press h-6 shrink-0 rounded-full px-3 text-[12px] font-bold leading-4 transition-colors",
            isFollowing
              ? // The design only draws the resting state. Following is the
                // inverse of the primary pill — transparent with a hairline —
                // so a followed person is unmistakable at a glance and can
                // never be misread as the white call to action.
                "border border-white/20 text-white hover:bg-white/10"
              : "min-w-[60px] bg-white text-black shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
          )}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

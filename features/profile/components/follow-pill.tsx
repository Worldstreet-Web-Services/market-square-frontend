"use client";

import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { useFollow } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

/**
 * Compact follow control, composed into other slices through a route slot.
 *
 * Two variants, because the two surfaces are genuinely different grounds and
 * the design measures them differently:
 *
 *  · `overlay` (default) is the stream room's — it sits over live video, where
 *    a 5%-white fill would disappear entirely, so resting Follow is the solid
 *    silver pill and Following is a black/40 chip with a 25% rim.
 *  · `header` is the post card's, at the design's measured geometry: 78×26,
 *    4px/12px padding, 5% white fill, a 20% white hairline, and a 12px/16px
 *    label at 90% white.
 *
 * A variant rather than restyling the one pill: changing the shared component
 * to the header's measurements would repaint the live room's overlay too,
 * where those values were chosen against a moving image. The BEHAVIOUR —
 * `useFollow`, `useGate`, `useIsFollowing`, the own-profile guard — is
 * identical in both, which is the half that must never fork.
 */
export function FollowPill({
  profile,
  variant = "overlay",
}: {
  profile: Profile;
  variant?: "overlay" | "header";
}) {
  const follow = useFollow(profile);
  const gate = useGate();
  const me = useMe();
  // Hooks must run before the early return, so read the state up here.
  const isFollowing = useIsFollowing(profile);
  if (me.data?.id === profile.id) return null;
  return (
    <button
      aria-pressed={isFollowing}
      onClick={() => gate(() => follow.mutate(!isFollowing))}
      className={cn(
        "ws-press shrink-0 rounded-full",
        variant === "header"
          ? cn(
              // The design's measured geometry, shared by both states —
              // 78×38 at node 496:13395. It was 78×26 from the older file;
              // the width is unchanged and only the height grew, so that the
              // pill sits level with the 40.7 wink beside it instead of
              // reading as a smaller control of the same kind.
              "flex h-[38px] w-[78px] items-center justify-center border px-3 py-1 text-[12px] leading-4 transition-colors",
              // ...and the states stay INVERSES of each other. The 78×26
              // measurement is of the Following pill; applying its 5%-white
              // fill to both would leave Follow and Following looking alike,
              // and the standing rule is that a resting Follow is the primary
              // call to action while Following is transparent — a followed
              // person has to be unmistakable at a glance.
              isFollowing
                ? "border-white/20 bg-white/5 font-normal text-white/90 hover:bg-white/10"
                : "border-transparent bg-accent font-bold text-ink hover:bg-white"
            )
          : cn(
              "px-3.5 py-1 text-xs font-bold",
              isFollowing ? "border border-white/25 bg-black/40 text-body" : "bg-accent text-ink"
            )
      )}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

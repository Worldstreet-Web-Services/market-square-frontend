"use client";

import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { useFollow } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

// Compact follow control for overlay surfaces (the stream room composes this
// through a route slot — slices never import each other).
export function FollowPill({ profile }: { profile: Profile }) {
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
        "ws-press rounded-full px-3.5 py-1 text-xs font-bold",
        isFollowing
          ? "border border-white/25 bg-black/40 text-body"
          : "bg-accent text-ink"
      )}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

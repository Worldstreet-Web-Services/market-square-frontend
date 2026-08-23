"use client";

import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { useFollow } from "@/features/profile/hooks/use-profile";

// Compact follow control for overlay surfaces (the stream room composes this
// through a route slot — slices never import each other).
export function FollowPill({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const me = useMe();
  if (me.data?.id === profile.id) return null;
  return (
    <button
      onClick={() => gate(() => follow.mutate(!profile.isFollowing))}
      className={cn(
        "ws-press rounded-full px-3.5 py-1 text-xs font-bold",
        profile.isFollowing
          ? "border border-white/25 bg-black/40 text-body"
          : "bg-accent text-ink"
      )}
    >
      {profile.isFollowing ? "Following" : "Follow"}
    </button>
  );
}

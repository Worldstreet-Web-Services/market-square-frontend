"use client";

import Link from "next/link";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronRight } from "@/components/ui/icons";
import { useFollow, useSpotlight } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

function RailFollow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const isFollowing = useIsFollowing(profile);
  return (
    <button
      aria-pressed={isFollowing}
      onClick={(event) => {
        event.preventDefault();
        gate(() => follow.mutate(!isFollowing));
      }}
      className={
        isFollowing
          ? "ws-press shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-sm font-bold text-body"
          : "ws-press shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-white"
      }
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

// Rail module drawn from the weekly spotlight: the square's most active
// voices are the best suggestion we have, and the ranking already exists.
export function WhoToFollowRail() {
  const board = useSpotlight();
  const me = useMe();

  if (board.isError) return null;

  if (board.isPending) {
    return (
      <section className="ws-rail p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Membership is filtered on the SERVER's answer only, never on the session
  // intent the button renders from: following someone should flip their
  // button, not make the row vanish from under the cursor. The row leaves the
  // list on the next payload that reports the edge.
  const suggestions = (board.data?.items ?? [])
    .filter((row) => row.profile.id !== me.data?.id && !row.profile.isFollowing)
    .slice(0, 3);
  if (suggestions.length === 0) return null;

  return (
    <section className="ws-rail overflow-hidden">
      <h2 className="ws-display px-4 pt-3 pb-2 text-xl">Who to follow</h2>
      <ul>
        {suggestions.map((row) => (
          <li key={row.profile.id}>
            <Link
              href={`/u/${row.profile.username}`}
              className="ws-rail-row flex items-center gap-3 px-4 py-3"
            >
              <Avatar
                name={row.profile.displayName}
                src={row.profile.avatarUrl}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-bold text-heading">
                  <span className="truncate">{row.profile.displayName}</span>
                  <VerifiedBadge verification={row.profile.verification} className="h-3.5 w-3.5" />
                </span>
                <span className="block truncate text-sm text-meta">@{row.profile.username}</span>
              </span>
              <RailFollow profile={row.profile} />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/spotlight"
        className="ws-rail-row flex items-center gap-1 px-4 py-3 text-sm font-semibold text-accent"
      >
        Show more <IconChevronRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

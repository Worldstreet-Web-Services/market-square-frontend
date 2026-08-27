"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatKashScore } from "@/features/profile/lib/score";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnHeader } from "@/components/layout/column-header";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFollow, useSpotlight } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

function InlineFollow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const me = useMe();
  // Hooks must run before the early return, so read the state up here.
  const isFollowing = useIsFollowing(profile);
  if (me.data?.id === profile.id) return null;
  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size="sm"
      aria-pressed={isFollowing}
      onClick={() => gate(() => follow.mutate(!isFollowing))}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}

// Columns run 2nd, 1st, 3rd, which is what makes it read as a podium.
const PODIUM_ORDER = [1, 0, 2];
// Sized by RANK, not by column. Indexing this by column is what made the
// runner-up the biggest face on the page: column 0 got 88px, and column 0 is
// second place. On a podium the winner is the largest thing on it, or the
// ranking has to be read rather than seen.
const PODIUM_SIZE_BY_RANK = [96, 76, 64];

export function SpotlightPage() {
  const board = useSpotlight();

  return (
    <>
      {/* Backend ranks weekly only; the window is a label, not a toggle. */}
      <ColumnHeader
        title="Spotlight"
        subtitle="The square's most active voices, ranked"
        action={
          <Pill tone="spotlight" className="shrink-0 px-3.5 py-1 text-[13px]">
            This week
          </Pill>
        }
      />

      {board.isPending && (
        <>
          <div className="ws-hair flex items-end justify-center gap-8 border-b py-8">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-22 w-22 rounded-full" />
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </>
      )}
      {board.isError && (
        <div className="p-4">
          <ErrorState error={board.error} fallback="Couldn't load the spotlight." onRetry={() => board.refetch()} />
        </div>
      )}
      {board.isSuccess && board.data.items.length === 0 && (
        <div className="p-4">
          <EmptyState glyph="✦" title="No rankings yet" body="Post, stream and host to put yourself on the board." />
        </div>
      )}

      {board.isSuccess && board.data.items.length > 0 && (
        <>
          {/* Podium — 2nd, 1st, 3rd */}
          <div className="ws-hair flex items-end justify-center gap-6 border-b py-6 sm:gap-10">
            {PODIUM_ORDER.map((position) => {
              const row = board.data.items[position];
              if (!row) return <div key={position} />;
              const size = PODIUM_SIZE_BY_RANK[position] ?? 64;
              return (
                <Link key={row.profile.id} href={`/u/${row.profile.username}`} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar name={row.profile.displayName} seed={row.profile.id} src={row.profile.avatarUrl} size={size} ring={position === 0} />
                    <span
                      className={cn(
                        "tnum absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold",
                        // The Spotlight surface moved off amber onto its own
                        // purple; the podium follows the rail card.
                        row.rank === 1 ? "bg-spotlight text-white" : "ws-glass"
                      )}
                    >
                      {row.rank}
                    </span>
                  </div>
                  <p className="max-w-24 truncate text-center text-xs font-semibold">{row.profile.displayName}</p>
                  <p className="tnum text-[11px] text-grey-500">{formatKashScore(row.score)} pts</p>
                </Link>
              );
            })}
          </div>

          <ul>
            {board.data.items.slice(3).map((row) => (
              <li key={row.profile.id} className="ws-row flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "tnum w-6 text-center text-[15px] font-bold",
                    // --color-spotlight itself is only 3.7:1 on black, so the
                    // rank numeral takes the lighter chip ink (7.5:1).
                    row.rank <= 3 ? "text-spotlight-chip-ink" : "text-meta"
                  )}
                >
                  {row.rank}
                </span>
                <Link href={`/u/${row.profile.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={row.profile.displayName} seed={row.profile.id} src={row.profile.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-heading">
                      {row.profile.displayName}
                      <VerifiedBadge verification={row.profile.verification} className="h-3.5 w-3.5" />
                      <OrgBadgeChip orgBadge={row.profile.orgBadge} />
                      <RoleChip role={row.profile.role} />
                    </p>
                    <p className="tnum text-[13px] text-meta">{formatKashScore(row.score)} pts</p>
                  </div>
                </Link>
                <InlineFollow profile={row.profile} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

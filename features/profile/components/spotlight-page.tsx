"use client";

import Link from "next/link";
import { formatKashScore } from "@/features/profile/lib/score";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFollow, useSpotlight } from "@/features/profile/hooks/use-profile";

function InlineFollow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const me = useMe();
  if (me.data?.id === profile.id) return null;
  return (
    <Button
      variant={profile.isFollowing ? "secondary" : "primary"}
      size="sm"
      onClick={() => gate(() => follow.mutate(!profile.isFollowing))}
    >
      {profile.isFollowing ? "Following" : "Follow"}
    </Button>
  );
}

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_SIZE = [88, 64, 64];

export function SpotlightPage() {
  const board = useSpotlight();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ws-display text-2xl">Spotlight</h1>
          <p className="mt-1 text-sm text-grey-500">The square&apos;s most active voices, ranked.</p>
        </div>
        {/* Backend ranks weekly only; the window is a label, not a toggle. */}
        <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-grey-300">
          This week
        </span>
      </div>

      {board.isPending && (
        <div className="space-y-3">
          <div className="flex items-end justify-center gap-8 py-6">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-22 w-22 rounded-full" />
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
      {board.isError && (
        <ErrorState error={board.error} fallback="Couldn't load the spotlight." onRetry={() => board.refetch()} />
      )}
      {board.isSuccess && board.data.items.length === 0 && (
        <EmptyState glyph="✦" title="No rankings yet" body="Post, stream and host to put yourself on the board." />
      )}

      {board.isSuccess && board.data.items.length > 0 && (
        <>
          {/* Podium — 2nd, 1st, 3rd */}
          <div className="flex items-end justify-center gap-6 py-4 sm:gap-10">
            {PODIUM_ORDER.map((position, column) => {
              const row = board.data.items[position];
              if (!row) return <div key={position} />;
              const size = PODIUM_SIZE[column];
              return (
                <Link key={row.profile.id} href={`/u/${row.profile.username}`} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <Avatar name={row.profile.displayName} src={row.profile.avatarUrl} size={size} ring={position === 0} />
                    <span className="ws-glass tnum absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold">
                      {row.rank}
                    </span>
                  </div>
                  <p className="max-w-24 truncate text-center text-xs font-semibold">{row.profile.displayName}</p>
                  <p className="tnum text-[11px] text-grey-500">{formatKashScore(row.score)} pts</p>
                </Link>
              );
            })}
          </div>

          <ul className="space-y-2">
            {board.data.items.slice(3).map((row) => (
              <li key={row.profile.id} className="ws-card flex items-center gap-3 p-3">
                <span className="tnum w-7 text-center text-sm font-bold text-grey-500">{row.rank}</span>
                <Link href={`/u/${row.profile.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={row.profile.displayName} src={row.profile.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {row.profile.displayName}
                      <VerifiedBadge verification={row.profile.verification} className="h-3.5 w-3.5" />
                      <RoleChip role={row.profile.role} />
                    </p>
                    <p className="tnum text-xs text-grey-500">{formatKashScore(row.score)} pts</p>
                  </div>
                </Link>
                <InlineFollow profile={row.profile} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

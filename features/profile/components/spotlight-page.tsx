"use client";

import { useState } from "react";
import { profileHref } from "@/lib/profile-href";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatKashScore } from "@/features/profile/lib/score";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconChevronDown } from "@/components/ui/icons";
import { MenuPanel, MenuRow } from "@/components/ui/menu-row";
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

/**
 * WHICH STRETCH OF TIME THE RANKING COVERS — a dropdown, not a label.
 *
 * QA: "This should be a filter dropdown to view for This month and All time".
 *
 * THE BOARD IS ALL TIME, and was labelled "This week". Checked in the service
 * (2026-09-15): the `spotlight` table holds one row per person, every scoring
 * event ADDS to it (`score = spotlight.score + EXCLUDED.score`), and nothing
 * anywhere resets, decays or windows it — the `window` column is pinned to the
 * single value 'weekly' as a name. So "This week" was a false claim about the
 * numbers under it, and the one window the data can honestly serve is All time.
 *
 * This week and This month are drawn DISABLED with the reason — the house rule
 * for a control the service cannot back yet. A real week or month needs the
 * service to keep a scoring history from the day it ships (past totals cannot
 * be split by date), which is with the backend and with ogazboiz as a product
 * call. Switching one on is flipping `live` here and passing the window on.
 */
type SpotlightWindow = "weekly" | "monthly" | "all";

const WINDOWS: { value: SpotlightWindow; label: string; live: boolean }[] = [
  { value: "all", label: "All time", live: true },
  { value: "weekly", label: "This week", live: false },
  { value: "monthly", label: "This month", live: false },
];

function SpotlightWindowMenu() {
  const [open, setOpen] = useState(false);
  const current = WINDOWS[0]!;
  return (
    <div
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ranking window: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        className="ws-press rounded-full"
      >
        <Pill tone="spotlight" className="flex items-center gap-1.5 px-3.5 py-1 text-[13px]">
          {current.label}
          <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </Pill>
      </button>
      {open && (
        <>
          {/* A tap anywhere else closes it, rather than deciding about a row. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-40">
            <MenuPanel>
              {WINDOWS.map((window) => (
                <MenuRow
                  key={window.value}
                  label={window.label}
                  icon={
                    window.value === current.value ? (
                      <span aria-hidden className="block h-2 w-2 rounded-full bg-create" />
                    ) : undefined
                  }
                  hint={window.live ? undefined : "Coming soon: weekly and monthly ranking needs a scoring history first"}
                  onClick={window.live ? () => setOpen(false) : undefined}
                />
              ))}
            </MenuPanel>
          </div>
        </>
      )}
    </div>
  );
}

export function SpotlightPage() {
  const board = useSpotlight();

  return (
    <>
      <ColumnHeader
        title="Spotlight"
        subtitle="The square's most active voices, ranked"
        action={<SpotlightWindowMenu />}
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
                <Link key={row.profile.id} href={profileHref(row.profile)} prefetch={false} className="flex flex-col items-center gap-2">
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
                <Link href={profileHref(row.profile)} prefetch={false} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={row.profile.displayName} seed={row.profile.id} src={row.profile.avatarUrl} size={40} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-heading">
                      {row.profile.displayName}
                      <VerifiedBadge verification={row.profile.verification} className="h-3.5 w-3.5" />
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

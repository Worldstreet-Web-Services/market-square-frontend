"use client";

import Link from "next/link";
import { formatCount } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, VerifiedBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronRight, IconSpark } from "@/components/ui/icons";
import { useFollow, useSpotlight } from "@/features/profile/hooks/use-profile";

function SpotlightFollow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  return (
    <button
      onClick={(event) => {
        event.preventDefault();
        gate(() => follow.mutate(!profile.isFollowing));
      }}
      className={
        profile.isFollowing
          ? "ws-press shrink-0 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/90"
          : "ws-btn-silver ws-press shrink-0 rounded-full px-3 py-1 text-[12px] font-bold transition-opacity hover:opacity-90"
      }
    >
      {profile.isFollowing ? "Following" : "Follow"}
    </button>
  );
}

// The rail's featured module. Amber marks "featured" and nothing else on the
// page uses it, so the card reads as promoted without shouting.
export function CitizenSpotlightRail() {
  const board = useSpotlight();
  const me = useMe();

  if (board.isError) return null;
  if (board.isPending) {
    return (
      <section className="ws-featured p-3">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-10" />
      </section>
    );
  }

  const people = (board.data?.items ?? [])
    .filter((row) => row.profile.id !== me.data?.id)
    .slice(0, 2);
  if (people.length === 0) return null;

  return (
    <section className="ws-featured p-4">
      <Link href="/spotlight" className="flex items-center gap-2">
        <IconSpark className="h-4 w-4 text-featured-hi" />
        <h2 className="text-[13.5px] font-bold leading-5 text-featured-hi hover:underline">
          Citizen Spotlight
        </h2>
        <span className="rounded-full bg-[#FE9A00]/20 px-2 py-0.5 text-[10px] font-bold leading-[15px] text-featured-chip">
          Featured
        </span>
      </Link>
      <p className="mt-2 text-[11.8px] leading-4 text-white/60">
        High performers &amp; verified ambassadors making
        <br />
        moves across Market Square.
      </p>

      <ul className="mt-4 space-y-3">
        {people.map((row) => (
          <li key={row.profile.id}>
            <Link
              href={`/u/${row.profile.username}`}
              className="flex items-center gap-[9px] rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <Avatar name={row.profile.displayName} src={row.profile.avatarUrl} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[12px] font-bold leading-4 text-white">
                  <span className="truncate">{row.profile.displayName}</span>
                  <VerifiedBadge verification={row.profile.verification} className="h-3 w-3" />
                  <OrgBadgeChip orgBadge={row.profile.orgBadge} />
                </span>
                <span className="block truncate text-[11px] leading-[16.5px] text-white/50">
                  {formatCount(row.profile.followerCount)} followers
                </span>
              </span>
              <SpotlightFollow profile={row.profile} />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/spotlight"
        className="mt-3 flex items-center gap-1 text-[11px] font-bold text-featured-chip hover:underline"
      >
        See the full ranking <IconChevronRight className="h-2.5 w-2.5" />
      </Link>
    </section>
  );
}

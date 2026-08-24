"use client";

import Link from "next/link";
import { formatCount } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSpark } from "@/components/ui/icons";
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
          ? "ws-press shrink-0 rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold text-body"
          : "ws-press shrink-0 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:bg-white"
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
    <section className="ws-featured p-3">
      <div className="flex items-center gap-1.5">
        <IconSpark className="h-3.5 w-3.5 text-featured" />
        <h2 className="text-[12px] font-bold text-heading">Citizen Spotlight</h2>
        <span className="rounded-full bg-featured/20 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-featured">
          Featured
        </span>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-meta">
        High-performing and verified members making waves across Market Square.
      </p>

      <ul className="mt-2.5 space-y-2">
        {people.map((row) => (
          <li key={row.profile.id}>
            <Link href={`/u/${row.profile.username}`} className="flex items-center gap-2">
              <Avatar name={row.profile.displayName} src={row.profile.avatarUrl} size={26} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[11px] font-bold text-heading">
                  <span className="truncate">{row.profile.displayName}</span>
                  <VerifiedBadge verification={row.profile.verification} className="h-3 w-3" />
                </span>
                <span className="block truncate text-[9px] text-meta">
                  {formatCount(row.profile.followerCount)} followers
                </span>
              </span>
              <SpotlightFollow profile={row.profile} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

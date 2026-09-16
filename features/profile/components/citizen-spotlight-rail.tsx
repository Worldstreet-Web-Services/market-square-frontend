"use client";

import Link from "next/link";
import { profileHref } from "@/lib/profile-href";
import { formatCount } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { ModuleUnavailable } from "@/components/ui/states";
import { VerifiedBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronRight, IconSpark } from "@/components/ui/icons";
import { useFollow, useSpotlight } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

function SpotlightFollow({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  // `GET /spotlight` does not return `isFollowing` yet, so the rendered state
  // comes from `useIsFollowing`: the server's answer when it sends one, this
  // session's own intent when it does not. Reading `profile.isFollowing` raw
  // here is what made the button snap back to "Follow" after every refetch.
  const isFollowing = useIsFollowing(profile);
  return (
    <button
      aria-pressed={isFollowing}
      onClick={(event) => {
        event.preventDefault();
        gate(() => follow.mutate(!isFollowing));
      }}
      // The two states are separate shapes in the design, not one pill with a
      // colour swap: "Follow" is 60×24, solid white, weight 700, no border;
      // "Following" is 78×26, 5% white behind a 20% white hairline, weight 400.
      className={
        isFollowing
          ? "ws-press h-[26px] w-[78px] shrink-0 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] font-normal leading-4 text-white/90"
          : "ws-btn-follow ws-press h-6 w-[60px] shrink-0 rounded-full px-3 py-1 text-[12px] font-bold leading-4 transition-opacity hover:opacity-90"
      }
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}

// The rail's promoted module. The design repainted it off the amber ramp onto
// its own purple (--color-spotlight); nothing else in the rail carries that
// hue, so the card still reads as promoted without shouting.
export function CitizenSpotlightRail() {
  const board = useSpotlight();
  const me = useMe();

  // Same reasoning as the category rail: admit the gap rather than vanish.
  if (board.isError) return <ModuleUnavailable title="Citizen Spotlight" />;
  if (board.isPending) {
    return (
      <section className="ws-spotlight p-3">
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
    // Insets are the design's own: 13px from the left edge, 11px from the
    // right for the rows, 10px down to the heading.
    <section className="ws-spotlight py-[10px] pl-[13px] pr-[11px]">
      <Link href="/spotlight" className="flex h-5 items-center gap-2 pr-[29px]">
        <IconSpark className="h-4 w-4 text-white" />
        <h2 className="text-[13.5px] font-bold leading-5 text-white hover:underline">
          Citizen Spotlight
        </h2>
        <span className="rounded-full bg-spotlight-chip px-2 py-0.5 text-[10px] font-bold uppercase leading-[15px] text-spotlight-chip-ink">
          Featured
        </span>
      </Link>
      <p className="mt-[11px] pr-[29px] text-[11.8px] leading-4 text-white/60">
        High performers &amp; verified ambassadors making
        <br />
        moves across Square.
      </p>

      <ul className="mt-[23px] space-y-3">
        {people.map((row) => (
          <li key={row.profile.id}>
            <Link
              href={profileHref(row.profile)}
              className="flex items-center gap-[9px] rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <Avatar name={row.profile.displayName} seed={row.profile.id} src={row.profile.avatarUrl} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[12px] font-bold leading-4 text-white">
                  <span className="truncate">{row.profile.displayName}</span>
                  <VerifiedBadge verification={row.profile.verification} className="h-3 w-3" />
                </span>
                <span className="block truncate text-[11px] font-normal leading-4 text-white/50">
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
        className="mt-3 flex items-center gap-1 text-[11px] font-bold text-spotlight-chip-ink hover:underline"
      >
        See the full ranking <IconChevronRight className="h-2.5 w-2.5" />
      </Link>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconEye, IconUser } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { useSwipeCard } from "@/hooks/use-swipe-card";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { usePeople } from "@/features/discovery";
import { useFollow, useIsFollowing } from "@/features/profile";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PALS DECK — one person at a time, on a card big enough to decide from.
 *
 * `/pals` used to render the home timeline's compact fan, which is right where
 * it sits INSIDE a feed and wrong as a whole screen: a 186px card floating in
 * the middle of a phone, with most of the page empty under it. The point of
 * this surface is deciding about somebody, and a card you decide from has to
 * carry enough to decide ON.
 *
 * So it is one full-width card holding the things a stranger is actually
 * judged by — their face, their name, what they say about themselves, and how
 * many people already follow them — with the next person stacked behind it.
 *
 * ─── WHAT IT DOES NOT CARRY, AND WHY ────────────────────────────────────────
 * The reference the designer sent shows "Motara, Ọlá-Bọlá and 2 others follow
 * them" — MUTUALS, which is the strongest signal on a card like this. We have
 * no route for it: `/profiles/{id}/followers` and `/profiles/{id}/following`
 * are both plain paged lists, so the only way to compute it here is to page
 * BOTH the viewer's following and the stranger's followers and intersect them,
 * per card. That is a request storm for a line of text, and it would be wrong
 * the moment either list ran past its first page.
 *
 * Requested from the service. The row appears when the field does; until then
 * the card says nothing about mutuals rather than something approximate.
 *
 * ─── AND WHY THERE IS NO WINK HERE ──────────────────────────────────────────
 * The home fan offers pass and wink; this offers PASS and FOLLOW, because that
 * is what the swipe already means — ogazboiz's own words, "swipe right to
 * follow". Two controls that look alike doing different things across two
 * surfaces is worse than each surface being clear about its own act.
 */
export function PalsDeck() {
  const me = useMe();
  const people = usePeople("", "followers", true);
  const [index, setIndex] = useState(0);

  const items = (people.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (profile) => profile.id !== me.data?.id
  );

  const advance = () => {
    setIndex((i) => {
      const next = i + 1;
      // Keep it fed: three from the end is somebody who has decided to keep going.
      if (next > items.length - 4 && people.hasNextPage && !people.isFetchingNextPage) {
        void people.fetchNextPage();
      }
      return next;
    });
  };

  if (people.isPending) return null;

  const profile = items[index];
  const behind = items[index + 1];

  // Nothing left to decide about. The deck says so rather than showing a frame
  // with no one in it.
  if (!profile) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-[16px] font-bold leading-6 text-white">That&apos;s everyone for now</p>
        <p className="max-w-[320px] text-[14px] leading-5 text-white/50">
          New people show up here as they join the square.
        </p>
      </div>
    );
  }

  return (
    /* The deck FILLS the room it is given — the reference card runs from under
       the header to just above the dock, and a content-height card in the
       middle of a tall screen is exactly the emptiness this page had. */
    <div className="relative mx-auto flex w-full max-w-[420px] flex-1">
      {/* The next person, held still behind — so the card reads as a deck with
          somewhere to go rather than one card that vanishes. */}
      {behind && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 translate-y-3 scale-[0.96] opacity-60"
        >
          <PalCardFace profile={behind} interactive={false} />
        </div>
      )}
      <SwipeablePal key={profile.id} profile={profile} onDecided={advance} />
    </div>
  );
}

function SwipeablePal({ profile, onDecided }: { profile: Profile; onDecided: () => void }) {
  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();

  const decide = (decision: "follow" | "pass") => {
    /*
      A FOLLOW IS A REAL ACT AND A PASS IS NOT. Right sends `useFollow` behind
      the sign-in gate, guarded by `isFollowing` so following somebody you
      already follow cannot toggle them OFF. Left tells the service nothing:
      there is no dismiss route, and a preference stored in one tab lies the
      moment you open another.
    */
    if (decision === "follow" && !isFollowing) gate(() => follow.mutate(true));
    onDecided();
  };

  const swipe = useSwipeCard({ width: 420, onDecide: decide });

  return (
    <div
      {...swipe.handlers}
      className={cn(
        "flex w-full touch-pan-y select-none",
        swipe.dragging ? "transition-none" : "transition-transform duration-200"
      )}
      style={{ transform: swipe.transform, opacity: swipe.committing ? 0 : 1 }}
    >
      <PalCardFace profile={profile} onDecide={decide} verdict={swipe.progress} />
    </div>
  );
}

function PalCardFace({
  profile,
  onDecide,
  interactive = true,
  verdict = 0,
}: {
  profile: Profile;
  onDecide?: (decision: "follow" | "pass") => void;
  interactive?: boolean;
  /** -1..1 while dragging, for the two stamps. */
  verdict?: number;
}) {
  const name = profile.displayName || profile.username;
  return (
    <div className="ws-card relative flex w-full flex-col gap-5 p-5">
      <div className="flex items-start gap-4">
        {/* A rounded SQUARE, as the profile cover's own portrait is — this is
            somebody's picture, not a row's bullet. */}
        <Avatar
          name={name}
          seed={profile.id}
          src={profile.avatarUrl}
          size={96}
          className="shrink-0 rounded-[20px]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[20px] font-bold leading-7 text-white">{name}</span>
            <VerifiedBadge verification={profile.verification} className="h-4 w-4" />
            <OrgBadgeChip orgBadge={profile.orgBadge} />
            <RoleChip role={profile.role} />
          </span>
          {/* An unclaimed member's username is a Privy DID — `break-all` is the
              only break it offers. */}
          <span className="break-all text-[14px] leading-5 text-white/50">@{profile.username}</span>

          <span className="tnum mt-2 flex items-center gap-5 text-[13px] leading-4">
            <span className="flex items-baseline gap-1">
              <span className="text-[16px] font-bold text-white">
                {formatCount(profile.followerCount)}
              </span>
              <span className="text-white/50">followers</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[16px] font-bold text-white">
                {formatCount(profile.followingCount)}
              </span>
              <span className="text-white/50">following</span>
            </span>
          </span>
        </div>
      </div>

      {/* Their own words, when they wrote any. No placeholder: a stranger who
          has not written a bio is not a card with a blank line in it. */}
      {profile.bio && (
        <p className="line-clamp-3 text-[15px] leading-[22px] text-white/70">{profile.bio}</p>
      )}

      {/* The give in the card, so the two acts sit near its FOOT rather than
          tight under the bio — the reference puts a clear field of nothing
          between what you are reading and what you do about it, and that gap
          is what stops a decision feeling like a misclick. */}
      <div className="min-h-[24px] flex-1" />

      {/* Two acts, labelled — a bare circle is silent about which is which. */}
      <div className="flex items-start justify-center gap-10 pb-2">
        <DeckAction
          label="not now"
          onClick={() => onDecide?.("pass")}
          disabled={!interactive}
          className="bg-white/10 text-white hover:bg-white/15"
        >
          <IconEye className="h-6 w-6" />
        </DeckAction>
        <DeckAction
          label="follow"
          onClick={() => onDecide?.("follow")}
          disabled={!interactive}
          /* Silver, as every other resting Follow in the app is — a followed
             person must never be mistakable for one you have not followed. */
          className="bg-accent text-ink hover:bg-white"
        >
          <IconUser className="h-6 w-6" />
        </DeckAction>
      </div>

      {/* The verdict stamps: the outcome is visible BEFORE you let go, which is
          what makes a swipe feel decided rather than risky. */}
      <span
        aria-hidden
        style={{ opacity: verdict > 0 ? Math.min(1, verdict / 0.28) : 0 }}
        className="pointer-events-none absolute left-4 top-4 rounded-full border-2 border-accent px-2.5 py-1 text-[12px] font-bold uppercase tracking-wider text-accent"
      >
        Follow
      </span>
      <span
        aria-hidden
        style={{ opacity: verdict < 0 ? Math.min(1, -verdict / 0.28) : 0 }}
        className="pointer-events-none absolute right-4 top-4 rounded-full border-2 border-white/40 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wider text-white/70"
      >
        Not now
      </span>
    </div>
  );
}

function DeckAction({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "ws-press grid h-14 w-14 place-items-center rounded-full transition-colors disabled:opacity-40",
          className
        )}
      >
        {children}
      </button>
      <span className="text-[13px] font-medium leading-4 text-white/70">{label}</span>
    </span>
  );
}

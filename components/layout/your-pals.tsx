"use client";

import { useEffect } from "react";
import { PersonRow, useFollowersList, useFollowingList } from "@/features/profile";
import { useMe } from "@/hooks/use-me";
import { mutualPals, palsArePartial } from "@/lib/pals";

/** How many pages of each side to walk before giving up. See the header. */
const PAGE_CAP = 4;

/**
 * THE PEOPLE WHO ARE ACTUALLY YOURS.
 *
 * A pal is a MUTUAL follow — see `lib/pals.ts` for why, and why a wink is not
 * it. This section is the difference between /pals and Home: Home ranks
 * everyone you follow plus strangers, and following one loud account means
 * seeing them everywhere. Here, somebody had to choose you back.
 *
 * ─── WHY BOTH LISTS ARE WALKED ───────────────────────────────────────────────
 * The intersection is only complete when BOTH paged lists are, so a pal whose
 * follow-back sits on page two is missing until page two arrives — and under a
 * heading like "Your pals", a missing person reads as "they unfollowed me".
 * That is a worse failure than being slow, so both sides are walked to the
 * end. `PAGE_CAP` bounds it at 120 a side: an account with more following than
 * that needs the server-side list this page cannot build, not a longer loop
 * in a browser.
 *
 * NO COUNT IS SHOWN WHILE IT IS PARTIAL. A number that grows as pages land
 * looks like the product miscounting its own users.
 *
 * ─── ROWS, NOT CARDS ─────────────────────────────────────────────────────────
 * `PersonRow`, the same row used in Explore, followers lists and search — one
 * person, one line, one action. A stack of profile CARDS is the swipe grammar,
 * and on a people page it reads as dating whatever the copy says. The deck is
 * the place for cards, and the deck lives on Home, where discovery happens.
 *
 * It renders NOTHING when you have no pals yet: the rooms rail above and the
 * feed below are a complete page on their own, and an empty "Your pals"
 * heading is just an accusation.
 */
export function YourPals() {
  const me = useMe();
  const viewerId = me.data?.id;
  const following = useFollowingList(viewerId);
  const followers = useFollowersList(viewerId);

  const followingPages = following.data?.pages.length ?? 0;
  const followersPages = followers.data?.pages.length ?? 0;

  // Walk both sides to the end — an incomplete intersection drops real pals.
  useEffect(() => {
    if (following.hasNextPage && !following.isFetchingNextPage && followingPages < PAGE_CAP) {
      void following.fetchNextPage();
    }
  }, [following, followingPages]);

  useEffect(() => {
    if (followers.hasNextPage && !followers.isFetchingNextPage && followersPages < PAGE_CAP) {
      void followers.fetchNextPage();
    }
  }, [followers, followersPages]);

  const followingItems = following.data?.pages.flatMap((page) => page.items) ?? [];
  const followerItems = followers.data?.pages.flatMap((page) => page.items) ?? [];
  const pals = mutualPals(followingItems, followerItems);

  const partial = palsArePartial(
    !following.hasNextPage || followingPages >= PAGE_CAP,
    !followers.hasNextPage || followersPages >= PAGE_CAP
  );

  if (!viewerId) return null;
  if (following.isPending || followers.isPending) return null;
  if (following.isError || followers.isError) return null;
  if (pals.length === 0) return null;

  return (
    <section aria-labelledby="your-pals" className="mb-[64px]">
      <h2 id="your-pals" className="mb-3 text-[15px] font-bold text-white">
        Your pals
        {/* Only once both sides are fully walked — see the header. */}
        {!partial && <span className="tnum ml-2 text-[13px] font-medium text-meta">{pals.length}</span>}
      </h2>

      <div className="flex flex-col">
        {pals.map((profile) => (
          <PersonRow key={profile.id} profile={profile} />
        ))}
      </div>
    </section>
  );
}

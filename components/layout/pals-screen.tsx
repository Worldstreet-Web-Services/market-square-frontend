"use client";

import { FriendsDeck } from "@/components/layout/friends-deck";
import { PostForYou } from "@/components/layout/post-for-you";
import { StoriesRow, type Post } from "@/features/feed";
import { FollowPill, WinkButton } from "@/features/profile";
import { TipButton } from "@/features/tips";
import { KashBalance } from "@/features/kash";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PALS SURFACE — node 844:18511, the deck on a page of its own.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * The node opens on the STORIES strip (844:18441, the same 100 × 96 cards
 * Home leads with), then the heading row 47 below it — back disc, the 41.3
 * title, the Location pill — and the deck 89 under that, at the column's full
 * width with the two step discs on its edges. So the page is `StoriesRow`
 * from the feed slice over `FriendsDeck` with its `/pals` heading, stacked
 * from the top. The heading is drawn at 0.68 of the node to fit this column
 * (its own note says why), and the 47 above it is scaled the same — 32.
 *
 * It is the SAME `FriendsDeck` the home timeline renders, not a second copy
 * and not a second card: one component means the wink cooldown, the
 * already-following guard and the swipe-to-browse cannot be fixed on one
 * surface and left broken on the other; `deckLayout` scales the node's 917
 * span to whatever this column is.
 *
 * ─── AND THE POSTS RAIL, WHICH USED TO BE ON HOME ────────────────────────────
 * "Post For You" (1314:153017) shipped above Home's timeline and showed the
 * same lane the timeline underneath was already showing, so a post appeared
 * twice on one screen. Home reads as a plain timeline again, the way X's does
 * (ogazboiz, 2026-09-12: "for it to be showing like normal x we can put that
 * in pals page instead"), and the rail lives here, where there is no timeline
 * to repeat.
 *
 * It is handed the same three controls Home gives its cards. Without them the
 * posts here would quietly lose follow, wink and tip — the slices cannot be
 * imported by the feed, so every surface that renders a post card composes
 * them in.
 */
// The same three route slots Home composes into a post card — the feed slice
// may not import profile, tips or kash, so each surface joins them in.
const followSlot = (author: Profile) => <FollowPill profile={author} variant="header" />;
const winkSlot = (author: Profile) => <WinkButton profile={author} size="post" />;
const balanceSlot = (amountKash: string | null) => <KashBalance amountKash={amountKash} />;
const tipSlot = (post: Post) => (
  <TipButton
    target={{ kind: "post", id: post.id, recipient: post.author }}
    balance={balanceSlot}
    variant="post"
  />
);

export function PalsScreen() {
  // The strip is who you follow, so it exists only for someone signed in —
  // the same gate Home puts on it.
  const { authenticated } = useAuth();
  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col gap-6 px-4 py-6 md:gap-8 lg:px-6">
      {authenticated && <StoriesRow />}
      <FriendsDeck heading="pals" />
      <PostForYou followSlot={followSlot} winkSlot={winkSlot} tipSlot={tipSlot} />
    </div>
  );
}

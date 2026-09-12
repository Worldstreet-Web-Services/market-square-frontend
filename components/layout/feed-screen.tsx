"use client";

import { FeedPage, type Post } from "@/features/feed";
import { FollowPill, WinkButton } from "@/features/profile";
import { TipButton } from "@/features/tips";
import { KashBalance } from "@/features/kash";
import { JoinACommunity } from "@/components/layout/join-a-community";
import { SuggestedPals } from "@/components/layout/suggested-pals";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE TIMELINE, ON ITS OWN PAGE.
 *
 * Home stopped showing a scrolling feed on 2026-09-12: the design draws six
 * sections and no list, and the "Post For You" rail was showing the same lane
 * the list under it already had. "View more" on that rail opens this.
 *
 * It is `FeedPage` in `feed` mode — the same component Home renders, so the
 * composer, the new-posts pill, the infinite scroll and the full-screen video
 * viewer are the ones that always existed rather than a second copy.
 *
 * Deliberately NOT in the sidebar: Home was asked to stop leading with the
 * feed, and a nav row would put it back in front of everyone by another door.
 */
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

export function FeedScreen() {
  return (
    <FeedPage
      mode="feed"
      followSlot={followSlot}
      winkSlot={winkSlot}
      tipSlot={tipSlot}
      communitySlot={<JoinACommunity />}
      palsSlot={<SuggestedPals />}
    />
  );
}

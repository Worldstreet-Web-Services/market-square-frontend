"use client";

import { FeedPage, ArkmarksPage, PostDetailPage, type Post } from "@/features/feed";
import { FollowPill, WinkButton } from "@/features/profile";
import { TipButton } from "@/features/tips";
import { KashBalance } from "@/features/kash";
import { JoinACommunity } from "@/components/layout/join-a-community";
import { HomeTopRow } from "@/components/layout/home-top-row";
import { HOME_BANNER_SLIDES, HomeBanner } from "@/components/layout/home-banner";
import { LiveGistRooms } from "@/components/layout/live-gist-rooms";
import { FriendsDeck } from "@/components/layout/friends-deck";
import { ComingSoonRooms } from "@/components/layout/coming-soon-rooms";
import { PopularHouses } from "@/components/layout/popular-houses";
import { PostForYou } from "@/components/layout/post-for-you";
import { SuggestedPals } from "@/components/layout/suggested-pals";

// Slices never import each other, so the follow control — which belongs to the
// profile slice — is composed into the timeline here, the same way the stream
// room gets its own. Both home surfaces share the one slot.
const followSlot = (author: Parameters<typeof FollowPill>[0]["profile"]) => (
  <FollowPill profile={author} variant="header" />
);

// The tip control belongs to the tips slice for the same reason, and is joined
// in beside the follow pill on every post header. It takes the post, not the
// author: `POST /posts/:id/tips` credits the author but is addressed to the
// post, and the sheet needs the author only to name who is being paid.
// The tip sheet shows the reader what they HAVE while they choose what to
// send, and gives them a way to top up when it is short. The balance belongs to
// the kash slice, so it is joined in here rather than imported across — the
// same route slot the follow control above uses. It renders nothing at all
// where there is no wallet or no engine, which is the honest answer.
const balanceSlot = (amountKash: string | null) => <KashBalance amountKash={amountKash} />;

// The wink sits between the tip and the follow on every post header — node
// 496:13389 draws all three. It belongs to the profile slice, which owns the
// rate limit and the refusal copy, so it arrives the same way the other two do.
const winkSlot = (author: Parameters<typeof WinkButton>[0]["profile"]) => (
  <WinkButton profile={author} size="post" />
);

const tipSlot = (post: Post) => (
  <TipButton
    target={{ kind: "post", id: post.id, recipient: post.author }}
    balance={balanceSlot}
    variant="post"
  />
);

/**
 * Home, composed — node 225:3315.
 *
 * The file's order is stories, the TOPIC row, the rooms open now, "Make some
 * friends", the timeline, then "Join a community". Three of those read slices
 * the feed may not import, so they are assembled here and handed down as slots
 * — the same route-slot pattern the follow pill and the tip button above use.
 *
 * The column opens on the search row and the gistroom banner (1295:142736,
 * 1305:149178), for everybody: the banner is the strongest invitation on the
 * page, and the tap gates a signed-out reader into sign-in.
 *
 * The topic vocabulary is DATA rather than a node, because the row's selection
 * drives the feed's own query: `GET /topics` belongs to the discovery slice and
 * `GET /feed?topics=` is the feed's, and this is the one layer allowed to know
 * both.
 */
export function HomeScreen() {
  // Home's own eight, in the design's order (`?surface=home`).
  return (
    <FeedPage
      mode="home"
      followSlot={followSlot}
      winkSlot={winkSlot}
      tipSlot={tipSlot}
      headSlot={
        <>
          <HomeTopRow />
          <HomeBanner slides={HOME_BANNER_SLIDES} />
        </>
      }
      roomsSlot={<LiveGistRooms />}
      friendsSlot={<FriendsDeck />}
      comingSoonSlot={<ComingSoonRooms />}
      housesSlot={<PopularHouses />}
      postsSlot={<PostForYou followSlot={followSlot} winkSlot={winkSlot} tipSlot={tipSlot} />}
      communitySlot={<JoinACommunity />}
      palsSlot={<SuggestedPals />}
    />
  );
}

export function ArkmarksScreen() {
  return <ArkmarksPage followSlot={followSlot} winkSlot={winkSlot} tipSlot={tipSlot} />;
}

export function PostScreen({ postId }: { postId: string }) {
  return (
    <PostDetailPage
      postId={postId}
      followSlot={followSlot}
      winkSlot={winkSlot}
      tipSlot={tipSlot}
    />
  );
}

"use client";

import { FeedPage, ArkmarksPage, PostDetailPage, type Post } from "@/features/feed";
import { FollowPill, WinkButton } from "@/features/profile";
import { TipButton } from "@/features/tips";
import { KashBalance } from "@/features/kash";
import { useTopics } from "@/features/discovery";
import { LiveCta } from "@/features/streams";
import { useAuth } from "@/hooks/use-auth";
import { JoinACommunity } from "@/components/layout/join-a-community";
import { LiveGistRooms } from "@/components/layout/live-gist-rooms";
import { FriendsDeck } from "@/components/layout/friends-deck";
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
 * The Go Live banner (647:17219) belongs to the streams slice and sits under
 * the topic row. Signed-out readers do not get it, for the Live page's reason:
 * a "Go Live" that opens a login wall is bait.
 *
 * The topic vocabulary is DATA rather than a node, because the row's selection
 * drives the feed's own query: `GET /topics` belongs to the discovery slice and
 * `GET /feed?topics=` is the feed's, and this is the one layer allowed to know
 * both.
 */
export function HomeScreen() {
  const topics = useTopics();
  const { authenticated } = useAuth();
  return (
    <FeedPage
      followSlot={followSlot}
      winkSlot={winkSlot}
      tipSlot={tipSlot}
      topicTabs={(topics.data ?? []).map((topic) => ({ key: topic.key, label: topic.label }))}
      liveCtaSlot={authenticated ? <LiveCta /> : null}
      roomsSlot={<LiveGistRooms />}
      friendsSlot={<FriendsDeck />}
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

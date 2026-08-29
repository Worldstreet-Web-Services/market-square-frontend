"use client";

import { FeedPage, ArkmarksPage, PostDetailPage, type Post } from "@/features/feed";
import { FollowPill } from "@/features/profile";
import { TipButton } from "@/features/tips";
import { KashBalance } from "@/features/kash";

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

const tipSlot = (post: Post) => (
  <TipButton
    target={{ kind: "post", id: post.id, recipient: post.author }}
    balance={balanceSlot}
  />
);

export function HomeScreen() {
  return <FeedPage followSlot={followSlot} tipSlot={tipSlot} />;
}

export function ArkmarksScreen() {
  return <ArkmarksPage followSlot={followSlot} tipSlot={tipSlot} />;
}

export function PostScreen({ postId }: { postId: string }) {
  return <PostDetailPage postId={postId} followSlot={followSlot} tipSlot={tipSlot} />;
}

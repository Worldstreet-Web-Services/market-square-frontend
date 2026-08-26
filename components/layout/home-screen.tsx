"use client";

import { FeedPage, ArkmarksPage, PostDetailPage, type Post } from "@/features/feed";
import { FollowPill } from "@/features/profile";
import { TipButton } from "@/features/tips";

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
const tipSlot = (post: Post) => (
  <TipButton target={{ kind: "post", id: post.id, recipient: post.author }} />
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

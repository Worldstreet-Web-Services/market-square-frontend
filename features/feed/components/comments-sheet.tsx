"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { RoomChatComments } from "@/features/feed/components/room-chat-excerpt";
import {
  CommentBox,
  CommentThread,
  type ReplyTarget,
} from "@/features/feed/components/comment-thread";

/**
 * The comments sheet a card and a snap slide open.
 *
 * The same thread the permalink draws — replies under their comment, hearts on
 * every row — with the box at the foot, where a thumb reaches it. Nothing is
 * fetched until the sheet opens.
 */
export function CommentsSheet({
  postId,
  streamId = null,
  open,
  onClose,
}: {
  postId: string;
  /**
   * The gist room this post is about, when it is about one.
   *
   * The room's chat belongs in the COMMENT section rather than on the card
   * (ogazboiz: "the comment suppose to be in the comment section aspect in
   * like the normal aspect") — what people are saying in the room reads as
   * the conversation under the post, because that is what it is.
   */
  streamId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Comments">
      <div className="flex max-h-[70vh] flex-col">
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto">
          {streamId && <RoomChatComments streamId={streamId} />}
          <CommentThread
            postId={postId}
            enabled={open}
            onReply={setReplyTo}
            emptyTitle="No comments yet"
            emptyBody="Be the first to say something."
          />
        </div>
        <CommentBox
          postId={postId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          className="-mx-4 -mb-4 border-b-0 border-t"
        />
      </div>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
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
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Comments">
      <div className="flex max-h-[70vh] flex-col">
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto">
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

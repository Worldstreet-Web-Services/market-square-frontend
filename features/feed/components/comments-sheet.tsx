"use client";

import { useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconSend } from "@/components/ui/icons";
import { useAddComment, useComments } from "@/features/feed/hooks/use-feed";

export function CommentsSheet({
  postId,
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const comments = useComments(postId, open);
  const add = useAddComment(postId);
  const gate = useGate();
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    gate(() =>
      add.mutate(text, {
        onSuccess: () => setDraft(""),
      })
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Comments">
      <div className="space-y-4">
        {comments.isPending && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {comments.isError && (
          <ErrorState error={comments.error} fallback="Couldn't load comments." onRetry={() => comments.refetch()} />
        )}
        {comments.data && comments.data.items.length === 0 && (
          <EmptyState glyph="◌" title="No comments yet" body="Be the first to say something." />
        )}
        {comments.data && comments.data.items.length > 0 && (
          <ul className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {comments.data.items.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <Avatar
                  name={comment.author?.displayName ?? comment.authorId.slice(-4) ?? "?"}
                  src={comment.author?.avatarUrl}
                  size={32}
                />
                <div className="min-w-0">
                  <p className="text-xs text-grey-500">
                    {comment.author ? (
                      <Link href={`/u/${comment.author.username}`} className="font-semibold text-grey-200 hover:underline">
                        {comment.author.displayName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-grey-300">
                        Member ·{comment.authorId.slice(-4)}
                      </span>
                    )}{" "}
                    · {relativeTime(comment.createdAt)}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-grey-100">{comment.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="ws-inset flex items-center gap-2 px-3 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={500}
            placeholder="Add a comment"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            onClick={submit}
            disabled={add.isPending || !draft.trim()}
            aria-label="Send comment"
            className="rounded-full p-1.5 text-accent transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ColumnHeader } from "@/components/layout/column-header";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconArrowLeft, IconSend } from "@/components/ui/icons";
import {
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from "@/features/messages/hooks/use-messages";
import { MESSAGE_MAX, type Conversation } from "@/features/messages/lib/types";

function Composer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const [text, setText] = useState("");
  const body = text.trim();

  const submit = () => {
    if (!body || send.isPending) return;
    send.mutate(body, { onSuccess: () => setText("") });
  };

  return (
    <div className="ws-hair sticky bottom-0 border-t bg-black/80 p-3 backdrop-blur">
      <div className="ws-field flex items-end gap-2 px-3 py-2">
        <label className="sr-only" htmlFor="message-composer">
          Write a message
        </label>
        <textarea
          id="message-composer"
          value={text}
          rows={1}
          // The service rejects anything longer, so the field stops there too.
          onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message…"
          className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-1 text-[15px] text-heading outline-none placeholder:text-meta"
        />
        <button
          onClick={submit}
          disabled={!body || send.isPending}
          aria-label="Send message"
          className="ws-press shrink-0 rounded-full p-2 text-accent transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {send.isPending ? <Spinner className="h-4 w-4" /> : <IconSend className="h-4 w-4" />}
        </button>
      </div>
      {text.length > MESSAGE_MAX - 200 && (
        <p className="tnum mt-1 px-3 text-right text-[11px] text-meta">
          {MESSAGE_MAX - text.length} left
        </p>
      )}
    </div>
  );
}

function Thread({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const me = useMe();
  const messages = useMessages(conversation.id, true);
  const markRead = useMarkConversationRead();

  // Opening the thread is the acknowledgement — once per thread, not on every
  // poll tick.
  const acknowledged = useRef<string | null>(null);
  useEffect(() => {
    if (acknowledged.current === conversation.id) return;
    acknowledged.current = conversation.id;
    if (conversation.unreadCount > 0) markRead.mutate(conversation.id);
  }, [conversation.id, conversation.unreadCount, markRead]);

  // The service returns newest-first; a thread reads oldest-first.
  const items = [...(messages.data?.items ?? [])].reverse();

  return (
    <>
      <ColumnHeader
        title={conversation.peer?.displayName ?? "Conversation"}
        subtitle={conversation.peer ? `@${conversation.peer.username}` : undefined}
        action={
          <button
            onClick={onBack}
            aria-label="Back to inbox"
            className="ws-press rounded-full p-2 text-heading transition-colors hover:bg-white/10"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex flex-col gap-2 p-4">
        {messages.isPending && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
        {messages.isError && (
          <ErrorState
            error={messages.error}
            fallback="Couldn't load this conversation."
            onRetry={() => messages.refetch()}
          />
        )}
        {messages.isSuccess && items.length === 0 && (
          <EmptyState
            glyph="◇"
            title="No messages yet"
            body={`Say hello to ${conversation.peer?.displayName ?? "them"}.`}
          />
        )}

        {items.map((message) => {
          const mine = Boolean(me.data && message.senderId === me.data.id);
          return (
            <div
              key={message.id}
              className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
            >
              {!mine && (
                <Avatar
                  name={message.sender?.displayName ?? "?"}
                  seed={message.senderId} src={message.sender?.avatarUrl}
                  size={28}
                />
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2",
                  mine ? "bg-accent text-ink" : "ws-inset text-body"
                )}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-normal">
                  {message.text}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[11px]",
                    mine ? "text-ink/60" : "text-meta"
                  )}
                >
                  {relativeTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Composer conversationId={conversation.id} />
    </>
  );
}

function Inbox({ onOpen }: { onOpen: (conversation: Conversation) => void }) {
  const conversations = useConversations();
  const sentinel = useInfiniteScroll(
    () => conversations.fetchNextPage(),
    Boolean(conversations.hasNextPage && !conversations.isFetchingNextPage)
  );

  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <ColumnHeader title="Messages" subtitle="Your conversations across the square" />

      {conversations.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
      {conversations.isError && (
        <div className="p-4">
          <ErrorState
            error={conversations.error}
            fallback="Couldn't load your messages."
            onRetry={() => conversations.refetch()}
          />
        </div>
      )}
      {conversations.isSuccess && items.length === 0 && (
        <div className="p-4">
          <EmptyState
            glyph="◇"
            title="No conversations yet"
            body="Open someone's profile and start one."
          />
        </div>
      )}

      {items.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onOpen(conversation)}
          className={cn(
            "ws-row flex w-full items-center gap-3 px-4 py-3 text-left",
            conversation.unreadCount > 0 && "bg-white/4"
          )}
        >
          <Avatar
            name={conversation.peer?.displayName ?? "?"}
            seed={conversation.peer?.id} src={conversation.peer?.avatarUrl}
            size={40}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-bold text-heading">
                {conversation.peer?.displayName ?? "Unknown"}
              </span>
              {conversation.lastMessageAt && (
                <span className="shrink-0 text-[12px] text-meta">
                  {relativeTime(conversation.lastMessageAt)}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[14px] text-meta">
              {conversation.lastMessage ?? "No messages yet"}
            </span>
          </span>
          {conversation.unreadCount > 0 && (
            <span className="tnum flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-featured px-1.5 text-[11px] font-bold text-ink">
              {conversation.unreadCount}
            </span>
          )}
        </button>
      ))}

      <div ref={sentinel} />
      {conversations.isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6 text-meta" />
        </div>
      )}
    </>
  );
}

export function MessagesPage() {
  const { ready, authenticated, login } = useAuth();
  const [open, setOpen] = useState<Conversation | null>(null);

  if (ready && !authenticated) {
    return (
      <>
        <ColumnHeader title="Messages" />
        <div className="p-4">
          <EmptyState
            glyph="◇"
            title="Sign in to read your messages"
            body="Conversations follow your account across the square."
            action={
              <button
                onClick={login}
                className="ws-btn-silver ws-press rounded-full px-5 py-2 text-[13px] font-bold"
              >
                Sign in
              </button>
            }
          />
        </div>
      </>
    );
  }

  if (open) return <Thread conversation={open} onBack={() => setOpen(null)} />;
  return <Inbox onOpen={setOpen} />;
}

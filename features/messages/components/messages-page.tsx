"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ColumnHeader } from "@/components/layout/column-header";
import { InboxFilters, InboxSearch, type InboxFilter } from "@/features/messages/components/inbox-chrome";
import { ConversationRow } from "@/features/messages/components/conversation-row";
import { ThreadPlaceholder } from "@/features/messages/components/thread-placeholder";
import { matchesQuery, visibleConversations } from "@/features/messages/lib/filter";
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
    <div className="ws-hair sticky bottom-0 border-t bg-ground p-3">
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
              {/* The thread is 1:1 and the payload carries no `sender`, so the
                  only other participant is the peer. Reading it from the
                  conversation is what makes the bubble avatar match the same
                  person everywhere else. */}
              {!mine && (
                <Avatar
                  name={conversation.peer?.displayName ?? "?"}
                  seed={message.senderId || conversation.peer?.id}
                  src={conversation.peer?.avatarUrl}
                  size={28}
                />
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2",
                  mine ? "bg-accent text-ink" : "ws-inset text-body"
                )}
              >
                <p
                  className={cn(
                    "whitespace-pre-wrap break-words text-[15px] leading-normal",
                    message.status === "removed" && "italic opacity-60"
                  )}
                >
                  {message.status === "removed" ? "Message removed" : message.text}
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

/** The inbox preview line. `lastMessage` is a full message object, so the row
    can say who sent it — "You: " when the viewer did, which is the standard
    inbox affordance — and a removed message keeps its row without its body. */
function Preview({ conversation, meId }: { conversation: Conversation; meId?: string }) {
  const last = conversation.lastMessage;
  if (!last) return <>No messages yet</>;
  if (last.status === "removed") return <span className="italic">Message removed</span>;
  const mine = Boolean(meId && last.senderId === meId);
  return (
    <>
      {mine && <span className="text-body">You: </span>}
      {last.text}
    </>
  );
}

function Inbox({
  onOpen,
  selectedId,
}: {
  onOpen: (conversation: Conversation) => void;
  selectedId?: string;
}) {
  const conversations = useConversations();
  const me = useMe();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const sentinel = useInfiniteScroll(
    () => conversations.fetchNextPage(),
    Boolean(conversations.hasNextPage && !conversations.isFetchingNextPage)
  );

  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];
  const shown = visibleConversations(items, filter, query);
  const unreadTotal = items.filter((conversation) => conversation.unreadCount > 0).length;

  return (
    <>
      <ColumnHeader title="Messages" subtitle="Your conversations across the square" />

      <div className="flex flex-col gap-6 px-6 pb-4 pt-6">
        <InboxSearch value={query} onChange={setQuery} />
        <InboxFilters value={filter} onChange={setFilter} unreadCount={unreadTotal} />
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
        {conversations.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

        {conversations.isError && (
          <ErrorState
            error={conversations.error}
            fallback="Couldn't load your messages."
            onRetry={() => conversations.refetch()}
          />
        )}

        {conversations.isSuccess && items.length === 0 && (
          <EmptyState
            glyph="◇"
            title="No conversations yet"
            body="Open someone's profile and start one."
          />
        )}

        {/* A filter or a search that matches nothing is NOT an empty inbox, and
            saying "no conversations yet" there would be a lie the user can
            disprove by clearing the box. */}
        {conversations.isSuccess && items.length > 0 && shown.length === 0 && (
          <EmptyState
            glyph="◇"
            title={query.trim() ? "No matches" : "Nothing unread"}
            body={
              query.trim()
                ? "No conversation matches that search."
                : "Every conversation here has been read."
            }
          />
        )}

        {shown.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            meId={me.data?.id}
            selected={conversation.id === selectedId}
            onOpen={() => onOpen(conversation)}
          />
        ))}

        <div ref={sentinel} />
        {conversations.isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6 text-meta" />
          </div>
        )}
      </div>
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

  return (
    <div className="flex min-h-full">
      {/*
        Two panes on a desktop, one at a time on a phone.

        The list is a fixed 395 because that is what the design fixes it at —
        347 of content inside 24px gutters — and a conversation list that
        reflows with the window makes the previews rewrap on every drag. The
        thread takes whatever is left.

        On a phone the list gives way to the thread entirely, which is why the
        route is only wide at its exact path.
      */}
      <div
        className={cn(
          "w-full shrink-0 lg:w-[395px] lg:border-r lg:border-white/10",
          open && "hidden lg:block"
        )}
      >
        <Inbox onOpen={setOpen} selectedId={open?.id} />
      </div>

      <div className={cn("min-w-0 flex-1", !open && "hidden lg:block")}>
        {open ? (
          <Thread conversation={open} onBack={() => setOpen(null)} />
        ) : (
          <ThreadPlaceholder />
        )}
      </div>
    </div>
  );
}

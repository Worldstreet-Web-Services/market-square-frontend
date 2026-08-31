"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ColumnHeader } from "@/components/layout/column-header";
import { InboxFilters, InboxSearch, type InboxFilter } from "@/features/messages/components/inbox-chrome";
import { ConversationRow } from "@/features/messages/components/conversation-row";
import {
  Bubble,
  DayHeading,
  RoundAction,
  ThreadHeader,
} from "@/features/messages/components/thread-chrome";
import { groupByDay } from "@/features/messages/lib/day-groups";
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
  const over = body.length > MESSAGE_MAX;

  const submit = () => {
    if (!body || over || send.isPending) return;
    send.mutate(body, { onSuccess: () => setText("") });
  };

  return (
    <div className="sticky bottom-0 border-t border-white/10 bg-white/3 px-6 py-4 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/*
          Attachment and voice are drawn because the design draws them, and
          disabled because neither exists: the messages contract carries text
          only — no upload, no audio. A control that silently does nothing is
          worse than one that says it cannot yet.
        */}
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <RoundAction label="Attach a file — not available yet" icon="/messages/attach.svg" size={24} disabled />
          <RoundAction label="Voice note — not available yet" icon="/messages/voice.svg" size={24} disabled />
        </div>

        <div
          className={cn(
            "ws-field flex min-h-10 flex-1 items-center justify-between gap-3 rounded-[30px] border border-[#26262B] bg-[#18181C] px-4 py-2",
            over && "border-danger"
          )}
        >
          <label className="sr-only" htmlFor="message-composer">
            Write a message
          </label>
          <textarea
            id="message-composer"
            rows={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the convention in
              // every messenger this sits beside.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Write a message"
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-1 text-[13px] leading-5 text-white caret-[#008CFF] outline-none placeholder:text-white/40"
          />
          <Image
            src="/messages/emoji-add.svg"
            alt=""
            width={20}
            height={20}
            className="shrink-0 opacity-60"
          />
        </div>

        <RoundAction
          label="Send"
          icon="/messages/send.svg"
          size={16}
          filled
          disabled={!body || over || send.isPending}
          onClick={submit}
        />
      </div>

      {over && (
        <p className="tnum mt-2 px-2 text-right text-[11px] text-danger">
          {body.length}/{MESSAGE_MAX}
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
  const days = groupByDay(items);

  return (
    <div className="flex h-full min-h-[calc(100dvh-76px)] flex-col">
      <ThreadHeader conversation={conversation} onBack={onBack} />

      {/* The design's 23px gutter and 24px rhythm between day groups. */}
      <div className="flex flex-1 flex-col gap-6 px-[23px] py-10">
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

        {days.map((day) => (
          <section key={day.key} className="flex flex-col gap-6">
            <DayHeading label={day.label} />
            <div className="flex flex-col gap-6">
              {day.items.map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  mine={Boolean(me.data?.id && message.senderId === me.data.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Composer conversationId={conversation.id} />
    </div>
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

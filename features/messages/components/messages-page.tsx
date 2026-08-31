"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ColumnHeader } from "@/components/layout/column-header";
import { InboxFilters, InboxSearch, type InboxFilter } from "@/features/messages/components/inbox-chrome";
import { ConversationRow } from "@/features/messages/components/conversation-row";
import { Thread } from "@/features/messages/components/thread";
import { ThreadPlaceholder } from "@/features/messages/components/thread-placeholder";
import { visibleConversations } from "@/features/messages/lib/filter";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useConversations } from "@/features/messages/hooks/use-messages";
import { type Conversation } from "@/features/messages/lib/types";

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

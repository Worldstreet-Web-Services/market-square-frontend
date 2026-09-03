"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useMe } from "@/hooks/use-me";
import { usePeople } from "@/features/discovery";
import {
  MessagesPage,
  useOpenConversation,
  type NewChatPickerProps,
} from "@/features/messages";
import type { Profile } from "@/lib/api/schemas";

/**
 * Joins the messages and discovery slices, which never import each other.
 *
 * The inbox's `+` starts a conversation, and starting one means choosing a
 * PERSON — which is the people directory, and that lives in discovery. So the
 * page takes the picker as a slot and this composes it, the same way
 * `profile-screen` composes messages' own Message button into a profile.
 */
export function MessagesScreen() {
  return <MessagesPage renderNewChat={(props) => <NewChatSheet {...props} />} />;
}

/**
 * Choose somebody, get a thread.
 *
 * Node 15:1302 draws the `+` but not what it opens, so this surface is ours.
 * It is built on the directory rather than on a blank "to:" field because a
 * free-text recipient box asks the reader to already know a handle exactly;
 * `GET /profiles` is sorted by followers, so the sheet opens on people worth
 * messaging before a single character is typed.
 *
 * `POST /conversations` is idempotent from either side, so picking somebody
 * you already have a thread with lands ON that thread instead of making a
 * second one — which is what makes this safe to press twice.
 */
function NewChatSheet({ open, onClose, onStarted }: NewChatPickerProps) {
  const [query, setQuery] = useState("");
  const me = useMe();
  const start = useOpenConversation();

  // Only fetch while the sheet is actually open — a directory nobody is
  // looking at is a request nobody asked for.
  const people = usePeople(query, "followers", open);
  const sentinel = useInfiniteScroll(
    () => people.fetchNextPage(),
    Boolean(people.hasNextPage && !people.isFetchingNextPage)
  );

  const items = (people.data?.pages.flatMap((page) => page.items) ?? [])
    // You are not someone you can message. Same rule the People directory
    // applies, and for the same reason: a row that cannot do the thing every
    // other row does reads as broken rather than deliberate.
    .filter((profile) => !me.data || profile.id !== me.data.id);

  const pick = (profile: Profile) => {
    start.mutate(profile.id, {
      onSuccess: (conversation) => {
        // `POST /conversations` answers a Conversation REF — id and
        // participant ids, no peer, preview or unread count. The peer is the
        // person just chosen, so the thread is opened with that rather than
        // waiting a poll for the inbox to carry them.
        onStarted({
          id: conversation.id,
          peer: profile,
          lastMessage: null,
          lastMessageAt: conversation.lastMessageAt ?? null,
          unreadCount: 0,
        });
        setQuery("");
      },
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="New chat">
      <div className="flex flex-col gap-4">
        <div className="ws-field flex h-[38px] items-center gap-2 rounded-full border-[0.68px] border-white/40 px-3">
          <label className="sr-only" htmlFor="new-chat-search">
            Search people
          </label>
          <input
            id="new-chat-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-white outline-none placeholder:text-[#7A7A7A]"
          />
        </div>

        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {people.isPending && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}

          {people.isError && (
            <ErrorState
              error={people.error}
              fallback="Couldn't load people."
              onRetry={() => people.refetch()}
            />
          )}

          {people.isSuccess && items.length === 0 && (
            <EmptyState
              glyph="◇"
              title={query.trim() ? "No matches" : "Nobody to show yet"}
              body={
                query.trim()
                  ? "No one here matches that name."
                  : "The directory is empty right now."
              }
            />
          )}

          {items.map((profile) => (
            <button
              key={profile.id}
              type="button"
              // Disabled while a thread is being opened, so an impatient
              // double-tap cannot fire two creates.
              disabled={start.isPending}
              onClick={() => pick(profile)}
              className="ws-press flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-white/10 hover:bg-white/[0.06] disabled:opacity-60"
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
                <Avatar
                  name={profile.displayName ?? profile.username}
                  seed={profile.id}
                  src={profile.avatarUrl}
                  size={38}
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-bold leading-4 text-white">
                  {profile.displayName ?? profile.username}
                </span>
                <span className="truncate text-[11px] leading-4 text-white/50">
                  @{profile.username}
                </span>
              </span>
            </button>
          ))}

          <div ref={sentinel} />
          {people.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner className="h-5 w-5 text-meta" />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

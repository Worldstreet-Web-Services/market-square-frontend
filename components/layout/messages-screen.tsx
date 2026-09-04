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
import { InboxSearch } from "@/features/messages/components/inbox-chrome";
import { CreateGroupFlow } from "@/components/layout/create-group-flow";
import { OpenHouseSheet } from "@/features/houses";
import { MessagesPage, useOpenConversation, type NewChatPickerProps } from "@/features/messages";
import type { Profile } from "@/lib/api/schemas";

/**
 * Joins the messages and discovery slices, which never import each other.
 *
 * The inbox's `+` opens a menu, and both of its items mean choosing a PERSON —
 * which is the people directory, and that lives in discovery. So the page
 * takes the picker as a slot and this composes it, the same way
 * `profile-screen` composes messages' own Message button into a profile.
 */
export function MessagesScreen() {
  return (
    <MessagesPage
      // A GROUP thread's header offers "Create Gist Room" (node 76:8239). The
      // composer is node 59:7544 and lives in the houses slice, so it is
      // joined here rather than imported across slices — the same reason the
      // people picker is a slot.
      renderGistRoom={({ open, onClose, houseConversationId }) => (
        <OpenHouseSheet
          open={open}
          onClose={onClose}
          houseConversationId={houseConversationId}
        />
      )}
      renderNewChat={(props) =>
        // Two designs, two components. Create Group is a two-STEP flow (choose
        // people, then name and describe the room) and folding it into the
        // one-step gist picker as a mode was what made that picker start
        // growing a second personality.
        props.mode === "group" ? <CreateGroupFlow {...props} /> : <NewChatSheet {...props} />
      }
    />
  );
}

/**
 * New Gist — node 36:7004.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A 347 panel at `rgba(16,16,18,0.62)` behind a 7px backdrop blur, 1px
 * `white/18`, 22px radius, 16px padding and a 12px gap; then the 315x38 search
 * pill and a 12px-gap column of 54.5px rows, each `white/3` inside a 1px
 * `white/10` at a 12px radius, carrying a 38px avatar (`white/10` fill,
 * `white/20` ring), a 12/16 Bold name and an 11/16.5 line at 50% white.
 *
 * The search pill is `InboxSearch` rather than a second copy of it: node
 * 36:7089 is the inbox's own field at the same 315x38 with the same 0.68px
 * hairline, shadow and `#7A7A7A` placeholder. Restating it here is how one
 * field ends up drifting from the other.
 *
 * The file's rows show "8,750 followers" on two of them and "@handle" on the
 * other two. Both are drawn — followers where the directory reports any, the
 * handle otherwise — because a row reading "0 followers" says something less
 * useful about a person than their name does.
 *
 * The heading is the file's 14/20 Bold in GEIST, not the Roboto the style is
 * named for — the house face, per the type rule.
 *
 * `POST /conversations` is idempotent from either side, so picking somebody
 * you already have a thread with lands ON that thread rather than making a
 * second one — which is what makes this safe to press twice.
 */
function NewChatSheet({ open, onClose, onStarted }: NewChatPickerProps) {
  const [query, setQuery] = useState("");
  const me = useMe();
  const start = useOpenConversation();

  // Only fetch while the panel is actually open — a directory nobody is
  // looking at is a request nobody asked for.
  const people = usePeople(query, "followers", open);
  const sentinel = useInfiniteScroll(
    () => people.fetchNextPage(),
    Boolean(people.hasNextPage && !people.isFetchingNextPage)
  );

  const items = (people.data?.pages.flatMap((page) => page.items) ?? []).filter(
    // You are not someone you can message. Same rule the People directory
    // applies, and for the same reason: a row that cannot do the thing every
    // other row does reads as broken rather than deliberate.
    (profile) => !me.data || profile.id !== me.data.id
  );

  const pick = (profile: Profile) => {
    start.mutate(profile.id, {
      onSuccess: (conversation) => {
        // `POST /conversations` answers a Conversation REF — id and
        // participant ids, no peer, preview or unread count. The peer is the
        // person just chosen, so the thread is opened with that rather than
        // waiting a poll for the inbox to carry them.
        // The rest is what a brand-new 1:1 IS, stated rather than defaulted:
        // this picker only ever starts a direct thread, so there is no title,
        // no roster and no request to accept. `requestState` is left off
        // entirely — undefined means "this object does not carry one", which
        // is what the schema's deliberately undefaulted field is for.
        onStarted({
          id: conversation.id,
          kind: "direct",
          imageUrl: null,
          description: null,
          title: null,
          peer: profile,
          members: [],
          memberCount: null,
          lastSender: null,
          lastMessage: null,
          lastMessageAt: conversation.lastMessageAt ?? null,
          lastActiveAt: null,
          requestedBy: null,
          unreadCount: 0,
        });
        setQuery("");
      },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      bare
      // The file's own surface: 347 wide, 62% woodsmoke behind a 7px blur,
      // 18% hairline, 22px radius.
      panelClassName="border border-white/[0.18] bg-[#101012]/[0.62] backdrop-blur-[7px] sm:max-w-[347px] sm:rounded-[22px]"
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-[14px] font-bold leading-5 text-white">New Gist</h2>

        <InboxSearch value={query} onChange={setQuery} id="new-chat-search" label="Search people" />

        <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto">
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
                query.trim() ? "No one here matches that name." : "The directory is empty right now."
              }
            />
          )}

          {items.map((profile) => {
            const name = profile.displayName ?? profile.username;
            return (
              <button
                key={profile.id}
                type="button"
                // Disabled while a thread is being opened, so an impatient
                // double-tap cannot fire two creates.
                disabled={start.isPending}
                onClick={() => pick(profile)}
                // The file's 54.5px row: 3% fill, 10% hairline, 12px radius.
                className="ws-press flex h-[54.5px] items-center gap-[9px] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
                  <Avatar name={name} seed={profile.id} src={profile.avatarUrl} size={38} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] font-bold leading-4 text-white">{name}</span>
                  <span className="truncate text-[11px] leading-[16.5px] text-white/50">
                    {/* The file shows a follower count on the rows that have
                        one and a handle on the rest. "0 followers" tells a
                        reader less than the handle does. */}
                    {profile.followerCount > 0
                      ? `${profile.followerCount.toLocaleString()} followers`
                      : `@${profile.username}`}
                  </span>
                </span>
              </button>
            );
          })}

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

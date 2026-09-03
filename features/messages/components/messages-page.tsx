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

/**
 * The picker behind the column's `+`.
 *
 * Passed in rather than imported: starting a chat means choosing a PERSON, the
 * people directory lives in the discovery slice, and slices never import each
 * other. `components/layout/messages-screen.tsx` joins the two — the same
 * route-slot pattern `profile-screen` uses for this slice's own Message
 * button.
 */
export interface NewChatPickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with a thread to open once a person has been chosen. */
  onStarted: (conversation: Conversation) => void;
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

  return (
    <>
      {/*
        NO ColumnHeader, and this is the one column surface that goes without
        one — the convention in CLAUDE.md is stated for the routes that need a
        title bar over a list, and node 15:1302 deliberately does not give the
        inbox one. The breadcrumb above already reads "Ark Ecosystem/ Chat"
        with the leaf in white, so a second "Messages" heading inside the
        column was the page saying its own name twice and cost 24px of the
        room the list wants.

        `ColumnHeader` is still imported by the signed-out branch below, which
        has no list to head and does need to say where you are.

        THE FILE'S VERTICAL RHYTHM, which is why the padding is spelled out
        rather than left to gap-6 everywhere: search at y=24, tabs at y=86,
        list at y=148 — 24px of air above the search and 24 between each of
        the three blocks, inside 24px gutters on a 464 column (416 of content).
      */}
      <div className="flex flex-col gap-6 px-6 pt-6">
        <InboxSearch value={query} onChange={setQuery} />
        <InboxFilters value={filter} onChange={setFilter} />
      </div>

      {/* 24 from the tabs, 16 between rows — the file's `gap: 16px` on the
          list frame. The bottom padding clears the `+` so the last row is
          never sitting underneath it. */}
      <div className="flex flex-col gap-4 px-6 pb-28 pt-6">
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

/**
 * The inbox column's own create button.
 *
 * It is NOT the shell's `CreateFab`, and the difference is the point. The
 * shell's floating `+` writes a POST and holds the right edge of the VIEWPORT
 * — on this route that puts it over the thread pane, beside a composer, where
 * a `+` means "send this message". The file draws its `+` inside the 464
 * column instead (right edge flush with the column's border, 12px of padding
 * inside a 76.79 hit frame), and in a conversation list a `+` means one thing:
 * start a new one.
 *
 * `allowsCompose` therefore excludes `/messages`, so exactly one purple circle
 * is on screen and it does the thing its position implies.
 *
 * Geometry and paint are the file's, with one deliberate reuse: the circle is
 * 52.79487px inside 12px of padding as node 24:6372 draws it, but the gradient
 * comes from `ws-btn-fab` rather than this node's `201deg 13%→100%`. Both
 * describe the same object with the same two stops of the same purple ramp
 * (`--color-spotlight` → `--color-spotlight-chip-ink`); shipping a second
 * angle for the same button is how one control ends up with two paints.
 */
function NewChatFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="New chat"
      // ABSOLUTE against the column, and mounted as a SIBLING of the column's
      // scroller rather than inside it — an absolute child of a scroll box
      // scrolls away with the content, and `fixed` would put it back on the
      // viewport's edge, which is the placement this exists to avoid.
      //
      // 12px from the column's right border and 12 from its bottom: the file's
      // own inset, expressed there as 12px of padding on every side of the
      // 76.79 hit frame around the 52.79 circle.
      className="ws-btn-fab ws-press absolute bottom-3 right-3 z-20 flex h-[52.79487px] w-[52.79487px] items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-opacity hover:opacity-90"
    >
        {/* The file's `ci:add-plus`: a 24px box with a 12px cross stroked at
            2px. Drawn rather than typed, because the glyph "+" is centred on
            its own metrics and lands high in a circle this size. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M12 6v12M6 12h12" />
      </svg>
    </button>
  );
}

export function MessagesPage({
  /** The people picker for the column's `+` — see NewChatPickerProps. */
  renderNewChat,
}: {
  renderNewChat?: (props: NewChatPickerProps) => React.ReactNode;
} = {}) {
  const { ready, authenticated, login } = useAuth();
  const [open, setOpen] = useState<Conversation | null>(null);
  const [picking, setPicking] = useState(false);

  if (ready && !authenticated) {
    return (
      <>
        <ColumnHeader title="Chat" />
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
    /*
      Two panes on a desktop, one at a time on a phone.

      The list is a fixed 464 because that is what node 15:1302 fixes it at —
      416 of content inside 24px gutters, widened from the 395/347 of the
      earlier frame — and a conversation list that reflows with the window
      makes the previews rewrap on every drag. The thread takes whatever is
      left.

      On a phone the list gives way to the thread entirely, which is why the
      route is only wide at its exact path.

      HEIGHT. Messages is the one route that does not scroll as a page. It
      claims exactly the room the shell leaves — the viewport less the mobile
      top strip, the mobile tab bar and the desktop breadcrumb bar — and then
      each pane scrolls inside itself. That is what lets the chat pane pin its
      header and its composer and move only the messages between them. Without
      the bound, both panes grow to fit their content and the whole document
      scrolls instead.

      `--ws-crumb-h` is the third term and was missing: the breadcrumb is 0 on
      a phone but 76px from md up, so on every desktop the two panes ran 76px
      past the bottom of the window and the document scrolled by exactly that
      much — which is also why the composer could not be reached without
      scrolling a pane that was supposed to be pinned.
    */
    <div className="flex h-[calc(100dvh-var(--ws-topbar-h)-var(--ws-crumb-h)-var(--ws-nav-h))] overflow-hidden">
      <div
        className={cn(
          // `relative` so the `+` can be positioned against the COLUMN. It is
          // the wrapper that is relative, not the scroller, because an
          // absolute child of a scroll box scrolls with the content.
          "relative w-full shrink-0 lg:w-[464px] lg:border-r lg:border-white/10",
          open && "hidden lg:block"
        )}
      >
        <div
          // The scroller, so a long inbox does not drag the chat pane with it.
          // `--ws-topbar-h` is reset to 0 inside: it exists to hold sticky
          // children clear of the shell's FIXED top strip, and this box already
          // starts below that strip, so the offset would push the inbox header
          // 48px down its own scroll box on a phone.
          className="h-full overflow-y-auto [--ws-topbar-h:0px]"
        >
          <Inbox onOpen={setOpen} selectedId={open?.id} />
        </div>

        {renderNewChat && <NewChatFab onClick={() => setPicking(true)} />}
      </div>

      {/* `min-h-0` so the chat pane can be shorter than its content and scroll
          internally rather than stretching this row. */}
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !open && "hidden lg:flex")}>
        {open ? (
          <Thread conversation={open} onBack={() => setOpen(null)} />
        ) : (
          <ThreadPlaceholder />
        )}
      </div>

      {renderNewChat?.({
        open: picking,
        onClose: () => setPicking(false),
        onStarted: (conversation) => {
          setPicking(false);
          setOpen(conversation);
        },
      })}
    </div>
  );
}

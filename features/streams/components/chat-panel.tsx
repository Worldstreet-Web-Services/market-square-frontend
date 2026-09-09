"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import { IconChevronDown, IconDots, IconEmoji, IconSend } from "@/components/ui/icons";
import { useChat, useSendChat } from "@/features/streams/hooks/use-chat";
import type { ChatMessage, Stream } from "@/features/streams/lib/types";

export interface ChatModeration {
  onRemove: (messageId: string) => void;
  onBan: (userId: string) => void;
}

// Rank 1 gets its own column; 2 and 3 stack beside it, which is how TikTok
// weights the leader without a chart.
function TopViewers({ messages }: { messages: ChatMessage[] }) {
  const leaders = useMemo(() => {
    const seen = new Set<string>();
    return messages
      .filter((message) => {
        if (!message.author || seen.has(message.authorId)) return false;
        seen.add(message.authorId);
        return true;
      })
      .slice(0, 3);
  }, [messages]);

  return (
    <div className="ws-hair shrink-0 border-b px-5 py-4">
      {/* A label, not a control: there is no expanded leaderboard behind it,
          so it no longer dresses itself as a link. */}
      <p className="mb-3 text-[13px] font-semibold text-meta">Top viewers</p>

      {leaders.length === 0 ? (
        <p className="text-[13px] text-grey-600">Viewer rankings appear as chat gets going.</p>
      ) : (
        <div className="flex items-center gap-4">
          {leaders[0] && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="ws-display text-3xl leading-none text-create">1</span>
              <span className="text-center">
                <span className="block rounded-full p-[2px] ring-2 ring-create/60">
                  <Avatar
                    name={leaders[0].author?.displayName ?? "Viewer"}
                    seed={leaders[0].authorId} src={leaders[0].author?.avatarUrl}
                    size={46}
                  />
                </span>
                <span className="mt-1 block max-w-16 truncate text-[11px] text-body">
                  {leaders[0].author?.displayName}
                </span>
              </span>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {leaders.slice(1).map((message, index) => (
              <div key={message.authorId} className="flex min-w-0 items-center gap-2">
                <span className="ws-display w-3 shrink-0 text-base leading-none text-grey-500">
                  {index + 2}
                </span>
                <Avatar
                  name={message.author?.displayName ?? "Viewer"}
                  seed={message.authorId} src={message.author?.avatarUrl}
                  size={26}
                />
                <span className="min-w-0 truncate text-[12px] text-body">
                  {message.author?.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  stream,
  variant = "card",
  moderation,
  showTopViewers = false,
}: {
  stream: Stream;
  /** "overlay": transparent column over video — masked top fade, text
      shadows, glass input, no panel chrome. */
  variant?: "card" | "overlay" | "theater";
  /** Host-only moderation menu (remove message / ban author). */
  moderation?: ChatModeration;
  showTopViewers?: boolean;
}) {
  const chat = useChat(stream.id, stream.status === "live");
  const send = useSendChat(stream.id);
  const gate = useGate();
  const [draft, setDraft] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  /**
   * Follow the live chat the way every broadcast app does: ride the bottom
   * while you are at the bottom, and stop the moment the reader scrolls up.
   *
   * The old version keyed on `items.length` and set `scrollTop` outright, which
   * failed in both directions. It MISSED arrivals, because the endpoint answers
   * with a window rather than the whole history — once that window is full the
   * count stops changing, every later message replaces an older one, and the
   * effect never fires again. And when it did fire it yanked the reader back
   * down mid-sentence, which is the one thing a chat must not do to somebody
   * reading what was said thirty seconds ago.
   *
   * So: key on the LAST MESSAGE ID (a window that slides still changes its last
   * id), and only follow while pinned. Unpinned, the new messages are counted
   * and offered on a pill instead — the reader decides when to rejoin the live
   * edge, which is exactly the affordance TikTok and YouTube put there.
   */
  const items = chat.data?.items;
  const lastId = items && items.length > 0 ? items[items.length - 1].id : null;
  // Pinning is a REF, not state: nothing renders from it, and the arrival
  // effect must not re-run when it flips — scrolling up would otherwise be the
  // thing that triggers a scroll. `behind` is the only part that renders.
  const pinnedRef = useRef(true);
  const [behind, setBehind] = useState(0);
  // First paint jumps; every message after that glides. An animated scroll on
  // mount is the panel appearing to load in front of you.
  const settled = useRef(false);

  const jumpToLatest = useCallback((smooth: boolean) => {
    const node = listRef.current;
    if (!node) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth && !reduced ? "smooth" : "auto" });
    pinnedRef.current = true;
    setBehind(0);
  }, []);

  useEffect(() => {
    if (!lastId) return;
    if (pinnedRef.current) {
      jumpToLatest(settled.current);
      settled.current = true;
      return;
    }
    setBehind((previous) => previous + 1);
  }, [lastId, jumpToLatest]);

  // 48px of slack, not equality: a smooth scroll lands a fraction short, and
  // sub-pixel heights mean `scrollTop + clientHeight === scrollHeight` is a
  // condition that is briefly false while sitting still at the bottom.
  const handleScroll = () => {
    const node = listRef.current;
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    pinnedRef.current = atBottom;
    if (atBottom) setBehind(0);
  };

  const gatedByTicket =
    stream.visibility === "ticketed" && !stream.myTicket && errorCode(send.error) === "FORBIDDEN";

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    gate(() =>
      send.mutate(text, {
        onSuccess: () => {
          setDraft("");
          // Saying something is opting back into the live edge: nobody types a
          // message and then wants to keep reading history.
          jumpToLatest(true);
        },
      })
    );
  };

  const overlay = variant === "overlay";
  const theater = variant === "theater";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        overlay ? "max-w-[340px]" : theater ? "bg-panel" : "ws-card"
      )}
    >
      {variant === "card" && (
        <p className="ws-display ws-hair border-b px-4 py-3 text-sm">Chat</p>
      )}

      {theater && showTopViewers && <TopViewers messages={chat.data?.items ?? []} />}

      <ul
        ref={listRef}
        onScroll={handleScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          overlay ? "ws-chat-mask space-y-2 px-1 py-2" : "px-3 py-3"
        )}
      >
        {chat.isPending &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="flex gap-2.5 px-2 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-4/5" />
              </div>
            </li>
          ))}
        {chat.isSuccess && chat.data.items.length === 0 && (
          <li className="py-6 text-center text-[13px] text-grey-500">
            {stream.status === "live" ? "No messages yet — say hi." : "Chat opens when the stream is live."}
          </li>
        )}

        {chat.data?.items.map((message) => (
          <li
            key={message.id}
            className={cn(
              "group relative flex gap-2.5 rounded-xl px-2 py-1.5 transition-colors",
              overlay ? "ws-text-shadow" : "hover:bg-white/[0.04]"
            )}
          >
            <Avatar
              name={message.author?.displayName ?? message.authorId.slice(-4) ?? "?"}
              seed={message.authorId} src={message.author?.avatarUrl}
              size={32}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              {/* Name row stays quiet so the message itself is what reads. */}
              <p className="flex items-center gap-1.5 text-[13px] text-meta">
                <span className="truncate font-semibold">
                  {message.author?.displayName ?? `Member ·${message.authorId.slice(-4)}`}
                </span>
                {/* Host by ownership; creator/worldstreet by hydrated role. */}
                {message.authorId === stream.ownerId ? (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink">
                    Host
                  </span>
                ) : message.author && message.author.role !== "citizen" ? (
                  <span className="shrink-0 rounded-full border border-white/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-body">
                    {message.author.role === "worldstreet" ? "WorldStreet" : message.author.role}
                  </span>
                ) : null}
                {overlay && <span className="shrink-0">· {relativeTime(message.createdAt)}</span>}
              </p>
              <p className="break-words text-[14px] font-medium leading-snug text-heading">
                {message.text}
              </p>
            </div>

            {moderation && message.authorId !== stream.ownerId && (
              <div className="shrink-0">
                <button
                  aria-label="Moderate message"
                  onClick={() => setMenuFor(menuFor === message.id ? null : message.id)}
                  className="rounded-full p-1 text-meta transition-opacity hover:bg-white/10 hover:text-heading md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <IconDots className="h-4 w-4" />
                </button>
                {menuFor === message.id && (
                  <>
                    <button
                      aria-label="Close moderation menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuFor(null)}
                    />
                    <div className="ws-overlay absolute right-0 z-20 mt-1 w-44 rounded-2xl p-1.5">
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          moderation.onRemove(message.id);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
                      >
                        Remove message
                      </button>
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          moderation.onBan(message.authorId);
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-down transition-colors hover:bg-white/10"
                      >
                        Ban from chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Only while there is something to rejoin. A control that is always
          there, greyed out, teaches people to stop looking at that spot. */}
      {behind > 0 && (
        <div className="pointer-events-none relative z-10 flex justify-center">
          <button
            onClick={() => jumpToLatest(true)}
            className="ws-press pointer-events-auto -mt-1 mb-1 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-ink shadow-[0_6px_20px_-6px_rgba(0,0,0,0.9)]"
          >
            <IconChevronDown className="h-3.5 w-3.5" />
            {behind === 1 ? "1 new message" : `${behind} new messages`}
          </button>
        </div>
      )}

      <div className={overlay ? "pt-2" : cn("ws-hair border-t p-3", theater && "px-4 py-4")}>
        {send.isError && !gatedByTicket && (
          <InlineError error={send.error} fallback="Couldn't send that." className="mb-2" />
        )}
        {gatedByTicket && (
          <p className="mb-2 text-[13px] text-meta">Chat is for ticket holders on this stream.</p>
        )}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            overlay ? "ws-glass rounded-full" : theater ? "ws-field" : "ws-inset"
          )}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={300}
            disabled={stream.status !== "live"}
            placeholder={stream.status === "live" ? "Say something nice" : "Chat is closed"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
          />
          {theater && (
            <span className="text-meta" aria-hidden>
              <IconEmoji className="h-4 w-4" />
            </span>
          )}
          <button
            onClick={submit}
            disabled={send.isPending || !draft.trim() || stream.status !== "live"}
            aria-label="Send message"
            className="rounded-full p-1.5 text-accent transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

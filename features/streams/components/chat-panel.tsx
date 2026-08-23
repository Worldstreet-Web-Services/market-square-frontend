"use client";

import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import { IconDots, IconSend } from "@/components/ui/icons";
import { useChat, useSendChat } from "@/features/streams/hooks/use-chat";
import type { Stream } from "@/features/streams/lib/types";

export interface ChatModeration {
  onRemove: (messageId: string) => void;
  onBan: (userId: string) => void;
}

export function ChatPanel({
  stream,
  variant = "card",
  moderation,
}: {
  stream: Stream;
  /** "overlay": transparent column over video — masked top fade, text
      shadows, glass input, no panel chrome. */
  variant?: "card" | "overlay";
  /** Host-only moderation menu (remove message / ban author). */
  moderation?: ChatModeration;
}) {
  const chat = useChat(stream.id, stream.status === "live");
  const send = useSendChat(stream.id);
  const gate = useGate();
  const [draft, setDraft] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const count = chat.data?.items.length ?? 0;
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count]);

  const gatedByTicket =
    stream.visibility === "ticketed" && !stream.myTicket && errorCode(send.error) === "FORBIDDEN";

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    gate(() =>
      send.mutate(text, {
        onSuccess: () => setDraft(""),
      })
    );
  };

  const overlay = variant === "overlay";
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        overlay ? "max-w-[340px]" : "ws-card"
      )}
    >
      {!overlay && <p className="ws-display border-b border-white/8 px-4 py-3 text-sm">Chat</p>}
      <ul
        ref={listRef}
        className={cn(
          "min-h-0 flex-1 space-y-3 overflow-y-auto",
          overlay ? "ws-chat-mask px-1 py-2" : "px-4 py-3"
        )}
      >
        {chat.isPending &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="flex gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-4/5" />
              </div>
            </li>
          ))}
        {chat.isSuccess && chat.data.items.length === 0 && (
          <li className="py-6 text-center text-xs text-grey-500">
            {stream.status === "live" ? "No messages yet — say hi." : "Chat opens when the stream is live."}
          </li>
        )}
        {chat.data?.items.map((message) => (
          <li key={message.id} className={cn("group relative flex gap-2", overlay && "ws-text-shadow")}>
            <Avatar
              name={message.author?.displayName ?? message.authorId.slice(-4) ?? "?"}
              src={message.author?.avatarUrl}
              size={28}
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] text-grey-500">
                <span
                  className={cn(
                    "font-semibold",
                    overlay ? "text-[13px] text-accent" : "text-grey-300"
                  )}
                >
                  {message.author?.displayName ?? `Member ·${message.authorId.slice(-4)}`}
                </span>
                {/* Host by ownership; creator/worldstreet by hydrated role. */}
                {message.authorId === stream.ownerId ? (
                  <span className="rounded-full bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-ink">
                    Host
                  </span>
                ) : message.author && message.author.role !== "citizen" ? (
                  <span className="rounded-full border border-white/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-grey-300">
                    {message.author.role === "worldstreet" ? "WorldStreet" : message.author.role}
                  </span>
                ) : null}
                <span>· {relativeTime(message.createdAt)}</span>
              </p>
              <p className={cn("break-words text-sm", overlay ? "text-heading" : "text-grey-100")}>
                {message.text}
              </p>
            </div>
            {moderation && message.authorId !== stream.ownerId && (
              <div className="ml-auto shrink-0">
                <button
                  aria-label="Moderate message"
                  onClick={() => setMenuFor(menuFor === message.id ? null : message.id)}
                  className="rounded-full p-1 text-grey-500 opacity-100 transition-opacity hover:bg-white/10 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-grey-200 transition-colors hover:bg-white/10"
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
      <div className={overlay ? "pt-2" : "border-t border-white/8 p-3"}>
        {send.isError && !gatedByTicket && (
          <InlineError error={send.error} fallback="Couldn't send that." className="mb-2" />
        )}
        {gatedByTicket && (
          <p className="mb-2 text-xs text-grey-500">Chat is for ticket holders on this stream.</p>
        )}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            overlay ? "ws-glass rounded-full" : "ws-inset"
          )}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={300}
            disabled={stream.status !== "live"}
            placeholder={stream.status === "live" ? "Say something" : "Chat is closed"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
          />
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

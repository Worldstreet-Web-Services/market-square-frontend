"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, VerifiedBadge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconArrowLeft } from "@/components/ui/icons";
import {
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from "@/features/messages/hooks/use-messages";
import { formatClockTime, groupMessagesByDay } from "@/features/messages/lib/thread-groups";
import { MESSAGE_MAX, type Conversation, type Message } from "@/features/messages/lib/types";

/**
 * The conversation pane — the other half of the Messages screen.
 *
 * Three bands, at the file's numbers: an 80px identity header, the message
 * river in day sections, and an 80px composer. Both bands are 16px/24px inset
 * with a 10% white hairline, and the river sits in the same 24px gutters (the
 * file draws it at x=23 in an 821 pane, which is 24 either side of 774).
 *
 * TYPEFACE. The file names Roboto for the bubbles and Geist for the composer
 * field. The app is Geist throughout, so every size, weight, line-height and
 * letter-spacing below is the file's and the family is the app's — one pane
 * rendering in a second family reads as a bug, not as a design.
 */

/** 12px double-check, the file's "Chat Status → Sent" glyph. Exported rather
    than approximated: the house set has a single `IconCheck` and no double. */
function SentMark() {
  return (
    <>
      <Image src="/messages/checks.svg" alt="" width={12} height={12} className="shrink-0" />
      {/* The file's variant is literally named "Status=Sent", and sent is all
          the service tells us — a message that came back from the server was
          accepted. There is no delivered/read signal in the payload, so this
          mark never changes state. */}
      <span className="sr-only">Sent</span>
    </>
  );
}

function ThreadHeader({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const peer = conversation.peer;

  return (
    // The file gives this band a fully transparent fill. It is sticky over
    // scrolling messages, so it needs an opaque one; `bg-ground` is the app's.
    // The hairline is the file's 10%, not `ws-head`'s 8%.
    <header className="sticky top-[var(--ws-topbar-h)] z-30 flex min-h-20 items-center gap-4 border-b border-white/10 bg-ground px-6 py-4">
      {/* Not in the file, which only ever draws the desktop two-pane state.
          Below lg the list gives way to the thread entirely, so without this
          there is no way back to the inbox. Hidden where both panes are up. */}
      <button
        onClick={onBack}
        aria-label="Back to inbox"
        className="ws-press -ml-2 shrink-0 rounded-full p-2 text-heading transition-colors hover:bg-white/10 lg:hidden"
      >
        <IconArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
          <Avatar
            name={peer?.displayName ?? "?"}
            seed={peer?.id}
            src={peer?.avatarUrl}
            size={38}
          />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="truncate text-[12px] font-bold leading-4 text-white">
              {peer?.displayName ?? "Conversation"}
            </h1>
            {peer && (
              <>
                <VerifiedBadge verification={peer.verification} className="h-3 w-3 shrink-0" />
                {/* The file's capsule here is the ARK org badge, not a check.
                    It is a 13.29px-radius pill at 4% white with a 19% white
                    hairline around a 4.55px wordmark — `OrgBadgeChip`'s exact
                    recipe at about 65% scale — and the exported glyph carries
                    ARK's signature #979797-at-18% flanking marks rather than
                    MARKET's solid white ones. Drawn at the house size: a
                    4.55px wordmark is unreadable, and this chip is 7px tall on
                    every other surface in the app. */}
                <OrgBadgeChip orgBadge={peer.orgBadge} />
              </>
            )}
          </div>

          {/* The file puts "Typing…" on this line, in italic. There is no
              presence channel on the messages service — no typing event, no
              online state — so inventing one would be a lie. The handle takes
              the slot at the file's size, line-height and colour, upright
              because it is an identity and not an activity. */}
          {peer && (
            <p className="truncate text-[12.12px] font-normal leading-[16.15px] text-white/50">
              @{peer.username}
            </p>
          )}
        </div>
      </div>

      {/*
        OMITTED, deliberately: the file's two trailing 38.37px circles — a
        video-call button and a kebab. The product has no calling of any kind,
        and there is no thread-level menu behind the kebab (no mute, block,
        report or delete on the messages service). Both would be buttons that
        never do anything. The geometry is a `Vertical container` — 38.37px
        circle, transparent fill, 1px white ring, 16px/24px glyph — if either
        capability lands.
      */}
    </header>
  );
}

/**
 * One bubble.
 *
 * The file's geometry both ways: 16px radius, 12px padding, and the body text
 * and the timestamp as SIBLINGS in one bottom-aligned row 10px apart, so the
 * meta hangs off the last line rather than sitting under the message.
 *
 * Own messages are the WHITE bubble on the right, the peer's are the purple
 * one on the left — which is the file's assignment, and the inverse of the
 * usual convention. It is not a misread: only the right-hand bubbles carry the
 * sent mark, and only outgoing messages have one.
 */
function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const removed = message.status === "removed";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // The file's bubbles hug their content and never wrap, so the cap is
          // ours. 480 is where its longest line lands; the percentage keeps a
          // narrow phone pane from running edge to edge.
          "flex max-w-[min(85%,480px)] items-end gap-2.5 rounded-2xl p-3",
          mine ? "bg-white" : "bg-spotlight"
        )}
      >
        <p
          className={cn(
            "min-w-0 whitespace-pre-wrap break-words text-[14px] font-normal leading-5 tracking-[-0.006em]",
            mine ? "text-[#5A5A5A]" : "text-white",
            removed && "italic opacity-60"
          )}
        >
          {removed ? "Message removed" : message.text}
        </p>

        <span className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "tnum text-[12px] font-medium leading-4 tracking-[-0.005em]",
              // #8A8A8A is the file's timestamp colour on BOTH bubbles. It
              // reads on white; on the purple it is roughly 1.6:1 and simply
              // cannot be read, so the purple bubble gets white at 70% instead.
              // This is the one colour on this pane that is not the file's.
              mine ? "text-[#8A8A8A]" : "text-white/70"
            )}
          >
            {formatClockTime(message.createdAt)}
          </span>
          {mine && <SentMark />}
        </span>
      </div>
    </div>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const [text, setText] = useState("");
  const body = text.trim();

  const submit = () => {
    if (!body || send.isPending) return;
    send.mutate(body, { onSuccess: () => setText("") });
  };

  return (
    // 3% white over the app's pure-black ground, flattened to an opaque value
    // because this bar is sticky and a translucent one would show the messages
    // sliding under it. The hairline above is the file's 10%.
    <div className="sticky bottom-0 z-20 flex min-h-20 flex-col justify-center gap-1 border-t border-white/10 bg-[#080808] px-6 py-4">
      <div className="flex items-center gap-4">
        {/*
          OMITTED, deliberately: the file's attachment and voice-note buttons,
          two 38.37px ringed circles ahead of the field. `POST
          /conversations/:id/messages` takes a `text` body and nothing else —
          there is no upload, no media id and no audio on the messages service —
          so neither button could ever send anything.
        */}

        <label className="sr-only" htmlFor="message-composer">
          Write a message
        </label>
        {/* The file draws this pill at a fixed 40 tall with 16px padding all
            round, which does not fit inside 40. Read as a 16px horizontal
            inset on a 40px row with its content centred. It grows past 40 on a
            multi-line draft, which the file has no state for — losing
            shift+enter to keep the pill rigid would be the worse trade. */}
        <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[30px] border border-[#26262B] bg-[#18181C] px-4 py-2">
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
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent text-[13px] leading-5 text-white outline-none placeholder:text-meta"
          />
          {/* Decoration, not a control — there is no emoji picker in the app,
              and the live-stream composer draws the same glyph the same way.
              The exported 20px asset, since the house `IconEmoji` is a plain
              smiley and the file's carries a plus. */}
          <span aria-hidden className="shrink-0">
            <Image src="/messages/emoji.svg" alt="" width={20} height={20} />
          </span>
        </div>

        <button
          onClick={submit}
          disabled={!body || send.isPending}
          aria-label="Send message"
          className="ws-press flex h-[38.37px] w-[38.37px] shrink-0 items-center justify-center rounded-full border border-white bg-spotlight text-white transition-opacity disabled:opacity-40"
        >
          {send.isPending ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Image src="/messages/send.svg" alt="" width={16} height={16} />
          )}
        </button>
      </div>

      {text.length > MESSAGE_MAX - 200 && (
        <p className="tnum text-right text-[11px] text-meta">{MESSAGE_MAX - text.length} left</p>
      )}
    </div>
  );
}

export function Thread({
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
  const days = groupMessagesByDay(items);

  return (
    <div className="flex min-h-full flex-col">
      <ThreadHeader conversation={conversation} onBack={onBack} />

      {/* 40px from the header to the first separator is the file's (header 80,
          first label at y=120). The gap below is ours — the file's two day
          sections are absolutely placed, so it has no measurable bottom, and
          24 is every other gap in this pane. */}
      <div className="flex flex-1 flex-col gap-6 px-6 pb-6 pt-10">
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
            {day.label && (
              <p className="text-center text-[16px] font-medium leading-6 text-white/60">
                {day.label}
              </p>
            )}
            <div className="flex flex-col gap-6">
              {day.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  // The thread is 1:1 and the payload carries no `sender`, so
                  // "mine" is the only distinction there is to draw — and the
                  // file draws no avatars in the river, only in the header.
                  mine={Boolean(me.data && message.senderId === me.data.id)}
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

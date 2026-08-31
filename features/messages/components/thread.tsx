"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip } from "@/components/ui/badge";
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
import { isAtBottom } from "@/features/messages/lib/thread-scroll";
import { MESSAGE_MAX, type Conversation, type Message } from "@/features/messages/lib/types";

/**
 * The conversation pane — the chat side of the Messages screen.
 *
 * Three bands, at the design's numbers: an 80px identity header, the message
 * river in day sections, and an 80px composer. Both bands are inset 16px/24px
 * with a 10% white hairline, and the river sits in the same 24px gutters (the
 * source draws it at x=23 in an 821 pane, which is 24 either side of 774).
 *
 * TYPEFACE. The design source names Roboto for the bubbles and day separators
 * and Geist for the composer field. The app is Geist throughout, so every size,
 * weight, line-height and letter-spacing below is the source's and the family
 * is the app's — one pane rendering in a second family reads as a bug rather
 * than as a design.
 */

/**
 * The round icon button that appears four times across this pane — two in the
 * header, two ahead of the composer field — plus the send button, which is the
 * same shape in purple.
 *
 * Geometry is the source's, literally: 38.37px, no fill, a 1px white ring, and
 * 8.077px of padding around the glyph.
 *
 * The fill really is nothing. #11064:5761, :5764, :5770 and :5773 each report
 * `rgba(0, 0, 0, 0)`, and this was once read as a serialisation artefact and
 * painted #0A0A0A. It is not one: the send button (#11064:5780) sits in the
 * same node tree and reports its #7E3BEB fill perfectly well, so transparency
 * is not being lost on the way out — these circles simply have no fill, and
 * the pane behind them is meant to show through.
 */
function CircleButton({
  label,
  icon,
  size,
  onClick,
  disabled,
  title,
  accent,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  /** The glyph's own box — 16 or 24 in the source, per icon. */
  size: number;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** The send button: same circle, purple fill. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={cn(
        // The source fills every one of these `rgba(0, 0, 0, 0)` and strokes
        // it #FFFFFF — only send (#11064:5780) carries a fill, #7E3BEB, and it
        // keeps the same white stroke. A near-black fill reads as a lighter
        // disc over the #080808 composer bar and blocks the header's blur.
        "ws-press flex h-[38.37px] w-[38.37px] shrink-0 items-center justify-center rounded-full border border-white transition-colors disabled:opacity-40",
        accent ? "bg-spotlight" : "bg-transparent",
        // Neither hover nor disabled exists as a state in the source — these
        // are the house treatments, the same wash the post card's "more" disc
        // and the column header's back arrow use.
        disabled ? "cursor-not-allowed" : "hover:bg-white/10",
        className
      )}
    >
      {/* The source pads these by 8.077px, which is exact for its 16px glyphs
          and overflows its own 38.37px box for the 24px ones. The glyph's own
          size is the reliable half of that pair, so it is set here and the
          circle simply centres it. */}
      <span className="flex items-center justify-center" style={{ width: size, height: size }}>
        {icon}
      </span>
    </button>
  );
}

/** 12px double-check, the source's "Chat Status → Sent" glyph. Exported rather
    than approximated: the house set has a single `IconCheck` and no double. */
function SentMark() {
  return (
    <>
      <Image src="/messages/checks.svg" alt="" width={12} height={12} className="shrink-0" />
      {/* The source's variant is literally named "Status=Sent", and sent is all
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
    // Pinned, not sticky: this band is a fixed row of the pane's flex column
    // and never enters the scroller, so it cannot drift or jitter the way a
    // sticky element does. The source gives it a fully transparent fill; it
    // sits over the app ground, so it takes `bg-ground`. The hairline is the
    // source's 10%, not `ws-head`'s 8%.
    <header className="flex min-h-20 shrink-0 items-center gap-4 border-b border-white/10 bg-ground px-6 py-4">
      {/* Not in the source, which only ever draws the desktop two-pane state.
          Below lg the list gives way to the thread entirely, so without this
          there is no route back to the inbox. Hidden where both panes are up. */}
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
            {/* The source draws exactly ONE capsule here — the admin-granted
                badge, which is `OrgBadgeChip`: its recipe exactly, a 4% white
                pill with a 19% white hairline around the MARKET/ARK wordmark,
                at about 65% of the house scale. Drawn at the house size, since
                a 4.55px wordmark is unreadable and this chip is 7px tall on
                every other surface in the app. */}
            {peer && <OrgBadgeChip orgBadge={peer.orgBadge} />}
          </div>

          {/* The source puts "Typing…" on this line, in italic. There is no
              presence channel on the messages service — no typing event, no
              online state — so inventing one would be a lie. The handle takes
              the slot at the source's exact size, line-height and colour,
              upright because it is an identity and not an activity. */}
          {peer && (
            <p className="truncate text-[12.12px] font-normal leading-[16.15px] text-white/50">
              @{peer.username}
            </p>
          )}
        </div>
      </div>

      {/*
        The source draws two trailing controls here — a video call and a
        conversation menu — and both are HIDDEN rather than drawn.

        Nothing is behind either one: the product has no calling of any kind,
        and the messages service has no thread-level menu (no mute, block,
        report or delete). A disabled button still reads as a feature that is
        one tap away, and a screen full of things that cannot be used teaches
        people to stop trying them.

        The geometry is preserved above in `CircleButton` and the icons are in
        public/messages/, so restoring either is a few lines the day its route
        lands.
      */}

    </header>
  );
}

/**
 * One bubble.
 *
 * The source's geometry both ways: 16px radius, 12px padding, and the body
 * text and the timestamp as SIBLINGS in one bottom-aligned row 10px apart, so
 * the meta hangs off the last line rather than sitting under the message.
 *
 * Own messages are the WHITE bubble on the right, the peer's the purple one on
 * the left — the source's assignment, and the inverse of the usual convention.
 * The evidence is position, not colour: every #FFFFFF bubble ends at x=8607
 * and every #7E3BEB one starts at x=7833, in a pane spanning 7810..8631.
 *
 * Do NOT re-derive this from the sent marks. The source draws a check on all
 * four bubbles, incoming included (#8A8A8A on the white, #999999 on the
 * purple), which is a duplicated component rather than an instruction — a
 * read receipt on a message the peer sent us says nothing. Only `mine` gets
 * one here, and that is a deliberate departure from the file.
 */
function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const removed = message.status === "removed";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          // The source's bubbles hug their content and never wrap, so the cap
          // is ours. 480 is where its longest line lands; the percentage keeps
          // a narrow phone pane from running edge to edge.
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
          {/*
            The source gives the two bubbles DIFFERENT timestamp greys —
            #8A8A8A on the white, #999999 on the purple — and one value was
            being used for both. The lighter grey is not decoration: #8A8A8A
            on #7E3BEB is about 1.6:1 and unreadable, which is what the flat
            value produced on every incoming message.
          */}
          <span
            className={cn(
              "tnum text-[12px] font-medium leading-4 tracking-[-0.005em]",
              mine ? "text-[#8A8A8A]" : "text-[#999999]"
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
    // Pinned, not sticky, for the same reason as the header: it is the last
    // fixed row of the pane's flex column, so it sits still while the messages
    // scroll behind it. 3% white over the app's pure-black ground, flattened
    // to an opaque value. The hairline above is the source's 10%.
    <div className="flex min-h-20 shrink-0 flex-col justify-center gap-1 border-t border-white/10 bg-[#080808] px-6 py-4">
      <div className="flex items-center gap-4">
        {/*
          The source draws an attachment button and a voice-note button here.
          Both are HIDDEN: `POST /conversations/:id/messages` requires `text`
          and accepts nothing else — no upload, no media id, no audio — and
          `ConversationMessage` has no field to carry one back, so neither
          could send anything even if it opened a picker.

          They return when the message payload can hold something other than
          text; the icons and the button geometry are kept for that day.
        */}

        <label className="sr-only" htmlFor="message-composer">
          Write a message
        </label>
        {/* The source draws this pill at a fixed 40 tall with 16px padding all
            round, which does not fit inside 40. Read as a 16px horizontal
            inset on a 40px row with its content centred. It grows past 40 on a
            multi-line draft, which the source has no state for — losing
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
              smiley and the source's carries a plus. */}
          <span aria-hidden className="shrink-0">
            <Image src="/messages/emoji.svg" alt="" width={20} height={20} />
          </span>
        </div>

        <CircleButton
          label="Send message"
          accent
          size={16}
          onClick={submit}
          disabled={!body || send.isPending}
          icon={
            send.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              <Image src="/messages/send.svg" alt="" width={16} height={16} />
            )
          }
        />
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

  // Only the messages scroll. The header and the composer are fixed rows of
  // this column, so the reader's eye keeps both while the river moves between
  // them — which is what every messaging app does and what page-level
  // scrolling with sticky bands only approximates.
  const river = useRef<HTMLDivElement>(null);
  // Whether the reader is at the live edge and should be carried along by new
  // messages. A ref, not state: it changes on every scroll frame and nothing
  // renders from it.
  const following = useRef(true);

  const toBottom = () => {
    const node = river.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  // Opening a conversation lands on its newest message, never at the top of
  // its history.
  useEffect(() => {
    following.current = true;
    toBottom();
  }, [conversation.id]);

  // Follow arriving messages, but only from the live edge — someone scrolled
  // up reading yesterday must not be yanked down because a message landed.
  useEffect(() => {
    if (following.current) toBottom();
  }, [items.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader conversation={conversation} onBack={onBack} />

      {/* 40px from the header to the first separator is the source's (header
          80, first label at y=120). The gap below is ours — its two day
          sections are absolutely placed, so it has no measurable bottom, and
          24 is every other gap in this pane.

          `min-h-0` because a flex child's default minimum is its CONTENT, so
          without it this grows to fit the whole thread and the pane scrolls as
          a page again instead of scrolling here. */}
      <div
        ref={river}
        onScroll={(event) => {
          following.current = isAtBottom(event.currentTarget);
        }}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-10"
      >
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
                  // source draws no avatars in the river, only in the header.
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

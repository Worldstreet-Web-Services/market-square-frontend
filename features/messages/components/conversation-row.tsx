"use client";

import { cn } from "@/lib/cn";
import { inboxTime } from "@/lib/inbox-time";
import { Avatar } from "@/components/ui/avatar";
import { IconPeople } from "@/components/ui/icons";
import { isGroupThread, threadTitle } from "@/features/messages/lib/thread-identity";
import Image from "next/image";
import type { Conversation } from "@/features/messages/lib/types";
import { asset } from "@/lib/square-path";

/**
 * One conversation in the inbox — a 62px card, not a list row.
 *
 * The design gives every row its own bordered surface with 16px of air between
 * them, which is what separates this from the feed's hairline-divided rows.
 * Numbers are the file's: 62 tall, radius 12, 3% fill, 10% border, 12px inset,
 * 38px avatar, 8px from avatar to text.
 */
export function ConversationRow({
  conversation,
  meId,
  selected,
  onOpen,
}: {
  conversation: Conversation;
  meId?: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const peer = conversation.peer;
  const last = conversation.lastMessage;
  /*
    HOW THE ROW NAMES ITSELF.

    A group has NO peer — that is deliberate on the service, because a room of
    twenty has no single other person — so a row that only ever read
    `peer.displayName` rendered every group as "Unknown". It is the group's
    `title`, its picture, and the people glyph beside it.
  */
  const group = isGroupThread(conversation);
  // ONE naming rule for the row and the thread pane. `threadTitle` already
  // handled groups — the row simply never asked it, which is the whole bug:
  // it read `peer.displayName`, a group has no peer by design, and every group
  // rendered as "Unknown".
  const name = threadTitle(conversation);
  const seed = group ? conversation.id : peer?.id;
  const avatarUrl = group ? conversation.imageUrl : peer?.avatarUrl;

  const at = last?.createdAt ?? conversation.lastMessageAt;
  const stamp = inboxTime(at);
  const unread = conversation.unreadCount;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "ws-press flex h-[62px] w-full items-center gap-2 rounded-xl border px-3 text-left transition-colors",
        // Selected is ours. The design shows an unopened inbox, but a two-pane
        // layout must say which row the pane belongs to, or the thread on the
        // right looks unattached to anything.
        selected
          ? "border-white/20 bg-white/8"
          : "border-white/10 bg-white/3 hover:bg-white/6"
      )}
    >
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[25%] border border-white/20 bg-white/10">
        <Avatar name={name} seed={seed} src={avatarUrl} size={38} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          {/* QA: the name should be bigger. 12px was the file's, and read as body
              text beside a 38px picture; 15px makes it the row's heading. */}
          <span className="truncate text-[15px] font-bold leading-5 text-white">{name}</span>
          {/*
            THE PEOPLE GLYPH, in `--color-spotlight`, 12px — node 31:6589.
            It is what tells a group apart from a person at a glance, and it is
            the one mark on this row that is purple rather than white.
          */}
          {group && <IconPeople className="h-3 w-3 shrink-0 text-spotlight" />}
        </span>

        <span className="flex items-center gap-2 truncate text-[11px] font-normal leading-[16.5px] text-white/50">
          <Preview conversation={conversation} meId={meId} />
        </span>
      </span>

      {/* VERTICALLY CENTRED, not top-aligned. The file positions this cluster
          at y=24 in a 62px row — its own height is 15, so 24+7.5 lands on 31,
          which is the row's exact middle. It was `self-start pt-3`, i.e. 12
          from the top, sitting a clear 12px high against the two lines of text
          beside it. */}
      <span className="flex shrink-0 items-center gap-2">
        {/* The file's stamp: a clock inside today, an age past it — see
            lib/inbox-time.ts for why an inbox reads differently from a post. */}
        {stamp && (
          <span className="tnum text-[10px] font-normal leading-[15px] text-white/50">
            {stamp}
          </span>
        )}
        {unread > 0 && (
          <span className="tnum flex min-w-4 items-center justify-center rounded-[30px] bg-[#3F1881] px-1 py-1 text-[10px] leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * The preview line.
 *
 * "You: " when the viewer sent it — the standard inbox affordance — and an
 * attachment reads as an attachment rather than as an empty message, which is
 * the row the design draws with a paperclip and "Shared attachment".
 */
function Preview({ conversation, meId }: { conversation: Conversation; meId?: string }) {
  const last = conversation.lastMessage;
  if (!last) return <span>No messages yet</span>;
  if (last.status === "removed") return <span className="italic">Message removed</span>;

  const mine = Boolean(meId && last.senderId === meId);
  const body = last.text?.trim();

  if (!body) {
    return (
      <>
        {/* The file's own 16px document glyph, exported rather than
            approximated — the house set has no attachment icon. */}
        <Image src={asset("/messages/attachment.svg")} alt="" width={16} height={16} className="shrink-0" />
        <span className="truncate">
          {mine ? "You: " : ""}
          Shared attachment
        </span>
      </>
    );
  }

  /*
    THE SENDER PREFIX — node 31:6604, the file's `Patrick_dev:`.

    On a GROUP the preview is unreadable without it: "Buy the dip and hodl"
    from a room of twenty says nothing about who said it. On a 1:1 there are
    only two possibilities and the row already names the peer, so the prefix
    is only ever "You:" there.
  */
  const sender =
    mine ? "You" : conversation.kind === "group" ? conversation.lastSender?.displayName : null;

  return (
    <span className="truncate">
      {sender && <span className="text-white/70">{sender}: </span>}
      {body}
    </span>
  );
}

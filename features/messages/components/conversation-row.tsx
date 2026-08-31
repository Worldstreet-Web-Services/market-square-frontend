"use client";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import Image from "next/image";
import type { Conversation } from "@/features/messages/lib/types";

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
  const at = last?.createdAt ?? conversation.lastMessageAt;
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
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
        <Avatar
          name={peer?.displayName ?? "?"}
          seed={peer?.id}
          src={peer?.avatarUrl}
          size={38}
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[12px] font-bold leading-4 text-white">
            {peer?.displayName ?? "Unknown"}
          </span>
          {/* The file draws a small capsule here on four rows of five. It is a
              38×5 squiggle with no semantics, and the one row without it is the
              one whose peer is unverified — so it is read as the verified mark
              and drawn with the house badge. The exported asset is kept at
              public/messages/row-badge.svg if the literal shape is wanted. */}
          {peer?.verification && (
            <VerifiedBadge verification={peer.verification} className="h-3 w-3 shrink-0" />
          )}
        </span>

        <span className="flex items-center gap-2 truncate text-[11px] font-normal leading-[16.5px] text-white/50">
          <Preview conversation={conversation} meId={meId} />
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 self-start pt-3">
        {at && (
          <span className="tnum text-[10px] font-normal leading-[15px] text-white/50">
            {relativeTime(at)}
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
        <Image src="/messages/attachment.svg" alt="" width={16} height={16} className="shrink-0" />
        <span className="truncate">Shared attachment</span>
      </>
    );
  }

  return (
    <span className="truncate">
      {mine && <span className="text-white/70">You: </span>}
      {body}
    </span>
  );
}

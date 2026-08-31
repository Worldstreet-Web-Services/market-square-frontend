"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { IconArrowLeft } from "@/components/ui/icons";
import type { Conversation, Message } from "@/features/messages/lib/types";
import { clockTime } from "@/features/messages/lib/day-groups";

/**
 * A round 38.37px control with a white hairline — the design's own button
 * shape, used for every action in the thread's header and composer.
 *
 * The send button is the same shape filled with the brand purple, which is why
 * the fill is a parameter rather than a second component.
 */
export function RoundAction({
  label,
  icon,
  size,
  filled,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  /** Intrinsic size of the glyph inside the circle: 16 or 24 in the file. */
  size: 16 | 20 | 24;
  filled?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "ws-press flex h-[38.37px] w-[38.37px] shrink-0 items-center justify-center rounded-full border border-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
        filled ? "bg-[#7E3BEB]" : "bg-transparent hover:bg-white/10"
      )}
    >
      <Image src={icon} alt="" width={size} height={size} />
    </button>
  );
}

/**
 * The thread's header: who you are talking to, and what you can do about it.
 *
 * 80px tall on a 24px gutter, with a 10% hairline beneath. The back arrow is
 * ours and appears only below `lg` — the design is a desktop frame where the
 * inbox is always beside the thread, and on a phone the thread replaces it, so
 * something has to lead back.
 */
export function ThreadHeader({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const peer = conversation.peer;

  return (
    <header className="sticky top-0 z-10 flex h-20 items-center gap-4 border-b border-white/10 bg-ground/80 px-6 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to inbox"
        className="ws-press -ml-2 rounded-full p-2 text-heading transition-colors hover:bg-white/10 lg:hidden"
      >
        <IconArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
            <Avatar
              name={peer?.displayName ?? "?"}
              seed={peer?.id}
              src={peer?.avatarUrl}
              size={38}
            />
          </span>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-[12px] font-bold leading-4 text-white">
                {peer?.displayName ?? "Conversation"}
              </span>
              {peer?.verification && (
                <VerifiedBadge verification={peer.verification} className="h-3 w-3 shrink-0" />
              )}
            </div>
            {/*
              The design prints "Typing..." here. There is no typing signal in
              the messages contract — no presence channel, no websocket — so a
              permanent "Typing..." would be a lie told on every thread. The
              handle takes the line instead: same position, same treatment,
              something true. Swap it back the day presence ships.
            */}
            <span className="truncate text-[12.12px] leading-[16.15px] text-white/50">
              {peer ? `@${peer.username}` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {/*
          Both header actions are drawn and both are inert: there is no call
          route in the served contract, and no thread-level menu behind the
          second glyph. Disabled rather than omitted — the design's shape is
          preserved and the control tells the truth about itself.
        */}
        <RoundAction label="Video call — not available yet" icon="/messages/camera-video.svg" size={16} disabled />
        <RoundAction label="More — not available yet" icon="/messages/thread-more.svg" size={24} disabled />
      </div>
    </header>
  );
}

/**
 * One message.
 *
 * The file's colours are the opposite way round from the usual: YOUR messages
 * are the white bubble on the right (they carry the read-receipt checks, which
 * only ever appear on your own), and THEIRS are the purple bubble on the left.
 * Followed as drawn.
 */
export function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const removed = message.status === "removed";

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[min(560px,78%)] items-end gap-2.5 rounded-2xl p-3",
          mine ? "bg-white" : "bg-[#7E3BEB]"
        )}
      >
        <p
          className={cn(
            "min-w-0 whitespace-pre-wrap break-words text-[14px] leading-5 tracking-[-0.006em]",
            removed && "italic",
            mine ? "text-[#5A5A5A]" : "text-white"
          )}
        >
          {removed ? "Message removed" : message.text}
        </p>

        <span className="flex shrink-0 items-center gap-1 self-end">
          <span className="tnum text-[12px] font-medium leading-4 tracking-[-0.005em] text-[#8A8A8A]">
            {clockTime(message.createdAt)}
          </span>
          {/*
            Receipts belong on your own messages only. The file draws a single
            state; the service exposes no per-message delivery or read flag, so
            this says "sent" and nothing more — a second tick that always shows
            would claim a read nobody recorded.
          */}
          {mine && !removed && (
            <Image src="/messages/checks.svg" alt="Sent" width={12} height={12} />
          )}
        </span>
      </div>
    </div>
  );
}

/** The date heading above each run of messages. */
export function DayHeading({ label }: { label: string }) {
  return (
    <p className="text-center text-[16px] font-medium leading-6 text-white/60">{label}</p>
  );
}

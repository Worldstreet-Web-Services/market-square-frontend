"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A small emoji picker, built here rather than pulled in.
 *
 * Every off-the-shelf picker ships the full Unicode set with its own search
 * index and image sprites, which is hundreds of kilobytes on a surface where
 * people want a heart and a fire. This is the set people actually reach for in
 * a social feed, grouped the way they think about them, and it costs nothing.
 *
 * Native glyphs, never images: they inherit the reader's own font and render
 * at the platform they are being read on, so an iPhone reader sees Apple's 🔥
 * rather than ours.
 */
const GROUPS: Array<{ label: string; emoji: string[] }> = [
  {
    label: "Reactions",
    emoji: ["😂", "❤️", "🔥", "👏", "🙌", "💯", "😍", "🤯", "😮", "🥹", "😅", "🙏"],
  },
  {
    label: "Approval",
    emoji: ["👍", "👎", "✅", "❌", "⭐", "🏆", "🎯", "💪", "🤝", "👀", "🫡", "✨"],
  },
  {
    label: "Money",
    emoji: ["💰", "💸", "📈", "📉", "🪙", "💎", "🚀", "🐂", "🐻", "🧾", "🏦", "⚖️"],
  },
  {
    label: "Play",
    emoji: ["🎮", "♟️", "🎲", "🃏", "⚽", "🏀", "🥇", "🎪", "🎬", "🎧", "🎤", "📺"],
  },
];

export function EmojiPicker({
  onPick,
  label = "Add an emoji",
  align = "left",
  className,
}: {
  onPick: (emoji: string) => void;
  label?: string;
  /**
   * Which edge of the panel is pinned to the trigger. A picker whose button
   * sits at the start of a toolbar has to open rightward; one that sits at
   * the end of a reply row has to open leftward. Getting this wrong is what
   * sends the panel out over the sidebar.
   */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close on an outside tap or Escape. Without both, a picker opened on a
  // phone has no way to dismiss it that does not also pick something.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        className="ws-press flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none text-grey-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden>☺</span>
      </button>

      {open && (
        // Opens UPWARD, because these fields sit at the bottom of a card or a
        // chat and a downward menu would open off the end of the surface. The
        // horizontal edge is the caller's call — see `align`.
        //
        // ws-popover, not ws-glass: glass is for chrome that WANTS the page to
        // read through it. A picker does not — a translucent grid of emoji
        // laid over the feed and the sidebar reads as a broken layer, not a
        // menu. The width is clamped to the viewport so the panel can never
        // run off a narrow screen the way a fixed 248px does.
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "ws-popover ws-popover-enter absolute bottom-full z-50 mb-2 w-[264px] max-w-[calc(100vw-24px)] rounded-2xl p-2",
            // Four groups is taller than a short viewport with a keyboard up.
            "max-h-[min(360px,58vh)] overflow-y-auto overscroll-contain",
            align === "right" ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"
          )}
        >
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-grey-500">
                {group.label}
              </p>
              <div className="grid grid-cols-6 gap-0.5">
                {group.emoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    // Stays open: reactions come in runs ("🔥🔥🔥"), and
                    // reopening the picker for each one is the whole cost.
                    onClick={() => onPick(emoji)}
                    aria-label={emoji}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[19px] leading-none transition-[background-color,transform] duration-100 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none active:scale-90"
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

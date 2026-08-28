"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anchorAbove, type AnchorPosition } from "@/lib/anchored-popover";
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

/** One number for the panel's width, shared by the render and the maths. */
const PANEL_W = 264;

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
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<AnchorPosition | null>(null);

  /**
   * The panel is PORTALLED to the body and positioned in viewport
   * coordinates. Positioned inside the trigger's wrapper it was at the mercy
   * of every ancestor: the compose sheet scrolls its body and hides its
   * overflow, so the grid came out sliced at the toolbar and spilling past the
   * sheet's edge. A portal has no clipping ancestor to be sliced by.
   */
  const place = useCallback(() => {
    const node = trigger.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setAt(
      anchorAbove({
        trigger: { left: rect.left, right: rect.right, top: rect.top },
        // Matches the panel's own width rule below, so the arithmetic and the
        // render agree about how wide the thing being placed is.
        width: Math.min(PANEL_W, window.innerWidth - 24),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align,
      })
    );
  }, [align]);

  // Before paint: a panel that positions in an effect is drawn once at the
  // wrong place first, which reads as a flicker at the corner of the screen.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // A fixed panel does not travel with its trigger, so anything that moves the
  // trigger has to move it too — or close it. Scroll and resize are the two.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  // Close on an outside tap or Escape. Without both, a picker opened on a
  // phone has no way to dismiss it that does not also pick something.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      // The panel is no longer inside `root` — it is portalled — so an
      // outside tap has to miss BOTH or the first click on an emoji would
      // close the picker it was aimed at.
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
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
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        className="ws-press flex h-7 w-7 items-center justify-center rounded-full text-[15px] leading-none text-grey-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden>☺</span>
      </button>

      {open &&
        at &&
        createPortal(
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
          ref={panel}
          style={{ left: at.left, bottom: at.bottom, width: PANEL_W }}
          className={cn(
            "ws-popover ws-popover-enter fixed z-[60] max-w-[calc(100vw-24px)] rounded-2xl p-2",
            // Four groups is taller than a short viewport with a keyboard up.
            "max-h-[min(360px,58vh)] overflow-y-auto overscroll-contain",
            align === "right" ? "origin-bottom-right" : "origin-bottom-left"
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
        </div>,
          document.body
        )}
    </div>
  );
}

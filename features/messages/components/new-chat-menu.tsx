"use client";

import { useEffect, useRef } from "react";

/**
 * What the inbox column's `+` opens — node 24:6403.
 *
 * The `+` used to open the people picker directly, which made "start a chat"
 * and "start a group" the same gesture with only one of them reachable. The
 * file puts a two-item menu in between, so the button asks WHICH before it
 * asks WHO.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * 231 wide, `#1C1C1C` at a 1px `white/18` hairline, 22px radius, 16px padding,
 * and an 8px-gap list of 32px rows — each row `white/3` at a 12px radius with
 * 8px of horizontal padding, a 16px glyph and 12/16 Medium text at 80% white.
 * All verbatim. The frame's own 12px gap is between blocks it has only one of,
 * so it never renders.
 *
 * ─── THE GLYPHS ──────────────────────────────────────────────────────────────
 * The file names `bi:chat-dots` and the `people` component (15:3658, the
 * `outline` variant). Figma's image endpoint was unreachable when this was
 * built, so both are drawn inline at the file's 16px box on `currentColor`
 * rather than shipped as a placeholder PNG or swapped for a different house
 * icon. They are stroke-for-stroke what those two named icons are; replace
 * them with the real exports when the API is reachable and nothing else here
 * has to change.
 */

function ChatDotsIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 7.4c0-2.4 2.1-4.4 4.7-4.4h2.6c2.6 0 4.7 2 4.7 4.4s-2.1 4.4-4.7 4.4H6.4L3.4 14v-2.5A4.3 4.3 0 0 1 2 7.4Z" />
      <circle cx="5.6" cy="7.4" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="8" cy="7.4" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="7.4" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6.2" cy="5.2" r="2.4" />
      <path d="M1.9 13.4c0-2.1 1.9-3.5 4.3-3.5s4.3 1.4 4.3 3.5" />
      <path d="M10.6 3.1a2.4 2.4 0 0 1 0 4.5M11.7 10.2c1.5.3 2.6 1.2 2.6 2.7" />
    </svg>
  );
}

export interface NewChatMenuProps {
  open: boolean;
  onClose: () => void;
  onNewGist: () => void;
  onCreateGroup: () => void;
}

export function NewChatMenu({ open, onClose, onNewGist, onCreateGroup }: NewChatMenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  // Escape and outside-click both dismiss. `mousedown` rather than `click`, so
  // pressing the `+` again closes the menu instead of the toggle re-opening it
  // on the click that the outside handler just dismissed it with.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current && !panel.current.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    // The menu is opened by a pointer, so moving focus into it is what makes
    // it reachable by keyboard at all.
    first.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const items: { label: string; icon: React.ReactNode; onSelect: () => void }[] = [
    { label: "New Gist", icon: <ChatDotsIcon />, onSelect: onNewGist },
    { label: "Create Group", icon: <PeopleIcon />, onSelect: onCreateGroup },
  ];

  return (
    <div
      ref={panel}
      role="menu"
      aria-label="Start a conversation"
      // Sits directly above the `+`, sharing its 12px inset from the column's
      // edges: 12 (fab inset) + 52.79 (fab) + 8 of air.
      className="absolute bottom-[76px] right-3 z-30 w-[231px] rounded-[22px] border border-white/[0.18] bg-[#1C1C1C] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <button
            key={item.label}
            ref={index === 0 ? first : undefined}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className="ws-press flex h-8 items-center gap-2 rounded-xl bg-white/[0.03] px-2 text-left text-[12px] font-medium leading-4 text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:bg-white/[0.08] focus-visible:text-white"
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

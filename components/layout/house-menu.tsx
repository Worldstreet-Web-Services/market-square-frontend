"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * THE HOUSE'S OVERFLOW — nodes 1285:37444 ("group - not joined") and
 * 1285:37417 ("group - joined").
 *
 * TWO NODES, ONE MENU, and the difference is a single row: a member can leave.
 * 231 wide at a 22 radius on `#1C1C1C`, 16 of padding, the rows 40 tall at a
 * 12 radius and 8 apart, each a 16 glyph beside a Geist 600 16/24 label. The
 * file draws a "13" at the right of every row — it sits at x=294 inside a
 * 231-wide frame, so it is clipped out of the render and is leftover rather
 * than a badge. It is not drawn here.
 *
 * ─── REPORT IS DRAWN AND REFUSED, ON PURPOSE ─────────────────────────────────
 * `reportTarget` takes `post | comment | profile | stream_message`. There is
 * no house among them, so a Report row that posted anything would either
 * invent a target type the service rejects or silently report nothing. It is
 * rendered disabled with the reason instead — the same rule every other
 * not-yet-possible control on this app follows — and the target type is asked
 * for. The row exists because the design says a house can be reported, and
 * hiding it would lose that.
 */

export interface HouseMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  onSelect?: () => void;
  /** Present when the item cannot act yet — the row is dead and says why. */
  disabledReason?: string;
  destructive?: boolean;
}

export function HouseMenu({
  items,
  onClose,
}: {
  items: HouseMenuItem[];
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  // A menu that a tap outside does not close is a menu that traps the page.
  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return (
    <div
      ref={box}
      role="menu"
      className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[231px] flex-col gap-3 rounded-[22px] bg-[#1C1C1C] p-4 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.9)]"
    >
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={Boolean(item.disabledReason)}
            title={item.disabledReason}
            onClick={() => {
              if (item.disabledReason) return;
              onClose();
              item.onSelect?.();
            }}
            className={cn(
              "flex h-10 items-center gap-2 rounded-[12px] bg-white/[0.06] px-2 text-left text-[16px] font-semibold leading-6 transition-colors",
              item.disabledReason
                ? "cursor-not-allowed text-white/40"
                : "ws-press text-white hover:bg-white/[0.12]",
              item.destructive && !item.disabledReason && "text-[#FF6B6B]"
            )}
          >
            <span className="grid size-4 shrink-0 place-items-center text-[#9B9B9B]">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** `basil:share-outline` — the file's own three-node share mark. */
export const IconMenuShare = (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <circle cx="12.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12.5" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.3 7 10.7 4.4M5.3 9l5.4 2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/** `vuesax/outline/people`. */
export const IconMenuPeople = (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <circle cx="5.6" cy="5" r="2.1" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="11" cy="5.6" r="1.7" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.9 12.4c0-1.8 1.7-2.8 3.7-2.8s3.7 1 3.7 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M11.2 9.9c1.7.1 2.9 1 2.9 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/** `vuesax/outline/flag`. */
export const IconMenuFlag = (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <path d="M3.4 1.6v12.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M3.4 2.6h8.2l-1.8 3 1.8 3H3.4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

/** The leave mark — a door with an arrow out, for the member-only row. */
export const IconMenuLeave = (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <path d="M6.2 2.4H3.6a1.2 1.2 0 0 0-1.2 1.2v8.8a1.2 1.2 0 0 0 1.2 1.2h2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M10.4 11 13.6 8l-3.2-3M13.6 8H6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The banner's 38 x 38 trigger — the file's 2 x 15 vertical ellipsis. */
export const IconMenuDots = (
  <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none">
    <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
  </svg>
);

"use client";

import { cn } from "@/lib/cn";

/**
 * ONE ROW IN A THREAD'S OVERFLOW MENU — nodes 77:8289, 78:8339, 78:8527.
 *
 * THE FILE'S NUMBERS: 32 tall, stretched to the panel's width, `white/3` fill
 * at a 12px radius, 8px of horizontal padding, an 8px gap between a 16px glyph
 * and the label, and the label at Geist Medium 12/16 in 80% white. A
 * destructive row keeps every one of those and changes only the ink.
 *
 * It lives in `components/ui` rather than beside the menu because the DM menu's
 * Block and Report rows are the profile slice's actions, composed in through a
 * slot — and a slot that cannot draw the same row as its neighbours is how one
 * menu ends up with two row styles.
 *
 * `hint` is not in the file. It exists for the rows the SERVICE cannot back
 * yet: the house rule is that such a control is visible and genuinely
 * `disabled`, with the reason on it, rather than hidden (which loses the
 * roadmap) or live (which lies). It renders as the button's `title`, so it
 * costs no height and never changes the row's geometry.
 *
 * THERE IS ONE SIZE. The friends filter (651:18441) and the account menu
 * (747:14001) draw this row at 74.46% — 23.83 tall with an 8.935px label — and
 * both used to, through a `compact` size. At that scale the label is below any
 * platform's legibility floor, and ogazboiz asked for both menus to be bigger
 * (2026-09-14). Undoing the scale lands exactly on the numbers above, and the
 * filter's panel on `MenuPanel`'s 231 / 16 / 8, so the menus now use the
 * design system's own row rather than a shrunken copy of it.
 *
 * `trailing` is the chevron the file puts on a row's right edge.
 */
export function MenuRow({
  icon,
  label,
  tone = "default",
  trailing,
  disabled,
  hint,
  onClick,
}: {
  /** Optional: a row with no glyph keeps the box so its label still aligns. */
  icon?: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
  /** Drawn against the row's right edge, after the label. */
  trailing?: React.ReactNode;
  disabled?: boolean;
  /** Why this row cannot act. Shown as the title; also marks it disabled. */
  hint?: string;
  onClick?: () => void;
}) {
  const off = disabled || Boolean(hint) || !onClick;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={off}
      title={hint}
      onClick={onClick}
      className={cn(
        "ws-press flex w-full items-center bg-white/[0.03] text-left font-medium transition-colors",
        "h-8 gap-2 rounded-xl px-2 text-[12px] leading-4",
        // The file gives a destructive row `#FF3B30`; `--color-danger` is
        // `#ff383c`, which is the same red to within two values per channel and
        // is already what every other destructive control in the app uses.
        tone === "danger" ? "text-danger" : "text-white/80",
        off ? "cursor-not-allowed opacity-40" : "hover:bg-white/[0.08]"
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </button>
  );
}

/**
 * The panel the rows sit in — 231 wide, `#1C1C1C` (which is `--color-grey-800`
 * exactly), a 1px `white/18` ring, 22px radius, 16px of padding and an 8px gap
 * down the list.
 */
export function MenuPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="menu"
      className="flex w-[231px] flex-col gap-2 rounded-[22px] border border-white/[0.18] bg-grey-800 p-4 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)]"
    >
      {children}
    </div>
  );
}

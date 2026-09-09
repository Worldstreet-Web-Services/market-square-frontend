"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import type { InboxTab } from "@/features/messages/lib/filter";

/**
 * The inbox's search field and its All/Unread filter.
 *
 * Both are built to the design's own numbers rather than to the nearest house
 * utility, because this column is a fixed 347px and the chrome above the list
 * is what makes it read as an inbox instead of a feed. Where the design and
 * the codebase disagree the divergences are named in place, so the next person
 * can tell a decision from a drift.
 */

/** 347 × 38 pill. The hairline is 0.68px in the file — kept, not rounded up to
    1px, because at this radius a full pixel reads as a heavier chip than the
    design intends. */
export function InboxSearch({
  value,
  onChange,
  // The New Gist / Create Group panel draws the SAME 315x38 pill (node
  // 36:7089 is 36:7004's copy of this one), so it reuses this component rather
  // than restating the geometry. Two of them can be in the DOM at once — the
  // panel opens over the inbox — and a duplicated `id` breaks the label
  // association for both, so the id and its label are the caller's.
  id = "inbox-search",
  label = "Search conversations",
  placeholder = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="ws-field flex h-[38px] items-center gap-2 rounded-full border-[0.68px] border-white/40 bg-transparent px-2 shadow-[0px_5.45px_6.81px_-4.09px_rgba(0,0,0,0.1),0px_13.62px_17.02px_-3.4px_rgba(0,0,0,0.1)]">
      <Image
        src="/messages/search.svg"
        alt=""
        width={16}
        height={16}
        className="shrink-0 opacity-90"
      />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        // 16px Medium, #7A7A7A — the design's caret is #0088FF, which is the
        // browser default accent here rather than a token worth inventing.
        className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[22px] tracking-[-0.007em] text-[#7A7A7A] caret-[#0088FF] outline-none placeholder:text-[#7A7A7A]"
      />
    </div>
  );
}

export type InboxFilter = "all" | "unread";

/**
 * The inbox's tab row: `All · Gists · Houses · Gist Requests`.
 *
 * ─── THE FILE ────────────────────────────────────────────────────────────────
 * FOUR tabs, spread by `justify-between` across the 416px content width, each
 * an 80x38 hit area (120 for the last), the active one carrying white text and
 * a 1px white rule beneath its own box while the rest sit at 40% white with no
 * rule. Reproduced verbatim, including the widths — the row is a fixed spread,
 * not a gap, so it holds its rhythm at any column width.
 *
 * ─── ALL FOUR ARE LIVE ───────────────────────────────────────────────────────
 * Three of them used to be drawn and inert, and it was a data problem rather
 * than a styling one: a conversation had no KIND to partition on, there was no
 * group conversation at all, and no notion of a chat you had not agreed to. So
 * `Gists`, `Houses` and `Gist Requests` could only have shown everything or
 * nothing — the failure that teaches a reader the square is empty when it was
 * never asked.
 *
 * The service answers all three now:
 *
 *   Gists          kind = 'direct'
 *   Houses         kind = 'group'
 *   Gist Requests  state = 'pending'
 *   All            every accepted conversation, either kind
 *
 * and each tab is its OWN query with its own cursor (`tabQuery` in
 * `lib/filter.ts`), so paging inside a tab pages that tab rather than slicing
 * one fetched page four ways.
 *
 * `Unread` is not in this node and is not drawn — a fifth chip would change the
 * spread of a row the file fixes at four, and the unread count is already on
 * every row that has one and on the nav glyph.
 */
interface InboxTabSpec {
  key: InboxTab;
  label: string;
  /** The file's hit width. `Gist Requests` is the wide one. */
  width: number;
}

const TABS: InboxTabSpec[] = [
  { key: "all", label: "All", width: 80 },
  { key: "gists", label: "Gists", width: 80 },
  { key: "houses", label: "Houses", width: 80 },
  { key: "requests", label: "Gist Requests", width: 120 },
];

export function InboxFilters({
  value,
  onChange,
  /** Unanswered requests, drawn on the last tab the way the nav badge is. */
  pendingCount = 0,
}: {
  value: InboxTab;
  onChange: (value: InboxTab) => void;
  pendingCount?: number;
}) {
  return (
    // `justify-between` across the full content width, as the file lays it out.
    <div
      className="flex items-center justify-between"
      role="tablist"
      aria-label="Filter conversations"
    >
      {TABS.map((tab) => {
        const selected = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            style={{ width: tab.width }}
            className={cn(
              // 38 tall, centred, the file's Roboto Bold 12/16 rendered in
              // Geist — the house face, per the type rule.
              "ws-press flex h-[38px] shrink-0 items-center justify-center gap-1.5 p-2.5 text-[12px] font-bold leading-4 transition-colors",
              selected
                ? // The active tab is an underline, not a pill: 1px of solid
                  // white beneath the hit area.
                  "border-b border-white text-white"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {tab.label}
            {tab.key === "requests" && pendingCount > 0 && (
              // Solid purple takes the ramp's DARK stop with white ink — the
              // same badge the nav wears, per the contrast rule.
              <span className="tnum rounded-full bg-spotlight px-1.5 text-[10px] leading-4 text-white">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

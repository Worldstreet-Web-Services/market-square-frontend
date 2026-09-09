"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

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
}: {
  value: string;
  onChange: (value: string) => void;
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
      <label className="sr-only" htmlFor="inbox-search">
        Search conversations
      </label>
      <input
        id="inbox-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        // 16px Medium, #7A7A7A — the design's caret is #0088FF, which is the
        // browser default accent here rather than a token worth inventing.
        className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[22px] tracking-[-0.007em] text-[#7A7A7A] caret-[#0088FF] outline-none placeholder:text-[#7A7A7A]"
      />
    </div>
  );
}

export type InboxFilter = "all" | "unread";

/**
 * All / Unread. 101 × 38 each, 3px apart.
 *
 * The selected chip carries the design's silver gradient; the unselected one
 * is transparent with 40% white text. Rendered as real buttons with
 * `aria-pressed` rather than styled divs — the filter changes what the list
 * shows, so it has to be reachable and announceable.
 */
export function InboxFilters({
  value,
  onChange,
  unreadCount,
}: {
  value: InboxFilter;
  onChange: (value: InboxFilter) => void;
  unreadCount: number;
}) {
  const chip = (key: InboxFilter, label: string) => {
    const selected = value === key;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={selected}
        onClick={() => onChange(key)}
        className={cn(
          "ws-press flex h-[38px] w-[101px] items-center justify-center rounded-full p-2.5 text-[14px] font-semibold leading-5 transition-colors",
          selected
            ? "bg-[linear-gradient(201deg,#FFFFFF_13%,#999999_100%)] text-black"
            : "bg-transparent text-white/40 hover:text-white/70"
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-[3px]">
      {chip("all", "All")}
      {/* The count is ours, not the design's: a filter that can empty the list
          should say how much it will leave behind before it is tapped. */}
      {chip("unread", unreadCount > 0 ? `Unread ${unreadCount}` : "Unread")}
    </div>
  );
}

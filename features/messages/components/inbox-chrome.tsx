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
 * The inbox's tab row: `All · Gists · Houses · Gist Requests`.
 *
 * ─── THE FILE ────────────────────────────────────────────────────────────────
 * FOUR tabs, spread by `justify-between` across the 416px content width, each
 * an 80x38 hit area (120 for the last), the active one carrying white text and
 * a 1px white rule beneath its own box while the rest sit at 40% white with no
 * rule. Reproduced verbatim, including the widths — the row is a fixed spread,
 * not a gap, so it holds its rhythm at any column width.
 *
 * ─── WHAT THE SERVICE CAN ANSWER ─────────────────────────────────────────────
 * Three of the four cannot be honoured yet, and it is a data problem rather
 * than a styling one. `Conversation` is strictly 1:1 —
 * `{ id, peer, lastMessage, lastMessageAt, unreadCount }` over participant ids
 * — and `GET /me/conversations` accepts only `cursor` and `limit`. There is no
 * conversation KIND to partition on, and no group conversation at all:
 *
 *   Gists         needs a kind on the conversation
 *   Houses        needs the same, and gist rooms are audio rooms rather than
 *                 conversations today — which of the two this tab means is a
 *                 product answer, not something the payload implies
 *   Gist Requests needs a request-to-chat inbox that does not exist
 *
 * The file's own rows give it away: "Naija Tech Bros in Diaspora" with a people
 * glyph and a `Patrick_dev:` sender prefix is a GROUP thread, and the service
 * has no such object. Wiring the three against today's payload would mean
 * three tabs that quietly show everything or nothing — the failure that
 * teaches a reader the square is empty when it was never asked.
 *
 * So they are DRAWN and INERT: real `disabled` buttons, unclickable and
 * untabbable and announced as such, each naming itself in its tooltip. That is
 * the house rule for a capability that does not exist yet
 * (`MARKET_FLAGS`-style: visible and inert, never a control that looks
 * tappable). The moment `Conversation.kind` lands, `TABS` is the only edit.
 *
 * There is NO explanatory line under the row. An earlier pass put one there —
 * "Gists, Houses and Gist Requests need a conversation type the service
 * doesn't send yet" — which is a note to us wearing the reader's clothes, in
 * our vocabulary not theirs, and it cost 40px of the list's room and broke the
 * file's 24/24 rhythm between the tabs and the first row.
 *
 * `Unread` is not in this node and is not drawn. `visibleConversations` still
 * takes the filter and is still pinned by `lib/messages-filter.test.ts`,
 * because it is correct and because the first tab that CAN be backed will want
 * exactly that shape — but a fifth chip would change the spread of a row the
 * file fixes at four, and the unread count is already on every row that has
 * one and on the nav glyph.
 */
interface InboxTab {
  key: InboxFilter | "gists" | "houses" | "requests";
  label: string;
  /** The file's hit width. `Gist Requests` is the wide one. */
  width: number;
  /** False until the service can partition conversations — see above. */
  available: boolean;
}

const TABS: InboxTab[] = [
  { key: "all", label: "All", width: 80, available: true },
  { key: "gists", label: "Gists", width: 80, available: false },
  { key: "houses", label: "Houses", width: 80, available: false },
  { key: "requests", label: "Gist Requests", width: 120, available: false },
];

export function InboxFilters({
  value,
  onChange,
}: {
  value: InboxFilter;
  onChange: (value: InboxFilter) => void;
}) {
  return (
    // `justify-between` across the full content width, as the file lays it out.
    <div className="flex items-center justify-between" role="group" aria-label="Filter conversations">
      {TABS.map((tab) => {
        const selected = tab.available && value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            disabled={!tab.available}
            aria-pressed={tab.available ? selected : undefined}
            title={tab.available ? undefined : `${tab.label} isn't available yet`}
            onClick={() => tab.available && onChange(tab.key as InboxFilter)}
            style={{ width: tab.width }}
            className={cn(
              // 38 tall, centred, the file's Roboto Bold 12/16 rendered in
              // Geist — the house face, per the type rule.
              "ws-press flex h-[38px] shrink-0 items-center justify-center p-2.5 text-[12px] font-bold leading-4 transition-colors",
              selected
                ? // The active tab is an underline, not a pill: 1px of solid
                  // white beneath the hit area.
                  "border-b border-white text-white"
                : "text-white/40",
              tab.available ? "hover:text-white/70" : "cursor-not-allowed",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

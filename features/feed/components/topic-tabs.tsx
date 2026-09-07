"use client";

import { cn } from "@/lib/cn";

/**
 * HOME'S TAB ROW — node 225:3352.
 *
 * `For you · Tech · Entertainment · Crypto & Web3 · Science · Real Estate ·
 * Music · Relationships · Gaming`.
 *
 * ─── WHAT THIS REPLACES, AND WHY IT MATTERS ──────────────────────────────────
 * These are TOPICS, not lanes. Home used to head the timeline with
 * `For You · Following · Trending` — three ways of ranking the same posts,
 * which tells a reader nothing about what the square is talking about. The file
 * heads it with the subjects instead, which is the whole proposition of the
 * product: you come here to find the conversation you care about.
 *
 * `For you` is the unfiltered lane. Every other pill is a key from the SHARED
 * VOCABULARY served by `GET /topics` — the same keys that tag a post, express a
 * reader's interests and filter a gist room. Nothing here is hard-coded: the
 * row renders what the service serves, in the backend's own `sortOrder`, so a
 * topic added upstream appears with no client change. The names in the file are
 * that vocabulary's own labels.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * Each pill is 101x38 at a full round, 10px of padding, the label at Bold 12/16.
 * The SELECTED pill carries `linear-gradient(201deg, #7E3BEB 13%, #472185 100%)`
 * with `#F4F4F4` ink; the rest are transparent with 40% white. Under the row,
 * a 2px `white/08` rule runs the full width.
 *
 * Both stops are the FILE'S, not a token substitution. The light one happens to
 * be `--color-spotlight`; the dark one, `#472185`, has no token and is written
 * literally rather than rounded to the nearest purple the palette already owns.
 * A gradient's far stop is not a surface colour and does not need naming — what
 * it needs is to be right.
 *
 * The row sits on the page's own ground (`--color-chrome`, `#121214` at full
 * opacity) with 5px between it and the rule, so it is invisible as a band.
 *
 * A pill is 101 wide only when its label fits — "Crypto & Web3" and
 * "Relationships" do not, and the file lets those grow. So the width is a
 * MINIMUM here rather than a fixed size, which is what the file draws once you
 * look at the wide pills.
 *
 * The row SCROLLS: it is 908 wide inside an 805 column in the file, so it is
 * over-wide by design and the last topics are reached by dragging. The
 * scrollbar is hidden, as it is on every other rail in the app.
 */
export interface TopicTab {
  /** The vocabulary key, or null for "For you" — the unfiltered lane. */
  key: string | null;
  label: string;
}

export function TopicTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly TopicTab[];
  /** The selected key; null is "For you". */
  active: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-[5px] bg-chrome">
      <div
        aria-label="Topics"
        className="flex items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key ?? "for-you"}
              type="button"
              onClick={() => onSelect(tab.key)}
              aria-current={on ? "true" : undefined}
              className={cn(
                "ws-press flex h-[38px] min-w-[101px] shrink-0 items-center justify-center rounded-full px-2.5 text-[12px] font-bold leading-4 transition-colors",
                on
                  ? "bg-[linear-gradient(201deg,#7E3BEB_13%,#472185_100%)] text-grey-100"
                  : "text-white/40 hover:text-body"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* The file's own 2px rule, full width, at 8% white. */}
      <span aria-hidden className="h-0.5 w-full bg-white/[0.08]" />
    </div>
  );
}

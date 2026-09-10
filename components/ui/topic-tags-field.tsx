"use client";

import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/button";
import {
  IconCoin,
  IconImage,
  IconLive,
  IconPlay,
  IconSpark,
  IconStats,
  IconStore,
  IconVolume,
} from "@/components/ui/icons";
import { useTopics } from "@/features/discovery/hooks/use-discovery";

/**
 * The glyph beside a topic chip, keyed by the topic's own key.
 *
 * The LIST of topics is never hard-coded — it comes from `GET /topics`, and a
 * topic ships from the backend alone. Only the glyph is a local decision, and
 * an unknown key falls back to a neutral one rather than rendering nothing.
 *
 * FOUR KEYS HAVE NO REAL GLYPH YET. The design names specific icons for every
 * chip (`ic:baseline-business-center`, `boxicons:music-alt-filled`,
 * `famicons:fast-food-sharp`, `fa-solid:church`, …) and Figma's image endpoint
 * has been unreachable, so they could not be exported. `business` and `music`
 * take the closest house icons; `food` and `religion` deliberately take the
 * neutral fallback rather than a confident wrong picture — a shopping bag next
 * to "Religion" is worse than a generic mark. Replace all four with the real
 * exports when the API is reachable; nothing else here changes.
 */
export const TOPIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gaming: IconPlay,
  trading: IconStats,
  shows: IconLive,
  arts: IconSpark,
  pictures: IconImage,
  reels: IconPlay,
  crypto: IconCoin,
  business: IconStore,
  music: IconVolume,
};

/**
 * "Tags (Select up to 5 categories)" — node 59:7559.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * An 8px-gap column: the label, then a wrapping row at 12px row / 8px column
 * gap. Each chip is `white/10` at a pill radius with 10px/12px padding, a 4px
 * gap, a 16px glyph and 12/16 Bold text in `#F4F4F4`. All verbatim.
 *
 * ─── THE SELECTED STATE IS OURS ──────────────────────────────────────────────
 * The file draws every chip unselected, so it specifies no chosen treatment at
 * all — this is a judgement call, not a measurement. A selected chip takes the
 * create purple's light stop as a ring and tint: it is the same accent the
 * "Add +" button is painted in, so the row reads as one control, and
 * `--color-create` is 5.77:1 on this ground where the dark stop would fail.
 *
 * ─── WHY THE CHIPS ARE FETCHED ───────────────────────────────────────────────
 * `topics` is validated server-side against the topics table and an unknown
 * key is rejected BY NAME. A hard-coded row of the design's eleven labels
 * would therefore 400 on submit for any chip the vocabulary does not carry —
 * which was true of five of them until the vocabulary was seeded to match.
 * Fetching is what keeps that from silently regressing.
 */
export function TopicTagsField({
  selected,
  onChange,
  max = 5,
  className,
}: {
  selected: string[];
  onChange: (topics: string[]) => void;
  /** The file says five. */
  max?: number;
  className?: string;
}) {
  const topics = useTopics();
  const atLimit = selected.length >= max;

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((topic) => topic !== key));
      return;
    }
    if (atLimit) return;
    onChange([...selected, key]);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-[13px] font-semibold text-white">
        Tags <span className="text-[12px] font-normal text-white/50">(Select up to {max} categories)</span>
      </span>

      {topics.isPending && (
        <div className="flex items-center gap-2 py-2 text-[12px] text-meta">
          <Spinner className="h-4 w-4 text-meta" /> Loading categories…
        </div>
      )}

      {/* A missing /topics is "not deployed", not "broken" — the field simply
          offers nothing rather than inventing a vocabulary the service would
          reject. Same rule the interests picker follows. */}
      {topics.isError && (
        <p className="py-2 text-[12px] text-meta">Categories aren&apos;t available right now.</p>
      )}

      {topics.data && (
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {topics.data.map((topic) => {
            const Icon = TOPIC_ICONS[topic.key] ?? IconSpark;
            const chosen = selected.includes(topic.key);
            return (
              <button
                key={topic.key}
                type="button"
                role="checkbox"
                aria-checked={chosen}
                // Unpicked chips go quiet at the limit instead of vanishing:
                // the reader can still see what they did not choose, and the
                // control says why it will not respond.
                disabled={!chosen && atLimit}
                title={!chosen && atLimit ? `Choose up to ${max}` : undefined}
                onClick={() => toggle(topic.key)}
                className={cn(
                  "ws-press flex items-center justify-center gap-1 rounded-full px-3 py-2.5 text-[12px] font-bold leading-4 text-[#F4F4F4] transition-colors",
                  chosen
                    ? "bg-create/20 ring-1 ring-create"
                    : "bg-white/10 hover:bg-white/[0.16]",
                  !chosen && atLimit && "cursor-not-allowed opacity-40"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {topic.label}
              </button>
            );
          })}

          {/*
            "Add +" is DRAWN AND INERT.

            The file puts it at the end of the row, and the obvious reading is
            "add your own category". Topics are operator-managed — a reader has
            never been able to create one, and `topics` is validated against the
            table by name — so a working button here would need a capability
            that does not exist. Every topic the service has is already on this
            row, so there is also nothing for it to reveal.

            House rule for a capability that is not there: visible and inert,
            never a control that looks tappable and then fails.
          */}
          <button
            type="button"
            disabled
            title="Categories are managed by Square — these are all of them."
            className="ws-btn-create flex h-[38px] w-20 cursor-not-allowed items-center justify-center rounded-full text-[12px] font-bold leading-4 text-[#F4F4F4] opacity-40"
          >
            Add +
          </button>
        </div>
      )}
    </div>
  );
}

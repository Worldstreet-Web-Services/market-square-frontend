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
 * TWO KEYS HAVE NO REAL GLYPH YET. The design names specific icons for every
 * chip (`ic:baseline-business-center`, `boxicons:music-alt-filled`, …).
 * `religion` and `food` now carry the file's own exports (`fa-solid:church`
 * and `famicons:fast-food-sharp`, from the gist room card 496:13802, with
 * their white -> #666 gradient). `business` and `music` still take the closest
 * house icons until those chips' glyphs are exported; nothing else here
 * changes when they are.
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
  religion: IconTopicChurch,
  food: IconTopicFood,
};

/** `fa-solid:church` — node 415:12685 on the gist room card, exported from the file. */
function IconTopicChurch({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 7 6" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#topic_church_clip)">
<path d="M5.08032 2.69822L3.85022 1.96011V1.40008H4.37525C4.47194 1.40008 4.55026 1.32176 4.55026 1.22507V0.87505C4.55026 0.778357 4.47194 0.70004 4.37525 0.70004H3.85022V0.17501C3.85022 0.078317 3.7719 0 3.67521 0H3.32519C3.2285 0 3.15018 0.078317 3.15018 0.17501V0.70004H2.62515C2.52846 0.70004 2.45014 0.778357 2.45014 0.87505V1.22507C2.45014 1.32176 2.52846 1.40008 2.62515 1.40008H3.15018V1.96011L1.92008 2.69822C1.86824 2.72931 1.82534 2.7733 1.79555 2.8259C1.76576 2.87849 1.7501 2.93791 1.7501 2.99836V5.60032H2.80016V4.55026C2.80016 4.1636 3.11354 3.85022 3.5002 3.85022C3.88686 3.85022 4.20024 4.1636 4.20024 4.55026V5.60032H5.2503V2.99836C5.2503 2.87541 5.18576 2.76144 5.08032 2.69822ZM0 4.33106V5.42531C0 5.522 0.078317 5.60032 0.17501 5.60032H1.40008V3.5002L0.21209 4.00926C0.149142 4.03628 0.0954991 4.08117 0.0578019 4.13836C0.0201048 4.19556 8.2568e-06 4.26256 0 4.33106ZM6.78831 4.00926L5.60032 3.5002V5.60032H6.82539C6.92208 5.60032 7.0004 5.522 7.0004 5.42531V4.33106C7.0004 4.19105 6.91694 4.0645 6.78831 4.00926Z" fill="url(#topic_church_paint)"/>
</g>
<defs>
<linearGradient id="topic_church_paint" x1="3.5002" y1="0" x2="3.5002" y2="5.60032" gradientUnits="userSpaceOnUse">
<stop stopColor="white"/>
<stop offset="1" stopColor="#666666"/>
</linearGradient>
<clipPath id="topic_church_clip">
<rect width="6.31579" height="5.05263" fill="white" transform="scale(1.1084)"/>
</clipPath>
</defs>
    </svg>
  );
}

/** `famicons:fast-food-sharp` — node 415:12689 on the gist room card, exported from the file. */
function IconTopicFood({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 6 6" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#topic_food_clip)">
<path d="M1.20023 4.12717L1.68032 4.53653L2.16042 4.12717H4.50058V4.40781C4.50207 4.56534 4.45124 4.71893 4.35678 4.84499C4.25542 4.97659 4.10892 5.06124 3.94627 5.06417C3.91776 5.24122 3.8493 5.40167 3.74565 5.52687C3.59226 5.71228 3.36854 5.81446 3.11712 5.81446H1.57016C1.31895 5.81432 1.09608 5.71192 0.942791 5.52687C0.839109 5.40163 0.770662 5.2413 0.742172 5.06417C0.435968 5.05842 0.187862 4.76628 0.187862 4.40781V4.12717H1.20023ZM5.18013 0.527638L4.65713 0.707383L4.55276 1.12486H5.81214V1.50058H5.59412L5.16738 5.54426C5.14386 5.71963 5.06228 5.81321 4.87514 5.8133H3.9915C4.00601 5.79761 4.02059 5.78121 4.0344 5.76459C4.12855 5.64947 4.20198 5.51875 4.25126 5.37843C4.39599 5.32114 4.52458 5.22862 4.62466 5.10939C4.78631 4.91819 4.87512 4.66836 4.87514 4.40665C4.8751 4.26891 4.84914 4.13168 4.79977 4.00309C4.8839 3.81625 4.89812 3.60526 4.83804 3.40935C4.77789 3.21331 4.64737 3.04605 4.47275 2.93854C4.44877 2.80579 4.40695 2.67695 4.34751 2.55586C4.2511 2.36079 4.11163 2.19006 3.93931 2.05721C3.62929 1.81561 3.22269 1.68732 2.76575 1.68728H2.67878L2.65675 1.50058H2.43757V1.12486H4.1666L4.33591 0.422111L5.06185 0.187862L5.18013 0.527638ZM2.76575 2.06417C3.13899 2.06417 3.46572 2.16493 3.7097 2.35524C3.97307 2.55978 4.1152 2.85072 4.12486 3.1983C4.23062 3.22004 4.32559 3.27819 4.39389 3.36181C4.46212 3.44539 4.50036 3.54963 4.50058 3.65752V3.75145H2.13259L1.68032 4.08195L1.23038 3.75145H0.187862V3.65752C0.188078 3.54976 0.225321 3.44534 0.29339 3.36181C0.361619 3.27823 0.456769 3.22011 0.562428 3.1983C0.58093 2.51839 1.12333 2.06417 1.92269 2.06417H2.76575Z" fill="url(#topic_food_paint)"/>
</g>
<defs>
<linearGradient id="topic_food_paint" x1="5.20438" y1="0.273522" x2="2.93623" y2="7.31358" gradientUnits="userSpaceOnUse">
<stop stopColor="white"/>
<stop offset="1" stopColor="#666666"/>
</linearGradient>
<clipPath id="topic_food_clip">
<rect width="5.05263" height="5.05263" fill="white" transform="scale(1.18748)"/>
</clipPath>
</defs>
    </svg>
  );
}

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
  // The tag field's own list (`?surface=composer`), the eleven it has always offered.
  const topics = useTopics("composer");
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

"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { housePath } from "@/features/houses";
import { formatCount } from "@/lib/format";
import type { Stream } from "@/lib/api/schemas";

/**
 * A LIVE GIST ROOM — node 2078:19217, `option 1b`. 342 x 141.
 *
 * The same glass every other card in this file is made of: `#101012` at 62%
 * over a 10.73 background blur, ringed by a 0.766 INSIDE stroke at white/18,
 * at a 16.86 radius. The ring is an inset shadow rather than a border — the
 * stroke is INSIDE and sub-pixel, so a real border rounds differently against
 * that radius and eats half a pixel of the inset.
 *
 * ─── THREE ROWS AT 16, 40 AND 96, INSIDE A 16 GUTTER ─────────────────────────
 * The topic chip, then the title beside its Join pill, then the faces beside
 * the LIVE badge and the count. The height is FIXED at 141 and the bottom row
 * sits at 96, so the ~19 below it is the file's own breathing room rather than
 * a padding value — setting `pb-4` would move the row.
 *
 * WHY IT REPLACES THE OLD RAIL ROW: the rail drew a 64x44 gradient thumbnail
 * with the title beside it, which is a VIDEO shape — a thumbnail promises
 * something to look at, and a gist room is audio. This card leads with the
 * topic and the people instead, which is what there actually is.
 */
export function LiveRoomCard({
  stream,
  fluid = false,
}: {
  stream: Stream;
  /**
   * FILL THE CELL instead of holding 342. The rail on Home scrolls sideways,
   * so the card keeps the file's own width there; the gist-rooms page lays the
   * same card out in a one-or-two-across grid, where a fixed 342 leaves a gutter
   * beside every card on a wide screen and overflows a 320 phone. Only the
   * width moves — the height, the rows and every inner number stay the file's.
   */
  fluid?: boolean;
}) {
  const topics = useTopics();
  const topicKey = stream.topics?.[0];
  const topicLabel = topicKey
    ? (topics.data?.find((entry) => entry.key === topicKey)?.label ?? topicKey)
    : null;
  const TopicIcon = topicKey ? (TOPIC_ICONS[topicKey] ?? IconSpark) : null;
  const faces = stream.attendees.slice(0, 3);

  return (
    <Link
      href={housePath(stream.id)}
      aria-label={`Join ${stream.title}`}
      className={`ws-press flex h-[141px] flex-col rounded-[16.86px] bg-[rgba(16,16,18,0.62)] px-4 pt-4 shadow-[inset_0_0_0_0.766px_rgba(255,255,255,0.18)] backdrop-blur-[10.73px] ${
        fluid ? "w-full min-w-0" : "w-[342px] shrink-0"
      }`}
    >
      {/* `Frame 2147225009` — 16 tall, pill, white/10 under Figma's GLASS,
          3/6 of padding and 4 between the glyph and the word. */}
      {topicLabel && (
        <span className="inline-flex h-4 w-fit items-center gap-1 rounded-full bg-white/10 px-1.5 py-[3px] backdrop-blur-[2px]">
          {TopicIcon && <TopicIcon className="h-2.5 w-[12.5px] shrink-0" />}
          <span className="whitespace-nowrap text-[8px] font-medium leading-[10.4px] text-[#F4F4F4]">
            {topicLabel}
          </span>
        </span>
      )}

      {/* `Frame 2147230805` — the title and the pill, 16 apart, the title
          taking what is left. Two lines at 14/20, clamped: the file's own
          string runs to two and a third would push the faces off the card. */}
      <div className="mt-2 flex items-start gap-4">
        <span className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-5 text-white">
          {stream.title}
        </span>
        {/*
          `Frame 2147230467` — 29 tall at a 23 radius, 8/12 of padding.

          TWO FILLS, and the order is the file's: a solid white UNDER a
          left-to-right #9F65FD→#5B05E6. The white never shows through an
          opaque gradient, but it is what the pill falls back to if the
          gradient ever fails to paint, so it is kept rather than tidied away.
        */}
        <span className="inline-flex h-[29px] shrink-0 items-center gap-1 rounded-[23px] bg-white bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-3 py-2 text-[10px] font-medium leading-[13px] text-white">
          Join Gistroom
          <IconVoiceCompact />
        </span>
      </div>

      {/* `Frame 2147230808` — the faces at one end, the badge and the count at
          the other. `justify-between` rather than the file's 150 gap: the gap
          is what separates two fixed-width groups at 342, and a name of a
          different length would break it where the ends hold. */}
      <div className="mt-4 flex items-center justify-between">
        {/* `Frame 2147230803` — 25.6 plates at an 8 radius, overlapping by 8,
            each with a 1px white inside hairline and the file's own soft
            shadow. The hairline is what keeps three dark faces from reading as
            one smudge once they overlap. */}
        <span className="flex items-center">
          {faces.map((person, index) => (
            <span
              key={person.id}
              className="size-[25.6px] shrink-0 overflow-hidden rounded-[8px] bg-[#EDEDED] shadow-[0_0_17px_rgba(0,0,0,0.25)] ring-1 ring-white"
              style={{ marginLeft: index === 0 ? 0 : -8 }}
            >
              <Avatar
                name={person.displayName || person.username}
                seed={person.id}
                src={person.avatarUrl}
                size={26}
                sizeClassName="size-full"
                className="rounded-none border-0"
              />
            </span>
          ))}
        </span>

        <span className="flex items-center gap-2">
          {/* `Badge` — 21 tall at a 12 radius on the accent's own 10% tint. */}
          <span className="inline-flex h-[21px] items-center gap-1 rounded-[12px] bg-spotlight/10 px-1 py-0.5 text-[12px] font-medium leading-[17px] text-spotlight">
            <IconLiveWaves />
            LIVE
          </span>
          {/*
            LIVE VIEWERS, and only that. `viewerCount` is who is in the room
            now; `peakViewers` is a high-water mark that nothing even writes.
            A number beside a LIVE badge states an audience that is present, so
            it is absent rather than zero when the service did not measure it.
          */}
          {typeof stream.viewerCount === "number" && (
            <span className="tnum flex items-center gap-1 text-[10px] font-medium leading-[13px] text-white">
              <IconTwoPeople />
              {formatCount(stream.viewerCount)}
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}

/** `codicon:voice-mode-compact` — the file's 8px waveform beside the label. */
function IconVoiceCompact() {
  return (
    <svg aria-hidden viewBox="0 0 8 8" className="h-2 w-2 shrink-0" fill="none">
      <path d="M1 3v2M2.6 1.6v4.8M4.2 2.6v2.8M5.8 1v6M7.4 3v2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

/** The badge's broadcast mark — the same one the post card's LIVE chip uses. */
function IconLiveWaves() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none">
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path d="M4.6 5.2a4 4 0 0 0 0 5.6M11.4 5.2a4 4 0 0 1 0 5.6M2.6 3.2a7 7 0 0 0 0 9.6M13.4 3.2a7 7 0 0 1 0 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** `vuesax/outline/profile-2user` at 16 — the count's own glyph. */
function IconTwoPeople() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-white/70" fill="none">
      <circle cx="6.2" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.2 12.6c0-1.9 1.8-3 4-3s4 1.1 4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11.2 3.4a2.1 2.1 0 0 1 0 4.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12.6 9.6c1.4.2 2.4.9 2.4 2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

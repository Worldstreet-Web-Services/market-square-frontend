"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ShareSheet } from "@/components/ui/share-sheet";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { housePath } from "@/features/houses";
import { clockLabel, shortDateLabel, startsInLabel } from "@/lib/format";
import type { Stream } from "@/features/streams";
import { asset } from "@/lib/square-path";

/**
 * HOME'S "COMING SOON" CARD — node 1542:3294 (SQUARE 2.0), PIXEL FOR PIXEL.
 *
 * The horizontal card ogazboiz asked to bring back and then to make exact
 * (2026-09-21: "height, layout and size"). The node is 467 × 136. Every length
 * below is the file's own — the 82×89 cover, the 189 text column, the 94 rule,
 * the 108 right column, the 16 gaps, the 14.45 / 24.55 side insets — so this is
 * built to fixed widths rather than a fluid card, which is the only way the
 * measurements land where the design put them.
 *
 * It is a SEPARATE component from `UpcomingRoomCard` (the vertical banner tile
 * the gist-rooms grid and a house room draw): two surfaces, two shapes. The
 * data wiring is the same — topic + host from the stream, the format helpers,
 * the share sheet — so the two cannot drift on what a room IS. The node draws
 * only Share; Remind me lives on the gist-rooms cards, where there is room.
 *
 * It is on `button-sizing`'s DESIGN_LOCKED list: the cover and Share carry the
 * file's own pixel heights rather than the button scale, on purpose.
 */

/** The topic the file draws with its own exported glyph. */
const FIGMA_TOPIC = "trading";

export function ComingSoonCard({ stream }: { stream: Stream }) {
  const topics = useTopics();
  const [sharing, setSharing] = useState(false);

  const href = housePath(stream.id);
  const startsAt = stream.scheduledAt;
  const host = stream.owner;
  const topicKey = stream.topics?.[0];
  const topicLabel = topicKey
    ? (topics.data?.find((entry) => entry.key === topicKey)?.label ?? topicKey)
    : null;
  const TopicIcon = topicKey && topicKey !== FIGMA_TOPIC ? (TOPIC_ICONS[topicKey] ?? IconSpark) : null;

  return (
    <div className="relative h-[136px] w-full overflow-hidden rounded-[16px] bg-[rgba(16,16,18,0.62)] shadow-[inset_0_0_0_0.552px_rgba(255,255,255,0.18)] backdrop-blur-[3.863px]">
      {/* 1542:3295 — the purple accent bar hard on the left edge. */}
      <span aria-hidden className="absolute bottom-[5.48px] left-[-0.55px] h-[130px] w-[7px] bg-spotlight" />

      {/* 1542:3296 — the content row: 14.45 in on the left, 16.93 on the right,
          items centred, 16 between the four blocks. */}
      <div className="flex h-full items-center gap-4 pl-[14.45px] pr-[16.93px]">
        {/* 1542:3297 — the cover GRID. Its cell is 89.62 × 94.62, not 82 × 89:
            the mic badge sits at 73.62/78.62 and overflows the tile, and in the
            file the grid cell grows to contain it. That extra 7.62 on the right
            is real layout — it is what sets the text column's left edge — so it
            must be reproduced, not thrown away by an absolutely-placed badge on
            an 82-wide box. */}
        <div className="relative h-[94.62px] w-[89.62px] shrink-0">
          <Link
            href={href}
            aria-label={`Open ${stream.title}`}
            className="ws-press absolute left-0 top-0 block h-[89px] w-[82px] overflow-hidden rounded-[11.038px] bg-white"
          >
            {stream.thumbnailUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
              <img src={stream.thumbnailUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
                <img src={asset("/gist-rooms/card-default-cover.svg")} alt="" aria-hidden className="h-8 w-11" />
              </span>
            )}
          </Link>
          {/* 1542:3300 — the mic badge (create→spotlight ramp), 73.62/78.62 in. */}
          <span className="absolute left-[73.62px] top-[78.62px] grid size-[16px] place-items-center rounded-full bg-gradient-to-b from-[#9f65fd] to-[#7e3beb]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gist-rooms/card-mark.svg")} alt="" aria-hidden className="size-[8px]" />
          </span>
        </div>

        {/* 1542:3305 — the text column. The file's own 189 at the node's 467
            width; it FLEXES so the card can narrow to a column smaller than 467
            (a phone) without overflowing — every other block keeps its exact
            width, only this one gives. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href={href}
              className="ws-press line-clamp-2 text-[15px] font-semibold leading-normal text-white"
            >
              {stream.title}
            </Link>
            {topicLabel && (
              // 1542:3308 — the file's own tiny category chip (5.288 text).
              <span className="inline-flex w-fit items-center justify-center gap-[1.763px] rounded-full bg-white/10 px-[5.288px] py-[4.407px]">
                {TopicIcon ? (
                  <TopicIcon className="size-[7.051px] shrink-0" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
                  <img src={asset("/gist-rooms/card-topic-trading.svg")} alt="" aria-hidden className="size-[7.051px] shrink-0" />
                )}
                <span className="text-[5.288px] font-bold leading-[7.051px] text-grey-100">{topicLabel}</span>
              </span>
            )}
          </div>

          {/* 1542:3312 — the host, 8 gap. */}
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-[16px] shrink-0 overflow-hidden rounded-[25%] border-[0.552px] border-white bg-[#DCDAD5]"
              style={{ boxShadow: "0 2.208px 8.278px rgba(147,147,147,0.25)" }}
            >
              <Avatar
                name={host?.displayName ?? "Host"}
                seed={stream.ownerId}
                src={host?.avatarUrl}
                size={16}
                sizeClassName="size-full"
              />
            </span>
            <span className="truncate text-[12px] font-medium">
              <span className="text-[#5A5A5A]">Hosted by </span>
              <span className="text-white">{host?.displayName ?? "a host"}</span>
            </span>
          </span>
        </div>

        {/* 1542:3316 — the 94-tall #3C3C3C divider. */}
        <span aria-hidden className="h-[94px] w-px shrink-0 bg-[#3C3C3C]" />

        {/* 1542:3317 — the 108 right column, 16 gap, right-aligned. */}
        <div className="flex w-[108px] shrink-0 flex-col items-end justify-center gap-4">
          <div className="flex flex-col items-end gap-2">
            {startsAt && (
              <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] font-normal leading-normal text-[#D9D9D9]">
                  {shortDateLabel(startsAt)}
                </span>
                <span className="text-[16px] font-semibold leading-[10px] text-white">
                  {clockLabel(startsAt)}
                </span>
              </div>
            )}
            {startsAt && (
              // 1542:3323 — the "Starts in …" pill.
              <span className="rounded-[30px] bg-[rgba(159,90,255,0.09)] px-2 py-1 text-[10px] font-medium text-[#9F65FD]">
                {startsInLabel(startsAt)}
              </span>
            )}
          </div>

          {/* 1542:3325 — Share, 28×87 on the create ramp at 90°. */}
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="ws-press flex h-[28px] w-[87px] items-center justify-center gap-1 rounded-full bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-[8.83px] py-[4.415px] text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gist-rooms/card-share.svg")} alt="" aria-hidden className="size-[16px] shrink-0" />
            Share
          </button>
        </div>
      </div>

      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(false)}
          title="Share gist room"
          payload={{ text: `${stream.title} on Square`, url: `${window.location.origin}${href}` }}
        />
      )}
    </div>
  );
}

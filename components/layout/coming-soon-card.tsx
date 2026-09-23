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
 * HOME'S "COMING SOON" CARD — node 2077:19030 (SQUARE 2.0 Copy), 342 × 106.
 *
 * The redesign of the 467 × 136 card this file used to draw (1542:3294). The
 * shape changed rather than the content: the cover is no longer a rounded tile
 * in a row of four blocks, it is a FULL-BLEED image on the card's left with a
 * near-opaque panel laid over it from 40px in, so the picture bleeds out under
 * the text instead of sitting beside it. The divider is gone; the right column
 * keeps date, time, the "Starts in" pill and Share.
 *
 * Every length here is the node's own. The ones that look like typos are real:
 * the 0.552 stroke, the 7.726 background blur and the 8.83 / 4.415 button
 * padding are a component that was scaled by 0.5519 when it was pasted in, and
 * they divide back to a clean 1, 14 and 16 / 8. They are reproduced as drawn.
 *
 * ─── THE TWO PLACES THIS DELIBERATELY LEAVES THE FILE ────────────────────────
 * 1. "Starts in …" is FIVE pixels in the node — the same 0.5519 scaling, on a
 *    label rather than a box. Five-pixel text is not small, it is unreadable,
 *    and this card has already been rebuilt once for exactly that reason (the
 *    container-query build that shrank everything to ~5px). It is set at 8 to
 *    match the meta text beside it, which is the size its siblings use.
 * 2. `Hosted by` / the host's name are ONE text node whose per-character
 *    overrides flip the name to Geist 600 at 10px while the label stays 500 at
 *    8px (`styleOverrideTable` 5 → 7). The parent style says 500/8 for the
 *    whole string and is wrong; both runs are drawn as the overrides specify.
 *
 * The cover, topic glyph, calendar and share icons are the file's own exports,
 * already on disk from the previous build — each vector compared against a
 * fresh export of the new node before being reused, not assumed from the name.
 */

/** The topic the file draws with its own exported glyph. */
const FIGMA_TOPIC = "trading";

/** 2077:19030 — the card's own width and height, which the rail sizes to. */
export const COMING_SOON_CARD_WIDTH = 342;

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
    <div className="relative h-[106px] w-full overflow-hidden rounded-[16px] bg-[rgba(16,16,18,0.62)] shadow-[inset_0_0_0_0.552px_rgba(255,255,255,0.18)] backdrop-blur-[7.726px]">
      {/* `image 64` — 144.507 wide, full bleed to the card's left edge and
          under everything else. STRETCH in the file; `object-cover` here, so a
          real photograph of any ratio fills the box without distorting. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[144.507px] overflow-hidden">
        {stream.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
          <img src={stream.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-[#101012]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gist-rooms/card-default-cover.svg")} alt="" aria-hidden className="h-8 w-11" />
          </span>
        )}
      </span>

      {/* `Rectangle 34624595` — the 7px accent, hard on the left edge and drawn
          OVER the image (it is the later sibling in the file). */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[7px] bg-[#7E3BEB]" />

      {/* `Frame 1000011513` — 302 wide from 40px in, which is what fades the
          picture out under the text. The file's gradient runs UPWARD over the
          top 17.2% only: solid #101012 below it, 25% alpha at the very top. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-[40px] w-[302px]"
        style={{ background: "linear-gradient(to bottom, rgba(16,16,18,0.25) 0%, #101012 17.2%)" }}
      />

      {/* `Frame 2147230720` — the text column: 64 in, 16 down, 160 wide, 12 gap. */}
      <div className="absolute left-[64px] top-[16px] flex w-[160px] flex-col gap-[12px]">
        <div className="flex flex-col gap-[8px]">
          <Link
            href={href}
            className="ws-press line-clamp-2 text-[10px] font-semibold leading-[11px] text-white"
          >
            {stream.title}
          </Link>
          {topicLabel && (
            /* `Frame 2147225009` — 16 tall, 3/6 padding, 4 gap, white at 10%. */
            <span className="inline-flex h-[16px] w-fit items-center gap-[4px] rounded-full bg-white/10 px-[6px]">
              {TopicIcon ? (
                <TopicIcon className="h-[10px] w-[13px] shrink-0" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
                <img src={asset("/gist-rooms/card-topic-trading.svg")} alt="" aria-hidden className="h-[10px] w-[13px] shrink-0" />
              )}
              <span className="text-[8px] font-medium leading-[10.4px] text-[#F4F4F4]">{topicLabel}</span>
            </span>
          )}
        </div>

        {/* `Frame 2147230648` — host row, 16 tall, 4 gap, centred. */}
        <span className="flex min-w-0 items-center gap-[4px]">
          <span className="size-[16px] shrink-0 overflow-hidden rounded-full border-[0.552px] border-white bg-[#DCDAD5]">
            <Avatar
              name={host?.displayName ?? "Host"}
              seed={stream.ownerId}
              src={host?.avatarUrl}
              size={16}
              sizeClassName="size-full"
            />
          </span>
          <span className="min-w-0 truncate text-white">
            <span className="text-[8px] font-medium leading-[10.4px]">Hosted by </span>
            <span className="text-[10px] font-semibold leading-[10.4px]">
              {host?.displayName ?? "a host"}
            </span>
          </span>
        </span>
      </div>

      {/* `Frame 2147230722` — the right column: 259 in, 15 down, 67 wide, 8
          gap, right-aligned. */}
      <div className="absolute left-[259px] top-[15px] flex w-[67px] flex-col items-end gap-[8px]">
        <div className="flex flex-col items-end gap-[4px]">
          {startsAt && (
            <div className="flex flex-col items-end gap-[2px]">
              {/* `Frame 2147230647` — calendar + date, 12 icon, 4 gap. */}
              <span className="flex items-center gap-[4px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
                <img src={asset("/gist-rooms/card-calendar.svg")} alt="" aria-hidden className="size-[12px] shrink-0" />
                <span className="text-[8px] font-normal leading-[10.4px] text-[#D9D9D9]">
                  {shortDateLabel(startsAt)}
                </span>
              </span>
              <span className="text-[16px] font-bold leading-[20.8px] text-white">
                {clockLabel(startsAt)}
              </span>
            </div>
          )}
          {startsAt && (
            /* `Frame 2147230649` — 2/4 padding on a full radius, #9F5AFF at 9%.
               Its label is 5px in the file; see the note at the top of this
               file for why it is drawn at 8. */
            <span className="rounded-full bg-[rgba(159,90,255,0.09)] px-[4px] py-[2px] text-[8px] font-medium leading-[10.4px] text-[#9F65FD]">
              {startsInLabel(startsAt)}
            </span>
          )}
        </div>

        {/* `Olive Button` — 19 tall, 8.83/4.415 padding, 4 gap, the create ramp. */}
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="ws-press flex h-[19px] items-center gap-[4px] rounded-full bg-[linear-gradient(180deg,#9f65fd_0%,#5b05e6_100%)] px-[8.83px] text-[8px] font-medium leading-[10.4px] text-white transition-opacity hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
          <img src={asset("/gist-rooms/card-share.svg")} alt="" aria-hidden className="size-[10px] shrink-0" />
          Share
        </button>
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

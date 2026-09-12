"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ShareSheet } from "@/components/ui/share-sheet";
import { RoomTopicChip } from "@/components/layout/gist-room-card";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { housePath } from "@/features/houses";
import { clockLabel, shortDateLabel, startsInLabel } from "@/lib/format";
import type { Stream } from "@/features/streams";

/**
 * A GIST ROOM THAT HAS NOT OPENED YET — node 1295:140164.
 *
 * A wide landscape card (383.38 x 117.65, radius 16.007, rgba(16,16,18,0.62)
 * behind a 5.6 blur with an 18% white hairline) built around WHEN: the artwork
 * and title on the left, the clock on the right, and Share under it. It is a
 * different object from the live invite card (225:3873, 338 x 120) and stays
 * one — that card offers "Join Gistroom", which is the promise an unopened
 * room cannot keep.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 *   · a 9.6 #7E3BEB spine down the left edge, running the card's full height;
 *   · artwork 78.26 x 85.03 at (16.81, 16.8), radius 16.007;
 *   · the mic mark 19.21 round at (104.85, 16.8) on its #9F65FD -> #7E3BEB ramp;
 *   · the title 148.07 wide at (129.66, 13.61), SemiBold 13.35/13.11;
 *   · one topic chip at (131.26, 50.42); the host row at (129.66, 83.24) with a
 *     16.01 avatar;
 *   · a 0.8 #3C3C3C rule at x=287.33 from y=16, 84.84 tall;
 *   · the date at (316.95, 16) with the calendar glyph, the clock 16/11.21 at
 *     (303.34, 32.81), the "Starts in" chip in 9% #9F5AFF at (316.95, 53.62),
 *     and Share at (307.34, 75.23) on the 90deg #9F65FD -> #5B05E6 ramp.
 *
 * ─── THE ONE JUDGEMENT CALL ──────────────────────────────────────────────────
 * The file's smallest type is 4.27-6.4px (the chip label, "Hosted by", "Starts
 * in", "Share"). That is not readable in a browser, and the same frame sets its
 * title at 13.35 — so those runs are drawn at a reduced scale rather than
 * specified as final sizes. Every position, size, colour, radius and gradient
 * here is the file's; only sub-8px type is lifted to the sizes this app already
 * ships (the 9px topic chip, 10-12px meta), which is what keeps the card
 * legible without inventing a second visual language.
 */
export function UpcomingRoomCard({ stream }: { stream: Stream }) {
  const topics = useTopics();
  const [sharing, setSharing] = useState(false);
  const href = housePath(stream.id);
  const startsAt = stream.scheduledAt;
  const host = stream.owner;
  const topicKey = stream.topics?.[0];
  const topic = topicKey
    ? {
        label: topics.data?.find((entry) => entry.key === topicKey)?.label ?? topicKey,
        Icon: TOPIC_ICONS[topicKey] ?? IconSpark,
      }
    : null;

  return (
    <div className="relative flex min-h-[118px] w-full max-w-[383px] overflow-hidden rounded-[16px] bg-[rgba(16,16,18,0.62)] shadow-[inset_0_0_0_0.8px_rgba(255,255,255,0.18)] backdrop-blur-[5.6px]">
      {/* The spine — 9.6 of #7E3BEB down the whole left edge. */}
      <span aria-hidden className="w-[9.6px] shrink-0 bg-[#7E3BEB]" />

      <div className="flex min-w-0 flex-1 items-center gap-[8px] p-[16px]">
        {/* Artwork, with the room's mark over its right edge as the file draws it. */}
        <Link href={href} className="ws-press relative block shrink-0">
          <span className="block h-[85px] w-[78px] overflow-hidden rounded-[16px] bg-white">
            {stream.thumbnailUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
              <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="block h-full w-full bg-[linear-gradient(180deg,#9F65FD_0%,#7E3BEB_100%)]" />
            )}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export, fixed ramp */}
          <img
            src="/gist-rooms/card-mark.svg"
            alt=""
            aria-hidden
            className="absolute -right-[10px] top-0 h-[19.21px] w-[19.21px]"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-[8px] pl-[14px]">
          <Link href={href} className="line-clamp-2 text-[13.35px] font-semibold leading-[16px] text-white hover:underline">
            {stream.title}
          </Link>
          {topic && (
            <span className="flex">
              <RoomTopicChip icon={<topic.Icon className="h-2.5 w-2.5" />} label={topic.label} />
            </span>
          )}
          {/* "Hosted by <name>" — the label in the file's #5A5A5A, the name white. */}
          <span className="flex min-w-0 items-center gap-[2.4px]">
            <Avatar
              name={host?.displayName ?? "Host"}
              seed={stream.ownerId}
              src={host?.avatarUrl}
              size={16}
              className="ring-[0.8px] ring-white"
            />
            <span className="truncate text-[11px] leading-4">
              <span className="text-[#5A5A5A]">Hosted by </span>
              <span className="text-white">{host?.displayName ?? "a host"}</span>
            </span>
          </span>
        </div>

        {/* The file's 0.8 rule, then the when-and-share column. */}
        <span aria-hidden className="h-[85px] w-[0.8px] shrink-0 bg-[#3C3C3C]" />

        <div className="flex shrink-0 flex-col items-end gap-[6px] pl-[10px]">
          {startsAt && (
            <>
              <span className="flex items-center gap-[4px] text-[10px] leading-4 text-[#D9D9D9]">
                {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
                <img src="/gist-rooms/card-calendar.svg" alt="" aria-hidden className="h-2 w-2" />
                {shortDateLabel(startsAt)}
              </span>
              <span className="text-[16px] font-semibold leading-[18px] text-white">
                {clockLabel(startsAt)}
              </span>
              <span className="rounded-[1.6px] bg-[rgba(159,90,255,0.09)] px-[3.2px] py-[3.2px] text-[10px] leading-3 text-[#9F65FD]">
                {startsInLabel(startsAt)}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="ws-press flex items-center gap-[3.2px] rounded-full bg-[linear-gradient(90deg,#9F65FD_0%,#5B05E6_100%)] px-[12.8px] py-[6.4px] text-[12px] font-medium leading-4 text-white transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src="/gist-rooms/card-share.svg" alt="" aria-hidden className="h-[12.81px] w-[12.81px]" />
            Share
          </button>
        </div>
      </div>

      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(false)}
          title="Share gist room"
          payload={{
            text: `${stream.title} on Square`,
            url: `${window.location.origin}${href}`,
          }}
          campaign="room_share"
        />
      )}
    </div>
  );
}

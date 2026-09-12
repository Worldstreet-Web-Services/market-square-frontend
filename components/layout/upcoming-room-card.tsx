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

/**
 * A GIST ROOM THAT HAS NOT OPENED YET — node 1295:140164, drawn exactly.
 *
 * ─── THE SCALE, WHICH IS THE WHOLE TRICK ─────────────────────────────────────
 * The node reads 383.38 x 117.65 with a 0.8003684878 stroke, and EVERY number
 * in it divides by that stroke to a round design unit:
 *
 *     383.38 -> 479      117.65 -> 147       16.007 -> 20 (radius)
 *      19.21 -> 24 (mic)  16.01 -> 20 (avatar)  12.81 -> 16 (share icon)
 *       3.20 -> 4          6.40 -> 8            12.81 -> 16 (paddings)
 *
 * So the card was drawn at 479 x 147 and the row places a 0.8 instance of it.
 * Everything below is in those design units at 1u each, and NOTHING is rounded
 * up or lifted to a house minimum — including the 5.334u topic label and the
 * 6u countdown, which are the file's own sizes.
 *
 * ─── HOW IT STAYS EXACT AT EVERY WIDTH ───────────────────────────────────────
 * `--u` is one design unit, defined as 1/479th of the card's own width, so the
 * whole composition scales as one piece: at 479 it is the file at 1:1, at
 * 383.38 it is the instance in this row exactly, and on a phone it is the same
 * card smaller. That is why the geometry is inline `calc()` rather than
 * utilities — every value is one number from the file times a live unit, and a
 * fixed-px translation would only be exact at one viewport.
 *
 * Children are absolutely positioned because the file positions them that way
 * (`layout mode: none`), at the node's own coordinates. Note the mic mark sits
 * BESIDE the artwork at x=131, not over its corner.
 *
 * ─── THE TWO DEVIATIONS, BOTH DELIBERATE ─────────────────────────────────────
 *  · TYPEFACE. The topic label is Roboto Bold in the file; Square ships Geist
 *    and does not load Roboto, and this repo's standing rule is Geist over the
 *    file's Roboto. Size, weight and colour are the file's.
 *  · TOPIC GLYPH. The file draws ONE chip, "Trading & Finance", and its glyph
 *    is exported and used verbatim (`card-topic-trading.svg` — a filled
 *    candlestick pair, which is NOT the repo's four-stroke IconStats). A room
 *    on any other topic has no glyph in this file, so it falls back to the
 *    product's existing topic icon rather than to an invented export.
 *
 * The node carries NO `interactions`, so nothing here is prototype-wired: the
 * artwork and title opening the room, and Share opening the share sheet, are
 * this product's own conventions, not the file's instructions.
 */

/** One design unit — see the header. */
const u = (n: number) => `calc(${n}*var(--u))`;

/** The topic the file actually draws; its glyph is the file's own export. */
const FIGMA_TOPIC = "trading";

export function UpcomingRoomCard({ stream }: { stream: Stream }) {
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
    <div className="@container w-full max-w-[479px]">
      <div
        className="relative overflow-hidden bg-[rgba(16,16,18,0.62)]"
        style={
          {
            "--u": "calc(100cqw / 479)",
            height: u(147),
            borderRadius: u(20),
            boxShadow: `inset 0 0 0 ${u(1)} rgba(255,255,255,0.18)`,
            // BACKGROUND_BLUR radius 11.205 = 14u; CSS takes half.
            backdropFilter: `blur(${u(7)})`,
          } as React.CSSProperties
        }
      >
        {/* 1295:140165 — the spine: 12 wide, 169 tall from y=-7, clipped by the card. */}
        <span
          aria-hidden
          className="absolute left-0 bg-[#7E3BEB]"
          style={{ top: u(-7), width: u(12), height: u(169) }}
        />

        {/* 1295:140173 — the artwork tile. */}
        <Link
          href={href}
          className="ws-press absolute block overflow-hidden bg-white"
          style={{ left: u(21), top: u(21), width: u(97.78), height: u(106.24), borderRadius: u(20) }}
        >
          {stream.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
            <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full bg-[linear-gradient(180deg,#9F65FD_0%,#7E3BEB_100%)]" />
          )}
        </Link>

        {/* 1295:140189 — the mic mark, in its own column between artwork and title. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export, fixed ramp */}
        <img
          src="/gist-rooms/card-mark.svg"
          alt=""
          aria-hidden
          className="absolute"
          style={{ left: u(131), top: u(21), width: u(24), height: u(24) }}
        />

        {/* 1295:140188 — the title, centred in its 39-unit box. */}
        <Link
          href={href}
          className="absolute flex flex-col justify-center overflow-hidden font-semibold text-white hover:underline"
          style={{ left: u(162), top: u(17), width: u(185), height: u(39) }}
        >
          <span
            className="line-clamp-2"
            style={{ fontSize: u(16.677), lineHeight: u(16.38) }}
          >
            {stream.title}
          </span>
        </Link>

        {/* 1295:140194 — one topic chip. */}
        {topicLabel && (
          <span
            className="absolute flex items-center rounded-full bg-white/10 font-bold text-[#F4F4F4]"
            style={{
              left: u(164),
              top: u(63),
              gap: u(1.778),
              padding: `${u(4.444)} ${u(5.334)}`,
              fontSize: u(5.334),
              lineHeight: u(7.11),
            }}
          >
            {TopicIcon ? (
              <TopicIcon className="shrink-0" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
              <img
                src="/gist-rooms/card-topic-trading.svg"
                alt=""
                aria-hidden
                className="shrink-0"
                style={{ width: u(7.11), height: u(7.11) }}
              />
            )}
            {topicLabel}
          </span>
        )}

        {/* 1295:140167 — "Hosted by <name>". */}
        <span
          className="absolute flex items-center"
          style={{ left: u(162), top: u(104), gap: u(3), maxWidth: u(185) }}
        >
          <span
            className="shrink-0 overflow-hidden rounded-full bg-[#DCDAD5]"
            style={{
              width: u(20),
              height: u(20),
              boxShadow: `0 0 0 ${u(1)} #FFFFFF, 0 ${u(4)} ${u(15)} rgba(147,147,147,0.25)`,
            }}
          >
            <Avatar
              name={host?.displayName ?? "Host"}
              seed={stream.ownerId}
              src={host?.avatarUrl}
              size={20}
              sizeClassName="size-full"
            />
          </span>
          <span className="truncate font-medium" style={{ fontSize: u(8), lineHeight: u(10.4) }}>
            <span className="text-[#5A5A5A]">Hosted by </span>
            <span className="text-white">{host?.displayName ?? "a host"}</span>
          </span>
        </span>

        {/* 1295:140187 — the rule between the room and its clock. */}
        <span
          aria-hidden
          className="absolute bg-[#3C3C3C]"
          style={{ left: u(359), top: u(20), width: u(1), height: u(106) }}
        />

        {startsAt && (
          <>
            {/* 1295:140179 — the date. */}
            <span
              className="absolute flex items-center text-[#D9D9D9]"
              style={{ left: u(396), top: u(20), gap: u(5), fontSize: u(8), lineHeight: u(10.4) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
              <img
                src="/gist-rooms/card-calendar.svg"
                alt=""
                aria-hidden
                className="shrink-0"
                style={{ width: u(10), height: u(10) }}
              />
              {shortDateLabel(startsAt)}
            </span>

            {/* 1295:140166 — the clock. */}
            <span
              className="absolute font-semibold text-white"
              style={{ left: u(379), top: u(41), fontSize: u(20), lineHeight: u(14) }}
            >
              {clockLabel(startsAt)}
            </span>

            {/* 1295:140171 — the countdown. */}
            <span
              className="absolute font-medium text-[#9F65FD]"
              style={{
                left: u(396),
                top: u(67),
                padding: u(4),
                borderRadius: u(2),
                background: "rgba(159,90,255,0.09)",
                fontSize: u(6),
                lineHeight: u(7.8),
              }}
            >
              {startsInLabel(startsAt)}
            </span>
          </>
        )}

        {/* 1295:140175 — Share: the gradient over the #7E3BEB the file stacks under it. */}
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="ws-press absolute flex items-center font-medium text-white transition-opacity hover:opacity-90"
          style={{
            left: u(384),
            top: u(94),
            gap: u(4),
            padding: `${u(8)} ${u(16)}`,
            borderRadius: u(100),
            background: "linear-gradient(90deg,#9F65FD 0%,#5B05E6 100%), #7E3BEB",
            fontSize: u(11),
            lineHeight: u(14.3),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
          <img
            src="/gist-rooms/card-share.svg"
            alt=""
            aria-hidden
            className="shrink-0"
            style={{ width: u(16), height: u(16) }}
          />
          Share
        </button>

        {sharing && (
          <ShareSheet
            open
            onClose={() => setSharing(false)}
            title="Share gist room"
            payload={{ text: `${stream.title} on Square`, url: `${window.location.origin}${href}` }}
            campaign="room_share"
          />
        )}
      </div>
    </div>
  );
}

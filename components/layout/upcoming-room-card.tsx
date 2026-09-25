"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ShareSheet } from "@/components/ui/share-sheet";
import { roomShare } from "@/lib/room-card";
import { api } from "@/lib/square-path";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { useGate } from "@/hooks/use-gate";
import { useAuth } from "@/hooks/use-auth";
import { housePath } from "@/features/houses";
import { clockLabel, shortDateLabel, startsInLabel } from "@/lib/format";
import { useRemindMe } from "@/features/streams";
import type { Stream } from "@/features/streams";
import { asset } from "@/lib/square-path";

/**
 * A GIST ROOM THAT HAS NOT OPENED YET — the "Coming Soon" card.
 *
 * WHY THIS IS NOT THE FIGMA-SCALED BUILD ANYMORE. The card used to reproduce
 * node 1295:140164 exactly, scaling every size to a fraction of its own width
 * (`--u = 100cqw/479`), which shrank the type to ~5px in the 356px rail.
 *
 * So the image is now a full-width BANNER across the top with the room title
 * laid OVER it — a bottom scrim keeps it legible and the whole banner darkens on
 * hover, the way a poster tile behaves. Below the banner is a readable,
 * fixed-type column: topic + host, a rule, the schedule, then the actions. Font
 * sizes do not shrink with the column, and Remind/Share ride the canonical
 * button scale (`ws-btn-sm`; see CLAUDE.md "Buttons"). The exported glyphs (mic,
 * calendar, share, topic) are kept from the file.
 *
 * The behaviour is unchanged: the banner opens the room, Share opens the share
 * sheet, and Remind me stays honest about the signed-out state.
 */

/** The topic the file draws with its own exported glyph. */
const FIGMA_TOPIC = "trading";

export function UpcomingRoomCard({ stream }: { stream: Stream }) {
  const topics = useTopics();
  const [sharing, setSharing] = useState(false);
  const gate = useGate();
  const { authenticated } = useAuth();
  const remind = useRemindMe(stream.id);
  /*
    THREE STATES, AND THE THIRD IS WHY THE FIELD IS OPTIONAL.

    `remindedByMe` is ABSENT for a signed-out reader and a boolean for a
    signed-in one, so this tells "you have not asked" from "there is nobody to
    have asked". A signed-out reader is offered the ask and gated into sign-in on
    the tap, never shown a filled-in "not asked" state that is not about them. A
    404 means the route is not deployed, so the control disappears.
  */
  const asked = stream.remindedByMe === true;
  const href = housePath(stream.id);
  const startsAt = stream.scheduledAt;
  const host = stream.owner;
  /*
    THE SAME SHARE PAYLOAD `/gist-rooms` BUILDS, from one function.

    This card had the share button and NOT the card, so tapping share on the
    list offered a picture and tapping share inside the room offered only a
    link — the same room answering two different ways, with nothing failing to
    say so. `roomShare` exists so a screen cannot ask for half of it.

    `window` is read here rather than inside the helper because this component
    also renders on the server, where there is no origin to read; a relative
    URL in a QR code cannot be scanned from the other device that is the entire
    point of the card.
  */
  const share = roomShare(
    stream,
    href,
    typeof window === "undefined" ? null : window.location.origin,
    api
  );
  const topicKey = stream.topics?.[0];
  const topicLabel = topicKey
    ? (topics.data?.find((entry) => entry.key === topicKey)?.label ?? topicKey)
    : null;
  const TopicIcon = topicKey && topicKey !== FIGMA_TOPIC ? (TOPIC_ICONS[topicKey] ?? IconSpark) : null;

  return (
    <div className="relative w-full overflow-hidden rounded-[20px] bg-[rgba(16,16,18,0.62)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur-[7px]">
      {/* The room image as a full-width banner, with the title laid over it. */}
      <Link
        href={href}
        aria-label={`Open ${stream.title}`}
        className="group relative block h-40 w-full overflow-hidden"
      >
        {stream.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
          <img
            src={stream.thumbnailUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-[#D8D8D8]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img
              src={asset("/gist-rooms/card-default-cover.svg")}
              alt=""
              aria-hidden
              className="h-10 w-14"
            />
          </span>
        )}

        {/* Legibility scrim, plus a hover darken over the whole banner. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent transition-colors group-hover:from-black/90"
        />

        {/* The caption, laid over the foot of the image. */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
          <img
            src={asset("/gist-rooms/card-mark.svg")}
            alt=""
            aria-hidden
            className="size-5 shrink-0 drop-shadow"
          />
          <span className="line-clamp-2 text-[15px] font-semibold leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
            {stream.title}
          </span>
        </div>
      </Link>

      {/* Everything else, below the banner. */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {topicLabel && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-grey-100">
              {TopicIcon ? (
                <TopicIcon className="size-3 shrink-0" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
                <img
                  src={asset("/gist-rooms/card-topic-trading.svg")}
                  alt=""
                  aria-hidden
                  className="size-3 shrink-0"
                />
              )}
              {topicLabel}
            </span>
          )}

          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-5 shrink-0 overflow-hidden rounded-[25%] bg-[#DCDAD5]"
              style={{ boxShadow: "0 0 0 1px #FFFFFF, 0 3px 12px rgba(147,147,147,0.25)" }}
            >
              <Avatar
                name={host?.displayName ?? "Host"}
                seed={stream.ownerId}
                src={host?.avatarUrl}
                size={20}
                sizeClassName="size-full"
              />
            </span>
            <span className="truncate text-[12px] font-medium">
              <span className="text-[#8A8A8A]">Hosted by </span>
              <span className="text-white">{host?.displayName ?? "a host"}</span>
            </span>
          </span>
        </div>

        <span aria-hidden className="h-px w-full bg-white/10" />

        {/* ── Schedule ── */}
        {startsAt && (
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[12px] font-normal text-[#D9D9D9]">
                {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
                <img
                  src={asset("/gist-rooms/card-calendar.svg")}
                  alt=""
                  aria-hidden
                  className="size-3.5 shrink-0"
                />
                {shortDateLabel(startsAt)}
              </span>
              <span className="text-[20px] leading-none font-semibold text-white">
                {clockLabel(startsAt)}
              </span>
            </div>
            <span className="shrink-0 rounded-md bg-create/10 px-2 py-1 text-[11px] font-medium text-create">
              {startsInLabel(startsAt)}
            </span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="mt-1 flex gap-2.5">
          {/* Remind me — not in the file, which drew only Share. Kept quiet
              (secondary) when open and tinted purple once asked. */}
          {!remind.unavailable && (
            <button
              type="button"
              aria-pressed={authenticated ? asked : undefined}
              disabled={remind.isPending}
              onClick={() => gate(() => remind.mutate(!asked))}
              className={`ws-press ws-btn-sm flex flex-1 items-center justify-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-40 ${
                asked
                  ? "border-create/50 bg-create/10 text-create"
                  : "border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {asked ? "Reminding" : "Remind me"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSharing(true)}
            className="ws-btn-create ws-press ws-btn-sm flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold text-white transition-opacity hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the node's own export */}
            <img src={asset("/gist-rooms/card-share.svg")} alt="" aria-hidden className="size-4 shrink-0" />
            Share
          </button>
        </div>
      </div>

      {/*
        THE RING, DRAWN LAST — the same fix `ComingSoonCard` needed, for the
        same reason, found while fixing that one.

        The inset shadow on the root describes the stroke correctly, but an
        INSET box-shadow paints before any child content, and the banner Link
        below is `h-40 w-full` and full bleed. So the card's top edge and the
        upper 160 of both sides had their hairline painted and then covered by
        the photograph; only the bottom, below the banner, ever showed it. On a
        card whose banner is a bright daylight photo that is the difference
        between a card and a floating picture.

        Redrawn on top, `pointer-events-none` so it never sits between a reader
        and the banner link or the Share button.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
      />

      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(false)}
          title="Share gist room"
          payload={{ text: `${stream.title} on Square`, url: share.roomUrl }}
          card={{ imageUrl: share.imageUrl, fileName: share.fileName }}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { useStream, useRemindMe } from "@/features/streams";
import { housePath } from "@/features/houses";
import { clockLabel, shortDateLabel } from "@/lib/format";
import { profileHref } from "@/lib/profile-href";
import { sq } from "@/lib/square-path";
import { asset } from "@/lib/square-path";

/**
 * A GIST ROOM, AS A POST — nodes 2082:20198, 2082:20246 and 1356:32947.
 *
 * Three nodes, ONE card, and the only thing that changes is the last two rows:
 * the meta line and the action. Everything above them — the host, the title,
 * the topic chip — is identical in all three, so it is written once and the
 * STATUS picks the tail. Built as three cards they would have drifted the
 * first time somebody changed the title's size.
 *
 *   · scheduled — the date and time, then Follow host beside Remind me
 *   · live      — the date and a LIVE badge, then one Join Gistroom
 *   · ended     — the date, how long it ran and how many came, then a DEAD
 *                 control reading "Ended"
 *
 * THE ENDED CONTROL IS DISABLED ON PURPOSE. The file draws "Play recording"
 * there, and nothing records a gist room yet (ogazboiz, 2026-09-23: "instead
 * of that play recording just add a disable button called ended... since no
 * recording yet"). A live-looking button that cannot play anything is a
 * promise the product does not keep; a disabled one that says what happened is
 * the truth. It becomes Play recording the day `replayUrl` carries something —
 * `Stream` already has the field.
 *
 * ─── IT READS THE ROOM, IT DOES NOT COPY IT ──────────────────────────────────
 * The post carries only `deepLink: { kind: "stream", ref }`, so the room is
 * fetched by id and the card is whatever the room IS right now — a post
 * written while a room was scheduled shows LIVE when it opens and Ended when
 * it closes, with nothing rewritten and no state duplicated into the post.
 * That is also why a deleted or private room degrades to nothing rather than
 * to a stale card claiming a room that is gone.
 */
export function RoomPostCard({ streamId }: { streamId: string }) {
  const topics = useTopics();
  /*
    Poll only while it is live: a scheduled room hours away does not change,
    and an ended one never will.

    60s, NOT 20 — and the number is the whole cost of this component. The feed
    is an infinite list that never unmounts what it has rendered, so every live
    room post the reader has scrolled past keeps its own interval running for
    the rest of the session. At 20s that is 3 req/min EACH: ten live rooms in a
    scrolled feed is 30 req/min on top of the route's own floor, and it grows
    with scroll depth rather than settling.

    60s is what `GistRoomCard` has always used for the same question on the
    same route (`LIVE_POLL`), so this is the two surfaces agreeing rather than
    a new number. What the poll is FOR is catching live -> ended, and being up
    to a minute late to grey out a card in the middle of a timeline is not a
    cost anybody can perceive — the card is a link, and the room page has a
    real closed state for anyone who taps it.
  */
  const stream = useStream(streamId, ["while-live", 60_000]);
  const remind = useRemindMe(streamId);

  const data = stream.data;
  if (stream.isError || (!stream.isPending && !data)) return null;

  const topicKey = data?.topics?.[0];
  const topicLabel = topicKey
    ? (topics.data?.find((entry) => entry.key === topicKey)?.label ?? topicKey)
    : null;
  const TopicIcon = topicKey ? (TOPIC_ICONS[topicKey] ?? IconSpark) : null;
  const host = data?.owner;
  const when = data?.scheduledAt ?? data?.startedAt ?? null;
  const live = data?.status === "live";
  const ended = data?.status === "ended";
  // Null when the room never started, so the meta line can tell "we did not
  // measure this" from "it ran for no time".
  const ran = data?.startedAt && data?.endedAt ? runLength(data.startedAt, data.endedAt) : null;

  if (stream.isPending) {
    return <div aria-hidden className="h-[235px] w-full animate-pulse rounded-[16px] bg-white/5" />;
  }

  return (
    /*
      THE CARD IS GLASS, AND IT HAS A BORDER — node 2082:21143.

      I drew it as a flat `#101012` panel. The node is `#101012 at 62%` over a
      7.726 BACKGROUND_BLUR, ringed by a 0.5519 INSIDE stroke at `#FFFFFF@18%`.
      Same material as the Coming Soon card, which I built correctly from the
      same file weeks ago — so this was not a thing I did not know, it was a
      thing I did not re-read.

      The ring is an inset shadow rather than a `border`: the stroke is INSIDE
      and sub-pixel, and a real border would round differently against a 16
      radius and steal half a pixel from the padding.
    */
    <div className="flex w-full flex-col rounded-[16px] bg-[rgba(16,16,18,0.62)] p-4 shadow-[inset_0_0_0_0.552px_rgba(255,255,255,0.18)] backdrop-blur-[7.726px]">
      {/* `Frame 2147230648` — the host, 20 round, the name 8 away. */}
      {host && (
        <Link
          href={sq(profileHref(host))}
          className="ws-press flex w-fit items-center gap-2"
        >
          {/* The host's disc carries a white hairline and the file's own soft
              shadow — `0 2.76px 10.35px rgba(147,147,147,0.25)`. Without them
              a plate-coloured avatar dissolves into the glass behind it. */}
          <span className="size-5 shrink-0 overflow-hidden rounded-full bg-[#DCDAD5] shadow-[0_2.76px_10.35px_rgba(147,147,147,0.25)] ring-[0.69px] ring-white">
            <Avatar
              name={host.displayName || host.username}
              seed={host.id}
              src={host.avatarUrl}
              size={20}
              sizeClassName="size-full"
              className="rounded-none border-0"
            />
          </span>
          <span className="truncate text-[12px] font-medium leading-[15.6px] text-white">
            {host.displayName || host.username}
          </span>
        </Link>
      )}

      {/* `Frame 2147230812` — the title over its topic, 8 apart, 16 below the host. */}
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href={housePath(streamId)}
          className="ws-press line-clamp-2 text-[16px] font-semibold leading-[20.8px] text-white"
        >
          {data?.title ?? "Gist room"}
        </Link>
        {/* `Frame 2147225009` — white at 10% carrying Figma's own GLASS effect,
            which is a backdrop blur; flat, the chip sits ON the card rather
            than in it. */}
        {topicLabel && (
          <span className="inline-flex h-4 w-fit items-center gap-1 rounded-full bg-white/10 px-1.5 backdrop-blur-[2px]">
            {TopicIcon ? (
              <TopicIcon className="h-2.5 w-[13px] shrink-0" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
              <img src={asset("/gist-rooms/card-topic-trading.svg")} alt="" aria-hidden className="h-2.5 w-[13px] shrink-0" />
            )}
            <span className="whitespace-nowrap text-[8px] font-medium leading-[10.4px] text-[#F4F4F4]">
              {topicLabel}
            </span>
          </span>
        )}
      </div>

      {/* `Frame 2147230813` — the meta line, and the first thing the status
          changes. 11/14.3 in #D9D9D9, the separator the file's own bullet. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium leading-[14.3px] text-[#D9D9D9]">
        {when && <span>{shortDateLabel(when)}</span>}
        {when && <span aria-hidden>•</span>}
        {live ? (
          /* `Badge` — 21 tall, 2/8 of padding at a 12 radius, the mark and the
             word both #7E3BEB on its own 9% tint. */
          <span className="inline-flex h-[21px] items-center gap-1 rounded-[12px] bg-[rgba(126,59,235,0.16)] px-2 text-[12px] font-medium leading-[17.4px] text-[#7E3BEB]">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
              <circle cx="8" cy="8" r="2" fill="currentColor" />
              <path d="M4.6 5.2a4 4 0 0 0 0 5.6M11.4 5.2a4 4 0 0 1 0 5.6M2.6 3.2a7 7 0 0 0 0 9.6M13.4 3.2a7 7 0 0 1 0 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            LIVE
          </span>
        ) : ended ? (
          <>
            {/* What it WAS, which is the only honest thing to show about a room
                nobody can enter: how long it ran, and how many came. Each is
                absent rather than zero when the service did not measure it. */}
            {ran && <span>{ran}</span>}
            {/*
              "428 joined" — distinct people who came AT ALL, which is what the
              caption claims. NOT `peakViewers`: peak is the most people in the
              room at once, so fifty people passing through in ones and twos
              peaks at three. This card went without the number rather than
              print peak under this word.

              `typeof === "number"` rather than a truthiness test, because a
              room nobody joined really is 0 and deserves to say so. Absent is
              the different case — a live room, or a list row that does not
              carry the count — and absent draws nothing.

              The bullet belongs to the PAIR, not to this half: a room that was
              ended before it ever started has no run length, and a separator
              that does not check what precedes it draws "Sep 20 • • 428
              joined".
            */}
            {typeof data?.joined === "number" && (
              <>
                {ran && <span aria-hidden>•</span>}
                <span>{data.joined.toLocaleString()} joined</span>
              </>
            )}
          </>
        ) : (
          when && <span>{clockLabel(when)}</span>
        )}
      </div>

      {/* `Frame 2147230815` / `2147230814` — the action row: 40 tall, 8/12 of
          padding at a 23 radius, the label 12/15.6. */}
      <div className="mt-4 flex items-center gap-2">
        {ended ? (
          <button
            type="button"
            disabled
            title="This gist room has ended. Recordings aren't available yet."
            className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-[23px] bg-white/10 px-3 text-[12px] font-medium leading-[15.6px] text-white/50"
          >
            Ended
          </button>
        ) : live ? (
          <Link
            href={housePath(streamId)}
            className="ws-press flex h-10 w-full items-center justify-center gap-2 rounded-[23px] bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-3 text-[12px] font-medium leading-[15.6px] text-white"
          >
            Join Gistroom
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
              <path d="M3 6.5v3M6 4v8M9 5.5v5M13 6.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Link>
        ) : (
          <>
            {host && (
              <Link
                href={sq(profileHref(host))}
                className="ws-press flex h-10 flex-1 items-center justify-center gap-1 rounded-[23px] bg-white/10 px-3 text-[12px] font-medium leading-[15.6px] text-white"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
                  <circle cx="6.5" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M2 13c0-2.2 2-3.6 4.5-3.6 1 0 1.9.2 2.6.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M12 9.5v4M10 11.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Follow host
              </Link>
            )}
            {/* `remindedByMe` is ABSENT for a signed-out reader and a boolean
                for a signed-in one, so this tells "you have not asked" from
                "there is nobody to have asked". */}
            <button
              type="button"
              disabled={remind.isPending}
              onClick={() => remind.mutate(data?.remindedByMe !== true)}
              className="ws-press flex h-10 flex-1 items-center justify-center gap-2 rounded-[23px] bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-3 text-[12px] font-medium leading-[15.6px] text-white disabled:opacity-40"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
                <path d="M8 2.2a4.2 4.2 0 0 0-4.2 4.2c0 3.2-1.3 4.1-1.3 4.1h11c0 0-1.3-.9-1.3-4.1A4.2 4.2 0 0 0 8 2.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M6.7 13a1.5 1.5 0 0 0 2.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {data?.remindedByMe === true ? "Reminder set" : "Remind me"}
            </button>
          </>
        )}
      </div>

    </div>
  );
}

/** How long it ran, in the file's own "1h 23m" shape. Minutes alone under an hour. */
function runLength(startedAt: string, endedAt: string): string {
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

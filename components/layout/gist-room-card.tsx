"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { IconRoomBadgeMic, IconVoiceMode } from "@/components/ui/room-icons";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { useConversationMembers } from "@/features/messages";
import { housePath } from "@/features/houses";
import { useStream } from "@/features/streams";

/**
 * "X opened a gist room" — the invite card a room posts into its house group.
 *
 * NODE 225:3873. A 338x120 glass card at `rgba(16,16,18,0.62)` behind a 7px
 * backdrop blur, ringed at `white/18`, 22px radius, 16px of padding. Inside:
 *
 *   · a 24px disc carrying the file's own `#9F65FD -> #7E3BEB` gradient (the
 *     purple ramp's two stops) with a microphone in it, 8px from
 *   · the room's TITLE at Geist SemiBold 12/16, wrapping to two lines;
 *   · the room's TOPICS as `white/10` pills, indented to the title's left edge;
 *   · the `Join Gistroom` pill on the `#9F65FD -> #5B05E6` ramp at 90 degrees
 *     with the `codicon:voice-mode-compact` waveform;
 *   · and a cluster of three overlapping 32px rounded-10.7 tiles at the right,
 *     each ringed white with a `0 4px 15px rgba(147,147,147,0.25)` shadow.
 *
 * ─── WHY IT IS COMPOSED HERE ─────────────────────────────────────────────────
 * It reads THREE slices: the room (`streams`), the topic vocabulary that turns
 * a topic key into a label and a glyph (`discovery`), and the group's roster
 * (`messages`). Slices never import each other, so the card is assembled in the
 * layout layer and handed to the thread through a slot — the same pattern
 * `home-screen` and `messages-screen` already use.
 *
 * ─── TWO JUDGEMENT CALLS, BOTH STATED ────────────────────────────────────────
 *
 *  1. **TYPE SIZE.** The file gives the topic chips Roboto Bold at **3.79px**
 *     and the Join pill's label **8px**. Those are not design decisions: the
 *     chip group was pasted into this card at roughly 38% scale, and 3.79px
 *     text cannot be rendered by a browser, let alone read. The title's 12/16
 *     and every box measurement are the file's exactly; the chips are drawn at
 *     10px over a 12px glyph and the pill's label at 11px, which is the
 *     smallest either can be and still be legible. Everything else — the 22px
 *     radius, the 24px disc, the 16px padding, the 8px gap, the two gradients,
 *     the tile geometry — is verbatim.
 *
 *  2. **WHOSE FACES ARE IN THE STACK.** The file draws three portraits and
 *     cannot say who they are. The service has no participant list on a stream
 *     (the payload carries `viewerCount` and `owner`, nothing else), so rather
 *     than invent one the stack shows up to three members OF THIS HOUSE GROUP —
 *     the people the invite is actually addressed to. If the roster has not
 *     resolved, the stack is simply absent rather than filled with placeholders.
 *     A `participants` array on `GET /streams/:id` would let this say what the
 *     file means; it is asked for in the backend notes.
 */
/** 60s, and only while the room is live — see the note at the call site. */
const LIVE_POLL = ["while-live", 60_000] as const;

export function GistRoomCard({
  streamId,
  conversationId,
}: {
  streamId: string;
  conversationId: string;
}) {
  /*
    POLLED WHILE THE ROOM IS LIVE, and not otherwise.

    A thread stays open for a long time, and the one transition that matters is
    live -> ended: a card still offering "Join Gistroom" for a room that closed
    ten minutes ago is precisely the dead promise this state exists to remove.
    An ended room never becomes live again, and a scheduled one is opened by its
    host rather than by a clock, so neither is worth a poll.
  */
  const stream = useStream(streamId, LIVE_POLL);
  const topics = useTopics();
  const members = useConversationMembers(conversationId, true);

  const room = stream.data;
  // A room whose lookup failed still gets its card: the deep link is the point,
  // and a dead card would strand somebody the invite was meant for. It just
  // says less.
  const title = room?.title ?? "Gist room";

  /*
    ─── THE ENDED STATE, WHICH THE FILE DOES NOT DRAW ─────────────────────────

    225:3873 has one variant: a live room, offering "Join Gistroom" on the
    purple ramp. A gist room is over within the hour, and the invite stays in
    the thread for ever — so most of this card's life is spent in a state the
    file has no picture of, and left alone it goes on offering to join a room
    that closed.

    Three states, one card:

      · `live`      — the file's, verbatim.
      · `scheduled` — the room exists but its host has not opened it. "Not open
                      yet", quiet, still a link: the room page says when.
      · ended / cancelled — "Gist room ended", quiet, and STILL A LINK. The
                      room page has a real closed state ("This house has
                      closed", with an "Open a gist room about this" action),
                      so landing there is an honest answer; a dead card would
                      just strand the reader.

    The quiet pill drops the purple ramp AND the waveform glyph — the waveform
    means live voice, and keeping it on a finished room would say the one thing
    the label is there to deny. The title, the topics and the faces all stay:
    the card is a record of what happened, not a tombstone.
  */
  const status = room?.status;
  const over = status === "ended" || status === "cancelled";
  const pending = status === "scheduled";
  const label = over ? "Gist room ended" : pending ? "Not open yet" : "Join Gistroom";

  const labelled = (room?.topics ?? []).slice(0, 2).map((key: string) => {
    const match = topics.data?.find((topic) => topic.key === key);
    return { key, label: match?.label ?? key, Icon: TOPIC_ICONS[key] ?? IconSpark };
  });

  const faces = (members.data?.items ?? [])
    .flatMap((member) => (member.profile ? [member.profile] : []))
    .slice(0, 3);

  return (
    /*
      338 WIDE, ALWAYS — `shrink-0` is the load-bearing half.

      The card sits in a `flex gap-4 overflow-x-auto` rail, and a flex item
      shrinks below its width unless told not to. So a room with a short title
      collapsed to whatever its text measured and the rail showed cards of three
      different widths. The file's card is `layoutSizingHorizontal: FIXED` at
      338 regardless of what is in it.

      `max-w-full` still caps it, because this same card is composed into a
      message thread whose column can be narrower than 338.
    */
    <div className="w-[338px] max-w-full shrink-0 rounded-[22px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)] p-4 backdrop-blur-[7px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/*
            The title box is a FIXED TWO LINES, which is the file's 186x32 at
            12/16. Two things follow from that and both matter:

            · a LONG title WRAPS rather than truncating on one line — the box is
              186 wide and the file sizes it that way on purpose;
            · a SHORT one still occupies 32, so the chips and the Join pill stay
              where the file puts them (y=56.3 and y=84.7) instead of sliding up
              and giving every card a different rhythm.

            The 186 is not hard-coded: the column is 218 after the faces take
            their 72.4 and the gap its 16, and the disc and its 8px gap leave
            exactly 186.
          */}
          <div className="flex h-8 gap-2">
            <IconRoomBadgeMic className="h-6 w-6 shrink-0 self-center" />
            <p className="line-clamp-2 min-w-0 flex-1 text-[12px] font-semibold leading-4 text-white">
              {title}
            </p>
          </div>

          {/* Indented to the title's own left edge — 24 + 8, which is the
              file's x=31.57 on both the chip row and the pill. The 8 and 16
              below are the file's own gaps: title ends at 48.3, chips open at
              56.3, and the pill at 84.7. */}
          <div className="mt-2 space-y-4 pl-8">
            {labelled.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {labelled.map(({ key, label, Icon }) => (
                  <span
                    key={key}
                    className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold leading-4 text-grey-100"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
              </div>
            )}

            <Link
              href={housePath(streamId)}
              className={cn(
                "ws-press inline-flex items-center gap-1.5 rounded-[30px] px-3 py-1.5 text-[11px] font-medium leading-4 transition-opacity hover:opacity-90",
                over || pending
                  ? "bg-white/10 text-white/60"
                  : "bg-[linear-gradient(90deg,var(--color-create)_0%,var(--color-create-deep)_100%)] text-white"
              )}
            >
              {label}
              {!over && !pending && <IconVoiceMode className="h-3 w-3" />}
            </Link>
          </div>
        </div>

        {faces.length > 0 && (
          /* The file's cluster: one tile raised and centred, two below it and
             outset, each overlapping its neighbour. `-space-x` would flatten
             them into a row, so the offsets are the file's own. */
          <div aria-hidden className="relative h-[56px] w-[73px] shrink-0">
            {faces.map((profile, index) => (
              <span
                key={profile.id}
                className="absolute overflow-hidden rounded-[10.7px] border-[1.67px] border-white bg-grey-200 shadow-[0_4px_15px_0_rgba(147,147,147,0.25)]"
                style={
                  [
                    { left: 22, top: 0, width: 32, height: 32 },
                    { left: 0, top: 21, width: 34, height: 34 },
                    { left: 38, top: 21, width: 34, height: 34 },
                  ][index]
                }
              >
                <Avatar
                  name={profile.displayName || profile.username}
                  seed={profile.id}
                  src={profile.avatarUrl}
                  size={34}
                  sizeClassName="h-full w-full"
                  className="rounded-none border-0"
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

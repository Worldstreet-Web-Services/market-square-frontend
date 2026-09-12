"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { IconRoomBadgeMic, IconVoiceMode } from "@/components/ui/room-icons";
import { TOPIC_ICONS } from "@/components/ui/topic-tags-field";
import { IconSpark } from "@/components/ui/icons";
import { useTopics } from "@/features/discovery";
import { useConversationMembers } from "@/features/messages";
import { opensAtLabel } from "@/lib/format";
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
 *     smallest either can be and still be legible. Their BOXES stay the
 *     file's: a 16-tall chip and a 20-tall pill, 12 apart, keep the card at
 *     its 120 and the pill at the file's y of 84 (496:13802, live file). Everything else — the 22px
 *     radius, the 24px disc, the 16px padding, the 8px gap, the two gradients,
 *     the tile geometry — is verbatim.
 *
 *  2. **WHOSE FACES ARE IN THE STACK.** The file draws three portraits and
 *     cannot say who they are. The service has no participant list on a stream
 *     (the payload carries `viewerCount` and `owner`, nothing else; who is
 *     actually in the room exists only as LiveKit presence, which needs a
 *     connection to read), so rather than invent one the stack shows the HOST
 *     first — the one person certainly in the room, hydrated on every stream
 *     surface — then up to two members OF THIS HOUSE GROUP, the people the
 *     invite is addressed to.
 *
 *     The host leading is what makes a room opened WITHOUT a house show a face
 *     at all. Such a room has no `houseConversationId`, so there is no roster
 *     to read, and the card used to render an empty stack beside "Join
 *     Gistroom" — a room that looked like nobody was in it, including the
 *     person who had just opened it.
 *
 *     WHO JOINED comes first when the service can say: `participants` on
 *     `GET /streams/:id` is a sample of people currently connected (gist rooms
 *     only — see the schema for the privacy call behind that). The card
 *     already fetches the detail route to poll the room's status, so the
 *     faces cost no extra request and no list-route flag. When the sample is
 *     empty — a backend that has not shipped it, or a room whose joiners are
 *     all signed-out and unresolvable — the host and the house roster fill
 *     in exactly as before.
 */
/** 60s, and only while the room is live — see the note at the call site. */
const LIVE_POLL = ["while-live", 60_000] as const;

/**
 * The face cluster at 496:13802's own geometry inside its 72.43 x 55.62 group:
 * the raised tile first, then the one to its right turned -4deg on a white ->
 * #F0E8FF ring, then the one to its left turned 4deg on a thinner white ring.
 * Paint order is the file's, and each ring is drawn INSIDE its tile.
 */
const TILES = [
  { left: 12.31, top: 0, size: 32, rotate: 0, ring: 1.668, gradient: false },
  { left: 38.27, top: 21.47, size: 34.15, rotate: -4, ring: 1.668, gradient: true },
  { left: 0, top: 20.97, size: 34.15, rotate: 4, ring: 1.334, gradient: false },
] as const;

/**
 * THE CARD'S MATERIAL, stated once — nodes 225:3873 (the invite) and
 * 545:47749 (a replay on a profile) are the same glass: `rgba(16,16,18,0.62)`
 * behind a 7px backdrop blur, ringed at `white/18`, a 22px radius, 16px of
 * padding. The invite is 338 wide in a rail and fluid on the rooms page; the
 * replay is the file's 359. The width belongs to the surface, the shell does
 * not.
 */
export function RoomCardShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // The ring is an INSET shadow, not a border: the file's stroke sits
        // inside the card and takes no layout, so a border cost 2px of the
        // 306 content box and wrapped the topic chips onto a second line.
        "max-w-full rounded-[22px] bg-[rgba(16,16,18,0.62)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur-[7px]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** One topic chip — 225:3887 / 545:47760. See the type-size note above. */
export function RoomTopicChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex h-4 items-center gap-1 rounded-full bg-white/10 px-2 text-[9px] font-bold leading-3 text-grey-100">
      {icon}
      {label}
    </span>
  );
}

export function GistRoomCard({
  streamId,
  conversationId,
  fluid = false,
}: {
  streamId: string;
  conversationId: string;
  /**
   * Fill the cell instead of holding 338.
   *
   * The rail is a horizontal scroller, so its cards are a FIXED width — that is
   * what makes a short title and a long one occupy the same space and the row
   * read as a row. The gist rooms PAGE (407:17074) lays the same card out in a
   * two-column grid at 359, and the file's own two instances differ by exactly
   * that, so the width belongs to the surface rather than to the card.
   */
  fluid?: boolean;
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
  // A room that has not opened says WHEN, which is the one thing somebody
  // looking at it wants to know. Without a time it falls back to the state.
  const label = over
    ? "Gist room ended"
    : pending
      ? room?.scheduledAt
        ? opensAtLabel(room.scheduledAt)
        : "Not open yet"
      : "Join Gistroom";

  const labelled = (room?.topics ?? []).slice(0, 2).map((key: string) => {
    const match = topics.data?.find((topic) => topic.key === key);
    return { key, label: match?.label ?? key, Icon: TOPIC_ICONS[key] ?? IconSpark };
  });

  /*
    Who is actually here first, then the host, then the house roster — each
    layer only adding people the earlier ones did not (a host is usually in
    their own sample AND their own house, and a face drawn twice reads as a
    bug). Three at most — the file's cluster has three tiles.
  */
  const roster = (members.data?.items ?? []).flatMap((member) =>
    member.profile ? [member.profile] : []
  );
  const host = room?.owner ?? null;
  const seen = new Set<string>();
  const faces = [...(room?.participants ?? []), ...(host ? [host] : []), ...roster]
    .filter((profile) => (seen.has(profile.id) ? false : (seen.add(profile.id), true)))
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
    <RoomCardShell className={fluid ? "w-full" : "w-[338px] shrink-0"}>
      <div className="flex items-center justify-between gap-4">
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
              file's x=31.57 on both the chip row and the pill. Title ends at
              48, chips open 8 later at 56 and stand 16 tall, and the pill sits
              12 under them at 84 — the file's 84.32, in a 120 card. */}
          <div className="mt-2 space-y-3 pl-8">
            {labelled.length > 0 && (
              /* ONE line, 16 tall. Measured in Geist: the file's own pair
                 ("Religion" + "Food & Lifestyle") is 170.5 wide at 9px over a
                 10px glyph against the column's 186, and 186.3 at 10px, so 9px
                 is the size that keeps the file's pair on one line. Longer
                 pairs ("Trading & Finance" + "Food & Lifestyle", 213) cannot
                 fit at any legible size, so a chip that does not fit WHOLE
                 wraps onto a second line that `overflow-hidden` never shows —
                 never cut in half, and the card never grows past 120. */
              <div className="flex h-4 flex-wrap items-center gap-x-1 gap-y-4 overflow-hidden">
                {labelled.map(({ key, label, Icon }) => (
                  <RoomTopicChip key={key} icon={<Icon className="h-2.5 w-2.5" />} label={label} />
                ))}
              </div>
            )}

            <Link
              href={housePath(streamId)}
              className={cn(
                // BLOCK-level `flex w-fit`, not `inline-flex`: an inline box sits
                // on the line's baseline and took 3.5px of strut below it, which
                // pushed the pill to 87.5 and the card to 124.
                "ws-press flex h-5 w-fit items-center gap-[3px] rounded-[30px] px-3 text-[11px] font-medium leading-none transition-opacity hover:opacity-90",
                over || pending
                  ? "bg-white/10 text-white/60"
                  : "bg-[linear-gradient(90deg,var(--color-create)_0%,var(--color-create-deep)_100%)] text-white"
              )}
            >
              {label}
              {!over && !pending && <IconVoiceMode className="h-[11px] w-[11px]" />}
            </Link>
          </div>
        </div>

        {faces.length > 0 && (
          /* The file's cluster: one tile raised and centred, two below it and
             outset, each overlapping its neighbour. `-space-x` would flatten
             them into a row, so the offsets are the file's own. */
          <div aria-hidden className="relative h-[55.62px] w-[72.43px] shrink-0">
            {faces.map((profile, index) => {
              const tile = TILES[index]!;
              return (
                <span
                  key={profile.id}
                  className="absolute rounded-[10.675px] shadow-[0_4px_15px_0_rgba(147,147,147,0.25)]"
                  style={{
                    left: tile.left,
                    top: tile.top,
                    width: tile.size,
                    height: tile.size,
                    padding: tile.ring,
                    transform: tile.rotate ? `rotate(${tile.rotate}deg)` : undefined,
                    background: tile.gradient ? "linear-gradient(180deg, #FFFFFF 0%, #F0E8FF 100%)" : "#FFFFFF",
                  }}
                >
                  <span
                    className="block h-full w-full overflow-hidden bg-[#EDEDED]"
                    style={{ borderRadius: 10.675 - tile.ring }}
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
                </span>
              );
            })}
          </div>
        )}
      </div>
    </RoomCardShell>
  );
}

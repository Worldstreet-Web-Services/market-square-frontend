"use client";

import { Avatar } from "@/components/ui/avatar";
import { IconPlateMic, IconRoomMicOff, IconViewAll } from "@/components/ui/room-icons";
import { cn } from "@/lib/cn";

/**
 * The room's people, as node 129:11748 draws them.
 *
 * ONE card, three sections. `Speakers`, `House Members` and `Audience` are the
 * same 104×157 tile in the file — same 113px rounded plate, same badge
 * straddling its lower edge, same 14/24 name underneath — so they are one
 * component used three times rather than three that drift. The sections differ
 * only in their heading and in what they are given.
 *
 * ─── THE NUMBERS ─────────────────────────────────────────────────────────────
 * Card 104 wide. The plate is 104×113 at radius 32 (the file's `#EDEDED` is the
 * placeholder a photo sits in, so a real avatar fills it and the grey is only
 * ever the fallback). The badge is 56×24 centred on the plate's bottom edge —
 * it starts at y=101 inside a 113 plate and ends at 125, so it deliberately
 * overhangs by 12. Then 8px, then the name at 14/24. 113 + 12 + 8 + 24 = 157.
 *
 * Rows are 6 across with a 24px gutter, which is what makes 104 the card width:
 * 6 × 104 + 5 × 24 = 744, the content width of the left column.
 */

export interface RoomPerson {
  /** Stable key — a LiveKit identity or a profile id. */
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Speaking right now: the plate gets the live ring. */
  speaking?: boolean;
  /**
   * Their microphone, drawn as a glyph CENTRED ON THE PLATE — which is what
   * the render shows and what the properties alone did not: a small mic over
   * the portrait, slashed and dimmed when they are muted.
   */
  mic?: "on" | "muted";
  /** Opens their person sheet. Absent for somebody with nothing to show. */
  onOpen?: () => void;
  /**
   * The file's 56×24 pair — a WINK and a FOLLOW — rendered by the profile
   * slice, because the room knows a username and not a Profile. The card owns
   * where they sit; the slot owns what they do. See `PersonQuickActions`.
   */
  actions?: React.ReactNode;
}

/**
 * One person.
 *
 * `speaking` is a RING rather than a colour change on the plate: the plate
 * holds a photograph, and tinting somebody's face to say they are talking is
 * both ugly and unreadable against a dark or light portrait.
 */
function PersonCard({ person }: { person: RoomPerson }) {
  /*
    A BUTTON when there is a sheet to open, a plain figure otherwise. The seat
    ring this replaced opened a person on tap, and dropping that would quietly
    remove the only route to mute, follow or report somebody in the room.
  */
  const Root = person.onOpen ? "button" : "figure";
  return (
    <Root
      {...(person.onOpen ? { type: "button" as const, onClick: person.onOpen } : {})}
      className={cn(
        "flex w-[104px] shrink-0 flex-col gap-2",
        person.onOpen && "ws-press text-left"
      )}
    >
      {/* 125 tall: the 113 plate plus the badge's 12px of overhang, so the
          badge does not push the name down the way a flow child would. */}
      <div className="relative h-[125px] w-[104px]">
        <div
          className={cn(
            "relative flex h-[113px] w-[104px] items-center justify-center overflow-hidden rounded-[32px] bg-white/10 transition-shadow",
            person.speaking && "ring-2 ring-create"
          )}
        >
          {/*
            THE PLATE IS A ROUNDED RECTANGLE, AND THE PHOTO FILLS IT.

            `Avatar` is `rounded-full` everywhere else in the app, so dropped in
            here it drew a 104px CIRCLE floating inside the file's 104×113
            rounded-32 plate — which is what every person in the room looked
            like. Node 169:13364 is an IMAGE fill on the plate itself: it fills
            the whole shape and the plate's own radius is the only rounding.
            `sizeClassName` replaces the inline width/height (an inline style
            beats a utility, so a class alone would never win) and
            `rounded-none` is merged over `rounded-full` by tailwind-merge, so
            all three of Avatar's tiers — upload, seeded artwork and initials —
            fill the plate.
          */}
          <Avatar
            name={person.name}
            seed={person.id}
            src={person.avatarUrl}
            size={113}
            sizeClassName="h-full w-full"
            className="rounded-none border-0"
          />

          {/* NODE 169:13365, exported from the file rather than redrawn — a
              40px disc at `white/10` centred on the plate, carrying its own
              `0 4px 25px rgba(107,107,107,0.25)` glow with the microphone
              inside it. A muted person gets the file's `microphone-slash-2`
              (106:9786) plus a wash over the portrait, because a slashed glyph
              alone is easy to miss across a grid of twenty faces. */}
          {person.mic && (
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                person.mic === "muted" && "bg-black/45"
              )}
            >
              {person.mic === "muted" ? (
                <IconRoomMicOff className="h-6 w-6 text-white/80 drop-shadow" />
              ) : (
                /* The disc, its `white/10` fill and its glow are all INSIDE the
                   exported node, which is why it is 90 wide for a 40px disc —
                   the glow pads the art. Drawn at 90 so nothing is clipped. */
                <IconPlateMic className="h-[90px] w-[90px]" />
              )}
            </span>
          )}
        </div>

        {/*
          THE BADGE IS TWO BUTTONS, not a status chip: the file draws a wink
          and a follow, 24×24 each, in a 56×24 row straddling the plate's lower
          edge. They are filled by a slot — see `actions` — so the room can
          position them without knowing what a Profile is.
        */}
        {person.actions && (
          <span className="absolute left-1/2 top-[101px] -translate-x-1/2">{person.actions}</span>
        )}
      </div>

      {/* 169:13373 — `#FFFFFF` at 14/24, not the column's body grey. */}
      <span className="w-full truncate text-center text-[14px] leading-6 text-white">
        {person.name}
      </span>
    </Root>
  );
}

/**
 * A titled row of people.
 *
 * The heading carries a hairline that runs to the end of the row — the file
 * draws it on `House Members` and `Audience` but not on `Speakers`, which is
 * the top section and needs no separation from what is above it.
 */
export function RoomPeopleSection({
  title,
  people,
  rule = true,
  empty,
  action,
  onViewAll,
}: {
  title: string;
  people: RoomPerson[];
  /** The hairline beside the heading. Off for the first section. */
  rule?: boolean;
  /** What to say when nobody is here — never a blank row. */
  empty: string;
  /** Optional control on the heading line (e.g. the host's request tray). */
  action?: React.ReactNode;
  /** Ends the grid with the file's "View all" tile (169:13518). */
  onViewAll?: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {/* 169:13359 — 16/24 at `white/50`. `text-body` is #d4d4d8, which is
            half again as bright and made every section heading compete with the
            names under it. */}
        <h2 className="shrink-0 text-[16px] leading-6 text-white/50">{title}</h2>
        {rule && <span aria-hidden className="h-px flex-1 bg-white/25" />}
        {action}
      </div>

      {people.length === 0 ? (
        <p className="text-[14px] leading-6 text-meta">{empty}</p>
      ) : (
        /* Wraps rather than scrolls: the file draws two full rows of six and a
           room can hold more, and a horizontal scroller hides people behind a
           gesture nobody is told about. */
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
          {onViewAll && <ViewAllTile onClick={onViewAll} />}
        </div>
      )}
    </section>
  );
}

/**
 * The tile that closes a full row — node 169:13518.
 *
 * A 48px disc inside the card's own 104×113 footprint, so it sits on the grid
 * rather than beside it, with "View all" underneath at 50% white.
 */
function ViewAllTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ws-press flex w-[104px] shrink-0 flex-col items-center gap-2"
    >
      <span className="flex h-[125px] w-[104px] items-center justify-center">
        {/* Node 169:13519, exported whole: the 48px disc, its `white/10` fill,
            its glow and the people glyph are one asset. Exported at 98 because
            the glow pads it. */}
        <IconViewAll className="h-[98px] w-[98px]" />
      </span>
      <span className="w-full truncate text-center text-[14px] leading-6 text-white/50">
        View all
      </span>
    </button>
  );
}

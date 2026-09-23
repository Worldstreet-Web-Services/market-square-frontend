"use client";

import { Avatar } from "@/components/ui/avatar";
import {
  IconPlateMic,
  IconPlateMicOffSm,
  IconPlateMicSm,
  IconRoomMicOff,
  IconViewAll,
} from "@/components/ui/room-icons";
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
 *
 * ─── THE PHONE (1285:92941 / 1285:92987 in frame 1285:92794) ─────────────────
 * Three across on a 16 gutter in a 342 column: 3 × 103 + 2 × 16 = 341. The
 * tile is 103×144 — a 103 plate at radius 24.92 (`#EDEDED` placeholder, same
 * rule), the 31.15 microphone disc centred on it, the 24px pair straddling its
 * foot at y=91 (12 of overhang, so the group is 115), then 15, then the name at
 * 12/14.06. Section headings are 14/20. Every `md:` value below is the desktop
 * file's, unchanged.
 */

export interface RoomPerson {
  /** Stable key — a LiveKit identity or a profile id. */
  id: string;
  /**
   * The person's USER id, when `id` is a LiveKit identity.
   *
   * This is what the avatar is SEEDED with, and the two are not the same
   * string: a LiveKit identity carries a role suffix (`#broadcaster`,
   * `#speaker`, `#rtmp`) and a user id never does. Seeding on the identity
   * gave one person a different generated character in the room than the one
   * the sidebar, the topbar and House Members draw for them — most visibly the
   * host, whose identity is the only one that changes when they go live.
   *
   * Only matters for somebody with no uploaded avatar, which is most people,
   * and it is exactly then that the generated artwork IS their face.
   */
  userId?: string;
  name: string;
  avatarUrl?: string | null;
  /**
   * Their handle, where the list that built this knew it.
   *
   * The house roster does — it is a conversation membership carrying a whole
   * Profile. The AUDIENCE does not: it is built from LiveKit identities, and a
   * room learns who somebody is from their room token. So this is optional and
   * the roster panel degrades rather than inventing one — no link to a profile
   * it cannot name, and no follow control for somebody it cannot address.
   */
  username?: string;
  /** Same story: the file prints one, and only the roster half can supply it. */
  followerCount?: number;
  /** Speaking right now: the plate gets the live ring. */
  speaking?: boolean;
  /**
   * Their microphone, drawn as a glyph CENTRED ON THE PLATE — which is what
   * the render shows and what the properties alone did not: a small mic over
   * the portrait, slashed and dimmed when they are muted.
   */
  mic?: "on" | "muted";
  /**
   * The host muted them and their mic is still off (lib/host-mute.ts
   * `mutedByHost`). Everyone sees it; it goes the moment they unmute.
   */
  mutedByHost?: boolean;
  /** The host has invited them up and they have not answered. Drawn on the host's screen only. */
  invited?: boolean;
  /** Opens their person sheet. Absent for somebody with nothing to show. */
  onOpen?: () => void;
  /**
   * The file's 56×24 pair — a WINK and a FOLLOW — rendered by the profile
   * slice, because the room knows a username and not a Profile. The card owns
   * where they sit; the slot owns what they do. See `PersonQuickActions`.
   */
  actions?: React.ReactNode;
  /**
   * WHO THIS PERSON IS IN THE ROOM — node 1285:30456 draws a pill under the
   * name for two of the three, and nothing at all for an ordinary speaker.
   *
   * Absent rather than a `"speaker"` value on purpose: most people in a room
   * hold no office, and a badge reading SPEAKER under every face would make
   * the two that matter invisible by making the row look uniform.
   */
  role?: "host" | "moderator";
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
    THE CARD OPENS A PERSON, AND IT CANNOT BE A BUTTON TO DO IT.

    It used to be one, and `person.actions` — the wink and the follow — are
    buttons too, so every card in the room nested a button inside a button.
    That is invalid HTML: the browser does not build the tree the server sent,
    which is a hydration error, and before that it is a real behaviour bug —
    what a click on the inner control does is left to the browser to decide.

    So the card is a FIGURE, and the tap target is a transparent button laid
    over it. The actions are painted above that overlay and are ordinary
    siblings of it, not descendants, so each control is reached directly and
    neither swallows the other. This is the stretched-target pattern, and it is
    the only shape that keeps both a whole-card tap AND controls on the card.

    `ws-press` stays on the ROOT rather than moving to the overlay, and that is
    not laziness: `:active` matches an ancestor of the element being pressed,
    so the whole card still scales — including when the wink is what was
    pressed, which is exactly what it did as a button. The feel is unchanged.
  */
  return (
    <figure
      className={cn(
        // Fluid: fills its grid cell so a row holds at least 3 and grows with
        // the column's real width (see the @container grid below). A fixed 104
        // left the narrowest phones room for only 2.
        "relative flex w-full flex-col items-center gap-2",
        person.onOpen && "ws-press text-left"
      )}
    >
      {/* Covers the card and sits UNDER the badges (z-10 against their z-20),
          so a tap on the face opens the person and a tap on the wink winks.
          It carries its own name because the plate and the label it covers are
          no longer inside it. */}
      {person.onOpen && (
        <button
          type="button"
          onClick={person.onOpen}
          aria-label={`Open ${person.name}`}
          className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:rounded-4xl"
        />
      )}
      {/* The plate keeps the file's 104:113 ratio at ANY width (aspect-ratio,
          not a fixed 104). `pb-3` reserves the badge's 12px of overhang below
          the plate — only when a badge is drawn — so it never pushes the name
          down. */}
      <div className={cn("relative w-full", person.actions && "pb-3")}>
        <div
          className={cn(
            "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-white/10 transition-shadow md:aspect-104/113 md:rounded-4xl",
            person.speaking && "ring-2 ring-create",
            !person.speaking && person.invited && "ring-2 ring-white/60"
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
            // The USER, never the connection: see RoomPerson.userId.
            seed={person.userId ?? person.id}
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
                // The wash is the DESKTOP's reading of muted; the phone frame
                // draws the file's own slashed disc (1285:92964) with no wash.
                person.mic === "muted" && "md:bg-black/45"
              )}
            >
              {person.mic === "muted" ? (
                <>
                  <IconPlateMicOffSm className="h-14 w-14 md:hidden" />
                  <IconRoomMicOff className="hidden h-6 w-6 text-white/80 drop-shadow md:block" />
                </>
              ) : (
                /* The disc, its `white/10` fill and its glow are all INSIDE the
                   exported node, which is why it is 90 wide for a 40px disc —
                   the glow pads the art. Drawn at 90 so nothing is clipped.
                   The phone's is the 31.15 disc (1285:92949), padded to 71. */
                <>
                  <IconPlateMicSm className="h-14 w-14 md:hidden" />
                  <IconPlateMic className="hidden h-[90px] w-[90px] md:block" />
                </>
              )}
            </span>
          )}
        </div>

        {/* One word over the plate, never a colour alone: a slashed mic says
            the mic is off, this says who turned it off. */}
        {(person.mutedByHost || person.invited) && (
          <span className="absolute left-1/2 top-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white">
            {person.mutedByHost ? "Muted by host" : "Invited"}
          </span>
        )}

        {/*
          THE BADGE IS TWO BUTTONS, not a status chip: the file draws a wink
          and a follow, 24×24 each, in a 56×24 row straddling the plate's lower
          edge. They are filled by a slot — see `actions` — so the room can
          position them without knowing what a Profile is.
        */}
        {person.actions && (
          /* Straddles the plate's lower edge — 24px tall, centred on the plate
             bottom (12 above it, 12 below into the reserved `pb-3`). */
          <span className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2">
            {person.actions}
          </span>
        )}
      </div>

      {/* 169:13373 — `#FFFFFF` at 14/24, not the column's body grey. The
          phone's name (1285:92958) is 12/14.06. Two lines on the small mobile
          tiles so a real name like "Uchechukwu" is not clipped to "Uchechu…";
          the desktop keeps the file's single line. */}
      <span className="line-clamp-2 w-full text-center text-[12px] leading-3.5 text-white md:line-clamp-1 md:text-[14px] md:leading-6">
        {person.name}
      </span>

      {/*
        `Badge` — 16 tall at a 12 radius, the label 8/10.4 semibold at -0.04
        tracking, and the SAME hue at 10% behind text at full: HOST on #7E3BEB,
        MODERATOR on #CD640F. The file gives each a fixed width (30 and 58) for
        its own word; `w-fit` with the node's padding holds the shape for names
        of any length without pinning two magic numbers.

        The orange is the point of the pair. A moderator drawn in the accent
        would read as a second host, and the whole reason the pill exists is
        that the two are NOT the same office — one appointed the other and can
        take it back.
      */}
      {person.role && (
        <span
          className={cn(
            "inline-flex h-4 w-fit items-center rounded-[12px] px-2 text-[8px] font-semibold leading-[10.4px] tracking-[-0.04px]",
            person.role === "host"
              ? "bg-spotlight/10 text-spotlight"
              : "bg-moderator/10 text-moderator"
          )}
        >
          {person.role === "host" ? "HOST" : "MODERATOR"}
        </span>
      )}
    </figure>
  );
}

/**
 * A titled row of people.
 *
 * The heading carries a hairline that runs to the end of the row — the file
 * draws it on `House Members` and `Audience` but not on `Speakers`, which is
 * the top section and needs no separation from what is above it.
 */
/**
 * Two rows of six — what 369:9221 draws before it stops.
 *
 * Exported because the surfaces that decide whether to OFFER "View all" have to
 * agree with the grid that renders it: a section capped at twelve here and
 * gated at ten there would either hide people silently or offer a panel
 * identical to the grid above it.
 */
export const GRID_CELLS = 12;

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
  /*
    TWO ROWS, AND THE TILE IS ONE OF THE TWELVE CELLS.

    369:9221 draws six across and six again, with "View all" AS the last cell —
    so eleven people and the tile, not twelve people and a thirteenth thing.
    Without the slice the grid rendered every person it was given plus the tile,
    which on sixteen members was three ragged rows: the cap decided whether the
    tile APPEARED and truncated nothing.

    Only when there is somewhere to go. With no `onViewAll` the list is
    everything there is, and cutting it would hide people behind a control that
    is not there.
  */
  const shown = onViewAll ? people.slice(0, GRID_CELLS - 1) : people;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {/* 169:13359 — 16/24 at `white/50`. `text-body` is #d4d4d8, which is
            half again as bright and made every section heading compete with the
            names under it. */}
        <h2 className="shrink-0 text-[14px] leading-5 text-white/50 md:text-[16px] md:leading-6">{title}</h2>
        {rule && <span aria-hidden className="h-px flex-1 bg-white/25" />}
        {action}
      </div>

      {people.length === 0 ? (
        <p className="text-[14px] leading-6 text-meta">{empty}</p>
      ) : (
        /* AT LEAST 3 across, then more as the column widens — a CONTAINER grid,
           so it measures the people column's REAL width (not the viewport) and is
           right whether or not the chat sits beside it. The tiles are fluid, so 3
           fit even on the narrowest phone where the old fixed 104px left room for
           only 2. Capped at the file's 744 (6 × 104) so a wide column still draws
           the design's six rather than oversized tiles. */
        <div className="@container">
          <div className="grid grid-cols-4 gap-x-3 gap-y-4 @md:grid-cols-5 @md:gap-x-6 @xl:grid-cols-6 @xl:max-w-186">
            {shown.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
            {onViewAll && <ViewAllTile onClick={onViewAll} />}
          </div>
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
    /*
      ON A PHONE (1285:93069) the group is 104×113: the 48 disc, 8, then
      "View all" at 14/16.5, the pair centred in the 113. The desktop's disc
      sits in the tile's own 125 box with the label at 14/24 beneath.
    */
    <button
      type="button"
      onClick={onClick}
      className="ws-press flex w-full flex-col items-center justify-center gap-2 md:justify-start"
    >
      <span className="flex aspect-square w-full items-center justify-center md:aspect-104/113">
        {/* Node 169:13519, exported whole: the 48px disc, its `white/10` fill,
            its glow and the people glyph are one asset. Exported at 98 because
            the glow pads it — the phone's 1285:93072 is the same node. */}
        <IconViewAll className="h-auto w-full max-w-24.5 shrink-0" />
      </span>
      <span className="w-full truncate text-center text-[14px] leading-[16.5px] text-white/50 md:leading-6">
        View all
      </span>
    </button>
  );
}

"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { IconX } from "@/components/ui/icons";
import { formatCount } from "@/lib/format";
import type { RoomPerson } from "@/features/houses/components/room-people";
import { sq } from "@/lib/square-path";

/**
 * EVERYONE IN ONE SECTION — node 369:8741, what "View all" opens.
 *
 * The room's grids show two rows and stop; this is the rest. It takes the right
 * column while it is open, which is what the file draws and what makes it a
 * PANEL rather than a dialog: the stage keeps playing beside it, and closing
 * puts the chat back.
 *
 * ─── ONE PANEL, TWO LISTS ───────────────────────────────────────────────────
 * House Members and Audience are genuinely different sets — a member may not be
 * here, and somebody here may not be a member — but they are the same list of
 * PEOPLE with the same two actions, so one component takes the title and the
 * rows. A second copy is how the follow control ends up behaving differently
 * depending on which heading it sits under.
 *
 * ─── THE FILE'S NUMBERS ─────────────────────────────────────────────────────
 * The card is 347 at a 22 radius; rows are 315x54.5 at 12, over 3% white behind
 * a 10% hairline, on a 12 gap. In each: a 38 avatar ringed at 20%, the name at
 * Bold 12/16 nine to its right, the follower count under it at 11/16.5, and the
 * two actions held at the right edge.
 *
 * The COUNT is in the heading — "House Members (26)" — because a panel that
 * exists to show you everyone should say how many everyone is.
 */
export function RoomRosterPanel({
  title,
  people,
  onClose,
  actionsSlot,
}: {
  title: string;
  people: RoomPerson[];
  onClose: () => void;
  /** Follow + wink, from the profile slice — the room never holds a Profile. */
  actionsSlot?: (username: string) => React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="ws-panel flex h-full min-h-0 flex-col gap-4 rounded-[22px] p-4"
    >
      <header className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold leading-5 text-white">
          {title} ({formatCount(people.length)})
        </h2>
        {/* 24px at 4% white — the file's own dismiss, and the only way back to
            the chat column. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="ws-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-2.5 w-2.5" />
        </button>
      </header>

      {people.length === 0 ? (
        <p className="text-[13px] leading-5 text-meta">Nobody here yet.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <RowIdentity username={person.username}>
                <Avatar
                  name={person.name}
                  /* `userId`, NOT `id` — a LiveKit identity carries a role
                     suffix and a user id never does, so seeding on the identity
                     draws a different generated face here than the one the
                     grid, the sidebar and the topbar draw for the same person.
                     The interface says so; I seeded on `id` anyway. */
                  seed={person.userId ?? person.id}
                  src={person.avatarUrl}
                  size={38}
                  className="ring-1 ring-inset ring-white/20"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12px] font-bold leading-4 text-white">
                    {person.name}
                  </span>
                  {/*
                    The file prints a FOLLOWER COUNT here. A room learns who
                    somebody is from their room token and never holds a Profile,
                    so the count is only there when the list that fed this panel
                    carried one — the house roster does, the audience does not.
                    Absent, the handle takes the line rather than a fabricated
                    "0 followers".
                  */}
                  {/* A follower count when the list carried one, the handle
                      when it only knew that, and NOTHING when it knew neither
                      — an audience row would otherwise read "@undefined". */}
                  {(person.followerCount !== undefined || person.username) && (
                    <span className="truncate text-[11px] leading-[16.5px] text-white/40">
                      {person.followerCount === undefined
                        ? `@${person.username}`
                        : `${formatCount(person.followerCount)} followers`}
                    </span>
                  )}
                </span>
              </RowIdentity>
              {/* No handle, no controls. A follow or a wink has to be addressed
                  to somebody, and the audience half of this list is built from
                  room identities that carry no username — so the actions are
                  absent there rather than dead. */}
              {person.username && (
                <span className="shrink-0">{actionsSlot?.(person.username)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A link to their profile when the list knew their handle, a plain row when
    it did not — never a link to `/u/undefined`. */
function RowIdentity({
  username,
  children,
}: {
  username?: string;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 flex-1 items-center gap-[9px]";
  if (!username) return <span className={className}>{children}</span>;
  return (
    <Link href={sq(`/u/${username}`)} prefetch={false} className={className}>
      {children}
    </Link>
  );
}

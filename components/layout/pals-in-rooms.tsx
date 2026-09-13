"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useFollowingRooms } from "@/features/streams";
import { housePath } from "@/features/houses";

/**
 * YOUR PEOPLE, IN A ROOM, RIGHT NOW.
 *
 * The one thing a people page can say that a timeline structurally cannot:
 * not "here is what your friends posted" but "your friends are talking, and
 * you can be in there in one tap".
 *
 * ─── THE EMPTY STATE IS NO RAIL ──────────────────────────────────────────────
 * It renders NOTHING when nobody is around — zero height, no placeholder, no
 * "nobody's here yet" card. A card announcing emptiness is an advertisement
 * that the product is dead, and on a young graph this rail is empty most of
 * the time. The page above and below it must read as complete without it.
 *
 * The same silence covers a route that is not deployed (404 -> `unavailable`)
 * and a signed-out reader, who has no "your people" to ask about. One empty
 * state, three causes, and none of them says anything.
 *
 * ─── THE SERVICE ALREADY DID THE PRIVACY WORK ────────────────────────────────
 * `GET /me/following/rooms` counts only people whose "Visibility on Space" is
 * on, never a room's host, and only rooms this reader could already see (a
 * private room only to its members). So every face here is one the reader was
 * already allowed to see, in a room they can already enter. Nothing is
 * inferred client-side and no face is filtered back out — filtering here would
 * mean the count and the faces disagreed.
 *
 * A room is entered, never "requested": tapping is joining, which is the
 * drop-in grammar the rooms already use.
 */
export function PalsInRooms() {
  const rooms = useFollowingRooms();

  // Silence covers every absence: not deployed, signed out, still loading, or
  // genuinely nobody around. See the header.
  if (rooms.unavailable || rooms.isPending || rooms.isError) return null;
  const items = (rooms.data ?? []).filter((room) => room.participants.length > 0);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="pals-in-rooms" className="mb-[64px]">
      <h2 id="pals-in-rooms" className="mb-3 text-[15px] font-bold text-white">
        In a room now
      </h2>

      <div className="flex gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((room) => {
          // Three faces, then a count. Four avatars is a crowd; three and a
          // number is a sentence.
          const faces = room.participants.slice(0, 3);
          const extra = room.participants.length - faces.length;
          return (
            <Link
              key={room.id}
              href={housePath(room.id)}
              className="ws-card ws-press flex w-[232px] shrink-0 flex-col gap-2 p-3"
            >
              <span className="flex items-center gap-1.5">
                <span className="ws-live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff0b0b]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff0b0b]">
                  Live
                </span>
                {/* `viewerCount` is nullable and absent on list rows — an
                    absent count renders nothing rather than a fabricated 0. */}
                {room.viewerCount !== null && (
                  <span className="tnum ml-auto text-[11px] text-meta">
                    {room.viewerCount} listening
                  </span>
                )}
              </span>

              <span className="line-clamp-2 text-[14px] font-semibold leading-5 text-white">
                {room.title}
              </span>

              <span className="mt-auto flex items-center gap-2">
                <span className="flex -space-x-2">
                  {faces.map((person) => (
                    <Avatar
                      key={person.id}
                      name={person.displayName || person.username || "Someone"}
                      seed={person.id}
                      src={person.avatarUrl}
                      size={22}
                      className="ring-2 ring-[#121214]"
                    />
                  ))}
                </span>
                <span className="min-w-0 truncate text-[12px] text-meta">
                  {faces.length === 1
                    ? (faces[0]!.displayName || faces[0]!.username || "Someone")
                    : `${faces.length}${extra > 0 ? ` +${extra}` : ""} of your pals`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

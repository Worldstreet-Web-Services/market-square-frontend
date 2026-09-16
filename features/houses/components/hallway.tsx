"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { housePath } from "@/features/houses/lib/house";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import type { Stream } from "@/features/streams/lib/types";
import { sq } from "@/lib/square-path";

/**
 * The hallway: the rooms open right now, at the top of Home.
 *
 * Home used to open on a composer and a feed, which is a product about what
 * people SAID. The thing 2.0 is actually for is what people are saying right
 * now, out loud, in a room you can walk into — so that goes first and the feed
 * reads underneath it.
 *
 * A list, not a grid of tiles. Discord shipped a browsable directory of live
 * stages and killed it inside six months: a tile has to fill itself with
 * something, and in an audio product the only thing it can fill itself with is
 * decoration. What makes a row worth tapping is the HOST'S FACE and the topic
 * — you go in for who is talking, not for a thumbnail.
 *
 * THREE rooms, and a door to the rest. The hallway is an invitation, not the
 * directory; `/gist-rooms` is the directory, and it is one tap away. A section
 * that can grow without limit at the top of Home would push the feed off the
 * screen on a busy evening.
 *
 * Renders NOTHING at all when no house is open. An empty state here would be
 * a permanent apology at the top of the home page for a feature that has not
 * started yet — the street carries the invitation to open one, which is the
 * right place for it.
 */

/*
  FIVE, not three.

  Three was sized for a strip under other furniture. With the section pills,
  the arena banner and the Live lane gone, the hallway IS the top of Home —
  and a hallway showing three doors when eight are open is a summary of a
  summary. Five fills the first screen on a phone without pushing the feed
  out of reach.
*/
const SHOWN = 5;

export function Hallway() {
  // Asked for by kind rather than filtered here: the enum-validated
  // `category=house` and the client-side `isHouse` both existed only because
  // the API could not say "rooms". It can now.
  const live = useStreamList("live", [], undefined, "room");
  const houses = live.data?.items ?? [];

  if (live.isPending) {
    return (
      <section className="ws-hair border-b px-4 py-4">
        <Skeleton className="h-4 w-24" />
        <div className="mt-3 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    );
  }

  // A failed load stays silent: an error banner at the top of Home makes a
  // working page look broken, and the feed below is unaffected.
  if (live.isError) return null;

  /*
    An empty hallway now INVITES rather than disappearing.

    While the hallway was a strip under other furniture, rendering nothing on a
    quiet evening was right — an empty state there was a permanent apology. Now
    that it leads the page, vanishing leaves Home opening on a story rail and a
    feed, which is the product this one is trying not to be. On the day nobody
    has opened a house, the most useful thing Home can say is: you could.
  */
  if (houses.length === 0) {
    return (
      <section className="ws-hair border-b px-4 py-5">
        <p className="text-[15px] font-bold leading-5 text-heading">No gist rooms open</p>
        <p className="ws-meta mt-1 normal-case tracking-normal">
          A gist room is where people talk. Open one and name what it is about — anyone can
          walk in.
        </p>
        <Link
          href={sq("/gist-rooms")}
          className="ws-press mt-3 inline-flex items-center rounded-full border border-white/12 px-4 py-2 text-[13px] font-bold text-body transition-colors hover:bg-white/6"
        >
          Open a gist room
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="hallway-heading" className="ws-hair border-b">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 id="hallway-heading" className="ws-meta flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            {/*
              The purple ramp, NOT --color-live.

              Live red means a broadcast is happening, and a house is not a
              broadcast — it is a room with people talking in it. Borrowing the
              token would teach a reader that the two are the same thing, which
              is the confusion 2.0 exists to remove. `--color-create` is the
              light stop of the one chromatic family the product has, and it is
              the stop that reads on black at this size.
            */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-create opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-create" />
          </span>
          Open now
        </h2>
        {houses.length > SHOWN && (
          <Link
            href={sq("/gist-rooms")}
            className="text-[12px] font-bold text-create transition-opacity hover:opacity-80"
          >
            See all {houses.length}
          </Link>
        )}
      </div>

      <ul className="list-none">
        {houses.slice(0, SHOWN).map((stream) => (
          <li key={stream.id}>
            <HallwayRow stream={stream} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HallwayRow({ stream }: { stream: Stream }) {
  const host = stream.owner;
  return (
    <Link
      href={housePath(stream.id)}
      className="ws-row flex items-center gap-3 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <Avatar
        name={host?.displayName ?? "Host"}
        seed={stream.ownerId}
        src={host?.avatarUrl}
        size={44}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-5 text-heading">{stream.title}</p>
        {/* Only what the LIST payload carries. `viewerCount` is nullable by
            contract precisely so "no count available" cannot be drawn as a
            confident 0, so neither it nor the host is invented. */}
        {(host || typeof stream.viewerCount === "number") && (
          <p className="ws-meta mt-0.5 normal-case tracking-normal">
            {host?.displayName}
            {host && typeof stream.viewerCount === "number" && " · "}
            {typeof stream.viewerCount === "number" && (
              <span className="tnum">
                {stream.viewerCount} {stream.viewerCount === 1 ? "listening" : "listening"}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

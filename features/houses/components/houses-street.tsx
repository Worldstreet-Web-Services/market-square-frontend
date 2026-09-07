"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button, Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconPlus } from "@/components/ui/icons";
import { useGate } from "@/hooks/use-gate";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import type { Stream } from "@/features/streams/lib/types";
import { OpenHouseSheet } from "@/features/houses/components/open-house-sheet";
import { PorchSheet } from "@/features/houses/components/porch-sheet";
import { housePath } from "@/features/houses/lib/house";

/**
 * The street — node 407:17074, "Happening Now!".
 *
 * A two-column grid of the SAME card the home rail carries (`GistRoomCard`,
 * 225:3873), 24 apart, under a 24/31.2 heading and a 14/20 line at 50% white.
 *
 * ─── THIS USED TO ARGUE AGAINST A GRID, AND THE ARGUMENT WAS NOT WRONG ──────
 * The note here said: not a grid of live tiles, because Discord shipped exactly
 * that, found it did not connect people to audio they cared about, and killed
 * it inside six months — and because a tile grid has to fill itself with
 * something, which in an audio product can only be decoration.
 *
 * The design answers that rather than ignoring it. These are not tiles: each
 * cell is the invite card, carrying the room's title, its topics, who is
 * already inside and a Join control — the same object that works in a thread,
 * at the same size. There is no artwork in it and nothing to pad it out. What
 * the grid buys is that a page of rooms reads as a page of rooms instead of a
 * column you scroll past four at a time.
 *
 * `HouseRow` stays, for the rooms that have not opened yet. The file draws only
 * the live grid, and a scheduled room has no roster to show and nothing to join
 * — a card promising both would be the dead promise the card was built to
 * avoid.
 */
function HouseRow({ stream, onOpen }: { stream: Stream; onOpen: () => void }) {
  const host = stream.owner;
  return (
    <Link
      href={housePath(stream.id)}
      onClick={(event) => {
        // The PORCH. Tapping a house from the street opens the threshold
        // first, before any connection is made — before a room, before this
        // person appears in anybody's audience band. In a voice product where
        // joining makes you visible to a room of strangers, that pause is the
        // whole difference between walking in and being pushed in.
        //
        // Still a real <Link>: a direct URL, a middle-click and a shared link
        // all go straight in, which is correct — somebody who was sent a link
        // has already decided.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
      className="ws-row flex items-start gap-3 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      <Avatar
        name={host?.displayName ?? "Host"}
        seed={stream.ownerId}
        src={host?.avatarUrl}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-5 text-heading">{stream.title}</p>
        {/* Only what the LIST payload actually carries. `owner` and
            `viewerCount` are absent on list rows by contract — the schema
            keeps viewerCount nullable precisely so "no count available" cannot
            be rendered as a confident 0 — so neither is invented here, and
            with neither available the line is absent rather than repeating the
            section header back at the reader. The porch fetches the detail. */}
        {(host || typeof stream.viewerCount === "number") && (
          <p className="ws-meta mt-1 normal-case tracking-normal">
            {host?.displayName}
            {host && typeof stream.viewerCount === "number" && " · "}
            {typeof stream.viewerCount === "number" && (
              <>
                <span className="tnum">{stream.viewerCount}</span> inside
              </>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

export function HousesStreet({
  roomCardSlot,
}: {
  /**
   * The invite card for one open room, composed from OUTSIDE this slice.
   *
   * `GistRoomCard` reads the room (streams), the topic vocabulary (discovery)
   * and the group's roster (messages), and slices never import each other — so
   * it is assembled in `components/layout` and handed down, exactly as the home
   * rail already does. Absent, the grid renders empty cells rather than
   * inventing a second card.
   */
  roomCardSlot?: (stream: Stream) => React.ReactNode;
} = {}) {
  const gate = useGate();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [porch, setPorch] = useState<Stream | null>(null);
  /*
    Rooms, asked for by KIND.

    This used to read the whole live list and filter with `isHouse`, on a note
    saying `category=house` 400d against the enum. The enum has carried
    `house` for a while, and `kind=room` says the thing more directly — the
    street wants rooms, not one taxonomy value that happens to mean rooms.

    Filtering here was also wrong on its own terms: a page of live streams is
    mostly broadcasts, so the street showed whatever handful of rooms survived
    ONE page rather than a page of rooms.
  */
  const live = useStreamList("live", [], undefined, "room");
  const scheduled = useStreamList("scheduled", [], undefined, "room");

  const liveHouses = live.data?.items ?? [];
  const scheduledHouses = scheduled.data?.items ?? [];

  return (
    <div className="w-full px-8">
      {/*
        NODE 407:17283 — the page's own head, 32 in from the edge and 40 down,
        two lines on a 4 gap: "Happening Now!" at 24/31.2 and the invitation
        under it at 14/20 in 50% white.

        It replaced a `ColumnHeader` reading "Gist rooms" over "Rooms you can
        talk in. Voice only." — the route's name and a definition. The file
        heads the page with what is true right now instead, which is the reason
        to be on it.

        The create action stays in the head. The file draws it as a floating
        circle at the page's bottom-right corner; the shell already owns exactly
        one of those and putting a second here would be two purple circles on
        one screen, which is the thing the compose rules exist to prevent.
      */}
      <header className="flex items-start justify-between gap-4 pt-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-medium leading-[31.2px] text-white">
            Happening Now!
          </h1>
          <p className="text-[14px] leading-5 text-white/50">
            Join the ongoing conversations and meet new people with similar interests.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => gate(() => setOpening(true))}>
          <IconPlus className="h-4 w-4" />
          Open a gist room
        </Button>
      </header>

      {live.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6 text-grey-600" />
        </div>
      ) : live.isError ? (
        <div className="px-4 py-8">
          <ErrorState
            error={live.error}
            fallback="Couldn't load the gist rooms."
            onRetry={() => live.refetch()}
          />
        </div>
      ) : liveHouses.length === 0 && scheduledHouses.length === 0 ? (
        <div className="px-4 py-10">
          <EmptyState
            glyph="◇"
            title="No gist rooms open"
            body="A gist room is where people talk. Open one and name what it is about — anyone can walk in."
            action={
              <Button size="sm" onClick={() => gate(() => setOpening(true))}>
                Open a gist room
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {liveHouses.length > 0 && (
            /* Two columns 24 apart — the file's grid is 742 wide holding 359s.
               One column below `md`, where two 359s cannot both fit and the
               card would have to shrink past the point its title wraps
               sensibly. */
            <section aria-label="Gist rooms open now" className="grid gap-6 pt-6 md:grid-cols-2">
              {liveHouses.map((stream) => (
                <div key={stream.id}>{roomCardSlot?.(stream)}</div>
              ))}
            </section>
          )}
          {scheduledHouses.length > 0 && (
            <section>
              <h2 className="ws-meta pb-2 pt-8">Not open yet</h2>
              {scheduledHouses.map((stream) => (
                // A house that has not opened has nothing to listen to yet, so
                // there is no threshold to pause on — go straight to the page,
                // which says so.
                <HouseRow
                  key={stream.id}
                  stream={stream}
                  onOpen={() => router.push(housePath(stream.id))}
                />
              ))}
            </section>
          )}
        </>
      )}

      {porch && (
        <PorchSheet
          stream={porch}
          open
          onClose={() => setPorch(null)}
          entering={false}
          onEnter={() => router.push(housePath(porch.id))}
        />
      )}

      <OpenHouseSheet open={opening} onClose={() => setOpening(false)} />
    </div>
  );
}

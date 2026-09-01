"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button, Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconPlus } from "@/components/ui/icons";
import { ColumnHeader } from "@/components/layout/column-header";
import { useGate } from "@/hooks/use-gate";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import type { Stream } from "@/features/streams/lib/types";
import { OpenHouseSheet } from "@/features/houses/components/open-house-sheet";
import { PorchSheet } from "@/features/houses/components/porch-sheet";
import { housePath, isHouse } from "@/features/houses/lib/house";

/**
 * The street: a LIST of houses, and deliberately nothing more.
 *
 * Not a grid of live tiles. Discord shipped exactly that — a browsable
 * directory of live stages — found it did not connect people to audio they
 * cared about, and killed it inside six months. A tile grid also has to fill
 * itself with something, and in an audio product the only thing it can fill
 * itself with is decoration.
 *
 * So: `ws-row`s, a topic, who is hosting, how many people are in there. The
 * street is a list. The product is the room.
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

export function HousesStreet() {
  const gate = useGate();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [porch, setPorch] = useState<Stream | null>(null);
  /**
   * BACKEND B5: `GET /streams?category=` is server-side enum-validated
   * (worldstreet|music|podcast|gaming|other), so asking for `category=house`
   * 400s until the enum is extended. Until then the street reads the live list
   * — the SAME query key the Live hub uses, so this is one cache and one poll
   * — and filters client-side. DELETE the filter and pass the category once
   * the enum ships.
   */
  const live = useStreamList("live");
  const scheduled = useStreamList("scheduled");

  const liveHouses = (live.data?.items ?? []).filter(isHouse);
  const scheduledHouses = (scheduled.data?.items ?? []).filter(isHouse);

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <ColumnHeader
        title="Gist rooms"
        subtitle="Rooms you can talk in. Voice only."
        action={
          <Button size="sm" onClick={() => gate(() => setOpening(true))}>
            <IconPlus className="h-4 w-4" />
            Open a gist room
          </Button>
        }
      />

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
            <section>
              <h2 className="ws-meta px-4 pb-2 pt-4">Open now</h2>
              {liveHouses.map((stream) => (
                <HouseRow key={stream.id} stream={stream} onOpen={() => setPorch(stream)} />
              ))}
            </section>
          )}
          {scheduledHouses.length > 0 && (
            <section>
              <h2 className="ws-meta px-4 pb-2 pt-5">Not open yet</h2>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { EmptyPanel, EmptyPanelAction } from "@/components/ui/empty-panel";
import { IconVoiceMode } from "@/components/ui/room-icons";
import { useGate } from "@/hooks/use-gate";
import { useQueryParam } from "@/hooks/use-query-param";
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
 */

export function HousesStreet({
  roomCardSlot,
  tabsSlot,
  createSlot,
  upcomingCardSlot,
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
  /**
   * The topic row (407:17261), also composed from outside.
   *
   * It is `TopicTabs` — the SAME row and the same node family Home heads its
   * timeline with — and it renders the shared vocabulary `GET /topics` serves,
   * both of which live in slices this one may not import. The selection is
   * owned here, because it is what the room query is keyed on.
   */
  tabsSlot?: (state: {
    active: string | null;
    onSelect: (key: string | null) => void;
  }) => React.ReactNode;
  /**
   * The corner circle (407:17286), given the handler that opens the sheet.
   *
   * `CreateFab` is the composition layer's, like everything else here — a
   * feature reaching up into `components/layout` is the same violation as
   * reaching sideways into another slice.
   */
  createSlot?: (onOpen: () => void) => React.ReactNode;
  /**
   * The card for a room that has not opened yet (1295:140164) — a different
   * object from the live invite card, and composed in from outside for the
   * same reason: it reads the topic vocabulary and shares a link.
   */
  upcomingCardSlot?: (stream: Stream) => React.ReactNode;
} = {}) {
  const gate = useGate();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  /*
    `?open=1` OPENS THE SHEET ON ARRIVAL.

    The shell's "Start Gistroom" pointed at `/studio` — the CREATOR studio,
    which is where you go live, not where you open a room. A gist room needs
    no creator role and no house to belong to: "anyone can walk in" is what the
    empty state on this very page promises. So the button lands here and starts
    one, which is what its label says it does.

    `useQueryParam`, never `useSearchParams`: that one forces a Suspense
    boundary and delays hydration of this subtree. Fired ONCE via a ref rather
    than on every render the param survives, so dismissing the sheet does not
    immediately reopen it while the URL still carries the flag.
  */
  const openParam = useQueryParam("open");
  const autoOpened = useRef(false);
  useEffect(() => {
    if (openParam !== "1" || autoOpened.current) return;
    autoOpened.current = true;
    gate(() => setOpening(true));
  }, [openParam, gate]);
  const [porch, setPorch] = useState<Stream | null>(null);
  /** null is "For you" — every room, unfiltered. */
  const [topic, setTopic] = useState<string | null>(null);
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
  /*
    THE TOPIC NARROWS THE QUERY, SERVER-SIDE.

    `GET /streams?topics=` is on the contract, so choosing a topic asks for a
    page of rooms about it rather than filtering the page we happen to hold —
    which would leave a topic looking empty because its rooms were on page two.
    In the query key, so switching topics starts a new list.
  */
  const topicFilter = topic ? [topic] : [];
  const live = useStreamList("live", topicFilter, undefined, "room");
  const scheduled = useStreamList("scheduled", topicFilter, undefined, "room");

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
      <header className="flex flex-col gap-1 pt-10">
        {/*
          TWO-TONE, and the file says so per CHARACTER — `characterStyleOverrides`
          splits "Happening " from "Now!". Both runs override the text node's own
          500 to Geist 600, so the heading is SemiBold throughout; only the fill
          differs, and "Now!" carries a left-to-right gradient whose first stop
          sits at 84.6% — so it is `--color-create` almost all the way across and
          only darkens into #5F3C97 over the last sixth.

          Reading the node's own `style` alone gives a flat white 500 heading,
          which is what shipped first and is why the purple was missing.
        */}
        <h1 className="text-[24px] font-semibold leading-[31.2px] text-white">
          Happening{" "}
          <span className="bg-[linear-gradient(90deg,var(--color-create)_84.6%,#5F3C97_100%)] bg-clip-text text-transparent">
            Now!
          </span>
        </h1>
        <p className="text-[14px] leading-5 text-white/50">
          Join the ongoing conversations and meet new people with similar interests.
        </p>
      </header>

      {/* The row is full-bleed — the file runs it 924 wide across an 806 page,
          past the 32 the header sits in — so it is pulled out of the padding
          and given it back as its own inset. */}
      {tabsSlot && (
        <div className="-mx-8 mt-6 px-8">
          {tabsSlot({ active: topic, onSelect: setTopic })}
        </div>
      )}

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
        /*
          THE DESIGNER'S EMPTY STATE — node 543:45867, which they named for this
          page specifically.

          It replaced two earlier answers of mine. First the small `EmptyState`,
          a lozenge over two short lines, which is sized to sit INSIDE a column
          and so read as a gap between sections on a page that has nothing else
          on it. Then chat's `PanePlaceholder`, which was the right SHAPE and
          the wrong one for here: 543:45867 is its own component — a 120
          illustration rather than 200, a 20/23.44 title rather than 24/32, and
          a primary action built into it.

          The action is "Start Gistroom", worded as the rail's button is, on the
          same waveform the Join control carries. The copy is ours: the node
          reads "No badges earned yet" because the designer built it from the
          badges screen, and it is the component being reused, not the words.
        */
        <EmptyPanel
          title={topic ? "No rooms on this topic" : "No gist rooms open"}
          body={
            topic
              ? "Nobody is talking about this right now. Try another topic, or open the room yourself."
              : "A gist room is where people talk. Open one and name what it is about — anyone can walk in."
          }
          action={
            <EmptyPanelAction
              onClick={() => gate(() => setOpening(true))}
              icon={<IconVoiceMode className="h-6 w-6" />}
            >
              Start Gistroom
            </EmptyPanelAction>
          }
        />
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
            /*
              UPCOMING ROOMS ARE THE SAME OBJECT AS OPEN ONES, so they are the
              same card in the same two-column grid. They used to be bare rows
              under a small grey label, which read as a different kind of thing
              entirely. The card draws its own not-open-yet state and names the
              time, so nothing here has to explain it.
            */
            <section aria-label="Gist rooms opening later" className="pt-10">
              <h2 className="text-[20px] font-semibold leading-[26px] text-white">
                Upcoming{" "}
                <span className="bg-[linear-gradient(90deg,var(--color-create)_84.6%,#5F3C97_100%)] bg-clip-text text-transparent">
                  Gistrooms
                </span>
              </h2>
              <p className="pt-1 text-[14px] leading-5 text-white/50">
                Rooms with a time on them. Open the page to see what it is about.
              </p>
              <div className="grid gap-6 pt-6 md:grid-cols-2">
                {scheduledHouses.map((stream) => (
                  <div key={stream.id}>{(upcomingCardSlot ?? roomCardSlot)?.(stream)}</div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* The file's own create control — 407:17286, the same 52.79 circle on the
          same ramp the shell uses, in the same corner. It is here rather than in
          the header because the file draws no button up there, and the shell's
          circle is suppressed on this route so there is exactly one. */}
      {createSlot?.(() => gate(() => setOpening(true)))}

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

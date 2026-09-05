"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AUDIENCE_PAGE, type AudienceBand, type AudienceMember } from "@/features/houses/hooks/use-audience";

/**
 * The audience: the brief's core loop, rendered as PEOPLE.
 *
 *   "Tapping any face opens that person's profile — this is the main
 *    discovery path."
 *
 * Three rules hold here and none of them is negotiable:
 *
 *   1. It NEVER collapses to a number. Not at any scroll depth, not at any
 *      size. "+412" is where this product dies: the whole premise is that a
 *      house is a room with people in it, and a count is the one rendering
 *      that says it is not.
 *   2. Every face is tappable, all the way down — a link when we know the
 *      handle (backend B1), a button onto what we do know when we do not.
 *      Never an inert div.
 *   3. Joins and leaves are SILENT. No toast, no announcement, no join line.
 *      Discord silences stage audiences on purpose, and a three-hundred-person
 *      room with polite announcements is unusable with a screen reader.
 *
 * The list is capped at 240 cells with a "Show 240 more" row, which is a cap
 * rather than a collapse — no windowing library, no new dependency, and no
 * number standing in for people.
 */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function Cell({ member, onOpen }: { member: AudienceMember; onOpen: () => void }) {
  const inner = (
    <>
      <Avatar
        name={member.name}
        seed={member.meta?.username ?? member.userId}
        src={member.meta?.avatarUrl}
        size={44}
      />
      <span className="mt-1.5 w-full truncate text-center text-[10px] leading-3 text-meta">
        {member.isLocal ? "You" : member.name}
      </span>
    </>
  );
  const className = cn(
    "ws-press flex w-full flex-col items-center rounded-xl py-1",
    FOCUS
  );

  // A real link when the handle is known, so it opens in a new tab, gets a
  // preview on hover, and is copyable — everything a <div> with an onClick is
  // not. Falls back to a button onto whatever we do know, never to nothing.
  return member.meta?.username ? (
    <Link href={`/u/${member.meta.username}`} className={className} onClick={(event) => {
      // In-room, the sheet is the right surface: the discovery loop is "listen
      // to someone, look them up, keep listening", and navigating away cuts
      // the audio. Cmd/ctrl-click and middle-click still follow the href.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onOpen();
    }}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={className}>
      {inner}
    </button>
  );
}

export function AudienceBands({
  bands,
  total,
  onOpen,
  emptyAction,
}: {
  bands: readonly AudienceBand[];
  total: number;
  onOpen: (member: AudienceMember) => void;
  /** What the room says when the host is alone. See §4.5 — the launch-day state. */
  emptyAction: React.ReactNode;
}) {
  const [cap, setCap] = useState(AUDIENCE_PAGE);
  let drawn = 0;

  return (
    <section>
      <h2 className="ws-meta px-4 pb-2 pt-5">
        Audience · <span className="tnum">{total}</span>
      </h2>
      {/* Present in the DOM from first paint even when empty: a live region
          added to the page later never announces, and an empty <ul> costs
          nothing. */}
      <ul aria-label="Audience" aria-live="off" className="contents">
        {total === 0 ? (
          <li className="block px-4 py-6 text-center">{emptyAction}</li>
        ) : (
          bands.map((band, index) => {
            const room = Math.max(0, cap - drawn);
            const members = band.members.slice(0, room);
            drawn += members.length;
            if (members.length === 0) return null;
            return (
              <li key={band.title ?? `band-${index}`} className="block">
                {/* Never an empty band header, and never an invented band. */}
                {band.title && <h3 className="ws-meta px-4 pb-2 pt-4">{band.title}</h3>}
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-x-2 gap-y-4 px-4 pb-2">
                  {members.map((member) => (
                    <li key={member.identity}>
                      <Cell member={member} onOpen={() => onOpen(member)} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })
        )}
      </ul>
      {total > cap && (
        <div className="ws-row px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCap((current) => current + AUDIENCE_PAGE)}
          >
            {/* A cap being raised, not a crowd being summarised. */}
            Show {Math.min(AUDIENCE_PAGE, total - cap)} more
          </Button>
        </div>
      )}
    </section>
  );
}

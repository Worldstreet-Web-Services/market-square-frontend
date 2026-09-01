"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { EmptySeat, OccupiedSeat } from "@/features/houses/components/seat";
import type { HouseAudio } from "@/features/houses/hooks/use-house-audio";
import { parseParticipantMeta, participantName } from "@/features/houses/lib/participant-meta";
import { SEAT_POSITIONS, nextFreeSeat, type Seating } from "@/features/houses/lib/seating";
import type { StageSlot } from "@/features/streams/lib/stage";

/**
 * The table.
 *
 * Eight equal places on one circle. Equal because the direction is a table
 * rather than a stage: the host sits at twelve o'clock, but their chair is the
 * same size as everyone else's, and a guest who is handed the floor is not
 * promoted into a bigger box — they simply sit down.
 *
 * NOTHING here reorders. Not by audio level, not by who joined last, not by
 * who is loudest. A seat is a PLACE, and a place that moves is not a place;
 * the whole reason Clubhouse's flat grid was hard to read is that it churned
 * under the thing you were trying to look at. The one surface in this room
 * that responds to audio ordering is the talking line, which is a strip of
 * text — see table-edge.tsx.
 *
 * `SEAT_POSITIONS` is the swappable layer. If SEAT_COUNT ever moves off eight,
 * this file changes and `seat.tsx` does not.
 */
export function SeatRing({
  seating,
  audio,
  pending,
  /** Empty seats stop offering anything when the host closed requests, or the room is full. */
  seatsDisabled,
  askLabel,
  mutedForMe,
  onAsk,
  onOpenPerson,
}: {
  seating: Seating;
  audio: HouseAudio;
  pending: number;
  seatsDisabled: boolean;
  askLabel: string;
  mutedForMe: ReadonlySet<string>;
  onAsk: () => void;
  onOpenPerson: (slot: StageSlot) => void;
}) {
  // ONE chair carries the hand, not all of them: the pending state is a fact
  // about the ROOM ("somebody may be seated next"), and painting every free
  // chair with a hand would read as several people waiting. The rule lives in
  // lib/seating.ts so the tray and the ring cannot disagree about which chair
  // the next person gets.
  const nextFree = nextFreeSeat(seating);

  /*
    Whether the room has finished arriving.

    Seats mount and unmount as people sit and stand, so a seat cannot tell the
    difference between "somebody just took this chair" and "this chair was
    already taken when I opened the room" — both look like a fresh mount to it.
    The ring can: it knows when IT arrived. Everything that mounts in the first
    frame was already here; everything after that is somebody sitting down.

    A frame rather than a timer: one paint is exactly the window in which the
    initial seats mount, and a duration would be a guess that breaks on a slow
    device.
  */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ul
      aria-label="Speakers"
      className="relative mx-auto aspect-square w-full max-w-[340px] list-none"
    >
      {seating.seats.map((seat) => {
        const point = SEAT_POSITIONS[seat.index];
        return (
          <li
            key={seat.index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {seat.slot ? (
              <OccupiedSeat
                seat={seat}
                audio={audio}
                mutedForMe={mutedForMe.has(seat.slot.identity)}
                onOpen={() => onOpenPerson(seat.slot!)}
                roomSettled={settled}
              />
            ) : (
              <EmptySeat
                pending={nextFree?.index === seat.index ? pending : 0}
                offered={nextFree?.index === seat.index}
                disabled={seatsDisabled || seat.index === 0}
                onAsk={onAsk}
                label={
                  seat.index === 0
                    ? "The host's seat, empty"
                    : nextFree?.index === seat.index && pending > 0
                      ? `Free seat. ${pending} ${pending === 1 ? "person is" : "people are"} asking to speak`
                      : askLabel
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Publishers the ring cannot hold.
 *
 * It should never happen — the host tray refuses to approve into a full table
 * — but the backend does not enforce a seat count, so it can. A speaker the
 * room can hear and cannot see is worse than a row nobody designed, so this is
 * plain and loud rather than absent.
 */
export function OverflowRow({
  overflow,
  onOpenPerson,
}: {
  overflow: readonly StageSlot[];
  onOpenPerson: (slot: StageSlot) => void;
}) {
  if (overflow.length === 0) return null;
  return (
    <section className="ws-row px-4 py-3">
      <h2 className="ws-meta">Also speaking</h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {overflow.map((slot) => {
          const meta = parseParticipantMeta(slot.metadata);
          const name = participantName(slot.name) ?? slot.name;
          return (
            <li key={slot.identity}>
              <button
                type="button"
                onClick={() => onOpenPerson(slot)}
                className="ws-press flex items-center gap-2 rounded-full py-0.5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Avatar
                  name={name}
                  seed={meta?.username ?? slot.identity}
                  src={meta?.avatarUrl}
                  size={32}
                />
                <span className="max-w-[120px] truncate text-[12px] font-semibold text-body">
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

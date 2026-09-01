"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ChipShell } from "@/components/ui/badge";
import { IconHand, IconVolume } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SeatMeter } from "@/features/houses/components/seat-meter";
import type { HouseAudio } from "@/features/houses/hooks/use-house-audio";
import { parseParticipantMeta, participantName } from "@/features/houses/lib/participant-meta";
import { SEAT_AVATAR, type Seat as SeatModel } from "@/features/houses/lib/seating";

/**
 * One place at the table.
 *
 * It deliberately does not know it is in a ring. `seat-ring.tsx` owns the
 * positions; this owns what a seat LOOKS like. That split is what makes
 * SEAT_COUNT a flag rather than a rewrite — moving to a two-across grid at a
 * higher count changes one file and none of this one.
 *
 * The three states are told apart without relying on hue, because there is
 * barely any hue here to rely on:
 *
 *   occupied — an avatar, a name, a live level arc
 *   empty    — a dashed hairline circle, tappable, the invitation
 *   pending  — the same circle gone SOLID, carrying a hand glyph and a count
 *
 * What a seat never shows is WHO is waiting. Rendering a named person's raised
 * hand in front of the whole room is the "I'm in my bedroom and I don't want
 * to be seen" anxiety in a new costume, and it makes being passed over a
 * public event.
 */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export function OccupiedSeat({
  seat,
  audio,
  mutedForMe,
  onOpen,
}: {
  seat: SeatModel;
  audio: HouseAudio;
  mutedForMe: boolean;
  onOpen: () => void;
}) {
  const slot = seat.slot!;
  const meta = parseParticipantMeta(slot.metadata);
  const name = participantName(slot.name) ?? slot.name;

  /**
   * The lift: this seat was empty on the previous render and is not now.
   *
   * Held in a ref rather than derived from a prop, because the animation is
   * about a TRANSITION and props only ever describe a state. It fires once and
   * then never again for this occupant, so a re-render — a level tick, a name
   * change, a mute — cannot replay it.
   */
  const [landing, setLanding] = useState(false);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current === slot.identity) return;
    const first = seen.current === null;
    seen.current = slot.identity;
    // Somebody already seated when we walked in did not just arrive. Animating
    // the whole ring on join would make an ordinary room look like an event.
    if (first) return;
    setLanding(true);
    const timer = setTimeout(() => setLanding(false), 560);
    return () => clearTimeout(timer);
  }, [slot.identity]);

  return (
    <button
      type="button"
      onClick={onOpen}
      // The brief's core loop: tapping any face opens that person's profile.
      aria-label={`${name}${seat.kind === "host" ? ", host" : ""}${slot.isMuted ? ", muted" : ""}`}
      className={cn("ws-press flex w-[84px] flex-col items-center rounded-2xl", FOCUS)}
    >
      <span className="relative block" style={{ height: SEAT_AVATAR, width: SEAT_AVATAR }}>
        <span className={cn("block", landing && "ws-seat-land")}>
          <Avatar
            name={name}
            seed={meta?.username ?? slot.identity}
            src={meta?.avatarUrl}
            size={SEAT_AVATAR}
          />
        </span>
        <SeatMeter audio={audio} identity={slot.identity} landing={landing} />
        {/* Muted is the EXCEPTIONAL state and gets the explicit mark; speaking
            is carried by the arc. Two channels, and the glyph is the one that
            survives sunlight and colour blindness. */}
        {slot.isMuted && (
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/12 bg-overlay">
            <IconVolume className="h-2.5 w-2.5 text-meta" muted />
          </span>
        )}
      </span>
      <span className="mt-1 max-w-[80px] truncate text-[11px] font-semibold leading-[14px] text-body">
        {name}
      </span>
      {seat.kind === "host" && <ChipShell className="mt-0.5">Host</ChipShell>}
      {/* Never invisible to the person who set it: a silence you cannot see is
          a silence you will blame on the room. */}
      {mutedForMe && <ChipShell className="mt-0.5">Muted for you</ChipShell>}
    </button>
  );
}

export function EmptySeat({
  /** How many hands are up. Only the ONE next free seat is ever told. */
  pending,
  disabled,
  /** True for the single chair carrying the invitation. See seat-ring.tsx. */
  offered,
  onAsk,
  label,
}: {
  pending: number;
  disabled: boolean;
  offered: boolean;
  onAsk: () => void;
  label: string;
}) {
  const waiting = pending > 0;
  return (
    <button
      type="button"
      onClick={onAsk}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "ws-press flex w-[84px] flex-col items-center rounded-2xl disabled:cursor-not-allowed",
        FOCUS
      )}
    >
      <span
        style={{ height: SEAT_AVATAR, width: SEAT_AVATAR }}
        className={cn(
          // 180ms dashed → solid is the room saying "somebody may be seated
          // next" without saying who.
          "relative flex items-center justify-center rounded-full transition-colors duration-[180ms] ease-out motion-reduce:transition-none",
          waiting
            ? "border border-solid border-white/[0.28]"
            : "border border-dashed border-white/[0.22]"
        )}
      >
        {waiting && (
          <>
            {/* The LIGHT stop of the purple ramp — 5.77:1 on black, which is
                what a small glyph needs. */}
            <IconHand className="h-5 w-5 text-create" />
            {pending > 1 && (
              <span className="tnum absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-spotlight px-1 text-[10px] font-bold leading-4 text-white">
                {/* The DARK stop, as a fill: white on it is 5.66:1. */}
                {pending}
              </span>
            )}
          </>
        )}
      </span>
      {/* One label, not seven. Repeating "Free seat" under every empty chair
          turns the invitation into wallpaper — and the affordance is a
          property of the ROOM ("somebody may sit next"), which is why only the
          chair that would take them says anything. */}
      <span className="mt-1 max-w-[80px] truncate text-[11px] font-semibold leading-[14px] text-meta">
        {!offered || disabled ? "" : waiting ? "Waiting" : "Free seat"}
      </span>
    </button>
  );
}

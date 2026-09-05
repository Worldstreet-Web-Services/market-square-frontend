"use client";

import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { LevelBars } from "@/features/houses/components/seat-meter";
import { useSeatLevel, type HouseAudio } from "@/features/houses/hooks/use-house-audio";
import { barOpacity, METER_BARS } from "@/features/houses/lib/audio-levels";
import { parseParticipantMeta, participantName } from "@/features/houses/lib/participant-meta";
import type { StageSlot } from "@/features/streams/lib/stage";

/**
 * The talking line: the edge of the table, naming whoever has the floor.
 *
 * This is the ONE thing in the room that reorders by audio, and it is a strip
 * of text rather than a rearrangement of faces. That split is the whole
 * design: Clubhouse's documented failure was "I can't find who's talking",
 * and its answer — a grid that reshuffles — traded one problem for a worse
 * one, because a face that moves is a face you have to re-find. Here the ring
 * holds still and a single line does the pointing.
 *
 * Sticky under the header, so it is answerable at any scroll depth: somebody
 * halfway down a two-hundred-person audience still knows who is speaking.
 *
 * `role="status"` with the announcement debounced in house-room.tsx — the
 * visible strip follows turn-taking immediately, the screen reader does not,
 * because a live region firing on every turn buries what is being said.
 */
export function TableEdge({
  audio,
  loudest,
  connecting,
  reconnecting,
}: {
  audio: HouseAudio;
  /** The loudest publisher's slot, or null in silence. */
  loudest: StageSlot | null;
  connecting: boolean;
  reconnecting: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      /* A sticky bar needs an opaque fill so the river does not read through
         it — but it must be the PAGE'S ground (`--color-chrome`), not `#000`.
         Black here drew a darker band across a `#121214` surface. */
      className="ws-hair sticky top-[calc(var(--ws-topbar-h)+var(--ws-house-head-h))] z-20 flex items-center gap-2.5 border-y bg-chrome px-4 py-2.5"
    >
      {reconnecting ? (
        <>
          <Spinner className="h-4 w-4 text-grey-600" />
          <span className="text-[12px] font-semibold leading-4 text-body">Reconnecting…</span>
        </>
      ) : connecting ? (
        <>
          {/* No overlay. The overlay in the video player exists because a black
              frame is meaningless; a ring of empty chairs is not — it is what
              the room IS, and hiding it behind a scrim to say "connecting"
              would replace information with an apology. */}
          <Spinner className="h-4 w-4 text-grey-600" />
          <span className="text-[12px] font-semibold leading-4 text-body">Connecting…</span>
        </>
      ) : loudest ? (
        <Speaking audio={audio} slot={loudest} />
      ) : (
        <>
          <span className="ws-meta flex-1 truncate normal-case tracking-normal">
            Nobody is speaking
          </span>
          <LevelBars opacities={Array.from({ length: METER_BARS }, () => barOpacity(0, 0))} />
        </>
      )}
    </div>
  );
}

function Speaking({ audio, slot }: { audio: HouseAudio; slot: StageSlot }) {
  const level = useSeatLevel(audio, slot.identity);
  const meta = parseParticipantMeta(slot.metadata);
  const name = participantName(slot.name) ?? slot.name;
  return (
    <>
      <Avatar name={name} seed={meta?.username ?? slot.identity} src={meta?.avatarUrl} size={20} />
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-heading">
        {name}
      </span>
      <LevelBars
        opacities={Array.from({ length: METER_BARS }, (_, index) => barOpacity(level, index))}
      />
    </>
  );
}

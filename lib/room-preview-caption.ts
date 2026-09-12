// Relative, not the alias: `node --test` runs this file as-is.
import { formatCount } from "./format.ts";

/**
 * What the room card's hover state says beside the face — node 415:12704's
 * "Speaking Now" slot, made honest.
 *
 * The file's copy is "Speaking Now", and nothing in a stream payload says who
 * is on mic. The only source of that fact is the media plane, which the card
 * reaches only after the reader presses `unmute` and a listen-only preview
 * connects. So the slot has three states, decided here and nowhere else:
 *
 *   · CONNECTED and somebody is speaking — name them, from the SFU's own
 *     ActiveSpeakersChanged and the participant's token metadata (the same
 *     resolution the house room uses). Never guessed from the roster.
 *   · CONNECTED and silence — nothing. A room with nobody talking has no
 *     "Speaking Now", and inventing a speaker is the claim this exists to stop.
 *   · NOT CONNECTED — how many are listening, from `viewerCount`, which the
 *     detail payload carries and the card already polls. `null` (a payload
 *     without the count) renders nothing rather than "0 listening".
 *
 * Pure: pinned by `lib/room-preview-caption.test.ts`.
 */
export type PreviewCaption =
  | { kind: "speaking"; text: string }
  | { kind: "listening"; text: string };

export function previewCaption({
  connected,
  speaker,
  listening,
}: {
  connected: boolean;
  /** The active speaker's resolved name, or null in silence / unresolved. */
  speaker: string | null;
  /** `viewerCount` from the stream detail; null when the payload has none. */
  listening: number | null;
}): PreviewCaption | null {
  if (connected) {
    return speaker ? { kind: "speaking", text: `${speaker} speaking` } : null;
  }
  if (listening === null || !Number.isFinite(listening) || listening < 0) return null;
  return {
    kind: "listening",
    text: `${formatCount(listening)} listening`,
  };
}

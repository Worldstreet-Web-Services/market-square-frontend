/*
 * NAMING: a "gist room" to a reader, `house` in the code.
 *
 * The product calls these GIST ROOMS — that is what every label, heading,
 * button and page title says, and it is the word the team uses.
 *
 * The code and the route's data still say `house`, deliberately. The backend
 * category value IS the string "house" — it is in the deployed enum, the
 * database CHECK constraint and the served spec — and the token signer reads
 * it to refuse a camera. Renaming the identifier without renaming that value
 * would leave a codebase whose words disagree with the wire, which is worse
 * than a codebase whose words disagree with the marketing.
 *
 * If the service ever renames the category, rename these with it, in one
 * change, with a migration. Not before.
 */
/**
 * What a house IS.
 *
 * A house is a Stream carrying `category: "house"`. Nothing else about the
 * object changes, which is the whole reason this slice is mostly configuration
 * rather than a second streaming stack: the rooms, the tokens, the speaker
 * requests, the moderation and the registry all already work, and every one of
 * them keys off a stream id.
 *
 * `StreamSchema.category` is `z.string()`, so the frontend parses
 * `category: "house"` today with no schema change at all.
 *
 * Pure, with no VALUE imports so `node --test` can load it directly — the seat
 * count lives in seating.ts for the same reason. Pinned by lib/house.test.ts.
 */

// Relative, not `@/`: this module is loaded directly by `node --test`, which
// does not resolve the alias.
import { housePath } from "../../../lib/house-path.ts";
import type { Stream } from "@/lib/api/schemas";

export const HOUSE_CATEGORY = "house";

/** The topic is the room. 1..120 — Discord Stage's cap; a header is a text block, not a hero. */
export const TOPIC_MIN = 1;
export const TOPIC_MAX = 120;

/** Past this the counter turns red, so the cap is felt before it is hit. */
export const TOPIC_WARN = 110;

/**
 * The pinned note: the compliant replacement for a screen share.
 *
 * The backend allows 2000 characters on `description`. We do not use that room
 * — a note that scrolls is a document, and a document in an audio room is the
 * screen share coming back through the side door.
 */
export const NOTE_MAX = 140;

/**
 * Exact match, never a substring.
 *
 * `category.includes("house")` would claim a future "housemusic" category, and
 * the failure mode of that mistake is a video stream opening in a room that has
 * no video code path at all.
 */
export function isHouse(stream: Pick<Stream, "category">): boolean {
  return stream.category === HOUSE_CATEGORY;
}

/** The topic, trimmed. Empty when the stream has no usable title. */
export function houseTopic(stream: Pick<Stream, "title">): string {
  return stream.title.trim();
}

/** Clamp typed input to the cap rather than letting the service refuse it. */
export function clampTopic(input: string): string {
  return input.slice(0, TOPIC_MAX);
}

export function clampNote(input: string): string {
  return input.slice(0, NOTE_MAX);
}

/** A topic that may be opened with. */
export function isValidTopic(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length >= TOPIC_MIN && trimmed.length <= TOPIC_MAX;
}

// Lifted to shared lib/: the messages slice needs it to link a room
// announcement, and slices never import each other. Re-exported so every
// existing caller in this slice is unchanged.
export { housePath };

/**
 * The share links, named in words rather than hidden inside a chair.
 *
 * `?seat=1` is NOT pre-approval — that needs a backend delta. It only means the
 * arriving guest's hand goes up automatically, so the host's own invitee is at
 * the front of the tray rather than lost in it.
 */
export function houseShareUrl(origin: string, houseId: string, seat = false): string {
  return `${origin}${housePath(houseId)}${seat ? "?seat=1" : ""}`;
}

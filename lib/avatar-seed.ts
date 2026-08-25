// Deterministic seeding for the no-upload avatar placeholder.
//
// The invariant: one person renders the SAME placeholder on every surface, in
// every session, on every device, forever. That only holds if the seed is a
// stable identity, so the resolution order is id -> username -> display name.
//
// `Profile.id` is a Privy DID and never changes. `username` is claimable but
// rarely changed. `displayName` is free text a user edits at will — seeding on
// it (as this used to) re-rolled a person's avatar the moment they renamed
// themselves, and collided every unnamed member onto one tone, because the
// schema's own fallback turns a null name into "Member ·A1B2".
//
// !! DO NOT SWAP THE HASH !!
// The hash below is FNV-1a (32-bit). It is not security-relevant and it is not
// chosen for speed — it is chosen because it is fixed. Changing the algorithm,
// the offset basis, the prime, or the palette's LENGTH or ORDER silently
// re-rolls the avatar of every existing user. Treat all five as a public API.

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a, 32-bit, operating on UTF-16 code units.
 *
 * Returns an unsigned 32-bit integer. `Math.imul` keeps the multiply in 32-bit
 * space (a plain `*` overflows into float territory and loses the low bits),
 * and `>>> 0` returns it unsigned so callers never have to handle a negative
 * seed — which is what makes a bare `% length` safe downstream.
 */
export function hashSeed(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * The default avatar artwork: nine ARK mascot illustrations in `public/avatar/`.
 *
 * These are the design's own assets, so the colour lives in the artwork and no
 * palette is invented here. In particular the placeholder does NOT draw on
 * `--color-create` / `--color-create-deep`: CLAUDE.md reserves that violet for
 * the Create Post CTA alone ("do not generalise this into a violet ramp for
 * other surfaces").
 *
 * They arrived as nine 8-33MB SVGs, each wrapping a 4096x4096 base64 raster for
 * a 71px avatar (222MB total). They are re-encoded here to 256x256 JPEG at
 * quality 85 — 256 covers the largest rendered avatar (112px on the profile
 * header) at 2x DPR. Total is now ~176KB. JPEG rather than WebP only because no
 * WebP encoder exists on this machine (sips reads WebP but cannot write it, and
 * this ffmpeg build has no libwebp); re-encoding to WebP would shave roughly
 * another 30% if tooling is added later. Alpha is not needed: every source has
 * its background baked in and the circle is a CSS mask.
 *
 * !! ORDER IS PERMANENT !!
 * Index 0 is the "we do not know who this is" fallback (see `seedIndex`). The
 * order is the sorted original filenames. Reordering, inserting or removing an
 * entry re-rolls the avatar of every existing user — same contract as the hash.
 */
export const AVATAR_ARTWORK: readonly string[] = [
  "/avatar/avatar-01.jpg",
  "/avatar/avatar-02.jpg",
  "/avatar/avatar-03.jpg",
  "/avatar/avatar-04.jpg",
  "/avatar/avatar-05.jpg",
  "/avatar/avatar-06.jpg",
  "/avatar/avatar-07.jpg",
  "/avatar/avatar-08.jpg",
  "/avatar/avatar-09.jpg",
];

/**
 * The artwork for a seed, or null when nothing identifies this row.
 *
 * Null is deliberate: an unidentified avatar falls back to initials rather than
 * borrowing a specific person's illustration.
 */
export function artworkForSeed(seed: string): string | null {
  if (!seed) return null;
  return AVATAR_ARTWORK[seedIndex(seed, AVATAR_ARTWORK.length)];
}

/** The identity fields an avatar can be seeded from, most stable first. */
export interface SeedSource {
  id?: string | null;
  username?: string | null;
  name?: string | null;
}

/**
 * Pick the most stable available identifier.
 *
 * Returns "" when nothing usable is present; callers treat that as "no seed"
 * and fall back to a fixed tone rather than hashing the empty string, so an
 * unidentified row never masquerades as a specific person's colour.
 */
export function resolveSeed({ id, username, name }: SeedSource): string {
  for (const candidate of [id, username, name]) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * Map a seed onto an index in [0, length).
 *
 * An empty seed pins to index 0 deliberately: it is the "we do not know who
 * this is" tone, and it must not drift as the palette grows.
 */
export function seedIndex(seed: string, length: number): number {
  if (length <= 0) throw new RangeError("palette length must be positive");
  if (!seed) return 0;
  return hashSeed(seed) % length;
}

/**
 * Grapheme-aware first characters, capped at two.
 *
 * Uses `Intl.Segmenter` where available so a ZWJ emoji sequence or a combining
 * mark counts as ONE character instead of splitting into a lone surrogate or a
 * naked diacritic. Falls back to code-point iteration (`Array.from`), which
 * still keeps surrogate pairs intact, then to a bare index.
 */
function firstGrapheme(word: string): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment } of segmenter.segment(word)) return segment;
    return "";
  }
  return Array.from(word)[0] ?? "";
}

/**
 * Initials for the placeholder.
 *
 * One word yields one letter, two or more yield two. Non-Latin scripts pass
 * through `toLocaleUpperCase` unchanged (CJK has no case), emoji survive as a
 * single grapheme, and an empty or whitespace-only name yields "?" so the
 * circle is never blank.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  const letters = picked
    .map((word) => firstGrapheme(word).toLocaleUpperCase())
    .join("");
  return letters || "?";
}

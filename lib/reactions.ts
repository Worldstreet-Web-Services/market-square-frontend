/**
 * THE GIST ROOM'S REACTION SET — node 1775:20163.
 *
 * `REACTION_EMOJIS` is the six-glyph QUICK bar (the picker's default row); the
 * "+" beside it opens the full emoji picker, so a reaction can be ANY emoji.
 * The list lives in `lib/` so both the picker (`components/ui`, which may not
 * import a feature) and the data channel (`features/streams`, which broadcasts
 * them) share it.
 *
 * A reaction that arrives over the wire is checked with `isReactionEmoji` before
 * it is drawn: the packet comes from another browser, not our server, so it
 * must be proven to be an EMOJI and nothing that reads as text — that is what
 * stops a peer flying "BUY NOW" across everyone's room. It is no longer a fixed
 * list of six, because the "+" legitimately sends others; the guard is now
 * "is a short, text-free pictographic glyph" rather than "is one of these six".
 */
export interface ReactionEmoji {
  char: string;
  label: string;
}

export const REACTION_EMOJIS: ReactionEmoji[] = [
  { char: "❤️", label: "heart" },
  { char: "🤔", label: "thinking" },
  { char: "👍", label: "thumbs up" },
  { char: "😂", label: "laughing" },
  { char: "👏", label: "clap" },
  { char: "🎉", label: "party" },
];

/** The heart is what the bare reaction button and any legacy packet mean. */
export const DEFAULT_REACTION = REACTION_EMOJIS[0].char;

export function isReactionEmoji(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 24) return false;
  // Must contain a pictographic glyph AND carry nothing that reads as text —
  // together these accept any real emoji (including ZWJ sequences and skin
  // tones) while refusing letters, digits and arbitrary strings.
  const hasPictograph = /\p{Extended_Pictographic}/u.test(value);
  const hasText = /[\p{L}\p{N}]/u.test(value);
  return hasPictograph && !hasText;
}

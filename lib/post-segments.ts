import type { Mention } from "@/lib/api/schemas";

/**
 * Splitting post text into the things worth making tappable.
 *
 * The same three things Ark's dashboard already marks up, with the same rules,
 * so one post reads identically on both surfaces. Divergence here is the kind
 * that is invisible until somebody notices `$BTC` is a chip on one screen and
 * plain text on the other, and by then two parsers exist.
 *
 * Pure and renderer-free so the rules can be tested without a DOM.
 */

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string; href: string; label: string }
  | { kind: "cashtag"; value: string; symbol: string }
  | { kind: "hashtag"; value: string; tag: string }
  | { kind: "mention"; value: string; handle: string; id: string | null };

/**
 * `$` then a letter then 1–9 more, not followed by another word character,
 * and preceded by a non-word character. Copied from Ark's `cashtags.ts` rather
 * than reinvented: `US$50` and an email must not become tickers.
 */
const CASHTAG = /(^|[^\w$])\$([A-Za-z][A-Za-z0-9]{1,9})(?![\w$])/g;

/**
 * `#` then a letter then up to 49 letters, digits or underscores.
 *
 * Two to fifty characters, matching the service's own rule exactly: a tag the
 * client links but the service rejects is a link to an empty page.
 *
 * Must start with a letter or `#1` and `#2026` become discussions. The leading
 * guard keeps a URL fragment (`example.com/page#section`) and an id
 * (`issue#42`) out. Same rule the service uses when it extracts them, so what
 * is rendered as a tag is what was actually indexed as one.
 */
const HASHTAG = /(^|[^\w#])#([A-Za-z][A-Za-z0-9_]{1,49})(?![\w#])/g;

/**
 * A bare URL in the text.
 *
 * `https?://` only, and NOT `javascript:`, `data:` or a bare `www.` — this
 * becomes an anchor `href`, so anything looser is a way to publish a script
 * link wearing the author's name. A scheme-less `www.example.com` is deliberately
 * left as text rather than guessed at: prefixing a scheme for somebody is how
 * you send a reader somewhere they did not write.
 *
 * Trailing punctuation is trimmed, because "see https://a.com." ends a
 * sentence and the full stop is not part of the address.
 */
const URL_PATTERN = /(^|[^\w@])(https?:\/\/[^\s<>"']+)/g;

/** `@` then a handle. Matched loosely and then CHECKED against the post's own mentions. */
const MENTION = /(^|[^\w@])@([A-Za-z0-9_.]{1,30})(?![\w@])/g;

interface Found {
  start: number;
  end: number;
  segment: Segment;
}

export interface ParseOptions {
  /**
   * Symbols this app can actually link to a trade for. A `$FOO` that is not
   * here stays plain text: a chip that looks tappable and then apologises is
   * worse than no chip, and on a finance surface it implies a listing that
   * does not exist. Compared case-insensitively.
   */
  tradeable?: Iterable<string>;
  /**
   * The mentions the SERVICE recorded on this post.
   *
   * Used to resolve a handle to a stable profile id where the service recorded
   * one. NOT a gate: a handle typed by hand still links, because that is what
   * people expect and a caption should not depend on having used a dropdown.
   */
  mentions?: Mention[];
}

export function parsePostText(text: string, options: ParseOptions = {}): Segment[] {
  const tradeable = new Set<string>();
  for (const symbol of options.tradeable ?? []) tradeable.add(symbol.toUpperCase());

  const byHandle = new Map<string, Mention>();
  for (const mention of options.mentions ?? []) {
    byHandle.set(mention.handle.replace(/^@/, "").toLowerCase(), mention);
  }

  const found: Found[] = [];

  for (const match of text.matchAll(CASHTAG)) {
    const [whole, lead = "", ticker = ""] = match;
    const symbol = ticker.toUpperCase();
    if (!tradeable.has(symbol)) continue;
    const start = (match.index ?? 0) + lead.length;
    found.push({
      start,
      end: (match.index ?? 0) + whole.length,
      segment: { kind: "cashtag", value: `$${ticker}`, symbol },
    });
  }

  for (const match of text.matchAll(HASHTAG)) {
    const [whole, lead = "", tag = ""] = match;
    const start = (match.index ?? 0) + lead.length;
    found.push({
      start,
      end: (match.index ?? 0) + whole.length,
      segment: { kind: "hashtag", value: `#${tag}`, tag: tag.toLowerCase() },
    });
  }

  for (const match of text.matchAll(URL_PATTERN)) {
    const [, lead = "", raw = ""] = match;
    // A sentence's full stop, a closing bracket or a comma is punctuation, not
    // address. Trimmed from the END only.
    const trimmed = raw.replace(/[.,;:!?)\]}'"]+$/, "");
    let href: URL;
    try {
      href = new URL(trimmed);
    } catch {
      continue;
    }
    if (href.protocol !== "https:" && href.protocol !== "http:") continue;
    const start = (match.index ?? 0) + lead.length;
    found.push({
      start,
      end: start + trimmed.length,
      segment: {
        kind: "url",
        value: trimmed,
        href: href.toString(),
        // Shown as the host plus a hint of the path. A raw 200-character URL
        // in a caption is a wall of noise that hides the sentence around it,
        // which is exactly what every social product learned to stop doing.
        label: shortenUrl(href),
      },
    });
  }

  for (const match of text.matchAll(MENTION)) {
    const [whole, lead = "", handle = ""] = match;
    // Linked whether or not the service recorded it, which is what every
    // social product does and what people expect: you type @someone and it
    // becomes a link. Requiring the composer's picker meant a handle typed by
    // hand stayed grey text, and nobody reads a caption thinking "I must
    // select that from a dropdown for it to work".
    //
    // A handle that resolves to nobody lands on the profile page's own
    // not-found state, which is a recoverable dead end. Refusing to link it at
    // all is the worse failure: the feature simply appears broken.
    const known = byHandle.get(handle.toLowerCase());
    const start = (match.index ?? 0) + lead.length;
    found.push({
      start,
      end: (match.index ?? 0) + whole.length,
      segment: {
        kind: "mention",
        value: `@${handle}`,
        handle,
        // The recorded id when we have one, so a display name change does not
        // break the link; the handle alone otherwise.
        id: known?.type === "profile" ? known.id : null,
      },
    });
  }

  // One pass, left to right. Overlaps are impossible between these three
  // sigils, but sorting is what lets three independent scans become one
  // ordered list without re-scanning the string per kind.
  found.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const hit of found) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, hit.start) });
    segments.push(hit.segment);
    cursor = hit.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}

/** Host plus a little path, the way a link is read rather than written. */
function shortenUrl(url: URL): string {
  const host = url.host.replace(/^www\./, "");
  const tail = `${url.pathname}${url.search}`.replace(/\/$/, "");
  if (tail === "" || tail === "/") return host;
  const shown = tail.length > 18 ? `${tail.slice(0, 18)}…` : tail;
  return `${host}${shown}`;
}

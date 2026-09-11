import type { Segment } from "./post-segments";

/**
 * Markdown-style formatting for post and comment text.
 *
 * People write `**this**`, `_this_`, `- lists` and `> quotes` and expect them to
 * look like what they typed. This turns that syntax into a small tree the
 * renderer draws; the text itself is stored exactly as typed, so nothing about
 * the service changes. (Ark's dashboard reads the same posts and, until it
 * adopts these rules, shows the raw characters.)
 *
 * WHAT IS SUPPORTED, AND NOTHING ELSE:
 *   · inline — `**bold**`, `*italic*` / `_italic_`, `~~strike~~`, `` `code` ``,
 *     and `\*` to write a literal marker;
 *   · blocks — `- ` / `* ` / `• ` bullets, `1. ` / `1) ` numbered lists (up to
 *     three digits, so "2026. What a year" stays a sentence), and `> ` quotes.
 * No headings, tables, images or raw HTML: a timeline is not a document, and
 * every extra rule is another way an ordinary sentence gets reformatted.
 *
 * THE TAPPABLE PARTS COME FIRST. Links, @mentions, #hashtags and $cashtags are
 * found by the existing segmenter before any formatting is read, and each is
 * held as ONE unbreakable token. That is what keeps `@some_user`, `snake_case`
 * inside a URL and `$BTC` intact, while `**@bob bought $BTC**` still bolds the
 * whole sentence around them.
 *
 * Italic needs a non-word character on both outer sides, so `2*3*4`, `2 * 3`
 * and `snake_case_name` stay exactly as written.
 *
 * Pure and renderer-free: the segmenter is passed in, so this module has no
 * runtime imports and is tested without a DOM.
 */

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "segment"; segment: Segment }
  | { kind: "code"; value: string }
  | { kind: "strong" | "em" | "strike"; children: Inline[] };

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { kind: "quote"; lines: Inline[][] };

/** The link / mention / tag segmenter, e.g. `parsePostText` with its options bound. */
export type Segmenter = (text: string) => Segment[];

const BULLET = /^ {0,3}[-*•] +(\S.*)$/;
const ORDERED = /^ {0,3}(\d{1,3})[.)] +(\S.*)$/;
const QUOTE = /^ {0,3}> ?(.*)$/;

type RawBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "quote"; lines: string[] };

export function formatPostText(text: string, segment: Segmenter): Block[] {
  const raw: RawBlock[] = [];
  for (const line of text.split("\n")) {
    const last = raw.at(-1);
    const ordered = ORDERED.exec(line);
    const bullet = ordered ? null : BULLET.exec(line);
    const quote = ordered || bullet ? null : QUOTE.exec(line);
    if (ordered || bullet) {
      const isOrdered = ordered !== null;
      const item = ordered ? ordered[2]! : bullet![1]!;
      if (last?.kind === "list" && last.ordered === isOrdered) last.items.push(item);
      else raw.push({ kind: "list", ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [item] });
    } else if (quote) {
      if (last?.kind === "quote") last.lines.push(quote[1]!);
      else raw.push({ kind: "quote", lines: [quote[1]!] });
    } else if (last?.kind === "paragraph") {
      last.lines.push(line);
    } else {
      raw.push({ kind: "paragraph", lines: [line] });
    }
  }

  // A plain post is ONE paragraph and keeps every line, blank ones included,
  // so it renders exactly as it did before formatting existed. Only beside a
  // list or quote do a paragraph's edge blank lines go: the block's own margin
  // is the gap, and a kept newline would double it.
  if (raw.length > 1) {
    raw.forEach((block, index) => {
      if (block.kind !== "paragraph") return;
      if (index > 0) while (block.lines.length && block.lines[0]!.trim() === "") block.lines.shift();
      if (index < raw.length - 1) while (block.lines.length && block.lines.at(-1)!.trim() === "") block.lines.pop();
    });
  }

  const blocks: Block[] = [];
  for (const block of raw) {
    if (block.kind === "paragraph") {
      if (block.lines.length === 0) continue;
      blocks.push({ kind: "paragraph", lines: block.lines.map((line) => formatInline(line, segment)) });
    } else if (block.kind === "list") {
      blocks.push({ ...block, items: block.items.map((item) => formatInline(item, segment)) });
    } else {
      blocks.push({ kind: "quote", lines: block.lines.map((line) => formatInline(line, segment)) });
    }
  }
  return blocks;
}

/** Private-use characters stand in for held tokens while the markers are read. */
const HOLD_BASE = 0xe000;
const HELD = /[\uE000-\uF8FF]/g;

const EMPHASIS: { kind: "strong" | "strike" | "em"; re: RegExp }[] = [
  { kind: "strong", re: /()\*\*(?=[^\s*])([\s\S]*?[^\s*])\*\*/ },
  { kind: "strike", re: /()~~(?=[^\s~])([\s\S]*?[^\s~])~~/ },
  { kind: "em", re: /(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?![*\w])/ },
  { kind: "em", re: /(^|[^_\w])_(?=[^\s_])([^_]*?[^\s_])_(?![_\w])/ },
];

export function formatInline(line: string, segment: Segmenter): Inline[] {
  const atoms: Inline[] = [];
  const hold = (atom: Inline) => {
    atoms.push(atom);
    return String.fromCharCode(HOLD_BASE + atoms.length - 1);
  };
  const atomAt = (char: string) => atoms[char.charCodeAt(0) - HOLD_BASE]!;
  // A literal private-use character in the text is held as itself, so it can
  // never be mistaken for a token.
  const holdLiterals = (value: string) => value.replace(HELD, (char) => hold({ kind: "text", value: char }));

  let held = "";
  for (const part of segment(line)) {
    if (part.kind === "text") {
      held += holdLiterals(part.value);
      continue;
    }
    // `**https://example.com**`: a URL runs to the next space, so it swallows
    // the closing marker. Trim trailing markers off and re-read what is left.
    if (part.kind === "url" && /[*~_]$/.test(part.value)) {
      const trimmed = part.value.replace(/[*~_]+$/, "");
      const tail = part.value.slice(trimmed.length);
      const again = trimmed ? segment(trimmed) : [];
      if (again.length === 1 && again[0]!.kind === "url") {
        held += hold({ kind: "segment", segment: again[0]! }) + tail;
      } else {
        held += holdLiterals(part.value);
      }
      continue;
    }
    held += hold({ kind: "segment", segment: part });
  }

  // Code first: nothing inside backticks is formatting.
  held = held.replace(/`([^`]+)`/g, (_, body: string) =>
    hold({ kind: "code", value: body.replace(HELD, (char) => rawText(atomAt(char))) })
  );
  // Then escapes, so `\*` is a star rather than a marker.
  held = held.replace(/\\([\\`*_~])/g, (_, char: string) => hold({ kind: "text", value: char }));

  return parseEmphasis(held, atomAt);
}

function parseEmphasis(value: string, atomAt: (char: string) => Inline): Inline[] {
  const out: Inline[] = [];
  let rest = value;
  while (rest) {
    let best: { kind: "strong" | "strike" | "em"; start: number; end: number; inner: string } | null = null;
    for (const { kind, re } of EMPHASIS) {
      const match = re.exec(rest);
      if (!match) continue;
      const start = match.index + match[1]!.length;
      if (!best || start < best.start) best = { kind, start, end: match.index + match[0].length, inner: match[2]! };
    }
    if (!best) {
      pushText(out, rest, atomAt);
      break;
    }
    pushText(out, rest.slice(0, best.start), atomAt);
    out.push({ kind: best.kind, children: parseEmphasis(best.inner, atomAt) });
    rest = rest.slice(best.end);
  }
  return out;
}

function pushText(out: Inline[], value: string, atomAt: (char: string) => Inline) {
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const last = out.at(-1);
    if (last?.kind === "text") last.value += buffer;
    else out.push({ kind: "text", value: buffer });
    buffer = "";
  };
  for (const char of value) {
    if (!/[\uE000-\uF8FF]/.test(char)) {
      buffer += char;
      continue;
    }
    const atom = atomAt(char);
    if (atom.kind === "text") {
      buffer += atom.value;
    } else {
      flush();
      out.push(atom);
    }
  }
  flush();
}

function rawText(atom: Inline): string {
  if (atom.kind === "text" || atom.kind === "code") return atom.value;
  if (atom.kind === "segment") return atom.segment.value;
  return atom.children.map(rawText).join("");
}

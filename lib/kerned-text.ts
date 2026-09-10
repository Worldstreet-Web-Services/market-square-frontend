import type { FontMetrics } from "./font-metrics.ts";

/**
 * TEXT LAID OUT THE WAY A BROWSER LAYS IT OUT — for `next/og`, which does not.
 *
 * Satori advances glyphs by their raw widths with no kerning (see
 * `lib/font-metrics`), so a picture of a card sets its words wider than the
 * card itself and wraps them in different places. This does the two things a
 * browser does and Satori does not, so the saved wink card breaks its lines
 * where the popup breaks them and spaces its letters the same way:
 *
 *   · WRAPPING with kerned widths — greedy, at spaces, a line taking the next
 *     word only if the kerned width still fits (a trailing space never counts,
 *     as in CSS). Runs of spaces collapse to one, as `white-space: normal` does.
 *   · KERNING as pieces — each line is cut wherever a kerned pair or a colour
 *     change falls; a piece is set unkerned by Satori, which is exactly right
 *     inside it, and carries the pair's adjustment as its left margin.
 *
 * Pure, so its widths and breaks are pinned against numbers measured in Chrome.
 */

export interface StyledRun {
  text: string;
  dim: boolean;
}

export interface TextPiece {
  text: string;
  dim: boolean;
  /** The kerning before this piece, in px: negative pulls it towards the last. */
  kern: number;
}

export interface TextLine {
  pieces: TextPiece[];
  /** The kerned width, in px — what a browser centres. */
  width: number;
}

interface Glyph {
  char: string;
  dim: boolean;
  glyph: number;
  /** Raw advance, px. */
  advance: number;
}

export function layoutText(
  runs: StyledRun[],
  metrics: FontMetrics,
  fontSize: number,
  maxWidth = Number.POSITIVE_INFINITY
): TextLine[] {
  const scale = fontSize / metrics.unitsPerEm;
  const glyphFor = (char: string, dim: boolean): Glyph => {
    const glyph = metrics.glyphOf(char.codePointAt(0)!);
    return { char, dim, glyph, advance: metrics.advanceOf(glyph) * scale };
  };
  const kern = (left: Glyph, right: Glyph) => metrics.kerningOf(left.glyph, right.glyph) * scale;
  const widthOf = (glyphs: Glyph[]) =>
    glyphs.reduce((sum, g, i) => sum + g.advance + (i > 0 ? kern(glyphs[i - 1]!, g) : 0), 0);

  const words: Glyph[][] = [];
  let word: Glyph[] = [];
  for (const run of runs) {
    for (const char of run.text) {
      if (/\s/.test(char)) {
        if (word.length > 0) words.push(word);
        word = [];
      } else {
        word.push(glyphFor(char, run.dim));
      }
    }
  }
  if (word.length > 0) words.push(word);

  /*
    Break opportunities: every space, and after a hyphen inside a word —
    Chrome sets "You and Oluwaseun Adebayo-" / "Johnson are now friends now!"
    rather than moving the whole name down. Not before a digit ("-2" stays
    whole), and never a hyphen that starts or ends the word.
  */
  const chunks: { glyphs: Glyph[]; spaceBefore: boolean }[] = [];
  for (const glyphs of words) {
    let start = 0;
    for (let i = 1; i < glyphs.length - 1; i++) {
      if (glyphs[i]!.char === "-" && !/[0-9]/.test(glyphs[i + 1]!.char)) {
        chunks.push({ glyphs: glyphs.slice(start, i + 1), spaceBefore: start === 0 });
        start = i + 1;
      }
    }
    chunks.push({ glyphs: glyphs.slice(start), spaceBefore: start === 0 });
  }

  const lines: Glyph[][] = [];
  let line: Glyph[] = [];
  for (const chunk of chunks) {
    if (line.length === 0) {
      line = chunk.glyphs;
      continue;
    }
    // The space takes the colour before it, so it never splits a piece.
    const candidate = chunk.spaceBefore
      ? [...line, glyphFor(" ", line[line.length - 1]!.dim), ...chunk.glyphs]
      : [...line, ...chunk.glyphs];
    if (widthOf(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = chunk.glyphs;
    }
  }
  if (line.length > 0) lines.push(line);

  return lines.map((glyphs) => {
    const pieces: TextPiece[] = [];
    glyphs.forEach((g, i) => {
      const adjust = i > 0 ? kern(glyphs[i - 1]!, g) : 0;
      const last = pieces[pieces.length - 1];
      if (last && adjust === 0 && last.dim === g.dim) last.text += g.char;
      else pieces.push({ text: g.char, dim: g.dim, kern: adjust });
    });
    return { pieces, width: widthOf(glyphs) };
  });
}

/**
 * A FONT'S HORIZONTAL METRICS, READ FROM ITS OWN TABLES — where a browser puts
 * each glyph on a line, without a browser.
 *
 * It exists because `next/og` (Satori) advances every glyph by its raw width
 * and applies NO kerning, while every browser applies the font's `kern`
 * feature. In Geist Bold that makes a line about 2% wider in the saved wink
 * card than on screen: enough to push "friends" onto a second line that the
 * popup keeps on the first. Measured, not assumed — Chrome with kerning
 * switched off matches the raw advances read here to 0.01px, and Satori
 * matches those; Chrome with kerning on matches them plus the pairs below.
 *
 * It reads only what that takes: `head` (units per em), `cmap` formats 4 and
 * 12, `hhea` + `hmtx`, and GPOS pair adjustment (lookup type 2, formats 1 and
 * 2, including through type-9 extensions) under the `kern` feature. Ligatures,
 * mark positioning and contextual forms are not modelled.
 */
export interface FontMetrics {
  unitsPerEm: number;
  /** The glyph for a code point, 0 (.notdef) when the font has none. */
  glyphOf(codePoint: number): number;
  /** A glyph's advance width, in font units. */
  advanceOf(glyph: number): number;
  /** The kerning between two adjacent glyphs, in font units (negative = closer). */
  kerningOf(left: number, right: number): number;
}

type PairSubtable = { format: 1 | 2; at: number };

export function readFontMetrics(bytes: Uint8Array): FontMetrics {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at);
  const i16 = (at: number) => view.getInt16(at);
  const u32 = (at: number) => view.getUint32(at);
  const tag = (at: number) => String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);

  const tables = new Map<string, number>();
  for (let i = 0; i < u16(4); i++) tables.set(tag(12 + 16 * i), u32(12 + 16 * i + 8));
  const table = (name: string) => {
    const at = tables.get(name);
    if (at === undefined) throw new Error(`The font has no ${name} table.`);
    return at;
  };

  const unitsPerEm = u16(table("head") + 18);
  const hmtx = table("hmtx");
  const longMetrics = u16(table("hhea") + 34);

  // ── cmap: the Unicode subtables only ──────────────────────────────────────
  const cmap = table("cmap");
  let format4: number | null = null;
  let format12: number | null = null;
  for (let i = 0; i < u16(cmap + 2); i++) {
    const record = cmap + 4 + 8 * i;
    const platform = u16(record);
    const encoding = u16(record + 2);
    if (!(platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10)))) continue;
    const sub = cmap + u32(record + 4);
    if (u16(sub) === 12) format12 ??= sub;
    if (u16(sub) === 4) format4 ??= sub;
  }

  const glyphOf = (codePoint: number): number => {
    if (format12 !== null) {
      let lo = 0;
      let hi = u32(format12 + 12) - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const group = format12 + 16 + 12 * mid;
        if (codePoint < u32(group)) hi = mid - 1;
        else if (codePoint > u32(group + 4)) lo = mid + 1;
        else return u32(group + 8) + (codePoint - u32(group));
      }
      return 0;
    }
    if (format4 === null || codePoint > 0xffff) return 0;
    const segments = u16(format4 + 6) / 2;
    const ends = format4 + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    for (let s = 0; s < segments; s++) {
      if (codePoint > u16(ends + 2 * s)) continue;
      const start = u16(starts + 2 * s);
      if (codePoint < start) return 0;
      const delta = i16(deltas + 2 * s);
      const rangeOffset = u16(ranges + 2 * s);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyph = u16(ranges + 2 * s + rangeOffset + 2 * (codePoint - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };

  const advanceOf = (glyph: number) => u16(hmtx + 4 * Math.min(glyph, longMetrics - 1));

  // ── GPOS: the pair-adjustment lookups the `kern` feature names ────────────
  const kernLookups: PairSubtable[][] = [];
  const gpos = tables.get("GPOS");
  if (gpos !== undefined) {
    const features = gpos + u16(gpos + 6);
    const lookups = gpos + u16(gpos + 8);
    const indices = new Set<number>();
    for (let i = 0; i < u16(features); i++) {
      const record = features + 2 + 6 * i;
      if (tag(record) !== "kern") continue;
      const feature = features + u16(record + 4);
      for (let j = 0; j < u16(feature + 2); j++) indices.add(u16(feature + 4 + 2 * j));
    }
    // A shaper applies a feature's lookups in LookupList order.
    for (const index of [...indices].sort((a, b) => a - b)) {
      const lookup = lookups + u16(lookups + 2 + 2 * index);
      const type = u16(lookup);
      const subtables: PairSubtable[] = [];
      for (let j = 0; j < u16(lookup + 4); j++) {
        let at = lookup + u16(lookup + 6 + 2 * j);
        let subType = type;
        if (type === 9) {
          subType = u16(at + 2);
          at += u32(at + 4);
        }
        const format = u16(at);
        if (subType === 2 && (format === 1 || format === 2)) subtables.push({ format, at });
      }
      if (subtables.length > 0) kernLookups.push(subtables);
    }
  }

  const coverageIndex = (at: number, glyph: number): number => {
    const format = u16(at);
    let lo = 0;
    let hi = u16(at + 2) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (format === 1) {
        const value = u16(at + 4 + 2 * mid);
        if (glyph < value) hi = mid - 1;
        else if (glyph > value) lo = mid + 1;
        else return mid;
      } else if (format === 2) {
        const range = at + 4 + 6 * mid;
        if (glyph < u16(range)) hi = mid - 1;
        else if (glyph > u16(range + 2)) lo = mid + 1;
        else return u16(range + 4) + (glyph - u16(range));
      } else {
        return -1;
      }
    }
    return -1;
  };

  const classOf = (at: number, glyph: number): number => {
    const format = u16(at);
    if (format === 1) {
      const index = glyph - u16(at + 2);
      return index >= 0 && index < u16(at + 4) ? u16(at + 6 + 2 * index) : 0;
    }
    if (format !== 2) return 0;
    let lo = 0;
    let hi = u16(at + 2) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const range = at + 4 + 6 * mid;
      if (glyph < u16(range)) hi = mid - 1;
      else if (glyph > u16(range + 2)) lo = mid + 1;
      else return u16(range + 4);
    }
    return 0;
  };

  /** Bytes in a ValueRecord: two per field its format names. */
  const valueSize = (format: number) => {
    let size = 0;
    for (let bit = 0; bit < 8; bit++) if (format & (1 << bit)) size += 2;
    return size;
  };
  /** A ValueRecord's XAdvance — placement fields come first when present. */
  const xAdvance = (record: number, format: number) =>
    format & 0x04 ? i16(record + (format & 0x01 ? 2 : 0) + (format & 0x02 ? 2 : 0)) : 0;

  /** The pair's adjustment in one subtable, or null when it does not apply. */
  const pairIn = ({ format, at }: PairSubtable, left: number, right: number): number | null => {
    const covered = coverageIndex(at + u16(at + 2), left);
    if (covered < 0) return null;
    const format1 = u16(at + 4);
    const format2 = u16(at + 6);
    if (format === 1) {
      const set = at + u16(at + 10 + 2 * covered);
      const size = 2 + valueSize(format1) + valueSize(format2);
      let lo = 0;
      let hi = u16(set) - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const record = set + 2 + size * mid;
        const second = u16(record);
        if (right < second) hi = mid - 1;
        else if (right > second) lo = mid + 1;
        else return xAdvance(record + 2, format1);
      }
      return null;
    }
    const class1 = classOf(at + u16(at + 8), left);
    const class2 = classOf(at + u16(at + 10), right);
    const class2Count = u16(at + 14);
    if (class1 >= u16(at + 12) || class2 >= class2Count) return null;
    return xAdvance(at + 16 + (class1 * class2Count + class2) * (valueSize(format1) + valueSize(format2)), format1);
  };

  const cache = new Map<number, number>();
  const kerningOf = (left: number, right: number): number => {
    const key = left * 65536 + right;
    const known = cache.get(key);
    if (known !== undefined) return known;
    let total = 0;
    for (const subtables of kernLookups) {
      // Within a lookup the first subtable that applies wins; lookups add up.
      for (const subtable of subtables) {
        const value = pairIn(subtable, left, right);
        if (value !== null) {
          total += value;
          break;
        }
      }
    }
    cache.set(key, total);
    return total;
  };

  return { unitsPerEm, glyphOf, advanceOf, kerningOf };
}

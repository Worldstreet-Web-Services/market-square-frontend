/**
 * Solid silhouette of a compound outline glyph.
 *
 * The design's exported action icons (like, Arkmark) draw their outline as ONE
 * fill path: an outer contour, then an inner contour that punches the hole. An
 * "active" state in this design is the SOLID glyph, not the same outline in a
 * different colour — so dropping every subpath after the first closes the hole
 * and leaves the outer edge pixel-identical between the two states.
 *
 * That is why the fill toggle used by stroke icons (`fill="currentColor"` vs
 * `fill="none"`) does not apply here: these paths are already filled, and
 * setting `fill="none"` would erase them entirely.
 */
export function solidSubpath(pathData: string): string {
  const cut = pathData.indexOf("ZM");
  return cut === -1 ? pathData : `${pathData.slice(0, cut)}Z`;
}

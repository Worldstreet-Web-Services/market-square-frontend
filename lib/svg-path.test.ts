import assert from "node:assert/strict";
import { test } from "node:test";
import { solidSubpath } from "./svg-path.ts";

test("keeps a single-contour path untouched", () => {
  assert.equal(solidSubpath("M0 0L10 0L10 10Z"), "M0 0L10 0L10 10Z");
});

test("drops the hole contour so the glyph reads solid", () => {
  assert.equal(solidSubpath("M0 0L10 0L10 10ZM2 2L8 2L8 8Z"), "M0 0L10 0L10 10Z");
});

test("the outer contour is preserved verbatim, so both states share an edge", () => {
  const outline = "M0 0L10 0L10 10ZM2 2L8 2L8 8Z";
  assert.ok(outline.startsWith(solidSubpath(outline).slice(0, -1)));
});

// The shipped glyphs, not a stand-in: this reads the real design export and
// checks that the active state is a closed, single-contour silhouette while
// the resting state keeps its hole.
test("the shipped like and Arkmark glyphs have a real solid variant", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../components/ui/design-icons.tsx", import.meta.url),
    "utf8"
  );
  for (const name of ["MS_LIKE_PATH", "MS_BOOKMARK_PATH"]) {
    const match = source.match(new RegExp(`const ${name} =\\s*"([^"]+)"`));
    assert.ok(match, `${name} is defined`);
    const outline = match[1];
    const filled = solidSubpath(outline);
    // The outline is a compound path (two contours); the filled one is not.
    assert.ok(outline.split("M").length > 2, `${name} outline has a hole`);
    assert.equal(filled.split("M").length, 2, `${name} filled is one contour`);
    assert.ok(filled.endsWith("Z"), `${name} filled contour is closed`);
    assert.ok(outline.startsWith(filled.slice(0, -1)), `${name} shares its outer edge`);
  }
  // Both variants are painted, never `fill="none"` — these are fill glyphs.
  assert.ok(source.includes('d={filled ? solidSubpath(MS_LIKE_PATH) : MS_LIKE_PATH} fill="currentColor"'));
  assert.ok(
    source.includes('d={filled ? solidSubpath(MS_BOOKMARK_PATH) : MS_BOOKMARK_PATH} fill="currentColor"')
  );
});

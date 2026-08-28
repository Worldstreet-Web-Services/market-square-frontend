import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  join(process.cwd(), "features/feed/components/composer.tsx"),
  "utf8"
);

describe("composer toolbar", () => {
  // The $ and emoji tools were nested inside the link button's `relative`
  // wrapper. That wrapper is a block box, so the three controls stacked
  // vertically and the toolbar rendered as ragged lines instead of one row.
  // Each picker owns the `relative` its own popover anchors to, so none of
  // them belongs inside another control's wrapper.
  test("the pickers are siblings in the row, not nested in the link wrapper", () => {
    const link = source.indexOf("<IconLink");
    const wrapperClose = source.indexOf("</div>", link);
    const symbol = source.indexOf("<SymbolPicker");
    const emoji = source.indexOf("<EmojiPicker");
    assert.ok(link > 0 && symbol > 0 && emoji > 0, "all three tools render");
    assert.ok(symbol > wrapperClose, "the $ tool is outside the link wrapper");
    assert.ok(emoji > wrapperClose, "the emoji tool is outside the link wrapper");
  });

  // Every tool holds its size so the Post button can never squeeze the strip
  // into a second line.
  test("the toolbar is a single non-wrapping row", () => {
    assert.match(source, /flex min-w-0 flex-nowrap items-center gap-0\.5 border-t/);
  });

  // Nothing shrinks, so the row's minimum width IS the sum of its parts — on a
  // phone that pushed Post off the edge of a sheet that clips. The parts get
  // smaller below `sm` instead: tighter gaps, tighter icon padding, and the
  // "24h" label drops to its glyph.
  test("the strip has a narrower phone size", () => {
    assert.match(source, /gap-0\.5 border-t pt-2\.5 sm:gap-1/);
    assert.match(source, /rounded-full p-1\.5 transition-colors hover:bg-white\/10 sm:p-2/);
    assert.match(source, /<span className="hidden sm:inline">24h<\/span>/);
    assert.match(source, /bg-accent px-4 .*sm:px-5/);
  });
});

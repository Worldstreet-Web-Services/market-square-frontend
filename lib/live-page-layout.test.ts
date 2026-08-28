import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const read = (file: string) =>
  readFileSync(join(process.cwd(), "features/streams/components", file), "utf8");

describe("live page layout", () => {
  // A fixed 230px tile matches the design at exactly one viewport and leaves a
  // ragged column everywhere else; the ratio is what has to survive.
  test("the live tile keeps the design's crop while its width flexes", () => {
    const source = read("live-tile.tsx");
    assert.match(source, /aspect-\[230\/112\]/);
    assert.match(source, /bg-\[#ff0b0b\]/);
  });

  // Arrows over a rail that is already swipeable are chrome competing with the
  // content, so they are desktop-only — the rail itself is never gated on them.
  test("the rail's arrows are desktop-only and the track always scrolls", () => {
    const source = read("live-rail.tsx");
    assert.match(source, /hidden shrink-0 items-center gap-2 md:flex/);
    assert.match(source, /overflow-x-auto/);
  });

  // The dots must not be able to point past the end of a shrinking list.
  test("the hero clamps its active dot at render", () => {
    const source = read("live-hero.tsx");
    assert.match(source, /Math\.min\(index, slides\.length - 1\)/);
    assert.doesNotMatch(source, /useEffect/);
  });
});

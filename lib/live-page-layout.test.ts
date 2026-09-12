import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

const read = (file: string) =>
  readFileSync(join(process.cwd(), "features/streams/components", file), "utf8");

describe("live page layout", () => {
  // The design's measured values. A fixed 230px tile matches at exactly one
  // viewport, so the crop is kept as a ratio while every inset stays exact.
  test("the tile keeps the measured crop, radius, pill colour and insets", () => {
    const source = read("live-tile.tsx");
    assert.match(source, /aspect-\[230\/112\]/);
    assert.match(source, /rounded-\[12px\]/);
    assert.match(source, /bg-\[#ff0b0b\]/);
    assert.match(source, /right-\[6px\] top-\[5px\]/);
    assert.match(source, /bg-white\/\[0\.09\]/);
  });

  // Six rooms in a 3-up grid with overflow handed to "View all" is the shape
  // the design commits to — not a carousel.
  test("the section is a 3-up grid capped at six with a real View all", () => {
    const source = read("live-section.tsx");
    assert.match(source, /sm:grid-cols-3/);
    assert.match(source, /PREVIEW_LIMIT = 6/);
    assert.match(source, /gap-x-\[14px\] gap-y-\[31px\]/);
    // A "View all" that re-shows the same six rooms is a dead control.
    assert.match(source, /hasMore && viewAllHref/);
  });

  test("the CTA banner carries the file's own gradient and real artwork", () => {
    const source = read("live-cta.tsx");
    // 1305:149178's ramp, written as the file states it.
    assert.match(source, /126deg,#AD46FF_0%,#682A99_82%/);
    // Real exported art, never a placeholder — the mascot and both arcs.
    assert.match(source, /banner-mascot\.png/);
    assert.match(source, /banner-arc-left\.svg/);
    assert.match(source, /banner-arc-right\.svg/);
  });

  test("the hero uses the measured join pill, dots and chevron placement", () => {
    const source = read("live-hero.tsx");
    assert.match(source, /bg-\[#169632\]/);
    assert.match(source, /bg-\[#5a5a5a\]/);
    assert.match(source, /bg-\[#3c3c3c\]/);
    // The design's chevrons point up/down, so the carousel advances vertically.
    assert.match(source, /snap-y/);
    // The dots must not be able to point past the end of a shrinking list.
    assert.match(source, /Math\.min\(index, slides\.length - 1\)/);
    assert.doesNotMatch(source, /useEffect/);
  });

  test("the search field matches the measured border, height and placeholder", () => {
    const source = read("live-hub.tsx");
    assert.match(source, /h-\[52px\]/);
    assert.match(source, /border-\[0\.68px\] border-white\/40/);
    assert.match(source, /placeholder:text-\[#7a7a7a\]/);
    assert.match(source, /Search live feeds\.\.\./);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_STAGE_SLOTS, stageLayoutClass, stageTileSpanClass } from "./stage-layout.ts";

test("TWO people are stacked, never side by side", () => {
  // The reported bug. The stage is 9:16 at every breakpoint, so two columns
  // give each person a tall sliver; two rows give each the full width.
  const two = stageLayoutClass(2);
  assert.match(two, /grid-cols-1/u);
  assert.match(two, /grid-rows-2/u);
  assert.doesNotMatch(two, /grid-cols-2/u);
});

test("no shape depends on the viewport", () => {
  // The stage is portrait on desktop too, so a `md:` override was always
  // describing a frame that does not exist.
  for (let count = 1; count <= MAX_STAGE_SLOTS; count += 1) {
    assert.doesNotMatch(stageLayoutClass(count), /\b(sm|md|lg|xl):/u, `count ${count}`);
    for (let i = 0; i < count; i += 1) {
      assert.doesNotMatch(stageTileSpanClass(count, i), /\b(sm|md|lg|xl):/u, `${count}/${i}`);
    }
  }
});

test("one person takes the whole stage", () => {
  assert.equal(stageLayoutClass(1), "grid grid-cols-1 grid-rows-1");
  assert.equal(stageLayoutClass(0), "grid grid-cols-1 grid-rows-1");
});

test("three is two abreast with the third spanning, not three bands", () => {
  // Three stacked bands in a 9:16 stage is a ~3:1 letterbox each — the shape
  // a face fits worst — and drives every tile to the height floor.
  assert.match(stageLayoutClass(3), /grid-cols-2/u);
  assert.equal(stageTileSpanClass(3, 0), "");
  assert.equal(stageTileSpanClass(3, 1), "");
  assert.equal(stageTileSpanClass(3, 2), "col-span-2");
});

test("four and beyond fill two columns evenly, with no spanning tile", () => {
  for (const count of [4, 5, 6]) {
    assert.match(stageLayoutClass(count), /grid-cols-2/u, `count ${count}`);
    for (let i = 0; i < count; i += 1) {
      assert.equal(stageTileSpanClass(count, i), "", `${count}/${i}`);
    }
  }
});

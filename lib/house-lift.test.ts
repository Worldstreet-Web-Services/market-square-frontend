import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const seat = source("features/houses/components/seat.tsx");
const ring = source("features/houses/components/seat-ring.tsx");

/**
 * The lift is the one moment this feature budgets motion for, and it shipped
 * dead. An empty seat and an occupied one are different components, so a seat
 * MOUNTS when somebody sits down; the original guard skipped the animation
 * whenever its "last seen identity" ref was null, which is exactly what a
 * fresh mount looks like. It never fired for anyone.
 */

test("the lift is decided at mount, from the room — not from a ref that is always null", () => {
  assert.match(
    seat,
    /const \[landing\] = useState\(\(\) => roomSettled\);/,
    "landing must be captured once at mount from the room's state"
  );
  assert.doesNotMatch(
    seat,
    /seen\.current === null/,
    "the null-ref guard is the bug: a fresh mount is indistinguishable from arriving"
  );
});

test("the seat does not set state in an effect to animate", () => {
  // setState inside an effect cascades renders, and the lint rule rejects it.
  assert.doesNotMatch(seat, /setLanding\(/, "no state setter for the landing flag");
});

test("the ring is what knows the room has arrived", () => {
  assert.match(ring, /const \[settled, setSettled\] = useState\(false\);/);
  assert.match(
    ring,
    /requestAnimationFrame\(\(\) => setSettled\(true\)\)/,
    "one paint is exactly the window the initial seats mount in; a duration would be a guess"
  );
  assert.match(ring, /roomSettled=\{settled\}/, "and passes it to every occupied seat");
});

/**
 * The gallery drew author-supplied media with `next/image`, which refuses a
 * host that is not in next.config — and this app deliberately configures
 * none, because the media host is author-supplied and unknown. It also put
 * `.mp4` URLs into an image, which is the story-tile bug: the browser cannot
 * decode a clip and paints its broken-image glyph instead.
 */
test("the profile gallery does not use next/image, and never draws a clip as a picture", () => {
  const gallery = source("features/profile/components/media-tab.tsx");
  assert.doesNotMatch(gallery, /from "next\/image"/, "the media host is unknown; use a plain img");
  assert.match(gallery, /isVideo\(post\) \?/, "a clip takes the video path");
  assert.match(gallery, /#t=0\.1/, "a clip with no poster shows its own first frame");
});

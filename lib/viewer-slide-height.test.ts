import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Every slide container in the chain must have a definite height.
 *
 * The reported bug was "any video I click just shows blank". PostSlide sizes
 * itself with `h-full` so the same component can fill Explore's reels column
 * and the full-screen viewer. A percentage height resolves against the
 * parent's height, and against an AUTO height it computes to auto. Everything
 * inside a slide is absolutely positioned, so its content height is zero and
 * the slide collapses to nothing: a black screen with only the close button,
 * which is exactly what was reported.
 *
 * Reels were unaffected because PostSlide is a direct child of a container
 * with an explicit height there. The viewer wraps each slide in a div for its
 * ref and snap target, and that wrapper is the link that has to carry it.
 */
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const slide = read("features/feed/components/post-slide.tsx");
const viewer = read("features/feed/components/video-viewer.tsx");

describe("slide height chain", () => {
  it("PostSlide fills its container rather than the viewport", () => {
    // h-dvh would break Explore's reels, which live inside a column.
    assert.match(slide, /ws-snap-item relative flex h-full/);
  });

  it("the viewer gives each slide wrapper a definite height", () => {
    // From the slide wrapper up to its ref, which is where the class must be.
    const start = viewer.indexOf("data-video-id={item.id}");
    const wrapper = viewer.slice(start, viewer.indexOf("ref={(node)", start));
    assert.match(
      wrapper,
      /className="h-full"/,
      "without this the slide resolves h-full against an auto height and collapses to zero"
    );
  });

  it("the viewer's scroll container has an explicit height to resolve against", () => {
    assert.match(viewer, /h-dvh w-full snap-y snap-mandatory/);
  });

});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * A reel's caption has to be VISIBLE, which is a paint-order problem before it
 * is a layout one.
 *
 * The reported bug was "we can't see the text they wrote in that reel". The
 * caption was not merely badly placed: the media and the tap layer are
 * `absolute inset-0`, the caption block was in normal flow, and within one
 * stacking context positioned elements paint above in-flow block boxes. The
 * video painted straight over the words. No amount of text shadow or z-index
 * on the text alone would have fixed it while it stayed unpositioned.
 *
 * So the rule this pins is: a caption shown over media lives inside the
 * absolutely positioned footer, never in the static block. The static block is
 * reserved for text-only posts, which have no media to be painted over by.
 *
 * Source-level rather than rendered, because the slide needs a LiveKit-free
 * DOM, an IntersectionObserver and a matchMedia to mount, and none of that
 * would make the assertion any truer.
 */
const source = readFileSync(new URL("../features/feed/components/post-slide.tsx", import.meta.url), "utf8");

describe("reel caption visibility", () => {
  it("only renders the centred block when there is NO media to hide behind", () => {
    assert.match(
      source,
      /\{post\.text && !post\.mediaUrl && \(/,
      "the in-flow caption block must be guarded on the post having no media"
    );
  });

  it("renders a caption inside the positioned footer", () => {
    const footer = source.slice(source.indexOf('className="absolute inset-x-0 flex items-end px-4"'));
    assert.ok(
      footer.includes("{post.text && ("),
      "the media caption must live inside the absolutely positioned footer, or the video paints over it"
    );
  });

  it("clamps by default and offers 'more' only when there is more", () => {
    assert.match(source, /line-clamp-2/, "a caption must not cover the video it describes");
    assert.match(
      source,
      /post\.text\.length > \d+ &&/,
      "'more' must be conditional — a control that reveals nothing teaches people to ignore it"
    );
  });

  it("stops the caption tap reaching the sound toggle underneath", () => {
    const footer = source.slice(source.indexOf('className="absolute inset-x-0 flex items-end px-4"'));
    assert.ok(
      footer.includes("event.stopPropagation()"),
      "expanding a caption must not also toggle sound"
    );
  });
});

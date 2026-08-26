import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cn } from "./cn.ts";

/**
 * MediaFrame must let the CALLER decide its position.
 *
 * The reported bug — "I can't see the image or video on mobile, it's showing
 * black, but on desktop it shows" — was a class-order trap. The frame composed
 * its classes with a template string:
 *
 *     `relative overflow-hidden ... ${className}`
 *
 * and the immersive slide passes `absolute inset-0`. Both position utilities
 * were then present on one element, and which one applies is decided by the
 * ORDER TAILWIND EMITS THEM IN ITS STYLESHEET, not by the order they appear in
 * the attribute — and `.relative` is emitted after `.absolute`. So the frame
 * sat in normal flow with nothing but absolutely-positioned children, collapsed
 * to zero height, and the slide painted its own black ground.
 *
 * Desktop was unaffected because the timeline card passes `h-[420px] w-full`
 * and no position at all, which is exactly why the failure looked
 * mobile-specific and had nothing to do with viewport width.
 *
 * `cn` is tailwind-merge: it resolves conflicting utilities by intent, keeping
 * the last one, so the caller's position wins and callers that pass none keep
 * `relative`.
 */
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const frame = stripComments(read("components/ui/media-frame.tsx"));

describe("MediaFrame position", () => {
  it("merges its class list with cn, never a template string", () => {
    assert.match(
      frame,
      /className=\{cn\(/,
      "MediaFrame must compose classes with cn (tailwind-merge)"
    );
    assert.ok(
      !/className=\{`/.test(frame),
      "a template string cannot resolve a position conflict — Tailwind's own source order decides, and .relative wins over .absolute"
    );
  });

  it("lets a caller's absolute positioning win", () => {
    const merged = cn("relative overflow-hidden bg-[#0b0b0c]", "absolute inset-0");
    assert.ok(merged.includes("absolute"), "the caller's position must survive");
    assert.ok(
      !/\brelative\b/.test(merged),
      "the frame's default position must be dropped, or both apply and the collapse returns"
    );
  });

  it("keeps relative when the caller passes no position", () => {
    const merged = cn("relative overflow-hidden bg-[#0b0b0c]", "mt-4 h-[420px] w-full rounded-xl");
    assert.match(merged, /\brelative\b/, "layers need a positioned ancestor");
  });
});

/**
 * The whole point of the frame: author media is contained, never cropped.
 * A surface that reverts to object-cover silently re-frames someone's shot.
 */
describe("author media is contained", () => {
  for (const path of [
    "features/feed/components/post-slide.tsx",
    "components/ui/inline-video.tsx",
  ]) {
    it(`${path} contains its media rather than cropping it`, () => {
      const source = stripComments(read(path));
      assert.match(source, /object-contain/, "media must be shown whole");
      assert.ok(
        !/object-cover/.test(source),
        "object-cover discards whatever does not fit — use MediaFrame instead"
      );
    });
  }
});

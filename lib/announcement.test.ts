import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ANNOUNCEMENT_KEY, shouldShowAnnouncement } from "./announcement.ts";

describe("shouldShowAnnouncement", () => {
  it("shows a configured announcement nobody has dismissed", () => {
    assert.equal(shouldShowAnnouncement("post_1", null), true);
  });

  it("hides the one this reader dismissed", () => {
    assert.equal(shouldShowAnnouncement("post_1", "post_1"), false);
  });

  it("SHOWS A NEW ONE even to somebody who dismissed the last", () => {
    /*
      The whole reason dismissal stores an id rather than `true`. With a
      boolean, everybody who closed the previous announcement would silently
      never see another — and the people who most need a warning are exactly
      the ones who have learned to close things.
    */
    assert.equal(shouldShowAnnouncement("post_2", "post_1"), true);
  });

  it("shows nothing when none is configured", () => {
    // The normal state. Must cost nothing and render nothing.
    assert.equal(shouldShowAnnouncement(null, null), false);
    assert.equal(shouldShowAnnouncement(undefined, "post_1"), false);
    assert.equal(shouldShowAnnouncement("", "post_1"), false);
  });

  it("ignores junk left by an older build", () => {
    // A previous version could have written "true"; it is not an id, so it
    // does not match, and the reader sees the announcement. Failing OPEN is
    // right here: a notice shown twice is better than a warning never shown.
    assert.equal(shouldShowAnnouncement("post_1", "true"), true);
    assert.equal(shouldShowAnnouncement("post_1", ""), true);
  });

  it("keys storage on one stable name", () => {
    assert.equal(ANNOUNCEMENT_KEY, "ms.announcement.dismissed");
  });
});

/**
 * THE WIRING, which the pure rule above cannot see. Every one of these is a
 * way the announcement fails LOUDLY instead of quietly, and loud is wrong
 * here: nothing pinned is the normal state, and a reader has no idea anything
 * was supposed to be on screen.
 */
describe("a pinned announcement fails quiet", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  it("renders nothing when the post is missing, removed, or not yet loaded", () => {
    /*
      The id lives in CONFIG, so it outlives the post it names. Delete that
      post, or have it moderated away, and a naive read puts a ghost — or a
      404 — above every timeline, for signed-out visitors too.
    */
    const c = read("features/feed/components/announcement.tsx");
    assert.match(
      c,
      /if \(!show \|\| !post\.data \|\| post\.data\.status !== "active"\) return null;/,
      "a removed or missing announcement can render again"
    );
    assert.doesNotMatch(c, /Skeleton|ErrorState|toast\./, "the announcement shows a skeleton or an error");
  });

  it("keeps the id server-side so it can be changed without a rebuild", () => {
    // NEXT_PUBLIC_* is inlined at build time. The moment you most need to pull
    // an announcement is the moment you least want to wait for a build.
    const route = read("app/api/announcement/route.ts");
    assert.match(route, /process\.env\.MS_ANNOUNCEMENT_POST_ID/, "the id moved out of server config");
    // On the USE, not the word: the header explains why NEXT_PUBLIC_ is wrong
    // here, and matching prose would fail on its own explanation.
    assert.doesNotMatch(
      route,
      /process\.env\.NEXT_PUBLIC_/,
      "the id is inlined at build time again"
    );
  });

  it("costs no request when there is nothing to show", () => {
    // `usePost("")` is disabled by the hook's own `enabled`, so a dismissed or
    // unconfigured announcement does not fetch a post on every page load.
    const c = read("features/feed/components/announcement.tsx");
    assert.match(c, /usePost\(show \? postId! : ""\)/, "the announcement fetches a post it will not render");
  });

  it("is the ordinary PostCard, not a second card", () => {
    // A bespoke banner cannot be replied to or quoted, and is a second place
    // every future post fix has to be made.
    const c = read("features/feed/components/announcement.tsx");
    assert.match(c, /<PostCard post=\{post\.data\}/, "the announcement grew its own card");
  });
});

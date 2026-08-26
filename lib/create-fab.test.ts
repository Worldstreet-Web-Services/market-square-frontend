import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The create button must be in the SAME place on every route.
 *
 * The reported bug — "if I go to another page it goes up" — was a `sticky
 * bottom-6` copy living inside `<main>`. A sticky element is only pinned while
 * its containing block is in view, so on a short route it stranded at the end
 * of the content instead of holding the viewport corner. There were three
 * copies in total (desktop sticky, mobile fixed, and one inside the snap
 * feed), which is how they drifted apart in the first place.
 *
 * These are source-level invariants rather than rendered assertions because
 * the button is auth-gated behind a client hook: server-rendered HTML never
 * contains it, so no amount of curl can prove its position. What CAN be proved
 * without a browser is that exactly one exists, that it is fixed, and that it
 * is mounted in the shell rather than in any route — which is precisely what
 * makes its position route-independent.
 */
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Comments explain the old sticky bug by name, so assertions read code only. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const fab = read("components/layout/create-fab.tsx");
const fabCode = stripComments(fab);
const shell = read("components/layout/app-shell.tsx");

const SOURCES = [
  "components/layout/app-shell.tsx",
  "components/layout/create-fab.tsx",
  "features/feed/components/feed-page.tsx",
  // snap-feed.tsx drew the third copy. It is gone: home is the timeline now
  // and the reels feed lives in Explore, which never had its own button.
  "features/feed/components/reels-feed.tsx",
];

describe("the create button is rendered once, fixed, in the shell", () => {
  it("exists exactly once across every surface that used to draw one", () => {
    const total = SOURCES.reduce(
      (count, path) => count + (read(path).match(/aria-label="Create post"/g) ?? []).length,
      0
    );
    assert.equal(
      total,
      1,
      "a second copy is how the button drifted between pages — the shell owns the only one"
    );
  });

  it("is position:fixed, never sticky or absolute", () => {
    assert.match(fabCode, /className="fixed /, "fixed is what pins it to the viewport corner");
    assert.doesNotMatch(
      fabCode,
      /\bsticky\b/,
      "sticky only pins while the containing block is in view — that was the bug"
    );
    assert.doesNotMatch(fabCode, /className="absolute /);
  });

  it("no compose control anywhere is sticky-positioned", () => {
    for (const path of SOURCES) {
      const source = read(path);
      const sticky = stripComments(source).match(/sticky[^"]*"[^>]*aria-label="Create post"/);
      assert.equal(sticky, null, `${path} reintroduced a sticky compose control`);
    }
  });

  it("is mounted OUTSIDE <main>, so no route's content can move it", () => {
    const code = stripComments(shell);
    const mount = code.indexOf("<CreateFab");
    const mainClose = code.indexOf("</main>");
    assert.ok(mount > -1, "the shell must mount it");
    assert.ok(
      mount > mainClose,
      "mounted inside <main> it inherits that element's containing block again"
    );
  });

  it("carries no route-conditional styling", () => {
    // Its class list must be a constant. A pathname-dependent class is exactly
    // how "identical on every route" would rot.
    const classAttr = fabCode.match(/className="fixed [^"]*"/)?.[0] ?? "";
    assert.doesNotMatch(classAttr, /\$\{/, "the position classes must not interpolate");
    assert.doesNotMatch(fabCode, /pathname/, "the button must not know which route it is on");
  });

  it("keeps the design's 71px hit frame larger than the 52.79px circle", () => {
    assert.match(fabCode, /h-\[71px\] w-\[71px\]/, "the tap target is the outer frame");
    assert.match(fabCode, /h-\[52\.79487px\] w-\[52\.79487px\]/, "the visual circle is smaller");
    assert.match(fabCode, /p-\[9\.10256px\]/, "the difference is the design's padding");
  });

  it("clears the mobile tab bar through a shared variable", () => {
    // The bar's height and this clearance must not drift apart in two files.
    assert.match(fabCode, /var\(--ws-fab-bottom\)/);
    const css = read("app/globals.css");
    assert.match(css, /--ws-fab-bottom:\s*calc\(env\(safe-area-inset-bottom/);
  });
});

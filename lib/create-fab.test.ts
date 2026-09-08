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
];

describe("the create button is rendered once, fixed, in the shell", () => {
  // Two, and only two, and both in the shell: the desktop circle in the corner
  // and the phone's, which rides in the tab bar's row so it cannot land on top
  // of the bar. They are mutually exclusive by breakpoint — see the test below
  // — so a reader still only ever sees one.
  it("is drawn only by the shell, never by a route", () => {
    for (const path of SOURCES.filter((source) => !source.startsWith("components/layout/"))) {
      assert.equal(
        (read(path).match(/aria-label="Create post"/g) ?? []).length,
        0,
        `${path} drew its own compose control — that is how the button drifted between pages`
      );
    }
    /*
      TWO COMPOSE CONTROLS, BOTH IN THE SHELL — the desktop corner and the
      phone's tab row. The corner one now names itself from a `label` prop
      defaulting to "Create post", because 407:17286 draws the same circle on
      the gist rooms page where it opens a ROOM. So the count is the shell's
      literal plus `CreateFab`'s default, not two literals.
    */
    const inShell =
      (stripComments(shell).match(/aria-label="Create post"/g) ?? []).length +
      (fabCode.match(/label = "Create post"/g) ?? []).length;
    assert.equal(inShell, 2, "one for the desktop corner, one for the phone's tab row");
  });

  it("lets a route borrow the SHAPE only where the shell's is suppressed", () => {
    /*
      The gist rooms page mounts `CreateFab` itself, and that is not the drift
      this suite exists to catch: it is the same circle in the same corner
      performing the act that page is for. What would be drift is two of them —
      so any route that mounts its own must be excluded from `allowsCompose`,
      which is what keeps exactly one on screen.
    */
    const surfaces = read("lib/compose-surfaces.ts");
    const screen = read("components/layout/gist-rooms-screen.tsx");
    assert.match(screen, /<CreateFab\b/, "the rooms page stopped drawing the file's circle");
    assert.match(
      screen,
      /label="Open a gist room"/,
      "the rooms page's circle no longer says what it does"
    );
    assert.match(
      surfaces,
      /NO_COMPOSE_EXACT[^\]]*"\/gist-rooms"/,
      "the rooms page mounts its own circle while the shell still draws one too"
    );
  });

  it("shows exactly one of the two at any width", () => {
    // Both are unconditional within their breakpoint, so overlap would be
    // permanent rather than intermittent: the desktop circle is hidden below
    // md, and the phone's bar is hidden from md up.
    assert.match(fabCode, /\bhidden\b[^"]*\bmd:flex\b/, "the corner button is desktop-only");
    const mobileBar = stripComments(shell).slice(stripComments(shell).indexOf("function MobileBar"));
    assert.match(mobileBar.slice(0, 2000), /md:hidden/, "the phone's bar is mobile-only");
  });

  it("is position:fixed, never sticky or absolute", () => {
    // Matched as a WORD, not as the literal start of the attribute. It used to
    // assert `className="fixed `, which broke the day another utility was
    // added ahead of it — the position is the invariant, not its place in the
    // class string.
    assert.match(fabCode, /className="[^"]*\bfixed\b/, "fixed is what pins it while scrolling");
    assert.doesNotMatch(
      fabCode,
      /\bsticky\b/,
      "sticky only pins while the containing block is in view — that was the bug"
    );
    assert.doesNotMatch(fabCode, /className="[^"]*\babsolute\b/);
  });

  it("tracks the SHELL's right edge, not the window's", () => {
    /*
      The shell is capped at `--ws-shell-max` and centred, so on a monitor
      wider than the cap the window's right edge and the frame's are different
      places — and a button measured from the window sits out in the gutter,
      orphaned from the column it composes into.

      It stays `fixed` (above), so the fix is the same cap plus the same
      `mx-auto` on the fixed strip: `inset-x-0` gives `mx-auto` something to
      centre within. All three have to agree, which is why all three are
      asserted together here rather than trusted to stay in step.
    */
    assert.match(fabCode, /max-w-\[var\(--ws-shell-max\)\]/, "the button lost the shell's cap");
    assert.match(fabCode, /\bmx-auto\b/, "a capped fixed strip must be centred to sit on the frame");
    assert.match(fabCode, /\binset-x-0\b/, "mx-auto centres nothing without a left/right basis");
    assert.match(
      stripComments(shell),
      /mx-auto flex w-full max-w-\[var\(--ws-shell-max\)\]/,
      "the shell frame itself must be the capped, centred one"
    );
    assert.match(read("app/globals.css"), /--ws-shell-max:\s*\d+px;/, "the cap must be published");
  });

  it("does not swallow clicks across the width it now spans", () => {
    // The strip is as wide as the frame, so it lies over the foot of every
    // page. Without this it would be an invisible bar eating every click in
    // its band — the cost of widening the element to position it.
    assert.match(fabCode, /pointer-events-none/, "the full-width strip must be click-through");
    assert.match(fabCode, /pointer-events-auto/, "…and the button must take them back");
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
    const classAttr = fabCode.match(/className="[^"]*\bfixed\b[^"]*"/)?.[0] ?? "";
    assert.notEqual(classAttr, "", "the position class list must be findable for this to mean anything");
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { KEYBOARD_MIN, keyboardInset } from "./keyboard-inset.ts";

/**
 * The bug: on iOS the composer sat UNDER the keyboard and the "pinned" thread
 * scrolled. `interactive-widget=resizes-content` fixes it on Chromium and iOS
 * Safari does not implement it, so the inset is measured instead.
 */
describe("keyboardInset", () => {
  it("is zero with no keyboard — the visual viewport fills the layout one", () => {
    assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 844 }), 0);
  });

  it("measures an iOS keyboard covering the foot of the window", () => {
    // iPhone 14, layout viewport unchanged at 844, visual band 508 tall.
    assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 508 }), 336);
  });

  it("counts an offset visual viewport, not just its height", () => {
    // Safari scrolls the visual viewport down inside the layout one; what the
    // keyboard covers is everything below the visible band, offset included.
    assert.equal(
      keyboardInset({ layoutHeight: 844, visualHeight: 508, offsetTop: 40 }),
      296
    );
  });

  it("is ZERO on Chromium, by construction rather than by sniffing", () => {
    // `resizes-content` shrinks the LAYOUT viewport too, so the two move
    // together and their difference is nothing. This is what makes the hook
    // safe to apply on every browser instead of detecting one.
    assert.equal(keyboardInset({ layoutHeight: 508, visualHeight: 508 }), 0);
  });

  it("ignores differences too small to be a keyboard", () => {
    // A URL bar collapsing, a pinch-zoom, or a keyboard mid-animation. Letting
    // these through makes the thread twitch under somebody reading it.
    assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 800 }), 0);
    assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: 844 - KEYBOARD_MIN + 1 }), 0);
    assert.equal(
      keyboardInset({ layoutHeight: 844, visualHeight: 844 - KEYBOARD_MIN }),
      KEYBOARD_MIN
    );
  });

  it("never returns a negative inset", () => {
    // Transient on rotation: the visual viewport reads taller than the layout.
    assert.equal(keyboardInset({ layoutHeight: 500, visualHeight: 844 }), 0);
  });

  it("survives a browser that reports nothing useful", () => {
    assert.equal(keyboardInset({ layoutHeight: Number.NaN, visualHeight: 508 }), 0);
    assert.equal(keyboardInset({ layoutHeight: 844, visualHeight: Number.NaN }), 0);
    assert.equal(
      keyboardInset({ layoutHeight: 844, visualHeight: 508, offsetTop: Number.NaN }),
      0
    );
  });

  it("returns whole pixels", () => {
    const v = keyboardInset({ layoutHeight: 844.4, visualHeight: 508.3 });
    assert.equal(v, Math.round(v));
  });
});

/**
 * THE WIRING, which the arithmetic above cannot see.
 *
 * Each of these was the actual failure or is one careless edit from
 * reinstating it, and none of them shows up in a unit test of the maths.
 */
describe("the thread is glued to the keyboard, not to the window", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  it("subtracts the keyboard from the thread's height", () => {
    const page = read("features/messages/components/messages-page.tsx");
    // Both branches: the inbox keeps the dock, the open thread does not, and
    // the keyboard covers either.
    const heights = page.match(/h-\[calc\([^\]]*\)\]/g) ?? [];
    assert.ok(heights.length >= 2, "the thread's height calcs are gone");
    for (const h of heights) {
      assert.match(
        h,
        /var\(--ws-vvh,100dvh\)/,
        `a pane is sized by dvh rather than the visual viewport: ${h}`
      );
      assert.doesNotMatch(h, /^h-\[calc\(100dvh/, `a pane went back to raw dvh: ${h}`);
    }
  });

  it("mounts the hook in the SHELL, so one window has one measurement", () => {
    /*
      It lived in the messages page first, which left `main` and the SIDEBAR
      still measuring the same window in `100dvh` while the chat pane measured
      it in `--ws-vvh`. Two units for one window is the bug: disagree by a
      pixel and `main` grows past its min-height, the document scrolls, and the
      full-height sidebar stops short — the black band under the WHOLE app.
    */
    const shell = read("components/layout/app-shell.tsx");
    assert.match(shell, /useKeyboardInset\(\)/, "nothing publishes --ws-vvh, so everything falls back to dvh");
    const page = read("features/messages/components/messages-page.tsx");
    assert.doesNotMatch(page, /useKeyboardInset/, "the page publishes it a second time");
  });

  it("sizes the sidebar and main from the SAME source as the pane", () => {
    const shell = read("components/layout/app-shell.tsx");
    assert.doesNotMatch(
      shell,
      /sticky top-0 z-40 hidden h-dvh/,
      "the sidebar measures the window in dvh again while the pane uses --ws-vvh"
    );
    assert.match(
      shell,
      /min-h-\[calc\(var\(--ws-vvh,100dvh\)-var\(--ws-crumb-h\)\)\]/,
      "main measures the window in dvh again while the pane uses --ws-vvh"
    );
  });

  it("stops the PAGE scrolling while a thread is open", () => {
    /*
      Sizing alone cannot guarantee it — every element has to agree to the
      pixel and one rounded half-pixel puts the scrollbar back. The route's
      contract is simpler and worth stating outright: with a thread open the
      message list scrolls and nothing else does.
    */
    const shell = read("components/layout/app-shell.tsx");
    assert.match(
      shell,
      /if \(!chatOpen\) return;[\s\S]{0,200}document\.body\.style\.overflow = "hidden"/,
      "the page can scroll behind an open thread again"
    );
    assert.match(
      shell,
      /document\.body\.style\.overflow = previous/,
      "the scroll lock is never released"
    );
  });

  it("listens to scroll as well as resize", () => {
    /*
      Safari slides the visual viewport INSIDE the layout one, which changes
      `offsetTop` without changing `height` — a resize-only listener misses it
      entirely and the composer drifts under the keyboard on exactly the
      browser this exists for.
    */
    const hook = read("hooks/use-keyboard-inset.ts");
    assert.match(hook, /addEventListener\("resize"/, "the keyboard's open/close is not observed");
    assert.match(hook, /addEventListener\("scroll"/, "the visual viewport's offset is not observed");
    assert.match(hook, /visibleHeight\(vv\.height\)/, "the pane is no longer sized from the visual viewport");
  });

  it("clears the property on unmount", () => {
    // Left behind, a keyboard dismissed while navigating away would make every
    // other page short by its height.
    const hook = read("hooks/use-keyboard-inset.ts");
    assert.match(hook, /removeProperty\("--ws-vvh"\)/, "--ws-vvh outlives the page that set it");
  });

  it("does not rely on the Chromium-only viewport meta alone", () => {
    // `interactive-widget=resizes-content` stays — it is the better fix where
    // it works — but iOS Safari does not implement it, which is why the hook
    // exists at all. Losing the meta would silently double the work on Chrome.
    const layout = read("app/layout.tsx");
    assert.match(layout, /interactiveWidget: "resizes-content"/, "the Chromium fix was removed");
  });
});

/**
 * THE DOCK'S ROW IS RESERVED ONLY WHERE THE DOCK IS DRAWN.
 *
 * `BottomDock` carries `md:hidden` whenever the sidebar is actually on screen,
 * so the two never both claim the navigation — but nothing told the LAYOUT
 * that. `--ws-nav-h` stayed 112 at every desktop width and `main` went on
 * padding its foot for a dock that is not there, which is a band of dead space
 * under every page for anyone with the sidebar on. ogazboiz reported it on the
 * dashboard and under the chat composer, where it reads worst because that
 * pane is meant to sit on the screen's bottom edge.
 *
 * Measured after the fix, at 1440x900 with the rail on: `--ws-nav-h` 0px and
 * `main`'s padding-bottom 0px. At 390 wide, both stay 112 — the dock IS on
 * screen there. For a signed-out visitor, 112 at both widths, because a guest
 * gets no sidebar and therefore does get the dock.
 */
describe("no dock, no reservation", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  it("stamps whether a rail is on screen", () => {
    const shell = read("components/layout/app-shell.tsx");
    assert.match(
      shell,
      /data-rail=\{railOn \? "on" : "off"\}/,
      "the stylesheet can no longer tell whether a dock is drawn"
    );
  });

  it("zeroes the dock's row at desktop widths when it is", () => {
    const css = read("app/globals.css");
    assert.match(
      css,
      /\[data-rail="on"\]\s*\{\s*--ws-nav-h: 0px;/,
      "main pads its foot for a dock that is not drawn again"
    );
  });

  it("fixes it on the VARIABLE, not at each reader", () => {
    /*
      `main`'s padding, the messages pane's two height calcs, and anything that
      subtracts this later all have to agree about whether the dock exists.
      Making the variable itself tell the truth is one rule rather than a rule
      per reader — and a reader added tomorrow inherits it.
    */
    const shell = read("components/layout/app-shell.tsx");
    assert.doesNotMatch(
      shell,
      /railOn \? "pb-0"|md:pb-0/,
      "the reservation is being special-cased at a consumer instead of on --ws-nav-h"
    );
  });

  it("leaves phones alone, where the dock really is on screen", () => {
    const css = read("app/globals.css");
    const block = css.match(/@media \(min-width: 768px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(block, /\[data-rail="on"\]/, "the zeroing escaped its desktop media query");
  });
});

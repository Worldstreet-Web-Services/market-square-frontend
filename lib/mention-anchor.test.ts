import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * The rule `use-mention-typing` follows for the list's visibility, pinned here
 * because the hook itself needs a browser.
 *
 * `MentionPicker` renders when there is an ANCHOR — a measured rect — not when
 * there is a token. So every path that closes the list has to clear the rect
 * as well; clearing only the token leaves the list open with an empty query,
 * which shows everybody.
 */
function anchorAfter(event: "typed-token" | "typed-no-token" | "pick" | "dismiss" | "reset" | "resize", tokenOpen: boolean): "rect" | null {
  switch (event) {
    case "typed-token":
      return "rect";
    case "typed-no-token":
    case "pick":
    case "dismiss":
    case "reset":
      return null;
    case "resize":
      return tokenOpen ? "rect" : null;
  }
}

describe("The mention list closes when it is done", () => {
  it("opens while an @ token is being typed", () => {
    assert.equal(anchorAfter("typed-token", true), "rect");
  });

  it("closes on a pick — the bug ogazboiz found", () => {
    // Picking cleared the token and left the rect, so the list stayed open
    // showing everybody, because an empty query matches everybody.
    assert.equal(anchorAfter("pick", true), null);
  });

  it("closes on dismiss, on reset, and when the token stops being one", () => {
    assert.equal(anchorAfter("dismiss", true), null);
    assert.equal(anchorAfter("reset", true), null);
    assert.equal(anchorAfter("typed-no-token", true), null);
  });

  it("does not open a list on a resize when none was showing", () => {
    assert.equal(anchorAfter("resize", false), null);
    assert.equal(anchorAfter("resize", true), "rect");
  });
});

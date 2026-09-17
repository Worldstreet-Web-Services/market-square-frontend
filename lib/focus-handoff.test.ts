import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { focusLost, handFocusOn, nextFocusIndex } from "./focus-handoff.ts";

const body = { isConnected: true, focus: () => {} };
function target(name: string, connected = true) {
  const log: string[] = [];
  return { name, isConnected: connected, focused: log, focus: () => void log.push(name) };
}

describe("focus that disappears is handed on, never left on <body>", () => {
  it("is lost when nothing, the body, or a removed element holds it", () => {
    assert.equal(focusLost(null, body), true);
    assert.equal(focusLost(body, body), true);
    assert.equal(focusLost({ isConnected: false }, body), true);
    assert.equal(focusLost({ isConnected: true }, body), false);
  });

  it("goes to the first candidate still on the page, and only when it was lost", () => {
    const gone = target("gone", false);
    const next = target("next");
    const heading = target("heading");
    assert.equal(handFocusOn(body, body, [null, gone, next, heading])?.name, "next");
    assert.deepEqual(next.focused, ["next"]);
    assert.deepEqual(heading.focused, []);

    const elsewhere = target("elsewhere");
    assert.equal(handFocusOn(elsewhere, body, [next]), null, "focus the reader moved on purpose is left alone");
    assert.equal(handFocusOn(null, body, [gone]), null);
  });

  it("a removed row hands focus to the row that took its place, else the one before", () => {
    assert.equal(nextFocusIndex(1, 3), 1);
    assert.equal(nextFocusIndex(2, 2), 1);
    assert.equal(nextFocusIndex(0, 0), null);
  });
});

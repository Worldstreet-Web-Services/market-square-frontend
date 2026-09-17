import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOCK_JUMP_MS, nextClockOffset, offsetFromDateHeader } from "./server-clock.ts";

const SERVER = Date.parse("2026-09-17T12:00:00.000Z");
const header = (ms: number) => new Date(ms).toUTCString();

describe("the server's clock, read off a response's Date header", () => {
  it("is the server's reading minus this device's, and never an unreadable header", () => {
    // The device runs 45s fast.
    assert.equal(offsetFromDateHeader(header(SERVER), SERVER + 45_000), -45_000);
    assert.equal(offsetFromDateHeader(null, SERVER), null);
    assert.equal(offsetFromDateHeader("yesterday-ish", SERVER), null);
  });

  it("keeps the tightest reading: a whole-second header and the trip home only ever read the server early", () => {
    assert.equal(nextClockOffset(null, -45_400), -45_400);
    assert.equal(nextClockOffset(-45_400, -45_900), -45_400);
    assert.equal(nextClockOffset(-45_400, -45_050), -45_050);
  });

  it("follows a device whose clock was changed, rather than holding the old reading", () => {
    // The phone's clock was set 30s forward: every later sample reads 30s lower.
    assert.equal(nextClockOffset(-1_000, -1_000 - CLOCK_JUMP_MS - 1), -1_000 - CLOCK_JUMP_MS - 1);
  });
});

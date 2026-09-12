import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opensAtLabel } from "./format.ts";

// A fixed "now" so the wording is pinned rather than depending on the clock.
const now = new Date("2026-09-12T09:00:00Z").getTime();
const iso = (value: string) => new Date(value).toISOString();

describe("when a scheduled gist room opens", () => {
  it("says the time today, the weekday this week, and the date beyond it", () => {
    assert.match(opensAtLabel(iso("2026-09-12T14:30:00Z"), now), /^Opens \d{2}:\d{2}$/);
    assert.match(opensAtLabel(iso("2026-09-15T14:30:00Z"), now), /^Opens \w{3,} \d{2}:\d{2}$/);
    assert.match(opensAtLabel(iso("2026-10-12T14:30:00Z"), now), /^Opens \b/);
    assert.doesNotMatch(opensAtLabel(iso("2026-10-12T14:30:00Z"), now), /\d{2}:\d{2}/, "a date that far out does not need a time");
  });

  it("never claims a past time, and never breaks on a bad one", () => {
    assert.equal(opensAtLabel(iso("2026-09-12T08:50:00Z"), now), "Opening soon");
    assert.equal(opensAtLabel(iso("2026-09-12T09:00:00Z"), now), "Opening soon");
    assert.equal(opensAtLabel("not a date", now), "Not open yet");
  });
});

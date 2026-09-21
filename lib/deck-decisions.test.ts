import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DECISIONS_KEPT,
  decided,
  decidedIds,
  decisionFor,
  recordDecision,
  type DecisionRecord,
} from "./deck-decisions.ts";

const NOW = Date.parse("2026-09-20T09:00:00.000Z");

describe("A card the reader has answered stays answered", () => {
  it("remembers a pass, which nothing remembered before", () => {
    const rows = recordDecision([], "them", "passed", NOW);
    assert.equal(decided(rows, "them"), true);
    assert.equal(decisionFor(rows, "them"), "passed");
  });

  it("does not expire, unlike the wink cooldown", () => {
    // The cooldown is a rule about sending a SECOND wink, not about how long a
    // card stays answered. Conflating them brought faces back a day later.
    const rows = recordDecision([], "them", "winked", NOW - 400 * 24 * 60 * 60 * 1000);
    assert.equal(decided(rows, "them"), true);
  });

  it("keeps one row per person — a later answer replaces the earlier one", () => {
    const passed = recordDecision([], "them", "passed", NOW);
    const followed = recordDecision(passed, "them", "followed", NOW + 1_000);
    assert.equal(followed.filter((row) => row.targetId === "them").length, 1);
    assert.equal(decisionFor(followed, "them"), "followed");
  });

  it("says nothing about somebody never seen", () => {
    assert.equal(decided([], "stranger"), false);
    assert.equal(decisionFor([], "stranger"), null);
  });

  it("drops the oldest rather than growing without end", () => {
    let rows: DecisionRecord[] = [];
    for (let index = 0; index < DECISIONS_KEPT + 5; index += 1) {
      rows = recordDecision(rows, `person-${index}`, "passed", NOW + index);
    }
    assert.equal(rows.length, DECISIONS_KEPT);
    // The five oldest went; the newest stayed.
    assert.equal(decided(rows, "person-0"), false);
    assert.equal(decided(rows, `person-${DECISIONS_KEPT + 4}`), true);
  });

  it("hands the filter a set rather than a scan per card", () => {
    const rows = recordDecision(recordDecision([], "a", "passed", NOW), "b", "winked", NOW);
    assert.deepEqual([...decidedIds(rows)].sort(), ["a", "b"]);
  });
});

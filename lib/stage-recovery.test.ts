import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STAGE_FAILURES,
  STAGE_STALL_MS,
  guestStagePanel,
  stageMessage,
  type StageState,
} from "./stage-recovery.ts";

describe("guestStagePanel — before approval", () => {
  it("offers the request to someone who has never asked", () => {
    const panel = guestStagePanel({ status: null, state: "idle" });
    assert.equal(panel.kind, "request");
    assert.deepEqual(panel.actions, ["request"]);
  });

  it("lets a denied, withdrawn or removed guest ask again", () => {
    // These are the backend's OWN status names. A previous version invented
    // "declined"/"left", which the backend never sends, so a viewer who had
    // been turned down could never ask a second time.
    for (const status of ["denied", "withdrawn", "removed"] as const) {
      assert.equal(guestStagePanel({ status, state: "idle" }).kind, "request", status);
    }
  });

  it("shows waiting, and nothing to press, while the host decides", () => {
    const panel = guestStagePanel({ status: "pending", state: "idle" });
    assert.equal(panel.kind, "waiting");
    assert.deepEqual(panel.actions, []);
  });
});

describe("guestStagePanel — approved", () => {
  it("only says on stage when the connection is actually publishing", () => {
    const panel = guestStagePanel({ status: "approved", state: "live" });
    assert.equal(panel.kind, "live");
    assert.deepEqual(panel.actions, ["leave"]);
  });

  /**
   * THE REGRESSION.
   *
   * Approved but not publishing used to render the on-stage panel, whose only
   * button was "Leave stage" — so the reported recovery was: leave a stage you
   * are not on, then ask again. Every non-live state must offer a real remedy,
   * and none of them may lead with "leave".
   */
  it("never presents leave-the-stage as the way out of a stage you are not on", () => {
    const stuck: StageState[] = [
      "waiting-for-room",
      "awaiting-grant",
      "starting",
      "grant-stalled",
      "not-permitted",
      "denied",
      "device-busy",
      "device-missing",
      "failed",
    ];
    for (const state of stuck) {
      const panel = guestStagePanel({ status: "approved", state });
      assert.notEqual(panel.kind, "live", `${state} must not read as on stage`);
      assert.notEqual(panel.actions[0], "leave", `${state} must not lead with leave`);
      assert.ok(panel.message.length > 0, `${state} must say something`);
    }
  });

  it("leads a stalled grant with rejoin, because retrying the camera cannot help", () => {
    // The camera is fine; the connection simply has no publish grant. A
    // getUserMedia retry succeeds and still puts nobody on stage — only a
    // fresh token on a fresh connection does.
    for (const state of ["grant-stalled", "not-permitted"] as const) {
      const panel = guestStagePanel({ status: "approved", state });
      assert.equal(panel.kind, "recover");
      assert.equal(panel.actions[0], "rejoin", state);
      assert.ok(panel.actions.includes("request-again"), state);
    }
  });

  it("leads a capture failure with a device retry", () => {
    for (const state of ["denied", "device-busy", "device-missing", "failed"] as const) {
      const panel = guestStagePanel({ status: "approved", state });
      assert.equal(panel.kind, "recover");
      assert.equal(panel.actions[0], "retry", state);
    }
  });

  it("always offers the one-tap start-over the reporter had to do by hand", () => {
    const dead: StageState[] = [
      "grant-stalled",
      "not-permitted",
      "denied",
      "device-busy",
      "device-missing",
      "failed",
    ];
    for (const state of dead) {
      assert.ok(
        guestStagePanel({ status: "approved", state }).actions.includes("request-again"),
        `${state} must offer request-again`
      );
    }
  });

  it("stays quiet and patient while it is genuinely still connecting", () => {
    for (const state of ["waiting-for-room", "awaiting-grant", "starting"] as const) {
      assert.equal(guestStagePanel({ status: "approved", state }).kind, "connecting", state);
    }
  });
});

describe("stage failure taxonomy", () => {
  it("treats a stalled grant as terminal, so the panel stops spinning", () => {
    assert.ok(STAGE_FAILURES.includes("grant-stalled"));
  });

  it("does not treat an in-flight connect as terminal", () => {
    for (const state of ["waiting-for-room", "awaiting-grant", "starting", "live", "idle"] as const) {
      assert.equal(STAGE_FAILURES.includes(state), false, state);
    }
  });

  it("gives every failure a remedy in its own words, not one generic line", () => {
    const messages = STAGE_FAILURES.map((state) => stageMessage(state, null));
    assert.equal(new Set(messages).size, messages.length, "each failure needs its own copy");
    // The specific mistake worth guarding: telling someone whose camera is held
    // by another tab to grant a permission they have already granted.
    assert.ok(!/allow|permission/i.test(stageMessage("device-busy", null)));
    assert.ok(/another app|another browser tab/i.test(stageMessage("device-busy", null)));
  });

  it("prefers the real error text where the browser gave us one", () => {
    assert.equal(stageMessage("failed", "ICE failed"), "ICE failed");
    assert.equal(stageMessage("not-permitted", "Grant not applied"), "Grant not applied");
  });

  it("waits long enough to not cry wolf, short enough to not strand anyone", () => {
    assert.ok(STAGE_STALL_MS >= 8_000 && STAGE_STALL_MS <= 20_000);
  });
});

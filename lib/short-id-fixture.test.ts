import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePostParam } from "./short-id.ts";

describe("post ids in fixture mode", () => {
  it("resolves the fixture data's own ids when there is no service", () => {
    // Without this every post page 404'd in the standalone demo.
    for (const id of ["p_dre_win", "p_zara_promo", "p_ws_kash"]) {
      assert.deepEqual(resolvePostParam(id, { fixtureIds: true }), { uuid: id, shortId: id });
    }
  });

  it("refuses them when a real service is configured", () => {
    assert.equal(resolvePostParam("p_dre_win"), null);
    assert.equal(resolvePostParam("p_dre_win", { fixtureIds: false }), null);
  });

  it("still refuses hostile input in fixture mode", () => {
    for (const bad of ["..", "p_..", "p_a/b", "p_a\\b", "p_A", "p_", "p_a b", "p_%2E", `p_${"a".repeat(61)}`]) {
      assert.equal(resolvePostParam(bad, { fixtureIds: true }), null, bad);
    }
  });

  it("keeps real ids working in fixture mode too", () => {
    const uuid = "01a0a16c-bcad-7000-882e-673a9416f9b2";
    assert.equal(resolvePostParam(uuid, { fixtureIds: true })?.shortId, "034OqIADSAafQwmr157BHm");
    assert.equal(resolvePostParam("034OqIADSAafQwmr157BHm", { fixtureIds: true })?.uuid, uuid);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENDER_OPTIONS, genderLabel, normalizeGender } from "./gender.ts";

describe("gender is one of two choices", () => {
  it("offers exactly Male and Female, saved lowercase", () => {
    assert.deepEqual(
      GENDER_OPTIONS.map((option) => [option.value, option.label]),
      [
        ["male", "Male"],
        ["female", "Female"],
      ]
    );
  });

  it("folds case and spaces to the canonical value, and refuses anything else", () => {
    assert.equal(normalizeGender(" Male "), "male");
    assert.equal(normalizeGender("FEMALE"), "female");
    assert.equal(normalizeGender("m"), null);
    assert.equal(normalizeGender("woman"), null);
    assert.equal(normalizeGender(""), null);
    assert.equal(normalizeGender(null), null);
  });

  it("labels a stored value, and labels nothing it does not know", () => {
    assert.equal(genderLabel("female"), "Female");
    assert.equal(genderLabel("Male"), "Male");
    assert.equal(genderLabel("non-binary"), null);
  });
});

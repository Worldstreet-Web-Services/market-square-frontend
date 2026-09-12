import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRY_CODES, countryName, countryOptions, placeLine } from "./countries.ts";

describe("countries", () => {
  it("names a code from the platform, any case, and falls back to the code", () => {
    assert.equal(countryName("NG"), "Nigeria");
    assert.equal(countryName("ng"), "Nigeria");
    assert.equal(countryName("ZZ"), "ZZ");
  });

  it("offers every nameable code once, alphabetical by name", () => {
    const options = countryOptions();
    assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length, "a code is listed twice");
    assert.ok(options.length > 240, `only ${options.length} countries`);
    const names = options.map((option) => option.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")));
    assert.ok(options.some((option) => option.code === "NG" && option.name === "Nigeria"));
  });

  it("draws whichever halves of the place arrived, or the continent alone", () => {
    assert.equal(placeLine({ city: "Ikeja", region: "Lagos", country: "NG", continent: "AF" }), "Ikeja, Lagos, Nigeria");
    assert.equal(placeLine({ city: null, region: "Lagos", country: "NG", continent: "AF" }), "Lagos, Nigeria");
    assert.equal(placeLine({ city: null, region: null, country: "NG", continent: "AF" }), "Nigeria");
    assert.equal(placeLine({ city: null, region: null, country: null, continent: "AF" }), "Africa");
    assert.equal(placeLine({ city: "  ", region: null }), "");
  });
});

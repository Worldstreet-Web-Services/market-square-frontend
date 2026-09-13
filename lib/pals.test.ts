import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mutualPals, palsArePartial } from "./pals.ts";

const p = (id: string) => ({ id });

describe("a pal is a mutual follow", () => {
  it("keeps only the people who follow back", () => {
    const following = [p("a"), p("b"), p("c")];
    const followers = [p("b"), p("z")];
    assert.deepEqual(mutualPals(following, followers).map((x) => x.id), ["b"]);
  });

  it("a one-way follow is NOT a pal — that is the whole point", () => {
    assert.deepEqual(mutualPals([p("star")], []), []);
    // ...and being followed by somebody you ignore is not one either.
    assert.deepEqual(mutualPals([], [p("fan")]), []);
  });

  it("keeps the server's order rather than re-sorting one page", () => {
    const following = [p("c"), p("a"), p("b")];
    const followers = [p("a"), p("b"), p("c")];
    assert.deepEqual(mutualPals(following, followers).map((x) => x.id), ["c", "a", "b"]);
  });

  it("an intersection of two paged lists is partial until BOTH are done", () => {
    // Under-reporting here reads to the user as "they unfollowed me".
    assert.equal(palsArePartial(false, false), true);
    assert.equal(palsArePartial(true, false), true);
    assert.equal(palsArePartial(false, true), true);
    assert.equal(palsArePartial(true, true), false);
  });
});

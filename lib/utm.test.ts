import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readUtm, shareTags, withUtm } from "./utm.ts";

describe("UTM tags on shared links", () => {
  it("names the app as the source, social for platforms and share for links and the device sheet", () => {
    assert.deepEqual(shareTags("whatsapp", "post_share"), { source: "whatsapp", medium: "social", campaign: "post_share" });
    assert.deepEqual(shareTags("copy_link", "profile_share"), { source: "copy_link", medium: "share", campaign: "profile_share" });
    assert.deepEqual(shareTags("native_share", "house_invite"), { source: "native_share", medium: "share", campaign: "house_invite" });
  });

  it("sets the tags, replaces old ones, and keeps the rest of the link whole", () => {
    const tagged = withUtm("https://square.example/p/abc?comment=c1#top", shareTags("x", "post_share"));
    const url = new URL(tagged);
    assert.equal(url.pathname, "/p/abc");
    assert.equal(url.searchParams.get("comment"), "c1");
    assert.equal(url.hash, "#top");
    assert.equal(url.searchParams.get("utm_source"), "x");
    assert.equal(url.searchParams.get("utm_medium"), "social");
    assert.equal(url.searchParams.get("utm_campaign"), "post_share");
    const retagged = new URL(withUtm(tagged, shareTags("telegram", "post_share")));
    assert.deepEqual(retagged.searchParams.getAll("utm_source"), ["telegram"]);
  });

  it("leaves a string that is not an absolute URL untouched", () => {
    assert.equal(withUtm("/p/abc", shareTags("x", "post_share")), "/p/abc");
  });
});

describe("UTM tags a visit arrives with", () => {
  it("keeps only the five UTM keys, trimmed and capped, or nothing", () => {
    assert.deepEqual(readUtm("?utm_source=whatsapp&utm_medium=social&utm_campaign=post_share&ref=x"), {
      utm_source: "whatsapp",
      utm_medium: "social",
      utm_campaign: "post_share",
    });
    assert.equal(readUtm("?utm_source=%20%20&ref=x"), null);
    assert.equal(readUtm(""), null);
    assert.equal(readUtm(`?utm_term=${"a".repeat(300)}`)?.utm_term?.length, 100);
  });
});

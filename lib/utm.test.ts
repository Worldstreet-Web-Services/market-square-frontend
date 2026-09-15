import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHARE_CHANNEL_CODES,
  campaignForPath,
  readUtm,
  withShareChannel,
  withoutShareChannel,
} from "./utm.ts";

describe("a shared link carries one short channel code", () => {
  it("is two characters, not sixty-two", () => {
    const link = withShareChannel("https://square.tsionark.com/p/0Bs5Ry4ePkLgYnMHsVJd2y", "whatsapp");
    assert.equal(link, "https://square.tsionark.com/p/0Bs5Ry4ePkLgYnMHsVJd2y?s=wa");
    assert.equal(link.includes("utm_"), false);
  });

  it("gives every channel its own code, and no two share one", () => {
    const codes = Object.values(SHARE_CHANNEL_CODES);
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(withShareChannel("https://s.example/u/amara", "copy_link"), "https://s.example/u/amara?s=cp");
    assert.equal(withShareChannel("https://s.example/u/amara", "native_share"), "https://s.example/u/amara?s=sh");
  });

  it("replaces an old code, drops old UTM tags, and keeps the rest of the link whole", () => {
    const url = new URL(
      withShareChannel("https://s.example/p/abc?comment=c1&s=wa&utm_source=x&utm_campaign=post_share#top", "telegram")
    );
    assert.equal(url.pathname, "/p/abc");
    assert.equal(url.searchParams.get("comment"), "c1");
    assert.deepEqual(url.searchParams.getAll("s"), ["tg"]);
    assert.equal(url.searchParams.has("utm_source"), false);
    assert.equal(url.searchParams.has("utm_campaign"), false);
    assert.equal(url.hash, "#top");
  });

  it("leaves a string that is not an absolute URL untouched", () => {
    assert.equal(withShareChannel("/p/abc", "x"), "/p/abc");
  });
});

describe("where a visit came from", () => {
  it("rebuilds source, medium and campaign from the code and the landing path", () => {
    assert.deepEqual(readUtm("?s=wa", "/p/0Bs5Ry4ePkLgYnMHsVJd2y"), {
      utm_source: "whatsapp",
      utm_medium: "social",
      utm_campaign: "post_share",
    });
    assert.deepEqual(readUtm("?s=cp", "/u/amara"), {
      utm_source: "copy_link",
      utm_medium: "share",
      utm_campaign: "profile_share",
    });
  });

  it("maps every path something is shared as, and nothing else", () => {
    assert.equal(campaignForPath("/p/abc"), "post_share");
    assert.equal(campaignForPath("/u/amara"), "profile_share");
    assert.equal(campaignForPath("/join/tok"), "house_invite");
    assert.equal(campaignForPath("/gist-rooms/r1"), "room_share");
    assert.equal(campaignForPath("/"), null);
    // A prefix is a whole segment: `/pals` is not a post.
    assert.equal(campaignForPath("/pals"), null);
    assert.deepEqual(readUtm("?s=fb", "/"), { utm_source: "facebook", utm_medium: "social" });
  });

  it("ignores a code it does not know rather than recording it", () => {
    assert.equal(readUtm("?s=zz", "/p/abc"), null);
    assert.equal(readUtm("?s=", "/p/abc"), null);
  });

  it("still reads full UTM tags, and they win over a code", () => {
    // Email digests carry full tags; a hand-tagged link should still count.
    assert.deepEqual(readUtm("?utm_source=email&utm_campaign=digest&s=wa", "/p/abc"), {
      utm_source: "email",
      utm_campaign: "digest",
    });
    assert.equal(readUtm("?utm_source=%20%20&ref=x"), null);
    assert.equal(readUtm(""), null);
    assert.equal(readUtm(`?utm_term=${"a".repeat(300)}`)?.utm_term?.length, 100);
  });
});

describe("the code leaves the address bar once it is read", () => {
  it("drops only the code", () => {
    assert.equal(
      withoutShareChannel("https://s.example/p/abc?comment=c1&s=wa#top"),
      "https://s.example/p/abc?comment=c1#top"
    );
  });

  it("says there is nothing to change when there is no code", () => {
    assert.equal(withoutShareChannel("https://s.example/p/abc?comment=c1"), null);
    assert.equal(withoutShareChannel("not a url"), null);
  });
});

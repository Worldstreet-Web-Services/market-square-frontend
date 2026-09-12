import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseParticipantMeta,
  participantName,
} from "../features/houses/lib/participant-meta.ts";

/**
 * The token's metadata is the ONLY place a house learns who is in the room —
 * an audience member has no speaker-request row and no chat message. It also
 * arrives over the media plane, alongside packets peers can write, so it is
 * treated as hostile: nothing is trusted for its type, its length or its
 * scheme.
 */
describe("parseParticipantMeta", () => {
  const full = JSON.stringify({
    username: "ada",
    avatarUrl: "https://cdn.test/a.png",
    bio: "Builds radios",
    role: "creator",
    verification: "verified",
    orgBadge: "ark",
    isFollowing: true,
  });

  it("reads a well-formed payload", () => {
    assert.deepEqual(parseParticipantMeta(full), {
      username: "ada",
      avatarUrl: "https://cdn.test/a.png",
      bio: "Builds radios",
      role: "creator",
      verification: "verified",
      orgBadge: "ark",
      isFollowing: true,
    });
  });

  it("is null when backend B1 has not shipped", () => {
    // Null is the signal every caller degrades on. It must never be papered
    // over with an empty object: "we do not know who this is" and "a person
    // with no name" have to render differently.
    for (const input of [undefined, null, "", "{", "[]", '"ada"', "null", "7"]) {
      assert.equal(parseParticipantMeta(input as string | null | undefined), null, String(input));
    }
  });

  it("is null without a username, because there is then no profile to open", () => {
    assert.equal(parseParticipantMeta(JSON.stringify({ bio: "hi", role: "creator" })), null);
    assert.equal(parseParticipantMeta(JSON.stringify({ username: "   " })), null);
    assert.equal(parseParticipantMeta(JSON.stringify({ username: 42 })), null);
  });

  it("drops an avatar URL whose scheme we did not vet", () => {
    // This value becomes an <img src> in front of the whole room.
    for (const avatarUrl of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "//evil.test/a.png",
      "file:///etc/passwd",
      42,
    ]) {
      const meta = parseParticipantMeta(JSON.stringify({ username: "ada", avatarUrl }));
      assert.equal(meta?.avatarUrl, null, String(avatarUrl));
    }
  });

  it("keeps a relative path and an https URL", () => {
    assert.equal(
      parseParticipantMeta(JSON.stringify({ username: "ada", avatarUrl: "/avatar/1.png" }))
        ?.avatarUrl,
      "/avatar/1.png"
    );
    assert.equal(
      parseParticipantMeta(JSON.stringify({ username: "ada", avatarUrl: "http://cdn.test/a.png" }))
        ?.avatarUrl,
      "http://cdn.test/a.png"
    );
  });

  it("refuses an unknown role, badge or verification rather than rendering it", () => {
    const meta = parseParticipantMeta(
      JSON.stringify({
        username: "ada",
        role: "administrator",
        orgBadge: "government",
        verification: "super",
      })
    );
    assert.equal(meta?.role, "citizen");
    assert.equal(meta?.orgBadge, null);
    assert.equal(meta?.verification, "none");
  });

  it("drops a bio long enough to flood a row", () => {
    const meta = parseParticipantMeta(
      JSON.stringify({ username: "ada", bio: "x".repeat(5000) })
    );
    assert.equal(meta?.bio, "");
  });

  it("leaves isFollowing UNDEFINED when the payload does not carry the edge", () => {
    // Defaulting it to false would render a "People you follow" band quietly
    // claiming you follow nobody in the room.
    assert.equal(parseParticipantMeta(JSON.stringify({ username: "ada" }))?.isFollowing, undefined);
    assert.equal(
      parseParticipantMeta(JSON.stringify({ username: "ada", isFollowing: "yes" }))?.isFollowing,
      undefined
    );
    assert.equal(
      parseParticipantMeta(JSON.stringify({ username: "ada", isFollowing: false }))?.isFollowing,
      false
    );
  });
});

describe("participantName", () => {
  it("passes a real name through, trimmed", () => {
    assert.equal(participantName("  Ada Nwosu "), "Ada Nwosu");
  });

  it("falls through to participantLabel for anything unusable", () => {
    assert.equal(participantName(null), null);
    assert.equal(participantName(""), null);
    assert.equal(participantName("x".repeat(500)), null);
  });
});

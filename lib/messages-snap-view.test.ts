import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canSendSnap, isSnap, snapTimeLeft, snapView } from "../features/messages/lib/snap-view.ts";
import { flattenMessageMedia } from "../features/messages/lib/message-media.ts";

const ME = "did:privy:me";
const THEM = "did:privy:them";
const theirs = { viewOnce: true, mediaKind: "image", senderId: THEM };
const mine = { viewOnce: true, mediaKind: "image", senderId: ME };

describe("A snap is seen once, and the bubble says which", () => {
  it("leaves an ordinary attachment alone", () => {
    assert.equal(isSnap({ viewOnce: false, mediaKind: "image" }), false);
    assert.equal(snapView({ mediaKind: "image", senderId: THEM }, { meId: ME }), null);
  });

  it("offers the tap that spends it, once", () => {
    const fresh = snapView(theirs, { meId: ME });
    assert.equal(fresh?.state, "unopened");
    assert.equal(fresh?.label, "Tap to view photo");
    assert.equal(fresh?.openable, true);

    const clip = snapView({ ...theirs, mediaKind: "video" }, { meId: ME });
    assert.equal(clip?.label, "Tap to view video");
    assert.equal(clip?.kind, "video");
  });

  it("stops offering it once this reader has opened it", () => {
    const spent = snapView({ ...theirs, openedByMe: true }, { meId: ME });
    assert.equal(spent?.state, "spent");
    assert.equal(spent?.label, "Opened");
    assert.equal(spent?.openable, false);
  });

  it("trusts the service's destruction over this browser's memory", () => {
    // The file is gone; there is nothing to open however the stamp reads.
    const gone = snapView({ ...theirs, openedByMe: false, destroyedAt: "2026-09-19T10:00:00Z" }, { meId: ME });
    assert.equal(gone?.openable, false);
    assert.equal(gone?.state, "spent");
  });

  it("takes the thread's own `mine`, which is the fact that component holds", () => {
    assert.equal(snapView(theirs, { mine: false })?.openable, true);
    assert.equal(snapView(mine, { mine: true })?.label, "Delivered");
  });

  it("tells the sender whether it has been opened, and never offers them a tap", () => {
    const waiting = snapView(mine, { meId: ME });
    assert.equal(waiting?.label, "Delivered");
    assert.equal(waiting?.openable, false);

    const seen = snapView({ ...mine, openedByPeer: true }, { meId: ME });
    assert.equal(seen?.label, "Opened");
    assert.equal(seen?.openable, false);
  });

  it("never claims the other side opened it on a missing answer", () => {
    const unknown = snapView({ ...mine, openedByPeer: null }, { meId: ME });
    assert.equal(unknown?.state, "delivered");
  });
});

describe("What may be sent as a snap", () => {
  it("is a photo or a clip, in a one-to-one", () => {
    assert.equal(canSendSnap({ conversationKind: "direct", mediaKind: "image" }), true);
    assert.equal(canSendSnap({ conversationKind: "direct", mediaKind: "video" }), true);
  });

  it("is never a group, where the first to open would destroy it for everybody", () => {
    assert.equal(canSendSnap({ conversationKind: "group", mediaKind: "image" }), false);
  });

  it("is never a voice note, a document or an untyped upload", () => {
    assert.equal(canSendSnap({ conversationKind: "direct", mediaKind: "audio" }), false);
    assert.equal(canSendSnap({ conversationKind: "direct", mediaKind: "file" }), false);
    assert.equal(canSendSnap({ conversationKind: "direct", mediaKind: null }), false);
  });
});

describe("How long is left before the file is deleted", () => {
  const NOW = Date.parse("2026-09-19T12:00:00.000Z");

  it("counts down to the instant the service names", () => {
    assert.equal(snapTimeLeft("2026-09-19T12:05:00.000Z", NOW), 300_000);
  });

  it("is zero, never negative, once it has passed", () => {
    assert.equal(snapTimeLeft("2026-09-19T11:59:00.000Z", NOW), 0);
  });

  it("is null when no deadline was given, so the viewer is not closed on a guess", () => {
    // A second open, or a service that does not send one.
    assert.equal(snapTimeLeft(null, NOW), null);
    assert.equal(snapTimeLeft(undefined, NOW), null);
    assert.equal(snapTimeLeft("shortly", NOW), null);
  });
});

describe("A snap's media flattens, though it carries no url", () => {
  it("accepts the media object the service actually sends for an unopened snap", () => {
    // THIS SHIPPED BROKEN ONCE. `media.url` was required in MessageSchema, so
    // the first snap sent made the send response fail to parse: the service
    // created the message and answered 201, and the composer still said
    // "Couldn't send that message". The url is withheld on purpose and only
    // ever arrives from the open route. The schema itself is pinned in
    // lib/shell-invariants.test.ts, which can read files this cannot import.
    const flat = flattenMessageMedia({ kind: "image", width: 1080, height: 1920, sizeBytes: 857000 });
    assert.equal(flat.mediaUrl, null);
    assert.equal(flat.mediaKind, "image");
  });
});

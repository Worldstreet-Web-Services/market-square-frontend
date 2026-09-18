import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canSendSnap, isSnap, snapView } from "../features/messages/lib/snap-view.ts";

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

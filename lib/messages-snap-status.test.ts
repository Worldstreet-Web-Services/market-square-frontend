import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { snapStatus } from "../features/messages/lib/snap-status.ts";

const ME = "did:privy:me";
const THEM = "did:privy:them";

const photo = { mediaUrl: "https://cdn/p.jpg", mediaKind: "image", senderId: THEM };
const clip = { mediaUrl: "https://cdn/c.mp4", mediaKind: "video", senderId: THEM };
const note = { mediaUrl: "https://cdn/v.m4a", mediaKind: "audio", senderId: THEM };
const doc = { mediaUrl: "https://cdn/d.pdf", mediaKind: "file", senderId: THEM };
const words = { text: "hey", senderId: THEM };

describe("The inbox says what arrived and whether it has been opened", () => {
  it("names the kind rather than calling everything an attachment", () => {
    const seen = [photo, clip, note, doc, words].map(
      (last) => snapStatus({ last, meId: ME, unreadCount: 1 })?.label
    );
    assert.deepEqual(seen, ["New Photo", "New Video", "New Voice note", "New Attachment", "New Chat"]);
  });

  it("reads a captioned photo as a photo, which is what was sent", () => {
    const status = snapStatus({ last: { ...photo, text: "look at this" }, meId: ME, unreadCount: 1 });
    assert.equal(status?.kind, "photo");
  });

  it("is solid until it is opened, at the reader's end", () => {
    const fresh = snapStatus({ last: photo, meId: ME, unreadCount: 2 });
    assert.equal(fresh?.filled, true);
    assert.equal(fresh?.state, "new");

    const read = snapStatus({ last: photo, meId: ME, unreadCount: 0 });
    assert.equal(read?.filled, false);
    assert.equal(read?.label, "Opened");
  });

  it("is solid until it is opened at the OTHER end, for something the reader sent", () => {
    const mine = { ...photo, senderId: ME };
    const waiting = snapStatus({ last: mine, meId: ME, unreadCount: 0 });
    assert.equal(waiting?.label, "Delivered");
    assert.equal(waiting?.filled, true);

    const opened = snapStatus({ last: { ...mine, readByAll: true }, meId: ME, unreadCount: 0 });
    assert.equal(opened?.label, "Opened");
    assert.equal(opened?.filled, false);
  });

  it("never claims a message was opened on a missing answer", () => {
    // `readByAll` absent is "we do not know", and the row must not invent an
    // Opened the sender would act on.
    const status = snapStatus({ last: { ...photo, senderId: ME }, meId: ME, unreadCount: 0 });
    assert.equal(status?.state, "delivered");
  });

  it("does not read the reader's own unread count as their own message being new", () => {
    // Their own message can sit in a thread that has unread replies under it.
    const status = snapStatus({ last: { ...photo, senderId: ME }, meId: ME, unreadCount: 5 });
    assert.equal(status?.state, "delivered");
  });

  it("prefers the service's per-message stamp over the thread watermark", () => {
    // The watermark says the reader has been into the thread; the stamp says
    // they opened THIS message. They disagree when a thread is opened without
    // reaching the newest message, and the stamp wins.
    const stamped = snapStatus({
      last: { ...photo, openedByMe: false },
      meId: ME,
      unreadCount: 0,
    });
    assert.equal(stamped?.state, "new");

    const mine = { ...photo, senderId: ME };
    const peerOpened = snapStatus({
      last: { ...mine, openedByPeer: true, readByAll: false },
      meId: ME,
      unreadCount: 0,
    });
    assert.equal(peerOpened?.label, "Opened");
  });

  it("reads a missing stamp as 'no stamp', never as 'not opened'", () => {
    // A service that has not shipped the stamps still draws a correct row.
    const read = snapStatus({ last: { ...photo, openedByMe: null }, meId: ME, unreadCount: 0 });
    assert.equal(read?.state, "opened");
    const unread = snapStatus({ last: { ...photo, openedByMe: null }, meId: ME, unreadCount: 3 });
    assert.equal(unread?.state, "new");
  });

  it("names a snap a snap, with no url to go on", () => {
    // The service sends a snap's kind and withholds its url on purpose. Without
    // reading the typed kind the row would call a photo "New Chat".
    const snap = snapStatus({
      last: { viewOnce: true, mediaKind: "image", senderId: THEM },
      meId: ME,
      unreadCount: 1,
    });
    assert.equal(snap?.kind, "photo");
    assert.equal(snap?.label, "New Snap");
  });

  it("says nothing at all about an empty thread or a removed message", () => {
    assert.equal(snapStatus({ last: null, meId: ME, unreadCount: 0 }), null);
    assert.equal(snapStatus({ last: { ...photo, status: "removed" }, meId: ME, unreadCount: 1 }), null);
  });

  it("falls back to the URL when the service typed nothing, like every other reader", () => {
    const sniffed = snapStatus({
      last: { mediaUrl: "https://cdn/clip.mp4", senderId: THEM },
      meId: ME,
      unreadCount: 1,
    });
    assert.equal(sniffed?.kind, "video");
  });

  it("treats a signed-out or unknown reader as the receiving end", () => {
    // No id means we cannot claim authorship, and "Delivered" on somebody
    // else's message would be nonsense.
    const status = snapStatus({ last: photo, meId: null, unreadCount: 1 });
    assert.equal(status?.state, "new");
  });
});

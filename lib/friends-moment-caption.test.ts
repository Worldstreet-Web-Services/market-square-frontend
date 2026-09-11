import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendsMomentCaption, type FriendsMoment } from "./friends-popup.ts";

const moment = (kind: FriendsMoment["kind"]): FriendsMoment => ({
  kind,
  actor: { id: "u1", username: "fola", displayName: "Fola", avatarUrl: null },
  notificationIds: ["n1"],
});

describe("the caption a friends card is posted with", () => {
  it("speaks in the poster's voice and names the other person by handle", () => {
    assert.equal(friendsMomentCaption(moment("friends")), "@fola and I are now friends on Square 💜");
    assert.equal(friendsMomentCaption(moment("mutual-wink")), "@fola and I winked at each other on Square 😉");
    assert.equal(friendsMomentCaption(moment("wink")), "@fola winked at me on Square 😉");
  });
});

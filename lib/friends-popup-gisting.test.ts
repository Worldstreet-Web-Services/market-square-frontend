import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * "START GISTING" MUST NOT CLOSE THE POPUP BEFORE THE THREAD EXISTS.
 *
 * A source assertion, because the bug is an ORDERING inside an event handler:
 * it type-checks, it lints, and no pure function contains it.
 *
 * `onClose` empties the fan, and an empty fan makes `FriendsPopup` return
 * early — which unmounts `FriendsDialog` and the `useOpenConversation` observer
 * it holds. TanStack Query drops callbacks passed to `mutate()` once their
 * component is gone, so calling `onClose()` first created the conversation on
 * the server and silently lost the `router.push` to it. The popup closed,
 * nothing opened, and the button looked dead.
 *
 * Wink back and Follow back never had this bug because they need nothing after
 * the request; that is exactly why it survived — every other action on the
 * same card worked.
 */
describe("Start gisting reaches the thread", () => {
  const source = readFileSync(
    new URL("../components/layout/friends-popup.tsx", import.meta.url),
    "utf8"
  );
  const start = source.indexOf("const startGisting = () => {");
  const end = source.indexOf("const winkBack = () => {");
  const handler = source.slice(start, end).replace(/\/\/[^\n]*/g, "");

  it("was found, so this test cannot pass on a rename", () => {
    assert.ok(start >= 0 && end > start, "startGisting was not located in friends-popup.tsx");
  });

  it("closes only inside the success callback", () => {
    const mutate = handler.indexOf("chat.mutate(");
    const success = handler.indexOf("onSuccess");
    const close = handler.indexOf("onClose()");
    assert.ok(mutate >= 0, "startGisting no longer opens a conversation");
    assert.ok(close >= 0, "startGisting no longer closes the popup");
    assert.ok(
      close > success && success > mutate,
      "onClose() must run inside onSuccess — closing first unmounts the dialog and drops the navigation"
    );
  });

  it("navigates in the same callback that closes", () => {
    const success = handler.indexOf("onSuccess");
    const push = handler.indexOf("router.push(");
    assert.ok(push > success, "the navigation must be in onSuccess, beside the close");
  });
});

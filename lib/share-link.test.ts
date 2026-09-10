import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shareLink } from "./share-link.ts";

const clipboardOnly = (writeText: () => Promise<void>) =>
  ({ clipboard: { writeText } }) as unknown as Pick<Navigator, "share" | "clipboard">;

describe("shareLink", () => {
  it("uses the device's share sheet when there is one", async () => {
    let got: unknown;
    const nav = {
      share: async (data: unknown) => void (got = data),
      clipboard: { writeText: async () => assert.fail("should not have copied") },
    } as unknown as Pick<Navigator, "share" | "clipboard">;
    const result = await shareLink({ url: "https://x.test/p/1", title: "Hi" }, { navigatorImpl: nav });
    assert.equal(result, "shared");
    assert.deepEqual(got, { url: "https://x.test/p/1", title: "Hi", text: undefined });
  });

  it("copies the link where there is no share sheet", async () => {
    let copied = "";
    let told = false;
    const result = await shareLink(
      { url: "https://x.test/p/1" },
      { navigatorImpl: clipboardOnly(async () => void (copied = "https://x.test/p/1")), onCopied: () => (told = true) }
    );
    assert.equal(result, "copied");
    assert.equal(copied, "https://x.test/p/1");
    assert.ok(told, "the reader was not told the link was copied");
  });

  it("treats a DISMISSED share sheet as nothing happening", async () => {
    /*
      Closing the sheet rejects with AbortError. Falling back to the clipboard
      there would copy a link somebody just declined to share, and reporting it
      would tell them their deliberate "no thanks" had failed.
    */
    let copied = false;
    const nav = {
      share: async () => {
        throw Object.assign(new Error("cancelled"), { name: "AbortError" });
      },
      clipboard: { writeText: async () => void (copied = true) },
    } as unknown as Pick<Navigator, "share" | "clipboard">;
    const result = await shareLink({ url: "u" }, { navigatorImpl: nav });
    assert.equal(result, "cancelled");
    assert.equal(copied, false, "a dismissed share still copied");
  });

  it("falls back to the clipboard when the share sheet genuinely fails", async () => {
    let copied = false;
    const nav = {
      share: async () => {
        throw new Error("no handler");
      },
      clipboard: { writeText: async () => void (copied = true) },
    } as unknown as Pick<Navigator, "share" | "clipboard">;
    assert.equal(await shareLink({ url: "u" }, { navigatorImpl: nav }), "copied");
    assert.ok(copied);
  });

  it("says so when neither works", async () => {
    // Safari refuses the clipboard without a user gesture. Silence there would
    // be a lie: nothing has happened and the reader thinks it has.
    let failed = false;
    const result = await shareLink(
      { url: "u" },
      {
        navigatorImpl: clipboardOnly(async () => {
          throw new Error("denied");
        }),
        onFailed: () => (failed = true),
      }
    );
    assert.equal(result, "failed");
    assert.ok(failed, "the reader was not told nothing happened");
  });

  it("does not throw where there is no navigator at all", async () => {
    assert.equal(await shareLink({ url: "u" }, { navigatorImpl: undefined }), "failed");
  });
});

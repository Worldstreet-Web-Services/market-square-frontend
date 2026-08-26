import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseComposePrefill } from "./compose-prefill.ts";

const parse = (link: string | null, label: string | null = null, text: string | null = null) =>
  parseComposePrefill({ link, label, text });

describe("compose prefill — accepted shares", () => {
  it("accepts a store item, which is the ARK Store share path", () => {
    assert.deepEqual(parse("store_item:abc-123").link, { kind: "store_item", ref: "abc-123" });
  });

  it("keeps a full URL intact, splitting on the FIRST colon only", () => {
    // Splitting on every colon truncates https://x/y to "https".
    assert.deepEqual(parse("external:https://ark.example/orders/9").link, {
      kind: "external",
      ref: "https://ark.example/orders/9",
    });
  });

  it("accepts the Ark product kinds a share can name", () => {
    for (const kind of ["stream", "profile", "listing", "market", "game"]) {
      assert.equal(parse(`${kind}:ref`).link?.kind, kind, `${kind} must be shareable`);
    }
  });

  it("carries a label and body text through", () => {
    const result = parse("store_item:abc", "Creator Kit", "just picked this up");
    assert.equal(result.label, "Creator Kit");
    assert.equal(result.text, "just picked this up");
  });
});

describe("compose prefill — hostile input", () => {
  /**
   * The reason this module exists. An `external` ref becomes an anchor href,
   * so an unchecked scheme is stored XSS wearing the author's name the moment
   * the post is published.
   */
  it("refuses script and data URLs", () => {
    for (const ref of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      assert.equal(parse(`external:${ref}`).link, null, `${ref} must not survive`);
    }
  });

  it("refuses a protocol-relative authority", () => {
    assert.equal(parse("external://attacker.example/steal").link, null);
  });

  it("refuses a kind that is not on the allowlist", () => {
    assert.equal(parse("admin:1").link, null);
    assert.equal(parse("store_item_evil:1").link, null);
  });

  it("refuses a malformed target rather than guessing", () => {
    for (const raw of ["", ":", "nocolon", ":leading", "trailing:"]) {
      assert.equal(parse(raw).link, null, `${JSON.stringify(raw)} must not resolve`);
    }
  });

  it("caps an absurd ref instead of accepting it", () => {
    assert.equal(parse(`store_item:${"a".repeat(5000)}`).link, null);
  });

  it("truncates rather than rejects overlong text, so the composer still opens", () => {
    const result = parse(null, null, "x".repeat(5000));
    assert.equal(result.text?.length, 500);
  });

  it("drops the label when the link is rejected, never leaving it orphaned", () => {
    const result = parse("javascript:alert(1)", "Totally Safe Thing");
    assert.equal(result.link, null);
    assert.equal(result.label, null);
  });

  it("a bad share opens an empty composer rather than blocking it", () => {
    assert.deepEqual(parse("garbage"), { link: null, label: null, text: null });
  });
});

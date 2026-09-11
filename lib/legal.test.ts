import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMUNITY_GUIDELINES, PRIVACY_POLICY, type LegalDocument } from "./legal.ts";

const text = (doc: LegalDocument) =>
  doc.sections.flatMap((section) => [section.heading, ...(section.paragraphs ?? []), ...(section.points ?? [])]).join(" ");

describe("the Help Centre's policy pages", () => {
  it("are real documents: dated, sectioned, no empty section", () => {
    for (const doc of [PRIVACY_POLICY, COMMUNITY_GUIDELINES]) {
      assert.match(doc.updated, /^Updated \d{1,2} \w+, \d{4}$/);
      assert.ok(doc.sections.length >= 5, `${doc.title} is too thin`);
      for (const section of doc.sections) {
        assert.ok((section.paragraphs?.length ?? 0) + (section.points?.length ?? 0) > 0, `${doc.title}: "${section.heading}" is empty`);
      }
      assert.equal(new Set(doc.sections.map((section) => section.heading)).size, doc.sections.length, `${doc.title} repeats a heading`);
    }
  });

  it("promise only what Square does: no tracked location, no push or email", () => {
    const privacy = text(PRIVACY_POLICY);
    assert.match(privacy, /does not track where you are/);
    assert.match(privacy, /support@tsionark\.com/);
    assert.doesNotMatch(privacy, /push notification|by email/i);
  });
});

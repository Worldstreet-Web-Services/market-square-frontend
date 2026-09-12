import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/**
 * The app sent no security headers at all until 2026-09-12. The one that
 * matters most here is the framing defence: Square's controls send tips, buy
 * KASH and confirm gifts, so a page that can be framed invisibly is a page
 * whose buttons can be borrowed.
 */
describe("the app refuses to be framed", () => {
  it("denies framing two ways, so an older browser is covered too", () => {
    assert.match(config, /key: "X-Frame-Options", value: "DENY"/);
    assert.match(config, /key: "Content-Security-Policy", value: "frame-ancestors 'none'"/);
  });

  it("keeps frame-ancestors in the report-only policy as well", () => {
    // The framing defence must not depend on the full CSP being finished.
    assert.match(config, /"frame-ancestors 'none'",/);
  });

  it("carries the cheap hardening headers", () => {
    assert.match(config, /X-Content-Type-Options", value: "nosniff"/);
    assert.match(config, /Referrer-Policy", value: "strict-origin-when-cross-origin"/);
    assert.match(config, /Strict-Transport-Security/);
    // A gist room needs the mic on this origin; nothing else does.
    assert.match(config, /camera=\(self\), microphone=\(self\), geolocation=\(\), payment=\(\)/);
  });

  it("applies them to every route, not just the home page", () => {
    assert.match(config, /source: "\/:path\*"/);
  });

  it("leaves the full policy REPORT-ONLY until its origins are proven", () => {
    // Enforcing script-src/connect-src blind breaks sign-in or the live room
    // in production rather than degrading. Report first, enforce after.
    assert.match(config, /Content-Security-Policy-Report-Only/);
  });
});

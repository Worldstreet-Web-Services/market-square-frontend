import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HTML_LIMITED_BOT_UA_RE } from "../node_modules/next/dist/shared/lib/router/utils/html-bots.js";
import { SITE_ORIGIN, siteOrigin } from "./og-metadata.ts";

describe("the origin link previews resolve against", () => {
  it("is the real domain in production and anywhere that is not a preview", () => {
    assert.equal(siteOrigin({ VERCEL_ENV: "production", VERCEL_URL: "square-abc.vercel.app" }), SITE_ORIGIN);
    assert.equal(siteOrigin({}), SITE_ORIGIN);
    assert.equal(siteOrigin({ VERCEL_ENV: "development", VERCEL_URL: "localhost:3000" }), SITE_ORIGIN);
  });

  it("is the preview's own host on a Vercel preview, so a test there scrapes that build", () => {
    assert.equal(
      siteOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "market-square-frontend-qp55qywzf.vercel.app" }),
      "https://market-square-frontend-qp55qywzf.vercel.app"
    );
  });

  it("refuses a host that is not a bare hostname", () => {
    for (const bad of ["evil.com/path", "https://evil.com", "evil.com:443", "", "  "]) {
      assert.equal(siteOrigin({ VERCEL_ENV: "preview", VERCEL_URL: bad }), SITE_ORIGIN, bad);
    }
  });
});

describe("the preview crawlers Next renders <head> for", () => {
  const ours = new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Pinterestbot|Mastodon|Snap URL Preview|Viber`, "i");
  const crawlers: Record<string, string> = {
    WhatsApp: "WhatsApp/2.23.20.0 A",
    Facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    X: "Twitterbot/1.0",
    Telegram: "TelegramBot (like TwitterBot)",
    Slack: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    Discord: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    LinkedIn: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    iMessage: "Mozilla/5.0 (Macintosh) Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    Pinterest: "Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)",
  };

  it("matches every crawler a Square link is pasted into", () => {
    for (const [name, ua] of Object.entries(crawlers)) assert.ok(ours.test(ua), name);
  });

  it("does not treat an ordinary browser as a bot", () => {
    assert.equal(
      ours.test("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"),
      false
    );
  });
});

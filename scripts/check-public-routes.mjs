#!/usr/bin/env node
/**
 * Public-route drift check.
 *
 * The BFF decides which GETs a signed-out visitor may read (`isPublicGet` in
 * lib/api/public-routes.ts). The BACKEND decides the same thing, in its
 * OpenAPI document: a GET is public exactly when its operation carries no
 * `security` requirement. When those two disagree, one of two things happens
 * and neither is visible in review:
 *
 *   - backend public, BFF gated   → signed-out visitors get a 401 on content
 *                                   that was meant to be open. This has now
 *                                   happened three times: `categories`,
 *                                   `search`, `topics` — each found only when
 *                                   somebody hit the 401 by hand.
 *   - backend secured, BFF public → we forward unauthenticated requests
 *                                   upstream instead of refusing them here.
 *
 * This script diffs the two in BOTH directions and exits non-zero on any
 * disagreement.
 *
 * USAGE
 *   pnpm check:public-routes                      # local, http://localhost:8080
 *   MS_API_BASE=https://api.example.com pnpm check:public-routes
 *   pnpm check:public-routes --base https://api.example.com
 *
 * The base is the API ROOT; the script appends /v1/market-square/openapi.json.
 *
 * It needs a reachable backend, so it is NOT part of `pnpm test`. The
 * hand-written table in lib/api/public-routes.test.ts covers the same ground
 * offline and runs in CI; this catches drift the table has not been told
 * about yet. Keep both.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const argBase = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : null;
const BASE = (argBase || process.env.MS_API_BASE || "http://localhost:8080").replace(/\/+$/, "");
const SPEC_URL = `${BASE}/v1/market-square/openapi.json`;

/**
 * Evaluate the real `isPublicGet` without a bundler.
 *
 * The source is plain TypeScript whose only syntax beyond JS is type
 * annotations, so stripping them is enough to run the ACTUAL predicate rather
 * than a copy that could itself drift.
 */
async function loadPredicate() {
  const file = join(root, "lib/api/public-routes.ts");
  const source = readFileSync(file, "utf8")
    .replace(/^export /gm, "")
    .replace(/: string\[\]/g, "")
    .replace(/: string/g, "")
    .replace(/: boolean/g, "")
    .replace(/\)\s*:\s*boolean/g, ")");
  const loaded = await import(
    `data:text/javascript,${encodeURIComponent(`${source}\nexport { isPublicGet, isSafePath };`)}`
  );
  return loaded.isPublicGet;
}

/**
 * Known, DELIBERATE disagreements between the spec and our predicate.
 *
 * Only for cases where the backend's document and the backend's behaviour
 * disagree with each other — never to silence a real drift. Each entry needs a
 * reason and an owner, and should be deleted the moment the backend resolves
 * it. Anything not listed here still fails the check.
 */
const KNOWN_MISMATCHES = {
  "/spotlight": {
    reason:
      "Spec marks it bearerAuth, but the gateway serves it 200 unauthenticated " +
      "and the Citizen Spotlight rail renders on every page for signed-out " +
      "visitors. Gating it here would regress a working public surface. " +
      "Backend to reconcile its spec with its implementation (2026-08-26).",
  },
};

/** Turn "/streams/{id}/chat" into the segment shape the predicate sees. */
function segments(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith("{") ? "id" : segment));
}

async function main() {
  let spec;
  try {
    const response = await fetch(SPEC_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    spec = await response.json();
  } catch (error) {
    console.error(`✗ Could not read the spec at ${SPEC_URL}\n  ${error.message}`);
    console.error("  Start the backend, or pass --base / MS_API_BASE.");
    process.exit(2);
  }

  if (!spec.paths) {
    console.error(`✗ ${SPEC_URL} returned no \`paths\` — is that the OpenAPI document?`);
    process.exit(2);
  }

  const isPublicGet = await loadPredicate();
  const shouldBePublic = [];
  const shouldBeGated = [];
  const acknowledged = [];
  let checked = 0;

  for (const [path, operations] of Object.entries(spec.paths)) {
    const get = operations.get;
    if (!get) continue;
    checked += 1;
    const specPublic = !get.security || get.security.length === 0;
    const oursPublic = isPublicGet(segments(path));
    if (specPublic === oursPublic) continue;
    if (KNOWN_MISMATCHES[path]) {
      acknowledged.push(path);
      continue;
    }
    if (specPublic && !oursPublic) shouldBePublic.push(path);
    if (!specPublic && oursPublic) shouldBeGated.push(path);
  }

  for (const path of acknowledged) {
    console.warn(`! known mismatch, not failing: ${path}\n    ${KNOWN_MISMATCHES[path].reason}`);
  }

  if (shouldBePublic.length === 0 && shouldBeGated.length === 0) {
    console.log(
      `✓ isPublicGet agrees with ${SPEC_URL} on all ${checked} GET operations` +
        (acknowledged.length > 0 ? ` (${acknowledged.length} known mismatch acknowledged).` : ".")
    );
    return;
  }

  console.error(`✗ isPublicGet disagrees with ${SPEC_URL}\n`);
  if (shouldBePublic.length > 0) {
    console.error("  PUBLIC upstream, but GATED by our BFF");
    console.error("  → signed-out visitors get a 401 on content meant to be open.");
    console.error("    Add these to isPublicGet (and to the test table):");
    for (const path of shouldBePublic) console.error(`      + ${path}`);
    console.error("");
  }
  if (shouldBeGated.length > 0) {
    console.error("  SECURED upstream, but treated as PUBLIC by our BFF");
    console.error("  → we forward unauthenticated requests instead of refusing them.");
    console.error("    Remove these from isPublicGet:");
    for (const path of shouldBeGated) console.error(`      - ${path}`);
    console.error("");
  }
  process.exit(1);
}

await main();

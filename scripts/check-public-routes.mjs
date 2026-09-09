#!/usr/bin/env node
/**
 * Public-route drift check.
 *
 * The BFF decides which GETs a signed-out visitor may read (`isPublicGet` in
 * lib/api/public-routes.ts). The BACKEND decides the same thing, in its
 * OpenAPI document — see `specAllowsAnonymous` below for the exact rule.
 * When those two disagree, one of two things happens and neither is visible
 * in review:
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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

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
 *
 * EMPTY IS THE CORRECT STATE. `/spotlight` lived here while the spec claimed
 * bearerAuth on a route the gateway served 200 unauthenticated; the backend
 * reconciled the two on 2026-08-26 and the entry went with it. An allowance
 * that outlives its bug stops being an allowance and becomes furniture.
 */
const KNOWN_MISMATCHES = {};

/**
 * Does the spec let an ANONYMOUS caller make this request?
 *
 * `security` is a list of ALTERNATIVES, OR'd together — satisfying any one of
 * them admits the request. An **empty object** is the alternative that
 * requires nothing, so `[{}, { bearerAuth: [] }]` reads as "either sign in or
 * do not": optional auth, i.e. public. That is exactly the shape of every
 * public GET in Market Square, because a public read still forwards the
 * caller's token when there is one so `likedByMe` keeps resolving.
 *
 * This was previously `!get.security || get.security.length === 0`, which
 * treated any non-empty array as gated. The day the backend started spelling
 * optional auth out properly, that predicate reported twelve false failures —
 * including `/feed` and `/search` — and the check reads as broken exactly when
 * it should read as green. An omitted `security` still inherits the document's
 * root default, so that is honoured too rather than assumed public.
 */
function specAllowsAnonymous(operation, rootSecurity) {
  const requirements = operation.security ?? rootSecurity;
  if (!requirements || requirements.length === 0) return true;
  return requirements.some((alternative) => Object.keys(alternative).length === 0);
}

/** Turn "/streams/{id}/chat" into the segment shape the predicate sees. */
function segments(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith("{") ? "id" : segment));
}


/* ---------------------------------------------------------------------------
   PHANTOM ROUTES

   The public/gated diff above can only judge routes the spec DOCUMENTS. A path
   the frontend calls that the spec has never heard of is invisible to it — and
   that is its own recurring failure: `search`, `quote`, `mentions` and
   `operations` were all called from the client before they existed upstream,
   each surfacing as a mystery 404 in somebody's console rather than as a
   build-time error.

   Every request in this app goes through `msApi.<method>("/path")`, so the
   call sites are cheap to read without a bundler or a type checker: collect
   them, normalise `${...}` interpolations and `{param}` placeholders to the
   same `{}` token, and diff against the spec's documented method+path pairs.
--------------------------------------------------------------------------- */

/** `/streams/${id}/chat` and `/streams/{id}/chat` both become `/streams/{}/chat`. */
function normalisePath(path) {
  return path
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "");
}

function sourceFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

// msApi.get("/x") | msApi.authedGet<T>(`/y/${id}`) | msApi.del<{a:b}>("/z")
const CALL = /msApi\s*\.\s*(get|authedGet|post|put|patch|del)\s*(?:<[^>]*>)?\s*\(\s*([`"'])([^`"']+)\2/g;

// The upload path does not go through `msApi` — it needs multipart and its own
// progress handling, so it calls the BFF prefix directly. Reading only msApi
// would leave those three routes unchecked, which is the same blind spot in
// miniature.
const RAW_CALL = /fetch\s*\(\s*([`"'])\/api\/market-square([^`"']+)\1/g;

const METHOD_OF = {
  get: "get",
  authedGet: "get",
  post: "post",
  put: "put",
  patch: "patch",
  del: "delete",
};

/**
 * Routes the BFF ANSWERS ITSELF instead of proxying upstream.
 *
 * These will never appear in the backend's spec, and that is correct rather
 * than a gap — so flagging them would train everyone to ignore the check. Each
 * entry says what the BFF does with it; a route that stops being handled
 * locally must come off this list.
 */
const BFF_HANDLED = {
  "get /mentions/search": {
    reason:
      "Answered by app/api/market-square/[...path]/route.ts, not proxied. " +
      "There is no upstream mentions endpoint: the BFF rewrites onto " +
      "/search?type=people and reshapes the result into mention targets. The " +
      "request never reaches the service, so the spec has nothing to say.",
  },
};

function collectCalls(root) {
  const calls = new Map();
  for (const dir of ["features", "lib", "hooks", "components", "app"]) {
    let files;
    try {
      files = sourceFiles(join(root, dir));
    } catch {
      continue;
    }
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(CALL)) {
        const method = METHOD_OF[match[1]];
        const path = normalisePath(match[3]);
        const key = `${method} ${path}`;
        if (!calls.has(key)) calls.set(key, relative(root, file));
      }
      // Raw BFF-prefixed fetches. The method is not recoverable from the call
      // site, so these are checked as "some operation exists at this path" —
      // enough to catch a path that does not exist at all, which is the bug.
      for (const match of source.matchAll(RAW_CALL)) {
        const path = normalisePath(match[2]);
        // A path assembled entirely from a variable — `${path}` — has no
        // literal to check. Skipping it is honest: this is a static reader,
        // and a wholly dynamic call site is outside what it can verify.
        // `lib/api/upload.ts` is the only one today, and its three routes
        // (/uploads, /uploads/presign, /uploads/complete) are documented
        // upstream, so nothing is silently unchecked because of it.
        if (path === "" || path === "{}") continue;
        const key = `* ${path}`;
        if (!calls.has(key)) calls.set(key, relative(root, file));
      }
    }
  }
  return calls;
}

/**
 * Paths the frontend calls DELIBERATELY ahead of the backend.
 *
 * Same discipline as KNOWN_MISMATCHES: a reason, and deleted the moment the
 * route ships. Anything not listed here fails the check.
 */
const PENDING_ROUTES = {

  // ── the operations console ────────────────────────────────────────────────
  // `app/operations/page.tsx` renders this slice, and all three of its calls
  // 404 today: no `/operations/*` route exists in market-square's spec, and no
  // service in the monorepo serves that prefix. They are recorded here rather
  // than left as phantoms so the check stays useful — a report that always has
  // three failures in it is a report everybody learns to skip, which is
  // exactly how the chat routes could have rotted unnoticed.
  //
  // THIS IS NOT AN ENDORSEMENT. Either the operations backend ships, or the
  // route and the page that calls it come out. Whoever owns that console
  // should decide; until then the page is a console that cannot load.
  "get /operations/summary": {
    reason:
      "The operations console's dashboard read. No /operations/* route exists " +
      "in market-square's openapi.json and no service in the monorepo serves " +
      "the prefix, so this 404s at runtime today. DELETE THIS ENTRY when the " +
      "operations backend ships, or delete the slice if the console is dead.",
  },
  "patch /operations/cases/{}": {
    reason:
      "Resolves one operations case. Same missing backend as " +
      "get /operations/summary — see that entry.",
  },
  "get /operations/entitlements/{}": {
    reason:
      "Looks up an entitlement by reference. Same missing backend as " +
      "get /operations/summary — see that entry.",
  },

  // ── threaded comments ────────────────────────────────────────────────────
  // Replies, likes and delete shipped and are documented; their entries are
  // gone. This one is SERVED but not yet DOCUMENTED: `GET /comments/{id}`
  // answers 200 anonymously on :8080 (2026-09-09) and the permalink's deep
  // link (`?comment=`) reads it. DELETE THIS ENTRY when it appears in
  // openapi.json.
  "get /comments/{}": {
    reason:
      "One comment by id, for a permalink opened on it. Live on the service " +
      "and absent from its spec document. See features/feed/lib/api.ts.",
  },

  "get /conversations/{}/members": {
    reason:
      "The full member roster of a GROUP conversation. Group threads " +
      "(`kind: 'group'`) are being added to the service now, together with " +
      "POST /conversations/groups and the add/remove member routes; this is " +
      "the read half and the only one the thread pane calls. It is issued " +
      "ONLY when a conversation parses as kind:'group', and today's service " +
      "sends no such conversation at all, so against production this is " +
      "never called. DELETE THIS ENTRY once the group-conversation change is " +
      "deployed and the route appears in openapi.json.",
  },
  "post /posts/{}/tips/{}/transfer": {
    reason:
      "The sender reports the KSH transfer they signed. Built and merged on " +
      "the service (apps/market-square, PR #146) and not yet DEPLOYED, so it " +
      "is absent from the running spec. It is only ever called when " +
      "GET /tips/capability answers settlement:'client-signed', which the " +
      "same undeployed change introduces — so against today's production the " +
      "client takes the rail path and never calls this at all. DELETE THIS " +
      "ENTRY once PR #146 is deployed and the route appears in openapi.json.",
  },
  "post /streams/{}/gifts": {
    reason:
      "Gifting the host of a live stream — a tip addressed to a STREAM, " +
      "settled down the same client-signed path as a post tip. Built on the " +
      "service (apps/market-square, PR #148) and not yet DEPLOYED, so it is " +
      "absent from the running spec. It is only ever called when the tray is " +
      "priced (MARKET_FLAGS.liveGifts), which is off in every environment " +
      "today — against production the gift stays the free on-stream moment " +
      "and this is never called. DELETE THIS ENTRY once PR #148 is deployed.",
  },
  "post /streams/{}/gifts/{}/transfer": {
    reason:
      "The sender reports the KSH transfer they signed for a live gift. " +
      "Ships with PR #148, same gate as the route above: unreachable while " +
      "the tray is unpriced. DELETE THIS ENTRY once PR #148 is deployed.",
  },
  "post /streams/{}/reactions": {
    reason:
      "Records a burst of hearts against a live stream's tally, which is the " +
      "half of a reaction that has to outlive the animation. Built on the " +
      "service (apps/market-square) and not yet DEPLOYED, so it is absent " +
      "from the running spec — until it is, the room draws and broadcasts " +
      "hearts exactly as it does today and the write simply fails silently, " +
      "which is already how a failed heart behaves. DELETE THIS ENTRY once " +
      "the reactions change is deployed and the route appears in " +
      "openapi.json.",
  },
  "post /streams/{}/tickets/{}/transfer": {
    reason:
      "The buyer reports the KSH transfer they signed for a ticket. Built on " +
      "the service (apps/market-square, PR #150) and not yet DEPLOYED, so it " +
      "is absent from the running spec. It is only ever called when a ticket " +
      "comes back carrying `toWallet`, which the same undeployed change " +
      "introduces — against today's production the rail settles the ticket " +
      "server-side and this is never called. DELETE THIS ENTRY once PR #150 " +
      "is deployed and the route appears in openapi.json.",
  },
  "post /profiles/{}/wink": {
    reason:
      "The wink — a one-tap signal of interest addressed to a PERSON, and the " +
      "control Explore's people directory is built around. BUILT on the " +
      "service (apps/market-square: migration 034, ProfileService.wink, " +
      "POST /profiles/:id/wink) together with the person-to-person block it " +
      "depends on (migration 033, POST|DELETE /profiles/:id/block), and not " +
      "yet DEPLOYED — so it is absent from the running production spec while " +
      "being present against a local backend. Until the deploy, a 404 is read " +
      "as 'not deployed' and the control removes itself, the same contract " +
      "Arkmarks and Block already follow; nothing ever reports a wink as sent " +
      "without a 2xx behind it. DELETE THIS ENTRY once the service deploy " +
      "lands and the route appears in openapi.json.",
  },
  "post /profiles/{}/tips": {
    reason:
      "Tipping a PROFILE directly is still not in the spec — only " +
      "post /posts/{}/tips shipped, and it is documented now, so its entry " +
      "here was deleted. The tips slice keeps the profile path because " +
      "TipTarget models both; nothing renders it today (TipButton is only " +
      "composed with kind:'post'). DELETE THIS the day /profiles/{id}/tips " +
      "appears in openapi.json, or delete the profile branch from the slice " +
      "if product decides a tip is always addressed to a post.",
  },
  // EMPTY IS THE CORRECT STATE. `/profiles` lived here for the few hours
  // between the People tab being built and the directory route shipping; it
  // was deleted the moment the spec documented it. An entry that outlives its
  // gap stops being an allowance and becomes furniture.
};

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
    const specPublic = specAllowsAnonymous(get, spec.security);
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

  // --- phantom routes: paths we call that the spec does not document ---
  const documented = new Set();
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const method of Object.keys(operations)) {
      documented.add(`${method.toLowerCase()} ${normalisePath(path)}`);
    }
  }

  // Paths with any documented operation, for the method-less raw fetches.
  const documentedPaths = new Set(
    Object.keys(spec.paths).map((path) => normalisePath(path))
  );

  const phantom = [];
  const pending = [];
  const bffHandled = [];
  for (const [call, file] of collectCalls(root)) {
    if (call.startsWith("* ")) {
      if (documentedPaths.has(call.slice(2))) continue;
    } else if (documented.has(call)) {
      continue;
    }
    // The BFF answers these locally, so the spec correctly has no opinion.
    if (BFF_HANDLED[call]) {
      bffHandled.push(call);
      continue;
    }
    if (PENDING_ROUTES[call]) pending.push(call);
    else phantom.push({ call, file });
  }

  for (const call of bffHandled) {
    console.log(`· BFF-handled, not proxied: ${call}`);
  }

  for (const call of pending) {
    console.warn(`! pending route, not failing: ${call}\n    ${PENDING_ROUTES[call].reason}`);
  }

  if (shouldBePublic.length === 0 && shouldBeGated.length === 0 && phantom.length === 0) {
    const notes = [
      acknowledged.length > 0 ? `${acknowledged.length} known mismatch` : null,
      pending.length > 0 ? `${pending.length} pending route` : null,
    ].filter(Boolean);
    console.log(
      `✓ isPublicGet agrees with ${SPEC_URL} on all ${checked} GET operations, ` +
        `and every msApi call resolves to a documented route` +
        (notes.length > 0 ? ` (${notes.join(", ")} acknowledged).` : ".")
    );
    return;
  }

  console.error(`✗ the client and ${SPEC_URL} disagree\n`);

  if (phantom.length > 0) {
    console.error("  PHANTOM ROUTES — called by the frontend, absent from the spec");
    console.error("  → these 404 at runtime; nothing else catches them.");
    console.error("    Ship the route, fix the path, or add it to PENDING_ROUTES with a reason:");
    for (const { call, file } of phantom) console.error(`      ? ${call}   (${file})`);
    console.error("");
  }

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

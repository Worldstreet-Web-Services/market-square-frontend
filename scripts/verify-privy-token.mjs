#!/usr/bin/env node
/**
 * Verify a Privy access token the way the SERVER does — locally, in seconds.
 *
 * Why this exists: production answered every authenticated call with
 * 401 "Sign in to continue." while the browser held a perfectly good session,
 * and nothing could tell us which half was wrong. The BFF's verification is a
 * PUBLIC-KEY check — it fetches the app's JWKS from
 * `auth.privy.io/v1/apps/<appId>/jwks.json`, which needs no secret — so the
 * same check can be run from a laptop with only the token and the app id.
 *
 * Reading the result:
 *
 *   PASS  → the token is valid for this app. The fault is entirely server
 *           side: the deployment's env, or its ability to reach privy.io.
 *   aud mismatch → the browser signed into a DIFFERENT Privy app than the one
 *           this deployment verifies against.
 *   expired → the session really is stale; signing out and in fixes it.
 *
 *   PRIVY_TOKEN=<token> node scripts/verify-privy-token.mjs
 *
 * The token is read from the environment, never an argument: an argument is
 * in the shell history and in every `ps` listing on the box. It is also
 * short-lived by design — this prints no part of it back.
 */
// `jose` is not a direct dependency — it arrives under @privy-io/node, which
// is the point: this must use the SAME verifier the server does, not a
// lookalike installed beside it.
const { createRemoteJWKSet, jwtVerify, decodeJwt } = await import(
  new URL("../node_modules/.pnpm/jose@6.2.10/node_modules/jose/dist/webapi/index.js", import.meta.url).href
).catch(() => import("jose"));

const token = process.env.PRIVY_TOKEN;
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;

if (!token || !appId) {
  console.error(
    "Set PRIVY_TOKEN (from the browser) and NEXT_PUBLIC_PRIVY_APP_ID (the app the deployment uses)."
  );
  process.exit(1);
}

const claims = (() => {
  try {
    return decodeJwt(token);
  } catch {
    console.error("  FAIL  that is not a JWT — check what was copied.");
    process.exit(1);
  }
})();

console.log(`\nToken for app "${appId}"\n`);
console.log(`  audience   ${claims.aud} ${claims.aud === appId ? "✓" : "✗  ← signed into a DIFFERENT app"}`);
console.log(`  issuer     ${claims.iss} ${claims.iss === "privy.io" ? "✓" : "✗"}`);
const expiresAt = new Date((claims.exp ?? 0) * 1000);
const live = expiresAt.getTime() > Date.now();
console.log(`  expires    ${expiresAt.toISOString()} ${live ? "✓" : "✗  ← expired, sign in again"}`);
console.log(`  subject    ${String(claims.sub ?? "").slice(0, 24)}…`);

// The same JWKS the server uses, fetched the same way. If this succeeds here
// and fails there, the difference is the deployment, not the token.
const jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/v1/apps/${appId}/jwks.json`));
try {
  await jwtVerify(token, jwks, {
    typ: "JWT",
    algorithms: ["ES256"],
    issuer: "privy.io",
    audience: appId,
  });
  console.log("\n  PASS  this token verifies against the app's public keys.");
  console.log("        The token is fine — look at the deployment: is");
  console.log("        PRIVY_APP_SECRET set in the PRODUCTION environment, is");
  console.log("        NEXT_PUBLIC_PRIVY_APP_ID the same id as above, and was");
  console.log("        the project redeployed after they were set?\n");
} catch (error) {
  console.log(`\n  FAIL  ${error instanceof Error ? error.message : String(error)}`);
  console.log("        The token itself is being rejected, so the server is");
  console.log("        right to 401 — the browser's session is the problem.\n");
  process.exit(1);
}

# Market Square — Frontend

The social, discovery, streaming and ARK Store surface of the Ark/WorldStreet platform. Next.js (App Router) + React 19 + TypeScript + Tailwind CSS v4, TanStack Query v5, Privy auth, zod boundary validation.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. With no environment variables set the app runs fully standalone in **fixture mode** (see below) — every page, flow and mutation works against realistic sample data.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you have:

| Variable                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WSAPI_BASE_URL`                    | Platform gateway base URL. The BFF proxy forwards to `${WSAPI_BASE_URL}/v1/market-square/*`. **Unset ⇒ fixture mode.**                                                                                                                                                                                                                                                                                                                                  |
| `NEXT_PUBLIC_DECANE_APP_ID`         | Decane app id. Unset ⇒ demo auth: a signed-in demo session is assumed. Also verifies tokens server-side (JWKS).                                                                                                                                                                                                                                                                                                                                         |
| `DECANE_API_KEY`                    | Decane publishable key, **server-only** — served to the browser at runtime by `/api/decane/key`. Its allowed_origins must list both Square hosts.                                                                                                                                                                                                                                                                                                       |
| `DECANE_VERIFICATION_KEY`           | Optional ES256 SPKI PEM; set, Decane tokens verify offline instead of via JWKS.                                                                                                                                                                                                                                                                                                                                                                         |
| `NEXT_PUBLIC_PRIVY_APP_ID`          | Legacy. Powers `/move-account`, where a reader signs into their old Privy account once to link it.                                                                                                                                                                                                                                                                                                                                                      |
| `PRIVY_APP_SECRET`                  | Legacy. Keeps pre-migration Privy sessions valid until they age out, and verifies the old token on a link.                                                                                                                                                                                                                                                                                                                                              |
| `MIGRATION_SERVICE_ENABLED`         | `1` enables `/api/migration/link`. Only where the gateway has a `migration` entry (staging yes, production not yet).                                                                                                                                                                                                                                                                                                                                    |
| `NEXT_PUBLIC_ARK_APP_URL`           | The deployed Ark app. Defaults to `https://www.tsionark.com`, verified rather than assumed (it serves `/dashboard`, `/activity` and `/api/square/symbols`, and its title is "Ark"). NOT `worldstreetgold.com`, which is the marketing site, and NOT `dashboard.worldstreetgold.com`, which is a Clerk app. Drives cross-product deep links and the `$TICKER` catalogue together. A `trade` link is unaffected — it resolves to a public block explorer. |
| `NEXT_PUBLIC_WORLDSTREET_URL`       | Optional. Destination for the WorldStreet slide's `Join now` in the Ecosystem Partners rail — the only door to the platform left in this app since the sidebar entry was dropped. Defaults to `https://worldstreetgold.com`. Separate from `NEXT_PUBLIC_ARK_APP_URL` so setting one does not silently activate the other's deep links.                                                                                                                  |
| `NEXT_PUBLIC_MS_VIP_ACCESS_ENABLED` | Governance flag. Enables VIP ticket selection only after access rules are approved. Defaults off.                                                                                                                                                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_MS_LIVE_GIFTS_ENABLED` | Governance flag. Enables live KASH gifts only after ledger and settlement approval. Defaults off.                                                                                                                                                                                                                                                                                                                                                       |
| `KASH_API_URL`                      | Optional override for the KASH engine. Unset, it derives from the gateway as `${WSAPI_BASE_URL}/v1/kash`. Unset gateway ⇒ every KASH surface reads 404 as "not deployed here" and goes quiet.                                                                                                                                                                                                                                                            |
| `DEXTOPUS_TRADE_API_KEY`            | Server-only. The routing provider's integration key for `$TICKER` buys, added by `app/api/dextopus/[...path]`. Falls back to `DEXTOPUS_API_KEY`. **Unset ⇒ the buy sheet still opens and shows the price, but says buying isn't available here** — the proxy answers 404 rather than 500.                                                                                                                                                                 |
| `ALCHEMY_API_KEY`                   | Server-only. The paid Alchemy key behind two proxies: the ERC-4337 bundler that sponsors gas (`/api/alchemy-bundler`) and the JSON-RPC reads (`/api/evm-rpc`). Same key wsws uses. **Unset ⇒ no payment can be sent**, because an embedded wallet holding only USDC cannot pay its own gas.                                                    |
| `ALCHEMY_GAS_POLICY_ID`             | Server-only. Alchemy's Bundler Sponsored Operations policy that actually pays the gas. Sent as `x-alchemy-policy-id` on `eth_sendUserOperation` only — never on a read. Unset ⇒ the bundler proxy answers 503 on send.                                                                                                                       |

## Fixture mode

When `WSAPI_BASE_URL` is unset, the BFF route (`app/api/market-square/[...path]/route.ts`) serves every endpoint from `lib/fixtures` — an in-memory backend with seeded profiles, posts, stories, live/scheduled/ended streams, chat, the ARK Store, tickets, orders, activities, spotlight and verification. Mutations (posts, likes, follows, ticket purchases, orders, go-live/end) mutate that memory, so the demo feels alive for the life of the dev server. Live playback uses a public HLS test stream so the player genuinely plays.

When Privy is also unconfigured, every caller is treated as the demo user (`@demo`), so gated flows (composer, tickets, studio) are exercisable with zero setup.

## Scripts

| Script           | What it does               |
| ---------------- | -------------------------- |
| `pnpm dev`       | Dev server                 |
| `pnpm build`     | Production build           |
| `pnpm start`     | Serve the production build |
| `pnpm lint`      | ESLint                     |
| `pnpm typecheck` | `tsc --noEmit`             |

All three gates — `pnpm lint`, `pnpm typecheck`, `pnpm build` — must be green before merging.

## Paying with KASH

Adding a feature that costs money? Read **[`docs/PAYING_WITH_KASH.md`](docs/PAYING_WITH_KASH.md)** first.

The short version: who receives the money decides the mechanism. Paying the
**platform** (tickets, store items, verification) goes through the kash rail;
paying a **person** (tips) is a transfer the user signs themselves — the
backend cannot move one user's tokens to another. Either way the user signs an
off-chain **permit** first, which is gasless for them.

One thing worth knowing before you price anything: a rail debit **burns** the
KASH, so in-app purchases are a supply sink rather than revenue. The doc
explains why and what to change if that is not the intent.

## Architecture

Four layers; imports point downward only (see `CLAUDE.md` and `docs/PDR.md`):

```
app/                routes + the BFF proxy. No business logic.
components/layout/  the shell (nav, bottom tab bar).
features/           vertical slices: feed, streams, store, profile.
                    Slices never import each other; routes compose them.
components/ui/ hooks/  shared primitives and cross-cutting hooks.
lib/                api client + envelope, formatters, deep links, fixtures.
```

- Data flow: component → hook (TanStack Query) → feature api client → `/api/market-square/*` BFF → gateway. Components never call `fetch` or hold base URLs.
- Every upstream payload is validated with zod at the feature api boundary.
- The envelope `{ success, data | error }` is unwrapped by `lib/api/envelope.ts` into typed errors; error codes map to human copy, never raw codes on screen.
- KASH amounts are decimal strings end-to-end; `formatKash` is display-only.

## Pages

`/` feed (4 lanes, stories, composer, likes/comments/reports) · `/live` streams hub · `/live/[id]` stream room (tickets, HLS playback, heartbeats, chat) · `/store` + `/store/[slug]` ARK Store · `/u/[username]` profiles · `/spotlight` rankings · `/schedule` activities · `/tickets` ticket wallet + purchases · `/studio` creator flow · `/auth` sign in.

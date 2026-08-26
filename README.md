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

| Variable | Purpose |
| --- | --- |
| `WSAPI_BASE_URL` | Platform gateway base URL. The BFF proxy forwards to `${WSAPI_BASE_URL}/v1/market-square/*`. **Unset ⇒ fixture mode.** |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id (client). Unset ⇒ demo auth: a signed-in demo session is assumed. |
| `PRIVY_APP_SECRET` | Privy app secret (server). Required with the app id for server-side token verification. |
| `NEXT_PUBLIC_ARK_APP_URL` | Optional. Base URL for Ark-app deep links (`listing`, `market`, `game`). **No default** — while unset those CTAs render inert rather than pointing at a host that answers nothing. |
| `NEXT_PUBLIC_WORLDSTREET_URL` | Optional. Destination for the `WorldStreet` navigation entry. Defaults to the placeholder `https://worldstreet.com`. Separate from `NEXT_PUBLIC_ARK_APP_URL` so setting one does not silently activate the other's deep links. |
| `NEXT_PUBLIC_MS_VIP_ACCESS_ENABLED` | Governance flag. Enables VIP ticket selection only after access rules are approved. Defaults off. |
| `NEXT_PUBLIC_MS_LIVE_GIFTS_ENABLED` | Governance flag. Enables live KASH gifts only after ledger and settlement approval. Defaults off. |

## Fixture mode

When `WSAPI_BASE_URL` is unset, the BFF route (`app/api/market-square/[...path]/route.ts`) serves every endpoint from `lib/fixtures` — an in-memory backend with seeded profiles, posts, stories, live/scheduled/ended streams, chat, the ARK Store, tickets, orders, activities, spotlight and verification. Mutations (posts, likes, follows, ticket purchases, orders, go-live/end) mutate that memory, so the demo feels alive for the life of the dev server. Live playback uses a public HLS test stream so the player genuinely plays.

When Privy is also unconfigured, every caller is treated as the demo user (`@demo`), so gated flows (composer, tickets, studio) are exercisable with zero setup.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

All three gates — `pnpm lint`, `pnpm typecheck`, `pnpm build` — must be green before merging.

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

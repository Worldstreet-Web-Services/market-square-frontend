# Market Square — Frontend Product Document Requirement (PDR)

Backend contract: `wsws-monorepo/docs/plans/market-square/BACKEND_SPEC.md`. All calls go through the BFF proxy `app/api/market-square/[...path]/route.ts` → `/v1/market-square/*`. Every response is the `ApiResponse` envelope; examples below show the `data` payload. All KASH amounts are decimal strings.

## 0. Auth flow
- Privy login page (`/auth`): Google, Twitter, email OTP. After login, call `GET /me` (BFF attaches `Authorization: Bearer <privy access token>`) → auto-creates the profile. If `username` is null/system-generated, show a claim-username sheet (`PATCH /me { username }`; 409 CONFLICT ⇒ inline "username taken").
- Public browsing works logged-out (feed, streams, store, profiles). Any gated action (post, follow, buy, chat) triggers the login sheet.
- BFF: verify Privy token server-side per request; 401 from backend ⇒ client retries once after token refresh, else redirect to `/auth`.

## 1. Pages

### `/` — Market Square feed
- Layout: left nav (Feed, Live, Store, Spotlight, My profile), center feed, right rail ("Happening now": live streams + upcoming activities from `GET /feed?lane=live`).
- Lane tabs: **For you** (`lane=for-you`), **Following**, **Live**, **Platform** (`lane=platform`). Infinite scroll via `nextCursor`.
- `GET /feed?lane=for-you&limit=30` → `{ items: FeedItem[], nextCursor }` where
  `FeedItem = { id, type: "post"|"stream"|"activity"|"platform_event", occurredAt, deepLink?: { kind, ref }, post?, stream?, activity?, platformEvent? }`
- Post card: avatar, displayName, @username, verification badge (earned/paid = silver check), role chip, relative time, text, media/thumbnail, like + comment counts, **deep-link CTA button** when `deepLink` present (one tap to the transaction — label by kind: "Watch" (stream), "Open" (store_item), "View listing" etc.).
- Stories row at top: `kind=story` posts from followed authors, 24 h expiry, tap-through viewer.
- Composer (authed): text ≤2000, optional media URL, optional deep link picker (stream / store item / external). `POST /posts { kind: "update", text, deepLink? }` → optimistic prepend.
- Like: `POST|DELETE /posts/:id/like` → `{ liked, likeCount }` optimistic. Comments sheet: `GET/POST /posts/:id/comments`.
- Report menu on every card: `POST /reports { targetType, targetId, reason }` → toast.

### `/live` — streams hub
- Sections: Live now, Upcoming (scheduled), Replays (ended with replayUrl). `GET /streams?status=live` etc. Cards: thumbnail, title, category chip, owner, viewerCount, price pill ("1 KASH" / "Free" / "VIP 5 KASH").

### `/live/[id]` — stream room (the flagship screen)
- `GET /streams/:id` → `{ id, ownerId, title, description, category, status, visibility, ticketPriceKash, vipPriceKash, thumbnailUrl, scheduledAt, startedAt, replayUrl, viewerCount, myTicket? }`
- States: **scheduled** (countdown + "Get ticket"), **live** (player), **ended** (replay player if replayUrl, else "Replay coming soon" fallback panel), **cancelled**.
- Ticket purchase: quote sheet first — `POST /streams/:id/tickets/quote { tier }` → `{ priceKash, expiresAt }`; confirm → `POST /streams/:id/tickets { tier }` → `Ticket { id, status: "confirmed", tier, priceKash }`. Errors: `PAYMENT_FAILED` ⇒ inline "KASH payment failed — check your balance"; re-POST is idempotent.
- Playback: `POST /streams/:id/playback-token` → `{ url, token, expiresAt }` — HLS player (native video + hls.js fallback), re-request token before `expiresAt`. 403 FORBIDDEN ⇒ show ticket CTA.
- View-time: while playing, `POST /streams/:id/heartbeat { sessionId?, mode: "live"|"replay" }` every 15 s; keep returned `sessionId`.
- Chat panel: `GET /streams/:id/chat` + `POST` (ticket-gated on ticketed streams); poll every 5 s (upgrade to WS later). Viewer count refreshed with detail poll (10 s).

### `/store` — ARK Store
- `GET /store/items?category` → grid of `StoreItem { id, slug, name, tagline, category, iconUrl, bannerUrl, pricing, priceKash, actionKind, installCount }`. Category tabs: Apps / Products / Services.
- `/store/[slug]` detail: banner, description, install count, price pill, one CTA — free ⇒ `POST /store/items/:slug/orders {}` then follow `actionUrl` ("Open"); paid ⇒ quoteless confirm sheet showing `priceKash` then same POST; `myOrder` confirmed ⇒ CTA becomes "Open".
- The journey must be ≤ 2 taps from card to confirmed order ("cheap, fast, simple").

### `/u/[username]` — profile
- `GET /profiles/:username` → profile header (avatar, names, badge, role, bio, follower/following counts, Follow button `POST|DELETE /profiles/:id/follow`).
- Tabs: Posts (author's posts from feed items), Streams (owner's streams), Activities.
- Own profile (`/me` matches): Edit sheet (`PATCH /me`), verification card — `GET /verification/rule` + `GET /me/verification`; show eligibility rule, "Request verification" (`POST /verification/requests { type: "earned" }`), pending/approved states; paid badge shows priceKash with `economics: "proposed"` ⇒ render as "Coming soon".

### `/spotlight`
- `GET /spotlight?window=weekly` → ranked list `{ profile, score, rank }` — podium top 3, list for rest; follow buttons inline.

### `/schedule` (authed)
- Create activity: `POST /activities { type: "game"|"stream"|"event", title, startsAt, deepLink }`; list mine + upcoming (`GET /activities?status=scheduled`); cancel own.

### `/tickets` (authed)
- `GET /me/tickets` → ticket wallet: stream card + tier + status + "Watch" deep link. `GET /me/orders` → store purchases section.

### Creator flow (role creator|worldstreet): `/studio`
- Create stream form → `POST /streams`; my streams list; Go live (`POST /streams/:id/go-live` → show ingest RTMP url/key or room token in a copyable panel); End (`POST /streams/:id/end`).

## 2. Cross-cutting
- Error display: map envelope `error.code` → inline message near the action; `RATE_LIMITED` ⇒ toast "Slow down". Never show raw codes.
- Pagination: cursor-based everywhere (`cursor`, `nextCursor`), `useInfiniteQuery`.
- Skeletons for every loading query; designed empty states ("No one you follow has posted yet — explore Live").
- KASH formatting: `formatKash("1.25")` → "1.25 KASH"; never float math.
- Deep-link resolver `lib/deeplink.ts`: `{ kind, ref }` → internal route (`stream` → `/live/[ref]`, `store_item` → `/store/[ref]`) or Ark app URL (`listing`, `market`, `game` → `https://app` env base) — every feed CTA uses it.
- Mobile-first responsive; bottom tab bar (Feed, Live, Store, Tickets, Profile) on small screens.

## 3. Definition of done
`pnpm lint`, `pnpm typecheck`, `pnpm build` green; every page renders against a mocked BFF (MSW or fixture mode when `WSAPI_BASE_URL` unset ⇒ `lib/fixtures` sample data so the app is demoable standalone); loading/error/empty states everywhere; README with setup instructions.

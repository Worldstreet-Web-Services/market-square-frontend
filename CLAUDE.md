# CLAUDE.md — Market Square Frontend

Market Square: the social, discovery, streaming and ARK Store surface of the Ark/WorldStreet platform. Sibling app to `../wsws-frontend` — follow its conventions; do not import from it.

## Tech Stack
- Next.js (App Router) + React 19 + TypeScript, pnpm
- Tailwind CSS v4 — theme in `app/globals.css` via `@theme inline`; NO component library
- Auth: Privy (`@privy-io/react-auth` client, `@privy-io/node` server verification)
- Server state: TanStack Query v5. NO global state manager (no Redux/Zustand); React local state for UI
- Validation at boundaries: zod v4. Toasts: sonner. Animation: motion

## Architecture (layers, imports point downward only)
- `app/` — routes + BFF route handlers. Owns no business logic
- `features/` — vertical slices (`feed`, `streams`, `store`, `profile`); slices NEVER import each other; each exposes only its `index.ts` barrel
- `components/ui/`, `hooks/` — shared presentation/behaviour
- `lib/` — pure cross-cutting: api client, envelope, formatters, brand

## API rules
- Backend envelope: `{ success: true, data } | { success: false, error: { code, message, details? } }` — `unwrap<T>()` in `lib/api/envelope.ts` throws typed errors
- Data flow: component → hook (useQuery/useMutation) → feature api client → `app/api/market-square/[...path]` BFF proxy → `${WSAPI_BASE_URL}/v1/market-square/*`
- Components NEVER call fetch directly or hold base URLs. The BFF verifies the Privy session and forwards `Authorization`
- Which GETs a signed-out visitor may read lives in `lib/api/public-routes.ts` (`isPublicGet`), and its **source of truth is the backend's `openapi.json`**: a GET is public exactly when its operation carries no `security` requirement. `lib/api/public-routes.test.ts` asserts that table in **both** directions — a route that silently becomes secured upstream fails as loudly as one that becomes public. Re-derive both from the spec (the `jq` one-liner is in the file header) whenever backend routes land; never patch the predicate one bug at a time
- A public GET skips our session check but still forwards the caller's token when present, so `likedByMe` / `bookmarkedByMe` keep resolving for signed-in readers
- Query keys are tuples: `["ms","feed",lane]`, `["ms","stream",id]`; mutations invalidate subtrees
- Monetary/KASH amounts are decimal strings end-to-end — never parseFloat for arithmetic, only for display formatting

## Design language (Ark)
- Pure black `#000` background, white text, silver accent `#d4d4d8` — NO gold
- **The one violet in the product is the Create Post CTA.** The 2026-08-25 design revision repainted that single control from the amber featured ramp to `--color-create` `#9f65fd` → `--color-create-deep` `#5b05e6` with a **white** label (it was amber-on-`#0f0f0f`). It has its own tokens and its own utility (`ws-btn-create`) precisely so it is not reachable from `--color-featured` — the liked heart, Citizen Spotlight and every coin mark stayed amber in the same revision. Do not generalise this into a violet ramp for other surfaces, and do not re-read the old "NO purple" rule as covering it
- Greyscale ramp; panels `#0a0a0a`; semantic green `#7ce7b0` / red `#f6a5a5` for value deltas only
- Type: Geist (body, weight 500), bold display face with `-0.01em` tracking exposed as `ws-display`
- Surface utilities: `ws-card` (22px radius, 5% white fill, 12% white border, inset top highlight), `ws-inset` (16px radius, black/35 fill), `ws-glass` (6% white + backdrop blur), `tnum`
- Rounded/pill shapes, radial-gradient page washes, respect `prefers-reduced-motion`

## Home (Market Square design)
- Home is **card-based**, not divider-based: posts, streams and activities are `ws-post` slabs with gaps. `ws-row` stays for the other column surfaces — do not mix the two on one page
- `ws-post` is an **outline**, not a panel: transparent fill, one hairline at 10% white, 16.5px radius. Depth on home comes from the border, never a lighter fill
- Column order: breadcrumb (in `AppShell`, spanning column + rail) → section switcher + Schedule Stream/Create Post → stories strip → featured hero → lane tabs → card timeline. Home gets its own wider column (`md:max-w-[720px]`); everything else stays at 600px
- The section switcher and both creation actions live inside **one long outlined pill** (`ws-tabbar`): `Feeds · Discover · Messages · Notifications · Arkmarks`, then Schedule Stream and Create Post. Active Feeds is `ws-btn-silver`; Create Post is `ws-btn-create` (the violet ramp — see Design language)
- Lane tabs are `For You · Live Streaming · Reels · Following · Trending`. The rule is full-width at 8% white with a **white** active segment — not amber. Every one is a real backend lane (`reels` and `trending` included) — never filter a lane client-side
- Clips render through `InlineVideo`: muted autoplay once 60% is in view, pause + re-mute on exit, sound only on an explicit tap. Under `prefers-reduced-motion` it does not autoplay and keeps native controls. Detect video with `isVideoPost` (backend `mediaKind` first, URL sniffing as the fallback), never `isVideoUrl` alone
- A repost arrives as the **original post** with `repostedBy` on the FeedItem; the card keeps the original author and the attribution line names who passed it on
- Stories are **portrait cards** on desktop (100×96) and the **circular rail** on mobile (`StoriesRail`, 41px rings + names) — both share the grouping, seen/unseen semantics and the Instagram viewer
- Post actions: a tallies pill (comment / repost / like), the inline "Comment here…" pill, then share, **Arkmark** and a ringed 38px more-menu. `POST|DELETE /posts/:id/bookmark` and `GET /me/bookmarks` back the Arkmark; a 404 means "not deployed", so the control goes quiet (`useBookmarkPost().unavailable`) rather than faking a save
- A **liked heart is red** — `--color-like` `#e84a4a`, on every surface: the card tallies pill, the profile grid and the snap feed (burst included). It was amber until the 2026-08-25 design revision moved it off the featured accent; all four liked cards in the file changed together. Do not reach for `text-featured` on the heart again — amber now means featured/premium/top-ranked only
- `--color-featured` (amber) is semantic — **featured, premium, top-ranked, or coin value**, never decoration. The ramp is `--color-featured` `#e8b74a` → `--color-featured-deep` `#cda243`, `--color-featured-hi` `#ffb900` for Citizen Spotlight's heading and `--color-featured-chip` `#ffd230` for its chip. In use: Citizen Spotlight, Spotlight's podium ranks and window chip, VIP ticket tiers, the paid Supporter badge, and every coin mark in the live room. **Not** the liked heart (red since 2026-08-25) and **not** Create Post (violet since the same revision) — both were amber and both moved off it, so treat "it used to be amber" as no argument for making something amber. `Pill` carries a `featured` tone for it. Everything else stays on the silver ramp
- Slices never import each other, so `components/layout/*-screen.tsx` composes across them: `home-screen` joins profile's `FollowPill` + streams' live count into the feed, `profile-screen` joins messages' `Message` button into the profile — the same route-slot pattern the stream room uses

## Identity chips
- Three independent signals sit on an author line and can co-exist: `VerifiedBadge` (verification), `RoleChip` (role), and `OrgBadgeChip` (the design's MARKET / ARK lockup)
- `orgBadge` is `'market' | 'ark' | null`, assigned **admin-only** and deliberately **not derived from role** — product decides who carries one. Never infer it from `role`, `verification` or anything else; when it is null, render nothing
- The lockups are brand artwork, so `components/ui/org-badge-glyphs.tsx` keeps their real fills rather than recolouring to `currentColor` (unlike `design-icons.tsx`). Chip geometry is the design's: 21px-radius capsule, 4% white fill, glyph 7px tall
- **The border is per-badge, not shared.** The 2026-08-25 revision gave the MARKET chip a solid `#008CFF` 1px ring; ARK was checked separately in the same file and kept the 19% white hairline. The fill is still 4% white on both — the blue is the ring, not a filled background. In the design the two lockups are also distinguishable by artwork: MARKET's flanking marks are solid white, ARK's are `#979797` at 18%
- The schema defaults to null and `catch`es unknown values, so a backend without the field — or with a future third badge — parses cleanly instead of blanking the surface. `lib/api/schemas.test.ts` pins that

## Counts, badges and unread
- **Never derive a badge from a loaded page.** `GET /me/unread` answers `{ messages, notifications }`, both global, in one call — `hooks/use-unread.ts` owns it and polls at **45s**. Anything that changes a count locally (send, mark-thread-read, mark-notifications-read) calls `useRefreshUnread()` so the badge moves immediately; the poll only catches other people's activity
- **`isFollowing` is optional, never defaulted.** `undefined` means "this payload does not carry the follow edge", which is not the same as "you do not follow them" — `GET /spotlight` omits it entirely today. Defaulting it to `false` made every spotlight refetch stamp "Follow" back over a follow the viewer had just made. Follow controls read `useIsFollowing` (`features/profile/lib/follow-state.ts`), which layers the session's own click intent under the server's answer: the server wins the moment it carries the field (so nothing changes when the backend ships it), the intent only fills the gap when it does not, and with neither the answer is `false` — a missing field can never render a fabricated "Following". The decision itself is pure and pinned in `lib/follow-resolve.test.ts`
- `GET /categories` counts are authoritative and `real-world-assets` / `prediction-markets` return `count: null` **by design** — other services own that data. Null renders as an em-dash, never `0`
- The category rail renders the API's own labels and order; `PRESENTATION` in the rail maps `key` → href + glyph only

## Messages (1:1 DMs)
- `POST /conversations { userId }` is idempotent from either side; `GET /me/conversations` (global `totalUnread`), `GET|POST /conversations/:id/messages`, `POST /conversations/:id/read`. Non-participants get FORBIDDEN on every conversation route even with a valid id
- Messages are ≤2000 chars (rate limited 30/min) — the composer stops at the same cap rather than letting the service reject it
- The thread returns **newest-first**; the view reverses it to read oldest-first
- Realtime publishes `market-square.message.sent` **without the body**, so it is a refetch signal, not a payload. Until ws-gateway carries it, an open thread polls at 5s (the live room's chat cadence). Do not build a websocket for this
- Opening a thread is the acknowledgement: mark-as-read fires once per thread, not on every poll tick

## Layout (three-column shell)
- `AppShell` centres a max-1280px frame: labelled sidebar (icon rail below `xl`), a 600px centre column, then `RightRail`. Routes in its `WIDE` list (store, operations, studio, schedule) drop the rail and spread; `/live/[id]` renders bare
- Body copy in the column is **15px**; the column is a continuous timeline, not stacked cards — rows use `ws-row` (hairline divider + hover tint), never `ws-card`. `ws-card` is now only for detached objects: sheets, tiles, dashboard panels
- Column utilities in globals.css: `ws-row`, `ws-head` (sticky blurred header), `ws-rail` / `ws-rail-row` (rail modules), `ws-field` (pill input), `ws-nav` (sidebar item), `ws-action` (timeline action with a growing halo), `ws-hair` (the shared hairline border colour)
- Every non-timeline column surface opens with `ColumnHeader` (+ `ColumnTabs`) from `components/layout/`; loading uses `RowSkeleton`, not `CardSkeleton`
- The rail leads with what a plain timeline lacks: `LiveNowRail` then `TicketsRail` (both from the streams slice), then `WhoToFollowRail`. Rail modules live in their own feature slice and are exported from its barrel — `components/layout/` composes them
- Nav icons take a `filled` prop for their active state; read URL params with `useQueryParam`, never `useSearchParams` (its Suspense boundary delays hydration and desyncs user-dependent renders)
- `Sheet` carries the X dialog chrome: dismiss control, title, one pinned right-hand action (`action`), optional `tabs` strip, `back` for a step inside a flow

## Stories (Instagram pattern)
- The rail groups posts **by author** — one tile per person, a tap plays that author's set oldest-first, then rolls into the next author. `Your story` always leads with a `+` badge and points at `/?compose=story`
- Unseen carries the `ws-story-ring` gradient (silver, not Instagram's pink/orange); seen drains to `ws-story-seen`. `ws-story-gap` is the black ring/avatar gap that makes it read as a ring
- Seen state has no backend field: it lives in `localStorage` behind a `useSyncExternalStore` with an empty server snapshot. Every storage access is try/caught
- The viewer is a 9:16 card — per-story progress segments, hold-to-pause, left-third/right-two-thirds tap zones, arrow keys, desktop arrows outside the frame. Artwork-less stories get the seeded `GradientThumb` plus a lift and top/bottom scrims

## Live room (TikTok pattern)
- Three panes: a 250/304px nav rail, the centre column, and a collapsible LIVE chat column. The stage owns the whole viewport — `AppShell` renders `/live/[id]` bare
- The centre column is a **vertical stack from `lg`**: header → 9:16 player → host handle → gift panel. Below `lg` it collapses to one full-bleed stage with everything absolutely overlaid. Never re-attach the player controls to a dock strip: they overlay the frame's bottom edge, and the `LIVE creator` badge, elapsed time and LIVE pill sit **inside** the frame, not in the header
- The vertical action rail (heart, gift, pulse, chat, share) is the **phone** pattern only. On desktop those actions live in the header (share, more, Subscribe, Follow, ticket), the frame's control cluster (pulse, request-to-speak) and the chat column (floating heart, anchored clear of the composer)
- Chat is **monochrome**: flat rows (avatar, grey name, white message), Host/role chips, no per-author colours or tinted bubbles. Top viewers is a podium — rank 1 large, 2 and 3 stacked beside it
- Player chrome uses real icons (`IconPause`/`IconRefresh`/`IconPip`/`IconFullscreen`/`IconVolume`/`IconChevronDown`), never glyph characters — they align to the same 20px grid as the rest of the UI
- Gifting is governance-gated by `MARKET_FLAGS.liveGifts`. With it off there is no tray, so the dock collapses to the 48px control bar and **all** coin chrome disappears (sidebar `Get Coins`, the balance bar, the tray toggle). Gate on `dockExpanded`, never the raw `giftTrayOpen`
- `Suggested LIVE creators` reads the live stream list minus the current room; the header identity falls back to the stream title when `owner` is not hydrated (list and detail payloads do not always carry the profile)

## Conventions
- Named exports only (no default exports except Next.js route files)
- `clsx` + `tailwind-merge` via a `cn()` helper
- Loading skeletons + inline error states for every query; empty states designed, not blank
- `.env`: `WSAPI_BASE_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`
- Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass
- Tests run on Node's built-in runner (`node --test`, zero dependencies) over `lib/**/*.test.ts`, using Node 24 native type stripping — hence `allowImportingTsExtensions` and the real `.ts` import specifier in test files

## Do NOT
- Import from wsws-frontend; use any component library; use Redux/Zustand/Context-as-store; put logic in route files; use floats for money; use `any`

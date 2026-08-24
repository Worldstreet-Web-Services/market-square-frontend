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
- Query keys are tuples: `["ms","feed",lane]`, `["ms","stream",id]`; mutations invalidate subtrees
- Monetary/KASH amounts are decimal strings end-to-end — never parseFloat for arithmetic, only for display formatting

## Design language (Ark)
- Pure black `#000` background, white text, silver accent `#d4d4d8` — NO purple, NO gold
- Greyscale ramp; panels `#0a0a0a`; semantic green `#7ce7b0` / red `#f6a5a5` for value deltas only
- Type: Geist (body, weight 500), bold display face with `-0.01em` tracking exposed as `ws-display`
- Surface utilities: `ws-card` (22px radius, 5% white fill, 12% white border, inset top highlight), `ws-inset` (16px radius, black/35 fill), `ws-glass` (6% white + backdrop blur), `tnum`
- Rounded/pill shapes, radial-gradient page washes, respect `prefers-reduced-motion`

## Home (Market Square design)
- Home is **card-based**, not divider-based: posts, streams and activities are `ws-post` slabs with gaps. `ws-row` stays for the other column surfaces — do not mix the two on one page
- Column order: section switcher + Schedule Stream/Create Post → stories strip → featured hero → lane tabs → card timeline. Home gets its own wider column (`md:max-w-[720px]`); everything else stays at 600px
- Stories are **portrait cards** here (the design's shape), keeping the seen/unseen ring semantics and the Instagram viewer. The circular rail is gone
- Post actions are comment / repost / like, an inline "Comment here" field, then share. There is **no bookmark endpoint** — do not add the icon until one exists
- `--color-featured` (amber) is semantic: it marks featured/spotlight only (the hero eyebrow, `ws-featured`, category glyphs). Everything else stays on the silver ramp

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
- Gates: `pnpm lint && pnpm typecheck && pnpm build` must pass

## Do NOT
- Import from wsws-frontend; use any component library; use Redux/Zustand/Context-as-store; put logic in route files; use floats for money; use `any`

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
- Utilities to define in globals.css: `ws-card` (22px radius, 5% white fill, 12% white border, inset top highlight), `ws-inset` (16px radius, black/35 fill), `ws-glass` (6% white + 18px backdrop blur), `tnum`
- Rounded/pill shapes, radial-gradient page washes, respect `prefers-reduced-motion`

## Conventions
- Named exports only (no default exports except Next.js route files)
- `clsx` + `tailwind-merge` via a `cn()` helper
- Loading skeletons + inline error states for every query; empty states designed, not blank
- `.env`: `WSAPI_BASE_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`
- Gates: `pnpm lint && pnpm typecheck && pnpm build` must pass

## Do NOT
- Import from wsws-frontend; use any component library; use Redux/Zustand/Context-as-store; put logic in route files; use floats for money; use `any`

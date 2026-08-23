# Market Square — Design Direction (v2, consumer-grade)

Research-backed redesign spec (sources: NN/g, Chrome platform team, TwitchCon 2025 direction, 2025–26 dark-UI/glassmorphism analyses). The bar: TikTok/Twitch-level immersive consumer UI. Identity stays: pure black `#000` ground, silver `#d4d4d8` accent, no purple/gold, no component library. Color comes from content, not chrome.

## 1. Shell: kill dashboard-itis
- **Mobile**: floating glass bottom tab bar — `backdrop-filter: blur(16px)`, `rgba(20,20,22,.7)` fill, `1px rgba(255,255,255,.1)` border, pill-shaped, floats above `env(safe-area-inset-bottom)`. Tabs: Home, Live, **Go Live (center, elevated silver circle)**, Store, Profile.
- **Desktop**: slim 64–72px icon rail (icons + tooltips, active = silver), no boxed sidebar. Wordmark top, profile bottom.
- Studio keeps a denser layout (it's a creator tool) but adopts the same surface system.

## 2. Surface / elevation system (pure-black depth)
Shadows don't work on #000 — depth = lighter surfaces + hairline light borders:
- Ground `#000` · Raised `#0f0f11` · Overlay `#18181b`, each raised layer gets `border-top: 1px solid rgba(255,255,255,.08)`.
- Glass (blur) ONLY for floating chrome: tab bar, sheets, toasts. Max 2–3 blurred layers per screen; never animate blur radius; prefer gradient scrims over blur on top of video.
- Text ladder: `#fafafa` headings · `#d4d4d8` body · `#71717a` meta. Never pure white body text on pure black (halation).

## 3. Immersive stream room (flagship)
- `100dvh` full-bleed video on #000, `viewport-fit=cover`; ALL controls are overlays inside safe-area.
- Top: 120px black→transparent gradient scrim. Left: avatar + name + Follow pill. Right: viewer count + LIVE badge (black pill, pulsing silver dot, uppercase — silver IS our live color, no red).
- Bottom-left: transparent chat column (max-width 340px, upward-scrolling, `mask-image` top fade, no opaque panel; names `#d4d4d8` semibold 13px, body `#fafafa`, text-shadow for legibility). Host chip stays.
- Right edge: vertical action rail — like, chat toggle, share — 44px targets, counts under icons.
- Tap-to-spawn floating reactions: silver/white hearts, randomized drift+fade, CSS transforms, cap ~30 concurrent.
- Desktop: theater mode — video left, 340px collapsible chat right on `#0a0a0a` with hairline divider.
- Transient overlays (follow/gift toasts): glass, spring in, auto-dismiss ~4s, never more than one at a time.

## 4. Vertical snap feed (mobile Home)
- `scroll-snap-type: y mandatory`, one post per `100dvh` section, `scroll-snap-align: start`.
- Muted autoplay for stream/video items when in view; sound only on explicit tap (autoplay-with-sound is a documented dark pattern).
- Double-tap like with heart burst; right-edge action rail; author + caption over bottom scrim.
- Desktop Home/Discover keeps a card grid (comparison surface). Store uses load-more, NOT infinite scroll (NN/g: commerce needs position memory and reachable ends).

## 5. Motion spec
- Springs for anything touched: press scale 0.97 (stiffness ~300, damping ~24). Fades/slides 150–250ms ease-out. Nothing over 400ms except celebratory moments.
- Scroll-driven entrance for feed cards: opacity + 8px translate via `animation-timeline: view()` (pure CSS, compositor-run).
- **View Transitions API** (now Baseline): thumbnail → stream room morph, profile navigation. Use `document.startViewTransition` w/ feature detection; `view-transition-name` on stream thumbnails.
- `prefers-reduced-motion`: all of the above collapse to fades.

## 6. Typography
- Max ~4 sizes per screen. Display 28–36px/650–700 tight tracking · body 15–16px · meta 12px uppercase tracked. Big numbers for counts (tnum).

## Don't
- Don't lighten the black ground. Don't blur every card. Don't add color accents. Don't autoplay sound. Don't fake counts/urgency. Don't infinite-scroll the Store. Don't exceed one transient overlay at a time.

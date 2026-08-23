# Studio v2 — Host Cockpit Spec

Research-backed (Twitch Stream Manager, TikTok Live Studio, YouTube Live Control Room, StreamYard green-room, IG Live host UI). The Studio is a **state machine per stream**, not a form page: `draft → green-room → live → ended`. Routes: `/studio` (home), `/studio/[id]` (renders by state).

## Invariants (every state)
- Self-preview always visible when in browser mode. Chat always visible while live (desktop: never behind a tab). Persistent status strip while live: LIVE badge, session timer, viewer count, connection dot. ONE prominent End control, spatially isolated, always confirmed. Stream info editable in place without ending. Health indicators quiet when fine, loud only on degradation.

## State 0 — /studio home
- Primary CTA "Go Live" (filled silver) → create sheet, ≤5 fields (title, cover URL, category, ticket price, VIP price) → lands in the green room (NOT back on the list).
- "Your streams": upcoming/live rows (→ green room / cockpit), past rows (→ post-live summary).

## State 1 — Green room (stream exists, not live)
- Desktop 65/35: LEFT large 16:9 camera preview with device pickers (cam/mic), WebAudio mic level meter, mute/cam toggles overlaid bottom. Tabs: "Camera" | "OBS" (OBS: masked stream key + copy, "waiting for signal" note — creds come from go-live, so show explainer pre-live).
- RIGHT: stream card — cover, title, category, price, all inline-editable (PATCH stream); copyable share link; readiness checklist (camera OK / mic OK / title set).
- Big **Go Live** button, disabled in browser mode until device permissions granted + preview showing (StreamYard rule: never go live blind).
- Mobile: full-bleed camera, bottom sheet with fields + Go Live.

## State 2 — Live cockpit
- Top status bar (sticky): ● LIVE (pulsing silver), session timer, 👁 viewers (5s poll), connection-quality dot (LiveKit connectionQuality events); far right outlined **End stream** → confirm dialog ("Viewers will be disconnected").
- Left ~65%: self-preview (browser) or "OBS signal" state; control strip: mute, cam off, device switch, copy link; collapsible "Stream info" drawer → edit title/category live.
- Right ~35%: tabs **Chat** (default, host messages silver-bordered, input pinned) | **Activity** (ticket purchases, follows — from `GET /streams/:id/events` when backend ships; until then show "coming soon" placeholder WITHOUT fake data).
- Health: silver dot normally; full-width warning banner only on degraded/reconnecting.
- Mobile: camera full-bleed; top chips (LIVE, timer, viewers); chat translucent lower-third overlay; End = ✕ top-right → confirm sheet; right-edge icon actions (mute, flip, share). No side rails.

## State 3 — Post-live summary
- "Stream ended": duration (startedAt→endedAt), peak viewers + total view-time + messages (from `GET /streams/:id/stats` when shipped; show only what's real), tickets sold/KASH when available, replay link if replayUrl.
- CTAs: "Go live again" (clone into new draft) + "Back to Studio". Never dead-end to the list.

## Anti-patterns (hard NOs)
Form-first studio · chat behind a tab while live (desktop) · End adjacent to mute/cam or unconfirmed · edit requires restart · Go Live before device check · silent OBS mode (no signal state) · always-on telemetry graphs · revenue events mixed into chat · dead-end ending · desktop rails on mobile · fake/placeholder numbers anywhere.

## Backend contracts (in progress; build UI behind graceful absence)
- `GET /streams/:id/stats` → { peakViewers, uniqueViewers, totalViewSeconds, messages, ticketsSold, kashEarned } (owner-only)
- `GET /streams/:id/events?cursor` → items: { id, kind: ticket_purchased|follow|viewer_joined, actor ProfileSummary, amountKash?, occurredAt } (owner-only)
- Moderation: DELETE /streams/:id/chat/:messageId (owner), POST /streams/:id/bans { userId } (owner) — chat send/messages respect bans.

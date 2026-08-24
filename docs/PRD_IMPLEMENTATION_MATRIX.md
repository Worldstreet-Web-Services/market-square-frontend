# August 2026 PRD implementation matrix

Source: [Market Square Hybrid / Full Scope PRD](https://docs.google.com/document/d/1bNaCtr8wRoJzly8qL8TaOu3g_lKo0maDznBFPCWfJe0/edit?tab=t.a0464ifbf975), prepared 22 August 2026.

Status vocabulary:

- **Implemented** — available in the frontend and fixture BFF.
- **Integrated** — frontend contract and states exist; production truth comes from the platform gateway.
- **Gated** — intentionally unavailable until the approval named by the PRD exists.
- **Platform dependency** — cannot be truthfully completed by the frontend repository alone.

## Numbered functional requirements

| Requirement | Status | Implementation / boundary |
| --- | --- | --- |
| MS-FEED-001 | Implemented | Unified lanes render posts, stories, live streams, scheduled activities and platform/product-linked events. |
| MS-FEED-002 | Integrated | Lane/ranking selection is supported; default relevance configuration belongs to the feed service. |
| MS-FEED-003 | Implemented | Live, scheduled, ended, replay and cancelled states poll and update without restart. |
| MS-FEED-004 | Implemented | Stories use a 24-hour TTL; reporting/moderation paths are present. Retention policy remains an operations decision. |
| MS-FEED-005 | Implemented | Feed cards resolve direct internal/external actions and preserve source attribution. |
| MS-DISC-001 | Implemented | `/discover` browses profiles, streams, activities, products and content by type/category metadata. |
| MS-DISC-002 | Integrated | Typed unified search route, loading/error/empty states and fixture search are complete; production indexing belongs to the gateway/search service. |
| MS-DISC-003 | Integrated | Weekly spotlight UI exists; operations summary carries auditable spotlight actions. Production approval tooling is a platform dependency. |
| MS-DISC-004 | Platform dependency | Feed surfaces measurable lanes and recommendation events; ranking logic and safety evaluation belong to the feed service. |
| MS-SOC-001 | Implemented | Public profiles show identity, biography, roles, status and activity history. |
| MS-SOC-002 | Integrated | Profile follow/unfollow is persistent. Product/category/activity follow requires corresponding gateway entities. |
| MS-SOC-003 | Implemented/Gated | Approved status is displayed; unresolved eligibility and paid economics are explicitly hidden behind governance state. |
| MS-SOC-004 | Integrated | `/notifications` supports follow, schedule, go-live, ticket, product and account signals with read state. Delivery is a notification-service dependency. |
| MS-SOC-005 | Implemented | Profile block/unblock, content/profile reporting and stream chat moderation are present. |
| MS-CREATE-001 | Implemented | Updates support text, media URL, deep-link CTA, preview-level validation and publication. |
| MS-CREATE-002 | Implemented | Games, streams and events can be scheduled with access/deep-link metadata. |
| MS-CREATE-003 | Implemented | Forms prevent missing required metadata and surface actionable API validation errors. |
| MS-CREATE-004 | Implemented | Owners can edit or cancel scheduled activities; fixture changes are reflected immediately. Audit persistence is a platform dependency. |
| MS-STREAM-001 | Integrated | Browser/RTMP publishing, studio controls and in-platform playback are implemented; production media infrastructure supplies credentials. |
| MS-STREAM-002 | Integrated/Gated | Playback checks entitlement before media; free/KASH access works through gateway; unresolved VIP rules default off. |
| MS-STREAM-003 | Implemented | Room exposes host/follow, context, chat, reactions, likes, share, tickets and Market Pulse without leaving playback. |
| MS-STREAM-004 | Implemented | Scheduled, interrupted, failed, ended, replay-processing and replay states are explicit. |
| MS-STREAM-005 | Integrated | Start/playback errors, heartbeat watch time, 30-second qualified watch and participation events are instrumented. Server analytics reconciliation is a platform dependency. |
| MS-STREAM-006 | Gated | VIP display/selection/editing is controlled by `NEXT_PUBLIC_MS_VIP_ACCESS_ENABLED`, default off. Gateway enforcement is still required. |
| MS-TICKET-001 | Integrated | Quote → terms → confirmation → entitlement → wallet/watch flow is complete. |
| MS-TICKET-002 | Integrated | Decimal KASH pricing is server-configured and shown before confirmation; no client price is hard-coded. |
| MS-TICKET-003 | Integrated | Ticket wallet displays status and playback consumes `myTicket` entitlement. |
| MS-TICKET-004 | Platform dependency | Amount, purpose, outcome, receipt and support reference are visible; authoritative KASH ledger/rate/reconciliation belongs to KASH services. |
| MS-TICKET-005 | Integrated | Refund/cancellation and replay terms appear before purchase and on the durable ticket. Actual refunds/support actions belong to the gateway/operations service. |
| MS-STORE-001 | Implemented | Catalogue/detail include ownership, description, category, pricing/access, availability and CTA. |
| MS-STORE-002 | Implemented | Content deep links directly to store items and carries originating source context. |
| MS-STORE-003 | Implemented | Free is one action; paid is detail → one confirmation. Funnel events capture views and completion. |
| MS-STORE-004 | Integrated | Internal source is carried in URLs/events; authoritative last-touch and assisted attribution belongs to analytics/order services. |
| MS-STORE-005 | Implemented | Orders expose item, price, state, ownership, receipt/support reference and return CTA. |
| MS-KASH-001 | Implemented | `docs/GOVERNANCE.md` and default-off flags distinguish confirmed, proposed and prohibited mechanics. |
| MS-KASH-002 | Platform dependency | User-readable ticket/order outcome and references exist; durable ledger and reconciliation require KASH services. |
| MS-KASH-003 | Implemented | Analytics separates feed views, starts, qualified watch time, participation and conversion. |
| MS-KASH-004 | Platform dependency | No frontend-only economic action is represented as settled; ledger IDs/status/reconciliation must come from the platform. |
| MS-KASH-005 | Gated | Money-linked games, predictions and staking are hard-disabled pending review. |
| MS-STATUS-001 | Gated | Roles/status display exists; new eligibility definitions remain draft until written approval. |
| MS-STATUS-002 | Gated | The unconfirmed 50% threshold is not shown or used as a live eligibility rule. |
| MS-STATUS-003 | Integrated | Spotlight UI and an auditable operations view exist; production approval persistence belongs to operations services. |
| MS-STATUS-004 | Gated | Paid verification remains “Coming soon”; no purchase path is exposed. |

## Cross-cutting PRD coverage

- Responsive home, cards, schedule, stream room, profiles, ticketing, store, status and operations surfaces are implemented with loading, empty, error and degraded states.
- Native HLS playback uses browser controls and supports a captions track when the playback service supplies `captionUrl`.
- `/operations` provides QMA/viewership/conversion/entitlement metrics, reliability alerts, moderation decisions, entitlement lookup and audit history.
- Analytics payloads are versioned and include stable session, timestamp, device, surface, entity, source and access context.
- Idempotency, authoritative RBAC, payment/KASH reconciliation, media security, SLO dashboards, notification delivery, content version history and durable audit storage remain backend/infrastructure responsibilities; the frontend does not fake them.

## Governance decisions still required

1. VIP versus regular access timing and replay/refund entitlements.
2. Verification eligibility, duration, revocation, appeal and any commercial sequence.
3. KASH ledger and settlement design for live gifts or other participation spending.
4. Legal, fairness and age-gating approval for any money-linked game, prediction or staking feature.
5. Qualified-watch threshold and formal QMA reporting window.

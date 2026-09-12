# Backlog

Work that is decided to wait, with what it needs before it can start.

## Subscription plans (Settings → Subscription)

Parked by ogazboiz on 2026-09-11. The screen shows Square Basic (free), King and Queen ($100/month) and Lord Emperor ($500/month); Upgrade stays disabled as "Coming soon" until this is decided. Nothing plan-shaped exists on the service. Questions to answer before anything is built:

1. Does a paid plan grant the verification tag outright, or only for accounts an admin already approved? Verification is admin-reviewed today, and tips and "Messages from: verified" trust it.
2. Currency: KASH is the only payment rail. Fixed KASH prices, KASH at a USD rate (who sets it), or a new card/fiat rail? What amounts?
3. Billing: monthly only or annual too; manual KASH renewal each period with reminders (as verification works today) or automatic charging?
4. What each plan unlocks exactly — King and Queen's "basics", and what Lord Emperor adds.
5. The king and queen badge: a new badge kind, and where it shows.
6. Lapse: grace period, and what disappears (badge, tag, features).
7. Upgrades and downgrades mid-period: immediate with or without proration, or at period end; refunds.
8. Accounts paying the 25 KASH verification renewal today: move them onto a plan, grandfather them, or keep verification separate.
9. Who can buy: anyone, or only people meeting the verification eligibility rule.
10. Admin controls: granting a plan free, or revoking one.

Backend work once answered: plan catalogue, subscriptions table (status, periodEnd), purchase and renew over the KASH rail with ledger rows, a lapse sweep, badge fields on profiles, and `GET /plans`, `GET /me/subscription`, `POST /me/subscription`.

# Paying with KASH

How to add a feature to Market Square that costs money.

Read this before pricing anything. The rules below are not ceremony — each one
exists because the alternative loses somebody's money or lies to them about
whether they were charged.

---

## The one thing to get right first

**Who receives the money?** The answer decides which mechanism you use, and the
two are not interchangeable.

| The user pays…     | Mechanism                               | Examples                                            |
| ------------------ | --------------------------------------- | --------------------------------------------------- |
| **the platform**   | the **kash rail** (`POST /rail/debits`) | stream ticket, ARK Store item, verification renewal |
| **another person** | a **peer transfer** the user signs      | tips                                                |

If you find yourself wanting the rail to move money from one user to another —
stop. It cannot, and the reason matters (see [Why](#why-two-mechanisms)).

---

## Paying the platform — the rail

### The flow

```
1. user taps Buy
2. client asks the user to SIGN A PERMIT        ← off-chain, gasless, one prompt
3. market-square service → POST /rail/debits    ← carries the permit
4. kash burns the KASH, answers `confirmed`
5. market-square marks the ticket/order settled
```

### Step 2 is the frontend's job, and it is the step people forget

The user signs an **EIP-2612 permit**: an off-chain signature authorising kash
to spend that exact amount. It is **gasless** — a signature prompt, not a
transaction, so it costs the user nothing and confirms instantly.

Without it the backend would be spending someone's balance on nothing but its
own say-so. That is custody, and this platform is explicitly **not custodial**
(ADR-0005). The rail refuses a debit that has no permit for exactly that
reason.

The conversion desk already does this — copy its pattern rather than inventing
one.

### What the service sends

```jsonc
POST /rail/debits          // Authorization: Bearer <KASH_RAIL_API_KEY>
{
  "wallet":  "0xabc…",
  "amountKash": "25",      // decimal STRING, never a number
  "reason": "ticket_purchase",
  "idempotencyKey": "<the ticket's own id>",
  "refType": "ticket",
  "refId": "<ticket id>",
  "permit": { "deadline": 1767225600, "v": 27, "r": "0x…", "s": "0x…" }
}
```

### Rules that are not optional

**Amounts are decimal strings.** `"25"`, never `25`. Floats do not hold money —
`0.1 + 0.2` is not `0.3`, and a tally that drifts cannot be reconciled.

**The idempotency key is the payment's identity, not the request's.** Use the
row's own id (the ticket id, the order id). Replaying it returns the **original
outcome** and charges nothing further. This is the single guard that makes a
lost response safe: without it, a user whose connection dropped mid-purchase
pays twice.

**A replay of a FAILED debit answers `failed`.** Do not treat "I got a
response" as "it worked" — check `status`.

**Write your row BEFORE you call the rail.** `pending` → call → `confirmed`. If
the call is lost, a `pending` row is recoverable; a debit with no row of yours
is not.

### When you are unsure whether it landed

```
GET /rail/debits/<idempotencyKey>
```

- `{ found: false }` — it never landed. **Fail the order.**
- `{ found: true, status: "confirmed" }` — it did. Settle.
- `404` — the rail is not deployed here. **Retry later**, do not fail.

That distinction is deliberate: an unknown key and a missing route need
opposite responses, so the rail answers `{ found: false }` rather than 404 for
the first.

### Refunds

```
POST /rail/refunds   { "railRef": "<the idempotencyKey>" }
```

Only a **confirmed** debit can be refunded. Refunding twice is safe — it
returns the same row rather than paying out again.

---

## Paying another person — tips

The rail cannot do this. A user's KASH moves to another user only when **they**
sign the transfer.

```
1. market-square creates a `pending` tip carrying the author's wallet
2. the CLIENT signs a KSH transfer and reports its txHash
3. kash's watcher reconciles it and publishes `kash.transfer.reconciled`
4. market-square matches on txHash and confirms the tip
```

`txHash` is the correlation key — matching on `(from, to, amount)` would
confuse two identical tips sent seconds apart.

**Never show a tip as sent until step 4.** `pending` means the money may or may
not have moved. A receipt for a payment that did not happen is worse than no
receipt.

---

## Why two mechanisms

KSH is a **real on-chain token**, and this platform is **non-custodial**
(ADR-0005): user actions are signed client-side and the backend holds no user
wallet. So:

- **A permit lets kash spend on the user's behalf** — because the user signed
  that specific authorisation. This is how a spend to the platform works.
- **Nothing lets the backend move one user's tokens to another.** A peer
  transfer is signed by the holder, full stop.

A ledger-only "transfer" that skipped the chain would desync the ledger from
real balances — quietly making the numbers that back conversion and redemption
untrue. That is why it is not offered rather than approximated.

---

## Known consequence: spends BURN

A rail debit **destroys** the KASH. The KashController exposes `mint`,
`mintBatch` and `burn` and no transfer, so a spend cannot be routed to a
treasury wallet.

**Nobody receives ticket or store money — supply simply shrinks.** In-app
purchases are a token **sink**, not revenue.

This may be exactly what is wanted. If it is not — if ticket money should reach
the host who sold it, or a platform treasury — the controller needs a transfer
function and the rail changes to match. **Settle this before pricing anything**,
because it decides whether selling something is income or deflation.

A refund mints the amount back, so a burn/refund pair nets to zero.

---

## Adding a paid feature: the checklist

1. **Decide who receives the money** — platform (rail) or person (peer transfer)
2. Give the payment a **row of its own** with a stable id, written `pending`
   before any call
3. Have the client **sign a permit** and pass it through
4. Call the rail with the row's id as `idempotencyKey`
5. Settle **only** on `confirmed` — never on "the call returned"
6. Handle the three lookup answers distinctly: never landed / landed / rail
   absent
7. Amounts as **decimal strings**, end to end

---

## Status

The rail is **built** (`apps/kash`, monorepo). Before it can be used:

- `KASH_RAIL_API_KEY` must be set on kash — unset, the routes return 404
- market-square points `KASH_SERVICE_URL` at kash and sets `PAYMENT_RAIL=kash`
- the tip flow still assumes a server-side debit and needs rewriting to the
  client-signed flow above

Until then market-square runs `PAYMENT_RAIL=mock`, which always succeeds and
settles nothing. **It must never run that way in production** — the service
refuses to boot on the mock rail when `NODE_ENV=production`, for that reason.

## See also

- `docs/handoffs/market-square-kash-rail.md` (monorepo) — the rail's contract
- `packages/events/contracts.md` (monorepo) — `kash.transfer.reconciled`
- ADR-0005 (monorepo) — why the platform is non-custodial

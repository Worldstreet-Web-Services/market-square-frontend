import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * KASH AND COINS ARE NOT THE SAME THING.
 *
 * KASH is the money. Coins are what the gift tray spends. Being short of coins
 * opened the KASH top-up, so somebody with KASH already in their wallet was
 * sent to buy MORE KASH and came back with exactly as many coins as before —
 * none (ogazboiz, 2026-09-24: "i have to buy kash for me to get coin when i
 * have some kash in my wallet").
 *
 * Nothing failed. Both sheets work; they buy different things. That is why it
 * is pinned by name here rather than left to whoever next reads the wiring.
 */
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("being short of coins buys coins", () => {
  const rooms = [
    "features/houses/components/house-room.tsx",
    "features/streams/components/stream-room.tsx",
  ];

  it("opens the coin purchase from both rooms, never the KASH one", () => {
    for (const room of rooms) {
      const src = read(room);
      assert.match(src, /<CoinBuySheet/u, `${room} does not offer a coin purchase`);
      assert.doesNotMatch(
        src,
        /<KashBuySheet[\s\S]{0,120}topUpOpen/u,
        `${room} still sends a coin shortfall to the KASH top-up`
      );
    }
  });

  it("carries the shortfall, so the sheet can offer exactly what was missing", () => {
    // The overwhelmingly common reason to open this is that ONE gift was a
    // specific number of coins out of reach. Arriving at a generic pack list
    // makes the buyer do that subtraction themselves.
    const tray = read("features/streams/components/gift-sheet.tsx");
    assert.match(tray, /onTopUp\?: \(needed: number\) => void;/u, "the tray asks for no amount");
    assert.match(tray, /onTopUp\(total\)/u, "the Get more door forgets what was needed");
    assert.match(tray, /onTopUp\?\.\(total\)/u, "the Send button forgets what was needed");
    for (const room of rooms) {
      assert.match(read(room), /onTopUp=\{\(needed\) => \{/u, `${room} drops the shortfall`);
    }
  });
});

describe("the coin purchase is the one step where real money moves", () => {
  const hook = read("features/gifts/hooks/use-gifts.ts");

  it("signs, waits, and only then reports — the same order a tip uses", () => {
    // The KASH rail exposes mint and burn and NO transfer, and the platform is
    // non-custodial, so the buyer's own wallet is the only thing that can move
    // their money. `toWallet` present IS the instruction to sign.
    assert.match(hook, /if \(!purchase\.toWallet\)/u, "a purchase with nothing to sign is not handled");
    assert.match(hook, /phase\("signing"\)/u);
    assert.match(hook, /phase\("confirming"\)/u);
    assert.match(hook, /phase\("reporting"\)/u);
    assert.match(hook, /await reportCoinTransfer\(purchase\.id, txHash\)/u);
  });

  it("records the hash BEFORE waiting, which is what makes a retry free", () => {
    /*
      Between signing and reporting the money has MOVED and the service does
      not know. A retry that started over would sign a second transfer for
      coins already paid for. The transfer is already broadcast by the time the
      wait begins, so recording only successful payments would record exactly
      the ones that never needed rescuing.
    */
    const signed = hook.indexOf('holdPayment("coins"');
    const waited = hook.indexOf('phase("confirming")');
    assert.ok(signed > 0 && waited > 0, "the hold or the wait is gone");
    assert.ok(signed < waited, "the hash is recorded after the wait — a retry can now double-charge");
    assert.match(hook, /clearHeldPayment\("coins", wallet\)/u, "a settled purchase stays held for ever");
  });

  it("uses its OWN payment namespace, so a stranded purchase cannot be replayed as a tip", () => {
    // Both are a KASH transfer signed by the same wallet, and their recovery
    // paths report to different routes. Replaying one as the other would pay a
    // stranger the money somebody spent on coins.
    const store = read("lib/payment-store.ts");
    assert.match(store, /PaymentNamespace = "kash" \| "token" \| "tip" \| "ticket" \| "coins";/u);
    assert.match(hook, /heldPayment\("coins", wallet, key\)/u);
  });

  it("INVALIDATES the balance rather than writing it — the opposite of a gift buy", () => {
    /*
      A gift purchase settles instantly and its response IS the new balance, so
      that one is written. This one stays PENDING until the service observes
      the chain, so writing a number here would credit coins nobody has been
      given yet. The two buys are shaped differently on purpose.
    */
    const coinBuy = hook.slice(hook.indexOf("export function useBuyCoins"));
    assert.match(coinBuy, /invalidateQueries\(\{ queryKey: COINS_KEY \}\)/u);
    assert.doesNotMatch(coinBuy, /setQueryData\(COINS_KEY/u, "pending coins are being credited early");

    const giftBuy = hook.slice(hook.indexOf("export function useBuyGift"), hook.indexOf("export function useBuyCoins"));
    assert.match(giftBuy, /setQueryData\(COINS_KEY, result\.balance\)/u, "the instant buy went back to refetching");
  });

  it("never names a price, and always carries a key", () => {
    const api = read("features/gifts/lib/api.ts");
    const body = api.slice(api.indexOf("export async function buyCoins"));
    const posted = body.slice(body.indexOf('"/me/coins"'), body.indexOf("Idempotency-Key"));
    assert.doesNotMatch(posted, /kash|price/iu, "the client is naming an amount it must not choose");
    assert.match(body, /"Idempotency-Key": input\.idempotencyKey/u);
  });
});

describe("a deployment with no treasury says so", () => {
  const sheet = read("features/gifts/components/coin-buy-sheet.tsx");

  it("draws `purchasable: false` as a state, not an error", () => {
    // It means no treasury wallet is configured — there is nowhere to send the
    // money, so every purchase would be refused. A button that always fails is
    // worse than one that says it is not switched on yet.
    assert.match(sheet, /purchasable === false \?/u);
    assert.match(sheet, /aren&rsquo;t switched on yet/u);
    // Three states: `undefined` is the read still in flight and must not
    // render as a refusal, or the sheet flashes one on every open.
    assert.match(sheet, /purchasable === undefined/u, "an in-flight read is being treated as off");
  });

  it("derives its packs from the service's rate rather than typing them out", () => {
    // `coinsPerKash` lives in two repositories; a pack list written by hand is
    // a third place for it to be wrong.
    assert.match(sheet, /capability\.data\?\.coinsPerKash/u);
    assert.doesNotMatch(sheet, /\b1000\b/u, "a coin rate is hard-coded in the pack list");
  });

  it("promises coins are ON THE WAY, never that they arrived", () => {
    // The purchase is pending until the chain is observed; saying it landed
    // would claim a balance nobody has yet.
    assert.match(sheet, /are on their way/u);
    assert.doesNotMatch(sheet, /coins added/iu);
  });
});

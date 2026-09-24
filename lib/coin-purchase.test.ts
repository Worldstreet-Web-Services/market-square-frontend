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

/**
 * THE CLIENT IS READY FOR THE STOCK ECONOMY BEFORE THE SERVER FLIPS TO IT.
 *
 * ogazboiz asked devops to set `GIFT_SPEND_FROM_INVENTORY=true` alongside the
 * treasury wallet. With the tray still drawing from the catalogue, that would
 * have taken EVERY send down: nobody owns stock yet, so the service's
 * `sendFromStock` path would answer 409 `NO_GIFT_IN_STOCK` for every gift in
 * every room, and the client had no way to say why or offer a fix.
 *
 * Built so the switch is a switch: inert while the flag is false, correct the
 * moment it is true, with no deploy needed in between.
 */
describe("the tray follows whichever economy the service is running", () => {
  const tray = read("features/streams/components/gift-sheet.tsx");
  const room = read("features/houses/components/house-room.tsx");
  const grid = read("components/ui/gift-grid.tsx");

  it("reads the switch rather than inferring it from the routes answering", () => {
    assert.match(room, /giftsComeFromStock\(useTipCapability\(\)\.data\)/u);
    // And the inventory read only happens in that economy, and only while the
    // tray is open — a pay-at-send deployment never fires it at all.
    assert.match(room, /useGiftInventory\(fromStock && giftsOpen\)/u);
  });

  it("shows what you hold, and only where holding is a thing", () => {
    assert.match(tray, /owned=\{fromStock \? owned : undefined\}/u, "counts leak onto a pay-at-send tray");
    assert.match(grid, /owned\?: ReadonlyMap<string, number>;/u);
    // Zero IS drawn — "you have none of this one" is a fact with an action
    // attached, and hiding it makes a stock tray feel like it refuses at random.
    assert.match(grid, /\(owned\.get\(gift\.id\) \?\? 0\)\.toLocaleString\(\)/u);
  });

  it("BUYS INSIDE THE SEND, so one tap is one tap", () => {
    /*
      ogazboiz: "we need it like tiktok way". TikTok has no gift inventory —
      you buy coins, tap a rose, and it flies. An earlier pass made the tray
      say "Get Rose" when you held none, which is exactly the shopping step
      TikTok removed and where senders are lost.

      So the room buys the shortfall and sends, as one action. Both calls are
      instant and neither needs a signature, so to the person nothing happened
      except a gift flying.
    */
    assert.match(room, /const shortfall = held === null \? 0 : quantity - held;/u);
    assert.match(room, /shortfall > 0\s*\?\s*buyGiftStock\.mutateAsync\(\{/u);
    // Only what is MISSING: holding two Roses and sending three buys ONE.
    // Charging for three takes money for stock already owned.
    assert.match(room, /quantity: shortfall,/u);
    // And the send follows the buy, rather than racing it.
    assert.ok(
      room.indexOf("buyGiftStock.mutateAsync") < room.indexOf("payGift.mutateAsync"),
      "the send no longer waits for the stock it needs"
    );
  });

  it("mints a FRESH idempotency key per tap, not a stable one per gift", () => {
    /*
      THE ONE SHAPE THAT BREAKS THIS ROUTE. The service returns the FIRST
      purchase's result for a repeated key and buys NOTHING — by design, it is
      what makes a retry safe. So a stable key per gift means the second Rose
      to the same person reports success, adds no stock, and fails at the send.
      Silently, and only for the most ordinary thing anybody does in a room:
      send the same gift to the same person twice.

      A key protects ONE INTENT. Two taps are two intents.
    */
    assert.match(room, /idempotencyKey: newIntentId\(`gift:\$\{gift\.id\}`\)/u);
    assert.doesNotMatch(
      room,
      /idempotencyKey: `gift:\$\{gift\.id\}:/u,
      "the buy key is stable across taps again — the second gift will buy nothing"
    );
  });

  it("does not let the TRAY shop — owning is shown, never gated on", () => {
    // The counts inform; coins gate. That is the real limit and it already has
    // its own detour to the top-up.
    assert.doesNotMatch(tray, /onBuyGift/u, "the tray is asking people to shop again");
    assert.doesNotMatch(tray, /You have no \$\{selected\.name\}/u, "a tile is refusing instead of sending");
  });

  it("keeps the stale-inventory dependency, because a stale one charges twice", () => {
    // Read inside the send so it is the CURRENT stock. At mount it would buy
    // a rose the sender already holds, or fail to buy when they are short.
    assert.match(room, /giftStock\.data, buyGiftStock\]/u, "the send can now read a stale inventory");
  });

  it("treats an unknown inventory as unknown, never as zero", () => {
    /*
      The same rule `balanceCoins` follows. `owned` absent means this tray has
      not been told; treating it as nothing would block every send the moment
      an inventory read was slow, which is the interface inventing a refusal
      the service never made.
    */
    // It moved from the tray to the SEND, where the money is: an undefined
    // `giftStock.data` (still loading, or a failed read) buys NOTHING rather
    // than buying a rose the sender may already hold.
    assert.match(room, /const held = fromStock && giftStock\.data \? \(ownedByGift\(giftStock\.data\)\.get\(gift\.id\) \?\? 0\) : null;/u);
    assert.match(room, /const shortfall = held === null \? 0 : quantity - held;/u);
  });

  it("turns the service's own refusal into the shop", () => {
    // 409 NO_GIFT_IN_STOCK names the gift, so the answer is to open it rather
    // than apologise. A refused send spends nothing — the stock decrement and
    // the tip row are one transaction on the service.
    assert.match(room, /const missing = noGiftInStock\(error\);/u);
    assert.match(room, /setBuyingGift\(missing\.giftId\)/u);
  });
});

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import {
  buyCoins,
  buyGift,
  fetchGiftCapability,
  fetchGiftCatalog,
  fetchGiftInventory,
  reportCoinTransfer,
} from "@/features/gifts/lib/api";
import { KASH_TOKEN_DECIMALS } from "@/lib/kash-amount";
import { encodeErc20Transfer, toBaseUnits } from "@/lib/erc20";
import { holdKey } from "@/lib/payment-hold";
import { clearHeldPayment, heldPayment, holdPayment } from "@/lib/payment-store";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useEvmSend } from "@/hooks/use-evm-send";
import { useKashAccount } from "@/features/kash";
import { coinsFromKash } from "@/lib/coins-from-kash";
import { useKashStatus } from "@/hooks/use-kash-status";
import type { GiftHolding } from "@/features/gifts/lib/types";

const CATALOG_KEY = ["ms", "gift-catalog"] as const;
const INVENTORY_KEY = ["ms", "gift-inventory"] as const;
const COINS_KEY = ["ms", "coins"] as const;

/**
 * WHETHER THIS DEPLOYMENT HAS A GIFT ECONOMY AT ALL.
 *
 * `undefined` while the read is in flight, `false` once a 404 has been seen,
 * `true` once the route has answered. THREE states, not two, and the
 * difference is the whole design: a control that hides itself while a lookup
 * is still in the air flickers, and one that hides on a network blip removes
 * a feature over a dropped packet.
 *
 * Same shape the tips slice uses for its own availability, for the same
 * reason — a 404 is a fact about the DEPLOYMENT, not about the thing you
 * happened to tap.
 */
export function useGiftEconomy(): boolean | undefined {
  const { authenticated } = useAuth();
  const query = useQuery({
    queryKey: CATALOG_KEY,
    queryFn: fetchGiftCatalog,
    enabled: authenticated,
    // The catalogue is a price list, not a feed. It changes when the product
    // changes, so it is read once a session rather than polled.
    staleTime: Infinity,
    retry: false,
  });
  if (query.isSuccess) return true;
  if (query.isError) return errorCode(query.error) === "NOT_FOUND" ? false : undefined;
  return undefined;
}

/** The service's price table, empty until it carries one. */
export function useGiftCatalog() {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: fetchGiftCatalog,
    enabled: authenticated,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * WHAT THIS READER OWNS.
 *
 * @param enabled  Off where nothing is showing a count — the gallery and the
 *                 room tray both want this, and neither wants it while closed.
 *
 * NOT POLLED. An inventory moves when YOU buy or YOU send, and both of those
 * go through mutations that invalidate this key. A poll would be asking the
 * server to repeat what this client already knows it did.
 */
export function useGiftInventory(enabled = true) {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: INVENTORY_KEY,
    queryFn: fetchGiftInventory,
    enabled: enabled && authenticated,
    retry: false,
  });
}

/**
 * THE READER'S COIN BALANCE, or null when this deployment has no coins.
 *
 * @param enabled  Off while nothing is showing it — the gift tray wants this
 *                 only while open, and a balance nobody is looking at is a
 *                 request nobody needed.
 *
 * NULL IS "NOT KNOWN", NOT "NONE". A read still in flight, a failed one, or a
 * service without coins must not grey out the tray: that would be the
 * interface inventing a shortfall it cannot see, and only the service can
 * actually refuse a spend. The tray treats null as "let the service decide".
 */
export function useCoinBalance(enabled = true): number | null {
  const { authenticated } = useAuth();

  /*
    ─── DERIVED, FULL STOP. THERE IS NO STORED BALANCE TO READ ────────────────

    A coin is a VIEW of the KASH somebody holds, at the service's own rate.
    Not gated on anything, because there is nothing left for the old display
    to be right about — verified on the service's `origin/main`, not assumed:

      · `spendCoinsOnGift` exists in the repository layer and has NO CALLER in
        any service. Nothing spends a stored coin balance.
      · `tip-service` — which is where a gift actually goes — contains no coin
        read and no coin debit on either path.

    So the stored balance is credited by a purchase and spent by NOTHING. It
    was never what a send drew on, which is why ogazboiz could send a gift and
    watch the recipient get their 50% while this number sat at zero.

    ─── AND WHY IT IS NOT GATED ON `spendGiftsFromCoins` ──────────────────────
    That was the first version of this and it was inverted. The flag names the
    MONEY path, not the display:

      true   pay at the send, split into the recipient's leg and the fee
      false  the old single-leg path — recipient 100%, Square 0%

    So gating the derived display on `=== false` would have tied a display fix
    to turning Square's revenue off. The flag stays exactly where it is.
  */
  const kash = useKashAccount(enabled && authenticated);
  const rate = useGiftCapability().data?.coinsPerKash ?? null;
  return coinsFromKash(kash.data?.balance, rate);
}

/** `giftId -> how many I own`, for the surfaces that render a count per tile. */
export function ownedByGift(items: GiftHolding[] | undefined): Map<string, number> {
  const owned = new Map<string, number>();
  for (const item of items ?? []) owned.set(item.giftId, item.quantity);
  return owned;
}

/**
 * Buy gifts into the reader's own stock.
 *
 * NO OPTIMISTIC COUNT. Every other mutation in this app flips something the
 * reader can see and rolls it back on failure; this one moves MONEY, and a
 * count that went up before the charge landed is a claim that a purchase
 * happened. The new quantity is read back from the service's own answer, and
 * the inventory is invalidated so anything else rendering a count agrees.
 */
export function useBuyGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: buyGift,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
      /*
        THE NEW BALANCE COMES BACK IN THE RESPONSE, so it is written rather
        than re-fetched. The service answers with the stock AND the balance
        precisely so a client never has to ask again to redraw, and a refetch
        here would put a round trip between the purchase and the number it
        changed — the one moment somebody is actually watching that figure.

        This is not an optimistic write: it is the server's own answer to the
        request that moved it, which is the only number allowed to set a
        balance in this file.
      */
      queryClient.setQueryData(COINS_KEY, result.balance);
    },
  });
}

const CAPABILITY_KEY = ["ms", "gift-capability"] as const;

/**
 * CAN COINS BE BOUGHT HERE AT ALL, AND AT WHAT RATE.
 *
 * `purchasable: false` means no treasury wallet is configured — there is
 * nowhere to send the money, so every purchase would be refused. That is a
 * STATE to draw, not an error to swallow: a "Buy coins" button that always
 * fails is worse than one that says it is not switched on yet.
 */
export function useGiftCapability() {
  return useQuery({
    queryKey: CAPABILITY_KEY,
    queryFn: fetchGiftCapability,
    // The rate and the switch change on a deploy, not on a poll.
    staleTime: Infinity,
    retry: false,
  });
}

/** Phases a buyer can be shown. Same vocabulary a tip already uses. */
export type CoinBuyPhase = "creating" | "signing" | "confirming" | "reporting";

/**
 * BUY COINS WITH KASH — create, sign, report.
 *
 * The same three steps, in the same order, for the same reason as a tip:
 * the KASH rail exposes mint and burn and NO transfer, and the platform is
 * non-custodial, so the buyer's own wallet is the only thing that can move
 * their money. The service opens a pending purchase, hands back a wallet and
 * an amount, and credits nothing until it has seen the chain itself.
 *
 * ─── THE HOLD IS WHAT MAKES A RETRY FREE ─────────────────────────────────────
 * Between signing and reporting there is a window where the money has MOVED
 * and the service does not know. A retry that started over would sign a second
 * transfer for coins already paid for. So the hash is written to the hold
 * BEFORE the confirmation wait — the transfer is already broadcast by then,
 * and from that moment the only thing that makes a retry safe is that the hash
 * and the purchase it belongs to were recorded first.
 *
 * Keyed on the PURCHASE SIZE, since two different coin packs are two different
 * intents; the same pack retried is one.
 */
export function useBuyCoins() {
  const queryClient = useQueryClient();
  const { address: wallet } = useEmbeddedWallet();
  const { send, waitForReceipt } = useEvmSend();
  const chain = useKashStatus().data?.chain ?? null;

  return useMutation({
    mutationFn: async ({
      coins,
      onPhase,
    }: {
      coins: number;
      onPhase?: (phase: CoinBuyPhase) => void;
    }) => {
      const phase = onPhase ?? (() => {});
      const key = holdKey(`coins:${coins}`, String(coins));
      const held = wallet && key ? heldPayment("coins", wallet, key) : null;

      phase("creating");
      // The key travels with the request, so the same intent retried reaches
      // the SAME purchase rather than opening a second one.
      const purchase = await buyCoins({ coins, idempotencyKey: key ?? `coins:${coins}` });

      /*
        NO WALLET MEANS THERE IS NOTHING TO SIGN. A deployment that settles
        some other way has already finished by the time it answers, and asking
        the buyer to sign would be asking them to pay twice.
      */
      if (!purchase.toWallet) {
        void queryClient.invalidateQueries({ queryKey: COINS_KEY });
        return purchase;
      }
      if (!wallet) throw new Error("Sign in to buy coins.");
      if (!chain?.tokenAddress) {
        // Without the engine's own token address there is nothing to transfer,
        // and guessing one sends real money into nothing.
        throw new Error("Coin purchase isn't configured on this environment yet.");
      }

      let txHash = (held?.txHash ?? null) as `0x${string}` | null;
      if (!txHash || held?.ref !== purchase.id) {
        phase("signing");
        txHash = await send({
          to: chain.tokenAddress as `0x${string}`,
          // The TOKEN's precision, not the API's — see KASH_TOKEN_DECIMALS.
          data: encodeErc20Transfer(
            purchase.toWallet,
            toBaseUnits(purchase.kashPaid, KASH_TOKEN_DECIMALS)
          ),
          chainId: chain.chainId,
        });
        // Written BEFORE the wait: the transfer is already broadcast.
        if (key) holdPayment("coins", wallet, { key, txHash, ref: purchase.id });

        phase("confirming");
        const outcome = await waitForReceipt(txHash, chain.chainId);
        if (outcome === "reverted") {
          if (wallet) clearHeldPayment("coins", wallet);
          throw new Error("That transfer didn't go through. Nothing was charged.");
        }
      }

      phase("reporting");
      await reportCoinTransfer(purchase.id, txHash);
      if (wallet) clearHeldPayment("coins", wallet);

      /*
        THE BALANCE IS INVALIDATED, NOT WRITTEN. The opposite call from
        `useBuyGift`, and deliberately: a gift purchase settles instantly and
        its response IS the new balance, while this one stays PENDING until the
        service observes the chain. Writing a number here would credit coins
        nobody has been given yet.
      */
      void queryClient.invalidateQueries({ queryKey: COINS_KEY });
      return purchase;
    },
  });
}

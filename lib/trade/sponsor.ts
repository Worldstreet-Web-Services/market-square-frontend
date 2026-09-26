"use client";

import { createClient, http, type EIP1193Provider, type SignedAuthorization } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { getSponsoredEvmChainById } from "@/lib/trade/sponsored-evm";
import { isReceiptChain, publicClientForChain } from "@/lib/trade/receipt";
import { api } from "../square-path.ts";

// The shared 7702 Simple Account implementation used by permissionless. The
// EOA delegates to this logic at the same address, so sponsorship does not
// create or migrate funds into a separate smart-wallet address.
const SIMPLE_7702_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

// Every sponsored EVM transaction routes through our own proxy instead of
// Alchemy directly, so the API key and policy id never reach the client.
const BUNDLER_PATH = api("/api/alchemy-bundler");

export interface SponsoredCall {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}

export type SignAuthorization = (input: {
  contractAddress: `0x${string}`;
  chainId?: number;
  nonce?: number;
}) => Promise<SignedAuthorization<number>>;

// A minimal "can serve node reads" shape — satisfied by both a public read
// client (mainnet.base.org node) and the bundler-proxy client. Typed as a bare
// callable so viem's method-union request signatures on either client widen to
// it; `params` is passed through untouched to the JSON-RPC layer.
type ReadRequest = (args: { method: string; params: unknown }) => Promise<unknown>;

async function isAlreadyDelegated(request: ReadRequest, address: `0x${string}`): Promise<boolean> {
  const code = (await request({
    method: "eth_getCode",
    params: [address, "latest"],
  })) as string;
  return code.toLowerCase() === `0xef0100${SIMPLE_7702_IMPL.slice(2).toLowerCase()}`;
}

// Sends a sponsored EVM transaction from the user's embedded EOA, upgraded in
// place via EIP-7702. The EOA signs the one-time delegation if needed, then
// the userOp, and Alchemy's bundler + paymaster path covers the gas cost.
export async function sendSponsoredEvmCalls({
  chainId,
  address,
  provider,
  signAuthorization,
  accessToken,
  calls,
}: {
  chainId: number;
  address: `0x${string}`;
  provider: EIP1193Provider;
  signAuthorization: SignAuthorization;
  accessToken: string;
  calls: SponsoredCall[];
}): Promise<`0x${string}`> {
  const target = getSponsoredEvmChainById(chainId);
  if (!target) {
    throw new Error(`This chain is not configured for sponsored EVM sends (${chainId}).`);
  }

  // Bundler transport: ONLY the ERC-4337 UserOperation methods
  // (eth_sendUserOperation, eth_estimateUserOperationGas, …) go here, through
  // our Alchemy proxy.
  /*
    ─── A SEND IS NEVER RETRIED. THIS IS THE WHOLE POINT OF THIS BLOCK ─────────

    `retryCount: 0`, and it is load-bearing. viem's http transport defaults to
    THREE retries and retries on 408, 429, 502 and 504 — which is exactly the
    set our bundler proxy returns when Alchemy is throttled (429 passed
    through), unreachable (502) or slower than the proxy's 30s ceiling (504).

    `eth_sendUserOperation` is NOT IDEMPOTENT. If a userOperation reaches
    Alchemy and executes, but our proxy has already given up waiting for the
    answer, a retry submits a SECOND userOperation — and because the account's
    nonce advanced when the first one executed, the second is perfectly valid
    and executes too. One tap, two payments, and nothing in the client ever
    sees an error.

    ogazboiz: "no i paid once still pay again". Three transfers left his wallet
    that night, 0.01 KASH each, 34 and 17 blocks apart — about 68 and 34
    seconds, which is the shape of a 30s proxy timeout plus a retry, not of a
    person tapping. All three were single-leg transfers to the treasury, so
    none was a recipient being paid their share. Alchemy was rate limiting that
    same evening, which is what made the retries fire at all.

    The cost of not retrying is that a genuinely dropped send surfaces as an
    error the buyer retries DELIBERATELY, having seen it fail. That is the
    correct trade: a retry the person chose cannot charge them twice without
    their knowing, and a retry the transport chose can.

    This also covers the estimate methods, which ARE idempotent and could
    safely retry. Splitting them onto a second transport to win that back would
    buy a little latency on a bad day and put the send one config edit away
    from being retryable again. Not worth it.
  */
  const transport = http(`${BUNDLER_PATH}/${target.network}`, {
    fetchOptions: { headers: { Authorization: `Bearer ${accessToken}` } },
    retryCount: 0,
  });

  // Read client: ALL plain node reads (eth_getCode, eth_getTransactionCount, gas
  // reads) go to a real node RPC, NOT the Alchemy bundler endpoint. The bundler
  // endpoint is tuned for UserOperation methods; general state reads through it
  // are slow and intermittently time out — the `eth_getCode` the account builder
  // and delegation check issue on EVERY send was hanging there, which is what
  // failed createMarket (once per outcome in a multi-market event). This client
  // is what `to7702SimpleSmartAccount` and the bundler client use for reads;
  // only `sendUserOperation` uses the bundler transport. Chains without a
  // dedicated read node fall back to the bundler transport.
  const client = isReceiptChain(target.chainId)
    ? publicClientForChain(target.chainId)
    : createClient({ chain: target.chain, transport });

  const read: ReadRequest = (args) =>
    (client.request as (a: { method: string; params: unknown }) => Promise<unknown>)(args);

  let authorization: SignedAuthorization<number> | undefined;
  if (!(await isAlreadyDelegated(read, address))) {
    const nonce = Number(
      (await read({
        method: "eth_getTransactionCount",
        params: [address, "latest"],
      })) as string
    );
    authorization = await signAuthorization({
      contractAddress: SIMPLE_7702_IMPL,
      chainId: target.chainId,
      nonce,
    });
  }

  const account = await to7702SimpleSmartAccount({
    client,
    owner: provider,
    accountLogicAddress: SIMPLE_7702_IMPL,
  });

  // The bundler client reads through `client` (fast node) and submits the userOp
  // through `transport` (bundler proxy) — the split that keeps eth_getCode off
  // the bundler endpoint.
  // This policy is a Bundler Sponsored Operations policy, not an onchain
  // paymaster. The proxy adds its policy header only when the userOp is sent.
  const bundlerClient = createBundlerClient({ account, client, chain: target.chain, transport });

  const hash = await bundlerClient.sendUserOperation({
    calls,
    authorization,
    // These zero values are Alchemy's BSO signal. The bundler estimates and
    // fills the actual sponsored gas values before inclusion.
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    preVerificationGas: 0n,
  });

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
  return receipt.receipt.transactionHash;
}

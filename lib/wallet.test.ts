import assert from "node:assert/strict";
import { test } from "node:test";
import { embeddedEvmWallet, isEvmAddress, isOwnWallet } from "./wallet.ts";

const EMBEDDED = "0x1111111111111111111111111111111111111111";
const EXTERNAL = "0x2222222222222222222222222222222222222222";

// The client SDK's casing.
const clientEmbedded = {
  type: "wallet",
  address: EMBEDDED,
  chainType: "ethereum",
  walletClientType: "privy",
};

// The server SDK's casing, describing the same account.
const serverEmbedded = {
  type: "wallet",
  address: EMBEDDED,
  chain_type: "ethereum",
  wallet_client_type: "privy",
};

test("both Privy SDK spellings resolve to the same wallet", () => {
  // One rule, two casings. If these ever disagree, the browser asks about one
  // address and the server proves another, and the gate refuses a legitimate
  // request.
  assert.equal(embeddedEvmWallet([clientEmbedded]), EMBEDDED);
  assert.equal(embeddedEvmWallet([serverEmbedded]), EMBEDDED);
});

test("an external EVM wallet is NOT a fallback identity", () => {
  // wsws falls back to the first linked EVM wallet; we do not. A reader who
  // connected MetaMask once has not made it the wallet Market Square knows
  // them by, and stamping it would prove a different address server-side than
  // the browser asked about.
  const external = {
    type: "wallet",
    address: EXTERNAL,
    chainType: "ethereum",
    walletClientType: "metamask",
  };
  assert.equal(embeddedEvmWallet([external]), null);
  // Listed FIRST — the order an external wallet often arrives in — and the
  // embedded one is still the answer.
  assert.equal(embeddedEvmWallet([external, clientEmbedded]), EMBEDDED);
});

test("a Solana embedded wallet is not an EVM wallet", () => {
  // Privy creates both on the same app. KASH is an ERC-20 on Base, so a
  // Solana address here would be proven against an account that cannot exist.
  const solana = {
    type: "wallet",
    address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    chainType: "solana",
    walletClientType: "privy",
  };
  assert.equal(embeddedEvmWallet([solana]), null);
  assert.equal(embeddedEvmWallet([solana, clientEmbedded]), EMBEDDED);
});

test("non-wallet linked accounts are ignored", () => {
  assert.equal(
    embeddedEvmWallet([
      { type: "email", address: "someone@example.com" },
      { type: "google_oauth", address: "someone@example.com" },
    ]),
    null
  );
});

test("a wallet account with a malformed address is not a wallet", () => {
  // Trusting `address` because the account said `type: "wallet"` is how an
  // empty string becomes an identity that matches another empty string.
  for (const address of ["", "0x", "not-an-address", "0x1111", undefined]) {
    assert.equal(
      embeddedEvmWallet([{ ...clientEmbedded, address }]),
      null,
      String(address)
    );
  }
});

test("no accounts at all is no wallet, never a throw", () => {
  assert.equal(embeddedEvmWallet(null), null);
  assert.equal(embeddedEvmWallet(undefined), null);
  assert.equal(embeddedEvmWallet([]), null);
});

test("ownership is case-insensitive — one address, either casing", () => {
  // The engine lower-cases every wallet it is handed; a checksummed address
  // from the browser is the same account and must not be refused.
  assert.equal(isOwnWallet(EMBEDDED.toUpperCase().replace("0X", "0x"), EMBEDDED), true);
  assert.equal(isOwnWallet(EMBEDDED, EMBEDDED.toUpperCase().replace("0X", "0x")), true);
});

test("a different wallet is refused", () => {
  assert.equal(isOwnWallet(EXTERNAL, EMBEDDED), false);
});

test("NO shape of missing data grants access", () => {
  // The failure mode this exists to prevent: a session with no wallet, asked
  // about a request with no wallet, must not compare equal and pass.
  const nothing = [null, undefined, "", "0x", "null", "undefined"];
  for (const claimed of nothing) {
    for (const owned of nothing) {
      assert.equal(isOwnWallet(claimed, owned), false, `${claimed} / ${owned}`);
    }
    assert.equal(isOwnWallet(claimed, EMBEDDED), false, String(claimed));
    assert.equal(isOwnWallet(EMBEDDED, claimed), false, String(claimed));
  }
});

test("only a 20-byte hex address is an address", () => {
  assert.equal(isEvmAddress(EMBEDDED), true);
  for (const value of [
    EMBEDDED.slice(0, -1), // 19½ bytes
    `${EMBEDDED}0`, // 21 bytes
    EMBEDDED.replace("0x", ""), // no prefix
    "0xzzzz111111111111111111111111111111111111", // not hex
    123,
    null,
    {},
  ]) {
    assert.equal(isEvmAddress(value), false, String(value));
  }
});

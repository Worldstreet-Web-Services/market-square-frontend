// Wallet protection at the moment it is first needed.
// (Requires decane-connect-kit 2.23.0: deferDeviceProtection + protectDevice.)
//
// Sign-in asks for no passkey or password (app/providers.tsx sets
// deferDeviceProtection), so a new reader gets in the door with nothing in
// their way. The first wallet action — a tip, a gift, a purchase — is where
// that step belongs, and this is the one place it happens: before anything is
// signed, the device is checked, the reader is told why, and the kit stores
// the share under a passkey or a password. A protected device passes through
// at once; there is no second ask.
//
// "Not now" is honoured, and the action is not performed: an unprotected
// wallet moving money is the state the step exists to prevent. The reader is
// told so in the action's own error surface, and can tap again.

export interface ProtectableWallet {
  deviceProtected(): Promise<boolean>;
  protectDevice(): Promise<boolean>;
}

export class WalletProtectionDeclinedError extends Error {
  constructor() {
    super("Protect your wallet to continue.");
    this.name = "WalletProtectionDeclinedError";
  }
}

export function isWalletProtectionDeclined(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "WalletProtectionDeclinedError";
}

/**
 * Resolves once this device holds a protected share for the signed-in
 * account. `ask` is the explainer (a dialog); it answers whether to go on.
 */
export async function ensureWalletProtected(
  wallet: ProtectableWallet,
  ask: () => Promise<boolean>
): Promise<void> {
  if (await wallet.deviceProtected()) return;
  if (!(await ask())) throw new WalletProtectionDeclinedError();
  // False is the kit reporting a dismissed authenticator sheet or password
  // dialog: nothing was stored. Same answer as "not now".
  if (!(await wallet.protectDevice())) throw new WalletProtectionDeclinedError();
}

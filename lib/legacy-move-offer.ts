/**
 * SHOULD WE OFFER TO BRING AN OLD ACCOUNT, BEFORE ASKING FOR A NEW HANDLE?
 *
 * Signing in with Decane creates a new id. The first authenticated Square
 * request under it provisions an empty profile there, which is fine on its own:
 * when the link arrives, Square absorbs that empty shell and moves the real
 * profile onto the id.
 *
 * Absorbing it depends entirely on the shell being UNTOUCHED. The moment the
 * person does anything a human could have done — and the very first thing
 * onboarding asks for is a handle — the shell stops being ours to delete, and
 * the re-key refuses for good:
 *
 *   profile re-key REFUSED — the decane id already owns a profile; user is split
 *
 * They then hold two accounts: a new one with the handle they just invented,
 * and an old one with their followers, which nobody can rejoin without a human.
 *
 * So the offer goes BEFORE the claim. Somebody who had an account gets their
 * old handle back instead of inventing a worse one, and the dangerous window
 * between signing in and linking closes before it can be used.
 *
 * Dependency-free and alias-free so `node --test` runs it.
 */

export interface MoveOfferInput {
  /** The account has no handle yet — the only server truth onboarding reads. */
  mustClaim: boolean;
  /** Linking is built into this deployment at all (a legacy Privy app id). */
  legacyAvailable: boolean;
  /** They already said "I'm new here" on this browser. */
  dismissed: boolean;
}

export function shouldOfferLegacyMove(input: MoveOfferInput): boolean {
  return input.mustClaim && input.legacyAvailable && !input.dismissed;
}

/**
 * "I'm new here", kept per browser.
 *
 * Local on purpose, like every other onboarding step that is not the handle:
 * it records an answer to a question this browser asked, and getting asked
 * once more on a new device costs a tap. A column would not.
 */
const DISMISS_KEY = "ms:migration:move-offer-dismissed";

export function moveOfferDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Storage blocked: they see the offer again, which is the safe direction.
    return false;
  }
}

export function dismissMoveOffer(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Nothing to do — the offer simply reappears next time.
  }
}

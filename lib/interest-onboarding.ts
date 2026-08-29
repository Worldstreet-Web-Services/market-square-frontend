/**
 * Whether a reader should be asked to choose interests, and whether we may ask
 * again later.
 *
 * A first-run prompt is the easiest thing in an app to get wrong: ask too
 * eagerly and it lands on top of another prompt, or on a reader who already
 * answered; guard it too tightly and the new account it exists for never sees
 * it. So the rule is a pure function with the awkward cases named, rather than
 * a chain of `&&` inside a component nobody can test.
 */
export interface InterestPromptInput {
  /** Saving needs an account; a signed-out reader is not "new", just anonymous. */
  authenticated: boolean;
  /**
   * The username claim comes first. It is the identity everything else hangs
   * off, and two modal prompts stacked on a first visit is not an onboarding,
   * it is an obstacle course.
   */
  usernameUnclaimed: boolean;
  /**
   * `undefined` while `/me/interests` is still loading, or when the route is
   * not deployed. Either way there is nothing to decide on yet — asking now
   * risks asking someone who has already answered.
   */
  savedTopics: string[] | undefined;
  /** How many topics the service offers. Zero means there is nothing to pick. */
  availableTopics: number;
  /** Answered — or declined — on this device already. */
  alreadyAsked: boolean;
}

export function shouldAskInterests(input: InterestPromptInput): boolean {
  if (!input.authenticated) return false;
  if (input.usernameUnclaimed) return false;
  if (input.alreadyAsked) return false;
  if (input.availableTopics === 0) return false;
  // Not loaded (or not deployed) is not the same as "chose nothing".
  if (input.savedTopics === undefined) return false;
  return input.savedTopics.length === 0;
}

/**
 * Per ACCOUNT, not per browser: a shared laptop must not silence the prompt
 * for the next person to sign in, and the same reader coming back on a second
 * device is not a new user again.
 *
 * Local rather than server-side because the service has no "onboarded" field,
 * and inventing one client-side would be worse: the honest fallback is that a
 * reader who declined is asked once more on a device they have never used.
 */
export function askedKeyFor(userId: string): string {
  return `msq:interests-asked:${userId}`;
}

/**
 * GENDER IS A CHOICE: MALE OR FEMALE.
 *
 * "we dont make them type they choose either male or female … when they type
 * people can type different way of male and female" (ogazboiz). Every place a
 * gender is SET (onboarding, the account menu, Edit profile) and every place
 * people are FILTERED by it (the friends deck, Explore) reads this one list, so
 * the stored value is always one of two lowercase strings and the filters
 * never list five spellings of the same answer.
 *
 * The VALUE is what is saved and sent (`"male"`, `"female"`); the LABEL is what
 * is shown. Onboarding has saved the lowercase value since it shipped.
 */
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number]["value"];

/** The canonical value for anything stored or typed, or null when it is neither. */
export function normalizeGender(value: string | null | undefined): Gender | null {
  const folded = (value ?? "").trim().toLowerCase();
  return GENDER_OPTIONS.find((option) => option.value === folded)?.value ?? null;
}

/** The label to show for a stored value, or null when it is not one of the two. */
export function genderLabel(value: string | null | undefined): string | null {
  const gender = normalizeGender(value);
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? null;
}

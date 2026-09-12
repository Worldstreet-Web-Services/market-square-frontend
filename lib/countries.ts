/**
 * COUNTRIES — the self-declared place's third half (settings stage 3).
 *
 * The service stores an ISO 3166-1 alpha-2 code and refuses anything else; it
 * never works a country out from where somebody is. So the picker is built
 * here from the codes, and the NAMES come from the platform (`Intl.DisplayNames`)
 * rather than a hand-kept table — they read in the reader's language and cannot
 * drift out of date in this repo.
 *
 * What OTHER people see is the owner's call (`locationPrecision`): the service
 * nulls whatever is hidden, and a continent-only profile carries just
 * `continent`. `placeLine` draws whichever halves arrived.
 *
 * Pure (Intl is part of the language), so `node --test` pins it.
 */

export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export const CONTINENT_NAMES: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

/** A country's name in the reader's language, or the code itself when the platform has none. */
export function countryName(code: string, locale = "en"): string {
  const upper = code.trim().toUpperCase();
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(upper);
    return name && name !== upper && name !== "Unknown Region" ? name : upper;
  } catch {
    return upper;
  }
}

/** The picker's options: every code the platform can name, alphabetical by name. */
export function countryOptions(locale = "en"): Array<{ code: string; name: string }> {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) }))
    .filter((option) => option.name !== option.code)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * The place line on a profile: "Ikeja, Lagos, Nigeria" from whichever halves
 * the owner lets this reader see, or the continent alone when that is all they
 * share. Empty when there is nothing to show.
 */
export function placeLine(
  profile: { city?: string | null; region?: string | null; country?: string | null; continent?: string | null },
  locale = "en"
): string {
  const parts = [profile.city, profile.region, profile.country ? countryName(profile.country, locale) : null]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(", ");
  return profile.continent ? (CONTINENT_NAMES[profile.continent] ?? "") : "";
}

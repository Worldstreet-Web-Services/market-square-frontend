/**
 * WHERE THE MARKET SQUARE SERVICE IS, for anything on the server that calls it.
 *
 * The BFF (`app/api/market-square/[...path]`) used to resolve this inline;
 * share previews (`lib/server/og-data.ts`) need the identical answer, so both
 * now read it from here rather than keeping two copies that can drift. Unset
 * means fixture mode: the BFF answers from `lib/fixtures`, and previews stay
 * generic.
 *
 * Dependency-free so `node --test` can import it.
 */
export function marketSquareBase(
  env: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  return env.WSAPI_BASE_URL ? `${env.WSAPI_BASE_URL}/v1/market-square` : null;
}

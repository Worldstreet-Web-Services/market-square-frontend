/**
 * Where a gist room lives.
 *
 * In shared `lib/` rather than inside `features/houses` because two slices now
 * need it: the houses street navigates to a room, and a MESSAGE announcing a
 * new room has to link to one. Slices never import each other, and the
 * alternative — writing `/gist-rooms/${id}` out a second time — is a route
 * that silently rots in one place when it moves.
 *
 * It is deliberately NOT part of `resolveDeepLink`. That maps a `stream` link
 * to `/live/<id>`, which is correct for a broadcast and wrong for an audio
 * room; the link alone cannot say which, because a house IS a stream with
 * `category: "house"`. The caller knows, so the caller chooses.
 */
import { sq } from "./square-path.ts";

export function housePath(houseId: string): string {
  // Under /square (lib/square-path). Callers render this as an href directly.
  return sq(`/gist-rooms/${houseId}`);
}

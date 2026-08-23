import "server-only";

import type { NextRequest } from "next/server";
import { getPrivyClient } from "@/lib/server/privy";

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

function extractAccessToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return req.cookies.get("privy-token")?.value ?? null;
}

// Verifies the caller's Privy access token. Returns null when the request
// carries no token or the token fails verification.
export async function verifyRequest(req: NextRequest): Promise<AccessClaims | null> {
  const token = extractAccessToken(req);
  if (!token) return null;
  try {
    const claims = await getPrivyClient().utils().auth().verifyAccessToken(token);
    return { userId: claims.user_id, sessionId: claims.session_id };
  } catch {
    return null;
  }
}

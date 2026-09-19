import { getAccessToken } from "@privy-io/react-auth";
import { MARKET_FLAGS } from "@/lib/market-config";
import { createGateway, type Gateway } from "@/lib/ws-gateway";

/**
 * THE PAGE'S ONE SOCKET.
 *
 * Every realtime listener — the feed's lane signal, the room session's speaker
 * signals — subscribes through this, so a page holds one connection with its
 * topics multiplexed, never one per feature. Built lazily on first use; with
 * no gateway configured (or no WebSocket, on the server) it is the client that
 * never opens anything.
 *
 * AUTHENTICATED WHEN THE READER IS SIGNED IN. The speaker signals ride
 * `user:<did>`, which ws-gateway refuses on an anonymous socket
 * ("authentication required for personal topics"). So the client is handed
 * Privy's access token, which it sends INSIDE the open socket as the gateway's
 * `authenticate` frame — never on the upgrade URL, where every proxy and
 * access log in between would keep a copy (lib/ws-gateway.ts).
 * Signed out, `getAccessToken` answers null and the socket stays anonymous,
 * which every public topic is happy with.
 */
let gateway: Gateway | null = null;

export function sharedGateway(): Gateway {
  if (!gateway) {
    const url = MARKET_FLAGS.wsGatewayUrl;
    gateway = createGateway(typeof WebSocket === "undefined" ? "" : url, (address) => new WebSocket(address), {
      getToken: () => getAccessToken(),
    });
  }
  return gateway;
}

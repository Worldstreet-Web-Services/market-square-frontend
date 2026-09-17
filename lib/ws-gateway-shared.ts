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
 */
let gateway: Gateway | null = null;

export function sharedGateway(): Gateway {
  if (!gateway) {
    const url = MARKET_FLAGS.wsGatewayUrl;
    gateway = createGateway(typeof WebSocket === "undefined" ? "" : url, (address) => new WebSocket(address));
  }
  return gateway;
}

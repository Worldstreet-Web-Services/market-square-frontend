import type { Metadata } from "next";
import { HouseRoomScreen } from "@/components/layout/house-room-screen";
import { roomMetadataFor, siteOrigin } from "@/lib/og-metadata";
import { loadOgRoom, sharePreviewsOn } from "@/lib/server/og-data";

type Props = { params: Promise<{ id: string }> };

/**
 * THE ROOM'S OWN SHARE CARD.
 *
 * This page had `metadata = { title: "Gist room" }` and nothing else, so every
 * room link shared anywhere unfurled as the app's GENERIC preview: the word
 * "Square", the site description, and the house share-card. No room name, no
 * start time, no host — the same picture for every room on the platform
 * (ogazboiz, 2026-09-24, after sharing one to Telegram: "i did not see the
 * card and there is no caption ... i cant even see the card itself").
 *
 * WHY THIS IS THE REAL FIX AND THE FILE SHARE IS NOT. WhatsApp, Telegram, X
 * and Facebook are reached by a web INTENT — a URL carrying text — and an
 * intent cannot attach a file. So a "share to Telegram" row can only ever send
 * a link. What every one of those platforms DOES do is fetch the link and
 * render its `og:image`, so pointing that at `/api/room-card` makes sharing
 * the LINK and sharing the CARD the same act, on every platform, with no
 * chooser and no download.
 *
 * NOT A 404 FOR A ROOM THAT DOES NOT EXIST, unlike a post: a gist room id is
 * not guessable and the screen already has a real closed state, so a crawler
 * missing it is not worth turning a working page into a 404 for. Only the
 * service saying `not-found` does that — which is what makes a platform drop a
 * cached card for a room that was removed.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = sharePreviewsOn() ? await loadOgRoom(id) : null;
  const metadata = roomMetadataFor(result, id, siteOrigin(process.env));
  // A room the service says is gone gets the generic card rather than a hard
  // 404: the page itself still renders "this house has closed", which is a
  // better answer to somebody holding an old link than a dead end.
  return metadata === "not-found" ? { title: "Gist room" } : metadata;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <HouseRoomScreen houseId={id} />;
}

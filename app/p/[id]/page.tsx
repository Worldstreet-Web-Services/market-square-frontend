import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostScreen } from "@/components/layout/home-screen";
import { resolvePostParam } from "@/lib/short-id";
import { postMetadataFor } from "@/lib/og-metadata";
import { loadOgPost, sharePreviewsOn } from "@/lib/server/og-data";
import { marketSquareBase } from "@/lib/server/upstream-base";

/*
  NEVER CACHED AS ONE RESPONSE. A preview crawler gets this page's tags
  rendered into <head>; a browser gets them streamed after the first bytes. The
  same URL therefore renders differently by user agent, and a cached copy of
  either would be served to the other — so the route stays dynamic. The post
  read behind the metadata is not cached either (see `lib/server/og-fetch.ts`):
  a cached read would keep a removed post's card alive.
*/
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Fixture mode (no service configured) demos from `lib/fixtures`, whose post
// ids are not UUIDs. See `ResolvePostParamOptions`.
const FIXTURE_MODE = marketSquareBase() === null;

/*
  THE PARAM IS HOSTILE. Next decodes it before we see it, so `%2E%2E` arrives
  as `..` and a backslash id would normalise into another service's path. It is
  resolved against an allowlist — a UUID, or the canonical 22-character short id
  — and anything else is a 404 before any request is built. It is never decoded
  a second time.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = resolvePostParam(id, { fixtureIds: FIXTURE_MODE });
  if (!post) notFound();
  const metadata = postMetadataFor(sharePreviewsOn() ? await loadOgPost(post.uuid) : null, post.shortId);
  // Only an upstream 404 lands here. A crawler that re-scrapes a removed post
  // gets a real 404, which is what makes it drop the cached card.
  if (metadata === "not-found") notFound();
  return metadata;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const post = resolvePostParam(id, { fixtureIds: FIXTURE_MODE });
  if (!post) notFound();
  // The screen and every API call it makes receive the UUID, whichever
  // spelling the link used.
  return <PostScreen postId={post.uuid} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/components/layout/profile-screen";
import { genericProfileMetadata, isProfileUsername, profileMetadataFor } from "@/lib/og-metadata";
import { loadOgProfile, sharePreviewsOn } from "@/lib/server/og-data";

/* Dynamic for the same reason as `/p/[id]`: bots and browsers get metadata
   rendered differently, so no single cached response is right for both. */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

/*
  Only a handle that matches the service's own rule is ever fetched. A profile
  opened by its id (`/u/did:privy:…`, which still resolves) or by anything else
  gets the generic card — no request, and no id printed as a name.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (!isProfileUsername(username)) return genericProfileMetadata(null);
  const metadata = profileMetadataFor(sharePreviewsOn() ? await loadOgProfile(username) : null, username);
  if (metadata === "not-found") notFound();
  return metadata;
}

export default async function Page({ params }: Props) {
  const { username } = await params;
  return <ProfileScreen username={username} />;
}

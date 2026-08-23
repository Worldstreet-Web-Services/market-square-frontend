"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe } from "@/hooks/use-me";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useGoLive, useStream } from "@/features/streams/hooks/use-streams";
import { GreenRoom } from "@/features/streams/components/green-room";
import { LiveCockpit } from "@/features/streams/components/live-cockpit";
import { PostLive } from "@/features/streams/components/post-live";
import type { Ingest } from "@/features/streams/lib/types";

// /studio/[id]: the per-stream state machine — green-room | live-cockpit |
// post-live by stream status. Deep-linkable: landing on a live stream offers
// the idempotent go-live rejoin to mint fresh ingest credentials.
export function StudioStreamScreen({ streamId }: { streamId: string }) {
  const me = useMe();
  // The cockpit needs a 5 s viewer/status poll; other states are calmer.
  const stream = useStream(streamId, true);
  const cockpitStream = useStream(streamId, stream.data?.status === "live" ? 5000 : false);
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [devices, setDevices] = useState<{ cameraId: string; micId: string } | null>(null);
  const rejoin = useGoLive();

  if (stream.isPending || me.isPending) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-grey-600" />
      </div>
    );
  }
  if (stream.isError) {
    return (
      <div className="px-4 py-8">
        <ErrorState error={stream.error} fallback="Couldn't load this stream." onRetry={() => stream.refetch()} />
      </div>
    );
  }

  const data = cockpitStream.data ?? stream.data;

  if (me.data && data.ownerId !== me.data.id) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          glyph="◈"
          title="Not your stream"
          body="Only the host can open this studio room."
          action={
            <Link href={`/live/${data.id}`} className="text-sm font-semibold text-accent hover:underline">
              Watch it instead →
            </Link>
          }
        />
      </div>
    );
  }

  if (data.status === "scheduled") {
    return (
      <GreenRoom
        stream={data}
        onWentLive={(freshIngest, chosenDevices) => {
          setIngest(freshIngest);
          setDevices(chosenDevices);
        }}
      />
    );
  }

  if (data.status === "live") {
    return (
      <LiveCockpit
        stream={data}
        ingest={ingest}
        devices={devices}
        rejoining={rejoin.isPending}
        onRejoin={() =>
          rejoin.mutate(streamId, {
            onSuccess: (result) => setIngest(result.ingest),
          })
        }
      />
    );
  }

  return <PostLive stream={data} />;
}

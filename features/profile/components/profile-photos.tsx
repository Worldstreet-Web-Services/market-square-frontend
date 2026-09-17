"use client";

import { useRef, useState } from "react";
import { IconX } from "@/components/ui/icons";
import { ImageViewer } from "@/components/ui/image-viewer";
import { acceptFor } from "@/lib/upload-rules";
import {
  useAddProfilePhoto,
  useProfilePhotos,
  useRemoveProfilePhoto,
} from "@/features/profile/hooks/use-profile";
import { asset } from "@/lib/square-path";

/** The service's own cap (`POST /me/photos` answers 409 past it). */
const MAX_PHOTOS = 12;

/**
 * PHOTOS — node 1021:20930 (live file, 2026-09-11).
 *
 * "Photos" at 12/16 bold in `#F4F4F4`, 16 above a row of 160x160 tiles at a 20
 * radius, 16 apart. On your own profile the row ends in the "Upload more" tile:
 * a 48 disc at 10% white with a 0 4 25 `#6B6B6B`/25% glow, a 24 disc inside it
 * at 10% carrying the file's `gallery-add` glyph at 12, and the label 8 under
 * it at Geist 12/16.5 in 50% white.
 *
 * The file draws four tiles across a 741 column; ours is narrower, so the row
 * scrolls sideways like the Houses rail beside it.
 *
 * A SEPARATE GALLERY, not a view of posts (ogazboiz's call): the backend's
 * `/profiles/:username/photos` and `/me/photos`. ABSENT while that route is not
 * deployed, and absent on somebody else's profile when they have no photos —
 * an empty row there is a hole, while yours is a place to start.
 */
export function ProfilePhotos({ username, isMe }: { username: string; isMe: boolean }) {
  const photos = useProfilePhotos(username);
  const add = useAddProfilePhoto(username);
  const remove = useRemoveProfilePhoto(username);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);


  if (photos.unavailable || !photos.data) return null;
  const items = photos.data.items;
  if (!isMe && items.length === 0) return null;
  const canAdd = isMe && items.length < MAX_PHOTOS;

  return (
    <section aria-label="Photos" className="flex flex-col gap-4">
      <h2 className="text-[12px] font-bold leading-4 text-grey-100">Photos</h2>
      <div className="flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((photo) => (
          <div key={photo.id} className="group relative h-40 w-40 shrink-0 overflow-hidden rounded-[20px] bg-white">
            <button
              type="button"
              onClick={() => setOpen(photo.url)}
              aria-label="Open photo"
              className="block h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- service-issued media URL */}
              <img src={photo.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            </button>
            {isMe && (
              <button
                type="button"
                onClick={() => remove.mutate(photo.id)}
                disabled={remove.isPending}
                aria-label="Remove photo"
                className="ws-press absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm focus-visible:flex group-hover:flex"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={add.isPending}
            className="ws-press flex h-40 w-40 shrink-0 items-center justify-center rounded-[20px] disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-[0_4px_25px_0_rgba(107,107,107,0.25)]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the node's own glyph */}
                  <img src={asset("/profile/gallery-add.svg")} alt="" aria-hidden className="h-3 w-3" />
                </span>
              </span>
              <span className="text-[12px] font-normal leading-[16.5px] text-white/50">
                {add.isPending ? "Uploading…" : "Upload more"}
              </span>
            </span>
          </button>
        )}
        {isMe && (
          <input
            ref={input}
            type="file"
            accept={acceptFor("image")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) add.mutate(file);
            }}
          />
        )}
      </div>

      {open && <ImageViewer src={open} alt="Photo" onClose={() => setOpen(null)} />}
    </section>
  );
}

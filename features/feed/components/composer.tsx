"use client";

import { useEffect, useRef, useState } from "react";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { DeepLink } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconLink, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/envelope";
import { uploadFile, validateUpload } from "@/lib/api/upload";
import { useCreatePost } from "@/features/feed/hooks/use-feed";

const MAX = 2000;

const LINK_KINDS = [
  { kind: "stream", label: "Stream", hint: "stream id" },
  { kind: "store_item", label: "Store item", hint: "item slug" },
  { kind: "external", label: "External", hint: "https://…" },
];

export function Composer() {
  const me = useMe();
  const gate = useGate();
  const create = useCreatePost();
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [linkKind, setLinkKind] = useState<string | null>(null);
  const [linkRef, setLinkRef] = useState("");
  const [kind, setKind] = useState<"update" | "story">("update");

  const deepLink: DeepLink | undefined =
    linkKind && linkRef.trim() ? { kind: linkKind, ref: linkRef.trim() } : undefined;

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const attach = (file: File) => {
    setMediaError(null);
    const invalid = validateUpload(file, "media");
    if (invalid) {
      setMediaError(invalid);
      return;
    }
    setMediaFile(file);
    setMediaIsVideo(file.type.startsWith("video/"));
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaIsVideo(false);
    setMediaError(null);
  };

  const reset = () => {
    setText("");
    clearMedia();
    setLinkKind(null);
    setLinkRef("");
  };

  // Media uploads on submit: one progress bar, then the post carries the
  // returned URL.
  const submit = () => {
    const body = text.trim();
    if (!body || uploadProgress !== null) return;
    gate(() => {
      void (async () => {
        let mediaUrl: string | undefined;
        if (mediaFile) {
          setUploadProgress(0);
          try {
            const result = await uploadFile(mediaFile, setUploadProgress);
            mediaUrl = result.url;
          } catch (error) {
            setMediaError(errorMessage(error, "Upload failed."));
            return;
          } finally {
            setUploadProgress(null);
          }
        }
        create.mutate({ kind, text: body, mediaUrl, deepLink }, { onSuccess: reset });
      })();
    });
  };

  return (
    <div className="ws-card p-4">
      <div className="flex gap-3">
        <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="What's happening on the square?"
            rows={text ? 3 : 2}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
          />
          {mediaPreview && (
            <div className="relative mb-2 inline-block max-w-full">
              {mediaIsVideo ? (
                <video src={mediaPreview} muted playsInline className="ws-inset max-h-56 rounded-2xl" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={mediaPreview} alt="Attached media" className="ws-inset max-h-56 rounded-2xl object-cover" />
              )}
              <button
                onClick={clearMedia}
                aria-label="Remove media"
                className="ws-glass absolute right-2 top-2 rounded-full p-1.5 text-white"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              {uploadProgress !== null && (
                <span className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-2xl bg-white/15">
                  <span
                    className="block h-full bg-accent transition-[width]"
                    style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                  />
                </span>
              )}
            </div>
          )}
          {mediaError && <p className="mb-2 text-xs text-down">{mediaError}</p>}
          {linkKind && (
            <div className="ws-inset mb-2 flex items-center gap-2 px-3 py-2">
              <IconLink className="h-3.5 w-3.5 shrink-0 text-grey-500" />
              <input
                value={linkRef}
                onChange={(e) => setLinkRef(e.target.value)}
                placeholder={LINK_KINDS.find((k) => k.kind === linkKind)?.hint}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              <button onClick={() => { setLinkKind(null); setLinkRef(""); }} aria-label="Remove link">
                <IconX className="h-3.5 w-3.5 text-grey-500" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                mediaFile ? "bg-white/10 text-white" : "text-grey-400 hover:text-white"
              )}
            >
              {mediaFile ? "Change media" : "Media"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) attach(file);
              }}
            />
            {LINK_KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => setLinkKind(linkKind === k.kind ? null : k.kind)}
                className={cn(
                  "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                  linkKind === k.kind ? "bg-white/10 text-white" : "text-grey-400 hover:text-white"
                )}
              >
                {k.label}
              </button>
            ))}
            <button
              onClick={() => setKind(kind === "story" ? "update" : "story")}
              className={cn(
                "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                kind === "story" ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
              )}
              title="Stories expire after 24 hours"
            >
              Story
            </button>
            <div className="ml-auto flex items-center gap-3">
              {text.length > MAX - 200 && (
                <span className="tnum text-[11px] text-grey-500">{MAX - text.length}</span>
              )}
              <Button
                size="sm"
                onClick={submit}
                disabled={!text.trim()}
                loading={create.isPending || uploadProgress !== null}
              >
                {uploadProgress !== null ? `Uploading ${Math.round(uploadProgress * 100)}%` : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/button";
import {
  acceptFor,
  ensureUploadLimits,
  formatBytes,
  getUploadLimits,
  uploadFile,
  validateUpload,
  type UploadResult,
} from "@/lib/api/upload";

/**
 * The composer's attachment picker — node 77:8266.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A flat 420-wide card at `#1F1F1F` and a 16px radius, 16px padding, 12px gap;
 * a 263-tall dropzone at `white/4` behind a 1px `white/10` dash (6,6) at a 14px
 * radius; a 56px `white/4` icon tile at 16px radius holding the 40px
 * cloud-upload; 16px SemiBold over 13px Regular at 60% white; and a 36px
 * `Browse files` pill at `white/4` inside a `white/10` hairline. All verbatim.
 *
 * It is a `bare` Sheet rather than its own overlay, so the portal, backdrop,
 * Escape and scroll lock are the house dialog's — only the surface is this
 * node's.
 *
 * ─── THE ONE THING NOT TAKEN FROM THE FILE ───────────────────────────────────
 * The header caption reads, in the design, "JPEG, PNG, MP4, MOV, AVI, PDF,
 * DOC • 500 MB". Shipping that string would state four formats the service
 * rejects (MOV, AVI, PDF, DOC are not in any allowlist) and a cap eight times
 * the real one — so every one of those would be an upload the user starts and
 * we refuse, with our own panel having told them it was fine.
 *
 * It would also break the rule this repo already runs on: upload limits are
 * FETCHED, never hard-coded, because two owners of one contract is how a
 * composer ends up refusing a photo the service would have stored. So the
 * caption is DERIVED from `GET /uploads/limits` — the same numbers that
 * validate the file a moment later. When the service's allowlist grows to
 * include documents, this line grows with it and no one has to remember.
 *
 * The body copy loses "document" for the same reason.
 */

/** "JPEG, PNG, WebP, GIF, MP4, WebM • up to 200 MB" — from the live contract. */
function describeLimits(): string {
  const limits = getUploadLimits();
  const label = (type: string) => {
    const subtype = type.split("/")[1] ?? type;
    return subtype === "jpeg" ? "JPEG" : subtype.toUpperCase();
  };
  const formats = [
    ...limits.imageContentTypes,
    ...limits.videoContentTypes,
    ...limits.audioContentTypes,
  ]
    .map(label)
    // MP4 is both a video and an audio container, so the two lists overlap.
    .filter((name, index, all) => all.indexOf(name) === index);
  const largest = Math.max(limits.maxImageBytes, limits.maxVideoBytes, limits.maxAudioBytes);
  return `${formats.join(", ")} • up to ${formatBytes(largest)}`;
}

export interface AttachmentPanelProps {
  open: boolean;
  onClose: () => void;
  /** Handed the stored URL and whatever the client could measure about it. */
  onAttached: (result: UploadResult, measured: Measured) => void;
}

export interface Measured {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

/**
 * Reads a file's intrinsic size the only way a browser can: by decoding it.
 *
 * Best-effort throughout — a measurement we cannot take is sent as absent, not
 * as zero, and never blocks the upload. The service treats a missing dimension
 * as "not measured" and the bubble simply contains the media instead of
 * reserving its exact box.
 */
async function measure(file: File): Promise<Measured> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      return await new Promise<Measured>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({});
        image.src = url;
      });
    }
    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      return await new Promise<Measured>((resolve) => {
        const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
        media.preload = "metadata";
        media.onloadedmetadata = () => {
          const duration = Number.isFinite(media.duration) ? media.duration : undefined;
          const element = media as HTMLVideoElement;
          resolve({
            ...(duration ? { durationSeconds: duration } : {}),
            ...(element.videoWidth
              ? { width: element.videoWidth, height: element.videoHeight }
              : {}),
          });
        };
        media.onerror = () => resolve({});
        media.src = url;
      });
    }
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AttachmentPanel({ open, onClose, onAttached }: AttachmentPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Re-render once the fetched contract lands, so the caption and the picker's
  // accept filter show the REAL allowlist rather than the compiled fallback.
  const [, setContractRead] = useState(0);

  // No state reset here, because there is none to do: the composer mounts this
  // panel only while it is open, so every opening starts from fresh state. An
  // always-mounted panel would keep the last rejection's message and show it
  // again the next time the paperclip was pressed.
  useEffect(() => {
    void ensureUploadLimits().then(() => setContractRead((n) => n + 1));
  }, []);

  const take = async (file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    // The contract before the check, so we validate against the server's
    // numbers rather than the fallback on the very first attachment.
    await ensureUploadLimits();
    const problem = validateUpload(file, "attachment");
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const measured = await measure(file);
      // "attachment", not the default "media": this is the one picker that
      // takes AUDIO, and the default would refuse a voice note at the last
      // gate — after the panel had already accepted it.
      const result = await uploadFile(file, setProgress, "attachment");
      onAttached(result, measured);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That upload didn't finish.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      bare
      panelClassName="bg-[#1F1F1F] sm:max-w-[420px] sm:rounded-2xl"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-white">Attachment</h2>
          <p className="text-right text-[12px] font-medium text-white/50">{describeLimits()}</p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void take(event.dataTransfer.files?.[0]);
          }}
          className={`flex h-[263px] flex-col items-center justify-center rounded-[14px] border border-dashed transition-colors ${
            dragging ? "border-white/30 bg-white/[0.07]" : "border-white/10 bg-white/[0.04]"
          }`}
        >
          {busy ? (
            // The upload's own state, in the dropzone's place — a panel that
            // kept offering "Browse files" mid-transfer invites a second pick
            // that would cancel the first.
            <div className="flex flex-col items-center gap-4 px-6 text-center">
              <Spinner className="h-8 w-8 text-white" />
              <p className="text-[13px] text-white/60">
                Uploading… {Math.round(progress * 100)}%
              </p>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/70 transition-[width]"
                  style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 px-4">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                  {/* The file's `cloud-upload` at its 40px box. Drawn inline:
                      Figma's image endpoint was unreachable when this was
                      built, and a placeholder would have shipped as a blank. */}
                  <svg
                    aria-hidden
                    viewBox="0 0 40 40"
                    className="h-10 w-10 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11.7 30c-3.7 0-6.7-2.9-6.7-6.5 0-3.3 2.5-6 5.8-6.4a9.2 9.2 0 0 1 17.9-1.4 6.9 6.9 0 0 1 6.3 6.8c0 3.6-3 6.5-6.7 6.5" />
                    <path d="M20 20v14M15 25l5-5 5 5" />
                  </svg>
                </div>
                <div className="flex flex-col gap-3 text-center">
                  <p className="text-[16px] font-semibold text-white">Upload your file</p>
                  {/* The file says "(image, video, document)" — documents are
                      not in any allowlist, so naming them here would promise
                      an upload we refuse. */}
                  <p className="text-[13px] leading-snug text-white/60">
                    Drag and drop your files (image, video, voice note) here, or
                    <br />
                    click to browse.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => input.current?.click()}
                className="ws-press flex h-9 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
              >
                Browse files
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 10.5v-9M4.5 5 8 1.5 11.5 5M2 11v2.5h12V11" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {error && (
          // `alert`, so the rejection is announced rather than only drawn — a
          // picker that silently does nothing reads as a broken button.
          <p role="alert" className="text-[12px] text-down">
            {error}
          </p>
        )}

        <input
          ref={input}
          type="file"
          accept={acceptFor("attachment")}
          className="hidden"
          onChange={(event) => {
            void take(event.target.files?.[0]);
            // Cleared so picking the SAME file twice still fires a change.
            event.target.value = "";
          }}
        />
      </div>
    </Sheet>
  );
}

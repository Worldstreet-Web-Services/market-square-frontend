"use client";

import { z } from "zod";
import { getAccessToken } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { apiError } from "@/lib/api/envelope";

export const UploadResultSchema = z.object({
  url: z.string(),
  kind: z.enum(["image", "video"]).catch("image"),
  contentType: z.string().optional().default(""),
  bytes: z.number().optional().default(0),
});

export type UploadResult = z.infer<typeof UploadResultSchema>;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// Client-side pre-check mirroring the backend rules, so most rejections never
// cost an upload. Returns a human message or null when acceptable.
export function validateUpload(file: File, accept: "image" | "media"): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (accept === "image" && !isImage) return "Use a JPEG, PNG, WebP or GIF image.";
  if (accept === "media" && !isImage && !isVideo)
    return "Use an image (JPEG, PNG, WebP, GIF) or video (MP4, WebM).";
  if (isImage && file.size > MAX_IMAGE_BYTES) return "Images can be up to 10 MB.";
  if (isVideo && file.size > MAX_VIDEO_BYTES) return "Videos can be up to 100 MB.";
  return null;
}

// XHR rather than fetch: upload progress events. Multipart field name `file`
// per the backend contract; the standard envelope comes back either way.
export function uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const token = DEMO_AUTH ? null : await getAccessToken().catch(() => null);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/market-square/uploads");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
      };
      xhr.onerror = () => reject(apiError("SERVICE_UNAVAILABLE", "Upload failed — check your connection.", 0));
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText) as {
            success?: boolean;
            data?: unknown;
            error?: { code?: string; message?: string };
          };
          if (xhr.status >= 200 && xhr.status < 300 && body.success === true) {
            resolve(UploadResultSchema.parse(body.data));
            return;
          }
          reject(
            apiError(
              body.error?.code ?? "BAD_RESPONSE",
              body.error?.message ?? "Upload failed.",
              xhr.status
            )
          );
        } catch {
          reject(apiError("BAD_RESPONSE", "Upload failed.", xhr.status));
        }
      };
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    })();
  });
}

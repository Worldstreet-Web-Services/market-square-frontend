"use client";

import { z } from "zod";
import { getAuthToken } from "@/lib/auth-token";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { apiError, errorCode } from "@/lib/api/envelope";
import {
  PROXY_MAX_BYTES,
  UploadResultSchema,
  formatBytes,
  shouldUploadDirect,
  uploadKind,
  validateUpload,
  type UploadAccept,
  type UploadResult,
} from "@/lib/upload-rules";
import { ensureUploadLimits } from "@/lib/upload-limits";

/**
 * Warm the limits as soon as anything upload-related is loaded, so the first
 * file pick does not wait on a network round trip to validate. Browser only —
 * during SSR there is no user to validate for, and firing a same-origin fetch
 * at our own BFF from the render server would be a request to nowhere useful.
 * It is memoised and failure-tolerant, so this costs at most one small GET.
 */
if (typeof window !== "undefined") void ensureUploadLimits();

// `UploadResultSchema` and `UploadResult` now live in lib/upload-rules.ts so
// they are testable without this module's client-only dependencies. Re-exported
// below so every existing import site is unchanged.

// The pure rules live in lib/upload-rules.ts so they can be unit-tested
// without this module's client-only dependencies. Re-exported so existing
// call sites keep one import.
export {
  ACCEPT_ATTACHMENT,
  ACCEPT_IMAGE,
  ACCEPT_MEDIA,
  AUDIO_TYPES,
  IMAGE_TYPES,
  VIDEO_TYPES,
  // The caps are no longer constants: the backend owns them and publishes them
  // on GET /uploads/limits. `FALLBACK_LIMITS` is only what we use when that
  // call fails; read `getUploadLimits()` for the live values.
  FALLBACK_LIMITS,
  PROXY_MAX_BYTES,
  acceptFor,
  formatBytes,
  formatDuration,
  getUploadLimits,
  uploadKind,
  validateUpload,
  validateVideoDuration,
} from "@/lib/upload-rules";
export { readVideoDuration } from "@/lib/video-duration";
export type { UploadLimits, UploadAccept, UploadResult } from "@/lib/upload-rules";
export { UploadResultSchema };
export { ensureUploadLimits } from "@/lib/upload-limits";

// ---------------------------------------------------------------- presign

// POST /uploads/presign → where to put the bytes. `fields` is set for POST
// form uploads (S3 policy style); `headers` for a plain PUT.
const PresignSchema = z.object({
  uploadUrl: z.string(),
  method: z.enum(["PUT", "POST"]).catch("PUT"),
  headers: z.record(z.string(), z.string()).nullable().optional().default(null),
  fields: z.record(z.string(), z.string()).nullable().optional().default(null),
  key: z.string(),
  publicUrl: z.string().optional().default(""),
  expiresAt: z.string().optional().default(""),
});

type Presign = z.infer<typeof PresignSchema>;

async function authHeader(): Promise<Record<string, string>> {
  if (DEMO_AUTH) return {};
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function callApi<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`/api/market-square${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let envelope: { success?: boolean; data?: unknown; error?: { code?: string; message?: string } } | null =
    null;
  try {
    envelope = JSON.parse(text);
  } catch {
    envelope = null;
  }
  if (response.ok && envelope?.success === true) return schema.parse(envelope.data);
  throw apiError(
    envelope?.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "BAD_RESPONSE"),
    envelope?.error?.message ?? "Upload failed.",
    response.status
  );
}

/**
 * PUT/POST the bytes straight at storage.
 *
 * This request does NOT go through our BFF, so its failures are a different
 * species from API failures and must not be reported as "Internal server
 * error". The three that actually happen:
 *
 *   - status 0: the browser blocked or dropped it. In practice that is a CORS
 *     rejection on the storage bucket or the connection dying mid-transfer;
 *     the browser deliberately hides which, so the message covers both.
 *   - 403/401: the presign expired or was signed for different terms. The
 *     caller re-presigns and retries once.
 *   - any other 4xx/5xx: storage refused it outright.
 */
function putToStorage(
  presign: Presign,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(presign.method, presign.uploadUrl);
    if (presign.method === "PUT") {
      xhr.setRequestHeader("Content-Type", file.type);
      for (const [key, value] of Object.entries(presign.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () =>
      reject(
        apiError(
          "UPLOAD_BLOCKED",
          "The upload was blocked before it finished — check your connection and try again.",
          0
        )
      );
    xhr.ontimeout = () =>
      reject(apiError("UPLOAD_BLOCKED", "The upload timed out — try again.", 0));
    xhr.onabort = () => reject(apiError("UPLOAD_BLOCKED", "The upload was cancelled.", 0));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      if (xhr.status === 401 || xhr.status === 403) {
        reject(apiError("PRESIGN_EXPIRED", "The upload link expired.", xhr.status));
        return;
      }
      reject(
        apiError("STORAGE_REJECTED", "Storage refused the file — try again.", xhr.status)
      );
    };
    if (presign.method === "POST") {
      // S3-style POST policy: every signed field first, the file LAST.
      const form = new FormData();
      for (const [key, value] of Object.entries(presign.fields ?? {})) form.append(key, value);
      form.append("file", file);
      xhr.send(form);
    } else {
      xhr.send(file);
    }
  });
}

/** Bytes → storage directly, then ask the service to verify and publish it. */
async function uploadDirect(
  file: File,
  onProgress?: (fraction: number) => void,
  /** Fired once the bytes have landed in storage — after that, no path may re-send them. */
  onBytesSent?: () => void
): Promise<UploadResult> {
  const request = {
    contentType: file.type,
    sizeBytes: file.size,
    kind: uploadKind(file),
  };

  let presign = await callApi("/uploads/presign", request, PresignSchema);
  try {
    await putToStorage(presign, file, onProgress);
  } catch (error) {
    // An expired link is worth exactly one more attempt: the user has already
    // waited through the transfer once, and re-presigning is cheap.
    if (errorCode(error) !== "PRESIGN_EXPIRED") throw error;
    presign = await callApi("/uploads/presign", request, PresignSchema);
    onProgress?.(0);
    await putToStorage(presign, file, onProgress);
  }
  onBytesSent?.();

  // The object is not usable until the service has seen it — never trust the
  // client's word that the bytes landed.
  return callApi("/uploads/complete", { key: presign.key }, UploadResultSchema);
}

// ------------------------------------------------------------ proxied path

/** Small files still go through the BFF: one request, and it works offline. */
function uploadProxied(file: File, onProgress?: (fraction: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/market-square/uploads");
      for (const [key, value] of Object.entries(await authHeader())) {
        xhr.setRequestHeader(key, value);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
      };
      xhr.onerror = () =>
        reject(apiError("SERVICE_UNAVAILABLE", "Upload failed — check your connection.", 0));
      xhr.onload = () => {
        // 413 is the platform rejecting the body before our code ran.
        if (xhr.status === 413) {
          reject(
            apiError(
              "PAYLOAD_TOO_LARGE",
              `This file is ${formatBytes(file.size)}, which is over the ${formatBytes(PROXY_MAX_BYTES)} limit for this upload route.`,
              413
            )
          );
          return;
        }
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

/**
 * Upload a file and get back its published URL.
 *
 * The route is chosen by SIZE, not by type: the constraint is the 4.5 MB
 * serverless body limit, which does not care whether the bytes are a GIF or a
 * clip. Small files take the proxy (one hop, works offline); large ones go
 * direct to storage via a presigned URL.
 *
 * Validation runs first so an oversized or unsupported file costs no round
 * trip at all.
 */
export async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
  // Defaults to `media` (image + video) because that is what posts, avatars
  // and covers take. A CHAT attachment must pass "attachment" — audio is a
  // message but never a post, so widening the default would quietly let a
  // voice note be uploaded as somebody's avatar.
  accept: UploadAccept = "media"
): Promise<UploadResult> {
  // Belt and braces: call sites validate at PICK time (that is where the user
  // gets an instant error), but this is the only door every upload goes
  // through, so the limits are refreshed and the check repeated here too.
  await ensureUploadLimits();
  const invalid = validateUpload(file, accept);
  if (invalid) throw apiError("VALIDATION", invalid, 422);

  if (!shouldUploadDirect(file)) return uploadProxied(file, onProgress);

  // ONE UPLOAD PER FILE. The proxy is a fallback for a service with no presign
  // route, and that can only be known BEFORE the bytes move: once they have
  // landed in storage, a NOT_FOUND from `/uploads/complete` must surface as
  // the error it is rather than send the same file a second time through the
  // proxy — which would store it twice and bill it twice.
  let bytesSent = false;
  try {
    return await uploadDirect(file, onProgress, () => {
      bytesSent = true;
    });
  } catch (error) {
    // Presign has not shipped everywhere yet, and fixture mode has no storage
    // at all. Where it is absent, fall back to the proxy — which genuinely
    // works for any size locally, and tells the truth when the platform limit
    // bites in production.
    if (bytesSent || errorCode(error) !== "NOT_FOUND") throw error;
    return uploadProxied(file, onProgress);
  }
}

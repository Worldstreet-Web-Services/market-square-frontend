"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/envelope";
import { uploadFile, validateUpload } from "@/lib/api/upload";
import { IconCamera, IconX } from "@/components/ui/icons";

// Image upload field for avatars and covers: pick → local preview → eager
// upload with progress → onChange(url). Circular mode center-crops the
// preview (object-cover on a round frame).
export function UploadField({
  value,
  onChange,
  circular = false,
  label,
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  circular?: boolean;
  label: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = async (file: File) => {
    setError(null);
    const invalid = validateUpload(file, "image");
    if (invalid) {
      setError(invalid);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setProgress(0);
    try {
      const result = await uploadFile(file, setProgress);
      onChange(result.url);
    } catch (uploadError) {
      setError(errorMessage(uploadError, "Upload failed."));
      setPreview(null);
      onChange(value);
    } finally {
      setProgress(null);
    }
  };

  const shown = preview ?? value;

  return (
    <div className={className}>
      <span className="mb-1.5 block text-xs font-semibold text-grey-400">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`Upload ${label}`}
          className={cn(
            "ws-press relative flex items-center justify-center overflow-hidden border border-white/15 bg-black/40 text-grey-500 transition-colors hover:border-white/30",
            circular ? "h-20 w-20 rounded-full" : "h-24 w-40 rounded-xl"
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- freshly uploaded/object URLs
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconCamera className="h-6 w-6" />
          )}
          {progress !== null && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
              <span
                className="block h-full bg-accent transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </button>
        {shown && progress === null && (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            aria-label={`Remove ${label}`}
            className="rounded-full p-1.5 text-grey-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
        {progress !== null && (
          <span className="tnum text-xs text-grey-500">{Math.round(progress * 100)}%</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-down">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { DeepLink } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { IconClock, IconImage, IconLink, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useCreatePost, useMentionSearch, useUploadPostMedia } from "@/features/feed/hooks/use-feed";
import type { Mention, Post } from "@/features/feed/lib/types";

const MAX = 2000;

const LINK_KINDS = [
  { kind: "stream", label: "Stream", hint: "stream id" },
  { kind: "store_item", label: "Store item", hint: "item slug" },
  { kind: "external", label: "External", hint: "https://…" },
];

/** Circular ring that fills as the post approaches the limit (X's counter). */
function CountRing({ used }: { used: number }) {
  const ratio = Math.min(1, used / MAX);
  const remaining = MAX - used;
  const circumference = 2 * Math.PI * 9;
  const near = remaining <= 200;
  return (
    <span className="flex items-center gap-2">
      {near && <span className="tnum text-xs text-meta">{remaining}</span>}
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          stroke={remaining <= 0 ? "#f6a5a5" : "#d4d4d8"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 11 11)"
        />
      </svg>
    </span>
  );
}

// The always-present head of the timeline. Icons carry the affordances; the
// URL fields only unfold once you reach for one.
export function Composer({
  autoFocus = false,
  asStory = false,
  quoted = null,
  onDone,
}: {
  autoFocus?: boolean;
  /** Open already in story mode — the stories rail's "Your story" entry. */
  asStory?: boolean;
  /** The post being quoted, previewed above the field and sent as quotedPostId. */
  quoted?: Post | null;
  onDone?: () => void;
}) {
  const me = useMe();
  const gate = useGate();
  const create = useCreatePost();
  const upload = useUploadPostMedia();
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [linkKind, setLinkKind] = useState<string | null>(null);
  const [linkRef, setLinkRef] = useState("");
  const [kind, setKind] = useState<"update" | "story">(asStory && !quoted ? "story" : "update");
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  // The picker used to insert "@handle" text and throw the Mention away, so
  // nobody was ever actually mentioned. POST /posts takes `mentions`, so the
  // chosen objects are kept and sent — filtered on submit to whoever is still
  // written in the body, since a handle can be edited or deleted afterwards.
  const [picked, setPicked] = useState<Mention[]>([]);
  const mentionResults = useMentionSearch(mentionQuery, mentionRange !== null);

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const deepLink: DeepLink | undefined =
    linkKind && linkRef.trim() ? { kind: linkKind, ref: linkRef.trim() } : undefined;

  const submit = () => {
    const body = text.trim();
    if (!body && !mediaFile) return;
    const mentions = picked.filter((mention) =>
      new RegExp(`(^|\\s)@${mention.handle}\\b`).test(body)
    );
    gate(() => void (async () => {
      let mediaUrl: string | undefined;
      try {
        mediaUrl = mediaFile ? (await upload.mutateAsync(mediaFile)).url : undefined;
      } catch {
        return;
      }
      create.mutate(
        // The current post contract requires a non-empty text field. An
        // invisible separator preserves media-only posts without displaying
        // a synthetic caption to readers.
        {
          kind,
          text: body || "\u2063",
          mediaUrl,
          deepLink,
          ...(quoted ? { quotedPostId: quoted.id } : {}),
          ...(mentions.length > 0 ? { mentions } : {}),
        },
        { onSuccess: (created) => {
          // The service silently ignores fields it does not know. If the quote
          // did not come back attached, say so rather than letting the reader
          // believe they quoted something.
          if (quoted && !created.quotedPost) {
            toast.error("Posted, but quoting isn't available yet — it went out as a plain post.");
          }
          onDone?.();
          setText("");
          setMediaFile(null);
          setPreviewUrl("");
          setLinkKind(null);
          setLinkRef("");
          setMentionQuery("");
          setMentionRange(null);
          setPicked([]);
          if (fileInput.current) fileInput.current.value = "";
        } }
      );
    })());
  };

  const updateText = (value: string, caret: number) => {
    const next = value.slice(0, MAX);
    setText(next);
    const beforeCaret = next.slice(0, Math.min(caret, next.length));
    const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (!match) {
      setMentionRange(null);
      setMentionQuery("");
      return;
    }
    const start = beforeCaret.length - match[1].length - 1;
    setMentionRange({ start, end: beforeCaret.length });
    setMentionQuery(match[1]);
  };

  const insertMention = (mention: Mention) => {
    if (!mentionRange) return;
    const handle = mention.handle;
    setPicked((current) =>
      current.some((entry) => entry.type === mention.type && entry.id === mention.id)
        ? current
        : [...current, mention]
    );
    const inserted = `@${handle} `;
    const next = `${text.slice(0, mentionRange.start)}${inserted}${text.slice(mentionRange.end)}`.slice(0, MAX);
    const caret = Math.min(mentionRange.start + inserted.length, next.length);
    setText(next);
    setMentionRange(null);
    setMentionQuery("");
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(caret, caret);
    });
  };

  const chooseMedia = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Choose an image or video file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Media must be 50 MB or smaller.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const active = text.trim().length > 0 || mediaFile !== null;

  return (
    <div className="ws-row flex gap-3 px-4 py-3">
      <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        {kind === "story" && (
          <button
            onClick={() => setKind("update")}
            className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-0.5 text-xs font-semibold text-accent"
          >
            Posting as a story · 24h <IconX className="h-3 w-3" />
          </button>
        )}

        {/* The post being quoted, previewed so the writer sees what they are
            replying to. One level only — the preview never shows its own
            quoted card. */}
        {quoted && (
          <div className="ws-inset mb-2 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Avatar
                name={quoted.author?.displayName ?? "?"}
                src={quoted.author?.avatarUrl}
                size={20}
              />
              <span className="truncate text-[13px] font-bold text-heading">
                {quoted.author?.displayName ?? "Unknown"}
              </span>
              {quoted.author && (
                <span className="truncate text-[12px] text-meta">@{quoted.author.username}</span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-normal text-body">
              {quoted.text}
            </p>
          </div>
        )}

        <textarea
          ref={field}
          value={text}
          onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMentionRange(null);
          }}
          placeholder="What's happening on the square?"
          rows={active ? 3 : 1}
          className="w-full resize-none bg-transparent py-2 text-xl leading-snug text-heading outline-none placeholder:text-meta"
        />

        {mentionRange && (
          <div className="ws-glass relative z-30 mb-2 max-h-64 overflow-y-auto rounded-2xl p-1.5">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-meta">People and groups</p>
            {mentionResults.isPending && <p className="px-3 py-3 text-xs text-meta">Searching…</p>}
            {mentionResults.data?.items.map((mention) => (
              <button
                key={`${mention.type}:${mention.id}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(mention)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/8"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-xs font-bold text-accent">{mention.type === "group" ? "GR" : mention.label.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-heading">{mention.label}</span>
                  <span className="block truncate text-xs text-meta">@{mention.handle} · {mention.type === "group" ? "Group" : "Person"}</span>
                </span>
              </button>
            ))}
            {mentionResults.isSuccess && mentionResults.data.items.length === 0 && <p className="px-3 py-3 text-xs text-meta">No matching people or groups.</p>}
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          onChange={(event) => chooseMedia(event.target.files?.[0])}
        />

        {mediaFile && previewUrl && (
          <div className="mb-2">
            <div className="ws-hair relative mt-2 overflow-hidden rounded-2xl border">
                {mediaFile.type.startsWith("video/") ? (
                  <video src={previewUrl} controls className="max-h-80 w-full bg-black object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={previewUrl} alt="Selected upload preview" className="max-h-80 w-full object-cover" />
                )}
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setMediaFile(null);
                    setPreviewUrl("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  aria-label="Remove attached media"
                  className="ws-press absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/85"
                >
                  <IconX className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2.5 py-1 text-[11px] text-grey-200 backdrop-blur-sm">
                  {mediaFile.name} · {(mediaFile.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
          </div>
        )}

        {linkKind && (
          <div className="ws-field mb-2 flex items-center gap-2 px-4 py-2">
            <IconLink className="h-4 w-4 shrink-0 text-meta" />
            <input
              value={linkRef}
              onChange={(e) => setLinkRef(e.target.value)}
              placeholder={LINK_KINDS.find((k) => k.kind === linkKind)?.hint}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button onClick={() => { setLinkKind(null); setLinkRef(""); }} aria-label="Remove link">
              <IconX className="h-3.5 w-3.5 text-meta" />
            </button>
          </div>
        )}

        <div className="ws-hair flex items-center gap-1 border-t pt-2.5">
          <button
            onClick={() => fileInput.current?.click()}
            aria-label="Upload a picture or video from your device"
            title="Upload picture or video"
            className={cn(
              "rounded-full p-2 transition-colors hover:bg-white/10",
              mediaFile ? "text-heading" : "text-accent"
            )}
          >
            <IconImage className="h-[18px] w-[18px]" />
          </button>

          {/* Deep links are the square's answer to a GIF picker: attach a
              stream, a store item or an external URL. */}
          {/* Hover-only menus are unreachable by tap and by keyboard, so the
              trigger owns the open state. */}
          <div className="relative">
            <button
              onClick={() => setLinkMenuOpen((open) => !open)}
              aria-label="Attach a link"
              aria-expanded={linkMenuOpen}
              title="Attach a link"
              className={cn(
                "rounded-full p-2 transition-colors hover:bg-white/10",
                linkKind ? "text-heading" : "text-accent"
              )}
            >
              <IconLink className="h-[18px] w-[18px]" />
            </button>
            {linkMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setLinkMenuOpen(false)} />
                <div className="ws-glass absolute left-0 top-full z-30 w-44 rounded-2xl p-1.5">
                  {LINK_KINDS.map((k) => (
                    <button
                      key={k.kind}
                      onClick={() => {
                        setLinkKind(linkKind === k.kind ? null : k.kind);
                        setLinkMenuOpen(false);
                      }}
                      className={cn(
                        "block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                        linkKind === k.kind ? "text-heading" : "text-body"
                      )}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setKind(kind === "story" ? "update" : "story")}
            aria-label="Post as a story"
            title="Stories expire after 24 hours"
            aria-pressed={kind === "story"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-bold transition-colors hover:bg-white/10",
              kind === "story" ? "text-heading" : "text-accent"
            )}
          >
            {/* This toggles update/story. It used to wear a poll glyph, which
                promised a poll composer that does not exist. */}
            <IconClock className="h-[18px] w-[18px]" />
            24h
          </button>

          <div className="ml-auto flex items-center gap-3">
            {active && <CountRing used={text.length} />}
            <button
              onClick={submit}
              disabled={!active || create.isPending || upload.isPending}
              className="ws-press h-9 rounded-full bg-accent px-5 text-[15px] font-bold text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {upload.isPending ? "Uploading…" : create.isPending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { ComposePrefill } from "@/lib/compose-prefill";
import type { DeepLink } from "@/lib/api/schemas";
import { LinkTargetPicker } from "@/components/ui/link-target-picker";
import { Avatar } from "@/components/ui/avatar";
import { IconClock, IconImage, IconLink, IconX } from "@/components/ui/icons";
import { SymbolPicker } from "@/components/ui/symbol-picker";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { cn } from "@/lib/cn";
import {
  ACCEPT_MEDIA,
  ensureUploadLimits,
  formatBytes,
  getUploadLimits,
  readVideoDuration,
  uploadKind,
  validateUpload,
  validateVideoDuration,
} from "@/lib/api/upload";
import { useCreatePost, useMentionSearch, useUploadPostMedia } from "@/features/feed/hooks/use-feed";
import type { Mention, Post } from "@/features/feed/lib/types";

const MAX = 2000;

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
  prefill,
  onDone,
}: {
  autoFocus?: boolean;
  /** Open already in story mode — the stories rail's "Your story" entry. */
  asStory?: boolean;
  /**
   * A draft handed in from a cross-product share (`/?compose=1&link=…`).
   *
   * A PREFILL, never an auto-post: it seeds the initial state and then gets
   * out of the way, so the sharer edits and publishes it themselves. It is
   * validated in `lib/compose-prefill.ts` before it reaches here — this
   * component must never receive a raw query parameter.
   */
  prefill?: ComposePrefill | null;
  /** The post being quoted, previewed above the field and sent as quotedPostId. */
  quoted?: Post | null;
  /**
   * Called once the post is live, with the created post — callers that are not
   * a feed (the shell's global composer) need its id to link to `/p/:id`,
   * since nothing on their surface will show the new post appearing.
   */
  onDone?: (created: Post) => void;
}) {
  const me = useMe();
  const gate = useGate();
  const create = useCreatePost();
  const upload = useUploadPostMedia();
  const field = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Seeded once. Later renders must not clobber what the person has typed, so
  // this is an initial value rather than an effect that syncs on every change.
  const [text, setText] = useState(prefill?.text ?? "");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  // Attaching a link is a picker, not an id box — see LinkTargetPicker.
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState<DeepLink | null>(prefill?.link ?? null);
  const [linkLabel, setLinkLabel] = useState<string | null>(prefill?.label ?? null);
  const [kind, setKind] = useState<"update" | "story">(asStory && !quoted ? "story" : "update");
  const [mentionQuery, setMentionQuery] = useState("");
  // Height follows the CONTENT, measured from the element rather than counted
  // from newlines: a long unbroken line wraps into several visual rows that no
  // character count can predict. Reset to auto first, or scrollHeight only
  // ever reports the height it already has and the box can never shrink.
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [text]);

  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
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
    link ?? undefined;

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
          onDone?.(created);
          setText("");
          setMediaFile(null);
          setPreviewUrl("");
          setLink(null);
          setLinkLabel(null);
          setLinkOpen(false);
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

  const chooseMedia = async (file: File | undefined) => {
    if (!file) return;
    // One validator for the whole app, against limits the BACKEND publishes.
    // This used to carry its own rules — a "50 MB" cap matching neither the
    // image nor the video limit — so the composer rejected files the service
    // would have taken and accepted files it would not. Hard-coding the
    // service's numbers instead only moved the drift; now they are fetched.
    //
    // Awaited BEFORE the check, and the check still runs before any byte is
    // sent: the user gets an instant, specific error, and it is the right one.
    // The call is memoised, so only the first pick of a session pays for it,
    // and it falls back rather than failing.
    await ensureUploadLimits();
    const invalid = validateUpload(file, "media");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    // Clip length, checked here and nowhere else: the backend publishes
    // `maxVideoSeconds` but does not enforce it, because reading a duration
    // means demuxing the file and the presign path never sees the bytes. So
    // this is a courtesy — it stops the user spending a phone upload on a clip
    // the feed should not autoplay — not a control. An unreadable duration
    // lets the file through; the byte cap is the limit that actually bites.
    if (uploadKind(file) === "video") {
      const tooLong = validateVideoDuration(await readVideoDuration(file));
      if (tooLong) {
        toast.error(tooLong);
        return;
      }
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const active = text.trim().length > 0 || mediaFile !== null;

  /**
   * The caps, shown BEFORE a file is chosen.
   *
   * They were only ever spoken as a rejection — pick a 40MB clip, wait, get
   * told. Saying them up front costs one line and turns a refusal into a
   * choice. Read from the published contract, never typed in here: the whole
   * point of `/uploads/limits` is that these numbers have one owner, and a
   * hint that drifts is worse than no hint.
   */
  const [limits, setLimits] = useState(getUploadLimits());
  useEffect(() => {
    let live = true;
    void ensureUploadLimits().then((fetched) => {
      if (live) setLimits(fetched);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="ws-row flex gap-3 px-4 py-3">
      <Avatar name={me.data?.displayName ?? "You"} seed={me.data?.id} src={me.data?.avatarUrl} size={40} />

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
                seed={quoted.author?.id} src={quoted.author?.avatarUrl}
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

        {/* Grows with what is being written, then scrolls.
            `rows` alone cannot do this: a fixed count is either too small for a
            real thought or leaves a hole above the actions when the box is
            empty. It opened at one row, which clipped the placeholder itself.
            The cap keeps the send button on screen — a box that grows without
            limit pushes Post below the fold exactly when somebody is ready to
            press it, and on a phone that is the whole sheet. */}
        <textarea
          ref={field}
          value={text}
          onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMentionRange(null);
          }}
          placeholder="What's happening on the square?"
          rows={1}
          className="min-h-[7.5rem] w-full resize-none overflow-y-auto bg-transparent py-2 text-xl leading-snug text-heading outline-none placeholder:text-meta sm:min-h-[6rem]"
          style={{ maxHeight: "38dvh" }}
        />

        {mentionRange && (
          <div className="ws-popover relative z-30 mb-2 max-h-64 overflow-y-auto rounded-2xl p-1.5">
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
          // Derived from the allowlist so the picker can never offer a type
          // we reject — it used to include video/quicktime, which guaranteed
          // a failure after the user had already chosen a file.
          accept={ACCEPT_MEDIA}
          className="sr-only"
          onChange={(event) => void chooseMedia(event.target.files?.[0])}
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

        {(linkOpen || link) && (
          <div className="mb-2">
            <LinkTargetPicker
              value={link}
              label={linkLabel}
              onChange={(next, nextLabel) => {
                setLink(next);
                setLinkLabel(nextLabel);
                if (!next) setLinkOpen(false);
              }}
            />
          </div>
        )}

        {/* One strip, on a 360px phone too. Every control here is `shrink-0`
            — correct, since a squashed icon button is not a button — so the
            row's minimum width is the sum of its parts, and the sheet clips
            rather than scrolls: past that width the Post button simply left
            the screen. The fix is to make the parts smaller on small screens
            rather than to let them shrink or wrap. */}
        <div className="ws-hair flex min-w-0 flex-nowrap items-center gap-0.5 border-t pt-2.5 sm:gap-1">
          <button
            onClick={() => fileInput.current?.click()}
            aria-label="Upload a picture or video from your device"
            title="Upload picture or video"
            className={cn(
              "shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/10 sm:p-2",
              mediaFile ? "text-heading" : "text-accent"
            )}
          >
            <IconImage className="h-[18px] w-[18px]" />
          </button>

          {/* Deep links are the square's answer to a GIF picker: attach a
              stream, a store item or an external URL. The type is chosen
              inside the picker, so this is a single toggle rather than a menu
              of id-shaped options. */}
          <div className="relative shrink-0">
            <button
              onClick={() => setLinkOpen((open) => !open)}
              aria-label="Attach a link"
              aria-pressed={linkOpen || link !== null}
              title="Attach a link"
              className={cn(
                "rounded-full p-1.5 transition-colors hover:bg-white/10 sm:p-2",
                link ? "text-heading" : "text-accent"
              )}
            >
              <IconLink className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* The `$` and emoji tools are SIBLINGS of the other tools, not
              children of the link button's wrapper. Nested inside it they
              stacked vertically — that wrapper is a block box, so the row
              rendered as three ragged lines instead of one strip of controls.
              Each picker already owns the `relative` its popover anchors to,
              so none of them needs a wrapper here.

              The `$` tool matches Ark's composer: it inserts at the caret and
              only ever offers coins the platform can actually trade, so a
              chosen ticker always renders — a symbol typed from memory is
              silently plain text when it is wrong. */}
          <SymbolPicker
            onPick={(fragment) => {
              const node = field.current;
              const at = node?.selectionStart ?? text.length;
              const next = `${text.slice(0, at)}${fragment}${text.slice(at)}`;
              updateText(next, at + fragment.length);
              // Typing continues where the insert ended, not at the end.
              const caret = at + fragment.length;
              window.requestAnimationFrame(() => {
                node?.focus();
                node?.setSelectionRange(caret, caret);
              });
            }}
          />

          <EmojiPicker
            onPick={(emoji) => {
              const node = field.current;
              const at = node?.selectionStart ?? text.length;
              const next = `${text.slice(0, at)}${emoji}${text.slice(at)}`;
              updateText(next, at + emoji.length);
              const caret = at + emoji.length;
              window.requestAnimationFrame(() => {
                node?.focus();
                node?.setSelectionRange(caret, caret);
              });
            }}
          />

          <button
            onClick={() => setKind(kind === "story" ? "update" : "story")}
            aria-label="Post as a story"
            title="Stories expire after 24 hours"
            aria-pressed={kind === "story"}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-2 text-[11px] font-bold transition-colors hover:bg-white/10 sm:px-2",
              kind === "story" ? "text-heading" : "text-accent"
            )}
          >
            {/* This toggles update/story. It used to wear a poll glyph, which
                promised a poll composer that does not exist. */}
            <IconClock className="h-[18px] w-[18px]" />
            {/* The glyph and the title carry the meaning where there is no
                room for the label; the aria-label is unchanged either way. */}
            <span className="hidden sm:inline">24h</span>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {active && <CountRing used={text.length} />}
            <button
              onClick={submit}
              disabled={!active || create.isPending || upload.isPending}
              className="ws-press h-9 rounded-full bg-accent px-4 text-[15px] font-bold text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
            >
              {upload.isPending ? "Uploading…" : create.isPending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>

        {/* Quiet, and only while composing: a permanent line of limits above an
            empty box is noise, and the reader who has not reached for a file
            does not need it yet. */}
        {active && (
          <p className="mt-2 text-[11px] leading-4 text-meta">
            Photos up to {formatBytes(limits.maxImageBytes)} · video up to{" "}
            {formatBytes(limits.maxVideoBytes)}, {limits.maxVideoSeconds}s
          </p>
        )}
      </div>
    </div>
  );
}

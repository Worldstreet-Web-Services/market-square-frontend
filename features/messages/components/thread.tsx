"use client";

import { useEffect, useRef, useState } from "react";
import { atHandle } from "@/lib/handle";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/use-me";
import { useGate } from "@/hooks/use-gate";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMentionTyping } from "@/hooks/use-mention-typing";
import { MentionPicker } from "@/components/ui/mention-picker";
import { PostText } from "@/components/ui/post-text";
import { mentionCandidates, type MentionableMember } from "@/lib/mentionable-members";
import { replyExcerpt } from "@/lib/message-reply";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { InlineVideo } from "@/components/ui/inline-video";
import { RowSkeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { GroupSettingsSheet } from "@/features/messages/components/group-settings-sheet";
import { ShareSheet } from "@/components/ui/share-sheet";
import { canMakeInvite, inviteUrl } from "@/features/messages/lib/invites";
import { memberActions, viewerRole, type GroupRole } from "@/features/messages/lib/roles";
import { ErrorState } from "@/components/ui/states";
import Link from "next/link";
import { housePath } from "@/lib/house-path";
import { Button } from "@/components/ui/button";
import { ThreadMenu } from "@/features/messages/components/thread-menu";
import {
  AttachmentPanel,
  type Measured,
} from "@/features/messages/components/attachment-panel";
import { formatBytes, type UploadResult } from "@/lib/api/upload";
import { canSendMessage, type OutgoingMessage } from "@/features/messages/lib/outgoing";
import { useVoiceRecorder } from "@/features/messages/hooks/use-voice-recorder";
import { formatElapsed } from "@/features/messages/lib/voice-recorder";
import { dotScale } from "@/lib/voice-levels";
import { isReplySwipe, SWIPE_TRIGGER, swipeCommits, swipeOffset } from "@/lib/swipe-reply";
import { uploadFile } from "@/lib/api/upload";
import { IconArrowLeft, IconHouses, IconMic, IconPlay, IconPause, IconQuote, IconX } from "@/components/ui/icons";
import {
  useConversationMembers,
  useLeaveGroup,
  useDeleteConversation,
  useMarkConversationRead,
  useMessages,
  useRenameGroup,
  useSendMessage,
  useCreateInvite,
  useRemoveGroupMember,
  useSetMemberRole,
  useTransferOwnership,
} from "@/features/messages/hooks/use-messages";
import {
  formatClockTime,
  groupBySender,
  groupMessagesByDay,
} from "@/features/messages/lib/thread-groups";
import {
  isGroupThread,
  threadSubtitleParts,
  threadTitle,
} from "@/features/messages/lib/thread-identity";
import { receiptLabel, receiptState, type ReceiptState } from "@/features/messages/lib/read-receipt";
import {
  formatDuration,
  mediaRatio,
  messageMediaKind,
} from "@/features/messages/lib/message-media";
import { playProgress, playedBars, waveformBars } from "@/features/messages/lib/waveform";
import { isAtBottom } from "@/features/messages/lib/thread-scroll";
import {
  MESSAGE_MAX,
  type Conversation,
  type Message,
  type MessageReplyTo,
} from "@/features/messages/lib/types";
import type { Profile } from "@/lib/api/schemas";

/**
 * The conversation pane — the right-hand 751px column of the Messages screen.
 *
 * ONE component for both of the design's threads. Node 21:5519 is the 1:1
 * ("gist DM") and node 21:6024 the group ("house DM"), and they are the same
 * pane with four differences: what the header says, a Create Gist Room pill
 * beside the overflow control, a 24px sender avatar hanging off incoming
 * bubbles with a tail on the bubble's bottom-left corner, and a real date on
 * the day separator instead of "Today". Building them as two components would
 * mean two composers, two scroll controllers and two mark-as-read effects, and
 * the first fix to either would land in one of them.
 *
 * Three bands at the design's numbers: an 80px identity header, the message
 * river in day sections, and an 80px composer. Both bands are inset 16/24 with
 * a 10% white hairline, and the river sits in the same 24px gutters (703 of
 * content inside 751).
 *
 * TYPEFACE. The design names Roboto for the bubbles and separators and Geist
 * for the composer field. The app is Geist throughout, so every size, weight,
 * line-height and letter-spacing below is the design's and the family is the
 * app's — one pane rendering in a second family reads as a bug rather than as
 * a design.
 *
 * WHAT IS INERT AND WHY is stated at each control. The rule this pane follows
 * is the house one: a capability with no route behind it is DRAWN and
 * disabled, never wired to a plausible-looking request.
 *
 * ─── REPLY-TO AND @MENTIONS HAVE NO FIGMA NODE ──────────────────────────────
 * Neither 21:5519 nor 21:6024 draws a quoted reply, a reply affordance, a
 * "Replying to" strip or a mention. They are built in the bubbles' own
 * language — the same 16px radius, the same white / #7E3BEB fills, the 14/20
 * body and 12/16 meta — and kept minimal: a quote block inside the bubble, a
 * strip above the composer in the attachment chip's recipe, and the shared
 * mention picker the post composer already opens. Until the service ships
 * the fields, a message without `replyTo` draws no quote and the composer
 * still sends; nothing here fakes either.
 */

/**
 * The round icon button that appears across this pane — the header's overflow
 * control, the composer's attachment and voice buttons, and send.
 *
 * Geometry is the design's, literally: 38.37px and a 1px ring. The fill really
 * is nothing on the first three — #11064:5761, :5764, :5770 and :5773 each
 * report `rgba(0, 0, 0, 0)`, and this was once read as a serialisation
 * artefact and painted #0A0A0A. It is not one: send sits in the same node tree
 * and reports its own fill perfectly well, so transparency is not being lost on
 * the way out. These circles have no fill and the pane behind them shows
 * through.
 */
function CircleButton({
  label,
  icon,
  size,
  onClick,
  disabled,
  title,
  variant = "outline",
  className,
}: {
  label: string;
  icon: React.ReactNode;
  /** The glyph's own box — 16 or 24 in the design, per icon. */
  size: number;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /**
   * `send` is the one circle with a fill: a near-black #1C1C1C disc, which is
   * `--color-grey-800` exactly. Its #9B9B9B stroke paint sits at weight 0 like
   * every other button here, so there is no silver RING — the earlier reading
   * of one came from the MCP tool dropping the zero weight. What actually
   * distinguishes send is the fill plus a 16px glyph in `--color-grey-400`,
   * against the outline buttons' 24px white one.
   */
  variant?: "outline" | "send";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={cn(
        // NO BORDER. Every one of these circles carries a white stroke PAINT in
        // the file with `strokeWeight: 0.0`, which renders nothing — the rim
        // you see in the mockup is Figma's GLASS effect, not a stroke. The
        // Figma MCP tool omits a zero weight entirely, so its output reads as
        // "solid white stroke" and that is exactly how a full-opacity
        // `border-white` ring got shipped here. Verified against the raw REST
        // payload for 21:5689 / 21:5692 / 21:5701 / 21:5683 (and their group
        // twins), which are byte-identical.
        //
        // The GLASS parameters (blur, refraction, dispersion) are NOT in the
        // REST payload — they are plugin-API only — so the wash below is a
        // judgement call approximating it. The ABSENCE of a border is not a
        // judgement call.
        "ws-press flex h-[38.37px] w-[38.37px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40",
        variant === "send"
          ? // Opaque #1C1C1C = --color-grey-800. Its #9B9B9B stroke is also
            // weight 0, so it has no ring either — only the 16px grey glyph
            // distinguishes it.
            "bg-grey-800"
          : // The GLASS material, not a border and not a flat wash — see
            // `ws-glass-pill` in globals.css for what the file actually says
            // and why a 4% wash was as wrong as a white ring.
            "ws-glass-pill",
        // Neither hover nor disabled exists as a state in the design — these
        // are the house treatments, the same wash the post card's "more" disc
        // and the column header's back arrow use.
        disabled ? "cursor-not-allowed" : "hover:bg-white/10",
        className
      )}
    >
      {/* The design pads these by 8.077px, which is exact for its 16px glyphs
          and overflows its own 38.37px box for the 24px ones. The glyph's own
          size is the reliable half of that pair, so it is set here and the
          circle simply centres it. */}
      <span className="flex items-center justify-center" style={{ width: size, height: size }}>
        {icon}
      </span>
    </button>
  );
}

/**
 * The 12px double-check under an outgoing message.
 *
 * Only under an outgoing one. The design draws this glyph on all four bubbles,
 * incoming included, which is a duplicated component rather than an
 * instruction — a read receipt on a message the peer sent us says nothing.
 * `receiptState` is the gate and it is pinned in a test.
 *
 * The mark has two paints, because the service now sends `readBy` and
 * `readByAll` and a tick that never changes is a tick that carries no
 * information. Unread stays the design's grey; read (and, in a house,
 * partially read) takes `--color-spotlight`, the ramp's dark stop, which is
 * 5.66:1 on the white bubble. No third purple, and no new glyph: the
 * WhatsApp-style colour change on the same mark is the convention readers
 * already have.
 */
function ReceiptMark({ state, readBy }: { state: ReceiptState; readBy: number }) {
  if (state === "none") return null;
  const label = receiptLabel(state, readBy);
  const seen = state === "read" || state === "partial";

  return (
    <span title={label} className="flex shrink-0 items-center">
      {/*
        The design's own 12px export, painted through a MASK rather than
        rendered as an image.

        The file ships the glyph as a flat `#8A8A8A` path — exactly the
        design's unread grey — so an `<img>` would be right for one of the two
        states and untintable for the other. `filter: hue-rotate(...)` from a
        desaturated grey to a saturated purple is a guess that lands
        somewhere near the colour and drifts the moment the token moves. A
        mask takes the glyph's ALPHA and lets a normal background-colour
        utility paint it, so both states come from real tokens and the asset
        stays a single file.
      */}
      <span
        aria-hidden
        style={{
          maskImage: "url(/messages/checks.svg)",
          WebkitMaskImage: "url(/messages/checks.svg)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
        className={cn("h-3 w-3 shrink-0", seen ? "bg-spotlight" : "bg-[#8A8A8A]")}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   HEADER
   ──────────────────────────────────────────────────────────────────────────── */

function ThreadHeader({
  conversation,
  onBack,
  onCreateGistRoom,
  menu,
}: {
  conversation: Conversation;
  onBack: () => void;
  onCreateGistRoom?: () => void;
  /** The overflow menu's panel — nodes 77:8287 / 78:8337 / 78:8525. */
  menu: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const group = isGroupThread(conversation);
  const peer = conversation.peer;
  const title = threadTitle(conversation);
  const subtitle = threadSubtitleParts(conversation).join("  •  ");

  return (
    // Pinned, not sticky: this band is a fixed row of the pane's flex column
    // and never enters the scroller, so it cannot drift or jitter the way a
    // sticky element does. The design gives it a fill of `rgba(255,255,255,
    // 0.002)`, which is nothing — it sits over the app ground, so it takes
    /* NO FILL. Node 75:8117 is `white/0.2%`, which is nothing — the bar sits on
       the pane's own ground and is separated by its hairline alone. It used to
       be `bg-ground` (#000), which made the whole thread pane read as a
       different, darker black from the inbox column beside it. The hairline is
       the design's 10%, not `ws-head`'s 8%. */
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
      {/* Not in the design, which only ever draws the desktop two-pane state.
          Below lg the list gives way to the thread entirely, so without this
          there is no route back to the inbox. Hidden where both panes are up. */}
      <button
        onClick={onBack}
        aria-label="Back to inbox"
        className="ws-press -ml-2 shrink-0 rounded-full p-2 text-heading transition-colors hover:bg-white/10 lg:hidden"
      >
        <IconArrowLeft className="h-5 w-5" />
      </button>

      {/* 12 from the avatar to the text, 4 between the two lines. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
          {group ? (
            /*
              THE GROUP'S OWN PICTURE, when it has one.

              `imageUrl` is on `ConversationSummary` now — it was not when this
              was written, and the note here said so and drew the house glyph
              instead. The inbox row beside it has been drawing the picture ever
              since the field landed, so the header was the only place in the
              app still showing a group as a generic mark.

              The glyph remains the FALLBACK, and the rule it was written for
              still holds: a group with no picture must not borrow one.
              `members` is a roster capped at four, so the obvious shortcut —
              draw the first member's face — puts one person on a room of
              seventy-five and says something false about whose thread this is.
              The house glyph is the same mark the inbox files these under
              ("Houses"), so it reads as a room rather than a broken image.
            */
            conversation.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the media host is a runtime value, unknown at build time
              <img
                src={conversation.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <IconHouses className="h-5 w-5 text-white/70" />
            )
          ) : (
            <Avatar
              name={peer?.displayName ?? "?"}
              seed={peer?.id}
              src={peer?.avatarUrl}
              size={38}
            />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="truncate text-[12px] font-bold leading-4 text-white">{title}</h1>
            {/* The design draws exactly ONE capsule here — the admin-granted
                badge, which is `OrgBadgeChip`: its recipe exactly, a 4% white
                pill with a 19% white hairline around the MARKET/ARK wordmark.
                Drawn at the house size, since a 4.55px wordmark is unreadable
                and this chip is 7px tall on every other surface in the app.

                A GROUP CARRIES NONE. `orgBadge` is granted to a person, and
                the conversation payload has no badge of its own — so the
                capsule is a 1:1 thing and its absence beside a group name is
                correct rather than missing. */}
            {!group && peer && <OrgBadgeChip orgBadge={peer.orgBadge} />}
          </div>

          {/* The design puts "Typing…" on this line in the earlier frame. There
              is no typing channel on the messages service, so that half is not
              invented. What IS on the contract is presence — `lastSeenAt` on a
              profile, `lastActiveAt` on a group — and this line renders it
              beside the handle (1:1) or the member count (group). Every part
              is dropped independently when the field is absent, so a payload
              with no presence shows "@fatima.b" alone and never "Active
              recently". */}
          {subtitle && (
            <p className="truncate text-[12.12px] font-normal leading-[16.15px] text-white/50">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {group && <CreateGistRoomButton onClick={onCreateGistRoom} />}

        {/*
          THE OVERFLOW CONTROL — the three vertical dots.

          It used to open the member sheet on a group and be DISABLED on a 1:1,
          on the reading that the conversation contract had no thread-level
          action. That was wrong: the service has add-members, rename, leave,
          block and report, and the file draws a real menu on all three thread
          shapes (77:8287, 78:8337, 78:8525). It now opens that menu, and the
          rows the service genuinely cannot back are disabled inside it with
          their reason — which is where an unavailable capability belongs, next
          to its name, rather than swallowing the whole control.

          The backdrop is a full-screen button rather than a document listener:
          it closes on the same click that would otherwise fall through to
          whatever is underneath, and it is reachable by keyboard.
        */}
        <div className="relative">
          <CircleButton
            label="Conversation options"
            size={24}
            onClick={() => setMenuOpen((open) => !open)}
            icon={<Image src="/messages/more.svg" alt="" width={24} height={24} />}
          />
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full z-50 mt-2"
                onClick={() => setMenuOpen(false)}
              >
                {menu}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * `Create Gist Room` — 168x38, the violet ramp, a mic and a label.
 *
 * INERT, and this is the clearest case of it in the pane. A gist room is a
 * live audio room; the conversation contract that gained groups
 * (`POST /conversations/groups`, `PATCH /conversations/:id`, the member
 * routes, accept/decline) has nothing that opens a room from a thread, and
 * the houses slice — which owns rooms — cannot be imported here because slices
 * never import each other. There is no request this button could make, so it
 * makes none.
 *
 * The gradient is `ws-btn-create` rather than the node's own
 * `90deg #9F65FD → #5B05E6`: same two stops of the same purple ramp, and the
 * utility already paints every twin of this CTA in the app. Shipping a second
 * angle for the same object is how one control ends up with two paints.
 */
/**
 * "Create Gist Room" — node 76:8239, on a GROUP header only.
 *
 * 168x38 at a pill radius, the `ws-btn-create` gradient (the file's own
 * `#9F65FD -> #5B05E6` at 90 degrees, which is that utility exactly), a 16px
 * mic and Geist Medium 15/21.75. All verbatim from the file.
 *
 * It was hard-disabled because nothing could open a room from a thread. That
 * is no longer true: the gist-room composer (59:7544) exists, so the button
 * takes a handler and is live wherever one is supplied. It still refuses when
 * there is none, rather than rendering a control that does nothing — the same
 * rule, applied to whichever surface has not wired it yet.
 *
 * The handler is passed IN rather than imported: the composer lives in
 * `features/houses` and slices never import each other, so the layout screen
 * joins the two. Same route-slot pattern the inbox's `+` uses for the people
 * picker.
 */
function CreateGistRoomButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      title={
        onClick
          ? undefined
          : "Gist rooms aren't wired up on this surface yet."
      }
      className={cn(
        "ws-btn-create flex h-[38px] w-[168px] shrink-0 items-center justify-center gap-1 rounded-full text-[15px] font-medium leading-[21.75px] text-white",
        onClick ? "ws-press transition-opacity hover:opacity-90" : "cursor-not-allowed opacity-40"
      )}
    >
      <IconMic className="h-4 w-4" />
      Create Gist Room
    </button>
  );
}

/**
 * Who is in the house.
 *
 * The one thing the group header's overflow can honestly do today, and the
 * same query the bubbles resolve their avatars through — one request, one
 * cache, one answer, so the sheet and the river can never disagree about the
 * membership inside a single render.
 *
 * `PersonRow` is deliberately NOT reused: it links to `/u/[username]`, which
 * would navigate the reader out of the two-pane route and lose the open
 * thread. The identity composition is the same (avatar, name, handle); the
 * navigation is precisely what must not be — the same call the host cockpit's
 * request queue makes.
 */
function MembersSheet({
  conversation,
  open,
  onClose,
  meId,
  myRole,
}: {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
  meId: string | undefined;
  /** The reader's own role — decides which controls each row offers. */
  myRole: GroupRole | null;
}) {
  const members = useConversationMembers(conversation.id, open && isGroupThread(conversation));
  const setRole = useSetMemberRole(conversation.id);
  const transfer = useTransferOwnership(conversation.id);
  const remove = useRemoveGroupMember(conversation.id);
  /* Removing someone and handing the house over both ask first: neither can
     be undone from this sheet. */
  const [confirming, setConfirming] = useState<{ kind: "remove" | "owner"; profile: Profile } | null>(null);

  // The summary's four-deep preview roster stands in until the full list
  // lands, so the sheet opens with content rather than with skeletons.
  const rows =
    members.data?.items ??
    conversation.members.map((profile) => ({
      profile,
      role: "member" as const,
      joinedAt: null,
    }));
  const house = conversation.title ?? "this house";
  const ACTION =
    "ws-press rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-body transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Sheet open={open} onClose={onClose} title={threadTitle(conversation)}>
      {confirming ? (
        <div className="p-4">
          <p className="text-[13px] leading-5 text-body">
            {confirming.kind === "owner"
              ? `${confirming.profile.displayName} becomes the owner of ${house}. You stay on as an admin, and only they can make or remove admins after this.`
              : `${confirming.profile.displayName} will be removed from ${house}. A member can add them back.`}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={transfer.isPending || remove.isPending}
              onClick={() => {
                const done = { onSuccess: () => setConfirming(null) };
                if (confirming.kind === "owner") transfer.mutate(confirming.profile.id, done);
                else remove.mutate(confirming.profile.id, done);
              }}
            >
              {confirming.kind === "owner" ? "Make owner" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {members.isError ? (
            <ErrorState
              error={members.error}
              fallback="Couldn't load the member list."
              onRetry={() => members.refetch()}
            />
          ) : rows.length === 0 && members.isPending ? (
            [0, 1, 2].map((i) => <RowSkeleton key={i} />)
          ) : (
            rows.map((member, index) => {
              const profile = member.profile;
              // Controls come only from the full roster: the preview rows all
              // read "member" and would offer actions on the wrong people.
              const actions =
                profile && members.data
                  ? memberActions({ viewer: myRole, target: member.role, isSelf: profile.id === meId })
                  : null;
              return (
                <div key={profile?.id ?? `member-${index}`} className="flex items-start gap-3">
                  <Avatar name={profile?.displayName ?? "?"} seed={profile?.id} src={profile?.avatarUrl} size={38} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-semibold text-white">
                      {profile?.displayName ?? "Former member"}
                    </span>
                    {atHandle(profile?.username) && (
                      <span className="truncate text-[12px] text-meta">{atHandle(profile?.username)}</span>
                    )}
                    {profile && actions && (actions.makeAdmin || actions.removeAdmin || actions.makeOwner || actions.remove) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {actions.makeAdmin && (
                          <button type="button" disabled={setRole.isPending} onClick={() => setRole.mutate({ profileId: profile.id, role: "admin" })} className={ACTION}>
                            Make admin
                          </button>
                        )}
                        {actions.removeAdmin && (
                          <button type="button" disabled={setRole.isPending} onClick={() => setRole.mutate({ profileId: profile.id, role: "member" })} className={ACTION}>
                            Remove admin
                          </button>
                        )}
                        {actions.makeOwner && (
                          <button type="button" onClick={() => setConfirming({ kind: "owner", profile })} className={ACTION}>
                            Make owner
                          </button>
                        )}
                        {actions.remove && (
                          <button type="button" onClick={() => setConfirming({ kind: "remove", profile })} className={cn(ACTION, "text-down")}>
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* The service's own words. Members carry no chip — a column
                      of the same word is noise. */}
                  {member.role === "owner" && (
                    <span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-create">Owner</span>
                  )}
                  {member.role === "admin" && (
                    <span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-grey-300">Admin</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   BUBBLES
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The meta that hangs off the last line of every bubble: a time, and on an
 * outgoing message the receipt.
 *
 * ─── THE INCOMING TIMESTAMP IS NOT THE DESIGN'S GREY, DELIBERATELY ───────────
 * The design puts #8A8A8A on both bubbles. On the white one that is 4.6:1 and
 * fine. On #7E3BEB it is **1.64:1** — invisible. An earlier pass "fixed" this
 * by moving the incoming stamp to #999999, which is 1.99:1 and no more
 * readable; the arithmetic was never done. White at 85% composites to 4.52:1
 * on the same purple, which clears AA with nothing to spare, so that is what
 * ships. This is the one place in the pane where a measured colour is not
 * reproduced, and it is a legibility decision rather than a taste one.
 */
function BubbleMeta({
  message,
  mine,
  group,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
}) {
  const state = receiptState({
    mine,
    group,
    status: message.status,
    readBy: message.readBy,
    readByAll: message.readByAll,
  });

  return (
    <span className="flex shrink-0 items-center gap-1">
      <span
        className={cn(
          "tnum text-[12px] font-medium leading-4 tracking-[-0.005em]",
          mine ? "text-[#8A8A8A]" : "text-white/85"
        )}
      >
        {formatClockTime(message.createdAt)}
      </span>
      <ReceiptMark state={state} readBy={message.readBy} />
    </span>
  );
}

/** Shared paint and geometry for all three bubbles: 16px radius, and the
    design's colour assignment by POSITION — own messages are the white bubble
    on the right, the peer's the purple one on the left. The evidence for that
    is geometric rather than chromatic: every #FFFFFF bubble ends at the pane's
    right edge and every #7E3BEB one starts at its left. */
function bubbleShell(mine: boolean, tail: boolean) {
  return cn(
    "rounded-2xl",
    mine ? "bg-white" : "bg-spotlight",
    // The group node's incoming bubbles carry a tail: 16/16/16/2, a squared
    // bottom-left corner pointing at the sender avatar beside it. A 1:1 has no
    // avatar in the river, so it has no tail either.
    tail && "rounded-bl-[2px]"
  );
}

/**
 * The ink for a tappable part of a message body — an @handle, a #tag, a link.
 *
 * `PostText` is the ONE renderer for post-shaped text, so a handle in a chat
 * bubble is the same link to `/u/{handle}` a post draws. Its default ink is
 * the post purple (`--color-spotlight-chip-ink`), which is 2.7:1 on the white
 * bubble and 2.1:1 on the #7E3BEB one — both fail. So each bubble passes the
 * ink that clears AA on its own fill: the ramp's dark stop on white (5.66:1),
 * white on purple (5.66:1), the same two pairings the bubbles already use.
 */
function bubbleLinkClass(mine: boolean): string {
  return mine
    ? "font-semibold text-spotlight hover:underline"
    : "font-semibold text-white underline decoration-white/50 underline-offset-2 hover:decoration-white";
}

/** The body of a text bubble, or its caption: mentions as links, on-brand ink. */
function BubbleText({
  message,
  mine,
  className,
}: {
  message: Message;
  mine: boolean;
  className?: string;
}) {
  if (!message.text) return null;
  return (
    <PostText
      text={message.text}
      mentions={message.mentions}
      linkClassName={bubbleLinkClass(mine)}
      className={cn(
        "min-w-0 text-[14px] font-normal leading-5 tracking-[-0.006em]",
        mine ? "text-[#5A5A5A]" : "text-white",
        className
      )}
    />
  );
}

/**
 * The quoted original INSIDE a reply's bubble: who said it and one line of
 * what, on a 2px rule in the bubble's own contrasting ink. Tapping it scrolls
 * to the original when that message is loaded — and does nothing visible
 * when it is not, which is honest: there is nowhere to go.
 *
 * "Message deleted" comes from the service's `deleted`, which is always false
 * today (conversation messages cannot be deleted yet); the wording is kept so
 * the shape is future-proof, not because anything flips it.
 */
function ReplyQuote({
  replyTo,
  mine,
  name,
  onJump,
}: {
  replyTo: MessageReplyTo;
  mine: boolean;
  /** The original's sender, resolved by the pane — "You" for the reader. */
  name: string;
  onJump: (messageId: string) => void;
}) {
  const line = replyExcerpt({ text: replyTo.text, media: replyTo.media, deleted: replyTo.deleted });
  return (
    <button
      type="button"
      onClick={() => onJump(replyTo.id)}
      aria-label={`Go to the message from ${name} this replies to`}
      className={cn(
        "ws-press flex w-full min-w-0 flex-col items-start rounded-lg border-l-2 px-2.5 py-1.5 text-left transition-colors",
        mine
          ? "border-spotlight bg-black/[0.05] hover:bg-black/[0.08]"
          : "border-white bg-white/10 hover:bg-white/15"
      )}
    >
      <span className={cn("truncate text-[12px] font-semibold leading-4", mine ? "text-spotlight" : "text-white")}>
        {name}
      </span>
      {line && (
        <span
          className={cn(
            "line-clamp-1 text-[12px] leading-4",
            mine ? "text-[#5A5A5A]" : "text-white/85",
            replyTo.deleted && "italic"
          )}
        >
          {line}
        </span>
      )}
    </button>
  );
}

/**
 * The per-bubble "Reply" — a 28px glass disc beside the bubble, on the side
 * away from the pane's edge so it never overlaps the tail or the avatar.
 *
 * On a pointer device it is invisible until the row is hovered (or the
 * control is tabbed to); on a touch device there is no hover, so it is not
 * drawn at all until a long-press on the row reveals it — `revealed` — and a
 * slot is only reserved then. A tap on it sets the composer's reply target.
 */
function ReplyButton({
  onClick,
  revealed,
  mine,
}: {
  onClick: () => void;
  revealed: boolean;
  mine: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reply to this message"
      title="Reply"
      className={cn(
        "ws-glass-pill ws-press flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full text-white/80 transition-opacity hover:bg-white/10 hover:text-white",
        // The row's hover shows it; keyboard focus shows it; a long-press on a
        // phone shows it. Otherwise it is transparent on pointer devices and
        // absent on touch ones.
        revealed
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden",
        mine ? "order-first" : "order-last"
      )}
    >
      <IconQuote className="h-3.5 w-3.5" />
    </button>
  );
}

function TextBubble({
  message,
  mine,
  group,
  tail,
  quote,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
  tail: boolean;
  /** The quoted original, when this message is a reply. */
  quote?: React.ReactNode;
}) {
  const removed = message.status === "removed";

  return (
    <div
      className={cn(
        // The design's bubbles hug their content and never wrap, so the cap is
        // ours. 480 is where its longest line lands; the percentage keeps a
        // narrow phone pane from running edge to edge.
        //
        // The body and the meta are SIBLINGS in one bottom-aligned row 10px
        // apart, so the stamp hangs off the last line rather than sitting under
        // the message. A quote, when there is one, sits above that row.
        "flex max-w-[min(85%,480px)] flex-col gap-1.5 p-3",
        bubbleShell(mine, tail)
      )}
    >
      {quote}
      <div className="flex items-end gap-2.5">
        {removed ? (
          <p
            className={cn(
              "min-w-0 whitespace-pre-wrap break-words text-[14px] font-normal italic leading-5 tracking-[-0.006em] opacity-60",
              mine ? "text-[#5A5A5A]" : "text-white"
            )}
          >
            Message removed
          </p>
        ) : (
          <BubbleText message={message} mine={mine} />
        )}
        <BubbleMeta message={message} mine={mine} group={group} />
      </div>
    </div>
  );
}

/**
 * A photo or a clip — the design's 262px bubble with 4px of white around the
 * media and an 8px footer strip under it.
 *
 * ─── TWO DEPARTURES, BOTH NAMED ──────────────────────────────────────────────
 * 1. `object-contain`, not the design's `object-fit: cover`. When the service
 *    sends `mediaWidth`/`mediaHeight` the bubble takes the media's own ratio
 *    and the two are IDENTICAL — nothing is cropped either way. It is only the
 *    unmeasured case that differs, and there `cover` would slice an arbitrary
 *    photo to fit a 4:3 guess. `MediaFrame` is the house answer to exactly
 *    that: contain the frame, fill the leftover with a blurred copy of it, and
 *    never admit a hard black bar.
 *
 * 2. NO PLAY BADGE ON A CLIP. The design draws a 40px purple circle with a
 *    play glyph over the video. Clips in this app render through
 *    `InlineVideo`, which is the one clip implementation and autoplays muted
 *    once it is 60% on screen (with native controls under
 *    `prefers-reduced-motion`) — so by the time a reader could press a badge,
 *    the clip is already playing and the badge would be a control that does
 *    nothing. Drawing it anyway to match the picture, or writing a second
 *    tap-to-play video player beside the shared one, are both worse than
 *    losing the circle.
 *
 * A CAPTION IS RENDERED. `text` is nullable now, so most media messages carry
 * none — but when one does, dropping it to match a node that has no captioned
 * state would silently delete what somebody wrote.
 */
/**
 * "X opened a gist room" — the announcement a room posts into its house group.
 *
 * A private room is reachable ONLY by members of that group, so without this
 * card the room is a door nobody knows about: the very people it was made for
 * would have to already know it exists. The card is what makes joining
 * possible, so it is a real link rather than decorated text.
 *
 * It renders on the deep LINK, not on the wording. The service could reword
 * the message tomorrow and this would still work; matching on a phrase would
 * quietly stop rendering the day somebody fixed a typo.
 */
function RoomInviteBubble({
  message,
  mine,
  group,
  tail,
  card,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
  tail: boolean;
  /**
   * The designed card — node 225:3873 — composed in `components/layout` because
   * it reads the room, the topic vocabulary and the group's roster, and slices
   * never import each other.
   *
   * Absent on a surface that has not wired it: the bubble then falls back to
   * the plain sentence plus its Join button, which is a working invite rather
   * than a hole.
   */
  card?: React.ReactNode;
}) {
  const ref = message.deepLink?.ref;
  if (card) {
    // The card IS the bubble here: it carries its own 22px glass shell, so
    // wrapping it in the message shell would draw two panels round one object.
    return (
      <div className="flex max-w-[min(85%,480px)] flex-col gap-1">
        {card}
        <span className={cn("flex justify-end", mine ? "pr-1" : "pl-1")}>
          <BubbleMeta message={message} mine={mine} group={group} />
        </span>
      </div>
    );
  }
  return (
    <div className={cn("flex max-w-[min(85%,480px)] flex-col gap-2 p-3", bubbleShell(mine, tail))}>
      <div className="flex items-start gap-2.5">
        <p
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap break-words text-[14px] leading-5 tracking-[-0.006em]",
            mine ? "text-[#5A5A5A]" : "text-white"
          )}
        >
          {message.text ?? "Opened a gist room"}
        </p>
        <BubbleMeta message={message} mine={mine} group={group} />
      </div>
      {ref && (
        <Link
          href={housePath(ref)}
          className="ws-press flex h-9 items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
        >
          <IconMic className="h-4 w-4" />
          Join gist room
        </Link>
      )}
    </div>
  );
}

function MediaBubble({
  message,
  mine,
  group,
  tail,
  kind,
  quote,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
  tail: boolean;
  kind: "image" | "video";
  quote?: React.ReactNode;
}) {
  const url = message.mediaUrl as string;
  const ratio = mediaRatio(message.mediaWidth, message.mediaHeight);
  const caption = message.text?.trim();

  return (
    <div className={cn("w-[262px] max-w-[85%] p-1", bubbleShell(mine, tail))}>
      {quote && <div className="px-1 pb-1.5 pt-1">{quote}</div>}
      {/* The ratio lives on the wrapper so the box is reserved BEFORE the
          media loads — a bubble that resizes on decode shoves the whole river
          under the reader's eye. 4:3 is the fallback shape for an unmeasured
          attachment, never a crop. */}
      <div className="relative w-full" style={{ aspectRatio: String(ratio ?? 4 / 3) }}>
        {kind === "video" ? (
          <InlineVideo src={url} className="absolute inset-0 rounded-xl" />
        ) : (
          <MediaFrame backdrop={url} className="absolute inset-0 rounded-xl">
            {/*
              A plain <img>, never `next/image`. The host of an attachment is
              unknown at build time, and this component also renders whatever
              the service typed — `next/image` handed a video URL is a crash
              that has shipped from this repo twice.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element -- attachment hosts are unknown at build time */}
            <img
              src={url}
              alt={caption || "Attachment"}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </MediaFrame>
        )}
      </div>

      {caption && <BubbleText message={message} mine={mine} className="px-2 pt-2" />}

      {/* The design's footer strip: 8px of padding, pushed right. */}
      <div className="flex items-center justify-end p-2">
        <BubbleMeta message={message} mine={mine} group={group} />
      </div>
    </div>
  );
}

/**
 * A voice note.
 *
 * The play control is REAL — it drives an `<audio>` element and the bars fill
 * to its actual `currentTime`. The bars themselves are not: the payload
 * carries a duration and nothing else, so their heights are a stable shape
 * hashed from the message id. See `lib/waveform.ts` for why that is the honest
 * choice rather than decoding every note in the thread to draw a picture
 * nobody acts on.
 *
 * The design draws the play disc in #7E3BEB on a white bubble. On an INCOMING
 * note the bubble is already #7E3BEB, so the disc inverts to white with a
 * purple glyph — the design only draws the outgoing case, and a purple disc on
 * a purple bubble is not a disc.
 */
function VoiceBubble({
  message,
  mine,
  group,
  tail,
  quote,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
  tail: boolean;
  quote?: React.ReactNode;
}) {
  const url = message.mediaUrl as string;
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // The service's duration wins; the element's is the fallback for a payload
  // that did not measure the file.
  const [decoded, setDecoded] = useState<number | null>(null);
  const duration = message.mediaDurationSeconds ?? decoded;

  const bars = waveformBars(message.id);
  const lit = playedBars(bars.length, playProgress(elapsed, duration));

  const toggle = () => {
    const node = audio.current;
    if (!node) return;
    if (node.paused) void node.play().catch(() => setPlaying(false));
    else node.pause();
  };

  // A note that is still running when the reader opens another conversation
  // would go on talking over the next thread, so playback is stopped on
  // unmount rather than left to garbage collection.
  useEffect(() => {
    const node = audio.current;
    return () => node?.pause();
  }, []);

  return (
    <div className={cn("flex w-[262px] max-w-[85%] flex-col gap-2 p-3", bubbleShell(mine, tail))}>
      {quote}
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setElapsed(0);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDecoded(value);
        }}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause voice note" : "Play voice note"}
          aria-pressed={playing}
          className={cn(
            "ws-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90",
            mine ? "bg-spotlight text-white" : "bg-white text-spotlight"
          )}
        >
          {playing ? (
            <IconPause className="h-4 w-4" />
          ) : (
            // Solid rather than the house outline: a 16px hollow triangle
            // inside a 32px disc reads as a ring, not as a play control.
            <IconPlay className="h-4 w-4 [&_path]:fill-current" />
          )}
        </button>

        {/* Full height of the row, 3px apart, as the design draws them. */}
        <div className="flex h-8 min-w-0 flex-1 items-center gap-[3px]" aria-hidden>
          {bars.map((height, index) => (
            <span
              key={index}
              style={{ height: `${Math.round(height * 100)}%` }}
              className={cn(
                "w-[2px] shrink-0 rounded-full",
                index < lit
                  ? mine
                    ? "bg-spotlight"
                    : "bg-white"
                  : mine
                    ? "bg-[#D8D8D8]"
                    : "bg-white/40"
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Empty for an unmeasured file — `00:00` under a note the reader can
            hear would be a lie about its length. */}
        <span
          className={cn(
            "tnum text-[12px] font-medium leading-4",
            mine ? "text-[#212121]" : "text-white"
          )}
        >
          {formatDuration(duration)}
        </span>
        <BubbleMeta message={message} mine={mine} group={group} />
      </div>
    </div>
  );
}

/**
 * One row of the river: the bubble, and in a group the 24px sender avatar
 * beside an incoming one.
 *
 * The avatar is bottom-aligned against the bubble and carries NO name — the
 * group node draws the face alone, which is the compact form every group chat
 * uses once the same handful of people are talking.
 *
 * `sender` may be null. The summary's roster is capped at four and the full
 * one is a separate request, so a message from the fifth member renders the
 * seeded fallback avatar rather than nothing: `Avatar` derives a stable
 * mascot from the sender id, which is real identity (the same id always gets
 * the same face) rather than an invented name.
 */
function MessageRow({
  message,
  mine,
  group,
  sender,
  roomCardSlot,
  onReply,
  onJump,
  nameOf,
  flash,
}: {
  message: Message;
  mine: boolean;
  group: boolean;
  sender: Profile | null;
  roomCardSlot?: (streamId: string) => React.ReactNode;
  /** Make this message the composer's reply target. */
  onReply: (message: Message) => void;
  /** Scroll to a loaded message and flash it. */
  onJump: (messageId: string) => void;
  /** A sender id as a name — "You" for the reader. */
  nameOf: (senderId: string) => string;
  /** Briefly true after a quote tap landed here. */
  flash: boolean;
}) {
  const kind = messageMediaKind(message);
  const removed = message.status === "removed";
  const tail = group && !mine;

  /*
    LONG-PRESS reveals the reply control on a touch screen, where there is no
    hover. 450ms is between a tap and the OS's own context menu; a finger that
    moves is scrolling, not pressing, and cancels it. The control stays out
    for a few seconds, long enough to tap, then goes back — it is the same
    control hover shows on a desktop, not a second affordance.
  */
  const [revealed, setRevealed] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
    pressAt.current = null;
  };
  // A held finger drifts a few pixels; only real movement (a scroll) cancels.
  const movePress = (event: React.PointerEvent) => {
    const from = pressAt.current;
    if (!from) return;
    if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10) cancelPress();
  };
  /*
    SWIPE RIGHT TO REPLY — the gesture people already have in their hands.

    Replying on a phone was otherwise a two-step move nobody would guess:
    hold for 450ms, wait for a 28px disc, hit it. That disc is hidden on touch
    the rest of the time, so there was effectively no reply from a phone
    unless you already knew the trick. The long-press still works; this is the
    one-motion version beside it.

    A drag is only claimed once it is CLEARLY horizontal (see lib/swipe-reply),
    because the thread's main gesture is scrolling and a finger travelling up
    always drifts sideways. Claiming that drift would make the thread feel
    stuck — much worse than a reply that needs a second try. `touch-pan-y` on
    the row leaves vertical scrolling to the browser and takes only the
    horizontal axis.
  */
  const [dragX, setDragX] = useState(0);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const startDrag = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" || removed) return;
    dragFrom.current = { x: event.clientX, y: event.clientY };
    dragging.current = false;
  };
  const moveDrag = (event: React.PointerEvent) => {
    const from = dragFrom.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!isReplySwipe(dx, dy)) return;
    dragging.current = true;
    setDragX(swipeOffset(dx));
  };
  const endDrag = (event: React.PointerEvent) => {
    const from = dragFrom.current;
    if (from && dragging.current) {
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      // Committed on RELEASE, never mid-drag: a reply that fired under a
      // moving finger would be one nobody chose to send.
      if (swipeCommits(dx, dy)) onReply(message);
    }
    dragFrom.current = null;
    dragging.current = false;
    setDragX(0);
  };

  const startPress = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse" || removed) return;
    cancelPress();
    pressAt.current = { x: event.clientX, y: event.clientY };
    press.current = setTimeout(() => {
      press.current = null;
      setRevealed(true);
      if (hide.current) clearTimeout(hide.current);
      hide.current = setTimeout(() => setRevealed(false), 4_000);
    }, 450);
  };
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current);
      if (hide.current) clearTimeout(hide.current);
    },
    []
  );

  const quote = message.replyTo ? (
    <ReplyQuote
      replyTo={message.replyTo}
      mine={mine}
      name={nameOf(message.replyTo.senderId)}
      onJump={onJump}
    />
  ) : undefined;

  // A removed message keeps its row but loses its attachment along with its
  // body — the whole point of the state is that the content is gone.
  // A removed announcement loses its card with its body — the state means the
  // content is gone, and a live Join button on a removed message would be the
  // one thing that still worked.
  const invite = !removed && message.deepLink?.kind === "stream";

  const content =
    invite ? (
      <RoomInviteBubble
        message={message}
        mine={mine}
        group={group}
        tail={tail}
        card={roomCardSlot?.(message.deepLink!.ref)}
      />
    ) : removed || !kind ? (
      <TextBubble message={message} mine={mine} group={group} tail={tail} quote={quote} />
    ) : kind === "audio" ? (
      <VoiceBubble message={message} mine={mine} group={group} tail={tail} quote={quote} />
    ) : (
      <MediaBubble message={message} mine={mine} group={group} tail={tail} kind={kind} quote={quote} />
    );

  return (
    <div
      data-message-id={message.id}
      onPointerDown={(event) => {
        startPress(event);
        startDrag(event);
      }}
      onPointerUp={(event) => {
        cancelPress();
        endDrag(event);
      }}
      onPointerCancel={(event) => {
        cancelPress();
        endDrag(event);
      }}
      onPointerMove={(event) => {
        movePress(event);
        moveDrag(event);
      }}
      style={{ transform: dragX ? `translateX(${dragX}px)` : undefined }}
      onContextMenu={(event) => {
        // A long-press that reached the OS menu is the one gesture we mean.
        if (revealed) event.preventDefault();
      }}
      className={cn(
        "group relative flex touch-pan-y items-end gap-2 rounded-2xl transition-colors duration-700",
        // No transition WHILE dragging or the row lags the finger; springing
        // back afterwards is the part that should be animated.
        !dragX && "transition-transform",
        mine ? "justify-end" : "justify-start",
        // The flash after a quote tap: a wash on the whole row, which is the
        // one thing that reads the same behind a white and a purple bubble.
        flash && "-mx-2 bg-white/[0.08] px-2 duration-150"
      )}
    >
      {/* The glyph WhatsApp shows while you pull: it sits just off the row's
          left edge and rides in as the row travels, so it is revealed by the
          drag rather than drawn on top of it. It fades in across the trigger
          distance, which makes the fade itself the signal that letting go now
          will reply. `aria-hidden` — the reply is announced by the control it
          leads to, and a screen-reader user is not dragging anything. */}
      {dragX > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white"
          style={{ opacity: Math.min(1, dragX / SWIPE_TRIGGER) }}
        >
          <IconQuote className="h-3.5 w-3.5" />
        </span>
      )}
      {group && !mine && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[25%] border-[0.63px] border-white/20 bg-white/10">
          <Avatar
            name={sender?.displayName ?? "?"}
            seed={sender?.id ?? message.senderId}
            src={sender?.avatarUrl}
            size={24}
          />
        </span>
      )}
      {content}
      {/* A removed message has nothing to answer. The announcement bubble is
          the service's, and answering it is answering nobody. */}
      {!removed && !invite && (
        <ReplyButton mine={mine} revealed={revealed} onClick={() => onReply(message)} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   COMPOSER
   ──────────────────────────────────────────────────────────────────────────── */

function Composer({
  conversationId,
  replyTo,
  onCancelReply,
  replyName,
  members,
  meId,
}: {
  conversationId: string;
  /** The message being answered, chosen from a bubble; null for a plain send. */
  replyTo: Message | null;
  onCancelReply: () => void;
  /** Who wrote `replyTo` — "You" for the reader's own. */
  replyName: string;
  /** Everyone in this conversation — the only people the picker may offer. */
  members: MentionableMember[];
  meId: string | undefined;
}) {
  const send = useSendMessage(conversationId);
  const field = useRef<HTMLTextAreaElement>(null);
  /*
    THE TEXT AND THE @-MENTION MACHINERY live in the shared hook the post
    composer and the comment boxes use: "@" opens the list at the caret, a
    pick writes "@handle " and keeps the Mention object to send. The list is
    narrowed to MEMBERS of this conversation — the server's rows that are in
    the roster, plus roster matches the server's top-8 missed — so on a 1:1
    the only person offered is the other party. `mentionCandidates` is pure
    and pinned in `lib/mentionable-members.test.ts`.
  */
  const typing = useMentionTyping({
    max: MESSAGE_MAX,
    field,
    candidates: (found, query) => mentionCandidates({ found, members, query, exclude: meId }),
  });
  const { text } = typing;
  const [picking, setPicking] = useState(false);
  // The uploaded-but-not-yet-sent attachment. It is already IN storage by the
  // time it lands here — the panel finishes the upload before it closes — so
  // this holds a URL the service will accept, not a File still to be pushed.
  const [attachment, setAttachment] = useState<
    { result: UploadResult; measured: Measured } | null
  >(null);
  const voice = useVoiceRecorder();
  const [voiceBusy, setVoiceBusy] = useState(false);
  const body = text.trim();
  // A tap on Reply is a tap that wants to type.
  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);
  // Either half is enough. A photo with no caption is a message; so is a
  // caption with no photo. Only neither is nothing to send — and that rule is
  // the payload builder's, so the button and the request cannot disagree about
  // what counts as empty. The reply target and the mentions ride along: the
  // target as its id, the mentions filtered to whoever is still WRITTEN in the
  // body (`mentionsPresentIn`), since a handle can be deleted after a pick.
  const outgoing: OutgoingMessage = {
    ...(body ? { text: body } : {}),
    ...(replyTo ? { replyToId: replyTo.id } : {}),
    ...(body ? { mentions: typing.mentionsFor(body) } : {}),
    ...(attachment
      ? {
          media: {
            url: attachment.result.url,
            width: attachment.measured.width ?? null,
            height: attachment.measured.height ?? null,
            durationSeconds: attachment.measured.durationSeconds ?? null,
          },
        }
      : {}),
  };
  const canSend = canSendMessage(outgoing) && !send.isPending;

  /**
   * Stop recording, upload, and stage the result like any other attachment.
   *
   * It becomes a pending attachment rather than sending itself: a voice note
   * that posted the instant you stopped talking gives you no way to hear it
   * back or change your mind, and the duration measured here rides along so
   * nothing has to demux the file to draw the waveform's length.
   */
  const finishVoice = async () => {
    const result = await voice.stop();
    if (!result) return;
    setVoiceBusy(true);
    try {
      // "attachment" is what admits audio at all — see the note in
      // AttachmentPanel. Without it a recorded voice note is rejected by our
      // own uploader before it reaches the service.
      const uploaded = await uploadFile(result.file, undefined, "attachment");
      setAttachment({
        result: uploaded,
        measured: { durationSeconds: result.durationSeconds },
      });
    } finally {
      setVoiceBusy(false);
    }
  };

  const submit = () => {
    if (!canSend) return;
    send.mutate(outgoing, {
      onSuccess: () => {
        typing.reset();
        setAttachment(null);
        onCancelReply();
      },
    });
  };

  const replyLine = replyTo
    ? replyExcerpt({
        text: replyTo.text,
        media: replyTo.media ? { kind: replyTo.media.kind } : null,
        deleted: replyTo.status === "removed",
      })
    : "";

  return (
    // Pinned, not sticky, for the same reason as the header: it is the last
    // fixed row of the pane's flex column, so it sits still while the messages
    // scroll behind it. The design's 3% white is flattened to an opaque value
    // over the app's ground — a translucent bar would show the river sliding
    // through the composer. The hairline above is the design's 10%.
    /* Node 75:8147 — `white/3` OVER the ground, not `#080808`. A near-black of
       its own put a third black in the pane; a 3% wash lifts the bar off the
       ground it shares with everything else. */
    <div className="flex min-h-20 shrink-0 flex-col justify-center gap-1 border-t border-white/10 bg-white/[0.03] px-6 py-4">
      {/*
        "Replying to …", above the field, in the attachment chip's recipe so
        the two stack as one family when both are up. The name, one line of
        the original (or "Photo" / "Voice note"), and an × — Escape in the
        field clears it too. The text is NOT prefilled with "@handle": the
        service records who was answered from `replyToId`, and the bubble
        draws the quote from `replyTo`, so a typed handle would print twice.
      */}
      {replyTo && (
        <div
          role="status"
          className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 border-l-2 border-l-spotlight-chip-ink bg-white/[0.04] py-2 pl-3 pr-2"
        >
          <IconQuote className="h-3.5 w-3.5 shrink-0 text-spotlight-chip-ink" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold leading-4 text-white">
              Replying to {replyName}
            </p>
            {replyLine && (
              <p
                className={cn(
                  "truncate text-[12px] leading-4 text-white/60",
                  replyTo.status === "removed" && "italic"
                )}
              >
                {replyLine}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ws-press flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/*
        The staged attachment, above the field.

        It is drawn BEFORE sending because the upload has already happened: the
        alternative — attach and send in one gesture — spends the user's
        bandwidth on a file they have not confirmed and gives them nothing to
        undo. Removing it here only drops our reference; the stored object is
        the service's to reap, and re-picking is cheap.
      */}
      {attachment && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          {/* A thumbnail ONLY for something that is actually a picture. An
              unknown kind gets the neutral chip, never an <img> pointed at a
              file the browser cannot decode. */}
          {attachment.result.kind === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element -- attachment hosts are unknown at build time */
            <img
              src={attachment.result.url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-semibold uppercase text-white/70"
            >
              {attachment.result.kind === "video"
                ? "MP4"
                : attachment.result.kind === "audio"
                  ? "VOX"
                  : "FILE"}
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-[12px] text-white/70">
            {attachment.result.kind === "image"
              ? "Photo"
              : attachment.result.kind === "video"
                ? "Video"
                : attachment.result.kind === "audio"
                  ? "Voice note"
                  : "Attachment"}{" "}
            <span className="text-white/40">{formatBytes(attachment.result.bytes)}</span>
          </p>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="ws-press shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}

      {voice.recording && (
        /*
          WHAT THE MICROPHONE IS HEARING, WHILE YOU TALK.

          This was a pulsing dot, a clock and two text buttons. All of it
          animated exactly the same whether the microphone was picking you up
          or muted, so the only question a person has while recording — "is
          this getting me?" — went unanswered until playback (ogazboiz: "the ux
          experince is bad").

          The bars are MEASURED, not decorative. They share the geometry of the
          playback bars (34, floor 0.25) so a note being recorded and the same
          note played back read as one object — but the playback bars are
          hashed from the message id and say so in capitals, while these come
          from the analyser. Drawing a hashed waveform here would dance
          identically over a muted microphone, which is worse than the dot it
          replaces: it looks like feedback and is not.

          It sits ABOVE the composer row, so the draft and any attachment stay
          visible while you talk.
        */
        <div className="mb-2 flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
          {/* The playback bubble's own bars, to the pixel: h-8, 3px apart,
              2px wide, rounded. A note being recorded and the same note played
              back are then visibly one object. The row GROWS from the left as
              you speak rather than sitting pre-filled — it starts when you
              start, so the first bar appearing is itself the confirmation
              that the microphone opened. */}
          <span aria-hidden className="flex h-8 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
            {voice.levels.map((level, index) => (
              <span
                key={index}
                className="w-[2px] shrink-0 rounded-full bg-white/60"
                style={{ height: `${Math.round(dotScale(level) * 100)}%` }}
              />
            ))}
          </span>

          {/* The clock is the accessible statement; the bars are decoration to
              a screen reader, which cannot see them move. */}
          <span className="tnum shrink-0 text-[12px] text-white/60" role="status">
            {formatElapsed(voice.elapsed)}
          </span>

          {/* Stop and discard. A square, because that is what a stop control
              is everywhere else, and NOT styled as the primary action — the
              destructive one should never be the easiest to hit. */}
          <button
            type="button"
            onClick={voice.cancel}
            aria-label="Stop and discard recording"
            className="ws-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/15"
          >
            <span aria-hidden className="h-3 w-3 rounded-[2px] bg-current" />
          </button>

          {/* Send. The violet ramp, as every other primary action on Square. */}
          <button
            type="button"
            onClick={() => void finishVoice()}
            aria-label="Send voice note"
            className="ws-btn-create ws-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path
                d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {voice.error && (
        <p role="alert" className="mb-2 text-[12px] text-down">
          {voice.error}
        </p>
      )}

      <div className="flex items-center gap-4">
        {/*
          ATTACHMENT IS LIVE. It was inert while `POST /conversations/:id/
          messages` took `{ text }` alone and nothing documented how a message
          with media was SENT — wiring it to an invented body would have been
          guessing at a request shape. The service now documents `media.url`,
          takes a URL from its OWN upload path, and derives the kind from the
          stored object, so this is the flow it describes: upload through
          `/uploads/*`, then send the `publicUrl` it answers with.

          VOICE IS LIVE TOO. The endpoint accepts audio, and `useVoiceRecorder`
          is the recorder that was missing — it picks a format the browser can
          encode AND the service will accept before it ever opens the
          microphone, so nobody records a message that cannot be sent.
        */}
        <CircleButton
          label="Attach a file"
          size={24}
          onClick={() => setPicking(true)}
          icon={<Image src="/messages/attach.svg" alt="" width={24} height={24} />}
        />
        <CircleButton
          label={voice.recording ? "Stop recording" : "Record a voice note"}
          size={24}
          disabled={voiceBusy}
          onClick={() => {
            if (voiceBusy) return;
            if (voice.recording) void finishVoice();
            else void voice.start();
          }}
          icon={
            voiceBusy ? (
              <Spinner className="h-5 w-5 text-white" />
            ) : (
              <Image
                src="/messages/voice.svg"
                alt=""
                width={24}
                height={24}
                className={voice.recording ? "opacity-100" : undefined}
              />
            )
          }
        />

        <label className="sr-only" htmlFor="message-composer">
          Write a message
        </label>
        {/* The design draws this pill at a fixed 40 tall with 16px padding all
            round, which does not fit inside 40. Read as a 16px horizontal
            inset on a 40px row with its content centred. It grows past 40 on a
            multi-line draft, which the design has no state for — losing
            shift+enter to keep the pill rigid would be the worse trade. */}
        <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[30px] border border-[#26262B] bg-[#18181C] px-4 py-2">
          <textarea
            id="message-composer"
            ref={field}
            value={text}
            rows={1}
            // The hook caps at MESSAGE_MAX — the service rejects anything
            // longer, so the field stops there too — and reads the caret for
            // an @-token.
            onChange={(event) => typing.update(event.target.value, event.target.selectionStart)}
            onKeyDown={(event) => {
              // With the list open, Enter is not a send (the same rule the
              // comment box follows); Escape closes the list first, and a
              // second Escape clears the reply target.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!typing.token) submit();
              }
              if (event.key === "Escape") {
                if (typing.token) {
                  event.preventDefault();
                  typing.dismiss();
                } else if (replyTo) {
                  event.preventDefault();
                  onCancelReply();
                }
              }
            }}
            placeholder={
              attachment ? "Add a caption…" : replyTo ? "Write a reply…" : "Write a message…"
            }
            // The design's caret is #008CFF — the one place in this pane a
            // colour is specified for something the house has no token for.
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent text-base leading-5 text-white caret-[#008CFF] outline-none placeholder:text-meta"
          />
          {/* Decoration, not a control — there is no emoji picker on this
              surface, and the live-stream composer draws the same glyph the
              same way. The design's 20px export, since the house `IconEmoji`
              is a plain smiley and this one carries a plus. */}
          <span aria-hidden className="shrink-0">
            <Image src="/messages/emoji.svg" alt="" width={20} height={20} />
          </span>
        </div>

        <CircleButton
          label="Send message"
          variant="send"
          size={16}
          onClick={submit}
          disabled={!canSend}
          icon={
            send.isPending ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              <Image src="/messages/send.svg" alt="" width={16} height={16} />
            )
          }
        />
      </div>

      {text.length > MESSAGE_MAX - 200 && (
        <p className="tnum text-right text-[11px] text-meta">{MESSAGE_MAX - text.length} left</p>
      )}

      {/* The shared list, portalled above the field, only while an @-token is
          open under the caret. Its rows are this conversation's members. */}
      {typing.token && (
        <MentionPicker typing={typing} heading="Members" emptyLabel="Nobody in this chat matches." />
      )}

      {/* Mounted only while open, so each opening starts from clean state —
          see the note in the panel. */}
      {picking && (
        <AttachmentPanel
          open
          onClose={() => setPicking(false)}
          onAttached={(result, measured) => setAttachment({ result, measured })}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   THE PANE
   ──────────────────────────────────────────────────────────────────────────── */

export function Thread({
  conversation,
  onBack,
  /** Opens the gist-room composer. Supplied by the layout, which owns it. */
  onCreateGistRoom,
  /**
   * The designed invite card for a gist-room announcement (node 225:3873).
   * Supplied by the layout, which is the one place allowed to read the room,
   * the topic vocabulary and this group's roster at once.
   */
  roomCardSlot,
  safetyRowsSlot,
  onAddMembers,
}: {
  conversation: Conversation;
  onBack: () => void;
  onCreateGistRoom?: () => void;
  roomCardSlot?: (streamId: string) => React.ReactNode;
  /**
   * Block and Report for a 1:1 — the profile slice's actions, drawn as this
   * menu's own rows. A slot, because slices never import each other.
   */
  safetyRowsSlot?: (peer: Profile) => React.ReactNode;
  /** Opens the people picker for "Add / Invite gist partners". */
  onAddMembers?: () => void;
}) {
  const me = useMe();
  const group = isGroupThread(conversation);
  const messages = useMessages(conversation.id, true);
  const markRead = useMarkConversationRead();
  const reducedMotion = useReducedMotion();
  const [membersOpen, setMembersOpen] = useState(false);
  /*
    THE REPLY TARGET, keyed by conversation rather than reset in an effect:
    a target chosen in one thread must not survive into the next, and
    deriving it from the id does that without a `setState` inside an effect.
  */
  const [replyState, setReplyState] = useState<{ conversationId: string; message: Message } | null>(null);
  const replyTo = replyState?.conversationId === conversation.id ? replyState.message : null;
  const setReplyTo = (message: Message | null) =>
    setReplyState(message ? { conversationId: conversation.id, message } : null);
  /* The row a quote tap just landed on, washed for a moment. */
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeChat = useDeleteConversation();
  const rename = useRenameGroup(conversation.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const leave = useLeaveGroup(conversation.id);

  /*
    "Share invite link" — mints an invite and opens the share sheet a post uses,
    so a house can be sent to somebody who is not in it yet. The link lands on
    `/join/<token>`. Offered to whoever the service lets make one: any member
    of a public house, only the owner of a private one (`canMakeInvite`).
  */
  const makeInvite = useCreateInvite();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const shareInvite = () =>
    makeInvite.mutate(conversation.id, {
      onSuccess: (invite) => setInviteLink(inviteUrl(window.location.origin, invite.token)),
    });

  // The roster, for turning a bubble's `senderId` into a face. Groups only —
  // a 1:1 reads identity from `peer` and never issues the request.
  const members = useConversationMembers(conversation.id, group);
  /*
    YOUR ROLE IN THE HOUSE comes from the roster: owner, admin or member.
    `createdBy` only says who MADE the house — ownership can be handed over,
    and passes on when an owner leaves — so it stands in only until the roster
    has loaded.
  */
  const myRole = viewerRole(members.data?.items, me.data?.id, conversation.createdBy);
  const isOwner = myRole === "owner";
  const manages = myRole === "owner" || myRole === "admin";
  const canShareInvite = group && canMakeInvite({ visibility: conversation.visibility, manages });
  const senders = new Map<string, Profile>();
  // The summary's capped preview first, so avatars are right for the four most
  // recent talkers before the full roster arrives; the full list overwrites it.
  for (const profile of conversation.members) senders.set(profile.id, profile);
  for (const row of members.data?.items ?? []) {
    if (row.profile) senders.set(row.profile.id, row.profile);
  }
  // A 1:1 has no roster request; its two people are the reader and the peer.
  if (!group && conversation.peer) senders.set(conversation.peer.id, conversation.peer);

  /** A sender id as the name a quote or the reply strip prints. */
  const nameOf = (senderId: string): string => {
    if (me.data && senderId === me.data.id) return "You";
    return senders.get(senderId)?.displayName ?? "Member";
  };
  /** Who the composer may @-mention: everyone here but the reader. */
  const mentionable: MentionableMember[] = [...senders.values()].map((profile) => ({
    id: profile.id,
    displayName: profile.displayName,
    username: profile.username,
  }));

  // Opening the thread is the acknowledgement — once per thread, not on every
  // poll tick.
  const acknowledged = useRef<string | null>(null);
  useEffect(() => {
    if (acknowledged.current === conversation.id) return;
    acknowledged.current = conversation.id;
    if (conversation.unreadCount > 0) markRead.mutate(conversation.id);
  }, [conversation.id, conversation.unreadCount, markRead]);

  // The service returns newest-first; a thread reads oldest-first.
  const items = [...(messages.data?.items ?? [])].reverse();
  const days = groupMessagesByDay(items);

  // Only the messages scroll. The header and the composer are fixed rows of
  // this column, so the reader's eye keeps both while the river moves between
  // them — which is what every messaging app does and what page-level
  // scrolling with sticky bands only approximates.
  const river = useRef<HTMLDivElement>(null);
  // Whether the reader is at the live edge and should be carried along by new
  // messages. A ref, not state: it changes on every scroll frame and nothing
  // renders from it.
  const following = useRef(true);

  const toBottom = () => {
    const node = river.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  // Opening a conversation lands on its newest message, never at the top of
  // its history.
  useEffect(() => {
    following.current = true;
    toBottom();
  }, [conversation.id]);

  /**
   * A tap on a quote: scroll the original into the middle of the river and
   * wash its row for a moment. Only when it is LOADED — the thread pages 50 at
   * a time and an original past that has no row to land on, so the tap does
   * nothing rather than jumping somewhere wrong.
   */
  const jumpTo = (messageId: string) => {
    const node = river.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"]`
    );
    if (!node) return;
    following.current = false;
    node.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    setFlashId(messageId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1_400);
  };

  // Follow arriving messages, but only from the live edge — someone scrolled
  // up reading yesterday must not be yanked down because a message landed.
  useEffect(() => {
    if (following.current) toBottom();
  }, [items.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreadHeader
        conversation={conversation}
        onBack={onBack}
        onCreateGistRoom={onCreateGistRoom}
        menu={
          <ThreadMenu
            kind={group ? "group" : "direct"}
            // The service lets only the group's creator rename it, and
            // `createdBy` is the field that says who that is. A member sees the
            // shorter menu (78:8337), which is not a degraded version of the
            // owner's — it is the correct one for what they may do.
            /*
              OWNERSHIP IS ON THE CONVERSATION NOW.

              `ConversationSummary` carries `createdBy`, so the menu is right on
              the first render. It used to be inferred from `role === "owner"`
              on the roster, which meant a second request had to land before the
              owner saw the owner's menu — the roster is still read for sender
              avatars, and is kept here only as the fallback for a payload that
              predates the field.
            */
            isOwner={isOwner}
            canEdit={manages}
            safetyRows={
              !group && conversation.peer ? safetyRowsSlot?.(conversation.peer) : undefined
            }
            actions={{
              onAddMembers,
              onViewMembers: () => setMembersOpen(true),
              onShareInvite: canShareInvite ? shareInvite : undefined,
              onRenameGroup: () => setSettingsOpen(true),
              onLeaveGroup: me.data ? () => setLeaving(true) : undefined,
              onDeleteChat: () => setDeleting(true),
            }}
          />
        }
      />

      {inviteLink && (
        <ShareSheet
          open
          onClose={() => setInviteLink(null)}
          title="Share invite link"
          payload={{ text: `Join ${conversation.title ?? "my house"} on Square`, url: inviteLink }}
          campaign="house_invite"
        />
      )}

      {/* 40px from the header to the first separator is the design's (header
          80, first label at y=120). The gap below is ours — its day sections
          are absolutely placed, so it has no measurable bottom, and 24 is the
          pane's own rhythm.

          `min-h-0` because a flex child's default minimum is its CONTENT, so
          without it this grows to fit the whole thread and the pane scrolls as
          a page again instead of scrolling here. */}
      <div
        ref={river}
        onScroll={(event) => {
          following.current = isAtBottom(event.currentTarget);
        }}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-10"
      >
        {messages.isPending && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
        {messages.isError && (
          <ErrorState
            error={messages.error}
            fallback="Couldn't load this conversation."
            onRetry={() => messages.refetch()}
          />
        )}
        {messages.isSuccess && items.length === 0 && (
          <ThreadWelcome conversation={conversation} group={group} />
        )}

        {days.map((day) => (
          // 24 between the separator and the first run, and between runs.
          <section key={day.key} className="flex flex-col gap-6">
            {day.label && (
              <p className="text-center text-[16px] font-medium leading-6 text-white/60">
                {day.label}
              </p>
            )}

            {/* A RUN is consecutive messages from one sender, and the reason
                the rhythm is two numbers rather than one: 16 inside a run, 24
                between runs and under the separator. Both nodes lay the river
                out that way, and it is what makes a burst of three read as one
                turn in the conversation. */}
            {groupBySender(day.messages).map((run) => (
              <div key={run.key} className="flex flex-col gap-4">
                {run.messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    mine={Boolean(me.data && message.senderId === me.data.id)}
                    group={group}
                    sender={senders.get(message.senderId) ?? null}
                    roomCardSlot={roomCardSlot}
                    onReply={setReplyTo}
                    onJump={jumpTo}
                    nameOf={nameOf}
                    flash={flashId === message.id}
                  />
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>

      <Composer
        conversationId={conversation.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        replyName={replyTo ? nameOf(replyTo.senderId) : ""}
        members={mentionable}
        meId={me.data?.id}
      />

      {group && (
        <MembersSheet
          conversation={conversation}
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          meId={me.data?.id}
          myRole={myRole}
        />
      )}

      {/* EVERY FIELD CREATING A GROUP ASKS FOR, editable afterwards — name,
          description, picture and visibility. It used to be the title alone,
          so a group could be created public and never changed, or described
          once and never again (ogazboiz: "inside a group there is suppose to
          be a place where we can edit this settings"). */}
      <GroupSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        conversation={conversation}
      />

      {/* "Edit group title" — `PATCH /conversations/:id { title }`, owner only,
          which the service enforces. 80 characters is the contract's cap, so
          the field stops there rather than letting the request be rejected. */}
      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Edit group title">
        <RenameGroupForm
          current={conversation.title ?? ""}
          busy={rename.isPending}
          onSubmit={(title) =>
            rename.mutate(title, { onSuccess: () => setRenaming(false) })
          }
        />
      </Sheet>

      {/*
        "Delete Chat" is DELETE FOR ME, and the copy says so.

        It is reversible — a new message brings the thread back — so nothing
        here says "this cannot be undone", which is what a delete dialog
        normally says and would be a lie. What it does say is the part people
        actually get wrong: the other person keeps everything.
      */}
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Remove this chat?">
        <p className="text-[13px] leading-5 text-body">
          It leaves your inbox and you stop seeing what was said before now.{" "}
          {conversation.peer?.displayName ?? "They"} keeps the whole conversation. If they
          message you again the chat comes back, carrying only what arrives after.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleting(false)}>
            Keep it
          </Button>
          <Button
            className="flex-1"
            loading={removeChat.isPending}
            onClick={() =>
              removeChat.mutate(conversation.id, {
                onSuccess: () => {
                  setDeleting(false);
                  onBack();
                },
              })
            }
          >
            Remove
          </Button>
        </div>
      </Sheet>

      {/* Leaving is not undoable from here — rejoining needs a member to add
          you back, or a public group's link — so it asks first. */}
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="Leave group?">
        <p className="text-[13px] leading-5 text-body">
          You will stop receiving messages from {conversation.title ?? "this group"}. A member
          can add you back.
          {isOwner &&
            " You own it, so it passes to its longest-standing admin, or to its longest-standing member if it has no admins."}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setLeaving(false)}>
            Stay
          </Button>
          <Button
            className="flex-1"
            loading={leave.isPending}
            onClick={() => {
              if (!me.data) return;
              leave.mutate(me.data.id, {
                onSuccess: () => {
                  setLeaving(false);
                  onBack();
                },
              });
            }}
          >
            Leave
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * The one field behind "Edit group title".
 *
 * Its own component so the input's draft state is created fresh on every
 * opening — the sheet is only mounted while open, so there is no stale value to
 * reset and no effect needed to reset it.
 */
function RenameGroupForm({
  current,
  busy,
  onSubmit,
}: {
  current: string;
  busy: boolean;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState(current);
  const valid = title.trim().length > 0 && title.trim() !== current.trim();
  return (
    <div>
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && valid && onSubmit(title)}
        maxLength={80}
        placeholder="Group title"
        className="ws-field w-full px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40"
      />
      <Button
        className="mt-4 w-full"
        disabled={!valid}
        loading={busy}
        onClick={() => onSubmit(title)}
      >
        Save
      </Button>
    </div>
  );
}

/**
 * A THREAD NOBODY HAS SPOKEN IN YET — node 76:8216.
 *
 * ─── WHY IT IS NOT `EmptyState` ──────────────────────────────────────────────
 * The shared component draws its contents inside `ws-inset` — a `black/35`
 * panel — so on a `#121214` pane it rendered as a darker slab with different
 * corners from everything around it: a second black in the middle of the
 * thread. The file draws NO panel. It is centred text on the pane's own ground
 * with one pill under it, which is why it reads as the room being empty rather
 * than as a card that failed to load.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A 352-wide column, centred, gap 16, holding a gap-8 column and then the
 * button:
 *
 *   · "Welcome!" at Roboto Bold 24/32 with 0.01em of tracking, `#FFFFFF`
 *   · the body at 16/24 centred in 50% white
 *   · `Say hello 👋` — 6px/16px of padding at a full round over `white/5`,
 *     the words at 80% white and the emoji at its own colour
 *
 * ─── WHAT THE BUTTON DOES ────────────────────────────────────────────────────
 * It SENDS the wave, rather than typing it into the composer for you to send
 * again. A control called "Say hello" that only fills a field is a control that
 * did not do the thing it named. It goes through `useSendMessage` — the same
 * hook and the same cache as the composer below, never a second send path — so
 * the message lands in the thread and the empty state disappears with it.
 *
 * ─── THE COPY IS THE FILE'S FOR A GROUP AND HONEST FOR A 1:1 ─────────────────
 * "Your house is created…" is written for a house somebody just made. A direct
 * chat was not created by anybody and has no members to invite, so it says the
 * one true thing instead.
 */
function ThreadWelcome({
  conversation,
  group,
}: {
  conversation: Conversation;
  group: boolean;
}) {
  const send = useSendMessage(conversation.id);
  const gate = useGate();
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex w-[352px] max-w-full flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[24px] font-bold leading-8 tracking-[0.01em] text-white">Welcome!</p>
          <p className="text-[16px] leading-6 text-white/50">
            {group
              ? "Your house is created. Start the conversation or invite new members to get things moving."
              : `Say hello to ${conversation.peer?.displayName ?? conversation.peer?.username ?? "them"} — nobody has said anything yet.`}
          </p>
        </div>
        <button
          type="button"
          disabled={send.isPending}
          onClick={() => gate(() => send.mutate({ text: "👋" }))}
          className="ws-press flex items-center gap-2.5 rounded-full bg-white/5 px-4 py-1.5 text-[16px] leading-6 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <span className="text-white/80">Say hello</span>
          <span aria-hidden>👋</span>
        </button>
      </div>
    </div>
  );
}

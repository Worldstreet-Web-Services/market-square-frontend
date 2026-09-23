"use client";

import { Toggle } from "@/components/ui/toggle";
import { SAVING_SOON } from "@/components/layout/settings-copy";

type ChatMessagesFrom = "no_one" | "everyone" | "verified";
/** Mirrors `messagesFrom`'s shape; `following` rather than `verified` — see
    the section below for why the middle option is a relationship, not a badge. */
export type AddToHousesFrom = "no_one" | "everyone" | "following";

export function ChatView({
  messagesFrom,
  onMessagesFromChange,
  allowHouseMembers,
  onAllowHouseMembersChange,
  allowPastAudience,
  onAllowPastAudienceChange,
  addToHousesFrom,
  onAddToHousesFromChange,
  disabled = false,
}: {
  messagesFrom: ChatMessagesFrom;
  onMessagesFromChange: (v: ChatMessagesFrom) => void;
  allowHouseMembers: boolean;
  onAllowHouseMembersChange: (v: boolean) => void;
  allowPastAudience: boolean;
  onAllowPastAudienceChange: (v: boolean) => void;
  /** Absent on a service that does not gate group adds yet — the section is
      then not drawn at all, because an unenforced promise is worse than none. */
  addToHousesFrom?: AddToHousesFrom;
  onAddToHousesFromChange?: (v: AddToHousesFrom) => void;
  /** The choices cannot be saved yet — see `settings-copy.ts`. */
  disabled?: boolean;
}) {
  return (
    <div>

      {/* Section: Messages from */}
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex h-6 items-center px-4">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">Messages from</p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">No one</p>
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={messagesFrom === "no_one"} onChange={() => onMessagesFromChange("no_one")} label="Messages from no one" />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">Everyone</p>
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={messagesFrom === "everyone"} onChange={() => onMessagesFromChange("everyone")} label="Messages from everyone" />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">Verified users</p>
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={messagesFrom === "verified"} onChange={() => onMessagesFromChange("verified")} label="Messages from verified users" />
          </div>
        </div>
      </div>

      {/*
        WHO CAN ADD YOU TO A HOUSE WITHOUT ASKING — the consent gate.

        THE HEADING CARRIES THE WHOLE MEANING, and it took a decision to get
        right. ogazboiz ruled that "No one" still lets a REQUEST through
        (2026-09-23) — somebody you have never met can still ask, and you
        decline it — which is the kinder setting, because a true "no one"
        would mean a friend could not invite you to their own house.

        But that makes "Who can add you to houses / No one" a lie: people CAN
        still reach you. The question the setting actually answers is who may
        skip the asking, so the heading says so, and "No one" then means
        exactly what it says — nobody adds you outright, everybody asks.

        Until this exists, `POST /conversations/:id/members` is summarised in
        the service's own spec as "Add people to a group (any member may)": any
        member of any house can add anybody, silently, and the person finds out
        because a house has appeared in their inbox (ogazboiz, 2026-09-23:
        "adding someone to a group without their approval is wrong").

        The middle option is people you FOLLOW, not verified users. Verified is
        a badge the platform grants — it says somebody is who they claim to be,
        not that you know them, and a verified stranger adding you to a house
        is exactly the thing being complained about.

        ABSENT UNTIL THE SERVICE SENDS IT. An option here that the service does
        not enforce would be worse than none: it would tell somebody they are
        protected while anybody could still add them.
      */}
      {addToHousesFrom !== undefined && onAddToHousesFromChange && (
        <div className="flex flex-col gap-2 pt-6">
          <div className="flex h-6 items-center px-4">
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              Who can add you to houses without asking
            </p>
          </div>
          <div className="flex flex-col">
            <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
              <p className="text-base font-bold leading-6 text-white">Everyone</p>
              <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={addToHousesFrom === "everyone"} onChange={() => onAddToHousesFromChange("everyone")} label="Anyone can add you to houses" />
            </div>
            <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
              <p className="text-base font-bold leading-6 text-white">People you follow</p>
              <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={addToHousesFrom === "following"} onChange={() => onAddToHousesFromChange("following")} label="Only people you follow can add you to houses" />
            </div>
            <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
              <p className="text-base font-bold leading-6 text-white">No one</p>
              <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={addToHousesFrom === "no_one"} onChange={() => onAddToHousesFromChange("no_one")} label="Nobody can add you to houses" />
            </div>
          </div>
          {/* Say what happens INSTEAD, so the choice does not read as "never
              hear from anybody about a house again". */}
          <p className="px-4 pt-2 text-[13px] leading-5 text-white/50">
            Everyone else has to ask. Their request waits in Gist Requests
            until you accept it, and nothing appears in your chats until you
            do.
          </p>
        </div>
      )}

      {/* Section: Allow messages from */}
      <div className="mt-10 flex flex-col gap-2">
        <div className="flex h-6 items-center px-4">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">Allow messages from</p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">My house members</p>
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={allowHouseMembers} onChange={onAllowHouseMembersChange} label="Allow messages from house members" />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">Past gistroom audience</p>
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={allowPastAudience} onChange={onAllowPastAudienceChange} label="Allow messages from past gistroom audience" />
          </div>
        </div>
      </div>
    </div>
  );
}

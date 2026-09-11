"use client";

import { Toggle } from "@/components/ui/toggle";
import { SAVING_SOON } from "@/components/layout/settings-copy";

type ChatMessagesFrom = "no-one" | "everyone" | "verified";

export function ChatView({
  messagesFrom,
  onMessagesFromChange,
  allowHouseMembers,
  onAllowHouseMembersChange,
  allowPastAudience,
  onAllowPastAudienceChange,
  disabled = false,
}: {
  messagesFrom: ChatMessagesFrom;
  onMessagesFromChange: (v: ChatMessagesFrom) => void;
  allowHouseMembers: boolean;
  onAllowHouseMembersChange: (v: boolean) => void;
  allowPastAudience: boolean;
  onAllowPastAudienceChange: (v: boolean) => void;
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
            <Toggle disabled={disabled} title={disabled ? SAVING_SOON : undefined} checked={messagesFrom === "no-one"} onChange={() => onMessagesFromChange("no-one")} label="Messages from no one" />
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

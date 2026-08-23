"use client";

import { useState } from "react";
import { errorCode } from "@/lib/api/envelope";
import type { Profile } from "@/lib/api/schemas";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { useUpdateMe } from "@/features/profile/hooks/use-profile";

const inputClass =
  "ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600";

export function EditProfileSheet({
  me,
  open,
  onClose,
}: {
  me: Profile;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateMe();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);

  const usernameTaken = errorCode(update.error) === "CONFLICT";

  return (
    <Sheet open={open} onClose={onClose} title="Edit profile">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={20}
            className={cn(inputClass, usernameTaken && "ws-invalid")}
          />
          {usernameTaken && <p className="mt-1 text-xs text-down">Username taken — try another.</p>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} className={inputClass} />
        </label>
        {update.isError && !usernameTaken && (
          <InlineError error={update.error} fallback="Couldn't save your profile." />
        )}
        <Button
          className="w-full"
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              {
                displayName: displayName.trim() || undefined,
                username: username.trim() !== me.username ? username.trim() : undefined,
                bio,
              },
              { onSuccess: onClose }
            )
          }
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}

// After first login an unclaimed (null) username triggers this claim sheet.
export function ClaimUsernameSheet({
  me,
  open,
  onClose,
  onClaimed,
}: {
  me: Profile;
  open: boolean;
  onClose: () => void;
  onClaimed?: (username: string) => void;
}) {
  const update = useUpdateMe();
  const [username, setUsername] = useState("");
  const usernameTaken = errorCode(update.error) === "CONFLICT";

  return (
    <Sheet open={open} onClose={onClose} title="Claim your username">
      <div className="space-y-4">
        <p className="text-sm text-grey-400">
          {me.usernameUnclaimed ? (
            <>Welcome to the square, {me.displayName}. Pick a name people can find you by.</>
          ) : (
            <>
              You&apos;re currently <span className="text-grey-200">@{me.username}</span>. Pick a
              name people can find you by.
            </>
          )}
        </p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          maxLength={20}
          placeholder="username"
          className={cn(inputClass, usernameTaken && "ws-invalid")}
        />
        {usernameTaken && <p className="text-xs text-down">Username taken — try another.</p>}
        {update.isError && !usernameTaken && (
          <InlineError error={update.error} fallback="Couldn't claim that username." />
        )}
        <Button
          className="w-full"
          disabled={username.trim().length < 3}
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              { username: username.trim() },
              {
                onSuccess: (updated) => {
                  onClose();
                  onClaimed?.(updated.username);
                },
              }
            )
          }
        >
          Claim @{username || "…"}
        </Button>
      </div>
    </Sheet>
  );
}

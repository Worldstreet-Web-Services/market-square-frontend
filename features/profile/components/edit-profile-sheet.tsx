"use client";

import { useState } from "react";
import { errorCode } from "@/lib/api/envelope";
import type { Profile } from "@/lib/api/schemas";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { UploadField } from "@/components/ui/upload-field";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatarUrl);
  /* Self-declared, all three, and all optional. `?? ""` because null is the
     real "hasn't said" and an input cannot hold it. */
  const [city, setCity] = useState(me.city ?? "");
  const [region, setRegion] = useState(me.region ?? "");
  const [gender, setGender] = useState(me.gender ?? "");

  const usernameTaken = errorCode(update.error) === "CONFLICT";

  return (
    <Sheet open={open} onClose={onClose} title="Edit profile">
      <div className="space-y-4">
        <UploadField value={avatarUrl} onChange={setAvatarUrl} circular label="Avatar" />
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

        {/*
          PLACE AND GENDER — the fields Explore's People filters match on.

          FREE TEXT, all three, and gender is a text box rather than a picker on
          purpose: a dropdown is a list of which identities exist, and that is
          not a decision to take in a component. The service folds case so
          self-declared answers stay comparable without anybody owning a
          vocabulary.

          NOT REQUIRED, and emptying one clears it. The note says who can see
          them, because a field that quietly becomes a filter other people
          search you by is consent nobody gave.
        */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-grey-400">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="Ikeja"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-grey-400">
              State or region
            </span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={80}
              placeholder="Lagos"
              className={inputClass}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Gender</span>
          <input
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            maxLength={40}
            placeholder="However you describe yourself"
            className={inputClass}
          />
        </label>
        <p className="text-xs leading-4 text-grey-500">
          Your place and gender are public, and they are what the People filters match on.
          Leave a field empty to remove it.
        </p>
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
                avatarUrl: avatarUrl ?? undefined,
                // Sent as typed, blank included: an omitted field means "leave
                // it" and somebody who emptied the box meant "clear it". The
                // service reads a blank string as a clear.
                city: city.trim(),
                region: region.trim(),
                gender: gender.trim(),
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

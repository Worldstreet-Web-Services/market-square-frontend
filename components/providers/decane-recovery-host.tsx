"use client";

import { useEffect, useState } from "react";
import {
  completeRecoveryRequest,
  useRecoveryRequest,
  type RecoveryRequest,
} from "@/lib/decane-recovery";

// Renders the wallet-recovery dialogs Decane's callbacks wait on (ported from
// wsws, same flows, Square's card): the
// new-password prompt after a rotation, the save-your-file step, and the
// restore-from-file prompt for a device with no share. Mounted once inside
// DecaneKit. The rotation dialogs are deliberately not dismissible: each
// resolves a promise the SDK is blocked on, and walking away from a rotation
// would strand the user with a dead recovery file.

const MIN_PASSWORD_LENGTH = 8;

const INPUT =
  "h-12 w-full rounded-[14px] border border-white/14 bg-white/5 px-4 text-[15px] text-white outline-none focus:border-white/30";
const PRIMARY =
  "h-12 w-full cursor-pointer rounded-[14px] bg-white text-[14.5px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50";
const SECONDARY =
  "h-12 w-full cursor-pointer rounded-[14px] border border-white/14 bg-white/8 text-[14.5px] font-medium text-white transition-colors hover:border-white/30";

function PasswordDialog({ request }: { request: Extract<RecoveryRequest, { kind: "rotated" }> }) {
  const [password, setPassword] = useState("");
  const [hint, setHint] = useState("");
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  const submit = () => {
    if (password.length < MIN_PASSWORD_LENGTH) return;
    request.resolve({ password, passwordHint: hint.trim() || undefined });
    completeRecoveryRequest(request);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[20px] font-bold text-white">Your recovery file was replaced</div>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-white/55">Recovering on this device issued a new recovery file and retired the old one. Set a password for the new file, then save it somewhere safe.</p>
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Recovery password (min 8 characters)"
        autoComplete="new-password"
        className={INPUT}
      />
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Password hint (optional)"
        className={INPUT}
      />
      {tooShort ? <p className="text-[13px] text-danger">Use at least 8 characters.</p> : null}
      <button onClick={submit} disabled={password.length < MIN_PASSWORD_LENGTH} className={PRIMARY}>
        Create recovery file
      </button>
    </div>
  );
}

function FileDialog({ request }: { request: Extract<RecoveryRequest, { kind: "file" }> }) {
  const [downloaded, setDownloaded] = useState(false);

  const download = () => {
    const blob = new Blob([JSON.stringify(request.file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = request.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const done = () => {
    request.resolve();
    completeRecoveryRequest(request);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[20px] font-bold text-white">Save your recovery file</div>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-white/55">Download the file and keep it somewhere safe, like a password manager. Anyone with this file AND its password can restore the wallet; without the password it is useless.</p>
      </div>
      <button onClick={download} className={PRIMARY}>
        Download file
      </button>
      <button onClick={done} disabled={!downloaded} className={SECONDARY}>
        I saved it
      </button>
    </div>
  );
}

// A new device with no passkey: the only way in is the recovery file the user
// saved. Cancelling is allowed here (unlike the rotation dialogs) and resolves
// null, which the kit surfaces as NewDeviceError on the sign-in screen.
function RestoreDialog({ request }: { request: Extract<RecoveryRequest, { kind: "restore" }> }) {
  const [file, setFile] = useState<{ name: string; value: unknown } | null>(null);
  const [password, setPassword] = useState("");
  const [unreadable, setUnreadable] = useState(false);

  const pick = async (picked: File | undefined) => {
    setUnreadable(false);
    if (!picked) return;
    try {
      setFile({ name: picked.name, value: JSON.parse(await picked.text()) });
    } catch {
      setFile(null);
      setUnreadable(true);
    }
  };

  const restore = () => {
    if (!file || !password) return;
    request.resolve({ value: file.value, getPassword: async () => password });
    completeRecoveryRequest(request);
  };

  const cancel = () => {
    request.resolve(null);
    completeRecoveryRequest(request);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[20px] font-bold text-white">Restore from your recovery file</div>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-white/55">{"This device has no copy of your wallet key and your passkey isn't here. Choose the recovery file you saved and enter its password. Restoring issues a new file; you'll be asked to save it next."}</p>
      </div>
      <label className={`${SECONDARY} grid cursor-pointer place-items-center truncate px-4`}>
        {file ? file.name : "Choose recovery file"}
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </label>
      {unreadable ? <p className="text-[13px] text-danger">{"That file isn't a readable recovery file."}</p> : null}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Recovery file password"
        autoComplete="current-password"
        className={INPUT}
      />
      <button onClick={restore} disabled={!file || !password} className={PRIMARY}>
        Restore wallet
      </button>
      <button onClick={cancel} className={SECONDARY}>
        Cancel
      </button>
    </div>
  );
}

const PIN_PATTERN = /^\d{4,8}$/;

// Mirrors the kit's MIN_PASSWORD_LENGTH; the kit re-checks and is the authority.
const MIN_UNLOCK_PASSWORD_LENGTH = 8;

/**
 * The PIN that wraps the device share when this device has no usable passkey.
 *
 * ─── WHAT IT IS CALLED, AND WHY ─────────────────────────────────────────────
 * It is a way back into Square on this device, and that is how it is named.
 * The wrapping is real and it is ours to worry about: somebody who came here
 * to post does not have a wallet in mind, and "a PIN protects your wallet"
 * reads as a chore attached to something they never asked for. A passkey is
 * offered separately, in the same words, on the sign-in surface.
 *
 * What cannot be softened is that it cannot be reset. A typo here wraps the
 * share with a value nobody knows, which is why it is asked for twice on setup
 * and said plainly. On unlock once is enough: a wrong entry simply fails.
 */
function PinDialog({ request }: { request: Extract<RecoveryRequest, { kind: "pin" }> }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const malformed = pin.length > 0 && !PIN_PATTERN.test(pin);
  const mismatched = request.setup && confirm.length > 0 && confirm !== pin;
  const ready = PIN_PATTERN.test(pin) && (!request.setup || confirm === pin);

  const submit = () => {
    if (!ready) return;
    request.resolve(pin);
    completeRecoveryRequest(request);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[19px] font-bold text-white">
          {request.setup ? "Set a PIN for this device" : "Enter your PIN"}
        </div>
        <p className="mt-1.5 text-[13.5px] font-normal text-white/55">
          {request.setup ? "This device can't use a passkey right now, so a PIN gets you back in here instead. 4–8 digits, kept on this device and never sent anywhere. It can't be reset, so pick one you'll remember." : "The PIN you set on this device."}
        </p>
      </div>

      <input
        className={INPUT}
        type="password"
        inputMode="numeric"
        autoComplete={request.setup ? "new-password" : "current-password"}
        maxLength={8}
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />

      {request.setup ? (
        <input
          className={INPUT}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          placeholder="Confirm PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      ) : null}

      {malformed ? (
        <p className="text-[12.5px] font-normal text-amber-300/90">A PIN is 4 to 8 digits.</p>
      ) : mismatched ? (
        <p className="text-[12.5px] font-normal text-amber-300/90">{"Those two don't match."}</p>
      ) : null}

      <button onClick={submit} disabled={!ready} className={PRIMARY}>
        {request.setup ? "Set PIN" : "Unlock"}
      </button>
    </div>
  );
}

/**
 * The device unlock password.
 *
 * Deliberately not the PIN dialog with a different regex. A PIN wraps only the
 * device share, which is one of three and opens nothing by itself; this
 * password also decrypts the token that buys a session, so it is the whole
 * strength of the "unlock without signing in" path. Hence the real minimum, the
 * refusal of digits-only input, and the double entry at setup — a typo here
 * wraps the share with a value nobody knows, which is a locked wallet.
 *
 * The kit validates the same rules and is the authority; these are here so the
 * user finds out while typing rather than on submit.
 */
function UnlockPasswordDialog({
  request,
}: {
  request: Extract<RecoveryRequest, { kind: "password" }>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = password.length > 0 && password.length < MIN_UNLOCK_PASSWORD_LENGTH;
  const digitsOnly = password.length > 0 && /^\d+$/.test(password);
  const mismatched = request.setup && confirm.length > 0 && confirm !== password;
  const wellFormed = password.length >= MIN_UNLOCK_PASSWORD_LENGTH && !/^\d+$/.test(password);
  // Only the setup path can be checked for strength; on unlock the password is
  // whatever it already is, and blocking submission would lock the user out.
  const ready = request.setup ? wellFormed && confirm === password : password.length > 0;

  const submit = () => {
    if (!ready) return;
    request.resolve(password);
    completeRecoveryRequest(request);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[19px] font-bold text-white">
          {request.setup ? "Set a password for this device" : "Enter your device password"}
        </div>
        <p className="mt-1.5 text-[13.5px] font-normal text-white/55">
          {request.setup ? "Then you get back in here with just this password, no signing in again. At least 8 characters, and not only digits. It can't be reset, so save it in your password manager." : "The password you set on this device."}
        </p>
      </div>

      <input
        className={INPUT}
        type="password"
        autoComplete={request.setup ? "new-password" : "current-password"}
        placeholder="Unlock password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />

      {request.setup ? (
        <input
          className={INPUT}
          type="password"
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      ) : null}

      {request.setup && tooShort ? (
        <p className="text-[12.5px] font-normal text-amber-300/90">
          {`Use at least ${MIN_UNLOCK_PASSWORD_LENGTH} characters`}
        </p>
      ) : request.setup && digitsOnly ? (
        <p className="text-[12.5px] font-normal text-amber-300/90">Add letters or symbols — digits alone are too easy to guess</p>
      ) : mismatched ? (
        <p className="text-[12.5px] font-normal text-amber-300/90">{"Passwords don't match"}</p>
      ) : null}

      <button onClick={submit} disabled={!ready} className={PRIMARY}>
        {request.setup ? "Set password" : "Unlock"}
      </button>
      {/* Always offered, including at setup. Withholding it meant a dialog with
          no way out: a user who opened this and changed their mind had to
          reload the page. Cancelling setup costs the device its stored share —
          the kit says so and carries on — which is a smaller harm than a modal
          that cannot be dismissed. */}
      <button
        onClick={() => {
          request.resolve(null);
          completeRecoveryRequest(request);
        }}
        className={SECONDARY}
      >
        Cancel
      </button>
    </div>
  );
}

export function DecaneRecoveryHost() {
  const request = useRecoveryRequest();

  // Escape dismisses the password dialogs, which is what people press before
  // they look for a button. The recovery dialogs are deliberately not
  // dismissible this way: rotation has already spent the user's old file by
  // the time they are shown, so leaving without the replacement strands them.
  useEffect(() => {
    if (request?.kind !== "password") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      request.resolve(null);
      completeRecoveryRequest(request);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[34px] border border-white/10 bg-[#0F0F0F] px-6 py-6">
        {request.kind === "file" ? (
          <FileDialog request={request} />
        ) : request.kind === "restore" ? (
          <RestoreDialog request={request} />
        ) : request.kind === "pin" ? (
          <PinDialog request={request} />
        ) : request.kind === "password" ? (
          <UnlockPasswordDialog request={request} />
        ) : (
          <PasswordDialog request={request} />
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SquareLockup } from "@/components/ui/square-mark";
import { useDevicePasskey } from "@/hooks/use-device-passkey";
import { recordPasskeyNudgeDeclined } from "@/lib/passkey-nudge";

/**
 * ADD A PASSKEY — one screen, after a sign-in that has already succeeded.
 *
 * ─── WHY IT IS FRAMED AS A WAY BACK IN ──────────────────────────────────────
 * A passkey wraps this device's share of the wallet. That is true and it is
 * none of the reader's business: they came here to post, and "a PIN protects
 * your wallet" reads as a chore attached to something they did not ask for.
 *
 * The honest framing is also the appealing one. The kit really does sign people
 * in with a passkey, so "sign in next time with your face" is what the thing
 * does, not a gloss on it. The wrapping comes along for the ride.
 *
 * ─── WHY HERE ───────────────────────────────────────────────────────────────
 * The reader has just proved who they are, and the payoff lands on the very
 * next sign-in. Offered once the sign-in is done rather than during it, so a
 * dismissed authenticator sheet can never cost somebody their session.
 *
 * Skipping is a decision, remembered for a week (lib/passkey-nudge) — the usual
 * reason a device is on a PIN is a password manager that happened to be
 * unreachable, and that changes.
 */
export function PasskeyStep({ onDone }: { onDone: () => void }) {
  const { adding, addPasskey } = useDevicePasskey();
  const [done, setDone] = useState(false);

  const add = async () => {
    try {
      await addPasskey();
      setDone(true);
      toast.success("Passkey added. You're set for next time.");
      onDone();
    } catch (err) {
      // A dismissed authenticator sheet is a decision, not a failure, and the
      // reader is still looking at the button. Anything else is worth saying,
      // and none of it is worth blocking a completed sign-in over.
      const name = (err as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "UserCancelledError") {
        console.error("Adding a passkey failed:", err);
        toast.error("That didn't work. You can add one later from your account.");
      }
    }
  };

  const skip = () => {
    recordPasskeyNudgeDeclined();
    onDone();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0F0F0F] px-4 py-10">
      <SquareLockup className="[--lockup-mark:80px]" />

      <div className="mt-[41px] flex w-full max-w-[600px] flex-col gap-5 rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
        <div>
          <h1 className="text-[24px] font-bold leading-[28px] text-white">Add a passkey</h1>
          <p className="mt-3 text-[14px] leading-[20px] font-medium text-[#999999]">
            Sign in next time with your fingerprint, face or device PIN. No password, and
            phishing-proof.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={adding || done}
            onClick={add}
            className="ws-press flex h-[49px] w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,#9F65FD_0%,#5B05E6_100%)] text-[16px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {adding ? "Waiting for your passkey…" : "Add a passkey"}
          </button>
          <button
            type="button"
            disabled={adding}
            onClick={skip}
            className="py-1 text-center text-[14px] text-[#999999] transition-colors hover:text-white disabled:opacity-40"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

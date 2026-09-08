"use client";

import { useState } from "react";
import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
import { Spinner } from "@/components/ui/button";
import { SquareLockup } from "@/components/ui/square-mark";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { cn } from "@/lib/cn";

/**
 * THE SIGN-IN CARD — Desktop 40, the end of the welcome sequence.
 *
 * ─── NOBODY IS TOLD ABOUT PRIVY, AND THAT IS THE POINT ──────────────────────
 * The page this replaces had a button reading "Continue with Privy" and a line
 * under it explaining what Privy was. Privy is our auth vendor; it is not a
 * thing the reader has, wants, or should have to understand. It is now entirely
 * behind the two controls the design draws — Continue with your Ark account, and
 * an email
 * — via the HEADLESS hooks (`useLoginWithOAuth`, `useLoginWithEmail`) rather
 * than `usePrivy().login()`, which opens Privy's own branded modal on top of
 * this card. That modal is the whole reason those hooks exist, and it is the
 * one thing that would give the vendor away.
 *
 * `showWalletUIs: false` is already set in `app/providers.tsx` for the same
 * reason on the money side, so this is the app's existing posture, not a new
 * one. Same shape wsws-frontend uses.
 *
 * ─── THE ONE PLACE THE FILE RUNS OUT ────────────────────────────────────────
 * Email sign-in is two steps — send a code, then enter it — and the file draws
 * only the first. So the code step is mine: the same card, the same rhythm, the
 * field swapped, and a way back to the email field for the person who mistyped
 * it. It deliberately does NOT advance the stepper: the three dots count the
 * three steps of getting set up, and entering a code is still the first of them.
 *
 * ─── THINGS I CHANGED, AND WHY ──────────────────────────────────────────────
 * · The Google button sits 14px left of the card's centre in the file (113px of
 *   space to its left, 141px to its right). Centred.
 * · The file draws Continue in its DISABLED state only — #1F1F1F under #999999
 *   text, because no email has been typed. That state is reproduced exactly;
 *   the enabled state is the purple ramp every other primary action in the
 *   product uses, since the file never shows one.
 * · `Enter Email` at #5A5A5A is the placeholder, kept as measured. It is a
 *   placeholder, not a value, so the contrast floor that applies to copy does
 *   not apply — the field also carries a real, permanent label above it, which
 *   is what a reader actually navigates by.
 */

/** `google` — the file's own four-path mark, at its offsets inside the 20x20 box. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        transform="translate(10 8.5)"
        fill="#EA4335"
        d="M0 0L0 3.25L4.58333 3.25C4.49413 3.77075 4.30048 4.26807 4.01406 4.71203C3.72763 5.15599 3.35435 5.53741 2.91667 5.83333L2.91667 8L5.66667 8C7.25 6.5 8.16667 4.33333 8.16667 1.75C8.16667 1.16667 8.08333 0.583334 8 0.0833336L0 0Z"
      />
      <path
        transform="translate(2.6 11.5)"
        fill="#34A853"
        d="M7.41667 6.83333C9.66667 6.83333 11.5 6.08333 12.9167 4.83333L10.1667 2.66667C9.41667 3.16667 8.5 3.41667 7.41667 3.41667C5.25 3.41667 3.5 2 2.83333 0L0 0L0 2.16667C0.680938 3.55652 1.73548 4.72929 3.04544 5.55353C4.3554 6.37778 5.86902 6.82093 7.41667 6.83333Z"
      />
      <path
        transform="translate(1.7 6.3)"
        fill="#FBBC05"
        d="M3.68335 5.16667C3.37628 4.19024 3.37628 3.14309 3.68335 2.16667L3.68335 0L0.850018 0C0.290755 1.1414 0 2.39561 0 3.66667C0 4.93772 0.290755 6.19193 0.850018 7.33333L3.68335 5.16667Z"
      />
      <path
        transform="translate(2.6 1.9)"
        fill="#4285F4"
        d="M7.41667 3.35756C8.66667 3.35756 9.75 3.77423 10.5833 4.60756L13 2.19089C12.0608 1.32982 10.9367 0.695573 9.71402 0.336926C8.49136 -0.0217214 7.20274 -0.0952203 5.94722 0.12208C4.69171 0.33938 3.50275 0.841691 2.47175 1.5904C1.44074 2.3391 0.595159 3.31426 0 4.44089L2.83333 6.60756C3.5 4.77423 5.25 3.35756 7.41667 3.35756Z"
      />
    </svg>
  );
}

/** `Rectangle 33` — 546x54 at radius 8 over #333333 at 31%, text inset 26. */
const FIELD =
  "h-[54px] w-full rounded-lg bg-[#333333]/[0.31] px-[26px] text-[14px] font-medium text-white outline-none transition-colors placeholder:text-[#5A5A5A] focus:bg-[#333333]/[0.45]";

/** `Frame 2147225680` — 440x49. The file draws only the disabled state. */
function CardButton({
  children,
  disabled,
  busy,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const dead = disabled || busy;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={dead}
      className={cn(
        "flex h-[49px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-medium transition-opacity",
        dead
          ? "cursor-not-allowed bg-[#1F1F1F] text-[#999999]"
          : "ws-btn-welcome ws-press hover:opacity-90"
      )}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

function PrivyForm() {
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);

  const busy = state.status === "sending-code" || state.status === "submitting-code";
  // Not a validator — just enough to stop an obviously empty submit. The
  // service decides what a real address is, and says so.
  const emailLooksReal = /.+@.+\..+/.test(email.trim());

  const google = async () => {
    setError(null);
    try {
      await initOAuth({ provider: "google" });
    } catch {
      // Never name the vendor in a message the reader sees.
      setError("Couldn't reach Google just then. Try again.");
    }
  };

  const submitEmail = async () => {
    if (!emailLooksReal) return;
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setStep("code");
    } catch {
      setError("We couldn't send that code. Check the address and try again.");
    }
  };

  const submitCode = async () => {
    setError(null);
    try {
      await loginWithCode({ code });
    } catch {
      setCode("");
      setError("That code didn't match. Check it and try again.");
    }
  };

  if (step === "code") {
    return (
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode();
        }}
      >
        <div className="mt-[61px] px-[27px]">
          <p className="text-[14px] leading-[18px] text-[#999999]">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-white">{email.trim()}</span>.
          </p>
          <label htmlFor="ms-code" className="mt-6 block text-[14px] font-medium text-white">
            Code
          </label>
          <input
            id="ms-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            // The one attribute that lets a phone offer the code from the
            // notification instead of making somebody switch apps to read it.
            autoComplete="one-time-code"
            placeholder="123456"
            className={cn(FIELD, "mt-2.5 tracking-[0.5em]")}
          />
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>
        <div className="mt-auto px-[80px] pt-8">
          <CardButton type="submit" busy={busy} disabled={code.length !== 6}>
            {busy ? "Checking…" : "Continue"}
          </CardButton>
          <div className="mt-4 flex justify-between text-[13px]">
            <button
              type="button"
              className="text-[#999999] transition-colors hover:text-white"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-[#999999] transition-colors hover:text-white disabled:opacity-50"
              onClick={() => void sendCode({ email: email.trim() })}
            >
              Resend code
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submitEmail();
      }}
    >
      {/* `btn-google` — 346x54, radius 34, #000 at 20% under a #000 12% hairline. */}
      <div className="mt-[61px] flex justify-center px-6">
        <button
          type="button"
          onClick={() => void google()}
          disabled={oauthLoading}
          className="ws-press flex h-[54px] w-full max-w-[346px] items-center justify-center gap-2.5 rounded-[34px] border border-black/[0.12] bg-black/20 text-[16px] font-semibold tracking-[-0.01em] text-[#8E8E93] transition-colors hover:bg-black/30 disabled:opacity-60"
        >
          {oauthLoading ? <Spinner className="h-5 w-5" /> : <GoogleMark />}
          Continue with your Ark account
        </button>
      </div>

      <div className="mt-[31px] px-[27px]">
        <label htmlFor="ms-email" className="block text-[14px] font-medium text-white">
          Email
        </label>
        <input
          id="ms-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="Enter Email"
          className={cn(FIELD, "mt-2.5")}
        />
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </div>

      {/* The file leaves 98px of air here and puts Continue 28px off the card's
          bottom edge in a 488-tall card. Reproduced as `mt-auto` against that
          height rather than as a literal 98: Figma reports TEXT boxes at
          cap-height, so every real line box above this is a few pixels taller
          than the file says and a hard 98 pushed the card to 520. Pinning the
          button to the bottom instead puts the slack exactly where the file
          puts it, and the card lands on 488. It also lets the taller code step
          grow past it instead of overflowing. */}
      <div className="mt-8 px-6 pb-1 sm:px-[80px] lg:mt-auto">
        <CardButton type="submit" busy={busy} disabled={!emailLooksReal}>
          {busy ? "Sending…" : "Continue"}
        </CardButton>
      </div>
    </form>
  );
}

/** No Privy provider is mounted in demo mode, so its hooks cannot be called. */
function DemoForm() {
  return (
    <div className="mt-[61px] px-[27px]">
      <p className="text-[14px] leading-[18px] text-[#999999]">
        This build runs with a demo session — there is no sign-in to do. Set
        <code className="mx-1 text-white">NEXT_PUBLIC_PRIVY_APP_ID</code>
        to enable real accounts.
      </p>
    </div>
  );
}

const Form = DEMO_AUTH ? DemoForm : PrivyForm;

export function SignInCard({ onSkip }: { onSkip?: () => void }) {
  return (
    /* The file centres the CARD in the viewport, not the card plus its lockup:
       the card runs 269-757 in a 1024 frame, whose midpoint is the frame's. The
       bottom padding is the lockup block's own height plus its 41px gap, which
       is what lifts the stack so the card lands centred with the lockup above
       it rather than the whole thing sitting 58px low. */
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0F0F0F] px-4 py-10 lg:pb-[118px]">
      <SquareLockup className="[--lockup-mark:80px] lg:[--lockup-mark:103.1px]" />

      {/* `Frame 2147225685` — 600x488, radius 34, 3% white under a 10% hairline. */}
      <div className="mt-[41px] flex w-full max-w-[600px] flex-col rounded-[34px] border border-white/10 bg-white/[0.03] pt-9 pb-7 lg:min-h-[488px]">
        <div className="flex items-start justify-between gap-4 pl-6 pr-[30px]">
          <div>
            <h1 className="text-[24px] font-bold leading-[28px] text-white">
              Welcome to Square
            </h1>
            <p className="mt-3 text-[14px] font-medium leading-[18px] text-[#999999]">
              Your MarketSquare to discover Gists and meet
              <br className="hidden sm:inline" /> new people near you.
            </p>
          </div>
          {/* Step 1 of the three it takes to get set up — this card, then the
              profile details, then Friends on Square (Desktop 32). */}
          <div className="mt-1 flex h-2 shrink-0 items-center gap-[5px]">
            <span className="h-2 w-[50px] rounded-[25px] bg-spotlight" />
            <span className="h-2 w-[19px] rounded-[25px] bg-[#D9D9D9]" />
            <span className="h-2 w-[17px] rounded-[25px] bg-[#D9D9D9]" />
          </div>
        </div>

        <Form />
      </div>

      {/* Not in the file — see the note in welcome-gate.tsx. Without it the
          sequence ends on a card offering two ways in and no way past, and
          signed-out browsing is a supported thing in this app. */}
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-6 text-[14px] text-[#999999] transition-colors hover:text-white"
        >
          Look around first
        </button>
      )}
    </div>
  );
}

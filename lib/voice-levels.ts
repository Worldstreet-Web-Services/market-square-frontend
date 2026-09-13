/**
 * TURNING A MICROPHONE INTO SOMETHING YOU CAN SEE.
 *
 * The old recorder showed a pulsing dot and a clock. Both animate happily
 * while the microphone is muted, pointed away, or picking up nothing at all —
 * so the one question a person actually has while recording ("is it hearing
 * me?") had no answer until they played it back. That is the whole reason
 * every serious voice-note UI draws a live waveform: the bars move because YOU
 * moved them.
 *
 * Pure, so the maths can be tested without a microphone.
 */

/**
 * How many bars the live waveform draws. The oldest falls off the left.
 *
 * 34, matching WAVEFORM_BARS in features/messages/lib/waveform.ts, and the
 * 0.25 floor in `dotScale` matches its MIN_HEIGHT — so a note being RECORDED
 * and the same note PLAYED BACK are visibly the same object rather than two
 * different waveform styles in one thread.
 *
 * The number is duplicated rather than imported because lib/ is the lowest
 * layer and cannot reach up into a feature. If the playback bar count ever
 * changes, change it here too.
 *
 * WHAT IS NOT SHARED IS THE DATA, deliberately. The playback bars are hashed
 * from the message id and its own header says, in capitals, that they are not
 * amplitudes and must never be presented as one — honest there, because the
 * payload carries no peaks. Reusing that while RECORDING would draw a waveform
 * that dances identically whether the microphone is hearing you or muted,
 * which is worse than the pulsing dot it replaces: it looks like feedback and
 * is not. These bars are measured.
 */
export const WAVEFORM_DOTS = 34;

/**
 * The loudness of one analyser frame, 0..1.
 *
 * `getByteTimeDomainData` gives samples centred on 128, so silence is a flat
 * line AT 128 rather than at 0 — a naive average of the raw bytes reports
 * "loud" for perfect silence, which is the classic bug here. Centre first,
 * then take the root-mean-square, which is what corresponds to perceived
 * loudness rather than to whichever single sample happened to spike.
 *
 * Scaled by 2 because speech at a sane input gain sits well under half of the
 * available range, and a meter that never leaves the bottom fifth looks broken
 * even when it is working. Clamped, so a shout cannot overflow the row.
 */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const centred = (samples[i]! - 128) / 128;
    sum += centred * centred;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 2);
}

/**
 * The rolling window the waveform draws, newest last.
 *
 * Returns a NEW array rather than mutating: this feeds React state, and a
 * mutated array is the same reference, so nothing would re-render.
 */
export function pushLevel(
  buffer: readonly number[],
  level: number,
  size: number = WAVEFORM_DOTS
): number[] {
  const next = [...buffer, level];
  return next.length > size ? next.slice(next.length - size) : next;
}

/**
 * The drawn height of one dot, as a fraction of the row.
 *
 * A FLOOR, not a raw level: a dot that shrinks to nothing reads as a gap in
 * the row rather than as quiet, and the row stops looking like one object.
 * Silence is a visible small dot, which is also the honest picture — the
 * microphone is open and hearing nothing.
 */
export function dotScale(level: number): number {
  return 0.25 + Math.min(1, Math.max(0, level)) * 0.75;
}

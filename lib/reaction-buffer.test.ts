import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_REACTION_BURST,
  createReactionBuffer,
} from "../features/streams/lib/reaction-buffer.ts";

/**
 * A hand-cranked clock, so the pooling window can be tested without waiting a
 * real second for every assertion.
 */
function fakeTimers() {
  const queued = new Map<number, () => void>();
  let next = 1;
  return {
    schedule: (fn: () => void) => {
      const handle = next++;
      queued.set(handle, fn);
      return handle;
    },
    cancel: (handle: number) => {
      queued.delete(handle);
    },
    /** Run everything currently due, once. */
    tick() {
      const due = [...queued.entries()];
      queued.clear();
      due.forEach(([, fn]) => fn());
    },
    pendingTimers: () => queued.size,
  };
}

function harness(maxBurst = MAX_REACTION_BURST) {
  const timers = fakeTimers();
  const sent: number[] = [];
  const buffer = createReactionBuffer({
    send: (burst) => sent.push(burst),
    schedule: timers.schedule,
    cancel: timers.cancel,
    maxBurst,
  });
  return { timers, sent, buffer };
}

test("a tap is not sent immediately — it waits for the pool to flush", () => {
  // The heart already flew and the tally already moved on the tap itself.
  // Only the durable write waits, which is what keeps a hammered button from
  // becoming a request per heart.
  const { timers, sent, buffer } = harness();
  buffer.add(1);
  assert.deepEqual(sent, []);
  assert.equal(buffer.pending(), 1);

  timers.tick();
  assert.deepEqual(sent, [1]);
  assert.equal(buffer.pending(), 0);
});

test("many taps in one window leave as ONE burst", () => {
  // The bug this guards: thirty taps a second becoming thirty requests.
  const { timers, sent, buffer } = harness();
  for (let i = 0; i < 6; i += 1) buffer.add(1);
  timers.tick();
  assert.deepEqual(sent, [6]);
});

test("nothing is dropped when a thumb outruns the cap", () => {
  // A tap-and-hold is counted IN FULL. The remainder rides the next tick
  // rather than being silently truncated — unlike the data channel next door,
  // which drops hearts under congestion on purpose. A late heart is worse
  // than no heart; an uncounted one is just wrong.
  const { timers, sent, buffer } = harness(10);
  for (let i = 0; i < 25; i += 1) buffer.add(1);

  timers.tick();
  assert.deepEqual(sent, [10]);
  assert.equal(buffer.pending(), 15);

  timers.tick();
  timers.tick();
  assert.deepEqual(sent, [10, 10, 5]);
  assert.equal(buffer.pending(), 0);
});

test("the pool goes quiet once it is empty", () => {
  // No self-perpetuating timer: an idle room must not keep waking up.
  const { timers, buffer } = harness();
  buffer.add(1);
  timers.tick();
  assert.equal(timers.pendingTimers(), 0);
});

test("a single call may not claim more than the cap", () => {
  // The clamp mirrors the one the data channel applies to peer packets, so
  // what is recorded can never exceed the hearts the room actually saw.
  const { timers, sent, buffer } = harness(10);
  assert.equal(buffer.add(5_000), 10);
  timers.tick();
  assert.deepEqual(sent, [10]);
});

test("add reports what it took, so the optimistic tally matches the write", () => {
  // Counting one thing on screen and sending another is how a tally drifts.
  const { buffer } = harness(10);
  assert.equal(buffer.add(3), 3);
  assert.equal(buffer.add(99), 10);
  assert.equal(buffer.add(0), 1);
  assert.equal(buffer.add(-4), 1);
  assert.equal(buffer.add(2.7), 2);
  assert.equal(buffer.pending(), 3 + 10 + 1 + 1 + 2);
});

test("disposing stops the timer and sends nothing more", () => {
  // Leaving the room must not fire a write into a component that is gone.
  const { timers, sent, buffer } = harness();
  buffer.add(4);
  buffer.dispose();
  timers.tick();
  assert.deepEqual(sent, []);
  assert.equal(timers.pendingTimers(), 0);
});

test("the buffer restarts cleanly after being disposed", () => {
  const { timers, sent, buffer } = harness();
  buffer.add(2);
  buffer.dispose();
  buffer.add(3);
  timers.tick();
  // The disposed window's taps were never sent, so only the new one counts
  // toward the burst that follows it.
  assert.deepEqual(sent, [5]);
});

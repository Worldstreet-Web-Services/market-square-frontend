import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOSED,
  DEFAULT_CIRCUIT,
  allowsRequest,
  isCircuitFailure,
  onFailure,
  onProbe,
  onSuccess,
  rateLimitScope,
} from "./circuit.ts";

const T = 1_000_000;

describe("isCircuitFailure", () => {
  // Narrow on purpose: tripping on a 401 or a 404 would take the whole app
  // down over one bad request, which is the opposite of the point.
  it("counts transport failures and 5xx, nothing else the server got right", () => {
    assert.equal(isCircuitFailure(undefined), true);
    assert.equal(isCircuitFailure(500), true);
    assert.equal(isCircuitFailure(502), true);
    assert.equal(isCircuitFailure(504), true);
    assert.equal(isCircuitFailure(401), false);
    assert.equal(isCircuitFailure(404), false);
    assert.equal(isCircuitFailure(200), false);
  });

  it("trips on a 429 the service calls back-pressure, and only that one", () => {
    // A 429 is not one thing. A spent write budget is the service asking us to
    // send less. A wink cooldown ("you already winked them today") and a
    // speaker-invite cooldown are 429s too, and they are answers about ONE
    // action between two people — a client-wide breaker on those would let
    // winking somebody twice degrade the whole app.
    assert.equal(isCircuitFailure(429, "budget"), true);
    assert.equal(isCircuitFailure(429, "action"), false);
  });

  it("treats an unlabelled 429 as an action, not as load", () => {
    // Every 429 sent before the flag shipped arrives this way, as does one
    // from anything that is not Market Square. The two wrong guesses are not
    // symmetric: this direction costs a missed slow-down, the other costs the
    // whole app over an ordinary refusal.
    assert.equal(isCircuitFailure(429), false);
    assert.equal(isCircuitFailure(429, null), false);
  });

  it("ignores the scope on every status that is not a 429", () => {
    // Nothing else carries one, and a stray value must not change what a 500
    // or a 404 already means.
    assert.equal(isCircuitFailure(500, "action"), true);
    assert.equal(isCircuitFailure(404, "budget"), false);
    assert.equal(isCircuitFailure(undefined, "action"), true);
  });
});

describe("rateLimitScope", () => {
  it("reads the service's flag off the error envelope", () => {
    assert.equal(rateLimitScope({ error: { details: { scope: "budget" } } }), "budget");
    assert.equal(rateLimitScope({ error: { details: { scope: "action" } } }), "action");
  });

  it("is null for every body that does not carry one", () => {
    // Tolerant on purpose: this parses a body from the network on a failing
    // request, which is the last place that should throw.
    assert.equal(rateLimitScope(null), null);
    assert.equal(rateLimitScope(undefined), null);
    assert.equal(rateLimitScope("nope"), null);
    assert.equal(rateLimitScope({}), null);
    assert.equal(rateLimitScope({ error: {} }), null);
    assert.equal(rateLimitScope({ error: { details: {} } }), null);
    // A value we do not know is not a value we act on.
    assert.equal(rateLimitScope({ error: { details: { scope: "global" } } }), null);
    assert.equal(rateLimitScope({ error: { details: { scope: 7 } } }), null);
  });
});

describe("opening", () => {
  it("tolerates failures below the threshold — one 502 is not an outage", () => {
    let circuit = onFailure(CLOSED, T);
    assert.equal(circuit.state, "closed");
    circuit = onFailure(circuit, T);
    assert.equal(circuit.state, "closed");
    assert.equal(allowsRequest(circuit, T), true);
  });

  it("opens on the third consecutive failure and blocks immediately", () => {
    let circuit = CLOSED;
    for (let i = 0; i < DEFAULT_CIRCUIT.threshold; i += 1) circuit = onFailure(circuit, T);
    assert.equal(circuit.state, "open");
    assert.equal(allowsRequest(circuit, T), false);
    assert.equal(circuit.retryAt, T + DEFAULT_CIRCUIT.cooldownMs);
  });

  it("lets exactly one probe through once the cooldown elapses", () => {
    let circuit = CLOSED;
    for (let i = 0; i < 3; i += 1) circuit = onFailure(circuit, T);
    const open = circuit.retryAt;
    assert.equal(allowsRequest(circuit, open - 1), false);
    assert.equal(allowsRequest(circuit, open), true);

    // THE PROBE SHUTS THE DOOR BEHIND IT. This test used to assert only the
    // LABEL — `onProbe(circuit).state === "half-open"` — while `retryAt` was
    // left in the past, so the second request at the same instant was admitted
    // for the same reason the first was, and so was the thousandth. That is
    // the recovery stampede: every tab's cooldown lapses together, and a
    // backend three seconds into being alive takes the whole fleet at once.
    circuit = onProbe(circuit, open);
    assert.equal(circuit.state, "half-open");
    assert.equal(allowsRequest(circuit, open), false, "the queue behind the probe waits");
    assert.equal(allowsRequest(circuit, open + 1), false);
  });

  it("does not wedge shut when a probe never answers", () => {
    // A hung request or a closed tab must not hold the circuit for ever, so
    // half-open expires like open does — one more probe, a cooldown later.
    let circuit = CLOSED;
    for (let i = 0; i < 3; i += 1) circuit = onFailure(circuit, T);
    const open = circuit.retryAt;
    circuit = onProbe(circuit, open);
    assert.equal(allowsRequest(circuit, open + DEFAULT_CIRCUIT.cooldownMs - 1), false);
    assert.equal(allowsRequest(circuit, open + DEFAULT_CIRCUIT.cooldownMs), true);
  });

  it("waits a plain cooldown after a probe, not a doubled one", () => {
    // A probe whose answer has not arrived is not a failure; `onFailure` owns
    // the doubling, and applying it here would punish silence twice.
    let circuit = CLOSED;
    for (let i = 0; i < 3; i += 1) circuit = onFailure(circuit, T);
    const probed = onProbe(circuit, circuit.retryAt);
    assert.equal(probed.retryAt, circuit.retryAt + DEFAULT_CIRCUIT.cooldownMs);
  });

  // A backend that has been down for ten minutes does not need asking every
  // fifteen seconds — and that asking is the cost we are here to remove.
  it("backs the probe off, to a ceiling", () => {
    let circuit = CLOSED;
    for (let i = 0; i < 3; i += 1) circuit = onFailure(circuit, T);
    const first = circuit.retryAt - T;
    circuit = onFailure(circuit, T);
    const second = circuit.retryAt - T;
    assert.equal(second, first * 2);
    for (let i = 0; i < 12; i += 1) circuit = onFailure(circuit, T);
    assert.equal(circuit.retryAt - T, DEFAULT_CIRCUIT.maxCooldownMs);
  });
});

describe("closing", () => {
  it("one success clears everything", () => {
    let circuit = CLOSED;
    for (let i = 0; i < 5; i += 1) circuit = onFailure(circuit, T);
    const recovered = onSuccess();
    assert.deepEqual(recovered, CLOSED);
    assert.equal(allowsRequest(recovered, T), true);
  });
});

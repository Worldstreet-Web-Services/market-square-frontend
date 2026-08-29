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
} from "./circuit.ts";

const T = 1_000_000;

describe("isCircuitFailure", () => {
  // Narrow on purpose: tripping on a 401 or a 404 would take the whole app
  // down over one bad request, which is the opposite of the point.
  it("counts transport failures and 5xx, nothing else", () => {
    assert.equal(isCircuitFailure(undefined), true);
    assert.equal(isCircuitFailure(500), true);
    assert.equal(isCircuitFailure(502), true);
    assert.equal(isCircuitFailure(504), true);
    assert.equal(isCircuitFailure(401), false);
    assert.equal(isCircuitFailure(404), false);
    assert.equal(isCircuitFailure(429), false);
    assert.equal(isCircuitFailure(200), false);
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
    assert.equal(allowsRequest(circuit, circuit.retryAt - 1), false);
    assert.equal(allowsRequest(circuit, circuit.retryAt), true);
    assert.equal(onProbe(circuit).state, "half-open");
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

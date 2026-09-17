import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createModalHostStack } from "./modal-host.ts";

describe("the modal host an always-reachable surface portals into", () => {
  it("is nothing while no modal is open, so the surface renders in place", () => {
    assert.equal(createModalHostStack<string>().top(), null);
  });

  it("is the topmost open modal, and falls back as each one closes", () => {
    const hosts = createModalHostStack<string>();
    const closeProfile = hosts.push("person-sheet");
    const closeConfirm = hosts.push("confirm-sheet");
    assert.equal(hosts.top(), "confirm-sheet");
    closeConfirm();
    assert.equal(hosts.top(), "person-sheet");
    closeProfile();
    assert.equal(hosts.top(), null);
  });

  it("a modal closing out of order takes only itself away, and a second removal is a no-op", () => {
    const hosts = createModalHostStack<string>();
    const closeA = hosts.push("a");
    hosts.push("b");
    closeA();
    closeA();
    assert.equal(hosts.top(), "b");
  });

  it("the same host pushed twice stays until both registrations go", () => {
    const hosts = createModalHostStack<string>();
    const first = hosts.push("sheet");
    const second = hosts.push("sheet");
    first();
    assert.equal(hosts.top(), "sheet");
    second();
    assert.equal(hosts.top(), null);
  });

  it("tells subscribers on every change, and not after they leave", () => {
    const hosts = createModalHostStack<string>();
    let heard = 0;
    const off = hosts.subscribe(() => (heard += 1));
    const close = hosts.push("sheet");
    close();
    assert.equal(heard, 2);
    off();
    hosts.push("again");
    assert.equal(heard, 2);
  });
});

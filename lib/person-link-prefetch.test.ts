import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
  A LIST OF FACES DOES NOT PREFETCH A PROFILE PAGE PER FACE.

  Next prefetches every `<Link>` that enters the viewport. That is right for a
  page with a handful of links and wrong for this app, where a person link is
  rendered once per message, once per post, once per comment and once per
  @mention — so opening a busy group thread asked the server for ~20 profile
  pages nobody had tapped (ogazboiz: "see many request when i enter group chat
  oo i thought we have minimize it oo").

  It repeated, rather than happening once, because `/u/[username]` is
  `force-dynamic` and this app has no `loading.tsx` anywhere. A dynamic entry
  with no loading boundary is held in the client router cache with a stale time
  of zero, so it is dropped as soon as it arrives and re-fetched on the next
  render — and an open thread re-renders every five seconds, because the
  message poll is on a 5s interval. That is the burst pattern, and it is why
  the requests were all for the SAME person: one link per bubble in a run,
  re-asked on every tick.

  The prefetch was buying almost nothing to begin with. Every screen here
  fetches its own data on the client, so a prefetched profile route warms a
  shell and not a profile — the reader still waits for the same request after
  tapping. So this is close to free, which is the only reason it is applied
  this widely in one go.

  A link that is ONE PER SCREEN may still prefetch: a thread header, a room's
  owner, the person sheet. Those are the links a reader is actually likely to
  take, and there is one of them, not twenty. Each is named below with the
  expression it links to, so adding a new person link to a list fails this
  test rather than quietly reinstating the storm.
*/

/** href expressions allowed to keep Next's default prefetch, by file. */
const SINGLETONS: Record<string, string[]> = {
  "features/messages/components/thread.tsx": ["profileHref(peer)"],
  "features/streams/components/live-hero.tsx": ["profileHref(owner)"],
  "features/streams/components/stream-room.tsx": ["profileHref(owner)"],
  "features/houses/components/person-sheet.tsx": ["sq(`/u/${username}`)"],
  "features/houses/components/house-room.tsx": ["profileHref(stream.owner)"],
  "features/profile/components/profile-page.tsx": [
    'profileHref(data, "following")',
    'profileHref(data, "followers")',
  ],
};

const ROOTS = ["app", "components", "features", "lib"];

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx")) found.push(path);
  }
  return found;
}

/**
 * Every `<Link …>` / `<TransitionLink …>` opening tag in a file.
 *
 * Scanned with a brace counter rather than a regex: an `onClick={… => …}`
 * contains a `>` that a lazy `[\s\S]*?>` would stop at, which would cut the
 * tag in half and hide whatever followed — including the prop this is looking
 * for. Only a `>` at brace depth zero closes a tag.
 */
function openingTags(source: string): string[] {
  const tags: string[] = [];
  const opener = /<(?:Transition)?Link\b/gu;
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let depth = 0;
    for (let i = match.index; i < source.length; i++) {
      const char = source[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) {
        tags.push(source.slice(match.index, i + 1));
        break;
      }
    }
  }
  return tags;
}

/** The person-link hrefs: `profileHref(…)` and the raw `/u/…` builders. */
const PERSON_HREF = /href=\{((?:profileHref\(|sq\(`\/u\/|segment\.id \? profileHref)[^\n]*?)\}\s/u;

test("a person link inside a repeating row never prefetches", () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const file of ROOTS.flatMap((root) => sources(root))) {
    for (const tag of openingTags(readFileSync(file, "utf8"))) {
      const href = PERSON_HREF.exec(tag);
      if (!href) continue;
      checked++;
      if (tag.includes("prefetch={false}")) continue;
      const allowed = SINGLETONS[file] ?? [];
      if (allowed.some((expression) => tag.includes(expression))) continue;
      offenders.push(`${file}: ${href[1].slice(0, 70)}`);
    }
  }

  // If this drops to zero the matcher has stopped matching and the test is
  // asserting nothing — the failure mode that let a broken gate ship before.
  assert.ok(checked >= 30, `only ${checked} person links found; the matcher is not matching`);
  assert.deepEqual(offenders, [], `these prefetch a profile page per row:\n  ${offenders.join("\n  ")}`);
});

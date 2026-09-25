import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * A GROUP'S MEMBER LIST SAYS WHO SOMEBODY IS, THEN WHAT THEY ARE HERE.
 *
 * ogazboiz: "show each person name and if the person is an admin ... it will
 * show next to the person like a badge ... and if the person is verified it
 * will show with the person name".
 *
 * The row already knew the role and drew it as an uppercase word pinned to the
 * row's RIGHT EDGE — a column away from the person it described on any long
 * name, which reads as a table heading rather than a badge. And it never drew
 * the verified check at all.
 */
describe("a group member row", () => {
  const thread = read("features/messages/components/thread.tsx");
  const badge = read("components/ui/badge.tsx");

  it("puts the check and the role WITH the name, not at the far edge", () => {
    assert.match(thread, /<VerifiedBadge\s+verification=\{profile\.verification\}/u);
    assert.match(thread, /<MemberRoleChip role=\{member\.role\} \/>/u);
    // The old right-edge labels are gone — they were the thing being fixed.
    assert.doesNotMatch(
      thread,
      /uppercase tracking-wide text-create">Owner</u,
      "the role is pinned to the row's edge again"
    );
  });

  it("truncates the NAME and never the badges", () => {
    /*
      An ellipsis on a name still names somebody. Half a check, or a clipped
      "Admin", says something false — so the badges are `shrink-0` and the name
      is what gives way.
    */
    assert.match(thread, /className="h-3\.5 w-3\.5 shrink-0"/u);
    assert.match(badge, /"inline-flex shrink-0 items-center rounded-\[21px\]/u);
  });

  it("keeps a MEMBERSHIP role separate from a PLATFORM role", () => {
    /*
      `RoleChip` draws Ambassador and WorldStreet — true of the person on every
      screen. `MemberRoleChip` draws Owner and Admin — true only in this group,
      since the same person is an ordinary member of the next one. Folding
      owner/admin into `ROLE_LABEL` would make a chip claim to be about the
      person when it is only about this room.
    */
    assert.match(badge, /export function MemberRoleChip/u);
    assert.match(badge, /export function RoleChip\(\{ role, className \}/u);
    assert.doesNotMatch(badge, /ROLE_LABEL: Record<string, string \| null> = \{[\s\S]{0,400}owner:/u);
  });

  it("draws nothing for a plain member, or for a role it has not heard of", () => {
    // A column repeating "Member" is noise that hides the two rows that
    // matter. And an unknown role gets no invented label.
    const chip = badge.slice(badge.indexOf("export function MemberRoleChip"));
    assert.match(chip, /return null;/u);
    assert.doesNotMatch(chip, /Member</u, "every row now carries a chip");
  });

  it("uses the app's one chip shape, so a group role is not a new species", () => {
    // Owner tints the shared shell rather than replacing it; admin is the
    // shell untouched.
    const chip = badge.slice(badge.indexOf("export function MemberRoleChip"));
    assert.match(chip, /<ChipShell className="border-create\/40 bg-create\/15 text-create">Owner<\/ChipShell>/u);
    assert.match(chip, /<ChipShell>Admin<\/ChipShell>/u);
  });
});

# Figma → Frontend Implementation Protocol

You are implementing a design from Figma into production frontend code. The bar is
*pixel parity with the rendered Figma frame* — not "roughly right," not "close enough."
Follow this protocol for every page and every section. Do not skip steps. If you skip one,
the work is not done and you owe a rework.

	⁠*The #1 failure mode:* eyeballing the screenshot and approximating layout values.
	⁠The screenshot is for ORIENTATION ONLY. Every real number comes from the node data.

---

## Rule 0 — Never approximate layout/values from the screenshot

Before you write a single ⁠ flex ⁠ / ⁠ grid ⁠ / ⁠ gap-* ⁠ / ⁠ p-* ⁠ / ⁠ rounded-* ⁠ / ⁠ text-[*] ⁠
value, you must have just read that exact value from the node's Figma data. Specifically:

•⁠  ⁠⁠ layout.mode ⁠ (⁠ row ⁠ / ⁠ column ⁠ / grid), ⁠ itemSpacing ⁠ (gap), per-side padding
•⁠  ⁠⁠ borderRadius ⁠ / per-corner radii
•⁠  ⁠every text node's ⁠ fontSize ⁠, ⁠ fontWeight ⁠, ⁠ lineHeight ⁠, ⁠ letterSpacing ⁠

*⁠ layout.mode: column ⁠ means stacked, full-width children — NOT a side-by-side grid.*
Reading flex-direction wrong is the most common repeated mistake. Read the mode per
container before writing the class.

"Match Figma" means match the *rendered PNG*, not the YAML/layout summary.

---

## Step 1 — Visual ground truth

•⁠  ⁠Download the rendered PNG of the target node (e.g. ⁠ download_figma_images ⁠ →
  ⁠ figma-refs/<name>.png ⁠).
•⁠  ⁠*Actually view the PNG* before coding. It is the source of truth for text case, real
  size gaps, icon shape, padding, and alignment — the things numbers alone miss.

## Step 2 — Read the raw data per element

For every button, chip, badge, tab, dropdown, input, and card, read from the node data
(use the raw REST API when the MCP summary hides things — see the traps below):

•⁠  ⁠⁠ absoluteBoundingBox ⁠ → exact ⁠ width × height ⁠. If a node has a fixed size, set it
  explicitly. *Never let a control auto-size* (a ⁠ <select> ⁠ will grow to its widest
  option instead of the Figma's fixed width).
•⁠  ⁠Full ⁠ fills ⁠ array — each entry is ⁠ {type, color, opacity, visible} ⁠. **The last visible
  entry renders on top.** Stacked fills are real: e.g. a 20% black overlay ON TOP of a
  gradient is darker than the gradient alone. Render every layer, in order.
  (CSS: first-listed background = top layer.)
•⁠  ⁠⁠ strokes ⁠ / ⁠ strokeWeight ⁠ — e.g. ⁠ 0 0 1px 0 ⁠ = bottom border only. **Zero-weight and
  ⁠ visible: false ⁠ strokes are hidden by MCP summaries — check the raw REST data before
  deciding there is no border.**
•⁠  ⁠⁠ rotation ⁠ — radians; convert ⁠ rad * 180/π ⁠ for ⁠ transform: rotate() ⁠.
•⁠  ⁠⁠ cornerRadius ⁠ / ⁠ rectangleCornerRadii ⁠.
•⁠  ⁠⁠ paddingTop/Right/Bottom/Left ⁠ individually — don't trust shorthand order.
•⁠  ⁠⁠ layoutMode ⁠, ⁠ primaryAxisAlignItems ⁠, ⁠ counterAxisAlignItems ⁠, ⁠ itemSpacing ⁠,
  ⁠ counterAxisSizingMode ⁠.
•⁠  ⁠*Text:* read ⁠ style ⁠ PLUS ⁠ characterStyleOverrides ⁠ + ⁠ styleOverrideTable ⁠. The parent
  style can lie (says SemiBold 600 while every character override flips to Medium 500).
•⁠  ⁠Scan ⁠ characters ⁠ for forced line breaks (Figma `
` / ⁠ \L ⁠) → reproduce as ⁠ <br/> ⁠.

## Step 3 — Reconcile with the PNG

If the math disagrees with the box — e.g. box height is 32px but
⁠ padding 12+12 + lineHeight 24 = 48 ⁠ — that's fixed-frame clipping. *The PNG wins:* set
explicit ⁠ height: 32 ⁠, ⁠ display:flex; align-items:center; line-height:1 ⁠ to match the
visual.

## Step 4 — Real assets only

•⁠  ⁠Every icon and illustration must be the *exact exported Figma node*. No icon-library
  substitutes (lucide/heroicons), no hand-drawn inline SVGs — even for "obvious" shapes
  like chevrons, arrows, and pluses. A library shape will be subtly wrong and get caught.
•⁠  ⁠*A matching name is NOT a matching icon.* A full-shaft arrow (⁠ → ⁠) is not the thin
  chevron (⁠ ‹ › ⁠) the design uses. Compare the actual vector, or just download the exact
  node when unsure.
•⁠  ⁠*Check what's already on disk before downloading* (⁠ public/icons ⁠, ⁠ public/images ⁠,
  etc.); reuse only after confirming the vector actually matches.
•⁠  ⁠Export one node per visible instance so each keeps its own color/tint (a leading icon
  often exports WITH its tinted background rect).
•⁠  ⁠If a card image looks inset/gapped, open the image file itself — it may have a baked-in
  white matte/frame. Re-export the raw fill (via the node's ⁠ imageRef ⁠) instead of fighting
  it in CSS.
•⁠  ⁠Downloaded vectors come at their intrinsic ratio (e.g. 9×18). Render them inside a fixed
  icon box (⁠ w-6 h-6 flex items-center justify-center ⁠) so they aren't stretched square.

## Step 5 — Prototype wiring

Read ⁠ interactions[] ⁠ on every clickable node. For each ⁠ ON_CLICK ⁠ with a
⁠ transitionNodeID ⁠, wire the handler to the real route or the matching modal/overlay. No
placeholder links, no invented destinations.

## Step 6 — Verify before reporting

•⁠  ⁠Reload the route in the dev server.
•⁠  ⁠Compare the rendered output to ⁠ figma-refs/<name>.png ⁠ section by section.
•⁠  ⁠Run typecheck + build (⁠ tsc --noEmit ⁠, then the project's build).
•⁠  ⁠State explicitly what matches and what does NOT. Never say "looks roughly right."

## Step 7 — Mobile responsiveness (when given a mobile frame)

The mobile frame is the source of truth — not the desktop layout. Work one section fully
before the next.

•⁠  ⁠*Mobile values ≠ desktop values.* Read the mobile frame's OWN font sizes, padding,
  gaps, heights. Apply responsively: mobile base + ⁠ md: ⁠ for desktop, so desktop stays
  untouched. Don't leave a desktop 18px subtitle where mobile says 14px.
•⁠  ⁠*A modal/dialog on desktop is often a FULL-SCREEN PAGE on mobile.* Decide from the
  frame shape: a full-bleed mobile artboard with the site navbar at top = a page, not a
  centered card. A real modal appears as a small card on a dimmed backdrop inside the frame.
•⁠  ⁠*A component SET with variants (⁠ State=1 ⁠ / ⁠ State=2 ⁠) is an ANIMATION* (transition
  between states), not a static variant. Build it with CSS keyframes; honor
  ⁠ prefers-reduced-motion ⁠.
•⁠  ⁠*Mobile structure can differ:* single column, bordered cards, reordered content,
  different footer columns, a slide-in drawer nav with a dimmed backdrop (not a floating
  card). Match the mobile frame's real structure.
•⁠  ⁠*Section headers:* heading + action ("View All") share ONE row, action top-aligned
  (⁠ items-start ⁠); the subtitle spans FULL width beneath. Heading ⁠ min-w-0 ⁠, action
  ⁠ shrink-0 ⁠, arrow sized per the mobile frame (often 16px, not 24px) — otherwise the
  action reserves a column that squeezes the subtitle into horizontal overflow.
•⁠  ⁠*Dividers* inside a padded card must touch the card's edges (⁠ -mx-[pad] ⁠ or a direct
  flex child), never inset.
•⁠  ⁠*No placeholder or duplicated content* — every FAQ/item needs its OWN real copy pulled
  from the node, never one string repeated.
•⁠  ⁠*Exact text:* periods, hyphenation ("Single-family"), capitalization, ⁠ & ⁠, curly
  quotes — character for character.

---

## Pre-flight checklist — run before saying ANY section is done

1.⁠ ⁠*Viewed the rendered PNG of that exact node* (not just the layout numbers).
2.⁠ ⁠*Fixed dimensions are explicit* — nothing left to auto-size that Figma fixed.
3.⁠ ⁠*Both breakpoints checked* for every element; never flatten one onto the other, and
   never delete an element based on a single frame.
4.⁠ ⁠*Neighbors don't regress* — the changed section still lines up with the ones above and
   below at every width.
5.⁠ ⁠*No placeholders left behind* — no "for now" / "using X for now" in the shipped code.
6.⁠ ⁠*Real asset, exact node* — every icon's shape confirmed against the design.

If you skipped any of these, it's a rework — and the user should not be the one to find it.

---

## Data-source traps (why the MCP summary is not enough)

The MCP/layout summary silently hides things. Check the *raw REST data* (or the rendered
PNG) whenever borders, fills, or fonts matter:

•⁠  ⁠Zero ⁠ strokeWeight ⁠ and ⁠ visible: false ⁠ nodes are dropped from summaries → you'll miss a
  real border. Read raw before drawing / omitting one.
•⁠  ⁠Stacked fills collapse to one → you'll miss an overlay layer.
•⁠  ⁠Parent text style overrides the per-character truth → read ⁠ characterStyleOverrides ⁠.
•⁠  ⁠Export every glyph; never substitute a repo/library icon for a Figma one.
•⁠  ⁠Use the file's own copy and its own font — don't swap in a look-alike typeface.
# Transaction card artwork — Figma node 1707:17296

`components/ui/transaction-card.tsx` layers three exported images in this folder,
in z-order (back → front), with the dynamic text drawn on top in code. Export
each from Figma at **2x PNG** (or SVG where noted) and drop it here with the
exact filename:

| File          | What to export (everything at that depth, dynamic text HIDDEN)                                   |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `sky.png`     | Everything **behind** the seal: the sky + rays, the stars/sparkles, the MARKET logo, `tsionark.com`. |
| `seal.svg`    | The green verified seal **with its check** only (node 1707:17865). Its box is 223×188 at (263,94). |
| `clouds.png`  | Everything **in front of** the seal and behind the text: the front cloud bank + the perforated ticket foot. |

Notes:
- Export the frame **without the dynamic text layers** (the amount, "Your … was Successful", the description, the @handle, the wallet, the timestamp) — those are rendered in code so the card stays dynamic.
- Keep the frame's own **742 × 666** proportions so the code's percentage positions line up.
- The seal is the animated element (it springs in); keeping it a separate layer is what lets it animate over the clouds. `sky.png` and `clouds.png` are static.
- Until these files exist the card renders its gradient, text and animation with blank art layers — so it's safe to review before the assets land.

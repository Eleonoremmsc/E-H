# Save the Date

`card.html` holds all three cards — English, French, German — one after another.
Open it in a browser to see them, or render them to PNG:

```
NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node save-the-date/render.js
```

Output lands in `save-the-date/out/` at **1500 × 2100 px — 5 × 7 inches at 300 dpi**,
which is the usual Save the Date trim. `render.js` finds Chromium under
`/opt/pw-browsers/` rather than hard-coding a version, since that changes between
container images; `CHROMIUM_PATH` overrides it.

## Before this is printed

The card carries **`eleonorehubert2027.netlify.app`**. A printed address cannot be
changed afterwards, so the domain has to be settled first — see the open item in
`../CLAUDE.md` §9. If a real domain is bought, change the `.url` line in all three
cards and re-render.

## Choices made here

- **Two typefaces only.** Parfumerie Script for the names, Cormorant Garamond for
  everything else. An earlier draft mixed more and was rejected for it.
- **The names dominate and the date is well below them.** Letterspaced caps carry
  far more ink per point than the script, so at nominal parity the month wins the
  card. The sizes here were set from the rendered image, not from the numbers.
- **"Save the Date" is left in English on all three cards.** It is the card's name
  and is used as-is by French and German stationers. Translate it in `card.html`
  if that is not wanted.
- **The address is the only thing set in the blue**, because it is the only thing
  on the card a guest has to act on.
- The palette tokens are copied from `../style.css`. If the website's palette
  changes, they do not follow by themselves.

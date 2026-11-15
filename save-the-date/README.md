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

## This matches the card that was already sent

The layout is not a fresh design. It reproduces the card printed earlier —
measured back out of a copy of it pixel by pixel — so a reprint and a new
language sit beside the existing cards without looking different:

- arched photo, a true semicircle whose radius is half its width
- a hairline with a small blue lozenge set into the middle of it
- the date with **no weekday**, letterspaced
- the place in italic sentence case, with a comma
- the address in letterspaced caps, underlined, the one thing in the accent

Every element lands within about 3px of the original's position and ink width.

The eyebrow is translated per language — *Réservez la date*, *Save the Date*,
*Merkt euch den Tag*. The German is the one line with no original to copy.

**The palette here is the website's ORIGINAL one, not the lighter palette B the
website moved to later.** That is deliberate: it is what the printed cards were
set in. If a reprint should match the website instead, swap the tokens at the
top of `card.html` for the ones in `../style.css`.

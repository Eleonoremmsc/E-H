# Éléonore & Hubert — wedding website

Everything needed to pick this project up cold. Read it before changing anything.

---

## 1. What this is

A static three-file website for a wedding on **Friday 25 – Saturday 26 June 2027**
in Provence, in **English, French and German**, behind a shared password, with an
RSVP that writes to a Google Sheet.

| | |
| --- | --- |
| Repo | `Eleonoremmsc/E-H` — **public** (see §9) |
| Live | https://eleonorehubert2027.netlify.app |
| Password | `CrillonEH2027` — `CONFIG.password` in `script.js`, case-insensitive |
| Default branch | `main` |
| Working branch | `claude/website-colors-typography-j044by` |

There is **no build step and no package.json**. Open `index.html` in a browser and
it runs. Netlify serves the repo as-is; there is no `netlify.toml`, so the build
settings live in the Netlify dashboard — confirm there rather than assuming.

### The weekend

| When | What | Where |
| --- | --- | --- |
| Fri 25 June, 19:00–22:00 | Cocktail evening | Château Pesquié, Mormoiron |
| Sat 26 June, 11:00–12:30 | Religious ceremony | TBD |
| Sat 26 June, from 19:00 | Reception | Domaine des Pins, Crillon-le-Brave |

Times live in `EVENT` and `EVENT_FRIDAY` at the top of `script.js` **and** in the
`T` translation strings **and** in the `Code.gs` confirmation emails. Changing a
time means changing all three.

> **Open:** the 11:00 ceremony leaves an eight-hour gap before the 19:00 reception.
> The website does not explain it.

---

## 2. The files

| File | Lines | What it holds |
| --- | --- | --- |
| `index.html` | ~1000 | Password gate, nav, seven sections, four overlays |
| `style.css` | ~1800 | Design tokens in `:root`, then everything else |
| `script.js` | ~2100 | Config, event data, the `T` translation table, all behaviour |
| `Code.gs` | ~2150 | Google Apps Script backend — **lives in Apps Script, not Netlify** |
| `Gantt.gs` | ~330 | Unrelated: weekly planning reminders from a separate sheet |

`Code.gs` is version-controlled here for history, but the copy that actually runs
is the one pasted into the Apps Script editor. Editing it here changes nothing
until it is pasted across and redeployed (§3).

Sections, in page order: `#welcome`, `#before`, `#programme`, `#map`,
`#accommodation`, `#activities`, `#dresscode`. Each has a nav tab in **two**
places in `index.html` — the desktop `.nav-links` block and the mobile
`.nav-mobile` block. Add a tab to one and forget the other and it silently
disappears on phones. The two blocks are indented differently (8 spaces vs 6);
a search-and-insert that ignores that will duplicate a tab into the wrong block.

### The four overlays, and a naming trap

| Overlay | Opened by |
| --- | --- |
| `#modal-overlay` | `#save-the-date-btn` — **this is the calendar modal** |
| `#rsvp-overlay` | `#rsvp-btn` |
| `#lang-overlay` | `.lang-icon-btn` (the globe) |
| `#songs-overlay` | the "see the playlist" link |

The calendar modal has the generic id `modal-overlay`, not `calendar-modal`.
Guessing the obvious name wastes time. Note also that the calendar button keeps
the id `save-the-date-btn` even though its label is now "Add to my calendar" —
renaming the id would break `initModal()`.

A closed overlay keeps `display: flex` and `visibility: visible`, and is hidden
by `opacity: 0` plus `pointer-events: none`. Playwright's `isVisible()` therefore
returns **true** for a closed overlay — assert on `classList.contains('open')`
instead.

---

## 3. The backend — read this before touching Apps Script

`script.js` POSTs JSON to `RSVP_ENDPOINT`, a Google Apps Script Web App.
Actions: `submit`, `update`, `lookupByName`, `lookupByToken`, `addSong`, `listSongs`.

### ⚠️ The deployment rule

**Deploy → Manage deployments → ✏️ edit → New version.** This keeps the URL.

Clicking **"New deployment"** mints a *different* URL. The site keeps calling the
old one, so RSVPs appear to work and quietly land nowhere. This has bitten this
project before. If the RSVP suddenly stops writing, check this first.

### The sheet

One spreadsheet (`SHEET_ID` in `Code.gs`), five tabs:

| Tab | Purpose |
| --- | --- |
| `RSVPs` | One row per submission. Headers in `RSVP_HEADERS`. |
| `Guests` | **One row per person**, not per household. Headers in `GUEST_HEADERS`. |
| `Invites` | The invited guest list. |
| `Cartons` | The updated per-card list, for reconciliation. |
| `Songs` | Playlist suggestions. |

New columns are **appended at the end**, never inserted — `Country`, then
`Friday`. Inserting mid-row shifts columns that existing rows already fill.
`ensureHeaders()` tops up tabs that predate a column.

### Households

One row per guest, with a shared `household_token` per invitation. A couple is
two rows with the same token. This is the model that `applyGuestListChanges()`
and the RSVP recognition flow both depend on, and it is the source of the two
bugs already fixed here:

- a wife was being given a **new** household instead of joining her husband's, and
- a third person was being **appended** instead of filling an existing empty seat.

Both are fixed. If you touch `fillNewGuests()` or `runGuestListChanges()`, run
`previewGuestListChanges()` first — it reports without writing.

---

## 4. Design system

### Colours (`:root` in `style.css`)

Change a token and the whole site changes. The current set is "palette B".

| Token | Value | Use |
| --- | --- | --- |
| `--cream` | `#FBF7EF` | Page background |
| `--cream-alt` | `#F4EEE2` | Alternating sections |
| `--cream-lift` | `#FFFCF6` | Cards lifted off the cream |
| `--ink` | `#3A4030` | Body copy |
| `--ink-deep` | `#272C1D` | — |
| `--ink-mid` | `#555C45` | Secondary copy |
| `--olive` | `#7A8A6B` | **Display type only** — 3.46:1, too pale for small text |
| `--olive-deep` | `#65745A` | Small text that needs the sage tone |
| `--blue` | `#96A8BC` | Fills, rules |
| `--blue-deep` | `#4E6A84` | The text-safe blue; the calendar button |
| `--lavender-line` | `rgba(139,132,148,.28)` | Hairlines, used a lot |

Measured contrast on cream: ink 10.05, ink-mid 6.54, olive-deep 4.68,
blue-deep 5.28. Cream on olive-deep 4.88, cream on blue-deep 5.51. **Everything
that carries text clears WCAG AA.** If you shift a token, recompute — don't eyeball.

The blue is the one saturated accent. It marks structure (RSVP step numbers, the
rule between guests) and carries exactly one filled shape: the calendar button.

### Fonts

| Token | Family | Source |
| --- | --- | --- |
| `--script` | Parfumerie Script Old Style | Self-hosted woff2 in `fonts/` |
| `--serif` | Cormorant Garamond | Google Fonts |
| `--sans` | Montserrat | Google Fonts |

### ⚠️ Parfumerie Script's broken capitals

**K, M, N, R and X** each carry a leading loop that reads as a doubled letter.
"Keep" renders as *Kkeep*, "Réception" as *Rééception*, "Mark" as *Mmark*. This is
a property of the typeface, not a rendering bug, and it cannot be fixed with CSS.

**Safe initials:** A B C D E F G H I J L O P Q S T U V W Y Z.

Any new display string in the script face must start with one of those, in all
three languages. This is why the English card reads "Save the date" and not
"Keep the day".

### Responsive breakpoints for the nav

Seven tabs is the most the bar holds.

| Width | Nav |
| --- | --- |
| ≥ 1201px | Seven tabs + languages spelled out |
| 1041–1200px | Seven tabs + globe icon (opens `#lang-overlay`) |
| ≤ 1040px | Hamburger |

Verified at nine widths × three languages. **German and English are both wider
than French** — test all three after any nav change, not just English.

---

## 5. Translations

`script.js` holds `T` with `en` / `fr` / `de`. HTML elements carry `data-i18n`,
`data-i18n-aria` or `data-i18n-placeholder`. `applyLang()` walks them.

Three rules:

1. **All three languages must stay in parity** — same keys, same count. Currently 254 each.
2. **`applyLang()` assigns `textContent`, not `innerHTML`.** HTML entities render
   literally: write `&`, never `&amp;`. This has caused a visible bug before
   ("Trauung &amp; Empfang").
3. Some keys are used only from JS at runtime (the RSVP flow, song status). A key
   that looks unused may not be — grep `script.js` before deleting one.

### Voice

- **French:** a plain space before `:` `?` `!` `»` — this is the house convention
  across the site, not the narrow no-break space. One exception, `accom_distance`,
  uses a NBSP because it was wrapping badly.
- **German:** the website **siezt** (~40 strings), the Save the Date **duzt**. This
  is inconsistent and known; converting the site to *ihr* has been offered and not
  taken up. New German copy in shared components should avoid the pronoun entirely
  where it can, so it reads naturally either way.
- "**Website**", never "site".

---

## 6. Her preferences — learned the hard way

These are corrections she has actually made. Apply them before being asked.

- **Show a preview before a big change.** "Give me a view before modifying
  completely." Build the option, screenshot it, let her choose.
- **Give two or three concrete options, not a survey.** She picks quickly.
- **Hierarchy matters.** "Right now everything reads the same" was a rejection.
  Size, weight and colour should rank things.
- **Bold is fine, but only in the blue or the green.** Reds were rejected outright.
- **Lighter and happier** over sober and dark.
- **Less is more on the page.** Her mother's note — "too much going on and no one
  will read everything" — drove the welcome page down to one button.
- **Don't add explanatory sentences under controls** unless asked. "I don't want
  the sentence underneath."
- **Answer questions directly.** "No that was fine, I didn't need code editing" —
  a question about the code is not a request to change it.
- **Compare rendered ink, not nominal font sizes.** Bold letterspaced caps carry
  far more weight than a thin script at the same point size. Judging a layout from
  CSS values instead of a screenshot produced a Save the Date where the month
  dominated the names.

---

## 7. Testing

Playwright and Chromium are pre-installed in the cloud container.

```
executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'
NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node script.js
```

The version number in that path **changes between container images**. If
`chromium.launch()` fails, `ls /opt/pw-browsers/` and use what is actually there.
Do not run `playwright install` — it fetches a build that won't match.

To load the site in a test: `page.fill('#password-input', 'CrillonEH2027')` then
Enter.

Two things to know about screenshots:

- Under `file://`, the self-hosted woff2 is blocked by CORS in the console. It
  still renders. Not a regression; it does not happen over https.
- Fractional pixel positions destroy fine detail — this ruined several QR code
  renders. Composite at integer coordinates and verify the result decodes.

**The scratchpad is wiped between containers.** Anything a generator script needs
must be rebuildable from what is in the repo. Don't leave a deliverable only in
`/tmp`.

---

## 8. Git

Work on `claude/website-colors-typography-j044by`, push with
`git push -u origin <branch>`, retry network failures with backoff.

If that branch's PR has already been merged, **do not stack on it** — reset the
branch onto the latest `main` and open a new PR.

Commit messages on this project are prose: what changed and *why*, in full
sentences, not a bulleted changelog.

---

## 9. Known issues and open decisions

**Security properties worth knowing** — none of these are new leaks, but be aware:

- The repo is **public**. The site password, `RSVP_ENDPOINT` and both Sheet IDs
  are readable by anyone. The password was always public — it ships in the JS
  that every visitor downloads — so it gates against casual sharing, not against
  anyone determined.
- The Apps Script endpoint accepts **unauthenticated POSTs** that write to the
  sheet. That is inherent to this design and discoverable from the live site.
- Never paste a Booking.com link with its `aid=` / `sid=` / `label=` parameters
  onto the site — those carry a personal session identifier. Strip to the bare URL.

**Open, waiting on her:**

1. Save the Date footer — **A** QR code, **B** address alone, or **C** a sentence.
2. The pocketfold invitation mockup still says 16h30 for the ceremony; it is 11:00.
3. The eight-hour Saturday gap is unexplained on the website.
4. The German *Sie* / *du* inconsistency (§5).
5. **Buy a real domain** (~€12/yr). `eleonorehubert2027.netlify.app` is one typo
   from a "Site not found" page — typing `.com` instead of `.app` has already
   caused a scare.

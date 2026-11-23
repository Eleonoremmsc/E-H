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
| `save-the-date/` | — | The printed card, in three languages — see its own README |

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

### The two links that open somebody's own RSVP

| Parameter | Carries | Where it comes from |
| --- | --- | --- |
| `?rsvp=<edit token>` | one **reply** | the confirmation email |
| `?h=<household token>` | one **invitation** | the QR on a printed invitation |

**Both skip the password gate**, and `?h=` does so deliberately: the token
identifies the invitation, so the password has nothing left to protect, and
asking for one after somebody scans their own invitation puts back the
friction the QR removes. Anyone holding the paper can then see and change
that invitation's answer — the same as the emailed edit links.

Both are stripped from the URL on arrival, open the RSVP automatically, and
are remembered in `localStorage`, so a guest who comes back without the
paper is still recognised. `?h=` **replaces** whatever that browser had
stored, because a phone may be shared.

The household token is per **invitation**, not per person. Everyone on a card
shares one, which is how these replies actually arrive — a parent answering
for children, one partner for both.

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
| `Dashboard` | Written by `buildDashboard()`. Wiped and rewritten each run. |

On `RSVPs`, new columns are **appended at the end**, never inserted —
inserting mid-row shifts columns that existing rows already fill.
`ensureHeaders()` tops up tabs that predate a column.

`Guests` is different: it is derived entirely from `RSVPs` (the Friday and
Saturday answers live in the `Attendees (JSON)` column). If its header row does
not match `GUEST_HEADERS`, the next RSVP — or `rebuildGuests()` run by hand —
wipes and rewrites the tab. So its columns may be reordered, but anything typed
into `Guests` by hand is lost on rebuild. `Submitted` there is a date-only cell
(`dd/MM/yyyy`); `RSVPs` keeps the full timestamp. RSVPs sent before 16 Sep 2026
predate the Friday question and have no Friday answer.

### The dashboard

`buildDashboard()` writes the `Dashboard` tab: invitations, how many have been
sent a Save the Date, how many have answered, and the expected headcount. It only
reads; it wipes and rewrites that one tab.

It needs a tick column on `Cartons` headed **`Save the Date`** (or `Envoyé`,
`Sent`, `STD` — see `STD_HEADERS`). Any non-empty value counts as sent except
`0`, `no`, `non`, `nein`, `false`, `-`, `n`. Without the column it still reports
everything else and says the column is missing.

**Expected headcount is counted per person, not per household**: yes = 1,
maybe = 0.5, no = 0. A couple answering yes and maybe is 1.5, which a
per-household rule could not express.

**Invited and answered come from different places and can disagree.** How many
a card seats is `Nb` on `Cartons`; how many were answered for is the length of
that reply's attendee list. A card seating two where only one person replied is
an answered card contributing one person, with one seat still outstanding.
Seats still to hear from are therefore summed **card by card**, as
`max(0, seats − answered)` per card: subtracting one total from the other let a
card answered for more people than it seats — a guest bringing someone — cancel
out a card nobody had answered.

The **FORECAST** section is kept separate from everything above it, because
everything above is counted and everything in it is inferred: the rate of
yes among people who have answered, applied to the people who have not. It
projects twice — over the people already sent a Save the Date, and over the
whole list — and says on the tab that early replies lean yes, so both read
high. Do not merge it into the counted sections.

The join is `Cartons` → (by name) `Invites` → (by household token) `RSVPs`. Two
things fall out of it and are reported rather than hidden: cards whose names are
not on `Invites` (marked in the card table), and replies whose token is
`Self-added` or matches no card, which are listed at the foot of the tab and
still counted in the totals.

### Both answers side by side

`tagReplies()` writes two columns on **`Invites`** — `Rep FB` and
`Rep Website` — each holding `yes`, `maybe`, `no`, or blank for no answer yet.
It rewrites both from scratch on every run, finds each column by header and
appends it if absent, and touches nothing else.

**They live on `Invites`, not `Cartons`, because `Invites` has one row per
person and the answers are per person.** There are couples here where one
says yes and the other maybe — a single cell on a shared card could not hold
that. Not `Guests` either: that tab is wiped and rebuilt from `RSVPs`.

The party-list export goes in a tab called **`FB`** (Name + Status, with
headers). Its statuses map through `FB_YES` / `FB_MAYBE` / `FB_NO`; anything
else, **`Invited` included**, means no answer yet, not a no.

Matching the two lists is the hard part and `FB_ALIASES` is where it is
solved: the same person is Maud Grand on one list and Maud Arminjon on the
other, Guilherme Fabre and Guillaume Fabre, Pierre Mlr and Pierre Muller.
Add to that map rather than editing either sheet — neither is wrong.

Beyond the aliases a name is split into given name and surname every way it
could divide, because given names run to two words and the export sometimes
writes the surname first. **The splits are tried longest-given-name-first,
and that ordering is load-bearing**: tried the other way, `Anne-Isabelle de
Bokay` matches the `Anne de Bokay` on another invitation and marks the wrong
person. Both exist. An earlier version did exactly that.

Website answers are placed by household token, then by given name within
that household. Anything that cannot be placed — a self-added reply, a name
on neither list — is reported by name in the log rather than dropped.

### Contact details from the replies

`previewRsvpContacts()` / `importRsvpContacts()` copy email, address and
country from `RSVPs` onto `Invites`, matched by household token. **They fill
empty cells only**: where the guest list already holds something different
the report says CONFLICT and the existing value stays, because yours may be
the better of the two.

Address and country are written to every member of the invitation; **email
is written to one person** — whoever filled the form in, matched by name.
Writing it across the household would claim a wife's address is her
husband's. If the name on the reply matches nobody there, it is reported
rather than placed on a guessed row.

**Phone travels with the email**, onto the same one person: both were given
by whoever filled the form in. The field is optional on the form, and
`Phone` is the last column of `RSVPs` — appended, like every column added
there since.

Nothing copies contact details automatically when a reply arrives — only
`rsvp_status` is written back to `Invites`, by `markHouseholdResponded()`.
That is deliberate: a guest editing their RSVP months later would otherwise
silently rewrite records you may have corrected by hand.

### Reading the `Cartons` columns

`expandCartons()` finds each column by header name, not by position, so columns
can be added or reordered freely. The partner column is recognised as `Prénom
Partner`, `Prénom Femme`, `Partner`, `Conjoint`, `Épouse`, `Spouse` or `Wife`.

**A column it cannot find by name is treated as absent, never guessed at.** It
used to fall back to a fixed position, so renaming `Prénom Femme` to `Prénom
Partner` resolved the partner onto `Enfants (sans diner)` and every card with
children produced a guest whose first name was the number of children — "2
Amr", "3 Aubéry". The fixed positions survive only for a sheet whose header row
is unrecognisable, which is the one case they were ever right for.

`compareGuestLists()` logs which column each field resolved to, in one line at
the top of its output. Read it first when the comparison looks wrong.

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

1. **All three languages must stay in parity** — same keys, same count. Currently 255 each.
2. **`applyLang()` assigns `textContent`, not `innerHTML`.** HTML entities render
   literally: write `&`, never `&amp;`. This has caused a visible bug before
   ("Trauung &amp; Empfang").
3. Some keys are used only from JS at runtime (the RSVP flow, song status). A key
   that looks unused may not be — grep `script.js` before deleting one.

### Voice

- **French:** a plain space before `:` `?` `!` `»` — this is the house convention
  across the site, not the narrow no-break space. One exception, `accom_distance`,
  uses a NBSP because it was wrapping badly.
- **German:** the whole website is on **ihr / euch / euer**, matching the Save the
  Date. There is no *Sie* left anywhere in `script.js` or the `Code.gs` emails, and
  none should be added.
  The one deliberate exception is the guest-recognition flow — the "is this you?"
  step and the greeting banner — which names **one** person and so uses **du**
  (`Bist du das?`, `Dein Name`, `Hallo {name}, du bist für {count} bestätigt.`).
  Mixing du for an individual with ihr for the invited household is ordinary
  German, not an inconsistency; *ihr* in those strings would be wrong.
  Beware the lowercase `ihnen` / `ihre` in `rsvp_guests_note` — that is *them* /
  *their*, referring to the other guests on the invitation, not an address.
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
- **Never commit anything derived from the guest list** — names, addresses, who
  has replied and what they said. The repository is public and git history keeps
  a file even after it is deleted. Analysis output goes in a scratch directory
  outside the repo and is handed to her directly; `.gitignore` carries patterns
  for the usual names, but the rule is the point, not the patterns.

**Open, waiting on her:**

1. **Buy a real domain (~€12/yr) — now blocking.** `eleonorehubert2027.netlify.app`
   is one typo from a "Site not found" page; typing `.com` instead of `.app` has
   already caused a scare. It is now also printed on the Save the Date, and a
   printed address cannot be changed afterwards, so this has to be settled before
   the card goes to print.
2. The pocketfold invitation mockup still says 16h30 for the ceremony; it is 11:00.
3. The eight-hour Saturday gap is unexplained on the website.

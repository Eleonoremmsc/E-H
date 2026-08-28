// ================================================
// Éléonore & Hubert — RSVP Backend
// Google Apps Script Web App
//
// SETUP:
// 1. Open script.google.com → New project → paste this file
// 2. Set WEBSITE_URL below to your Netlify URL
// 3. Deploy → New deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 4. Copy the deployment URL → paste into script.js RSVP_ENDPOINT
// 5. Share the Google Sheet with your Apps Script project's service
//    account email (shown in Deploy → Manage deployments)
// ================================================

const SHEET_ID       = '1DgTfgjqHhAbPp5FPUCfmVoiwKjCCI348BPl_iIcHhDk';
const SHEET_NAME     = 'RSVPs';
const GUESTS_NAME    = 'Guests';
const GUESTLIST_NAME = 'Invites';  // tab holding the invited guest list
const SONGS_NAME     = 'Songs';    // playlist suggestions from the welcome page
const WEBSITE_URL    = 'https://eleonorehubert2027.netlify.app';
const SENDER_NAME    = 'Éléonore & Hubert';

// ── Entry points ─────────────────────────────────

// doGet/doPost only ever receive an event object from a real web request.
// Running them by hand from the editor passes nothing, so guard the access
// and say so plainly rather than throwing a confusing TypeError.
function doGet(e) {
  if (!e) return jsonOut({ error: 'Run checkSetup() or testSearch() instead — ' +
                                  'doGet only works when called over the web.' });
  const token  = (e.parameter || {}).token;
  const result = token ? getByToken(token) : { error: 'No token' };
  return jsonOut(result);
}

function doPost(e) {
  if (!e) return jsonOut({ error: 'Run checkSetup() or testSearch() instead — ' +
                                  'doPost only works when called over the web.' });
  try {
    const data   = JSON.parse((e.postData || {}).contents || '{}');
    const action = data.action;
    let result;
    if      (action === 'submit')        result = handleSubmit(data);
    else if (action === 'update')        result = handleUpdate(data);
    else if (action === 'lookupByName')  result = lookupByName(data);
    else if (action === 'lookupByToken') result = lookupByToken(data);
    else if (action === 'addSong')       result = addSong(data);
    else if (action === 'listSongs')     result = listSongs();
    else                                  result = { error: 'Unknown action' };
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

// ── Handlers ──────────────────────────────────────

function handleSubmit(data) {
  const invalid = validateRSVP(data);
  if (invalid) return { error: invalid };

  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  const email = data.email.trim().toLowerCase();
  const householdToken = (data.householdToken || '').trim();

  // Already on file — by recognized household, or by email as a safety
  // net — treat it as an edit to their existing response, not a duplicate.
  for (let i = 1; i < rows.length; i++) {
    const rowToken = (rows[i][9] || '').toString().trim();
    const rowEmail = (rows[i][2] || '').toString().trim().toLowerCase();
    if ((householdToken && rowToken === householdToken) || rowEmail === email) {
      return handleUpdate(Object.assign({}, data, { token: rows[i][7] }));
    }
  }

  const token   = generateToken();
  const id      = 'rsvp_' + Date.now();
  const now     = new Date().toISOString();
  const editUrl = `${WEBSITE_URL}?rsvp=${token}`;

  sheet.appendRow([
    id,
    now,
    data.email,
    data.lastName,
    data.firstName,
    data.address,
    JSON.stringify(data.attendees || []),
    token,
    now,  // updatedAt
    householdToken || 'Self-added',
    data.country || '',
  ]);

  writeGuests(id, now, data);
  markHouseholdResponded(householdToken);

  const emailSent = trySendEmail(data, editUrl, false);
  return { success: true, token, editUrl, emailSent };
}

function handleUpdate(data) {
  const invalid = validateRSVP(data);
  if (invalid) return { error: invalid };
  if (!data.token) return { error: 'Missing edit token' };

  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  const token = data.token;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === token) {
      const row = i + 1;
      const id  = rows[i][0];
      const submitted = rows[i][1];
      const householdToken = (data.householdToken || rows[i][9] || '').toString().trim();

      sheet.getRange(row, 3).setValue(data.email);
      sheet.getRange(row, 4).setValue(data.lastName);
      sheet.getRange(row, 5).setValue(data.firstName);
      sheet.getRange(row, 6).setValue(data.address);
      sheet.getRange(row, 7).setValue(JSON.stringify(data.attendees || []));
      sheet.getRange(row, 9).setValue(new Date().toISOString());
      sheet.getRange(row, 10).setValue(householdToken || 'Self-added');
      sheet.getRange(row, 11).setValue(data.country || '');

      writeGuests(id, submitted, data, true);
      markHouseholdResponded(householdToken);

      const editUrl = `${WEBSITE_URL}?rsvp=${token}`;
      const emailSent = trySendEmail(data, editUrl, true);
      return { success: true, token, editUrl, emailSent };
    }
  }
  return { error: 'RSVP not found' };
}

// ── Validation ────────────────────────────────────
// Minimal shape checks — the site itself is password-gated, so this just
// guards against malformed/empty payloads reaching the sheet.

function validateRSVP(data) {
  if (!data) return 'Missing data';
  const email = (data.email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email';
  if (!(data.firstName || '').trim()) return 'Missing first name';
  if (!(data.lastName || '').trim()) return 'Missing last name';
  if (!Array.isArray(data.attendees) || data.attendees.length === 0) return 'At least one attendee is required';
  return null;
}

function getByToken(token) {
  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === token) {
      return {
        success: true,
        data: {
          email:          rows[i][2],
          lastName:       rows[i][3],
          firstName:      rows[i][4],
          address:        rows[i][5],
          country:        rows[i][10] || '',
          attendees:      JSON.parse(rows[i][6] || '[]'),
          householdToken: rows[i][9] || '',
        },
      };
    }
  }
  return { error: 'Not found' };
}

// ── Guest recognition (name lookup, no login) ─────
// Sheet1 holds ONE ROW PER GUEST. Everyone on the same invitation card
// shares a household_token, so matching any one person returns their whole
// household — one RSVP still covers the card. Matching is fuzzy (accent and
// typo tolerant) and always returns candidates for the guest to confirm; it
// never silently assumes a match.
//
// Sheet1 columns:
//   0 guest_id        3 household_id     6 side       9  phone
//   1 first_name      4 household_token  7 language   10 rsvp_status
//   2 last_name       5 party_size       8 email      11 note
//                                                     12 address
//                                                     13 country

function lookupByName(data) {
  const qTokens = tokenize(normalizeName(data && data.name));
  if (qTokens.length === 0) return { success: true, matches: [] };

  // Score every named guest, then keep each household's best-scoring member.
  // Remember which member that was: they are almost certainly the person
  // filling the form, so they should be offered as the contact.
  const best = {};
  const bestMember = {};
  getGuestListRows().forEach(function(g) {
    if (!g.token || !g.firstName) return;
    const score = scoreHousehold(qTokens, g.nameTokens);
    if (score < 0.55) return;
    if (!best[g.token] || score > best[g.token]) {
      best[g.token] = score;
      bestMember[g.token] = g.guestId;
    }
  });

  const households = groupHouseholds();
  const matches = Object.keys(best)
    .map(function(tok) { return { token: tok, score: best[tok] }; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 5)
    .map(function(x) {
      const members = households[x.token] || [];
      return {
        token:     x.token,
        label:     buildHouseholdLabel(members),
        partySize: members.length,
        guests:    orderGuests(members, bestMember[x.token]),
        address:   householdField(members, 'address'),
        country:   householdField(members, 'country'),
      };
    });

  return { success: true, matches: matches };
}

// One address per invitation: take the first one recorded against any member.
function householdField(members, key) {
  for (let i = 0; i < members.length; i++) {
    if (members[i][key]) return members[i][key];
  }
  return '';
}

// Household members as plain names for the form to pre-fill, with the
// person who matched the search first so they land in the contact fields.
function orderGuests(members, firstGuestId) {
  const head = [], tail = [];
  members.forEach(function(m) {
    const entry = { firstName: m.firstName, lastName: m.lastName };
    if (firstGuestId && m.guestId === firstGuestId) head.push(entry);
    else tail.push(entry);
  });
  return head.concat(tail);
}

function lookupByToken(data) {
  const token = ((data && data.householdToken) || '').trim();
  if (!token) return { error: 'Missing token' };

  const members = groupHouseholds()[token];
  if (!members || members.length === 0) return { error: 'Not found' };

  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][9] || '').toString().trim() === token) {
      return {
        success:   true,
        status:    'responded',
        label:     buildHouseholdLabel(members),
        editToken: rows[i][7],
        data: {
          email:     rows[i][2],
          lastName:  rows[i][3],
          firstName: rows[i][4],
          address:   rows[i][5],
          country:   rows[i][10] || '',
          attendees: JSON.parse(rows[i][6] || '[]'),
        },
      };
    }
  }

  return {
    success:   true,
    status:    'pending',
    label:     buildHouseholdLabel(members),
    partySize: members.length,
    guests:    orderGuests(members, null),
    address:   householdField(members, 'address'),
    country:   householdField(members, 'country'),
  };
}

function markHouseholdResponded(householdToken) {
  if (!householdToken || householdToken === 'Self-added') return;
  const sheet = getGuestListSheet();
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  // One row per guest now, so flag every member of the household.
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][4] || '').toString().trim() === householdToken) {
      sheet.getRange(i + 1, 11).setValue('Responded');
    }
  }
}

// "Barthold & Katrin Albrecht", or "Valérie Huyghues Despointes &
// Yves-Marie de Malleray" when a card carries two surnames. Unnamed seats
// are summarised rather than shown as blanks.
function buildHouseholdLabel(members) {
  const named   = members.filter(function(m) { return m.firstName; });
  const unnamed = members.length - named.length;

  let label;
  if (named.length === 0) {
    label = members.length ? (members[0].lastName || 'Guest') : 'Guest';
  } else {
    const surnames = named.map(function(m) { return m.lastName; });
    const oneSurname = surnames.every(function(sn) { return sn === surnames[0]; });
    if (oneSurname) {
      label = named.map(function(m) { return m.firstName; }).join(' & ');
      if (surnames[0]) label += ' ' + surnames[0];
    } else {
      label = named.map(function(m) {
        return (m.firstName + ' ' + m.lastName).trim();
      }).join(' & ');
    }
  }

  if (unnamed > 0) label += ' +' + unnamed + (unnamed === 1 ? ' guest' : ' guests');
  return label;
}

function groupHouseholds() {
  const out = {};
  getGuestListRows().forEach(function(g) {
    if (!g.token) return;
    if (!out[g.token]) out[g.token] = [];
    out[g.token].push(g);
  });
  return out;
}

function getGuestListRows() {
  const sheet = getGuestListSheet();
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue; // skip blank rows
    out.push({
      guestId:     r[0],
      firstName:   (r[1] || '').toString().trim(),
      lastName:    (r[2] || '').toString().trim(),
      householdId: r[3],
      token:       (r[4] || '').toString().trim(),
      partySize:   r[5],
      side:        r[6],
      language:    r[7],
      email:       r[8],
      phone:       r[9],
      rsvpStatus:  r[10],
      note:        r[11],
      address:     (r[12] || '').toString().trim(),
      country:     (r[13] || '').toString().trim(),
      nameTokens:  tokenize(normalizeName([r[1], r[2]].join(' '))),
    });
  }
  return out;
}

// ══════════════════════════════════════════════════
// COMPARING AN UPDATED CARTON LIST AGAINST THE LIVE ONE
//
// Set CARTONS_TAB to the tab holding the corrected invitation list in its
// original per-card form (Prénom / Nom / Supplément / Prénom Femme / Nb,
// with an "Invit" tag), then run compareGuestLists() from the editor. It
// expands those cards into individual people the same way the first import
// did and writes a report tab listing who to add and who to remove.
//
// It only ever reads. Nothing on Invites is changed.
// ══════════════════════════════════════════════════

// The NAME OF YOUR TAB goes inside the quotes below — "CARTONS_TAB" is this
// setting's name in the script, not a name to give the tab. If your tab is
// called something else, either rename it to match or change the quoted text.
// Failing that, any tab whose row 1 has Prénom / Nom / Nb is found anyway.
const CARTONS_TAB = 'Cartons';        // tab with the updated per-card list
const COMPARE_REPORT_TAB = 'List comparison';

// Finds the updated per-card list. Tries the configured name first, then
// falls back to recognising the tab by its headers, so the comparison does
// not depend on what the tab happens to be called.
function getCartonsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const named = ss.getSheetByName(CARTONS_TAB);
  if (named) return named;

  const reserved = [SHEET_NAME, GUESTS_NAME, GUESTLIST_NAME, COMPARE_REPORT_TAB];
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    if (reserved.indexOf(sheet.getName()) !== -1) continue;
    if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) continue;
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function(h) { return (h || '').toString().toLowerCase().trim(); });
    const hasFirst = header.indexOf('prénom') !== -1 || header.indexOf('prenom') !== -1;
    const hasLast  = header.indexOf('nom') !== -1;
    const hasCount = header.indexOf('nb') !== -1;
    if (hasFirst && hasLast && hasCount) return sheet;
  }
  return null;
}

function compareGuestLists() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const cartons = getCartonsSheet();
  if (!cartons) {
    Logger.log('PROBLEM: could not find the updated card list.');
    Logger.log('Tabs present: ' + ss.getSheets().map(function(s) { return s.getName(); }).join(', '));
    Logger.log('CARTONS_TAB is a setting in this script, not the name of the tab. ' +
               'Either rename your tab to "' + CARTONS_TAB + '", or edit line ' +
               '`const CARTONS_TAB = \'' + CARTONS_TAB + '\';` so the quoted text ' +
               'matches your tab\'s real name.');
    Logger.log('The tab is also found automatically if row 1 contains the ' +
               'headers Prénom, Nom and Nb.');
    return;
  }
  Logger.log('Reading updated card list from tab "' + cartons.getName() + '".');

  const wanted  = expandCartons(cartons);            // from the updated list
  const current = getGuestListRows().filter(function(g) { return g.firstName || g.lastName; });

  if (wanted.length === 0) {
    Logger.log('PROBLEM: read 0 guests from "' + CARTONS_TAB + '". Expected columns ' +
               'Prénom / Nom / Supplément / Prénom Femme / Nb with an "Invit" tag.');
    return;
  }

  const key = function(o) { return normalizeName((o.firstName || '') + ' ' + (o.lastName || '')); };

  const currentByKey = {};
  current.forEach(function(g) {
    const k = key(g);
    if (!currentByKey[k]) currentByKey[k] = [];
    currentByKey[k].push(g);
  });
  const wantedByKey = {};
  wanted.forEach(function(g) {
    const k = key(g);
    if (!wantedByKey[k]) wantedByKey[k] = [];
    wantedByKey[k].push(g);
  });

  // Unnamed placeholder seats can't be compared by name; count them instead.
  const toAdd    = wanted.filter(function(g)  { return g.firstName && !currentByKey[key(g)]; });
  const toRemove = current.filter(function(g) { return g.firstName && !wantedByKey[key(g)]; });

  // A corrected spelling shows up as one removal plus one addition. Pair
  // those up so they aren't actioned as a delete and a re-add.
  // Anchor on the surname: same family plus a recognisably similar first
  // name is a corrected spelling, whereas two different people in one family
  // ("Marcus" vs "Anne-Françoise" Zuhorn) share a surname and nothing else.
  // A blended score over the whole name cannot separate those two cases.
  const renames = [];
  const addedUsed = {};
  toRemove.forEach(function(gone) {
    let best = null, bestScore = 0;
    toAdd.forEach(function(added, i) {
      if (addedUsed[i]) return;
      const surnameSim = nameRatio(normalizeName(gone.lastName),  normalizeName(added.lastName));
      const firstSim   = nameRatio(normalizeName(gone.firstName), normalizeName(added.firstName));
      if (surnameSim < 0.85 || firstSim < 0.5) return;
      const s = (surnameSim + firstSim) / 2;
      if (s > bestScore) { bestScore = s; best = { added: added, i: i }; }
    });
    if (best) {
      addedUsed[best.i] = true;
      renames.push({ from: gone, to: best.added, score: bestScore });
    }
  });
  const renamedFrom = {}, renamedTo = {};
  renames.forEach(function(r) { renamedFrom[key(r.from)] = true; renamedTo[key(r.to)] = true; });

  const realAdds    = toAdd.filter(function(g)    { return !renamedTo[key(g)]; });
  const realRemoves = toRemove.filter(function(g) { return !renamedFrom[key(g)]; });

  // ── write the report ──────────────────────────────
  let out = ss.getSheetByName(COMPARE_REPORT_TAB);
  if (out) out.clear(); else out = ss.insertSheet(COMPARE_REPORT_TAB);

  const rows = [['Action', 'First name', 'Last name', 'Household / context', 'Note']];
  realAdds.forEach(function(g) {
    rows.push(['ADD', g.firstName, g.lastName, g.card || '', 'in updated list, not on the site']);
  });
  realRemoves.forEach(function(g) {
    rows.push(['REMOVE', g.firstName, g.lastName, g.householdId || '',
               'on the site, not in the updated list']);
  });
  renames.forEach(function(r) {
    rows.push(['CHECK — renamed?', r.to.firstName, r.to.lastName, r.to.card || '',
               'was "' + r.from.firstName + ' ' + r.from.lastName + '" on the site']);
  });

  const wantedNamed  = wanted.filter(function(g) { return g.firstName; }).length;
  const currentNamed = current.filter(function(g) { return g.firstName; }).length;
  rows.push([]);
  rows.push(['SUMMARY', '', '', '',
             'updated list: ' + wanted.length + ' seats (' + wantedNamed + ' named) · ' +
             'site: ' + current.length + ' seats (' + currentNamed + ' named)']);

  out.getRange(1, 1, rows.length, 5).setValues(rows.map(function(r) {
    while (r.length < 5) r.push('');
    return r;
  }));
  out.setFrozenRows(1);

  Logger.log('To add: ' + realAdds.length + ' · to remove: ' + realRemoves.length +
             ' · possible renames: ' + renames.length);
  Logger.log('Updated list: ' + wanted.length + ' seats (' + wantedNamed + ' named). ' +
             'Site: ' + current.length + ' seats (' + currentNamed + ' named).');
  Logger.log('Full report written to the "' + COMPARE_REPORT_TAB + '" tab.');
}

// ── Carton parsing (mirrors the original import) ──

const CARTON_COUPLE_TITLES = ['mr et mme', 'm et mme', 'mr and mrs', 'herr und frau',
                              'monsieur et madame', 'mr & mme'];
const CARTON_SOLO_TITLES   = ['mademoiselle', 'monsieur', 'madame', 'melle', 'mlle', 'mrs',
                              'miss', 'herr', 'frau', 'mme', 'mr.', 'mr', 'ms', 'm.', 'dr'];
// French/English only: German "Frau Tina" is simply Ms Tina, not a husband's name.
const CARTON_WIFE_TITLES   = ['mme', 'madame', 'mrs'];
const CARTON_SEPARATORS    = /\s*(?:,|\+|\/|&|\bet\b|\band\b|\bund\b)\s*/i;
const CARTON_VAGUE         = /(et leurs enfants|and family|leurs enfants|^enfants\b|copine|\bamie?\b|xyz|nouvelle femme|soeur de pere)/i;

function cartonLeadingTitle(text) {
  const low = (text || '').toLowerCase().trim();
  for (let i = 0; i < CARTON_COUPLE_TITLES.length; i++) {
    if (low.indexOf(CARTON_COUPLE_TITLES[i]) === 0) return CARTON_COUPLE_TITLES[i];
  }
  for (let j = 0; j < CARTON_SOLO_TITLES.length; j++) {
    const t = CARTON_SOLO_TITLES[j];
    if (low.indexOf(t + ' ') === 0 || low === t) return t;
  }
  return '';
}

function cartonStripTitles(text) {
  let out = (text || '').trim();
  for (;;) {
    const t = cartonLeadingTitle(out);
    if (!t) return out.replace(/^[\s.,]+|[\s.,]+$/g, '');
    out = out.substring(t.length).replace(/^[\s.,]+/, '');
  }
}

function cartonSplitNames(text) {
  if (!text) return [];
  return text.split(CARTON_SEPARATORS)
    .map(function(p) { return cartonStripTitles(p); })
    .filter(function(n) { return n && !CARTON_VAGUE.test(n); });
}

function cartonHasCoupleTitle(text) {
  const low = (text || '').toLowerCase();
  for (let i = 0; i < CARTON_COUPLE_TITLES.length; i++) {
    if (low.indexOf(CARTON_COUPLE_TITLES[i]) !== -1) return true;
  }
  return false;
}

// Expand per-card rows into one entry per seat, matching the original import.
function expandCartons(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  // Locate columns by header name so a shifted layout still works.
  const header = rows[0].map(function(h) { return (h || '').toString().toLowerCase().trim(); });
  const taken = {};
  // Exact header matches first: "prénom" contains "nom", so a substring
  // search would resolve the surname column onto the first-name column.
  const find = function(names, fallback) {
    for (let j = 0; j < names.length; j++) {
      for (let i = 0; i < header.length; i++) {
        if (!taken[i] && header[i] === names[j]) { taken[i] = true; return i; }
      }
    }
    for (let j = 0; j < names.length; j++) {
      for (let i = 0; i < header.length; i++) {
        if (!taken[i] && header[i].indexOf(names[j]) !== -1) { taken[i] = true; return i; }
      }
    }
    taken[fallback] = true;
    return fallback;
  };
  const cTag   = find(['invite', 'invité'], 3);
  const cFirst = find(['prénom', 'prenom', 'first name', 'first'], 4);
  const cWife  = find(['prénom femme', 'prenom femme', 'femme', 'wife'], 7);
  const cLast  = find(['nom', 'last name', 'last', 'surname'], 5);
  const cExtra = find(['supplément', 'supplement'], 6);
  const cNb    = find(['nb', 'nombre', 'count'], 8);

  const S = function(v) { return v === null || v === undefined ? '' : v.toString().trim(); };

  // Learn which given names this sheet uses after a masculine title, to
  // resolve "Mme <name> + <name>" single-seat cards.
  const masculine = {};
  rows.slice(1).forEach(function(r) {
    const f = S(r[cFirst]).toLowerCase();
    if (/^(mr |monsieur |herr |m\. )/.test(f) && !cartonHasCoupleTitle(f)) {
      // Only the name directly after the title belongs to the man. Cards
      // like "Mr Gabriel + Margot" list a partner too, and counting those
      // would mark plainly feminine names as masculine.
      const parts = cartonSplitNames(cartonStripTitles(S(r[cFirst])));
      if (parts.length) masculine[parts[0].toLowerCase()] = true;
    }
  });

  const out = [];
  let cardCounter = 0;
  rows.slice(1).forEach(function(r) {
    if (S(r[cTag]) !== 'Invit') return;
    const first = S(r[cFirst]), extra = S(r[cExtra]), wife = S(r[cWife]);
    let last = S(r[cLast]);
    const nb = parseInt(S(r[cNb]), 10);
    if (!nb || nb < 1) return;

    let surnames = null;
    if (last.indexOf('/') !== -1) {
      const halves = last.split('/').map(function(h) { return h.trim(); }).filter(Boolean);
      if (halves.length === 2 && nb === 2) surnames = halves;
    }
    if (/\(/.test(last)) last = last.replace(/\s*\(.*?\)/g, '').trim();
    if (/^vient de se marier/i.test(last)) last = '';

    let names = [];
    if (nb === 1 && wife) {
      const t = cartonLeadingTitle(first);
      const titleName = cartonStripTitles(first);
      if (CARTON_WIFE_TITLES.indexOf(t) !== -1) {
        names = (masculine[wife.toLowerCase()] && !masculine[titleName.toLowerCase()])
          ? [titleName] : [wife];
      } else {
        names = cartonSplitNames(first);
      }
    } else {
      names = (surnames && first.indexOf('/') !== -1)
        ? first.split('/').map(function(h) { return cartonStripTitles(h); })
        : cartonSplitNames(first);
      if (wife && names.indexOf(wife) === -1) names = names.concat(cartonSplitNames(wife));
    }
    if (extra && !CARTON_VAGUE.test(extra)) names = names.concat(cartonSplitNames(extra));
    names = names.filter(Boolean);

    const cardLabel = (names[0] ? names[0] + ' ' : '') + last;
    cardCounter += 1;
    for (let seat = 0; seat < nb; seat++) {
      let fn = (names[seat] || '').replace(/[\s?]+$/, '').trim();
      let ln = surnames ? (surnames[Math.min(seat, surnames.length - 1)]) : last;
      if (fn && !ln && fn.indexOf(' ') !== -1) {
        const bits = fn.split(/\s+/);
        fn = bits[0];
        ln = bits.slice(1).join(' ');
      }
      out.push({ firstName: fn, lastName: ln, card: cardLabel.trim(),
                 cardIndex: cardCounter, partySize: nb });
    }
  });
  return out;
}

// ── Fuzzy matching helpers ────────────────────────

const NAME_STOPWORDS = ['mr', 'mrs', 'ms', 'mme', 'melle', 'mlle', 'herr', 'frau', 'and', 'und', 'et', 'the'];

function normalizeName(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(normalized) {
  return normalized.split(' ').filter(function(t) {
    return t.length >= 2 && NAME_STOPWORDS.indexOf(t) === -1;
  });
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = [], curr = [];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[n];
}

// Plain edit-distance ratio with no cutoff, for judging how close two single
// names are. tokenSimilarity() zeroes anything under 0.72, which is right for
// search but hides the near-misses that a spelling correction produces.
function nameRatio(a, b) {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function tokenSimilarity(a, b) {
  if (a === b) return 1;
  // Require both tokens to have some real length before granting credit for
  // one containing the other — otherwise short name particles ("von", "de",
  // "van") match as a substring of almost anything and cause false positives.
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 4 && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1)) return 0.85;
  const ratio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return ratio >= 0.72 ? ratio : 0;
}

function scoreHousehold(queryTokens, blobTokens) {
  if (queryTokens.length === 0 || blobTokens.length === 0) return 0;
  // Weight each query token's contribution by its length, so a matched
  // surname (usually longer, more identifying) outweighs a mismatched or
  // missing short first name rather than being diluted by a plain average.
  let weightedTotal = 0, weightSum = 0;
  queryTokens.forEach(function(qt) {
    let best = 0;
    blobTokens.forEach(function(bt) {
      const sim = tokenSimilarity(qt, bt);
      if (sim > best) best = sim;
    });
    weightedTotal += best * qt.length;
    weightSum += qt.length;
  });
  return weightSum === 0 ? 0 : weightedTotal / weightSum;
}

// ── Guests sheet ──────────────────────────────────
// One row per attendee — easy to filter/sort for headcount.
// Columns: RSVP ID | Submitted | First Name | Last Name | Status |
//          Household Email | Contact First | Contact Last | Relationship |
//          Allergies

function writeGuests(id, submitted, data, isUpdate) {
  const sheet = getGuestsSheet();

  if (isUpdate) {
    // Remove existing rows for this RSVP ID (iterate backwards to avoid index shift)
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] === id) sheet.deleteRow(i + 1);
    }
  }

  const attendees = data.attendees || [];
  attendees.forEach(function(a) {
    sheet.appendRow([
      id,
      submitted,
      a.firstName,
      a.lastName,
      a.status,
      data.email,
      data.firstName,
      data.lastName,
      a.relationship || '',
      a.allergies || '',
    ]);
  });
}

// ── Email ─────────────────────────────────────────
// Wrapped so a mail-quota hiccup or bad address never masks a save that
// already succeeded — the RSVP is safe in the sheet either way.

function trySendEmail(data, editUrl, isUpdate) {
  try {
    sendEmail(data, editUrl, isUpdate);
    return true;
  } catch (err) {
    return false;
  }
}

// Confirmation emails go out in whichever language the guest filled the form
// in — `lang` is sent with the submission. Anything unrecognised falls back
// to English rather than failing.
const EMAIL_TEXT = {
  en: {
    status:   { yes: 'With joy, I will be there',
                maybe: 'I hope to attend',
                no: 'Regretfully, I will not be able to join' },
    subject:  { create: "Your RSVP to Éléonore & Hubert's wedding",
                update: "Your updated RSVP – Éléonore & Hubert's wedding" },
    greeting: function(n) { return 'Thank you, ' + n + '.'; },
    intro:    function(u) {
      return 'You have successfully ' + (u ? 'updated your RSVP' : "RSVP'd") +
             " to Éléonore & Hubert's wedding on 26 June 2027 in Crillon-le-Brave, Provence.";
    },
    response: 'Your response:',
    editNote: 'Need to make a change? Use your personal edit link:',
    signoff:  'With warmth,\nÉléonore & Hubert',
  },
  fr: {
    status:   { yes: 'Avec joie, je serai présent(e)',
                maybe: "J'espère pouvoir venir",
                no: 'À mon grand regret, je ne pourrai pas être présent(e)' },
    subject:  { create: "Votre réponse au mariage d'Éléonore & Hubert",
                update: "Votre réponse modifiée – mariage d'Éléonore & Hubert" },
    greeting: function(n) { return 'Merci, ' + n + '.'; },
    intro:    function(u) {
      return 'Nous avons bien enregistré ' + (u ? 'la modification de votre réponse' : 'votre réponse') +
             " pour le mariage d'Éléonore & Hubert, le 26 juin 2027 à Crillon-le-Brave, en Provence.";
    },
    response: 'Votre réponse :',
    editNote: 'Besoin de faire un changement ? Utilisez votre lien personnel :',
    signoff:  'Avec toute notre affection,\nÉléonore & Hubert',
  },
  de: {
    status:   { yes: 'Mit Freude, ich werde da sein',
                maybe: 'Ich hoffe, dabei sein zu können',
                no: 'Leider kann ich nicht teilnehmen' },
    subject:  { create: 'Ihre Zusage zur Hochzeit von Éléonore & Hubert',
                update: 'Ihre geänderte Antwort – Hochzeit von Éléonore & Hubert' },
    greeting: function(n) { return 'Vielen Dank, ' + n + '.'; },
    intro:    function(u) {
      return 'Wir haben ' + (u ? 'Ihre geänderte Antwort' : 'Ihre Antwort') +
             ' zur Hochzeit von Éléonore & Hubert am 26. Juni 2027 in Crillon-le-Brave, Provence, erhalten.';
    },
    response: 'Ihre Antwort:',
    editNote: 'Möchten Sie etwas ändern? Nutzen Sie Ihren persönlichen Link:',
    signoff:  'Herzliche Grüße,\nÉléonore & Hubert',
  },
};

function sendEmail(data, editUrl, isUpdate) {
  const t = EMAIL_TEXT[(data.lang || 'en').toLowerCase()] || EMAIL_TEXT.en;

  const lines = (data.attendees || [])
    .map(function(a) {
      return '  • ' + a.firstName + ' ' + a.lastName + ' — ' +
             (t.status[a.status] || a.status);
    })
    .join('\n');

  const subject = isUpdate ? t.subject.update : t.subject.create;

  const body = t.greeting((data.firstName + ' ' + data.lastName).trim()) + '\n\n' +
               t.intro(isUpdate) + '\n\n' +
               t.response + '\n' + lines + '\n\n' +
               t.editNote + '\n' + editUrl + '\n\n' +
               t.signoff;

  MailApp.sendEmail({ to: data.email, subject: subject, body: body, name: SENDER_NAME });
}

// ── Helpers ───────────────────────────────────────

// Country is appended rather than slotted in next to Address on purpose:
// inserting a column mid-row would shift Edit Token and Household Token,
// which are read by index and already hold live values.
const RSVP_HEADERS = [
  'ID', 'Submitted', 'Email', 'Last Name', 'First Name(s)',
  'Address', 'Attendees (JSON)', 'Edit Token', 'Updated', 'Household Token',
  'Country',
];
const GUEST_HEADERS = [
  'RSVP ID', 'Submitted', 'First Name', 'Last Name', 'Status',
  'Household Email', 'Contact First', 'Contact Last', 'Relationship', 'Allergies',
];

// Headers used to be written only when a tab was first created, so tabs that
// already existed never picked up columns added later (Household Token,
// Relationship). Top them up in place without touching any guest data.
function ensureHeaders(sheet, headers) {
  const width = sheet.getLastColumn();
  const current = width > 0
    ? sheet.getRange(1, 1, 1, width).getValues()[0]
    : [];
  let changed = false;
  for (let i = 0; i < headers.length; i++) {
    if ((current[i] || '').toString().trim() !== headers[i]) {
      current[i] = headers[i];
      changed = true;
    }
  }
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(RSVP_HEADERS);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet, RSVP_HEADERS);
  }
  return sheet;
}

// The guest-list tab is read-only input that a human maintains, so it is
// never auto-created — if it is missing or renamed we must fail loudly
// rather than silently behave as though nobody was invited.
const GUESTLIST_FALLBACK_NAMES = ['Invites', 'people', 'Sheet1', 'GuestList', 'Guest List'];

function getGuestListSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const names = [GUESTLIST_NAME].concat(GUESTLIST_FALLBACK_NAMES);
  for (let i = 0; i < names.length; i++) {
    const sheet = ss.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

// Call this from the Apps Script editor after pasting the guest list to
// confirm the backend can actually see it. Logs a one-line summary.
function checkSetup() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const tabs  = ss.getSheets().map(function(s) { return s.getName(); });
  const sheet = getGuestListSheet();
  if (!sheet) {
    Logger.log('PROBLEM: no guest-list tab found. Tabs present: ' + tabs.join(', ') +
               '. Set GUESTLIST_NAME to whichever holds the guest list.');
    return;
  }
  const rows       = getGuestListRows();
  const households = Object.keys(groupHouseholds()).length;
  const named      = rows.filter(function(r) { return r.firstName; }).length;
  const noToken    = rows.filter(function(r) { return !r.token; }).length;
  Logger.log('Guest list tab "' + sheet.getName() + '": ' + rows.length + ' guests, ' +
             households + ' households, ' + named + ' named, ' +
             noToken + ' rows missing a household_token.');
  Logger.log('Tabs present: ' + tabs.join(', '));

  if (rows.length === 0) {
    Logger.log('PROBLEM: the tab was found but no guest rows were read. Check that ' +
               'row 1 is the header and that column A holds guest_id (G001...).');
    return;
  }
  const sample = rows[0];
  Logger.log('First data row reads as: first_name="' + sample.firstName +
             '", last_name="' + sample.lastName + '", household_token="' +
             sample.token + '". If those look shifted, the columns are out of order.');
}

// ══════════════════════════════════════════════════
// FILLING IN NEW GUESTS
//
// Add new people to the Invites tab typing ONLY first_name and last_name.
// To put several people on one invitation, write the same short label in
// household_id for each of them — anything at all ("new1", "Dupont", "a").
// Leave household_id blank and the person becomes their own household.
//
// Then run fillNewGuests(). It assigns the next guest_id (G609, G610…), the
// next household_id (H370…), one shared household_token per invitation,
// party_size, and rsvp_status = Pending. Rows that already have a token are
// never touched, so it is safe to run repeatedly.
// ══════════════════════════════════════════════════

function fillNewGuests() {
  const sheet = getGuestListSheet();
  if (!sheet) { Logger.log('PROBLEM: no guest-list tab found.'); return; }

  const rows = sheet.getDataRange().getValues();
  const S = function(v) { return v === null || v === undefined ? '' : v.toString().trim(); };

  // Continue the existing numbering rather than restarting it.
  let maxG = 0, maxH = 0;
  const usedTokens = {};
  rows.slice(1).forEach(function(r) {
    const g = S(r[0]).match(/^G(\d+)$/i);
    if (g) maxG = Math.max(maxG, parseInt(g[1], 10));
    const h = S(r[3]).match(/^H(\d+)$/i);
    if (h) maxH = Math.max(maxH, parseInt(h[1], 10));
    if (S(r[4])) usedTokens[S(r[4])] = true;
  });

  // Group the new rows by whatever label was typed in household_id.
  const groups = {};
  const order = [];
  let loose = 0;
  rows.forEach(function(r, i) {
    if (i === 0) return;                              // header
    if (S(r[4])) return;                              // already has a token
    if (!S(r[1]) && !S(r[2])) return;                 // blank row
    const label = S(r[3]) || ('__own_' + (loose++));  // blank = its own household
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(i);                            // 0-based row index
  });

  if (order.length === 0) {
    Logger.log('Nothing to do — every named row already has a household_token.');
    return;
  }

  const summary = [];
  order.forEach(function(label) {
    const idxs = groups[label];
    maxH += 1;
    const householdId = 'H' + ('00' + maxH).slice(-3);

    let token;
    do { token = generateToken(); } while (usedTokens[token]);
    usedTokens[token] = true;

    idxs.forEach(function(rowIdx) {
      maxG += 1;
      const guestId = 'G' + ('00' + maxG).slice(-3);
      const r = rowIdx + 1;                            // 1-based for getRange
      sheet.getRange(r, 1).setValue(guestId);          // guest_id
      sheet.getRange(r, 4).setValue(householdId);      // household_id
      sheet.getRange(r, 5).setValue(token);            // household_token
      sheet.getRange(r, 6).setValue(idxs.length);      // party_size
      if (!S(rows[rowIdx][10])) sheet.getRange(r, 11).setValue('Pending');
    });

    const names = idxs.map(function(i) {
      return (S(rows[i][1]) + ' ' + S(rows[i][2])).trim();
    }).join(' & ');
    summary.push(householdId + ' (' + idxs.length + '): ' + names);
  });

  Logger.log('Filled ' + order.length + ' new household(s):');
  summary.forEach(function(line) { Logger.log('  ' + line); });
  Logger.log('Now run checkInvites() to confirm the list is still consistent.');
}

// ══════════════════════════════════════════════════
// REBUILDING THE GUEST LIST FROM THE CARD LIST
//
// Treats the carton tab as the single source of truth and regenerates
// Invites from it. Tokens are preserved for every household that still has
// a member in common with the old list, so nobody who has already been
// recognised loses that. Any email, phone or rsvp_status already recorded
// against a person is carried across by name.
//
// This REPLACES the Invites tab. Run compareGuestLists() first to see what
// will change, and duplicate the tab if you want a manual backup.
// ══════════════════════════════════════════════════

// If any member of a rebuilt household already had an address or country
// recorded, reuse it for the whole household rather than losing it.
function householdKnownField(members, perPerson, key) {
  for (let i = 0; i < members.length; i++) {
    if (!members[i].firstName) continue;
    const k = normalizeName(members[i].firstName + ' ' + members[i].lastName);
    const known = k && perPerson[k];
    if (known && known[key]) return known[key];
  }
  return '';
}

function rebuildInvitesFromCartons() {
  const cartons = getCartonsSheet();
  if (!cartons) { Logger.log('PROBLEM: could not find the updated card list.'); return; }
  const sheet = getGuestListSheet();
  if (!sheet) { Logger.log('PROBLEM: no guest-list tab found.'); return; }

  const people = expandCartons(cartons);
  if (people.length === 0) {
    Logger.log('PROBLEM: read 0 guests from "' + cartons.getName() + '". Nothing written.');
    return;
  }

  // What we already know, keyed by person and by household.
  // Keyed on named people only. An unnamed placeholder normalises to just a
  // surname, which several households share — matching on that would hand one
  // family's token to another and silently merge them. Names that map to more
  // than one household are dropped for the same reason.
  const existing = getGuestListRows();
  const perPerson = {};
  const tokenByName = {};
  const ambiguous = {};
  existing.forEach(function(g) {
    if (!g.firstName) return;
    const k = normalizeName(g.firstName + ' ' + g.lastName);
    if (!k) return;
    perPerson[k] = { email: g.email, phone: g.phone, rsvpStatus: g.rsvpStatus,
                     side: g.side, language: g.language, address: g.address,
                     country: g.country };
    if (!g.token) return;
    if (tokenByName[k] && tokenByName[k] !== g.token) ambiguous[k] = true;
    else tokenByName[k] = g.token;
  });
  Object.keys(ambiguous).forEach(function(k) { delete tokenByName[k]; });
  const usedTokens = {};
  existing.forEach(function(g) { if (g.token) usedTokens[g.token] = true; });

  // Group the freshly parsed people into households.
  const cards = {};
  const cardOrder = [];
  people.forEach(function(p) {
    if (!cards[p.cardIndex]) { cards[p.cardIndex] = []; cardOrder.push(p.cardIndex); }
    cards[p.cardIndex].push(p);
  });

  const out = [[
    'guest_id', 'first_name', 'last_name', 'household_id', 'household_token',
    'party_size', 'side', 'language', 'email', 'phone', 'rsvp_status', 'note',
    'address', 'country',
  ]];
  let gid = 0, hid = 0, reused = 0, fresh = 0;

  cardOrder.forEach(function(ci) {
    const members = cards[ci];
    hid += 1;

    // Reuse the token of any household that still shares a member, so
    // recognition survives edits elsewhere on the card.
    let token = '';
    for (let i = 0; i < members.length && !token; i++) {
      if (!members[i].firstName) continue;   // placeholders identify nobody
      const k = normalizeName(members[i].firstName + ' ' + members[i].lastName);
      if (k && tokenByName[k]) token = tokenByName[k];
    }
    if (token) { reused += 1; }
    else {
      do { token = generateToken(); } while (usedTokens[token]);
      fresh += 1;
    }
    usedTokens[token] = true;

    members.forEach(function(m) {
      gid += 1;
      const k = normalizeName(m.firstName + ' ' + m.lastName);
      const known = (k && perPerson[k]) || {};
      out.push([
        'G' + ('00' + gid).slice(-3),
        m.firstName,
        m.lastName,
        'H' + ('00' + hid).slice(-3),
        token,
        members.length,
        known.side || '',
        known.language || '',
        known.email || '',
        known.phone || '',
        known.rsvpStatus || 'Pending',
        m.firstName ? '' : 'name not in source',
        known.address || householdKnownField(members, perPerson, 'address'),
        known.country || householdKnownField(members, perPerson, 'country'),
      ]);
    });
  });

  sheet.clear();
  sheet.getRange(1, 1, out.length, out[0].length).setValues(out);
  sheet.setFrozenRows(1);

  Logger.log('Rebuilt "' + sheet.getName() + '": ' + (out.length - 1) + ' guests across ' +
             hid + ' households.');
  Logger.log('Tokens reused: ' + reused + ' household(s) · newly generated: ' + fresh + '.');
  Logger.log('Carried over email/phone/status for ' + Object.keys(perPerson).length +
             ' previously-known people where the name still matches.');
  Logger.log('Side, language and address are not in the card list; existing values were kept.');
  Logger.log('Run checkInvites() to confirm.');
}

// Sanity check for the guest list — run after any manual editing.
function checkInvites() {
  const sheet = getGuestListSheet();
  if (!sheet) { Logger.log('PROBLEM: no guest-list tab found.'); return; }

  const rows = sheet.getDataRange().getValues();
  const S = function(v) { return v === null || v === undefined ? '' : v.toString().trim(); };
  const problems = [];
  const seenGuestIds = {};
  const households = {};

  rows.forEach(function(r, i) {
    if (i === 0) return;
    const line = i + 1;
    const named = S(r[1]) || S(r[2]);
    const id = S(r[0]), token = S(r[4]);

    if (!named && !id && !token) return;               // genuinely blank row

    if (!id)          problems.push('Row ' + line + ': no guest_id — this row is ignored by the site.');
    else if (seenGuestIds[id]) problems.push('Row ' + line + ': duplicate guest_id "' + id + '".');
    seenGuestIds[id] = true;

    if (!token)       problems.push('Row ' + line + ': no household_token — this person cannot be found by search.');
    if (!named)       problems.push('Row ' + line + ': has an id but no name.');

    if (token) {
      if (!households[token]) households[token] = { rows: [], sizes: {} };
      households[token].rows.push(line);
      households[token].sizes[S(r[5])] = true;
    }
  });

  Object.keys(households).forEach(function(tok) {
    const h = households[tok];
    const sizes = Object.keys(h.sizes);
    if (sizes.length > 1) {
      problems.push('Token …' + tok.slice(-6) + ' (rows ' + h.rows.join(', ') +
                    '): party_size disagrees between members (' + sizes.join(' vs ') + ').');
    } else if (sizes[0] && parseInt(sizes[0], 10) !== h.rows.length) {
      problems.push('Token …' + tok.slice(-6) + ': party_size says ' + sizes[0] +
                    ' but ' + h.rows.length + ' row(s) carry that token (rows ' + h.rows.join(', ') + ').');
    }
  });

  const guests = getGuestListRows();
  Logger.log(guests.length + ' guests · ' + Object.keys(households).length + ' households · ' +
             guests.filter(function(g) { return g.firstName; }).length + ' named.');
  if (problems.length === 0) {
    Logger.log('No problems found.');
  } else {
    Logger.log(problems.length + ' problem(s):');
    problems.forEach(function(p) { Logger.log('  ' + p); });
  }
}

// Runs the real search inside the editor, with no website and no deployment
// involved. If this finds names but the site does not, the problem is the
// deployment URL — not the data and not the matching.
function testSearch() {
  ['Albrecht', 'de Reynal', 'Fabre'].forEach(function(q) {
    const res = lookupByName({ name: q });
    const matches = res.matches || [];
    Logger.log('"' + q + '" -> ' + matches.length + ' match(es)' +
               (matches.length ? ': ' + matches.map(function(m) { return m.label; }).join(' | ') : ''));
  });
}

function getGuestsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(GUESTS_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GUESTS_NAME);
    sheet.appendRow(GUEST_HEADERS);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet, GUEST_HEADERS);
  }
  return sheet;
}

// ── Song suggestions ──────────────────────────────
//
// Anyone on the site can suggest a track from the welcome page. The name is
// whatever the recogniser already knows about them; unrecognised visitors
// suggest anonymously, which is fine — we only ever display the list.
//
// Songs columns:
//   0 Submitted   1 Title   2 Suggested By   3 Household Token

const SONG_HEADERS = ['Submitted', 'Song', 'Suggested By', 'Household Token'];

const SONG_MAX_LEN   = 160;  // long enough for "Artist — Title (Live at …)"
const SONG_LIST_MAX  = 200;  // most recent suggestions returned to the page

function getSongsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SONGS_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SONGS_NAME);
    sheet.appendRow(SONG_HEADERS);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet, SONG_HEADERS);
  }
  return sheet;
}

// Trim, collapse whitespace and cap the length so one guest cannot paste an
// essay into the sheet or the popup.
function cleanSongText(v, max) {
  return (v || '').toString().replace(/\s+/g, ' ').trim().slice(0, max);
}

function songKey(title) {
  return normalizeName(title).replace(/[^a-z0-9]+/g, '');
}

function addSong(data) {
  const title = cleanSongText(data.song, SONG_MAX_LEN);
  if (!title) return { error: 'Empty song' };

  const sheet = getSongsSheet();
  const rows  = sheet.getDataRange().getValues();
  const key   = songKey(title);

  // Two people asking for the same track is common; keep the first entry so
  // the list stays a list of songs rather than a tally.
  for (let i = 1; i < rows.length; i++) {
    if (songKey(rows[i][1]) === key) {
      return { success: true, duplicate: true, songs: readSongs(rows) };
    }
  }

  const row = [
    new Date(),
    title,
    cleanSongText(data.name, 80),
    (data.householdToken || '').toString().trim(),
  ];
  sheet.appendRow(row);
  rows.push(row);
  return { success: true, songs: readSongs(rows) };
}

function listSongs() {
  return { success: true, songs: readSongs(getSongsSheet().getDataRange().getValues()) };
}

// Newest first, and only the fields the page actually shows — the household
// token stays in the sheet so we can trace an entry, but is never sent back.
function readSongs(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const title = cleanSongText(rows[i][1], SONG_MAX_LEN);
    if (title) out.push({ song: title, name: cleanSongText(rows[i][2], 80) });
  }
  return out.reverse().slice(0, SONG_LIST_MAX);
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 24; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

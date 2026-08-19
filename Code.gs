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
const GUESTLIST_NAME = 'Sheet1';
const WEBSITE_URL    = 'https://eleonorehubert2027.netlify.app';
const SENDER_NAME    = 'Éléonore & Hubert';

// ── Entry points ─────────────────────────────────

function doGet(e) {
  const token  = (e.parameter || {}).token;
  const result = token ? getByToken(token) : { error: 'No token' };
  return jsonOut(result);
}

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    if      (action === 'submit')        result = handleSubmit(data);
    else if (action === 'update')        result = handleUpdate(data);
    else if (action === 'lookupByName')  result = lookupByName(data);
    else if (action === 'lookupByToken') result = lookupByToken(data);
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
          attendees:      JSON.parse(rows[i][6] || '[]'),
          householdToken: rows[i][9] || '',
        },
      };
    }
  }
  return { error: 'Not found' };
}

// ── Guest recognition (name lookup, no login) ─────
// Matches a typed name against the pre-loaded household list (Sheet1) so
// returning visitors can be greeted without an account or an emailed link.
// Matching is fuzzy (accent/typo tolerant) and returns candidates for the
// guest to confirm — it never silently assumes a match.

function lookupByName(data) {
  const qTokens = tokenize(normalizeName(data && data.name));
  if (qTokens.length === 0) return { success: true, matches: [] };

  const scored = getGuestListRows()
    .map(function(h) { return { h: h, score: scoreHousehold(qTokens, h.blobTokens) }; })
    .filter(function(x) { return x.score >= 0.55; });

  scored.sort(function(a, b) { return b.score - a.score; });

  const matches = scored.slice(0, 5).map(function(x) {
    return {
      token:     x.h.token,
      label:     buildHouseholdLabel(x.h),
      partySize: x.h.partySize,
    };
  });

  return { success: true, matches: matches };
}

function lookupByToken(data) {
  const token = ((data && data.householdToken) || '').trim();
  if (!token) return { error: 'Missing token' };

  const household = getGuestListRows().filter(function(h) { return h.token === token; })[0];
  if (!household) return { error: 'Not found' };

  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][9] || '').toString().trim() === token) {
      return {
        success:   true,
        status:    'responded',
        label:     buildHouseholdLabel(household),
        editToken: rows[i][7],
        data: {
          email:     rows[i][2],
          lastName:  rows[i][3],
          firstName: rows[i][4],
          address:   rows[i][5],
          attendees: JSON.parse(rows[i][6] || '[]'),
        },
      };
    }
  }

  return {
    success:   true,
    status:    'pending',
    label:     buildHouseholdLabel(household),
    partySize: household.partySize,
  };
}

function markHouseholdResponded(householdToken) {
  if (!householdToken || householdToken === 'Self-added') return;
  const sheet = getGuestListSheet();
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][8] || '').toString().trim() === householdToken) {
      sheet.getRange(i + 1, 10).setValue('Responded');
      return;
    }
  }
}

function buildHouseholdLabel(h) {
  const names = (h.guestNames || '').trim();
  return names ? `${names} ${h.lastName}`.trim() : h.lastName;
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
      householdId: r[0],
      lastName:    r[1],
      guestNames:  r[2],
      partySize:   r[3],
      side:        r[4],
      language:    r[5],
      token:       r[8],
      rsvpStatus:  r[9],
      blobTokens:  tokenize(normalizeName([r[1], r[2]].join(' '))),
    });
  }
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
//          Household Email | Contact First | Contact Last | Relationship

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

function sendEmail(data, editUrl, isUpdate) {
  const statusLabel = {
    yes:   'With joy, I will be there',
    maybe: 'I hope to attend',
    no:    'Regretfully, I will not be able to join',
  };

  const lines = (data.attendees || [])
    .map(a => `  • ${a.firstName} ${a.lastName} — ${statusLabel[a.status] || a.status}`)
    .join('\n');

  const subject = isUpdate
    ? `Your updated RSVP – Éléonore & Hubert's wedding`
    : `Your RSVP to Éléonore & Hubert's wedding`;

  const body = `Thank you, ${data.firstName} ${data.lastName}.

You have successfully ${isUpdate ? 'updated your RSVP' : "RSVP'd"} to Éléonore & Hubert's wedding on 26 June 2027 in Crillon-le-Brave, Provence.

Your response:
${lines}

Need to make a change? Use your personal edit link:
${editUrl}

With warmth,
Éléonore & Hubert`;

  MailApp.sendEmail({ to: data.email, subject, body, name: SENDER_NAME });
}

// ── Helpers ───────────────────────────────────────

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'ID', 'Submitted', 'Email', 'Last Name', 'First Name(s)',
      'Address', 'Attendees (JSON)', 'Edit Token', 'Updated', 'Household Token',
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getGuestListSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(GUESTLIST_NAME) || null;
}

function getGuestsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(GUESTS_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GUESTS_NAME);
    sheet.appendRow([
      'RSVP ID', 'Submitted', 'First Name', 'Last Name', 'Status',
      'Household Email', 'Contact First', 'Contact Last', 'Relationship',
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
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

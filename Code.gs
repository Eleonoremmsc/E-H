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

const SHEET_ID    = '1DgTfgjqHhAbPp5FPUCfmVoiwKjCCI348BPl_iIcHhDk';
const SHEET_NAME  = 'RSVPs';
const GUESTS_NAME = 'Guests';
const WEBSITE_URL = 'https://delicate-frangipane-f07d0a.netlify.app';
const SENDER_NAME = 'Éléonore & Hubert';

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
    if      (action === 'submit') result = handleSubmit(data);
    else if (action === 'update') result = handleUpdate(data);
    else                          result = { error: 'Unknown action' };
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

// ── Handlers ──────────────────────────────────────

function handleSubmit(data) {
  const sheet   = getSheet();
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
  ]);

  writeGuests(id, now, data);

  sendEmail(data, editUrl, false);
  return { success: true, token, editUrl };
}

function handleUpdate(data) {
  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  const token = data.token;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === token) {
      const row = i + 1;
      const id  = rows[i][0];
      const submitted = rows[i][1];

      sheet.getRange(row, 3).setValue(data.email);
      sheet.getRange(row, 4).setValue(data.lastName);
      sheet.getRange(row, 5).setValue(data.firstName);
      sheet.getRange(row, 6).setValue(data.address);
      sheet.getRange(row, 7).setValue(JSON.stringify(data.attendees || []));
      sheet.getRange(row, 9).setValue(new Date().toISOString());

      writeGuests(id, submitted, data, true);

      const editUrl = `${WEBSITE_URL}?rsvp=${token}`;
      sendEmail(data, editUrl, true);
      return { success: true, token, editUrl };
    }
  }
  return { error: 'RSVP not found' };
}

function getByToken(token) {
  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === token) {
      return {
        success: true,
        data: {
          email:     rows[i][2],
          lastName:  rows[i][3],
          firstName: rows[i][4],
          address:    rows[i][5],
          attendees:  JSON.parse(rows[i][6] || '[]'),
        },
      };
    }
  }
  return { error: 'Not found' };
}

// ── Guests sheet ──────────────────────────────────
// One row per attendee — easy to filter/sort for headcount.
// Columns: RSVP ID | Submitted | First Name | Last Name | Status |
//          Household Email | Contact First | Contact Last

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
    ]);
  });
}

// ── Email ─────────────────────────────────────────

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
      'Address', 'Attendees (JSON)', 'Edit Token', 'Updated',
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getGuestsSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(GUESTS_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GUESTS_NAME);
    sheet.appendRow([
      'RSVP ID', 'Submitted', 'First Name', 'Last Name', 'Status',
      'Household Email', 'Contact First', 'Contact Last',
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

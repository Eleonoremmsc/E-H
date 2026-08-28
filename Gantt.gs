// ================================================
// Éléonore & Hubert — Gantt weekly reminders
// Google Apps Script, time-driven triggers
//
// Reads the "Gantt Diagram" tab of the planning sheet. A task counts as
// scheduled for a week when its cell in that week's column is highlighted
// (any fill colour other than white / the header grey).
//
// It then puts three all-day events on the calendar each week:
//   Wednesday — finish this week's (A) tasks
//   Friday    — here are next week's (B) tasks
//   Sunday    — note progress on A, look ahead to B
//
// SETUP:
// 1. Open the planning sheet → Extensions → Apps Script
// 2. Paste this file in, save
// 3. Run installTriggers() once and accept the permission prompts
//    (Sheets, Calendar and Gmail — Gmail is only used if a calendar
//     write fails, see SEND_EMAIL_COPY below)
// 4. Check the Triggers panel: three weekly triggers should be listed
//
// To take it back out again, run removeTriggers().
// ================================================

const GANTT_SHEET_ID = '1Dip2pgaRMZb8nokqAV9Cr6vNsxmZBwCxtm2vxfgGLjA';
const GANTT_TAB      = 'Gantt Diagram';
const GANTT_URL      = 'https://docs.google.com/spreadsheets/d/' +
                       GANTT_SHEET_ID + '/edit#gid=0';
const WEDDING_DATE   = new Date(2027, 5, 26);   // 26 June 2027

// Calendar the events land on. Named outright rather than left to the
// default, so the reminders go here even if the script is ever installed
// or re-run from another account.
const CALENDAR_ID    = 'eleonorehubert2027@gmail.com';

// Fill colours that are NOT a highlight: the empty default and the grey
// used on the header band. Anything else in a week column marks the task
// as scheduled for that week, so changing highlight colour still works.
const NOT_HIGHLIGHT  = ['#ffffff', '#fff', '', 'none', '#f3f3f3'];

// Events are all-day, so they show on the right date whatever timezone
// the phone or laptop happens to be in. The hours below only decide when
// the script wakes up to write them.
const RUN_HOUR       = 8;

// Set to true to also get every reminder by email. Left false, email is
// only used as a fallback when the calendar write fails.
const SEND_EMAIL_COPY = false;

// ── Triggers ──────────────────────────────────────

function installTriggers() {
  // Fail here rather than falling back to email every week without saying so.
  if (!targetCalendar()) {
    throw new Error('Cannot reach the calendar "' + CALENDAR_ID + '" as ' +
      Session.getEffectiveUser().getEmail() + '. Open the planning sheet from ' +
      'that account, or share the calendar with this one.');
  }
  removeTriggers();
  const days = [
    ['runWednesday', ScriptApp.WeekDay.WEDNESDAY],
    ['runFriday',    ScriptApp.WeekDay.FRIDAY],
    ['runSunday',    ScriptApp.WeekDay.SUNDAY],
  ];
  days.forEach(function (pair) {
    ScriptApp.newTrigger(pair[0])
      .timeBased()
      .onWeekDay(pair[1])
      .atHour(RUN_HOUR)
      .create();
  });
  return 'Installed ' + days.length + ' weekly triggers at ' + RUN_HOUR + ':00.';
}

function removeTriggers() {
  const wanted = ['runWednesday', 'runFriday', 'runSunday'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
}

// ── Entry points ──────────────────────────────────

function runWednesday() {
  const a     = mondayOf(new Date());
  const tasks = tasksForWeek(a);
  deliver(new Date(), 'wednesday',
    '💍 Finish before Sunday — week of ' + shortDate(a),
    'Reminder to finish the following tasks before the end of this week (' +
      shortDate(a) + ' – ' + shortDate(addDays(a, 6)) + ')!',
    tasks,
    tasks.length ? '' : 'Nothing highlighted for this week on the Gantt.');
}

function runFriday() {
  const b     = addDays(mondayOf(new Date()), 7);
  const tasks = tasksForWeek(b);
  deliver(new Date(), 'friday',
    '💍 Next week\'s tasks — week of ' + shortDate(b),
    'These are your tasks for the following week (' +
      shortDate(b) + ' – ' + shortDate(addDays(b, 6)) + ').',
    tasks,
    tasks.length ? '' : 'Nothing highlighted for next week on the Gantt.');
}

function runSunday() {
  const a     = mondayOf(new Date());
  const b     = addDays(a, 7);
  const done  = tasksForWeek(a);
  const next  = tasksForWeek(b);

  let body = 'Note your progress for this week and keep track of your ' +
             'upcoming goals.\n\n' +
             'THIS WEEK (' + shortDate(a) + ' – ' + shortDate(addDays(a, 6)) + ')\n' +
             (done.length ? bullets(done) : '  — nothing was highlighted —') +
             '\n\nNEXT WEEK (' + shortDate(b) + ' – ' + shortDate(addDays(b, 6)) + ')\n' +
             (next.length ? bullets(next) : '  — nothing highlighted yet —');

  deliverRaw(new Date(), 'sunday',
    '💍 Weekly wedding review — ' + daysToGo() + ' days to go',
    body);
}

// ── Reading the Gantt ─────────────────────────────

// Returns [{ initiative, category, subtask, status }] for the week whose
// Monday is `monday`, in sheet order.
function tasksForWeek(monday) {
  const sheet = SpreadsheetApp.openById(GANTT_SHEET_ID).getSheetByName(GANTT_TAB);
  if (!sheet) throw new Error('No tab named "' + GANTT_TAB + '" in the planning sheet.');

  const layout = findLayout(sheet);
  const col    = layout.weeks[dateKey(monday)];
  if (!col) return [];                       // week outside the Gantt's range

  const first  = layout.firstTaskRow;
  const count  = layout.lastTaskRow - first + 1;
  if (count < 1) return [];

  const labels = sheet.getRange(first, 2, count, 4).getValues();          // B–E
  const fills  = sheet.getRange(first, col, count, 1).getBackgrounds();

  const out = [];
  let initiative = '', category = '';
  for (let i = 0; i < count; i++) {
    if (labels[i][0]) initiative = String(labels[i][0]).trim();
    if (labels[i][1]) category   = String(labels[i][1]).trim();
    if (!isHighlight(fills[i][0])) continue;
    out.push({
      initiative: initiative,
      category:   category,
      subtask:    String(labels[i][2] || '').trim(),
      status:     String(labels[i][3] || '').trim(),
    });
  }
  return out;
}

// The Gantt's shape is discovered rather than hard-coded, so inserting
// rows or columns in the sheet doesn't quietly break the reminders.
function findLayout(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const probe   = sheet.getRange(1, 1, Math.min(30, lastRow), lastCol).getValues();

  // Header row = the first row holding a run of dates (the week starts).
  let headerRow = 0;
  for (let r = 0; r < probe.length && !headerRow; r++) {
    let dates = 0;
    for (let c = 0; c < lastCol; c++) if (probe[r][c] instanceof Date) dates++;
    if (dates >= 10) headerRow = r + 1;
  }
  if (!headerRow) throw new Error('Could not find the row of week dates on the Gantt.');

  const weeks = {};
  for (let c = 0; c < lastCol; c++) {
    const v = probe[headerRow - 1][c];
    if (v instanceof Date) weeks[dateKey(v)] = c + 1;
  }

  // Task list starts under the row labelled "Initiative" in column B.
  let labelRow = 0;
  for (let r = headerRow; r < probe.length; r++) {
    if (String(probe[r][1] || '').trim().toLowerCase() === 'initiative') {
      labelRow = r + 1;
      break;
    }
  }
  if (!labelRow) throw new Error('Could not find the "Initiative" header on the Gantt.');

  // Last task row = last row with anything in Initiative / Category / Subtask.
  const body = sheet.getRange(labelRow + 1, 2, lastRow - labelRow, 3).getValues();
  let lastTaskRow = labelRow;
  for (let i = 0; i < body.length; i++) {
    if (body[i][0] || body[i][1] || body[i][2]) lastTaskRow = labelRow + 1 + i;
  }

  return { headerRow: headerRow, weeks: weeks,
           firstTaskRow: labelRow + 1, lastTaskRow: lastTaskRow };
}

function isHighlight(hex) {
  return NOT_HIGHLIGHT.indexOf(String(hex || '').toLowerCase()) === -1;
}

// ── Delivery ──────────────────────────────────────

function deliver(when, kind, title, intro, tasks, emptyNote) {
  const body = intro + '\n\n' + (tasks.length ? bullets(tasks) : emptyNote);
  deliverRaw(when, kind, title, body);
}

function deliverRaw(when, kind, title, body) {
  const marker = markerFor(when, kind);
  const full   = body + '\n\nGantt: ' + GANTT_URL + '\n' + marker;

  let onCalendar = false;
  try {
    const cal = targetCalendar();
    if (!cal) throw new Error('Cannot reach the calendar "' + CALENDAR_ID + '".');
    if (!alreadyThere(cal, when, marker)) {
      cal.createAllDayEvent(title, when, { description: full });
    }
    onCalendar = true;
  } catch (err) {
    console.error('Calendar write failed: ' + err.message);
  }

  if (!onCalendar || SEND_EMAIL_COPY) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), title, full);
  }
}

// Returns null rather than throwing when the calendar is out of reach, so
// callers can decide whether that is a setup error or a reason to email.
function targetCalendar() {
  try {
    return CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID)
                       : CalendarApp.getDefaultCalendar();
  } catch (err) {
    return null;
  }
}

// The same day's reminder is only ever written once, so a manual run or a
// retried trigger doesn't leave duplicates on the calendar.
function alreadyThere(cal, when, marker) {
  return cal.getEventsForDay(when).some(function (e) {
    return String(e.getDescription() || '').indexOf(marker) !== -1;
  });
}

function markerFor(when, kind) {
  return '[gantt-reminder:' + dateKey(when) + ':' + kind + ']';
}

// ── Formatting ────────────────────────────────────

function bullets(tasks) {
  return tasks.map(function (t) {
    const name  = t.subtask || t.category;
    const where = t.subtask && t.category ? t.initiative + ' › ' + t.category
                                          : t.initiative;
    return '• ' + name + '  (' + where + ')' +
           (t.status ? ' — ' + t.status : '');
  }).join('\n');
}

function daysToGo() {
  const day = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((WEDDING_DATE - startOfDay(new Date())) / day));
}

// ── Dates ─────────────────────────────────────────

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function mondayOf(d) {
  const out   = startOfDay(d);
  const shift = (out.getDay() + 6) % 7;        // Sunday counts as day 7
  out.setDate(out.getDate() - shift);
  return out;
}

function addDays(d, n) {
  const out = startOfDay(d);
  out.setDate(out.getDate() + n);
  return out;
}

function dateKey(d) {
  return Utilities.formatDate(startOfDay(d),
    Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function shortDate(d) {
  return Utilities.formatDate(startOfDay(d),
    Session.getScriptTimeZone(), 'd MMM');
}

// ── Checks you can run by hand ────────────────────

// Prints what each of the three reminders would say right now, without
// touching the calendar or sending anything.
function previewReminders() {
  const a = mondayOf(new Date());
  const b = addDays(a, 7);
  const lines = [
    'Week A (this week): ' + shortDate(a),
    bullets(tasksForWeek(a)) || '  — nothing highlighted —',
    '',
    'Week B (next week): ' + shortDate(b),
    bullets(tasksForWeek(b)) || '  — nothing highlighted —',
  ];
  console.log(lines.join('\n'));
  return lines.join('\n');
}

// Prints every week that has at least one highlighted task, so you can
// check the script is reading the colours the way you expect.
function previewAllWeeks() {
  const sheet  = SpreadsheetApp.openById(GANTT_SHEET_ID).getSheetByName(GANTT_TAB);
  const layout = findLayout(sheet);
  const out    = [];
  Object.keys(layout.weeks).sort().forEach(function (key) {
    const parts = key.split('-');
    const tasks = tasksForWeek(new Date(+parts[0], parts[1] - 1, +parts[2]));
    if (tasks.length) out.push(key + '  (' + tasks.length + ')\n' + bullets(tasks));
  });
  console.log(out.join('\n\n'));
  return out.join('\n\n');
}

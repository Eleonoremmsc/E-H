/* ================================================
   Éléonore & Hubert — Wedding Website
   ================================================ */

// ── Config ──────────────────────────────────────
const CONFIG = {
  password:    'CrillonEH2027',
  sessionKey:  'weddingAccess',
  defaultLang: 'en',
};

// Paste your Google Apps Script Web App URL here after deploying Code.gs
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbymunneSd_fTcMqOhWV8_ujkc60qa0rJCE6JJJB5PsvXeyn-KDGW80hwSdxd2iFoSqL/exec';

// ── Event Data ──────────────────────────────────
const EVENT = {
  title:       'Éléonore & Hubert',
  startUtc:    '20270626T143000Z',   // 16:30 CEST = 14:30 UTC
  endUtc:      '20270626T215900Z',   // 23:59 CEST = 21:59 UTC
  startLocal:  '20270626T163000',
  endLocal:    '20270626T235900',
  timezone:    'Europe/Paris',
  location:    'Domaine des Pins, 1100 Chemin de Mormoiron par les Mourands, 84410 Crillon-le-Brave, France',
  description: 'Wedding celebration in Provence.',
};

// ── Translations ────────────────────────────────
const T = {
  en: {
    gate_date:           '26 June 2027 · Crillon-le-Brave',
    gate_label:          'Enter your invitation code',
    gate_submit:         'Enter',
    gate_error:          'Incorrect code. Please try again.',
    nav_welcome:         'Welcome',
    nav_programme:       'Programme',
    nav_accommodation:   'Accommodation',
    nav_dresscode:       'Dress Code',
    nav_map:             'Map',
    welcome_eyebrow:     'June 26, 2027',
    welcome_subtitle:    'look forward to celebrating their wedding with you on',
    welcome_date:        'June 26th, 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Save the Date',
    btn_rsvp:            'RSVP',
    prog_eyebrow:        'The Weekend',
    prog_title:          'Programme',
    prog_friday:         'Friday, 25 June',
    prog_fri_name:       'Arrival Cocktail',
    prog_fri_desc:       'Join us for a welcome drink to start the celebrations.',
    prog_saturday:       'Saturday, 26 June',
    prog_ceremony_name:  'Religious Ceremony',
    prog_ceremony_desc:  'The ceremony will take place at the estate chapel.',
    prog_cocktail_name:  'Cocktail Hour',
    prog_cocktail_desc:  'Drinks and canapés in the garden.',
    prog_dinner_name:    'Dinner',
    prog_dinner_desc:    'A seated dinner under the Provençal stars.',
    prog_dancing_name:   'Dancing',
    prog_dancing_desc:   'Music and dancing until the early hours.',
    accom_eyebrow:       'Nearby',
    accom_title:         'Accommodation',
    accom_intro:         'We have gathered a selection of accommodation options near the venue to suit every preference and budget. We recommend booking early.',
    tier_luxury:         'Luxury',
    tier_boutique:       'Boutique',
    tier_charming:       'Charming',
    tier_comfortable:    'Comfortable',
    accom_distance:      'Distance',
    accom_onsite:        'On site',
    accom_note_crillon:  'The Relais & Châteaux property at the heart of the village. Book directly for the best rates.',
    accom_note_gordes:   'Perched village hotel with panoramic views over the Luberon.',
    accom_note_baume:    "Intimate maison d'hôtes with a beautiful garden and pool.",
    accom_note_geraniums:'A family-run hotel in Le Barroux with lovely valley views.',
    accom_book:          'Book now →',
    accom_footer:        'Shuttle service details will follow closer to the date. We recommend coordinating transfers as a group.',
    dress_eyebrow:       'Attire',
    dress_title:         'Dress Code',
    dress_headline:      'Black Tie',
    dress_intro:         'We invite our guests to embrace the elegance of a Provençal evening. Formal attire is warmly encouraged.',
    dress_women:         'For Women',
    dress_w1:            'Floor-length or midi evening gown',
    dress_w2:            'Elegant cocktail dress',
    dress_w3:            'Refined trouser suit',
    dress_wnote:         'Soft tones, florals, and warm whites are all welcome. The ceremony is outdoors — block heels or wedges are recommended.',
    dress_men:           'For Men',
    dress_m1:            'Black tie (dinner jacket & black tie)',
    dress_m2:            'Dark suit with tie',
    dress_mnote:         'A dark suit with a tie is perfectly appropriate. Bow ties, pocket squares, and cummerbunds are all encouraged.',
    dress_footer:        'Please avoid white, ivory, and cream. Children are welcome in their finest.',
    map_eyebrow:         'Venue',
    map_title:           'Getting There',
    map_gmaps:           'Open in Google Maps',
    map_plane:           'By Plane',
    map_plane_desc:      'Marseille Provence (MRS) — 1h15 by car. Avignon Airport — approx. 45 min.',
    map_train:           'By Train',
    map_train_desc:      'TGV to Avignon Centre or Avignon TGV, then 45 min by car to Crillon-le-Brave.',
    map_car:             'By Car',
    map_car_desc:        'A7 motorway, exit Carpentras. Follow signs toward Crillon-le-Brave via Mormoiron.',
    footer_date:         '26 June 2027 · Crillon-le-Brave, Provence',
    footer_note:         'Made with love ♡',
    modal_eyebrow:       'Save the Date',
    modal_when:          '26 June 2027 · Crillon-le-Brave',
    modal_prompt:        'Choose your calendar:',
    rsvp_eyebrow:        'RSVP',
    rsvp_email:          'Email address',
    rsvp_lastname:       'Last name',
    rsvp_firstnames:     'First name(s)',
    rsvp_address:        'Postal address',
    rsvp_guests_label:   'Guests',
    rsvp_guest:          'Guest',
    rsvp_firstname:      'First name',
    rsvp_attendance:     'Attendance',
    rsvp_yes:            'With joy, I will be there',
    rsvp_maybe:          'I hope to attend',
    rsvp_no:             'Regretfully, I will not be able to join',
    rsvp_add:            '+ Add another guest',
    rsvp_remove:         'Remove',
    rsvp_submit:         'Confirm RSVP',
    rsvp_update:         'Update RSVP',
    rsvp_err_required:   'This field is required',
    rsvp_err_email:      'Please enter a valid email address',
    rsvp_err_attendance: 'Please select an attendance option',
    rsvp_thanks:         'Thank you.',
    rsvp_success_note:   'A confirmation has been sent to your email address.',
  },

  fr: {
    gate_date:           '26 juin 2027 · Crillon-le-Brave',
    gate_label:          "Entrez votre code d'invitation",
    gate_submit:         'Entrer',
    gate_error:          'Code incorrect. Veuillez réessayer.',
    nav_welcome:         'Bienvenue',
    nav_programme:       'Programme',
    nav_accommodation:   'Hébergement',
    nav_dresscode:       'Tenue',
    nav_map:             'Carte',
    welcome_eyebrow:     '26 juin 2027',
    welcome_subtitle:    'ont le plaisir de célébrer leur mariage avec vous le',
    welcome_date:        '26 juin 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Retenir la date',
    btn_rsvp:            'RSVP',
    prog_eyebrow:        'Le week-end',
    prog_title:          'Programme',
    prog_friday:         'Vendredi 25 juin',
    prog_fri_name:       "Cocktail d'arrivée",
    prog_fri_desc:       'Rejoignez-nous pour un verre de bienvenue pour commencer les festivités.',
    prog_saturday:       'Samedi 26 juin',
    prog_ceremony_name:  'Cérémonie religieuse',
    prog_ceremony_desc:  'La cérémonie aura lieu dans la chapelle du domaine.',
    prog_cocktail_name:  'Cocktail',
    prog_cocktail_desc:  'Boissons et canapés dans le jardin.',
    prog_dinner_name:    'Dîner',
    prog_dinner_desc:    'Un dîner assis sous les étoiles provençales.',
    prog_dancing_name:   'Soirée dansante',
    prog_dancing_desc:   "Musique et danse jusqu'au bout de la nuit.",
    accom_eyebrow:       'À proximité',
    accom_title:         'Hébergement',
    accom_intro:         'Nous avons sélectionné quelques options d\'hébergement à proximité du domaine, pour tous les goûts et budgets. Nous recommandons de réserver tôt.',
    tier_luxury:         'Luxe',
    tier_boutique:       'Boutique',
    tier_charming:       'Charmant',
    tier_comfortable:    'Confortable',
    accom_distance:      'Distance',
    accom_onsite:        'Sur place',
    accom_note_crillon:  'La propriété Relais & Châteaux au cœur du village. Réservez directement pour les meilleurs tarifs.',
    accom_note_gordes:   'Hôtel de village perché avec vue panoramique sur le Luberon.',
    accom_note_baume:    'Maison d\'hôtes intime avec un beau jardin et une piscine.',
    accom_note_geraniums:'Hôtel familial au Barroux avec une belle vue sur la vallée.',
    accom_book:          'Réserver →',
    accom_footer:        'Les détails du service de navette seront communiqués plus proche de la date. Nous recommandons de coordonner les taxis en groupe.',
    dress_eyebrow:       'Tenue',
    dress_title:         'Code vestimentaire',
    dress_headline:      'Tenue de soirée',
    dress_intro:         'Nous invitons nos convives à revêtir leur plus belle tenue pour cette soirée provençale. La tenue formelle est chaleureusement encouragée.',
    dress_women:         'Pour les femmes',
    dress_w1:            'Robe longue ou mi-longue',
    dress_w2:            'Robe de cocktail élégante',
    dress_w3:            'Tailleur-pantalon raffiné',
    dress_wnote:         'Les tons doux, les fleurs et les blancs chauds sont bienvenus. La cérémonie est en extérieur — des talons compensés ou blocs sont recommandés.',
    dress_men:           'Pour les hommes',
    dress_m1:            'Smoking (veston et nœud papillon noirs)',
    dress_m2:            'Costume sombre avec cravate',
    dress_mnote:         'Un costume sombre avec une cravate est tout à fait approprié. Les nœuds papillon et les pochettes sont encouragés.',
    dress_footer:        "Merci d'éviter le blanc, l'ivoire et le crème. Les enfants sont bienvenus dans leurs plus beaux atours.",
    map_eyebrow:         'Lieu',
    map_title:           'Accès',
    map_gmaps:           'Ouvrir dans Google Maps',
    map_plane:           'En avion',
    map_plane_desc:      'Aéroport de Marseille Provence (MRS) — environ 1h15 en voiture. Aéroport d\'Avignon — environ 45 min.',
    map_train:           'En train',
    map_train_desc:      'TGV jusqu\'à Avignon Centre ou Avignon TGV, puis 45 min en voiture jusqu\'à Crillon-le-Brave.',
    map_car:             'En voiture',
    map_car_desc:        'Autoroute A7, sortie Carpentras. Suivre les indications vers Crillon-le-Brave via Mormoiron.',
    footer_date:         '26 juin 2027 · Crillon-le-Brave, Provence',
    footer_note:         'Fait avec amour ♡',
    modal_eyebrow:       'Retenir la date',
    modal_when:          '26 juin 2027 · Crillon-le-Brave',
    modal_prompt:        'Choisissez votre application de calendrier :',
    rsvp_eyebrow:        'RSVP',
    rsvp_email:          'Adresse email',
    rsvp_lastname:       'Nom de famille',
    rsvp_firstnames:     'Prénom(s)',
    rsvp_address:        'Adresse postale',
    rsvp_guests_label:   'Invités',
    rsvp_guest:          'Invité',
    rsvp_firstname:      'Prénom',
    rsvp_attendance:     'Présence',
    rsvp_yes:            'Avec joie, je serai présent(e)',
    rsvp_maybe:          "J'espère pouvoir participer",
    rsvp_no:             'Je ne pourrai malheureusement pas être présent(e)',
    rsvp_add:            '+ Ajouter un autre invité',
    rsvp_remove:         'Supprimer',
    rsvp_submit:         'Confirmer le RSVP',
    rsvp_update:         'Mettre à jour le RSVP',
    rsvp_err_required:   'Ce champ est obligatoire',
    rsvp_err_email:      'Veuillez entrer une adresse email valide',
    rsvp_err_attendance: 'Veuillez sélectionner une option de présence',
    rsvp_thanks:         'Merci.',
    rsvp_success_note:   'Une confirmation a été envoyée à votre adresse email.',
  },

  de: {
    gate_date:           '26. Juni 2027 · Crillon-le-Brave',
    gate_label:          'Geben Sie Ihren Einladungscode ein',
    gate_submit:         'Weiter',
    gate_error:          'Falscher Code. Bitte versuchen Sie es erneut.',
    nav_welcome:         'Willkommen',
    nav_programme:       'Programm',
    nav_accommodation:   'Unterkunft',
    nav_dresscode:       'Kleidung',
    nav_map:             'Karte',
    welcome_eyebrow:     '26. Juni 2027',
    welcome_subtitle:    'freuen sich, ihre Hochzeit mit Ihnen zu feiern am',
    welcome_date:        '26. Juni 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Datum speichern',
    btn_rsvp:            'RSVP',
    prog_eyebrow:        'Das Wochenende',
    prog_title:          'Programm',
    prog_friday:         'Freitag, 25. Juni',
    prog_fri_name:       'Ankunfts-Cocktail',
    prog_fri_desc:       'Kommen Sie zu einem Willkommensdrink, um die Feierlichkeiten zu beginnen.',
    prog_saturday:       'Samstag, 26. Juni',
    prog_ceremony_name:  'Kirchliche Trauung',
    prog_ceremony_desc:  'Die Zeremonie findet in der Kapelle des Anwesens statt.',
    prog_cocktail_name:  'Cocktailstunde',
    prog_cocktail_desc:  'Getränke und Häppchen im Garten.',
    prog_dinner_name:    'Abendessen',
    prog_dinner_desc:    'Ein festliches Abendessen unter dem provenzalischen Sternenhimmel.',
    prog_dancing_name:   'Tanzen',
    prog_dancing_desc:   'Musik und Tanz bis in die frühen Morgenstunden.',
    accom_eyebrow:       'In der Nähe',
    accom_title:         'Unterkunft',
    accom_intro:         'Wir haben eine Auswahl an Unterkunftsmöglichkeiten in der Nähe des Veranstaltungsortes zusammengestellt. Wir empfehlen eine frühzeitige Buchung.',
    tier_luxury:         'Luxus',
    tier_boutique:       'Boutique',
    tier_charming:       'Charmant',
    tier_comfortable:    'Komfortabel',
    accom_distance:      'Entfernung',
    accom_onsite:        'Vor Ort',
    accom_note_crillon:  'Das Relais & Châteaux Hotel im Herzen des Dorfes. Direkt buchen für die besten Preise.',
    accom_note_gordes:   'Hoch gelegenes Dorfhotel mit Panoramablick über den Luberon.',
    accom_note_baume:    'Intimes Gästehaus mit schönem Garten und Pool.',
    accom_note_geraniums:'Familienhotel in Le Barroux mit schönem Blick ins Tal.',
    accom_book:          'Jetzt buchen →',
    accom_footer:        'Details zum Shuttleservice folgen näher am Datum. Wir empfehlen, Transfers als Gruppe zu koordinieren.',
    dress_eyebrow:       'Kleidung',
    dress_title:         'Dresscode',
    dress_headline:      'Abendgarderobe',
    dress_intro:         'Wir laden unsere Gäste ein, die Eleganz eines provenzalischen Abends zu genießen. Formelle Kleidung ist herzlich willkommen.',
    dress_women:         'Für Damen',
    dress_w1:            'Langes oder midi Abendkleid',
    dress_w2:            'Elegantes Cocktailkleid',
    dress_w3:            'Raffinierter Hosenanzug',
    dress_wnote:         'Sanfte Töne, Blumenmuster und warme Weißtöne sind willkommen. Die Zeremonie ist im Freien — Keilabsätze oder Blockabsätze werden empfohlen.',
    dress_men:           'Für Herren',
    dress_m1:            'Smoking (Dinner-Jackett & schwarze Krawatte)',
    dress_m2:            'Dunkler Anzug mit Krawatte',
    dress_mnote:         'Ein dunkler Anzug mit Krawatte ist vollkommen angemessen. Fliegen und Einstecktücher sind erwünscht.',
    dress_footer:        'Bitte vermeiden Sie Weiß, Elfenbein und Creme. Kinder sind in ihrer schönsten Kleidung herzlich willkommen.',
    map_eyebrow:         'Veranstaltungsort',
    map_title:           'Anreise',
    map_gmaps:           'In Google Maps öffnen',
    map_plane:           'Mit dem Flugzeug',
    map_plane_desc:      'Flughafen Marseille Provence (MRS) — ca. 1h15 mit dem Auto. Flughafen Avignon — ca. 45 Min.',
    map_train:           'Mit dem Zug',
    map_train_desc:      'TGV nach Avignon Centre oder Avignon TGV, dann 45 Min. mit dem Auto nach Crillon-le-Brave.',
    map_car:             'Mit dem Auto',
    map_car_desc:        'Autobahn A7, Ausfahrt Carpentras. Schilder nach Crillon-le-Brave über Mormoiron folgen.',
    footer_date:         '26. Juni 2027 · Crillon-le-Brave, Provence',
    footer_note:         'Mit Liebe gemacht ♡',
    modal_eyebrow:       'Datum speichern',
    modal_when:          '26. Juni 2027 · Crillon-le-Brave',
    modal_prompt:        'Wählen Sie Ihre Kalenderanwendung:',
    rsvp_eyebrow:        'RSVP',
    rsvp_email:          'E-Mail-Adresse',
    rsvp_lastname:       'Nachname',
    rsvp_firstnames:     'Vorname(n)',
    rsvp_address:        'Postanschrift',
    rsvp_guests_label:   'Gäste',
    rsvp_guest:          'Gast',
    rsvp_firstname:      'Vorname',
    rsvp_attendance:     'Teilnahme',
    rsvp_yes:            'Mit Freude, ich werde dabei sein',
    rsvp_maybe:          'Ich hoffe, teilnehmen zu können',
    rsvp_no:             'Leider werde ich nicht teilnehmen können',
    rsvp_add:            '+ Weiteren Gast hinzufügen',
    rsvp_remove:         'Entfernen',
    rsvp_submit:         'RSVP bestätigen',
    rsvp_update:         'RSVP aktualisieren',
    rsvp_err_required:   'Dieses Feld ist erforderlich',
    rsvp_err_email:      'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    rsvp_err_attendance: 'Bitte wählen Sie eine Teilnahme-Option',
    rsvp_thanks:         'Vielen Dank.',
    rsvp_success_note:   'Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.',
  },
};

// ── State ────────────────────────────────────────
let lang      = localStorage.getItem('weddingLang') || CONFIG.defaultLang;
let editToken = null;

// ── Boot ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Capture edit token before any init so unlock() can use it
  const params = new URLSearchParams(window.location.search);
  editToken = params.get('rsvp') || null;
  if (editToken) window.history.replaceState({}, '', window.location.pathname);

  applyLang(lang);
  initGate();
  initNav();
  initModal();
  initRSVP();
});

// ── Language ─────────────────────────────────────
function applyLang(l) {
  lang = l;
  const t = T[l] || T.en;
  localStorage.setItem('weddingLang', l);
  document.documentElement.lang = l;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] != null) el.textContent = t[key];
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === l);
  });
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.lang-btn');
  if (btn && btn.dataset.lang) applyLang(btn.dataset.lang);
});

// ── Password Gate ─────────────────────────────────
function initGate() {
  const gate   = document.getElementById('gate');
  const site   = document.getElementById('site');
  const input  = document.getElementById('password-input');
  const submit = document.getElementById('password-submit');
  const err    = document.getElementById('gate-error');

  if (sessionStorage.getItem(CONFIG.sessionKey) === '1') {
    unlock(gate, site);
    return;
  }

  function attempt() {
    const val = input.value.trim().toLowerCase();
    if (val === CONFIG.password.toLowerCase()) {
      sessionStorage.setItem(CONFIG.sessionKey, '1');
      gate.classList.add('fade-out');
      setTimeout(() => unlock(gate, site), 500);
    } else {
      err.classList.add('visible');
      input.classList.add('shake');
      input.value = '';
      setTimeout(() => {
        input.classList.remove('shake');
        input.focus();
      }, 360);
    }
  }

  submit.addEventListener('click', attempt);
  input.addEventListener('keydown', e => {
    err.classList.remove('visible');
    if (e.key === 'Enter') attempt();
  });

  input.focus();
}

function unlock(gate, site) {
  gate.style.display = 'none';
  site.classList.add('visible');
  handleScroll();
  if (editToken) setTimeout(openRSVP, 400);
}

// ── Navigation ────────────────────────────────────
function initNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileMenu= document.getElementById('mobile-menu');
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-links .nav-link');

  window.addEventListener('scroll', handleScroll, { passive: true });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  document.querySelectorAll('.nav-mobile .nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });

  // Highlight active section
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(s => io.observe(s));
}

function handleScroll() {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
}

// ── Calendar Modal ────────────────────────────────
function initModal() {
  const overlay   = document.getElementById('modal-overlay');
  const closeBtn  = document.getElementById('modal-close');
  const saveBtn   = document.getElementById('save-the-date-btn');

  saveBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  document.querySelectorAll('.cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCalendar(btn.dataset.cal);
      closeModal();
    });
  });
}

function openModal() {
  const o = document.getElementById('modal-overlay');
  o.classList.add('open');
  o.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const o = document.getElementById('modal-overlay');
  o.classList.remove('open');
  o.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function addToCalendar(type) {
  const e  = EVENT;
  const enc = encodeURIComponent;

  const urls = {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE` +
             `&text=${enc(e.title)}&dates=${e.startUtc}/${e.endUtc}` +
             `&details=${enc(e.description)}&location=${enc(e.location)}`,

    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?` +
              `subject=${enc(e.title)}&startdt=2027-06-26T16:30:00` +
              `&enddt=2027-06-26T23:59:00&location=${enc(e.location)}&body=${enc(e.description)}`,

    office365: `https://outlook.office.com/calendar/0/deeplink/compose?` +
                `subject=${enc(e.title)}&startdt=2027-06-26T16:30:00` +
                `&enddt=2027-06-26T23:59:00&location=${enc(e.location)}&body=${enc(e.description)}`,

    yahoo: `https://calendar.yahoo.com/?v=60&title=${enc(e.title)}` +
            `&st=20270626T163000&et=20270626T235900` +
            `&desc=${enc(e.description)}&in_loc=${enc(e.location)}`,
  };

  if (type === 'apple' || type === 'ical') {
    downloadICS();
  } else if (urls[type]) {
    window.open(urls[type], '_blank', 'noopener,noreferrer');
  }
}

function downloadICS() {
  const e = EVENT;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Éléonore & Hubert Wedding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Europe/Paris',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'X-LIC-LOCATION:Europe/Paris',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Paris:${e.startLocal}`,
    `DTEND;TZID=Europe/Paris:${e.endLocal}`,
    `SUMMARY:${e.title}`,
    `LOCATION:${e.location.replace(/,/g, '\\,')}`,
    `DESCRIPTION:${e.description}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'UID:eleonore-hubert-2027-06-26@wedding',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'eleonore-hubert-wedding.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════
// RSVP MODAL
// ══════════════════════════════════════════════════

let attendeeCount = 0;

function initRSVP() {
  document.getElementById('rsvp-btn').addEventListener('click', openRSVP);
  document.getElementById('rsvp-close').addEventListener('click', closeRSVP);
  document.getElementById('rsvp-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('rsvp-overlay')) closeRSVP();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('rsvp-overlay').classList.contains('open')) closeRSVP();
  });
  document.getElementById('add-attendee-btn').addEventListener('click', () => addAttendee());
  document.getElementById('rsvp-form').addEventListener('submit', handleRSVPSubmit);

  // Keep attendee guest labels updated on lang change
  const origApplyLang = window.__origApplyLang;
  if (!origApplyLang) {
    // Patch lang switcher to also renumber attendees
    document.addEventListener('click', e => {
      if (e.target.closest('.lang-btn')) setTimeout(renumberAttendees, 10);
    });
  }

  addAttendee(true);
}

function openRSVP() {
  const overlay = document.getElementById('rsvp-overlay');
  overlay.classList.add('open');
  overlay.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  if (editToken) fetchExistingRSVP(editToken);
}

function closeRSVP() {
  const overlay = document.getElementById('rsvp-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ── Attendee blocks ───────────────────────────────
function addAttendee(isFirst = false, prefill = null) {
  const idx  = attendeeCount++;
  const t    = T[lang] || T.en;
  const list = document.getElementById('attendees-list');

  const block = document.createElement('div');
  block.className = 'attendee-block';
  block.dataset.index = idx;

  const checked = s => prefill && prefill.status === s ? 'checked' : '';

  block.innerHTML = `
    <div class="attendee-header">
      <span class="attendee-num"></span>
      ${!isFirst ? `<button type="button" class="attendee-remove">${t.rsvp_remove}</button>` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">
        <span data-i18n="rsvp_firstname">${t.rsvp_firstname}</span> <span class="req">*</span>
      </label>
      <input type="text" name="att_name_${idx}" class="form-input att-name"
             value="${prefill ? escHtml(prefill.name) : ''}">
      <div class="form-error att-err-name"></div>
    </div>
    <div class="form-group">
      <label class="form-label">
        <span data-i18n="rsvp_attendance">${t.rsvp_attendance}</span> <span class="req">*</span>
      </label>
      <div class="radio-group">
        <label class="radio-option">
          <input type="radio" name="att_status_${idx}" value="yes" ${checked('yes')}>
          <span class="radio-dot"></span>
          <span class="radio-text" data-i18n="rsvp_yes">${t.rsvp_yes}</span>
        </label>
        <label class="radio-option">
          <input type="radio" name="att_status_${idx}" value="maybe" ${checked('maybe')}>
          <span class="radio-dot"></span>
          <span class="radio-text" data-i18n="rsvp_maybe">${t.rsvp_maybe}</span>
        </label>
        <label class="radio-option">
          <input type="radio" name="att_status_${idx}" value="no" ${checked('no')}>
          <span class="radio-dot"></span>
          <span class="radio-text" data-i18n="rsvp_no">${t.rsvp_no}</span>
        </label>
      </div>
      <div class="form-error att-err-status"></div>
    </div>
  `;

  const removeBtn = block.querySelector('.attendee-remove');
  if (removeBtn) removeBtn.addEventListener('click', () => { block.remove(); renumberAttendees(); });

  list.appendChild(block);
  renumberAttendees();
}

function renumberAttendees() {
  const t = T[lang] || T.en;
  document.querySelectorAll('#attendees-list .attendee-block').forEach((b, i) => {
    const label = b.querySelector('.attendee-num');
    if (label) label.textContent = `${t.rsvp_guest} ${i + 1}`;
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Collect & validate ────────────────────────────
function collectFormData() {
  const form = document.getElementById('rsvp-form');
  const attendees = [];
  document.querySelectorAll('#attendees-list .attendee-block').forEach(block => {
    const nameEl   = block.querySelector('.att-name');
    const statusEl = block.querySelector('input[type="radio"]:checked');
    attendees.push({ name: nameEl ? nameEl.value.trim() : '', status: statusEl ? statusEl.value : '' });
  });
  return {
    email:      form.email.value.trim(),
    lastName:   form.lastName.value.trim(),
    firstNames: form.firstNames.value.trim(),
    address:    form.address.value.trim(),
    attendees,
  };
}

function validateForm(data) {
  let valid = true;
  const t = T[lang] || T.en;

  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = ''; el.classList.remove('visible');
  });

  function showErr(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
    valid = false;
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    showErr('err-email', t.rsvp_err_email);
  if (!data.lastName)   showErr('err-lastName',   t.rsvp_err_required);
  if (!data.firstNames) showErr('err-firstNames', t.rsvp_err_required);
  if (!data.address)    showErr('err-address',    t.rsvp_err_required);

  document.querySelectorAll('#attendees-list .attendee-block').forEach(block => {
    const nameEl    = block.querySelector('.att-name');
    const statusEl  = block.querySelector('input[type="radio"]:checked');
    const nameErr   = block.querySelector('.att-err-name');
    const statusErr = block.querySelector('.att-err-status');
    if (nameEl && !nameEl.value.trim() && nameErr) {
      nameErr.textContent = t.rsvp_err_required; nameErr.classList.add('visible'); valid = false;
    }
    if (!statusEl && statusErr) {
      statusErr.textContent = t.rsvp_err_attendance; statusErr.classList.add('visible'); valid = false;
    }
  });

  return valid;
}

// ── Submit ────────────────────────────────────────
async function handleRSVPSubmit(e) {
  e.preventDefault();
  const data = collectFormData();
  if (!validateForm(data)) return;

  if (!RSVP_ENDPOINT) {
    alert('Backend not configured — add your Apps Script URL to RSVP_ENDPOINT in script.js.');
    return;
  }

  const btn = document.getElementById('rsvp-submit-btn');
  btn.classList.add('btn-loading');

  const payload = editToken
    ? { action: 'update', token: editToken, ...data }
    : { action: 'submit', ...data };

  try {
    const res    = await fetch(RSVP_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.success) {
      document.getElementById('rsvp-form-view').style.display  = 'none';
      document.getElementById('rsvp-success-view').style.display = 'block';
      document.querySelector('.rsvp-modal').scrollTop = 0;
      if (result.token) editToken = result.token;
    } else {
      alert('Something went wrong. Please try again.');
    }
  } catch {
    alert('Connection error. Please try again.');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

// ── Pre-fill from edit link ───────────────────────
async function fetchExistingRSVP(token) {
  if (!RSVP_ENDPOINT) return;
  try {
    const res    = await fetch(`${RSVP_ENDPOINT}?token=${encodeURIComponent(token)}`);
    const result = await res.json();
    if (result.success && result.data) {
      prefillForm(result.data);
      const label = document.getElementById('rsvp-submit-label');
      if (label) label.setAttribute('data-i18n', 'rsvp_update');
      applyLang(lang);
    }
  } catch { /* silently fail — form stays blank */ }
}

function prefillForm(data) {
  const form = document.getElementById('rsvp-form');
  form.email.value      = data.email      || '';
  form.lastName.value   = data.lastName   || '';
  form.firstNames.value = data.firstNames || '';
  form.address.value    = data.address    || '';

  document.getElementById('attendees-list').innerHTML = '';
  attendeeCount = 0;

  const attendees = data.attendees || [];
  attendees.forEach((att, i) => addAttendee(i === 0, att));
  if (attendees.length === 0) addAttendee(true);
}

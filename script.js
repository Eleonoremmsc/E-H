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
// Apps Script Web App URL. This changes whenever a NEW deployment is created
// (rather than editing the existing one and picking "New version"), and the
// site then silently talks to whichever older deployment this still names.
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw5I6qwAYXmzVEtqRG8vpa02-1hwdifOkegQXehHQgER6GwzxD52GXn9BzzzO_s2UWa/exec';

// ── Event Data ──────────────────────────────────
// The weekend is two separate events. A downloaded .ics carries both at
// once; the web-calendar providers below take one event per link, so the
// Friday cocktail is offered as its own explicit second click.
const EVENT = {
  title:       'Eléonore & Hubert',
  startUtc:    '20270626T143000Z',   // 16:30 CEST = 14:30 UTC
  endUtc:      '20270626T215900Z',   // 23:59 CEST = 21:59 UTC
  startLocal:  '20270626T163000',
  endLocal:    '20270626T235900',
  startPlain:  '2027-06-26T16:30:00',
  endPlain:    '2027-06-26T23:59:00',
  timezone:    'Europe/Paris',
  location:    'Domaine des Pins, 1100 Chemin de Mormoiron par les Mourands, 84410 Crillon-le-Brave, France',
  description: 'Wedding celebration in Provence.',
  uid:         'eleonore-hubert-2027-06-26@wedding',
};

const EVENT_FRIDAY = {
  title:       'Eléonore & Hubert — Cocktail',
  startUtc:    '20270625T170000Z',   // 19:00 CEST = 17:00 UTC
  endUtc:      '20270625T200000Z',   // 22:00 CEST = 20:00 UTC
  startLocal:  '20270625T190000',
  endLocal:    '20270625T220000',
  startPlain:  '2027-06-25T19:00:00',
  endPlain:    '2027-06-25T22:00:00',
  timezone:    'Europe/Paris',
  location:    'Château Pesquié, Mormoiron, France',
  description: 'Cocktail evening the night before the wedding.',
  uid:         'eleonore-hubert-2027-06-25-cocktail@wedding',
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
    nav_activities:      'Activities',
    nav_dresscode:       'Dress Code',
    nav_map:             'Map',
    lang_icon_label:     'Change language',
    lang_modal_title:    'Choose your language',
    welcome_subtitle:    'look forward to celebrating their wedding with you on',
    welcome_date:        'June 26th, 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Save the Date',
    btn_rsvp:            'Receive my invitation',
    prog_title:          'Programme',
    prog_friday:         'Friday, 25 June',
    prog_fri_name:       'Cocktail Evening',
    prog_fri_location:   'Château Pesquié',
    prog_saturday:       'Saturday, 26 June',
    prog_ceremony_name:  'Religious Ceremony',
    prog_ceremony_location: 'TBD',
    prog_reception_time: 'From 19:00',
    prog_reception_name: 'Reception',
    prog_reception_location: 'Domaine des Pins',
    accom_title:         'Accommodation',
    accom_intro:         'A curated selection of places to stay near the venue, for every preference and budget.',
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
    filter_type:         'Type',
    filter_budget:       'Budget',
    filter_guests:       'Guests',
    filter_all:          'All',
    filter_hotel:        'Hotel',
    filter_home:         'Entire Home',
    filter_gite:         'Gîte',
    filter_luxury:       'Luxury',
    filter_comfort:      'Comfort',
    filter_simple:       'Simple',
    filter_no_results:   'No accommodation matches your filters.',
    filter_crowd:        'Crowd',
    filter_nature:       'Nature',
    filter_heritage:     'Heritage',
    filter_wine:         'Wine',
    crowd_quiet:         'Quiet',
    crowd_popular:       'Popular',
    filter_audience:     'For',
    audience_everyone:   'Everyone',
    audience_young:      'Adventurous',
    activities_no_results: 'No activities match your filters.',
    tier_prem_hotel:     'Premium Hotel',
    tier_entire_home:    'Entire Home',
    tier_group_gite:     'Group Gîte',
    tier_small_stay:     'Small Stay',
    accom_guests:        'guests',
    accom_up_to:         'up to',
    note_crillon:        'Ultra high-end Relais & Châteaux at the heart of the village. Walking distance to the ceremony.',
    note_maison_crillon: 'Adults only. Boutique hotel, very refined. No children.',
    note_chateau_mazan:  'Large château hotel. Easiest logistics for guests travelling in bigger groups.',
    note_becaras:        'Beautiful views. Can combine main house with B&B rooms. Ideal for groups.',
    note_armajeva:       'Modern villa, quiet setting. Great for a small group.',
    note_aube_ventoux:   'Spacious with pool. Classic Provence feel.',
    note_gautier:        'Multiple units, good for splitting between families or friend groups.',
    note_moulin:         'Very large capacity. Ideal for big groups who want to stay together.',
    note_chez_nico:      'Central Bédoin. Apartments grouped together, easy to coordinate.',
    note_dom_pierres:    'Flexible capacity with pool. Good host, easy to coordinate.',
    note_mas_stjacques:  'Closest option to the venue. Very convenient for the wedding weekend.',
    note_jas_ventoux:    'Charming and simple. Very close to the venue.',
    note_brin_bois:      'Small and budget-friendly. Quiet setting.',
    note_sidoine:        'Nature setting with split units. Calm and peaceful.',
    note_clos_marceau:   'Well-rated B&B. A solid fallback with good reviews.',
    accom_search_title:      'Search & Book Directly',
    accom_search_intro:      'The fastest way to find a place to stay is to search directly on:',
    accom_search_note:       "There are plenty of accommodation options nearby, but we recommend booking early — availability fills up fast at this time of year. The closest villages are Crillon-le-Brave and Bédoin, with Caromb, Mormoiron and Mazan a short drive further for more options. Most rentals here are booked by the week in summer, and many gîtes charge extra for linen — worth checking before you book.",
    accom_suggestions_intro: 'A few of our own suggestions to get you started:',
    activities_title:    'Activities',
    activities_intro:    'A few of our favourite ways to make the most of Provence, whether you arrive early or stay on after the celebrations.',
    activities_cat_nature:   'Walks & Bike',
    activities_cat_heritage: 'Visits & Villages',
    activities_cat_wine:     'Wineries',
    act_ventoux_name:     'Mont Ventoux',
    act_ventoux_desc:     'The mythic "Giant of Provence" — drive or cycle to the summit for panoramic views across the Vaucluse.',
    act_abeilles_name:    'Col des Abeilles',
    act_abeilles_desc:    'A quieter mountain pass through beekeeping country, popular with cyclists for its views over the Ventoux ridge.',
    act_accrobranche_name:'Ventoux Aventure (Zip-lining)',
    act_accrobranche_desc:'Treetop courses and zip lines through the pine forest — fun for the whole family.',
    act_dentelles_name:   'Dentelles de Montmirail',
    act_dentelles_desc:   'Jagged limestone ridges with walking trails and sweeping views over the vineyards below.',
    act_barroux_name:     'Château du Barroux',
    act_barroux_desc:     'A restored medieval fortress overlooking the plain, a short drive from Crillon-le-Brave.',
    act_senanque_name:    'Abbaye de Sénanque',
    act_senanque_desc:    'The iconic Cistercian abbey set among lavender fields near Gordes.',
    act_orange_name:      "Théâtre Antique d'Orange",
    act_orange_desc:      'A remarkably preserved Roman theatre and UNESCO World Heritage site.',
    act_arles_name:       'Arles',
    act_arles_desc:       'Roman arena and amphitheatre, in the town that inspired Van Gogh.',
    act_gordes_name:      'Gordes',
    act_gordes_desc:      "One of France's most beautiful perched villages, all honey-stone and hilltop views.",
    act_roussillon_name:  'Roussillon & the Sentier des Ocres',
    act_roussillon_desc:  'A walking trail through vivid red-and-ochre cliffs.',
    act_fontaine_name:    'Fontaine-de-Vaucluse',
    act_fontaine_desc:    'The spring source of the Sorgue river, with a shaded riverside village.',
    act_vaison_name:      'Vaison-la-Romaine',
    act_vaison_desc:      'Well-preserved Roman ruins and a lively Tuesday market.',
    act_pesquie_name:     'Château Pesquié',
    act_pesquie_desc:     'A family-run estate in the Ventoux appellation, known for elegant reds.',
    act_chateauneuf_name: 'Châteauneuf-du-Pape',
    act_chateauneuf_desc: "The Rhône Valley's most famous appellation, with cellar tastings throughout the village.",
    act_beaumes_name:     'Beaumes-de-Venise',
    act_beaumes_desc:     "Home of the region's celebrated sweet muscat wine.",
    act_gigondas_name:    'Gigondas',
    act_gigondas_desc:    'A postcard vineyard village at the foot of the Dentelles.',
    act_islesorgue_name:  "L'Isle-sur-la-Sorgue",
    act_islesorgue_desc:  'Antique markets and canoeing on the Sorgue — famous for its Sunday market.',
    act_ventoux_distance:      '~30 min drive',
    act_abeilles_distance:     '~35 min drive',
    act_accrobranche_distance: '~15 min drive',
    act_dentelles_distance:    '~30 min drive',
    act_barroux_distance:      '~5 min drive',
    act_senanque_distance:     '~45 min drive',
    act_orange_distance:       '~35 min drive',
    act_arles_distance:        '~1h15 drive',
    act_gordes_distance:       '~35 min drive',
    act_roussillon_distance:   '~45 min drive',
    act_fontaine_distance:     '~40 min drive',
    act_vaison_distance:       '~30 min drive',
    act_pesquie_distance:      '~10 min drive',
    act_chateauneuf_distance:  '~40 min drive',
    act_beaumes_distance:      '~20 min drive',
    act_gigondas_distance:     '~25 min drive',
    act_islesorgue_distance:   '~35 min drive',
    activities_map_note:  'A rough guide to distances from the estate — not to scale.',
    dress_title:         'Dress Code',
    dress_women:         'For Women',
    dress_men:           'For Men',
    dress_fri_label:     'Friday 25 June · Cocktail Evening',
    dress_fri_headline:  'Summer Chic',
    dress_fri_intro:     'A relaxed evening among the vines — put together, but nothing formal.',
    dress_fri_w:         'A summer dress or an elegant ensemble.',
    dress_fri_m:         'Linen or chinos with a shirt. Jacket optional, no tie needed.',
    dress_sat_label:     'Saturday 26 June · Ceremony & Reception',
    dress_sat_headline:  'Formal Attire',
    dress_sat_intro:     'The church first, then dinner and dancing outdoors.',
    dress_sat_w:         'Evening dress, cocktail dress, or elegant ensemble.',
    dress_sat_wnote:     'The reception after the church is outdoors on grass — block heels or wedges are recommended.',
    dress_sat_m:         'A suit with a tie.',
    map_title:           'Getting There',
    map_gmaps:           'Open in Google Maps',
    map_abroad_title:    'Flying In From Abroad',
    map_option1_label:   'Option 1',
    map_option1_step1:   'Land in Paris at Charles de Gaulle Airport (CDG).',
    map_option1_step2:   'Take a direct TGV train from the airport to Avignon TGV.',
    map_option1_step3:   "Book a car at Avignon TGV (Sixt, Avis, Europcar — plenty of choice). It's the best way to explore the region.",
    map_option1_step4:   'Crillon-le-Brave is a 40-minute drive from Avignon TGV.',
    map_option2_label:   'Option 2',
    map_option2_step1:   'Land in Marseille at Marseille Provence Airport (MRS).',
    map_option2_step2:   'Book a car at the airport. Crillon-le-Brave is a 1h20 drive away.',
    map_paris_title:     'Arriving from Paris',
    map_paris_note:      "We don't recommend driving all the way — it takes 6–8 hours, and with the long weekend traffic, it can take even longer. Instead, take the train from Gare de Lyon to Avignon TGV (2h40), then book a car for your time in the area.",
    map_avignon_warning: 'Important: choose AVIGNON TGV — not Avignon Centre. Avignon Centre is a hassle to reach and difficult to navigate by car.',
    footer_date:         '26 June 2027 · Crillon-le-Brave, Provence',
    modal_eyebrow:       'Save the Date',
    modal_when:          '26 June 2027 · Crillon-le-Brave',
    modal_prompt:        'Choose your calendar:',
    rsvp_eyebrow:        'RSVP',
    rsvp_contact_label:  'Contact person',
    rsvp_email:          'Email address',
    rsvp_lastname:       'Last name',
    rsvp_firstnames:     'First name(s)',
    rsvp_address:        'Postal address',
    rsvp_guests_label:   'Guests',
    rsvp_guest:          'Guest',
    rsvp_firstname:      'First name',
    rsvp_relationship:              'Relationship (optional)',
    rsvp_relationship_placeholder:  'e.g. spouse, sibling, plus-one',
    rsvp_attendance:     'Attendance',
    rsvp_yes:            'With joy, I will be there',
    rsvp_maybe:          'I hope to attend',
    rsvp_no:             'Regretfully, I will not be able to join',
    rsvp_guests_note:    'Please fill in the details for all guests invited with you, so we can send each person their invitation.',
    rsvp_add:            '+ Add the response for another guest in your household',
    rsvp_remove:         'Remove',
    rsvp_submit:         'Confirm RSVP',
    rsvp_update:         'Update RSVP',
    rsvp_err_required:   'This field is required',
    rsvp_err_email:      'Please enter a valid email address',
    rsvp_err_attendance: 'Please select an attendance option',
    rsvp_thanks:         'Thank you.',
    rsvp_edit_again:     'Change my response',
    rsvp_success_note:   'A confirmation has been sent to your email address.',
    rsvp_find_note:      "First, let's find you on our guest list.",
    rsvp_find_placeholder: 'Your name',
    rsvp_find_btn:        'Find me',
    rsvp_find_skip:       "I couldn't find myself — add my details manually",
    rsvp_find_searching:  'Searching…',
    rsvp_find_no_matches: "We couldn't find that name on our list — no problem at all.",
    rsvp_find_manual_btn: 'Enter my details manually',
    rsvp_find_retry:      'Or try a different spelling above.',
    rsvp_find_prompt:     'Is this you?',
    rsvp_find_none:       'None of these — add my details manually',
    recognition_not_you:        'Not you?',
    recognition_edit:           'View or change my response',
    recognition_rsvp:           'Receive my invitation',
    cal_both_note:              "Apple Calendar and the iCal file add both evenings at once — Friday's cocktail and Saturday's wedding.",
    cal_friday_note:            "Saturday is added. Friday's cocktail is a separate event:",
    cal_friday_btn:             "＋ Also add Friday's cocktail",
    recognition_greeting_responded: 'Hi {name} — you’re confirmed for {count}.',
    recognition_greeting_pending:   'Hi {name} — welcome back, you haven’t RSVP’d yet.',
  },

  fr: {
    gate_date:           '26 juin 2027 · Crillon-le-Brave',
    gate_label:          "Entrez votre code d'invitation",
    gate_submit:         'Entrer',
    gate_error:          'Code incorrect. Veuillez réessayer.',
    nav_welcome:         'Bienvenue',
    nav_programme:       'Programme',
    nav_accommodation:   'Hébergement',
    nav_activities:      'Activités',
    nav_dresscode:       'Tenue',
    nav_map:             'Carte',
    lang_icon_label:     'Changer de langue',
    lang_modal_title:    'Choisissez votre langue',
    welcome_subtitle:    'ont le plaisir de célébrer leur mariage avec vous le',
    welcome_date:        '26 juin 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Retenir la date',
    btn_rsvp:            'Recevoir mon invitation',
    prog_title:          'Programme',
    prog_friday:         'Vendredi 25 juin',
    prog_fri_name:       'Soirée cocktail',
    prog_fri_location:   'Château Pesquié',
    prog_saturday:       'Samedi 26 juin',
    prog_ceremony_name:  'Cérémonie religieuse',
    prog_ceremony_location: 'À déterminer',
    prog_reception_time: 'Dès 19h00',
    prog_reception_name: 'Réception',
    prog_reception_location: 'Domaine des Pins',
    accom_title:         'Hébergement',
    accom_intro:         'Une sélection de logements près du lieu de réception, pour tous les goûts et tous les budgets.',
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
    filter_type:         'Type',
    filter_budget:       'Budget',
    filter_guests:       'Personnes',
    filter_all:          'Tous',
    filter_hotel:        'Hôtel',
    filter_home:         'Maison entière',
    filter_gite:         'Gîte',
    filter_luxury:       'Luxe',
    filter_comfort:      'Confort',
    filter_simple:       'Simple',
    filter_no_results:   'Aucun hébergement ne correspond à vos filtres.',
    filter_crowd:        'Affluence',
    filter_nature:       'Nature',
    filter_heritage:     'Patrimoine',
    filter_wine:         'Vin',
    crowd_quiet:         'Tranquille',
    crowd_popular:       'Fréquenté',
    filter_audience:     'Pour qui',
    audience_everyone:   'Tout le monde',
    audience_young:      'Aventureux',
    activities_no_results: 'Aucune activité ne correspond à vos filtres.',
    tier_prem_hotel:     'Hôtel Premium',
    tier_entire_home:    'Maison entière',
    tier_group_gite:     'Gîte de groupe',
    tier_small_stay:     'Petit séjour',
    accom_guests:        'personnes',
    accom_up_to:         "jusqu'à",
    note_crillon:        "Propriété Relais & Châteaux ultra haut de gamme au cœur du village. À quelques pas de la cérémonie.",
    note_maison_crillon: "Adultes uniquement. Hôtel boutique très raffiné. Pas d'enfants.",
    note_chateau_mazan:  "Grand hôtel de château. Logistique simplifiée pour les groupes de voyageurs.",
    note_becaras:        "Belle vue. Possibilité de combiner la maison principale avec des chambres d'hôtes. Idéal pour les groupes.",
    note_armajeva:       "Villa moderne, cadre calme. Parfait pour un petit groupe.",
    note_aube_ventoux:   "Spacieux avec piscine. Ambiance Provence classique.",
    note_gautier:        "Plusieurs unités, idéal pour répartir familles et groupes d'amis.",
    note_moulin:         "Très grande capacité. Idéal pour les grands groupes souhaitant rester ensemble.",
    note_chez_nico:      "Centre de Bédoin. Appartements regroupés, facile à coordonner.",
    note_dom_pierres:    "Capacité flexible avec piscine. Bon hôte, facile à coordonner.",
    note_mas_stjacques:  "Option la plus proche du lieu de réception. Très pratique pour le week-end du mariage.",
    note_jas_ventoux:    "Charmant et simple. Très proche du lieu de réception.",
    note_brin_bois:      "Petit et économique. Cadre calme.",
    note_sidoine:        "Cadre naturel avec unités séparées. Calme et paisible.",
    note_clos_marceau:   "Chambre d'hôtes bien notée. Bonne option de repli avec de solides avis.",
    accom_search_title:      'Recherchez et réservez directement',
    accom_search_intro:      'Le moyen le plus rapide de trouver un logement est de chercher directement sur :',
    accom_search_note:       "Il existe de nombreuses options d'hébergement, mais nous vous recommandons de réserver tôt : les disponibilités partent très vite à cette période. Les villages les plus proches sont Crillon-le-Brave et Bédoin ; Caromb, Mormoiron et Mazan, à quelques minutes de route, offrent d'autres options. La plupart des locations se réservent à la semaine en été, et de nombreux gîtes facturent le linge de maison en supplément — mieux vaut vérifier avant de réserver.",
    accom_suggestions_intro: 'Quelques suggestions de notre part pour vous aider à démarrer :',
    activities_title:    'Activités',
    activities_intro:    "Quelques-unes de nos façons préférées de profiter de la Provence, que vous arriviez en avance ou prolongiez votre séjour après les festivités.",
    activities_cat_nature:   'Randonnées & Vélo',
    activities_cat_heritage: 'Visites & Villages',
    activities_cat_wine:     'Domaines viticoles',
    act_ventoux_name:     'Mont Ventoux',
    act_ventoux_desc:     "Le mythique « Géant de Provence » — en voiture ou à vélo jusqu'au sommet pour une vue panoramique sur le Vaucluse.",
    act_abeilles_name:    'Col des Abeilles',
    act_abeilles_desc:    "Un col plus tranquille au cœur du pays de l'apiculture, prisé des cyclistes pour ses vues sur la crête du Ventoux.",
    act_accrobranche_name:'Ventoux Aventure (Accrobranche)',
    act_accrobranche_desc:'Parcours dans les arbres et tyroliennes en pleine forêt de pins — idéal en famille.',
    act_dentelles_name:   'Dentelles de Montmirail',
    act_dentelles_desc:   'Crêtes calcaires escarpées, sentiers de randonnée et vues dégagées sur les vignes en contrebas.',
    act_barroux_name:     'Château du Barroux',
    act_barroux_desc:     'Une forteresse médiévale restaurée dominant la plaine, à quelques minutes de Crillon-le-Brave.',
    act_senanque_name:    'Abbaye de Sénanque',
    act_senanque_desc:    'La célèbre abbaye cistercienne nichée parmi les champs de lavande, près de Gordes.',
    act_orange_name:      "Théâtre Antique d'Orange",
    act_orange_desc:      'Un théâtre romain remarquablement conservé, classé au patrimoine mondial de l\'UNESCO.',
    act_arles_name:       'Arles',
    act_arles_desc:       'Arènes et amphithéâtre romains, dans la ville qui a inspiré Van Gogh.',
    act_gordes_name:      'Gordes',
    act_gordes_desc:      "L'un des plus beaux villages perchés de France, tout en pierres dorées et vues sur la vallée.",
    act_roussillon_name:  'Roussillon et le Sentier des Ocres',
    act_roussillon_desc:  "Un sentier de randonnée à travers des falaises d'ocre rouge éclatant.",
    act_fontaine_name:    'Fontaine-de-Vaucluse',
    act_fontaine_desc:    'La source de la Sorgue, au cœur d\'un village ombragé au bord de l\'eau.',
    act_vaison_name:      'Vaison-la-Romaine',
    act_vaison_desc:      'Des ruines romaines bien conservées et un marché du mardi très animé.',
    act_pesquie_name:     'Château Pesquié',
    act_pesquie_desc:     'Un domaine familial de l\'appellation Ventoux, réputé pour ses vins rouges élégants.',
    act_chateauneuf_name: 'Châteauneuf-du-Pape',
    act_chateauneuf_desc: "L'appellation la plus célèbre de la vallée du Rhône, avec des dégustations dans tout le village.",
    act_beaumes_name:     'Beaumes-de-Venise',
    act_beaumes_desc:     'Le fief du célèbre muscat doux de la région.',
    act_gigondas_name:    'Gigondas',
    act_gigondas_desc:    'Un village viticole de carte postale, au pied des Dentelles.',
    act_islesorgue_name:  "L'Isle-sur-la-Sorgue",
    act_islesorgue_desc:  'Marchés d\'antiquaires et balades en canoë sur la Sorgue — célèbre pour son marché du dimanche.',
    act_ventoux_distance:      '~30 min en voiture',
    act_abeilles_distance:     '~35 min en voiture',
    act_accrobranche_distance: '~15 min en voiture',
    act_dentelles_distance:    '~30 min en voiture',
    act_barroux_distance:      '~5 min en voiture',
    act_senanque_distance:     '~45 min en voiture',
    act_orange_distance:       '~35 min en voiture',
    act_arles_distance:        '~1h15 en voiture',
    act_gordes_distance:       '~35 min en voiture',
    act_roussillon_distance:   '~45 min en voiture',
    act_fontaine_distance:     '~40 min en voiture',
    act_vaison_distance:       '~30 min en voiture',
    act_pesquie_distance:      '~10 min en voiture',
    act_chateauneuf_distance:  '~40 min en voiture',
    act_beaumes_distance:      '~20 min en voiture',
    act_gigondas_distance:     '~25 min en voiture',
    act_islesorgue_distance:   '~35 min en voiture',
    activities_map_note:  "Un aperçu approximatif des distances depuis le domaine — sans échelle précise.",
    dress_title:         'Code vestimentaire',
    dress_women:         'Pour les femmes',
    dress_men:           'Pour les hommes',
    dress_fri_label:     'Vendredi 25 juin · Soirée cocktail',
    dress_fri_headline:  'Chic estival',
    dress_fri_intro:     'Une soirée décontractée au milieu des vignes — soignée, mais sans formalité.',
    dress_fri_w:         "Une robe d'été ou un ensemble élégant.",
    dress_fri_m:         'Lin ou chino avec une chemise. Veste facultative, cravate non nécessaire.',
    dress_sat_label:     'Samedi 26 juin · Cérémonie & Réception',
    dress_sat_headline:  'Tenue de soirée',
    dress_sat_intro:     "L'église d'abord, puis dîner et soirée dansante en extérieur.",
    dress_sat_w:         'Robe de soirée, robe de cocktail ou ensemble élégant.',
    dress_sat_wnote:     "La réception après l'église se déroule en extérieur, sur l'herbe — des talons compensés ou blocs sont recommandés.",
    dress_sat_m:         'Costume-cravate.',
    map_title:           'Accès',
    map_gmaps:           'Ouvrir dans Google Maps',
    map_abroad_title:    "De l'étranger",
    map_option1_label:   'Option n°1',
    map_option1_step1:   'Atterrissez à Paris, à l\'aéroport Charles de Gaulle (CDG).',
    map_option1_step2:   "Prenez un TGV direct depuis l'aéroport jusqu'à AVIGNON TGV.",
    map_option1_step3:   "Réservez une voiture à AVIGNON TGV (Sixt, Avis, Europcar — l'offre ne manque pas). C'est le meilleur moyen d'explorer la région.",
    map_option1_step4:   "Crillon-le-Brave se trouve à 40 minutes de route d'AVIGNON TGV.",
    map_option2_label:   'Option n°2',
    map_option2_step1:   'Atterrissez à Marseille, à l\'aéroport de Marseille Provence (MRS).',
    map_option2_step2:   "Réservez une voiture à l'aéroport. Crillon-le-Brave se trouve à 1h20 de route.",
    map_paris_title:     'Depuis Paris',
    map_paris_note:      "Nous ne recommandons pas de faire tout le trajet en voiture — il faut compter 6 à 8h de route, et avec le week-end prolongé, les embouteillages risquent d'allonger encore le trajet. Prenez plutôt le train depuis la Gare de Lyon jusqu'à AVIGNON TGV (2h40), puis réservez une voiture pour la durée de votre séjour sur place.",
    map_avignon_warning: "Important : choisissez AVIGNON TGV — pas Avignon Centre. Cette gare est difficile d'accès et mal desservie en voiture.",
    footer_date:         '26 juin 2027 · Crillon-le-Brave, Provence',
    modal_eyebrow:       'Retenir la date',
    modal_when:          '26 juin 2027 · Crillon-le-Brave',
    modal_prompt:        'Choisissez votre application de calendrier :',
    rsvp_eyebrow:        'RSVP',
    rsvp_contact_label:  'Personne de contact',
    rsvp_email:          'Adresse email',
    rsvp_lastname:       'Nom de famille',
    rsvp_firstnames:     'Prénom(s)',
    rsvp_address:        'Adresse postale',
    rsvp_guests_label:   'Invités',
    rsvp_guest:          'Invité',
    rsvp_firstname:      'Prénom',
    rsvp_relationship:              'Relation (facultatif)',
    rsvp_relationship_placeholder:  'ex. conjoint(e), frère/sœur, accompagnant(e)',
    rsvp_attendance:     'Présence',
    rsvp_yes:            'Avec joie, je serai présent(e)',
    rsvp_maybe:          "J'espère pouvoir participer",
    rsvp_no:             'Je ne pourrai malheureusement pas être présent(e)',
    rsvp_guests_note:    'Merci de renseigner les informations pour les personnes invitées avec vous, afin que nous puissions leur adresser leur invitation.',
    rsvp_add:            "+ Ajouter la réponse d'un autre invité de votre foyer",
    rsvp_remove:         'Supprimer',
    rsvp_submit:         'Confirmer le RSVP',
    rsvp_update:         'Mettre à jour le RSVP',
    rsvp_err_required:   'Ce champ est obligatoire',
    rsvp_err_email:      'Veuillez entrer une adresse email valide',
    rsvp_err_attendance: 'Veuillez sélectionner une option de présence',
    rsvp_thanks:         'Merci.',
    rsvp_edit_again:     'Modifier ma réponse',
    rsvp_success_note:   'Une confirmation a été envoyée à votre adresse email.',
    rsvp_find_note:      "Pour commencer, essayons de vous retrouver dans notre liste d'invités.",
    rsvp_find_placeholder: 'Votre nom',
    rsvp_find_btn:        'Me trouver',
    rsvp_find_skip:       "Je ne me trouve pas — ajouter mes informations manuellement",
    rsvp_find_searching:  'Recherche…',
    rsvp_find_no_matches: "Nous n'avons pas trouvé ce nom dans notre liste — aucun souci.",
    rsvp_find_manual_btn: 'Saisir mes informations manuellement',
    rsvp_find_retry:      'Ou essayez une autre orthographe ci-dessus.',
    rsvp_find_prompt:     "Est-ce vous ?",
    rsvp_find_none:       'Aucun de ces choix — ajouter mes informations manuellement',
    recognition_not_you:        "Ce n'est pas vous ?",
    recognition_edit:           'Voir ou modifier ma réponse',
    recognition_rsvp:           'Recevoir mon invitation',
    cal_both_note:              "Apple Calendar et le fichier iCal ajoutent les deux soirées d'un coup — le cocktail du vendredi et le mariage du samedi.",
    cal_friday_note:            'Le samedi est ajouté. Le cocktail du vendredi est un événement distinct :',
    cal_friday_btn:             '＋ Ajouter aussi le cocktail du vendredi',
    recognition_greeting_responded: 'Bonjour {name} — votre présence est confirmée pour {count}.',
    recognition_greeting_pending:   "Bonjour {name} — heureux de vous revoir, vous n'avez pas encore répondu.",
  },

  de: {
    gate_date:           '26. Juni 2027 · Crillon-le-Brave',
    gate_label:          'Geben Sie Ihren Einladungscode ein',
    gate_submit:         'Weiter',
    gate_error:          'Falscher Code. Bitte versuchen Sie es erneut.',
    nav_welcome:         'Willkommen',
    nav_programme:       'Programm',
    nav_accommodation:   'Unterkunft',
    nav_activities:      'Aktivitäten',
    nav_dresscode:       'Kleidung',
    nav_map:             'Karte',
    lang_icon_label:     'Sprache ändern',
    lang_modal_title:    'Wählen Sie Ihre Sprache',
    welcome_subtitle:    'freuen sich, ihre Hochzeit mit Ihnen zu feiern am',
    welcome_date:        '26. Juni 2027',
    welcome_location:    'Crillon-le-Brave, Provence',
    btn_save:            'Datum speichern',
    btn_rsvp:            'Einladung erhalten',
    prog_title:          'Programm',
    prog_friday:         'Freitag, 25. Juni',
    prog_fri_name:       'Cocktailabend',
    prog_fri_location:   'Château Pesquié',
    prog_saturday:       'Samstag, 26. Juni',
    prog_ceremony_name:  'Kirchliche Trauung',
    prog_ceremony_location: 'Wird noch bekannt gegeben',
    prog_reception_time: 'Ab 19:00 Uhr',
    prog_reception_name: 'Empfang',
    prog_reception_location: 'Domaine des Pins',
    accom_title:         'Unterkunft',
    accom_intro:         'Eine Auswahl an Unterkünften in der Nähe des Veranstaltungsorts, für jeden Geschmack und jedes Budget.',
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
    filter_type:         'Art',
    filter_budget:       'Budget',
    filter_guests:       'Personen',
    filter_all:          'Alle',
    filter_hotel:        'Hotel',
    filter_home:         'Ferienhaus',
    filter_gite:         'Gîte',
    filter_luxury:       'Luxus',
    filter_comfort:      'Komfort',
    filter_simple:       'Einfach',
    filter_no_results:   'Keine Unterkunft entspricht Ihren Filtern.',
    filter_crowd:        'Andrang',
    filter_nature:       'Natur',
    filter_heritage:     'Kultur',
    filter_wine:         'Wein',
    crowd_quiet:         'Ruhig',
    crowd_popular:       'Beliebt',
    filter_audience:     'Für wen',
    audience_everyone:   'Jeder',
    audience_young:      'Abenteuerlustig',
    activities_no_results: 'Keine Aktivität entspricht Ihren Filtern.',
    tier_prem_hotel:     'Luxushotel',
    tier_entire_home:    'Ferienhaus',
    tier_group_gite:     'Gruppen-Gîte',
    tier_small_stay:     'Kleines Haus',
    accom_guests:        'Personen',
    accom_up_to:         'bis zu',
    note_crillon:        'Ultra exklusives Relais & Châteaux im Herzen des Dorfes. Zu Fuß zur Zeremonie.',
    note_maison_crillon: 'Nur für Erwachsene. Boutique-Hotel, sehr raffiniert. Keine Kinder.',
    note_chateau_mazan:  'Großes Schlosshotel. Einfachste Logistik für Gäste in größeren Gruppen.',
    note_becaras:        'Schöne Aussicht. Haupthaus kann mit B&B-Zimmern kombiniert werden. Ideal für Gruppen.',
    note_armajeva:       'Moderne Villa, ruhige Lage. Ideal für eine kleine Gruppe.',
    note_aube_ventoux:   'Geräumig mit Pool. Klassisches Provence-Feeling.',
    note_gautier:        'Mehrere Einheiten, ideal für Familien oder Freundesgruppen.',
    note_moulin:         'Sehr große Kapazität. Ideal für große Gruppen, die zusammen bleiben möchten.',
    note_chez_nico:      'Zentral in Bédoin. Zusammenliegende Apartments, leicht zu koordinieren.',
    note_dom_pierres:    'Flexible Kapazität mit Pool. Gastfreundlicher Vermieter, leicht zu koordinieren.',
    note_mas_stjacques:  'Die nächstgelegene Option zur Feier. Sehr praktisch für das Hochzeitswochenende.',
    note_jas_ventoux:    'Charmant und einfach. Sehr nah am Veranstaltungsort.',
    note_brin_bois:      'Klein und budgetfreundlich. Ruhige Lage.',
    note_sidoine:        'Naturlage mit getrennten Einheiten. Ruhig und friedlich.',
    note_clos_marceau:   'Gut bewertetes B&B. Solide Alternative mit guten Bewertungen.',
    accom_search_title:      'Direkt suchen & buchen',
    accom_search_intro:      'Der schnellste Weg, eine Unterkunft zu finden, ist die direkte Suche auf:',
    accom_search_note:       'In der Umgebung gibt es viele Unterkunftsmöglichkeiten, aber wir empfehlen eine frühzeitige Buchung — zu dieser Jahreszeit sind sie schnell ausgebucht. Die nächstgelegenen Dörfer sind Crillon-le-Brave und Bédoin; Caromb, Mormoiron und Mazan liegen wenige Minuten entfernt und bieten weitere Optionen. Die meisten Unterkünfte werden im Sommer wochenweise vermietet, und viele Gîtes berechnen Bettwäsche extra — am besten vor der Buchung nachfragen.',
    accom_suggestions_intro: 'Ein paar Vorschläge von uns, um Ihnen den Einstieg zu erleichtern:',
    activities_title:    'Aktivitäten',
    activities_intro:    'Ein paar unserer liebsten Möglichkeiten, die Provence zu genießen — ob Sie früher anreisen oder nach den Feierlichkeiten noch bleiben.',
    activities_cat_nature:   'Wandern & Rad',
    activities_cat_heritage: 'Ausflüge & Dörfer',
    activities_cat_wine:     'Weingüter',
    act_ventoux_name:     'Mont Ventoux',
    act_ventoux_desc:     'Der legendäre „Riese der Provence" — mit dem Auto oder dem Rad bis zum Gipfel für einen Panoramablick über das Vaucluse.',
    act_abeilles_name:    'Col des Abeilles',
    act_abeilles_desc:    'Ein ruhigerer Pass mitten im Land der Imker, bei Radfahrern beliebt für den Blick auf den Ventoux-Kamm.',
    act_accrobranche_name:'Ventoux Aventure (Seilrutschen)',
    act_accrobranche_desc:'Kletterparcours und Seilrutschen im Pinienwald — ein Vergnügen für die ganze Familie.',
    act_dentelles_name:   'Dentelles de Montmirail',
    act_dentelles_desc:   'Zerklüftete Kalksteinkämme mit Wanderwegen und weiten Blicken über die Weinberge.',
    act_barroux_name:     'Château du Barroux',
    act_barroux_desc:     'Eine restaurierte mittelalterliche Festung mit Blick über die Ebene, nur wenige Minuten von Crillon-le-Brave entfernt.',
    act_senanque_name:    'Abbaye de Sénanque',
    act_senanque_desc:    'Die berühmte Zisterzienserabtei inmitten von Lavendelfeldern, nahe Gordes.',
    act_orange_name:      "Théâtre Antique d'Orange",
    act_orange_desc:      'Ein bemerkenswert gut erhaltenes römisches Theater und UNESCO-Weltkulturerbe.',
    act_arles_name:       'Arles',
    act_arles_desc:       'Römische Arena und Amphitheater, in der Stadt, die Van Gogh inspirierte.',
    act_gordes_name:      'Gordes',
    act_gordes_desc:      'Eines der schönsten Bergdörfer Frankreichs, ganz aus honigfarbenem Stein mit Blick ins Tal.',
    act_roussillon_name:  'Roussillon und der Sentier des Ocres',
    act_roussillon_desc:  'Ein Wanderweg durch leuchtend rote Ockerfelsen.',
    act_fontaine_name:    'Fontaine-de-Vaucluse',
    act_fontaine_desc:    'Die Quelle der Sorgue, in einem schattigen Dorf am Fluss.',
    act_vaison_name:      'Vaison-la-Romaine',
    act_vaison_desc:      'Gut erhaltene römische Ruinen und ein lebhafter Dienstagsmarkt.',
    act_pesquie_name:     'Château Pesquié',
    act_pesquie_desc:     'Ein Familienweingut in der Appellation Ventoux, bekannt für elegante Rotweine.',
    act_chateauneuf_name: 'Châteauneuf-du-Pape',
    act_chateauneuf_desc: 'Die berühmteste Appellation des Rhônetals, mit Weinproben im ganzen Dorf.',
    act_beaumes_name:     'Beaumes-de-Venise',
    act_beaumes_desc:     'Die Heimat des berühmten süßen Muskatweins der Region.',
    act_gigondas_name:    'Gigondas',
    act_gigondas_desc:    'Ein bilderbuchhaftes Weindorf am Fuß der Dentelles.',
    act_islesorgue_name:  "L'Isle-sur-la-Sorgue",
    act_islesorgue_desc:  'Antiquitätenmärkte und Kanufahrten auf der Sorgue — berühmt für seinen Sonntagsmarkt.',
    act_ventoux_distance:      '~30 Min. mit dem Auto',
    act_abeilles_distance:     '~35 Min. mit dem Auto',
    act_accrobranche_distance: '~15 Min. mit dem Auto',
    act_dentelles_distance:    '~30 Min. mit dem Auto',
    act_barroux_distance:      '~5 Min. mit dem Auto',
    act_senanque_distance:     '~45 Min. mit dem Auto',
    act_orange_distance:       '~35 Min. mit dem Auto',
    act_arles_distance:        '~1h15 mit dem Auto',
    act_gordes_distance:       '~35 Min. mit dem Auto',
    act_roussillon_distance:   '~45 Min. mit dem Auto',
    act_fontaine_distance:     '~40 Min. mit dem Auto',
    act_vaison_distance:       '~30 Min. mit dem Auto',
    act_pesquie_distance:      '~10 Min. mit dem Auto',
    act_chateauneuf_distance:  '~40 Min. mit dem Auto',
    act_beaumes_distance:      '~20 Min. mit dem Auto',
    act_gigondas_distance:     '~25 Min. mit dem Auto',
    act_islesorgue_distance:   '~35 Min. mit dem Auto',
    activities_map_note:  'Eine ungefähre Orientierung zu den Entfernungen ab dem Anwesen — nicht maßstabsgetreu.',
    dress_title:         'Dresscode',
    dress_women:         'Für Damen',
    dress_men:           'Für Herren',
    dress_fri_label:     'Freitag, 25. Juni · Cocktailabend',
    dress_fri_headline:  'Sommerlich schick',
    dress_fri_intro:     'Ein entspannter Abend zwischen den Reben — gepflegt, aber ohne Förmlichkeit.',
    dress_fri_w:         'Ein Sommerkleid oder ein elegantes Ensemble.',
    dress_fri_m:         'Leinen oder Chino mit Hemd. Sakko optional, Krawatte nicht nötig.',
    dress_sat_label:     'Samstag, 26. Juni · Trauung & Empfang',
    dress_sat_headline:  'Abendgarderobe',
    dress_sat_intro:     'Zuerst die Kirche, dann Dinner und Tanz im Freien.',
    dress_sat_w:         'Abendkleid, Cocktailkleid oder elegantes Ensemble.',
    dress_sat_wnote:     'Der Empfang nach der Kirche findet draußen auf Rasen statt — Keil- oder Blockabsätze werden empfohlen.',
    dress_sat_m:         'Ein Anzug mit Krawatte.',
    map_title:           'Anreise',
    map_gmaps:           'In Google Maps öffnen',
    map_abroad_title:    'Aus dem Ausland anreisen',
    map_option1_label:   'Option 1',
    map_option1_step1:   'Landen Sie in Paris am Flughafen Charles de Gaulle (CDG).',
    map_option1_step2:   'Nehmen Sie einen direkten TGV vom Flughafen nach AVIGNON TGV.',
    map_option1_step3:   'Mieten Sie ein Auto direkt am Bahnhof AVIGNON TGV (Sixt, Avis, Europcar — die Auswahl ist groß). Das ist die beste Art, die Region zu erkunden.',
    map_option1_step4:   'Crillon-le-Brave liegt eine 40-minütige Autofahrt von AVIGNON TGV entfernt.',
    map_option2_label:   'Option 2',
    map_option2_step1:   'Landen Sie in Marseille am Flughafen Marseille Provence (MRS).',
    map_option2_step2:   'Mieten Sie ein Auto direkt am Flughafen. Crillon-le-Brave liegt eine 1 Std. 20 Min. entfernte Autofahrt entfernt.',
    map_paris_title:     'Anreise ab Paris',
    map_paris_note:      'Wir empfehlen nicht, die gesamte Strecke mit dem Auto zu fahren — das dauert 6 bis 8 Stunden, und durch das lange Wochenende ist mit zusätzlichem Stau zu rechnen. Nehmen Sie stattdessen den Zug vom Gare de Lyon nach AVIGNON TGV (2 Std. 40 Min.) und mieten Sie anschließend ein Auto für Ihren Aufenthalt vor Ort.',
    map_avignon_warning: 'Wichtig: Wählen Sie AVIGNON TGV — nicht Avignon Centre. Dieser Bahnhof ist schwer zu erreichen und mit dem Auto schlecht zu navigieren.',
    footer_date:         '26. Juni 2027 · Crillon-le-Brave, Provence',
    modal_eyebrow:       'Datum speichern',
    modal_when:          '26. Juni 2027 · Crillon-le-Brave',
    modal_prompt:        'Wählen Sie Ihre Kalenderanwendung:',
    rsvp_eyebrow:        'RSVP',
    rsvp_contact_label:  'Kontaktperson',
    rsvp_email:          'E-Mail-Adresse',
    rsvp_lastname:       'Nachname',
    rsvp_firstnames:     'Vorname(n)',
    rsvp_address:        'Postanschrift',
    rsvp_guests_label:   'Gäste',
    rsvp_guest:          'Gast',
    rsvp_firstname:      'Vorname',
    rsvp_relationship:              'Beziehung (optional)',
    rsvp_relationship_placeholder:  'z. B. Ehepartner/in, Geschwister, Begleitung',
    rsvp_attendance:     'Teilnahme',
    rsvp_yes:            'Mit Freude, ich werde dabei sein',
    rsvp_maybe:          'Ich hoffe, teilnehmen zu können',
    rsvp_no:             'Leider werde ich nicht teilnehmen können',
    rsvp_guests_note:    'Bitte geben Sie die Informationen für die mit Ihnen eingeladenen Personen an, damit wir ihnen ihre Einladung zukommen lassen können.',
    rsvp_add:            '+ Antwort eines weiteren Mitglieds Ihres Haushalts hinzufügen',
    rsvp_remove:         'Entfernen',
    rsvp_submit:         'RSVP bestätigen',
    rsvp_update:         'RSVP aktualisieren',
    rsvp_err_required:   'Dieses Feld ist erforderlich',
    rsvp_err_email:      'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    rsvp_err_attendance: 'Bitte wählen Sie eine Teilnahme-Option',
    rsvp_thanks:         'Vielen Dank.',
    rsvp_edit_again:     'Meine Antwort ändern',
    rsvp_success_note:   'Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.',
    rsvp_find_note:      'Lassen Sie uns zunächst prüfen, ob Sie auf unserer Gästeliste stehen.',
    rsvp_find_placeholder: 'Ihr Name',
    rsvp_find_btn:        'Mich finden',
    rsvp_find_skip:       'Ich wurde nicht gefunden — Angaben manuell hinzufügen',
    rsvp_find_searching:  'Suche…',
    rsvp_find_no_matches: 'Wir haben diesen Namen nicht in unserer Liste gefunden — kein Problem.',
    rsvp_find_manual_btn: 'Meine Angaben manuell eingeben',
    rsvp_find_retry:      'Oder versuchen Sie oben eine andere Schreibweise.',
    rsvp_find_prompt:     'Sind Sie das?',
    rsvp_find_none:       'Keine davon — Angaben manuell hinzufügen',
    recognition_not_you:        'Nicht Sie?',
    recognition_edit:           'Antwort ansehen oder ändern',
    recognition_rsvp:           'Meine Einladung erhalten',
    cal_both_note:              'Apple Calendar und die iCal-Datei fügen beide Abende auf einmal hinzu — den Cocktail am Freitag und die Hochzeit am Samstag.',
    cal_friday_note:            'Samstag ist eingetragen. Der Cocktail am Freitag ist ein eigener Termin:',
    cal_friday_btn:             '＋ Cocktail am Freitag ebenfalls hinzufügen',
    recognition_greeting_responded: 'Hallo {name} — Sie sind für {count} bestätigt.',
    recognition_greeting_pending:   'Hallo {name} — willkommen zurück, Sie haben noch nicht geantwortet.',
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
  initLangModal();
  initRSVP();
  initRecognition();
  initFilters();
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

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    if (t[key] != null) el.setAttribute('aria-label', t[key]);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key] != null) el.setAttribute('placeholder', t[key]);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === l);
  });

  renderBanner();
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

// ── Filters (Accommodation + Activities) ──────────
function initFilters() {
  setupFilterGroup({
    scope: document.getElementById('accommodation'),
    cardSelector: '.hotel-card',
    noResultsSelector: '.filter-empty',
  });
  setupFilterGroup({
    scope: document.getElementById('activities'),
    cardSelector: '.activity-card',
    noResultsSelector: '.filter-empty',
    catGroupSelector: '.activities-cat',
  });
}

function setupFilterGroup({ scope, cardSelector, noResultsSelector, catGroupSelector }) {
  if (!scope) return;
  const state = {};
  const cards = scope.querySelectorAll(cardSelector);
  const noResults = scope.querySelector(noResultsSelector);
  const pills = scope.querySelectorAll('.filter-pill');
  const catGroups = catGroupSelector ? scope.querySelectorAll(catGroupSelector) : [];

  pills.forEach(pill => { state[pill.dataset.filterGroup] = 'all'; });

  function applyFilters() {
    let visible = 0;
    cards.forEach(card => {
      const show = Object.keys(state).every(group => {
        if (state[group] === 'all') return true;
        if (group === 'capacity') return parseInt(card.dataset.capacity) >= parseInt(state[group]);
        return card.dataset[group] === state[group];
      });
      card.classList.toggle('hidden', !show);
      if (show) visible++;
    });
    catGroups.forEach(group => {
      const anyVisible = [...group.querySelectorAll(cardSelector)].some(c => !c.classList.contains('hidden'));
      group.classList.toggle('hidden', !anyVisible);
    });
    if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.dataset.filterGroup;
      const value = pill.dataset.filterValue;
      state[group] = value;
      scope.querySelectorAll(`.filter-pill[data-filter-group="${group}"]`).forEach(p => {
        p.classList.toggle('active', p.dataset.filterValue === value);
      });
      applyFilters();
    });
  });

  applyFilters();
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

  overlay.querySelectorAll('.cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCalendar(btn.dataset.cal);
      closeModal();
    });
  });
}

// ── Language Modal (mobile) ───────────────────────
function initLangModal() {
  const trigger  = document.getElementById('lang-icon-btn');
  const overlay  = document.getElementById('lang-overlay');
  const closeBtn = document.getElementById('lang-modal-close');
  if (!trigger || !overlay) return;

  function open() {
    overlay.classList.add('open');
    overlay.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
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

function calendarUrls(e) {
  const enc = encodeURIComponent;
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE` +
             `&text=${enc(e.title)}&dates=${e.startUtc}/${e.endUtc}` +
             `&details=${enc(e.description)}&location=${enc(e.location)}`,

    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?` +
              `subject=${enc(e.title)}&startdt=${e.startPlain}` +
              `&enddt=${e.endPlain}&location=${enc(e.location)}&body=${enc(e.description)}`,

    office365: `https://outlook.office.com/calendar/0/deeplink/compose?` +
                `subject=${enc(e.title)}&startdt=${e.startPlain}` +
                `&enddt=${e.endPlain}&location=${enc(e.location)}&body=${enc(e.description)}`,

    yahoo: `https://calendar.yahoo.com/?v=60&title=${enc(e.title)}` +
            `&st=${e.startLocal}&et=${e.endLocal}` +
            `&desc=${enc(e.description)}&in_loc=${enc(e.location)}`,
  };
}

function addToCalendar(type) {
  // A downloaded file can hold both days, so give them both in one click.
  if (type === 'apple' || type === 'ical') {
    downloadICS([EVENT_FRIDAY, EVENT]);
    return;
  }
  // Web calendars accept one event per link, and opening a second window
  // would be swallowed by popup blockers — so add Saturday now and offer
  // Friday as its own deliberate click.
  const urls = calendarUrls(EVENT);
  if (urls[type]) {
    window.open(urls[type], '_blank', 'noopener,noreferrer');
    showFridayFollowUp(type);
  }
}

function showFridayFollowUp(type) {
  const host = document.getElementById('cal-friday-followup');
  if (!host) return;
  const t = T[lang] || T.en;
  const url = calendarUrls(EVENT_FRIDAY)[type];
  if (!url) return;
  host.innerHTML =
    `<p class="cal-followup-note">${escHtml(t.cal_friday_note)}</p>` +
    `<a class="btn btn-outline btn-full" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">` +
    `${escHtml(t.cal_friday_btn)}</a>`;
  host.style.display = 'block';
}

function downloadICS(events) {
  const list = Array.isArray(events) ? events : [events || EVENT];
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eléonore & Hubert Wedding//EN',
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
  ].concat(
    // One VEVENT per day, each with its own UID so calendars treat them as
    // separate entries rather than overwriting one another.
    list.reduce(function(acc, e) {
      return acc.concat([
        'BEGIN:VEVENT',
        `DTSTART;TZID=Europe/Paris:${e.startLocal}`,
        `DTEND;TZID=Europe/Paris:${e.endLocal}`,
        `SUMMARY:${e.title}`,
        `LOCATION:${e.location.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${e.description}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        `UID:${e.uid}`,
        'END:VEVENT',
      ]);
    }, [])
  ).concat([
    'END:VCALENDAR',
  ]).join('\r\n');

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

  const editBtn = document.getElementById('rsvp-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => {
    showRSVPFormView();
    revealMainFields();
    if (editToken) fetchExistingRSVP(editToken);
  });

  // Keep attendee guest labels updated on lang change
  const origApplyLang = window.__origApplyLang;
  if (!origApplyLang) {
    // Patch lang switcher to also renumber attendees
    document.addEventListener('click', e => {
      if (e.target.closest('.lang-btn')) setTimeout(renumberAttendees, 10);
    });
  }

  addAttendee(true);

  ['f-firstname', 'f-lastname'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncContactToGuest1);
  });
  syncContactToGuest1();
}

async function openRSVP() {
  const overlay = document.getElementById('rsvp-overlay');
  overlay.classList.add('open');
  overlay.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';

  // Reopening after a submit used to land back on the thank-you screen with
  // no way forward, so always return to the form and let the branches below
  // decide what it should contain.
  showRSVPFormView();
  syncContactToGuest1();

  await recognitionPromise;
  if (editToken) {
    revealMainFields();
    fetchExistingRSVP(editToken);
  } else if (householdToken && householdPartySize) {
    scaffoldAttendeesForHousehold();
    revealMainFields();
  }
}

function showRSVPFormView() {
  const form    = document.getElementById('rsvp-form-view');
  const success = document.getElementById('rsvp-success-view');
  if (form)    form.style.display = 'block';
  if (success) success.style.display = 'none';
  const modal = document.querySelector('.rsvp-modal');
  if (modal) modal.scrollTop = 0;
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
  if (isFirst) block.dataset.isContact = 'true';

  const checked = s => prefill && prefill.status === s ? 'checked' : '';

  const nameFields = isFirst
    ? `<div class="form-group">
        <div class="att-contact-name"></div>
      </div>`
    : `<div class="form-row">
        <div class="form-group">
          <label class="form-label">
            <span data-i18n="rsvp_firstname">${t.rsvp_firstname}</span> <span class="req">*</span>
          </label>
          <input type="text" name="att_firstname_${idx}" class="form-input att-firstname"
                 value="${prefill ? escHtml(prefill.firstName || '') : ''}">
          <div class="form-error att-err-firstname"></div>
        </div>
        <div class="form-group">
          <label class="form-label">
            <span data-i18n="rsvp_lastname">${t.rsvp_lastname}</span> <span class="req">*</span>
          </label>
          <input type="text" name="att_lastname_${idx}" class="form-input att-lastname"
                 value="${prefill ? escHtml(prefill.lastName || '') : ''}">
          <div class="form-error att-err-lastname"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">
          <span data-i18n="rsvp_relationship">${t.rsvp_relationship}</span>
        </label>
        <input type="text" name="att_relationship_${idx}" class="form-input att-relationship"
               placeholder="${t.rsvp_relationship_placeholder}"
               value="${prefill ? escHtml(prefill.relationship || '') : ''}">
      </div>`;

  block.innerHTML = `
    <div class="attendee-header">
      <span class="attendee-num"></span>
      ${!isFirst ? `<button type="button" class="attendee-remove">${t.rsvp_remove}</button>` : ''}
    </div>
    ${nameFields}
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

function syncContactToGuest1() {
  const fn = (document.getElementById('f-firstname') || {}).value?.trim() || '';
  const ln = (document.getElementById('f-lastname')  || {}).value?.trim() || '';
  const display = document.querySelector('#attendees-list [data-is-contact] .att-contact-name');
  if (display) display.textContent = [fn, ln].filter(Boolean).join(' ');
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
    const statusEl = block.querySelector('input[type="radio"]:checked');
    let firstName, lastName, relationship;
    if (block.dataset.isContact) {
      firstName = form.firstName.value.trim();
      lastName  = form.lastName.value.trim();
      relationship = '';
    } else {
      firstName = (block.querySelector('.att-firstname') || {}).value?.trim() || '';
      lastName  = (block.querySelector('.att-lastname')  || {}).value?.trim() || '';
      relationship = (block.querySelector('.att-relationship') || {}).value?.trim() || '';
    }
    attendees.push({ firstName, lastName, relationship, status: statusEl ? statusEl.value : '' });
  });
  return {
    email:     form.email.value.trim(),
    firstName: form.firstName.value.trim(),
    lastName:  form.lastName.value.trim(),
    address:   form.address.value.trim(),
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
  if (!data.firstName) showErr('err-firstName', t.rsvp_err_required);
  if (!data.lastName)  showErr('err-lastName',  t.rsvp_err_required);
  if (!data.address)   showErr('err-address',   t.rsvp_err_required);

  document.querySelectorAll('#attendees-list .attendee-block').forEach(block => {
    const fnEl      = block.querySelector('.att-firstname');
    const lnEl      = block.querySelector('.att-lastname');
    const statusEl  = block.querySelector('input[type="radio"]:checked');
    const fnErr     = block.querySelector('.att-err-firstname');
    const lnErr     = block.querySelector('.att-err-lastname');
    const statusErr = block.querySelector('.att-err-status');
    if (fnEl && !fnEl.value.trim() && fnErr) {
      fnErr.textContent = t.rsvp_err_required; fnErr.classList.add('visible'); valid = false;
    }
    if (lnEl && !lnEl.value.trim() && lnErr) {
      lnErr.textContent = t.rsvp_err_required; lnErr.classList.add('visible'); valid = false;
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
    ? { action: 'update', token: editToken, lang, householdToken: householdToken || '', ...data }
    : { action: 'submit', lang, householdToken: householdToken || '', ...data };

  try {
    const res    = await fetch(RSVP_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.success) {
      document.getElementById('rsvp-form-view').style.display  = 'none';
      document.getElementById('rsvp-success-view').style.display = 'block';
      document.querySelector('.rsvp-modal').scrollTop = 0;
      if (result.token) {
        editToken = result.token;
        // Remember this guest for next time, even if they weren't matched
        // against the guest list (self-added) — same "no login" recognition.
        localStorage.setItem('weddingEditToken', result.token);
      }
      // Reflect the new state on the page straight away, rather than only
      // after the guest happens to reload.
      setRecognition('responded', data.firstName || '', (data.attendees || []).length);
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
  form.email.value     = data.email     || '';
  form.firstName.value = data.firstName || '';
  form.lastName.value  = data.lastName  || '';
  form.address.value   = data.address   || '';

  document.getElementById('attendees-list').innerHTML = '';
  attendeeCount = 0;

  const attendees = data.attendees || [];
  attendees.forEach((att, i) => addAttendee(i === 0, att));
  if (attendees.length === 0) addAttendee(true);
  syncContactToGuest1();
}

// ══════════════════════════════════════════════════
// GUEST RECOGNITION — "remember me" without login
// A guest types their name once; if we find them on the pre-loaded guest
// list, they confirm it's them and we remember their household in this
// browser (no link, no account). If we can't find them, they just fill in
// their own details and get flagged "Self-added" in the sheet.
// ══════════════════════════════════════════════════

let householdToken     = localStorage.getItem('weddingHouseholdToken') || null;
let householdPartySize = null;
let householdGuests    = [];   // names of everyone on the invitation
let lastMatches        = [];   // candidates from the most recent search
let recognition        = null; // {status, name, count} for the greeting banner
let recognitionPromise = Promise.resolve();

const GREETING_SKIP_WORDS = ['mr', 'mrs', 'ms', 'mme', 'melle', 'mlle', 'herr', 'frau', 'and', 'et', 'und', 'the'];

function extractGreetingName(label) {
  const words = (label || '').split(/\s+/).filter(Boolean);
  for (const w of words) {
    const clean = w.replace(/[^\p{L}-]/gu, '');
    if (clean && GREETING_SKIP_WORDS.indexOf(clean.toLowerCase()) === -1) return clean;
  }
  return words[0] || '';
}

function initRecognition() {
  const input   = document.getElementById('rsvp-find-input');
  const findBtn = document.getElementById('rsvp-find-btn');
  const skipBtn = document.getElementById('rsvp-find-skip');
  const notYouBtn = document.getElementById('recognition-not-you');

  if (findBtn) findBtn.addEventListener('click', runNameSearch);
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runNameSearch(); }
  });
  if (skipBtn) skipBtn.addEventListener('click', () => revealMainFields());
  if (notYouBtn) notYouBtn.addEventListener('click', clearRecognition);

  const actionBtn = document.getElementById('recognition-action');
  if (actionBtn) actionBtn.addEventListener('click', openRSVP);

  if (editToken) return; // came via an emailed edit link this load — untouched, no banner

  if (householdToken) {
    recognitionPromise = silentRecognizeByHousehold(householdToken);
  } else {
    const storedEditToken = localStorage.getItem('weddingEditToken');
    if (storedEditToken) recognitionPromise = silentRecognizeByEditToken(storedEditToken);
  }
}

async function silentRecognizeByHousehold(token) {
  if (!RSVP_ENDPOINT) return;
  try {
    const res    = await fetch(RSVP_ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'lookupByToken', householdToken: token }) });
    const result = await res.json();
    if (!result.success) { clearRecognition(); return; }

    const t = T[lang] || T.en;
    if (result.status === 'responded') {
      editToken = result.editToken;
      setRecognition('responded',
        result.data.firstName || extractGreetingName(result.label),
        (result.data.attendees || []).length);
    } else {
      householdPartySize = result.partySize;
      householdGuests    = result.guests || [];
      setRecognition('pending', extractGreetingName(result.label), result.partySize || 0);
    }
  } catch { /* stay silent — treat as unrecognized */ }
}

async function silentRecognizeByEditToken(token) {
  if (!RSVP_ENDPOINT) return;
  try {
    const res    = await fetch(`${RSVP_ENDPOINT}?token=${encodeURIComponent(token)}`);
    const result = await res.json();
    if (!result.success || !result.data) { localStorage.removeItem('weddingEditToken'); return; }
    editToken = token;
    setRecognition('responded', result.data.firstName || '',
                   (result.data.attendees || []).length);
  } catch { /* stay silent */ }
}

async function runNameSearch() {
  const input     = document.getElementById('rsvp-find-input');
  const resultsEl = document.getElementById('rsvp-find-results');
  const t = T[lang] || T.en;
  const name = (input.value || '').trim();
  if (!name || !RSVP_ENDPOINT || !resultsEl) return;

  const staticSkip = document.getElementById('rsvp-find-skip');
  if (staticSkip) staticSkip.style.display = 'none';
  resultsEl.innerHTML = `<p class="rsvp-find-status">${t.rsvp_find_searching}</p>`;

  try {
    const res    = await fetch(RSVP_ENDPOINT, { method: 'POST', body: JSON.stringify({ action: 'lookupByName', name }) });
    const result = await res.json();
    renderFindResults(result.matches || []);
  } catch {
    resultsEl.innerHTML = '';
    if (staticSkip) staticSkip.style.display = '';
  }
}

function renderFindResults(matches) {
  const resultsEl = document.getElementById('rsvp-find-results');
  const t = T[lang] || T.en;
  if (!resultsEl) return;

  // Nothing found: never advance on our own — a form appearing by itself
  // reads as the site having lost their answer. Offer an explicit choice.
  if (matches.length === 0) {
    resultsEl.innerHTML = `
      <p class="rsvp-find-status">${t.rsvp_find_no_matches}</p>
      <button type="button" class="btn btn-primary btn-full rsvp-find-manual" id="rsvp-find-manual-btn">${t.rsvp_find_manual_btn}</button>
      <p class="rsvp-find-retry">${t.rsvp_find_retry}</p>
    `;
    const manualBtn = document.getElementById('rsvp-find-manual-btn');
    if (manualBtn) manualBtn.addEventListener('click', () => revealMainFields());
    return;
  }

  // Keep the full match objects around so the household's names survive the
  // trip through the DOM without being stuffed into data- attributes.
  lastMatches = matches;

  const items = matches.map((m, i) =>
    `<button type="button" class="rsvp-find-candidate" data-idx="${i}">${escHtml(m.label)}</button>`
  ).join('');

  resultsEl.innerHTML = `
    <p class="rsvp-find-status">${t.rsvp_find_prompt}</p>
    ${items}
    <button type="button" class="btn btn-outline btn-full rsvp-find-manual" id="rsvp-find-none-btn">${t.rsvp_find_none}</button>
  `;

  resultsEl.querySelectorAll('.rsvp-find-candidate').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = lastMatches[parseInt(btn.dataset.idx, 10)];
      if (m) confirmHousehold(m.token, m.partySize, m.guests);
    });
  });
  const noneBtn = document.getElementById('rsvp-find-none-btn');
  if (noneBtn) noneBtn.addEventListener('click', () => revealMainFields());
}

async function confirmHousehold(token, partySize, guests) {
  householdToken = token;
  householdPartySize = partySize ? parseInt(partySize, 10) : null;
  householdGuests = Array.isArray(guests) ? guests : [];
  localStorage.setItem('weddingHouseholdToken', token);
  scaffoldAttendeesForHousehold();
  revealMainFields();
}

// Build one attendee block per seat on the invitation, pre-filled with the
// names we already hold. Seats with no name in the guest list stay blank for
// the guest to complete.
function scaffoldAttendeesForHousehold() {
  const guests = householdGuests || [];
  const n = parseInt(householdPartySize, 10) || guests.length;
  if (!n) return;

  // The person who matched the search is offered as the contact.
  const first = guests[0];
  if (first) {
    const fn = document.getElementById('f-firstname');
    const ln = document.getElementById('f-lastname');
    if (fn && !fn.value.trim()) fn.value = first.firstName || '';
    if (ln && !ln.value.trim()) ln.value = first.lastName || '';
  }

  document.getElementById('attendees-list').innerHTML = '';
  attendeeCount = 0;
  for (let i = 0; i < n; i++) {
    const g = guests[i] || {};
    addAttendee(i === 0, i === 0 ? null : {
      firstName: g.firstName || '',
      lastName:  g.lastName  || '',
    });
  }
  syncContactToGuest1();
}

function revealMainFields() {
  const step = document.getElementById('rsvp-find-step');
  const main = document.getElementById('rsvp-main-fields');
  if (step) step.style.display = 'none';
  if (main) main.style.display = 'block';
}

// The banner is stored as state, not as a finished string, so switching
// language re-renders it. Writing the text once left it stuck in whichever
// language happened to be active when the guest was first recognised.
function setRecognition(status, name, count) {
  recognition = { status: status, name: name || '', count: count || 0 };
  renderBanner();
}

function renderBanner() {
  const banner = document.getElementById('recognition-banner');
  const textEl = document.getElementById('recognition-text');
  const actionBtn = document.getElementById('recognition-action');
  if (!banner || !textEl) return;

  if (!recognition) { banner.style.display = 'none'; return; }

  const t = T[lang] || T.en;
  const key = recognition.status === 'responded'
    ? 'recognition_greeting_responded' : 'recognition_greeting_pending';
  textEl.textContent = (t[key] || '')
    .replace('{name}', recognition.name)
    .replace('{count}', String(recognition.count));

  if (actionBtn) {
    actionBtn.textContent = recognition.status === 'responded'
      ? t.recognition_edit : t.recognition_rsvp;
  }
  banner.style.display = 'block';
}

function clearRecognition() {
  householdToken = null;
  householdPartySize = null;
  householdGuests = [];
  editToken = null;
  localStorage.removeItem('weddingHouseholdToken');
  localStorage.removeItem('weddingEditToken');
  recognition = null;
  renderBanner();
}

/* ============================================================================
   i18n.js — EN/FR language layer for the PUBLIC site (admin UI is NOT touched).
   ----------------------------------------------------------------------------
   • Default language: English. Selection persisted in localStorage (apex_lang).
   • French translations live in DICT below, keyed by the exact English source
     text (trimmed). A TreeWalker translates every matching text node + a small
     set of attributes; a scoped MutationObserver re-translates dynamically
     inserted content (service finder, zone-check results, toasts, etc.).
   • NOT translated: phone numbers, emails, postal codes, addresses, proper
     nouns (Acme Services, Toronto, GTA, ALOA, Google, Visa, brand names…).
   • Loaded LAST (after app.js) so scripts capture English defaults first.
   TODO: when a backend exists, source translations from a CMS/locale file and
         add more languages here instead of hardcoding the dictionary.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'apex_lang';

  // English source → French. Only listed strings translate; anything absent
  // (numbers, proper nouns, admin-edited copy) is left exactly as-is.
  var DICT = {
    /* ── Top stripe ── */
    'ON-DUTY · 24/7': 'DE GARDE · 24/7',

    /* ── Nav ── */
    'Home': 'Accueil',
    'About': 'À propos',
    'Reviews': 'Avis',
    'CALL NOW': 'APPELEZ',

    /* ── Hero ── */
    'EMERGENCY · 24/7': 'URGENCE · 24/7',
    'Your': 'Votre',
    'Security': 'Sécurité',
    'Is our': 'est notre',
    'Priority.': 'priorité.',
    'Break-in Repair, Lockouts, Commercial, Residential, Apt/Condo, Cars, Safes, Lock Changes and Repairs, Burglary Repairs, UPVC Door & Window Locks. Serving Toronto & GTA since 2022.':
      "Réparation après Effraction, Ouvertures de Porte, Commercial, Résidentiel, Appartement/Condo, Voitures, Coffres-forts, Changement et Réparation de Serrures, Réparations après Cambriolage, Serrures de Portes et Fenêtres UPVC. Au service de Toronto et du GTA depuis 2022.",
    'TAP TO CALL': 'TOUCHEZ POUR APPELER',
    'NON-DESTRUCTIVE ENTRY': 'OUVERTURE NON DESTRUCTIVE',
    '4 YRS · EST. 2022': '4 ANS · DEPUIS 2022',
    'LIVE · DISPATCH OPEN': 'EN DIRECT · RÉPARTITION OUVERTE',
    'ON ROAD': 'EN ROUTE',
    'to your door, anywhere in Toronto & GTA': 'à votre porte, partout à Toronto et dans le GTA',
    'FASTEST · 11 MIN': 'PLUS RAPIDE · 11 MIN',
    'NIGHT MAX · 24 MIN': 'MAX NUIT · 24 MIN',
    'ZONE CHECK': 'VÉRIF. ZONE',
    'BY POSTAL': 'PAR CODE POSTAL',
    'We dispatch across Toronto & GTA. Enter your postal code.':
      'Nous desservons Toronto et le GTA. Entrez votre code postal.',
    'Check': 'Vérifier',
    'Format: A0A 0A0 · Try M5V 1A1 · L4W 0E1': 'Format : A0A 0A0 · Essayez M5V 1A1 · L4W 0E1',
    'USE MY LOCATION': 'UTILISER MA POSITION',

    /* ── Trust strip ── */
    'YRS / TORONTO': 'ANS / TORONTO',
    'EST. 2022': 'DEPUIS 2022',
    'SATISFACTION': 'SATISFACTION',
    'GUARANTEED WORK': 'TRAVAIL GARANTI',
    'M MEDIAN ETA': 'M ETA MÉDIAN',
    '24/7 DISPATCH': 'RÉPARTITION 24/7',
    'JOBS COMPLETED': 'INTERVENTIONS RÉALISÉES',
    'AND COUNTING': 'ET ÇA CONTINUE',

    /* ── Service finder ── */
    "What's": "Qu'est-ce qui est",
    'locked?': 'verrouillé ?',
    'SERVICE FINDER': 'TROUVEUR DE SERVICE',
    'STEP 1 OF 1': 'ÉTAPE 1 SUR 1',
    'What did you lock yourself out of?': 'De quoi êtes-vous enfermé dehors ?',
    'House / Apt': 'Maison / App.',
    'Car / Truck': 'Voiture / Camion',
    'Office /': 'Bureau /',
    'Safe': 'Coffre-fort',
    'More': 'Plus',
    '▸ WHAT WE DO HERE': '▸ CE QUE NOUS FAISONS ICI',
    'VETTED TECH': 'TECH. VÉRIFIÉ',
    'Background-': 'Antécédents',
    'checked': 'vérifiés',
    'On': 'En',
    'call': 'service',

    /* ── Services carousel ── */
    'Service catalogue': 'Catalogue de services',
    'What': 'Ce que',
    'we': 'nous',
    'do': 'faisons',
    'SAME DAY': 'JOUR MÊME',
    'BY APPT': 'SUR RDV',
    'HELP': 'AIDE',
    '24/7 Emergency Lockouts': "Ouvertures d'urgence 24/7",
    'Home, office, car. 15-minute average response across Toronto & GTA.':
      'Maison, bureau, voiture. Intervention en 15 minutes en moyenne à Toronto et dans le GTA.',
    'Book it': 'Réservez',
    'Residential Rekey & Install': 'Recléage et installation résidentiels',
    'Rekey existing locks, install deadbolts, smart locks, mortise sets.':
      'Recléage de serrures existantes, installation de pênes dormants, serrures intelligentes, serrures à mortaise.',
    'Commercial & Business': 'Commercial et entreprises',
    'Master key systems, panic bars, high-security restricted keyways.':
      'Systèmes à clé maîtresse, barres anti-panique, profils de clé haute sécurité à accès restreint.',
    'Automotive': 'Automobile',
    'Car/truck lockouts, key programming, key cuts, ignition repair, protected vehicles and semi trailers.':
      "Ouvertures de voiture/camion, programmation de clés, taille de clés, réparation d'allumage, véhicules protégés et semi-remorques.",
    'Smart Locks & Access': 'Serrures intelligentes et accès',
    'Z-Wave, keypad, biometric. Integration with existing security.':
      'Z-Wave, clavier, biométrie. Intégration à la sécurité existante.',
    'Safes — Open, Move, Install': 'Coffres-forts — ouverture, déplacement, installation',
    'Combination recovery, electronic safe opening, in-floor installs.':
      'Récupération de combinaison, ouverture de coffres électroniques, installation au sol.',
    'Security Systems': 'Systèmes de sécurité',
    'Camera installation, access control, and full security system setup for homes and businesses.':
      "Installation de caméras, contrôle d'accès et configuration complète de systèmes de sécurité pour résidences et entreprises.",
    "Not sure which? We'll figure it out.": "Pas sûr ? On s'en occupe.",
    "One phone call. Ninety seconds of triage — we'll tell you the fix and how long it'll take.":
      "Un seul appel. Quatre-vingt-dix secondes de triage — on vous dit la solution et le temps requis.",

    /* ── Process ── */
    'Procedure': 'Procédure',
    'Three': 'Trois',
    'steps': 'étapes',
    'Call dispatch': 'Appelez la répartition',
    '24/7 live operator. Response initiated immediately.':
      'Opérateur en direct 24/7. Intervention lancée immédiatement.',
    'Tech routed': 'Technicien acheminé',
    'Nearest certified technician dispatched to your location.':
      'Le technicien certifié le plus proche est envoyé à votre adresse.',
    'You are': 'Vous êtes',
    'safe': 'en sécurité',
    'On-site assessment, transparent quote, job complete.':
      'Évaluation sur place, devis transparent, travail terminé.',

    /* ── About ── */
    'The shop': "L'atelier",
    'ON THE ROAD': 'SUR LA ROUTE',
    'Our technicians are experienced and supported by a dedicated dispatch operator. Every vehicle and every technician is ready to provide reliable service, backed by the experience and trust earned from thousands of families across Toronto. The technician who arrives at your door has passed a security check, completed training, and is trusted by thousands of Toronto families.':
      "Nos techniciens sont expérimentés et appuyés par un répartiteur dédié. Chaque véhicule et chaque technicien est prêt à offrir un service fiable, fort de l'expérience et de la confiance acquises auprès de milliers de familles à Toronto. Le technicien qui se présente à votre porte a fait l'objet d'une vérification de sécurité, a suivi une formation et jouit de la confiance de milliers de familles torontoises.",
    'SERVING GTA': 'AU SERVICE DU GTA',

    /* ── Why Acme ── */
    'Why us': 'Pourquoi nous',
    'Why': 'Pourquoi',
    'Background Checked': 'Antécédents vérifiés',
    'Every technician is vetted, trained, and trusted in your home.':
      'Chaque technicien est contrôlé, formé et de confiance chez vous.',
    '15 Min Avg ETA': 'ETA moyen de 15 min',
    'Fast response across Toronto & GTA, 24/7.': 'Intervention rapide à Toronto et dans le GTA, 24/7.',
    '24/7 Available': 'Disponible 24/7',
    'Real humans answer the phone. Every call, every night.':
      'De vraies personnes répondent au téléphone. Chaque appel, chaque nuit.',
    'Work Guaranteed': 'Travail garanti',
    'Every job backed by our satisfaction guarantee.':
      'Chaque travail est appuyé par notre garantie de satisfaction.',

    /* ── Reviews ── */
    'From our customers': 'Témoignages de clients',
    'What our': 'Ce que nos',
    'customers': 'clients',
    'say': 'disent',
    '2 weeks ago': 'il y a 2 semaines',
    '1 month ago': 'il y a 1 mois',
    '"Got locked out at 11pm with my dog inside. Tech was at my door in 14 minutes flat and had me back in within 5 more. Clean job, no damage to the lock, fair price. Saved as a contact."':
      "« Enfermée dehors à 23 h avec mon chien à l'intérieur. Le technicien était à ma porte en 14 minutes pile et m'a fait rentrer en 5 de plus. Travail propre, aucun dommage à la serrure, prix juste. Enregistré dans mes contacts. »",
    '"Had Acme rekey the whole house after closing. Marcus walked through every door and recommended swapping two deadbolts that were past their service life. No upsell pressure. Two-year warranty on the work."':
      "« Acme a reclé toute la maison après l'achat. Marcus a vérifié chaque porte et a recommandé de remplacer deux pênes dormants en fin de vie. Aucune pression de vente. Garantie de deux ans sur le travail. »",
    '"Used them for our coffee shop — master key system across four doors plus a safe combination change. Took maybe 90 minutes. Receipt was exactly the quote."':
      '« On les a utilisés pour notre café — système à clé maîtresse sur quatre portes plus un changement de combinaison de coffre. Environ 90 minutes. La facture correspondait exactement au devis. »',

    /* ── Contact ── */
    'Reach us': 'Nous joindre',
    'Pick up': 'Décrochez',
    'the phone': 'le téléphone',
    'DISPATCH · OPEN NOW': 'RÉPARTITION · OUVERT MAINTENANT',
    'Real human · 24 hours · 365 days': 'Vraie personne · 24 heures · 365 jours',
    'HOURS': 'HEURES',
    'Dispatch:': 'Répartition :',
    'Open 365 days a year': 'Ouvert 365 jours par an',
    'PAYMENTS': 'PAIEMENTS',
    'All Payments Accepted': 'Tous paiements acceptés',
    'Apple Pay, Google Pay, tap to pay · Visa, Mastercard, Amex, debit':
      'Apple Pay, Google Pay, paiement sans contact · Visa, Mastercard, Amex, débit',
    'EMAIL': 'COURRIEL',
    'AREA': 'ZONE',
    '24/7 mobile dispatch': 'Répartition mobile 24/7',
    'NON-URGENT REQUEST': 'DEMANDE NON URGENTE',
    'Send a note': 'Envoyez un mot',
    'NAME': 'NOM',
    'Enter your name': 'Entrez votre nom',
    'PHONE': 'TÉLÉPHONE',
    'Enter a valid 10-digit phone': 'Entrez un numéro de téléphone valide à 10 chiffres',
    'POSTAL CODE': 'CODE POSTAL',
    'Use Canadian format: A0A 0A0': 'Format canadien : A0A 0A0',
    "WHAT'S UP?": 'QUOI DE NEUF ?',
    'Rekey after move-in, smart lock install, etc.':
      'Recléage après emménagement, installation de serrure intelligente, etc.',
    'Send →': 'Envoyer →',
    "Note received. We'll be in touch shortly.": 'Mot reçu. Nous vous contacterons sous peu.',
    'Tell us what you need': 'Dites-nous ce dont vous avez besoin',
    "Couldn't send right now — please try again, or just call us.":
      "Échec de l'envoi — réessayez ou appelez-nous.",

    /* ── Leave a Review modal ── */
    'Leave a review →': 'Laissez un avis →',
    'YOUR EXPERIENCE': 'VOTRE EXPÉRIENCE',
    'Leave a review': 'Laissez un avis',
    'RATING': 'NOTE',
    'Pick a rating': 'Choisissez une note',
    'YOUR REVIEW': 'VOTRE AVIS',
    'How did it go?': "Comment ça s'est passé ?",
    'Tell us a bit more (at least 10 characters)': 'Dites-nous en un peu plus (au moins 10 caractères)',
    'Submit review →': "Soumettre l'avis →",
    "Couldn't submit right now — please try again later.": "Échec de l'envoi — veuillez réessayer plus tard.",
    'Thank you!': 'Merci !',
    "Your review has been received and will be published after it's approved by our team.":
      'Votre avis a été reçu et sera publié après approbation par notre équipe.',
    'Done': 'Terminé',

    /* ── Bottom CTA ── */
    "IF YOU'RE LOCKED OUT": 'SI VOUS ÊTES ENFERMÉ DEHORS',
    'Stop reading.': 'Arrêtez de lire.',
    'Start': 'Composez',
    'dialing.': 'le numéro.',
    'CALL DISPATCH': 'APPELEZ LA RÉPARTITION',

    /* ── Footer ── */
    'SERVING:': 'AU SERVICE DE :',
    'Downtown Toronto · North York · Scarborough · Etobicoke · Mississauga · Vaughan · Richmond Hill · Markham · Brampton · + All GTA Locations':
      'Centre-ville de Toronto · North York · Scarborough · Etobicoke · Mississauga · Vaughan · Richmond Hill · Markham · Brampton · + tout le GTA',
    '© 2025 ACME SERVICES. ALL RIGHTS RESERVED.': '© 2025 ACME SERVICES. TOUS DROITS RÉSERVÉS.',
    'PRIVACY · TERMS · WARRANTY': 'CONFIDENTIALITÉ · CONDITIONS · GARANTIE',

    /* ── Note toast ── */
    'You have reached the maximum character limit (250)':
      'Vous avez atteint la limite maximale de caractères (250)',

    /* ── Dynamic: service finder plans (app.js) ── */
    'Office / Commercial': 'Bureau / Commercial',
    'Safes': 'Coffres-forts',
    'Security / Camera': 'Sécurité / Caméra',
    'Break-in Repair': 'Réparation après effraction',
    'Broken Key/Lock': 'Clé/serrure brisée',
    'Smart Lock': 'Serrure intelligente',
    'Garage Door': 'Porte de garage',
    'Rekey': 'Recléage',
    'Lockouts': 'Ouvertures de porte',
    'House, Apartment, Condo, Cars, Safes, Padlock, Mailbox':
      'Maison, appartement, condo, voitures, coffres-forts, cadenas, boîte aux lettres',
    'High Security Locks, Smart Locks, Multipoint Locks, Deadbolts, Cylinders, Handles, Master Key':
      'Serrures haute sécurité, serrures intelligentes, serrures multipoints, pênes dormants, cylindres, poignées, clé maîtresse',
    'Car/Truck Lockout': 'Ouverture voiture/camion',
    'Protected Vehicle': 'Véhicule protégé',
    'Semi Trailer': 'Semi-remorque',
    'Key Programming': 'Programmation de clés',
    'Key Cuts': 'Taille de clés',
    'Ignition': 'Allumage',
    'Store Lockout': 'Ouverture de commerce',
    'Office Lockout': 'Ouverture de bureau',
    'Gates Lockout': 'Ouverture de portail',
    'Access Control': "Contrôle d'accès",
    'High Security Locks, Smart Locks, Access Point, Mortise Locks, Push Bar, Cylinders, Handles, Door Opener, Master Key':
      "Serrures haute sécurité, serrures intelligentes, point d'accès, serrures à mortaise, barre-poussoir, cylindres, poignées, ouvre-porte, clé maîtresse",
    'Combination Locks': 'Serrures à combinaison',
    'Keypad Locks': 'Serrures à clavier',
    'Key Locks': 'Serrures à clé',
    'Security Camera Installation': 'Installation de caméras de sécurité',
    'Security System Setup': 'Configuration de système de sécurité',
    'Camera Maintenance': 'Entretien de caméras',
    'Access Control Systems': "Systèmes de contrôle d'accès",
    'Smart Home System': 'Système domotique',
    '+ Show All Services': '+ Voir tous les services',
    '— Show Less': '— Voir moins',

    /* ── Dynamic: zone / postal checker (app.js) ── */
    'INVALID FORMAT': 'FORMAT INVALIDE',
    'Canadian postal code only — format': 'Code postal canadien uniquement — format',
    '(e.g. M5V 1A1).': '(p. ex. M5V 1A1).',
    'COVERED': 'DESSERVI',
    'OUTSIDE GTA': 'HORS GTA',
    "In our service area — Toronto & the GTA. Call dispatch and we'll roll a tech your way.":
      'Dans notre zone de service — Toronto et le GTA. Appelez la répartition et on vous envoie un technicien.',
    'That code is outside our Toronto & GTA service zone right now.':
      'Ce code est actuellement hors de notre zone de service de Toronto et du GTA.',
    'LOCATING…': 'LOCALISATION…',
    'DETECTED DISTRICT': 'QUARTIER DÉTECTÉ',
    'Greater Toronto Area': 'Grande région de Toronto',
    'Location not available in this browser — please enter your postal code manually.':
      'Localisation non disponible dans ce navigateur — veuillez entrer votre code postal manuellement.',
    'Could not look up postal code — please enter it manually above.':
      "Impossible de trouver le code postal — veuillez l'entrer manuellement ci-dessus.",
    'Location access denied — please enter your postal code manually.':
      'Accès à la localisation refusé — veuillez entrer votre code postal manuellement.',
    'Position unavailable — please enter your postal code manually.':
      'Position non disponible — veuillez entrer votre code postal manuellement.',
    'Location timed out — please enter your postal code manually.':
      'Délai de localisation dépassé — veuillez entrer votre code postal manuellement.',
    'Could not get your location — please enter your postal code manually.':
      'Impossible d\'obtenir votre position — veuillez entrer votre code postal manuellement.',

    /* ── Attributes (aria-label / placeholder / title) ── */
    'Toggle menu': 'Basculer le menu',
    'Previous services': 'Services précédents',
    'Next services': 'Services suivants',
    'Message us': 'Écrivez-nous',
    'Scroll to top': 'Retour en haut',
    'Message us on WhatsApp': 'Écrivez-nous sur WhatsApp',
    'Send us an SMS': 'Envoyez-nous un SMS',
    'Close': 'Fermer',
    '1 star': '1 étoile',
    '2 stars': '2 étoiles',
    '3 stars': '3 étoiles',
    '4 stars': '4 étoiles',
    '5 stars': '5 étoiles',
    'Message options': 'Options de message',
    'More services coming soon': 'Plus de services bientôt',
    'More pricing info': 'Plus d\'infos sur les tarifs',
    'Loading': 'Chargement'
  };

  /* ── Helpers ── */
  var ATTRS = ['placeholder', 'aria-label', 'title'];
  var EXCLUDE_IDS = { heroParticles: 1, zoneMap: 1, loadingOverlay: 1, loadingAnim: 1, testLoadingBtn: 1 };
  var origText = new WeakMap();   // textNode -> original English nodeValue
  var origAttr = new WeakMap();   // element  -> { attr: originalValue }

  function getLang() {
    try { return localStorage.getItem(KEY) === 'fr' ? 'fr' : 'en'; } catch (e) { return 'en'; }
  }

  function isExcluded(el) {
    while (el && el !== document.body) {
      if (el.nodeType === 1) {
        if (el.id && EXCLUDE_IDS[el.id]) return true;
        var tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'svg' || tag === 'TEMPLATE') return true;
        if (el.classList && el.classList.contains('lang-toggle')) return true; // never translate EN/FR labels
      }
      el = el.parentNode;
    }
    return false;
  }

  function translateText(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var core = raw.trim();
    if (!core) return;
    var fr = DICT[core];
    if (fr === undefined) return;
    if (!origText.has(node)) origText.set(node, raw);
    var lead = raw.match(/^\s*/)[0];
    var trail = raw.match(/\s*$/)[0];
    node.nodeValue = lead + fr + trail;
  }
  function restoreText(node) {
    if (origText.has(node)) node.nodeValue = origText.get(node);
  }

  function translateAttrsOf(el) {
    if (el.nodeType !== 1) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var raw = el.getAttribute(a);
      var fr = DICT[raw.trim()];
      if (fr === undefined) continue;
      if (!origAttr.has(el)) origAttr.set(el, {});
      var store = origAttr.get(el);
      if (!(a in store)) store[a] = raw;
      el.setAttribute(a, fr);
    }
  }
  function restoreAttrsOf(el) {
    if (!origAttr.has(el)) return;
    var store = origAttr.get(el);
    for (var i = 0; i < ATTRS.length; i++) {
      if (ATTRS[i] in store) el.setAttribute(ATTRS[i], store[ATTRS[i]]);
    }
  }

  // Walk a root's text nodes (skipping excluded subtrees). cb(textNode).
  function eachText(root, cb) {
    if (root.nodeType === 3) { if (!isExcluded(root.parentNode)) cb(root); return; }
    if (root.nodeType !== 1 || isExcluded(root)) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return isExcluded(n.parentNode) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) cb(n);
  }
  function eachAttrEl(root, cb) {
    if (root.nodeType !== 1 || isExcluded(root)) return;
    cb(root);
    var els = root.querySelectorAll('[placeholder],[aria-label],[title]');
    for (var i = 0; i < els.length; i++) if (!isExcluded(els[i])) cb(els[i]);
  }

  function applyFR(root) {
    eachText(root, translateText);
    eachAttrEl(root, translateAttrsOf);
  }
  function applyEN(root) {
    eachText(root, restoreText);
    eachAttrEl(root, restoreAttrsOf);
  }

  /* ── Scoped observer: re-translate dynamically inserted/changed content ── */
  var observer = new MutationObserver(function (muts) {
    if (getLang() !== 'fr') return;
    observer.disconnect();
    try {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') {
          if (!isExcluded(m.target.parentNode)) translateText(m.target);
        } else if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 3) { if (!isExcluded(n.parentNode)) translateText(n); }
            else if (n.nodeType === 1) applyFR(n);
          }
        }
      }
    } finally {
      connectObserver();
    }
  });
  function connectObserver() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ── Public API + toggle wiring ── */
  var _fadeTimer = null;

  function applyLangNow(lang) {
    observer.disconnect();
    if (lang === 'fr') applyFR(document.body); else applyEN(document.body);
    connectObserver();
  }

  function setLang(lang) {
    lang = lang === 'fr' ? 'fr' : 'en';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    updateToggle(lang);   // slider slides immediately — instant feedback

    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) { applyLangNow(lang); return; }

    // Fix 4: fade out → swap text → fade in (~300ms). Opacity-only, so the
    // text-length change (EN→FR) happens while invisible — no layout jump.
    document.body.classList.add('lang-switching');
    clearTimeout(_fadeTimer);
    _fadeTimer = setTimeout(function () {
      applyLangNow(lang);
      requestAnimationFrame(function () { document.body.classList.remove('lang-switching'); });
    }, 160);
  }

  function updateToggle(lang) {
    var toggles = document.querySelectorAll('.lang-toggle');
    for (var i = 0; i < toggles.length; i++) toggles[i].setAttribute('data-lang', lang);
    var opts = document.querySelectorAll('.lang-opt');
    for (var j = 0; j < opts.length; j++) {
      opts[j].setAttribute('aria-pressed', opts[j].getAttribute('data-lang') === lang ? 'true' : 'false');
    }
  }

  function wireToggle() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.lang-opt') : null;
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute('data-lang'));
    });
  }

  window.ACME_I18N = {
    setLang: setLang,
    getLang: getLang,
    t: function (en) { return getLang() === 'fr' ? (DICT[en] || en) : en; }
  };

  function init() {
    var lang = getLang();
    document.documentElement.lang = lang;
    if (lang === 'fr') applyFR(document.body);
    updateToggle(lang);
    wireToggle();
    connectObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();



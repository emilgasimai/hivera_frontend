/* ============================================================================
   site-footer.js — the ONE shared footer for every city landing page.
   ----------------------------------------------------------------------------
   Drop this on any page:
       <div id="siteFooter" data-city="scarborough"></div>
       <script src="site-footer.js?v=2" defer></script>
   It injects, in the SAME format as the homepage footer:
       • "STOP READING. START DIALING." bottom-CTA banner
       • SERVING: <full GTA area list>
       • SERVICE AREAS: <city landing-page links, current city highlighted>
       • © year · CITY · GTA · PRIVACY · TERMS · WARRANTY  (meta row)
   Editing this file updates the footer on ALL landing pages at once.

   `data-city` = one of: scarborough | mississauga | north-york | etobicoke |
                 brampton | vaughan | richmond-hill.
   ========================================================================== */
(function () {
  'use strict';

  var mount = document.getElementById('siteFooter');
  if (!mount) return;

  var PHONE_DISPLAY = '(555) 010-1234';
  var PHONE_TEL = '+15550101234';
  var YEAR = new Date().getFullYear();

  // slug → { name, region label for the meta row }
  var CITIES = {
    'scarborough':   { name: 'Scarborough',   region: 'SCARBOROUGH · TORONTO · GTA' },
    'mississauga':   { name: 'Mississauga',   region: 'MISSISSAUGA · PEEL · GTA' },
    'north-york':    { name: 'North York',    region: 'NORTH YORK · TORONTO · GTA' },
    'etobicoke':     { name: 'Etobicoke',     region: 'ETOBICOKE · TORONTO · GTA' },
    'brampton':      { name: 'Brampton',      region: 'BRAMPTON · PEEL · GTA' },
    'vaughan':       { name: 'Vaughan',       region: 'VAUGHAN · YORK · GTA' },
    'richmond-hill': { name: 'Richmond Hill', region: 'RICHMOND HILL · YORK · GTA' }
  };
  var ORDER = ['etobicoke', 'scarborough', 'mississauga', 'north-york', 'brampton', 'vaughan', 'richmond-hill'];

  var current = (mount.getAttribute('data-city') || '').toLowerCase();
  var meta = CITIES[current] || { name: 'Toronto', region: 'TORONTO · GTA' };

  function areaLinks() {
    var out = ORDER.map(function (slug) {
      var isCur = slug === current;
      var color = isCur ? '#27E0F5' : '#cdcdcd';
      return '<a href="/locksmith-' + slug + '" style="color:' + color + ';text-decoration:none;">' + CITIES[slug].name + '</a>';
    });
    out.push('<a href="/" style="color:#cdcdcd;text-decoration:none;">All Toronto &amp; GTA</a>');
    return out.join(' · ');
  }

  mount.innerHTML =
  /* ── Bottom CTA banner (matches the homepage) ── */
  '<section class="relative" style="background:#000000;color:#EDEDED;border-top:3px solid #27E0F5;">' +
    '<div class="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-14 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 lg:gap-10">' +
      '<div class="flex-1 min-w-0">' +
        '<span class="hazard" style="color:#27E0F5;border-color:#27E0F5;background:transparent;">IF YOU\'RE LOCKED OUT</span>' +
        '<div class="font-display uppercase mt-3.5" style="font-size:clamp(36px,5.6vw,64px);line-height:.92;letter-spacing:-.025em;">' +
          'Stop reading.<br/><span style="background:#27E0F5;color:#1A1A1A;padding:0 8px;display:inline-block;">Start</span> dialing.' +
        '</div>' +
      '</div>' +
      '<a id="stopCallBtn" href="tel:' + PHONE_TEL + '" class="btn-hivis call-pulse flex flex-col shrink-0" style="padding:18px 26px;background:#27E0F5;color:#1A1A1A;text-decoration:none;">' +
        '<span class="font-mono" style="font-size:10px;letter-spacing:.24em;font-weight:700;">CALL DISPATCH</span>' +
        '<span class="font-display" style="font-size:clamp(26px,3.4vw,40px);line-height:1;letter-spacing:-.02em;white-space:nowrap;">' + PHONE_DISPLAY + '</span>' +
      '</a>' +
    '</div>' +
  '</section>' +

  /* ── Footer — same format as the homepage ── */
  '<footer style="background:#1A1A1A;border-top:3px solid #EDEDED;">' +
    '<div class="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-6">' +

      /* SERVICE AREAS — landing-page links (current city highlighted) */
      '<div class="font-mono footer-legal" style="font-size:11px;letter-spacing:.16em;font-weight:600;text-transform:uppercase;color:#cdcdcd;line-height:1.7;margin-bottom:14px;">' +
        '<span style="color:#27E0F5;font-weight:700;">SERVICE AREAS:</span> ' + areaLinks() +
      '</div>' +

      /* meta row */
      '<div class="flex flex-wrap gap-3 justify-between items-center font-mono t-cap-sm pt-4" style="opacity:.7;font-weight:600;border-top:1px solid #3a3a3e;">' +
        '<span>© ' + YEAR + ' Acme Services. ALL RIGHTS RESERVED.</span>' +
        '<span>' + meta.region + '</span>' +
        '<span class="footer-legal"><a href="/legal#privacy">PRIVACY</a> · <a href="/legal#terms">TERMS</a> · <a href="/legal#warranty">WARRANTY</a></span>' +
      '</div>' +

    '</div>' +
  '</footer>';
})();

// ── Lock icon dropdown ──
const lockBtn = document.getElementById('lockBtn');
const lockSvg = document.getElementById('lockSvg');
const mobileMenu = document.getElementById('mobileMenu');
let isOpen = false;

function positionMobileMenu() {
  const hdr = document.getElementById('header');
  if (!hdr) return;
  mobileMenu.style.top = hdr.getBoundingClientRect().bottom + 'px';
}

function toggleLock(forceState) {
  isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
  if (isOpen) positionMobileMenu();
  lockBtn.classList.toggle('lock-open', isOpen);
  lockSvg.classList.toggle('lock-open', isOpen);
  mobileMenu.classList.toggle('open', isOpen);
  lockBtn.setAttribute('aria-expanded', String(isOpen));
}
lockBtn.addEventListener('click', () => {
  // retrigger the one-shot bloom on every tap, then let it fade out
  lockBtn.classList.remove('lk-bloom');
  void lockBtn.offsetWidth;            // force reflow so the animation restarts
  lockBtn.classList.add('lk-bloom');
  toggleLock();
});
window.addEventListener('scroll', () => { if (isOpen) positionMobileMenu(); }, { passive: true });
document.querySelectorAll('.mobile-link').forEach(a => a.addEventListener('click', () => toggleLock(false)));

// ── ETA drift ──
const etaEl = document.getElementById('eta');
const techsEl = document.getElementById('techs');
const fillEl = document.getElementById('etaFill');
let eta = 14, techs = 4;
function tick() {
  eta = Math.max(11, Math.min(24, eta + (Math.random() < .5 ? -1 : 1)));
  techs = Math.max(2, Math.min(7, techs + (Math.random() < .5 ? -1 : 1)));
  etaEl.textContent = eta;
  techsEl.textContent = techs;
  fillEl.style.width = (((24 - eta) / (24 - 11)) * 100) + '%';
}
setInterval(tick, 5800);
tick();

// ── Service finder ──
const PLANS = {
  home: {
    label: 'House / Apt',
    services: [
      'Break-in Repair',
      'Broken Key/Lock',
      'Smart Lock',
      'Garage Door',
      'Rekey',
      {main: 'Lockouts', sub: 'House, Apartment, Condo, Cars, Safes, Padlock, Mailbox'},
      {main: 'Installation', sub: 'High Security Locks, Smart Locks, Multipoint Locks, Deadbolts, Cylinders, Handles, Master Key'},
    ],
  },
  car: {
    label: 'Car / Truck',
    services: [
      'Car/Truck Lockout',
      'Protected Vehicle',
      'Semi Trailer',
      'Key Programming',
      'Key Cuts',
      'Ignition',
    ],
  },
  office: {
    label: 'Office / Commercial',
    services: [
      'Break-in Repair',
      'Store Lockout',
      'Office Lockout',
      'Gates Lockout',
      'Access Control',
      {main: 'Installation', sub: 'High Security Locks, Smart Locks, Access Point, Mortise Locks, Push Bar, Cylinders, Handles, Door Opener, Master Key'},
    ],
  },
  safe: {
    label: 'Safes',
    services: [
      'Combination Locks',
      'Keypad Locks',
      'Key Locks',
      'Safe Installation',
    ],
  },
  security: {
    label: 'Security / Camera',
    services: [
      'Security Camera Installation',
      'Security System Setup',
      'Camera Maintenance',
      'Access Control Systems',
      'Smart Home System',
    ],
  },
};

// ── Apply admin Service-Finder override (set by content-patch.js before this
//    script runs). Categories are fixed; only each category's services change. ──
(function () {
  const ov = window.__ACME_SERVICES_OVERRIDE__;
  if (ov && typeof ov === 'object') {
    Object.keys(ov).forEach((k) => {
      if (PLANS[k] && Array.isArray(ov[k])) PLANS[k].services = ov[k];
    });
  }
})();

const planLabel = document.getElementById('planLabel');
const serviceList = document.getElementById('serviceList');
const serviceToggle = document.getElementById('serviceToggle');
const VISIBLE_COUNT = 4;
// Fixed collapsed footprint (px) so the box is identical for EVERY category and
// never jumps when switching finder tiles. Overflow lives behind the "Show All"
// toggle — the box does not grow with content. Sized to show 4 items + a teaser.
const COLLAPSED_HEIGHT = 150;
let plansExpanded = false;
let currentKey = 'home';

function applyHeights(animate) {
  // Expanded: grow to the full content height. Collapsed: snap to the fixed
  // footprint regardless of how many services the category has.
  const target = plansExpanded ? serviceList.scrollHeight : COLLAPSED_HEIGHT;
  if (!animate) {
    serviceList.style.transition = 'none';
    serviceList.style.height = target + 'px';
    serviceList.offsetHeight;
    serviceList.style.transition = '';
  } else {
    serviceList.style.height = target + 'px';
  }
}

function renderServices(animate = true) {
  const p = PLANS[currentKey];
  serviceList.innerHTML = p.services.map((s, i) => {
    const main = typeof s === 'object' ? s.main : s;
    const sub  = typeof s === 'object' ? s.sub  : null;
    const extraCls = i >= VISIBLE_COUNT ? ' service-item--extra' : '';
    const teaserCls = i === VISIBLE_COUNT ? ' service-item--teaser' : '';
    return `<li class="flex gap-3 items-baseline font-body service-item${extraCls}${teaserCls}" style="font-size:14px;line-height:1.5;">
      <span class="font-mono" style="color:#27E0F5;font-size:14px;font-weight:700;line-height:1;flex-shrink:0;">✓</span>
      <span>${main}${sub ? `<br><span style="font-size:11px;color:#6f6f74;line-height:1.4;display:block;">${sub}</span>` : ''}</span>
    </li>`;
  }).join('');
  serviceList.classList.toggle('expanded', plansExpanded);
  serviceList.classList.toggle('has-extra', p.services.length > VISIBLE_COUNT);
  if (p.services.length > VISIBLE_COUNT) {
    serviceToggle.style.display = 'inline-block';
    // Label is wrapped so i18n can translate it independently of the count.
    serviceToggle.innerHTML = plansExpanded
      ? '<span class="svc-toggle-label">— Show Less</span>'
      : '<span class="svc-toggle-label">+ Show All Services</span> (' + p.services.length + ')';
  } else {
    serviceToggle.style.display = 'none';
  }
  applyHeights(animate);
}

function renderPlan(key) {
  currentKey = key;
  plansExpanded = false;
  planLabel.textContent = PLANS[key].label;
  renderServices(false);
}

window.addEventListener('resize', () => applyHeights(false));

serviceToggle.addEventListener('click', () => {
  plansExpanded = !plansExpanded;
  serviceList.classList.toggle('expanded', plansExpanded);
  serviceToggle.innerHTML = plansExpanded
    ? '<span class="svc-toggle-label">— Show Less</span>'
    : '<span class="svc-toggle-label">+ Show All Services</span> (' + PLANS[currentKey].services.length + ')';
  applyHeights(true);
});

document.querySelectorAll('[data-finder]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-finder]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPlan(btn.dataset.finder);
  });
});
renderPlan('home');

// ── Live-preview hook for the admin Service-Finder manager. The admin calls
//    frame.contentWindow.__acmeSetServices(pendingServices) to re-render the
//    finder with unsaved changes (does not touch localStorage). ──
window.__acmeSetServices = function (ov) {
  if (!ov || typeof ov !== 'object') return;
  Object.keys(ov).forEach((k) => {
    if (PLANS[k] && Array.isArray(ov[k])) PLANS[k].services = ov[k];
  });
  renderPlan(currentKey);
};

// ── Postal-code formatter (Canadian A0A 0A0) ──
// Position pattern: [Letter][Digit][Letter] [Digit][Letter][Digit]
function formatPostal(raw) {
  const cleaned = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  let out = '';
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const expectLetter = (i === 0 || i === 2 || i === 4);
    if (expectLetter && !/[A-Z]/.test(c)) break;
    if (!expectLetter && !/[0-9]/.test(c)) break;
    if (i === 3) out += ' ';
    out += c;
  }
  return out;
}
const POSTAL_RX = /^[A-Z]\d[A-Z]\s\d[A-Z]\d$/;
const isValidPostal = (v) => POSTAL_RX.test(v);

// ── Phone formatter (NANP (xxx) xxx-xxxx) ──
function formatPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}
const PHONE_RX = /^\(\d{3}\) \d{3}-\d{4}$/;
const isValidPhone = (v) => PHONE_RX.test(v);

function clearError(input) {
  input.classList.remove('invalid');
  const errEl = document.getElementById(input.id + '-error');
  if (errEl) errEl.classList.remove('show');
}
function showError(input) {
  input.classList.add('invalid');
  const errEl = document.getElementById(input.id + '-error');
  if (errEl) errEl.classList.add('show');
}

// Bind formatters to all marked inputs (live format + on-blur validation)
document.querySelectorAll('input[data-format="postal"]').forEach(input => {
  input.addEventListener('input', (e) => {
    e.target.value = formatPostal(e.target.value);
    clearError(e.target);
  });
  input.addEventListener('blur', (e) => {
    if (e.target.value && !isValidPostal(e.target.value)) showError(e.target);
  });
});
document.querySelectorAll('input[data-format="phone"]').forEach(input => {
  input.addEventListener('input', (e) => {
    e.target.value = formatPhone(e.target.value);
    clearError(e.target);
  });
  input.addEventListener('blur', (e) => {
    if (e.target.value && !isValidPhone(e.target.value)) showError(e.target);
  });
});

// ── ZIP / Postal coverage checker ──
const zipForm = document.getElementById('zipForm');
const zipInput = document.getElementById('zipInput');
const zipResult = document.getElementById('zipResult');
// Every Toronto FSA starts with "M" (covers Toronto, North York, Scarborough,
// Etobicoke, East York, York) — all covered. Plus the 905-belt GTA cities below.
const GTA_905 = [
  // Mississauga
  'L4T','L4V','L4W','L4X','L4Y','L4Z','L5A','L5B','L5C','L5E','L5G','L5H','L5J','L5K','L5L','L5M','L5N','L5P','L5R','L5S','L5T','L5V','L5W',
  // Brampton
  'L6P','L6R','L6S','L6T','L6V','L6W','L6X','L6Y','L6Z','L7A',
  // Vaughan / Woodbridge / Maple / Concord / Thornhill
  'L4H','L4J','L4K','L4L','L6A',
  // Markham / Unionville
  'L3P','L3R','L3S','L3T','L6B','L6C','L6E','L6G',
  // Richmond Hill
  'L4B','L4C','L4E','L4S',
  // Aurora / Newmarket / Stouffville / King City
  'L4G','L3X','L3Y','L4A','L7B',
  // Pickering / Ajax / Whitby / Oshawa (Durham)
  'L1V','L1W','L1X','L1Y','L1S','L1T','L1Z','L1M','L1N','L1P','L1R','L1G','L1H','L1J','L1K','L1L',
  // Oakville / Burlington / Milton (Halton)
  'L6H','L6J','L6K','L6L','L6M','L7L','L7M','L7N','L7P','L7R','L7S','L7T','L9E','L9T',
  // Caledon / Halton Hills / Bolton / Bradford
  'L7C','L7E','L7K','L7G','L7J','L3Z',
];
const isCoveredFSA = (fsa) => fsa[0] === 'M' || GTA_905.includes(fsa);

function renderZipPanel({ tone, title, body }) {
  const colors = {
    bad:   { border:'#ff5d3b', tint:'rgba(255,93,59,.10)', iconStroke:'#ff5d3b' },
    good:  { border:'#5cd97a', tint:'rgba(92,217,122,.12)', iconStroke:'#5cd97a' },
    warn:  { border:'#f4c20a', tint:'rgba(244,194,10,.08)', iconStroke:'#f4c20a' },
    out:   { border:'#3a3a3e', tint:'transparent',           iconStroke:'#EDEDED' },
  }[tone];
  const icon = {
    bad:  '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
    good: '<path d="M4 12l5 5 11-12"/>',
    warn: '<path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    out:  '<path d="M5 5l14 14M19 5L5 19"/>',
  }[tone];
  return `<div style="margin-top:12px;padding:14px 16px;border:2px solid ${colors.border};background:${colors.tint};">
    <div class="flex items-center gap-2.5">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${colors.iconStroke}" stroke-width="2.4">${icon}</svg>
      <div class="font-display uppercase" style="font-size:15px;letter-spacing:.02em;">${title}</div>
    </div>
    <div class="font-body" style="font-size:13px;color:#9a9a9a;margin-top:6px;line-height:1.45;">${body}</div>
  </div>`;
}

zipForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = zipInput.value.toUpperCase().trim();
  if (!isValidPostal(v)) {
    zipInput.classList.add('invalid');
    zipResult.innerHTML = renderZipPanel({
      tone: 'bad',
      title: 'INVALID FORMAT',
      body: 'Canadian postal code only — format <strong>A0A 0A0</strong> (e.g. M5V 1A1).'
    });
    return;
  }
  zipInput.classList.remove('invalid');
  const fsa = v.slice(0, 3);
  if (isCoveredFSA(fsa)) {
    zipResult.innerHTML = renderZipPanel({ tone:'good', title:`${v} · <span>COVERED</span>`, body:'In our service area — Toronto & the GTA. Call dispatch and we\'ll roll a tech your way.' });
  } else {
    zipResult.innerHTML = renderZipPanel({ tone:'out', title:`${v} · <span>OUTSIDE GTA</span>`, body:'That code is outside our Toronto & GTA service zone right now.' });
  }
});

// ── Zone Check — "Use my location" + inline map ──
// Uses Leaflet (loaded via CDN in index.html) for the map and Nominatim
// (free, no API key) for reverse-geocoding. Theme: dark tiles + cyan accents.
(function () {
  const useLocBtn   = document.getElementById('useMyLocBtn');
  const mapWrap     = document.getElementById('zoneMapWrap');
  const mapEl       = document.getElementById('zoneMap');
  const districtEl  = document.getElementById('zoneDistrict');
  const statusEl    = document.getElementById('zoneGeoStatus');
  if (!useLocBtn || !mapWrap || !mapEl) return;

  const defaultLabel = useLocBtn.querySelector('.zone-loc-label').textContent;
  let map = null, marker = null;

  function setStatus(msg) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('show', !!msg);
  }
  function setLoading(on) {
    useLocBtn.disabled = !!on;
    useLocBtn.classList.toggle('loading', !!on);
    useLocBtn.querySelector('.zone-loc-label').textContent = on ? 'LOCATING…' : defaultLabel;
  }
  function renderDistrict(name) {
    if (!name) { districtEl.style.display = 'none'; return; }
    districtEl.style.display = 'flex';
    districtEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27E0F5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;">
        <path d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.6"/>
      </svg>
      <div class="flex flex-col gap-0.5">
        <span class="zone-district-tag">DETECTED DISTRICT</span>
        <span class="zone-district-name">${name}</span>
      </div>`;
  }

  function ensureMap(lat, lon) {
    if (typeof L === 'undefined') return false;
    if (!map) {
      map = L.map(mapEl, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false,
        keyboard: false,
      }).setView([lat, lon], 14);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OSM · CARTO',
      }).addTo(map);
    } else {
      map.setView([lat, lon], 14);
    }
    const icon = L.divIcon({
      className: 'zone-pin-wrap',
      html: '<div class="zone-map-pin"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (marker) marker.remove();
    marker = L.marker([lat, lon], { icon }).addTo(map);
    return true;
  }

  async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('reverse geocode failed');
    return res.json();
  }

  useLocBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      setStatus('Location not available in this browser — please enter your postal code manually.');
      return;
    }
    if (typeof L === 'undefined') {
      setLoading(true);
      var s = document.createElement('script');
      s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      s.crossOrigin = '';
      s.onload = function(){ useLocBtn.disabled = false; useLocBtn.click(); };
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(s);
      return;
    }
    setStatus('');
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        mapWrap.classList.add('open');
        mapWrap.setAttribute('aria-hidden', 'false');
        ensureMap(lat, lon);
        // Wait for the expand transition to settle, then tell Leaflet to recalc.
        setTimeout(() => { if (map) map.invalidateSize(); }, 560);

        try {
          const data = await reverseGeocode(lat, lon);
          const addr = data.address || {};
          const postal = (addr.postcode || '').toUpperCase().replace(/\s+/g, '');
          if (postal) {
            zipInput.value = formatPostal(postal);
            clearError(zipInput);
          }
          const district =
            addr.suburb || addr.quarter || addr.city_district ||
            addr.neighbourhood || addr.town || addr.city || addr.county || '';
          renderDistrict(district || 'Greater Toronto Area');
        } catch (_err) {
          setStatus('Could not look up postal code — please enter it manually above.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('Location access denied — please enter your postal code manually.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus('Position unavailable — please enter your postal code manually.');
        } else if (err.code === err.TIMEOUT) {
          setStatus('Location timed out — please enter your postal code manually.');
        } else {
          setStatus('Could not get your location — please enter your postal code manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
})();

// ── Send a Note — photo attach (max 2 · JPEG/PNG/WebP · 5MB each) ──
const ContactPhotos = (function () {
  const MAX = 2;
  const MAX_BYTES = 5 * 1024 * 1024;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const input = document.getElementById('contactPhotos');
  const drop = document.getElementById('photoDrop');
  const previews = document.getElementById('photoPreviews');
  const errEl = document.getElementById('contactPhotos-error');
  if (!input || !drop || !previews) {
    return { files: () => [], clear() {}, uploadAll: async () => ({ urls: [], failed: 0 }) };
  }

  let selected = []; // [{ file, url }]

  const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); } };
  const clearErr = () => { if (errEl) errEl.classList.remove('show'); };
  const syncFull = () => drop.classList.toggle('is-full', selected.length >= MAX);

  function render() {
    previews.innerHTML = '';
    selected.forEach((item, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.file.name;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'photo-thumb-x';
      x.setAttribute('aria-label', 'Remove ' + item.file.name);
      x.innerHTML = '&times;';
      x.addEventListener('click', () => remove(i));
      thumb.appendChild(img);
      thumb.appendChild(x);
      previews.appendChild(thumb);
    });
    syncFull();
  }

  function remove(i) {
    const it = selected[i];
    if (it) URL.revokeObjectURL(it.url);
    selected.splice(i, 1);
    clearErr();
    render();
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    clearErr();
    let hitCount = false, hitSize = false, hitType = false;
    for (const f of incoming) {
      if (selected.length >= MAX) { hitCount = true; break; }
      if (!OK_TYPES.includes(f.type)) { hitType = true; continue; }
      if (f.size > MAX_BYTES) { hitSize = true; continue; }
      selected.push({ file: f, url: URL.createObjectURL(f) });
    }
    // Error precedence matches the spec wording: count → size → type.
    if (hitCount) showErr('Maximum 2 photos allowed');
    else if (hitSize) showErr('File too large — maximum 5MB per photo');
    else if (hitType) showErr('Only JPEG, PNG or WebP images are allowed');
    render();
    input.value = ''; // let the same file be picked again after a removal
  }

  input.addEventListener('change', (e) => addFiles(e.target.files));
  drop.addEventListener('click', (e) => {
    if (selected.length >= MAX) { e.preventDefault(); showErr('Maximum 2 photos allowed'); }
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selected.length < MAX) input.click(); else showErr('Maximum 2 photos allowed'); }
  });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-dragover'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

  async function uploadAll() {
    const urls = [];
    let failed = 0;
    for (const item of selected) {
      const fd = new FormData();
      fd.append('image', item.file);
      const res = await window.apiFetch('/api/upload/contact', { method: 'POST', body: fd, timeout: 30000 });
      if (res.ok && res.data && res.data.url) urls.push(res.data.url);
      else failed++;
    }
    return { urls, failed };
  }

  function clear() {
    selected.forEach((it) => URL.revokeObjectURL(it.url));
    selected = [];
    clearErr();
    render();
  }

  return { files: () => selected.map((s) => s.file), uploadAll, clear };
})();

// ── Contact form ("Send a Note") → POST {API}/api/contact ──
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  let valid = true;
  const name = document.getElementById('contactName');
  const phone = document.getElementById('contactPhone');
  const postal = document.getElementById('contactPostal');
  const note = document.getElementById('contactNote');
  const fail = document.getElementById('contactFail');

  if (!name.value.trim()) { showError(name); valid = false; } else { clearError(name); }
  if (!isValidPhone(phone.value)) { showError(phone); valid = false; } else { clearError(phone); }
  if (!isValidPostal(postal.value)) { showError(postal); valid = false; } else { clearError(postal); }
  if (!note.value.trim()) { showError(note); valid = false; } else { clearError(note); }

  if (!valid) return;

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  if (fail) fail.classList.remove('show');

  // Upload any attached photos first. If an upload fails we still send the
  // note (without the failed photos) and tell the user near the photo field.
  let photoUrls = [];
  let photoUploadFailed = false;
  if (ContactPhotos.files().length) {
    const up = await ContactPhotos.uploadAll();
    photoUrls = up.urls;
    photoUploadFailed = up.failed > 0;
  }

  const res = await window.apiFetch('/api/contact', {
    method: 'POST',
    json: Object.assign({
      name: name.value.trim(),
      phone: phone.value.replace(/\D/g, ''),
      postalCode: postal.value.trim().toUpperCase(),
      message: note.value.trim()
    }, photoUrls.length ? { photoUrls } : {})
  });

  btn.disabled = false;
  if (res.ok) {
    const success = document.getElementById('contactSuccess');
    success.classList.add('show');
    ContactPhotos.clear();
    form.reset();
    const photoErr = document.getElementById('contactPhotos-error');
    if (photoUploadFailed && photoErr) {
      photoErr.textContent = "Photos couldn't be uploaded — your note was sent without them.";
      photoErr.classList.add('show');
    }
    setTimeout(() => {
      success.classList.remove('show');
      if (photoErr) photoErr.classList.remove('show');
    }, 6000);
  } else {
    // Friendly failure — keep the user's input untouched so they can retry.
    if (fail) fail.classList.add('show');
  }
});

// ── Send a Note — char-limit (250, spaces excluded) + live counter + toast ──
(function () {
  const noteEl     = document.getElementById('contactNote');
  const counterEl  = document.getElementById('noteCounter');
  const counterNum = document.getElementById('noteCounterNum');
  const toastEl    = document.getElementById('noteToast');
  if (!noteEl || !counterEl || !counterNum) return;

  const LIMIT = 250;
  const WARN_AT = 180;   // 180–229 → yellow
  const DANGER_AT = 230; // 230–250 → red
  let toastTimer = null;

  const countNonSpace = (s) => s.replace(/\s+/g, '').length;

  // Walk through `s` char-by-char, keep spaces freely, stop accepting
  // non-space chars once we hit `limit`. Returns the truncated value
  // and a flag indicating whether truncation happened.
  function truncateToLimit(s, limit) {
    let count = 0, out = '';
    let truncated = false;
    for (const ch of s) {
      if (/\s/.test(ch)) {
        out += ch;
      } else if (count < limit) {
        out += ch;
        count++;
      } else {
        truncated = true;
      }
    }
    return { out, truncated };
  }

  function updateCounterUI() {
    const n = countNonSpace(noteEl.value);
    counterNum.textContent = n;
    counterEl.classList.remove('warn', 'danger');
    if (n >= DANGER_AT) counterEl.classList.add('danger');
    else if (n >= WARN_AT) counterEl.classList.add('warn');
  }

  function showToast(msg) {
    if (!toastEl) return;
    if (msg) toastEl.querySelector('#noteToastMsg').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  noteEl.addEventListener('input', () => {
    const before = noteEl.value;
    const { out, truncated } = truncateToLimit(before, LIMIT);
    if (truncated) {
      // Preserve caret at end of accepted text
      noteEl.value = out;
      try { noteEl.setSelectionRange(out.length, out.length); } catch (_) {}
      // Brief shake + red flash on the input itself for tactile feedback
      noteEl.classList.remove('note-shake');
      void noteEl.offsetWidth; // force reflow to retrigger animation
      noteEl.classList.add('note-shake');
      setTimeout(() => noteEl.classList.remove('note-shake'), 320);
      showToast('You have reached the maximum character limit (250)');
    }
    updateCounterUI();
  });

  // Initialize counter (zero state)
  updateCounterUI();
})();

// ── Year ──
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Header: scroll-driven size shrink + neon scroll-progress line ──
// Style stays static (full-width, no float/transparency change). On desktop the
// header is a touch larger at the very top and shrinks to its standard size once
// scrolled — the `.scrolled` class drives the CSS sizes (mobile ignores it).
// The cyan line tracks scroll progress 0%→100% along the bottom edge.
const headerEl = document.getElementById('header');
const progressEl = document.getElementById('scrollProgress');
let headerTicking = false;
const onHeaderScroll = () => {
  if (headerEl) headerEl.classList.toggle('scrolled', window.scrollY > 10);
  if (progressEl) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    progressEl.style.width = (Math.max(0, Math.min(1, ratio)) * 100) + '%';
  }
  headerTicking = false;
};
window.addEventListener('scroll', () => {
  if (!headerTicking) { headerTicking = true; requestAnimationFrame(onHeaderScroll); }
}, { passive: true });
window.addEventListener('resize', onHeaderScroll, { passive: true });
onHeaderScroll();

// ── Lazy-load below-the-fold background photos ──
// The carousel + about photos (~0.9MB of webp/jpg) start life as [data-bg] and
// only fetch when they approach the viewport, keeping them off the critical
// initial load. Exposed globally so content-patch can re-arm after re-render.
(function () {
  let io = null;
  const load = (el) => {
    const u = el.getAttribute('data-bg');
    if (u) { el.style.backgroundImage = "url('" + u + "')"; el.removeAttribute('data-bg'); }
    const cls = el.getAttribute('data-bg-class'); // for ::before backgrounds
    if (cls) { el.classList.add(cls); el.removeAttribute('data-bg-class'); }
  };
  window.__acmeObserveLazyBg = function () {
    const els = document.querySelectorAll('[data-bg],[data-bg-class]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(load); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } });
      }, { rootMargin: '200px 0px' });
    }
    els.forEach((el) => io.observe(el));
  };
  window.__acmeObserveLazyBg();
})();

// ── Counter animation ──
(function () {
  const counters = document.querySelectorAll('.counter');
  if (!counters.length) return;

  // Progressive enhancement: the HTML ships the real final values so they show
  // even if this script never runs. Since it IS running, reset to 0 now and let
  // the IntersectionObserver animate each one up when it scrolls into view.
  counters.forEach(el => { el.textContent = '0'; });

  function runCounter(el) {
    if (el.classList.contains('counted')) return;
    el.classList.add('counted');
    const target   = parseFloat(el.dataset.target);
    const isDecimal = target !== Math.floor(target);
    const suffix   = el.dataset.suffix || '';
    const useComma = el.dataset.format === 'comma';
    const duration = 2000;
    const start    = performance.now();

    function fmt(n) {
      if (isDecimal) return n.toFixed(1);
      const floored = Math.floor(n);
      return useComma ? floored.toLocaleString('en-US') : String(floored);
    }

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic so it decelerates as it reaches the target
      const ease = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        el.textContent = fmt(target * ease);
        requestAnimationFrame(tick);
      } else {
        el.textContent = (isDecimal ? target.toFixed(1) : (useComma ? target.toLocaleString('en-US') : String(target))) + suffix;
      }
    }
    requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      runCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  counters.forEach(el => counterObserver.observe(el));
})();

// ── Scroll to top button ──
const scrollBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    scrollBtn.style.opacity = '1';
    scrollBtn.style.pointerEvents = 'auto';
  } else {
    scrollBtn.style.opacity = '0';
    scrollBtn.style.pointerEvents = 'none';
  }
});
scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ── Hero animated particle background ──
// Loads locksmith-themed SVGs from bg_icons/, drops ~28 cyan particles into
// the hero, drifts + rotates each one, and gives a random 30% a soft glow.
// Uses requestAnimationFrame, pauses on hidden tabs, opts out under
// prefers-reduced-motion (handled in CSS).
(function () {
  const container = document.getElementById('heroParticles');
  if (!container) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rndInt  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const rndFlt  = (a, b) => Math.random() * (b - a) + a;
  const rndFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const ICON_FILES = [
    'fluent--door-16-filled.svg',
    'fluent--door-16-regular.svg',
    'game-icons--car-key.svg',
    'hugeicons--drill.svg',
    'icon-park-solid--door-handle.svg',
    'jam--hammer-f.svg',
    'key-7-svgrepo-com.svg',
    'key-symbol-in-horizontal-position-svgrepo-com.svg',
    'material-symbols--lock.svg',
    'mdi--car-door.svg',
    'mingcute--hammer-fill.svg',
    'solar--key-linear.svg',
    'streamline--wrench.svg',
    'tabler--key.svg',
    'uim--lock.svg',
    'zondicons--key.svg',
  ];

  const COUNT       = 95;
  const SIZE_MIN    = 20, SIZE_MAX = 60;
  const OPACITY_MIN = 0.10, OPACITY_MAX = 0.18;
  const DRIFT_MIN   = 6, DRIFT_MAX = 22;        // px/sec
  const ROT_GROUPS  = {                         // ms for one full revolution
    fast:   [8000,  10000],
    medium: [15000, 20000],
    slow:   [25000, 35000],
  };
  const PULSE_FRACTION = 0.30;
  const WRAP_PAD       = 80;                    // off-screen buffer before wrapping

  // Strip hardcoded black colours so the SVG inherits the cyan currentColor
  // set on the container. Leaves explicit non-black colours alone.
  function normalizeSvg(text) {
    return text
      .replace(/fill="#?000(?:000)?"/gi,   'fill="currentColor"')
      .replace(/stroke="#?000(?:000)?"/gi, 'stroke="currentColor"')
      .replace(/fill="black"/gi,           'fill="currentColor"')
      .replace(/stroke="black"/gi,         'stroke="currentColor"')
      .replace(/fill\s*:\s*(?:#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi, 'fill: currentColor')
      .replace(/stroke\s*:\s*(?:#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi, 'stroke: currentColor');
  }

  const isMobile = window.innerWidth < 768;
  const activeCount = isMobile ? Math.ceil(COUNT / 2) : COUNT;

  Promise.all(ICON_FILES.map(name =>
    fetch('bg_icons/' + name)
      .then(r => (r.ok ? r.text() : ''))
      .then(t => (t ? normalizeSvg(t) : ''))
      .catch(() => '')
  )).then(svgs => {
    svgs = svgs.filter(Boolean);
    if (!svgs.length) { console.warn('[hero-particles] no SVGs loaded'); return; }
    init(svgs, container, activeCount);
  });

  function makeParticle(svgs, W, H) {
    const el   = document.createElement('div');
    const spin = document.createElement('div');
    el.className   = 'hero-particle';
    spin.className = 'hero-particle-spin';
    spin.innerHTML = rndFrom(svgs);

    const size = rndInt(SIZE_MIN, SIZE_MAX);
    el.style.width   = size + 'px';
    el.style.height  = size + 'px';
    el.style.opacity = rndFlt(OPACITY_MIN, OPACITY_MAX).toFixed(3);

    // 30% pulse — apply to outer wrapper so drop-shadow cascades to the SVG
    if (Math.random() < PULSE_FRACTION) {
      el.classList.add('pulse');
      el.style.animationDelay = '-' + rndInt(0, 2400) + 'ms';
    }

    // Rotation: random speed group, random direction (reverse half the time)
    const group   = rndFrom(['fast', 'medium', 'slow']);
    const [pMin, pMax] = ROT_GROUPS[group];
    spin.style.animationDuration  = rndInt(pMin, pMax) + 'ms';
    spin.style.animationDirection = Math.random() < 0.5 ? 'normal' : 'reverse';

    // Drift: random angle, random speed within the band
    const speed = rndFlt(DRIFT_MIN, DRIFT_MAX);
    const angle = Math.random() * Math.PI * 2;
    const vx    = Math.cos(angle) * speed;
    const vy    = Math.sin(angle) * speed;

    const x = rndInt(0, W);
    const y = rndInt(0, H);
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    el.appendChild(spin);

    return { el, x, y, vx, vy };
  }

  function init(svgs, el, count) {
    let W = el.clientWidth;
    let H = el.clientHeight;
    if (!W || !H) return;

    const particles = Array.from({ length: count }, () => makeParticle(svgs, W, H));
    const frag = document.createDocumentFragment();
    particles.forEach(p => frag.appendChild(p.el));
    el.appendChild(frag);

    // Track size changes (window resize, hero re-flow, mobile rotate)
    const ro = new ResizeObserver(() => {
      W = el.clientWidth;
      H = el.clientHeight;
    });
    ro.observe(el);

    let last    = performance.now();
    let running = true;
    let rafId   = 0;

    function frame(now) {
      // Cap dt so a long pause doesn't fling everything off-screen at once
      const dt = Math.min(60, now - last);
      last = now;
      const dts = dt / 1000;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dts;
        p.y += p.vy * dts;
        if (p.x < -WRAP_PAD)     p.x = W + WRAP_PAD;
        else if (p.x > W + WRAP_PAD) p.x = -WRAP_PAD;
        if (p.y < -WRAP_PAD)     p.y = H + WRAP_PAD;
        else if (p.y > H + WRAP_PAD) p.y = -WRAP_PAD;
        p.el.style.transform = 'translate3d(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px,0)';
      }
      if (running) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    });
  }
})();

// ── Message FAB (WhatsApp + SMS) toggle ──
(function () {
  const fab = document.getElementById('msgFab');
  if (!fab) return;
  const btn = document.getElementById('msgFabToggle');
  if (!btn) return;
  function close() {
    fab.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !fab.classList.contains('open');
    fab.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (fab.classList.contains('open') && !fab.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fab.classList.contains('open')) close();
  });
  // Close after picking an option (so the menu doesn't linger on return)
  fab.querySelectorAll('.msg-fab-opt').forEach(opt => {
    opt.addEventListener('click', () => close());
  });
})();

// ── Services carousel ──
(function () {
  const track = document.getElementById('svcTrack');
  if (!track) return;
  const dotsWrap = document.getElementById('svcDots');
  const prevBtn = document.querySelector('.svc-arrow[data-svc-dir="prev"]');
  const nextBtn = document.querySelector('.svc-arrow[data-svc-dir="next"]');

  // Read slides LIVE every time. content-patch.js rebuilds #svcTrack's children
  // once the backend content loads; caching the node list here would leave us
  // holding detached elements (offsetLeft 0 → step 0 → dead arrows/dots).
  const getSlides = () => Array.from(track.children);
  const step = () => {
    const s = getSlides();
    return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : (s[0] ? s[0].offsetWidth : 0);
  };

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    getSlides().forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'svc-dot';
      b.setAttribute('aria-label', 'Go to service ' + (i + 1));
      b.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: 'smooth' }));
      dotsWrap.appendChild(b);
    });
  }

  function update() {
    const slides = getSlides();
    const dots = dotsWrap ? Array.from(dotsWrap.children) : [];
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    let idx = atEnd ? slides.length - 1 : Math.round(track.scrollLeft / (step() || 1));
    idx = Math.max(0, Math.min(slides.length - 1, idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = atEnd;
  }
  if (prevBtn) prevBtn.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  if (nextBtn) nextBtn.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  window.addEventListener('resize', update);

  buildDots();
  update();

  // When the cards are swapped in later (content-patch.js sets track.innerHTML),
  // rebuild the dots for the new slide set and re-evaluate arrow state.
  if (window.MutationObserver) {
    new MutationObserver(() => { buildDots(); update(); }).observe(track, { childList: true });
  }

  // mouse drag-to-scroll (touch uses native scrolling)
  let down = false, startX = 0, startScroll = 0, moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; startScroll = track.scrollLeft;
    track.setPointerCapture(e.pointerId);
    track.classList.add('dragging');
  });
  track.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = startScroll - dx;
  });
  const endDrag = () => {
    if (!down) return;
    down = false;
    track.classList.remove('dragging');
    update();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();

/* ════════════════════════════════════════════════════════════════════════
   BACKEND INTEGRATION (public site)
   - Approved reviews:  GET  {API}/api/reviews  → re-render #reviewGrid
   - Leave a Review:    POST {API}/api/reviews  (published after approval)
   All of it degrades gracefully: if the backend is unreachable the static /
   admin-managed content stays exactly as it is today.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window.apiFetch !== 'function') return;          // config.js missing
  const inAdminPreview = (window.self !== window.top);        // admin iframe → leave preview alone

  /* ── Approved reviews from the backend ── */
  function shortDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (!inAdminPreview) {
    window.apiFetch('/api/reviews').then((res) => {
      const items = res.ok && res.data && (res.data.items || res.data.reviews || (Array.isArray(res.data) ? res.data : null));
      if (!items || !items.length) return;                    // fallback: keep current cards
      const toTitleCase = (s) => (s || '').replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      const mapped = items.map((r) => ({
        name: toTitleCase(r.name),
        rating: r.rating || 5,
        text: r.text || '',
        date: r.date || (r.createdAt ? shortDate(r.createdAt) : '')
      }));
      if (window.ACME_PATCH && typeof window.ACME_PATCH.renderReviews === 'function') {
        window.__ACME_REVIEWS_FROM_API__ = true;   // approved reviews win over admin-curated list
        window.ACME_PATCH.renderReviews(mapped);
      }
    });
  }

  /* ── Modal helpers ── */
  function openModal(el) {
    el.hidden = false;
    void el.offsetWidth;                                      // restart transition
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const first = el.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 120);
  }
  function closeModal(el) {
    el.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!el.classList.contains('is-open')) el.hidden = true; }, 220);
  }
  document.querySelectorAll('.site-modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) closeModal(m);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.site-modal.is-open').forEach(closeModal);
  });

  /* ── LEAVE A REVIEW ── */
  const reviewModal = document.getElementById('reviewModal');
  const reviewForm = document.getElementById('reviewForm');
  if (reviewModal && reviewForm) {
    const rName = document.getElementById('revName');
    const rText = document.getElementById('revText');
    const rFail = document.getElementById('reviewFail');
    const rThanks = document.getElementById('reviewThanks');
    const starsWrap = document.getElementById('revStars');
    const starsErr = document.getElementById('revStars-error');
    let rating = 0;

    function paintStars() {
      starsWrap.querySelectorAll('.rev-star').forEach((b) => {
        b.classList.toggle('on', Number(b.dataset.star) <= rating);
      });
    }
    starsWrap.addEventListener('click', (e) => {
      const b = e.target.closest('.rev-star');
      if (!b) return;
      rating = Number(b.dataset.star);
      starsErr.style.display = 'none';
      paintStars();
    });

    const openBtn = document.getElementById('leaveReviewBtn');
    if (openBtn) openBtn.addEventListener('click', () => {
      rFail.classList.remove('show');
      reviewForm.hidden = false;
      rThanks.hidden = true;
      openModal(reviewModal);
    });

    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let valid = true;
      if (!rName.value.trim()) { showError(rName); valid = false; } else { clearError(rName); }
      if (!rating) { starsErr.style.display = 'flex'; valid = false; }
      if (rText.value.trim().length < 10) { showError(rText); valid = false; } else { clearError(rText); }
      if (!valid) return;

      const btn = reviewForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      rFail.classList.remove('show');

      const res = await window.apiFetch('/api/reviews', {
        method: 'POST',
        json: { name: rName.value.trim(), rating: rating, text: rText.value.trim() }
      });

      btn.disabled = false;
      if (res.ok) {
        reviewForm.hidden = true;
        rThanks.hidden = false;                               // "published after approval"
        reviewForm.reset();
        rating = 0;
        paintStars();
      } else {
        rFail.classList.add('show');
      }
    });
  }
})();



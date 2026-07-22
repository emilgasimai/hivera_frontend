/* ============================================================================
   content-patch.js — applies admin-managed overrides to the live public site.
   ----------------------------------------------------------------------------
   The admin panel (/admin) stores overrides in localStorage. This script is the
   PUBLIC-SIDE RENDERER: on load it reads those keys and patches the DOM so edits
   made in /admin appear on the site without a backend.

   It also exposes window.ACME_PATCH — render/apply functions that take data as an
   argument (they do NOT read storage themselves). The admin calls these on the
   preview iframe (frame.contentWindow.ACME_PATCH.*) with its PENDING data for a
   live preview, without committing anything to localStorage.

   localStorage keys (all written by admin-store.js):
     (TODO: rename to acme_admin_*_v1 — keeping apex_ prefix to avoid wiping saved admin data)
     apex_admin_carousel_v1  → array of service cards
     apex_admin_reviews_v1   → array of reviews
     apex_admin_business_v1  → business info object
     apex_admin_services_v1  → service-finder map (consumed by app.js)
     apex_admin_content_v1   → { [path]: {type,value} } click-to-edit overrides

   TODO: replace localStorage with backend API call (fetch published content)
   ============================================================================ */
(function () {
  'use strict';

  var D = window.ACME_DEFAULTS || {};

  function getStore(key, fallback) {
    try { var r = localStorage.getItem(key); return r == null ? fallback : JSON.parse(r); }
    catch (e) { return fallback; }
  }

  /* ── HTML escaping for admin-supplied strings ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // For values placed inside a single-quoted CSS url('...') / attribute.
  function escUrl(s) {
    return String(s == null ? '' : s).replace(/['"\\)]/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ========================================================================
     CAROUSEL  (#svcTrack)
     Rebuilds the service cards from data + re-appends the fixed "HELP" CTA card.
     ===================================================================== */
  function renderCard(card, i) {
    var num = String(i + 1).padStart(2, '0');
    var icon = card.icon || (D.DEFAULT_ICON || '');
    var img = escUrl(card.image || D.PLACEHOLDER_IMG || '');
    return '' +
      '<div class="svc-slide">' +
        '<a class="svc-card has-photo" href="#contact">' +
          '<div class="svc-photo" data-bg="' + img + '"></div>' +
          '<div class="svc-overlay"></div>' +
          '<div class="svc-num">' + esc(num) + '</div>' +
          '<div class="svc-tag">' + esc(card.badge || '') + '</div>' +
          '<div class="svc-body">' +
            icon +
            '<h3 class="font-display uppercase" style="font-size:22px;line-height:1.05;letter-spacing:.01em;margin:14px 0 8px;text-wrap:balance;">' + esc(card.title || '') + '</h3>' +
            '<p class="font-body svc-desc">' + esc(card.desc || '') + '</p>' +
            '<div class="svc-foot"><span class="svc-cta-link">Book it <span class="svc-arrow-ico">&rarr;</span></span></div>' +
          '</div>' +
        '</a>' +
      '</div>';
  }

  // Fixed trailing CTA card (not part of the editable card data). Carries
  // data-biz hooks so applyBusiness() fills its phone number.
  function ctaCardHtml() {
    return '' +
      '<div class="svc-slide">' +
        '<a class="svc-card svc-cta" href="tel:+15550101234" data-biz-tel>' +
          '<div class="svc-num" style="background:#1A1A1A;color:#EDEDED;">HELP</div>' +
          '<div class="svc-body" style="top:0;display:flex;flex-direction:column;justify-content:center;">' +
            '<h3 class="font-display uppercase" style="font-size:clamp(24px,3.4vw,30px);line-height:.98;margin:0;">Not sure which? We&#39;ll figure it out.</h3>' +
            '<p class="font-body" style="font-size:14px;line-height:1.5;margin:12px 0 20px;">One phone call. Ninety seconds of triage — we&#39;ll tell you the fix and how long it&#39;ll take.</p>' +
            '<span class="font-display" style="font-size:24px;letter-spacing:.02em;"><span data-biz-phone data-content-key="phone-number">(555) 010-1234</span> <span class="svc-arrow-ico">&rarr;</span></span>' +
          '</div>' +
        '</a>' +
      '</div>';
  }

  function renderCarousel(cards) {
    var track = document.getElementById('svcTrack');
    if (!track || !cards) return;
    track.innerHTML = cards.map(renderCard).join('') + ctaCardHtml();
    // Re-arm the lazy-bg observer for the freshly rendered cards.
    if (window.__acmeObserveLazyBg) window.__acmeObserveLazyBg();
  }

  /* ========================================================================
     REVIEWS  (#reviewGrid)
     ===================================================================== */
  var STAR = 'M12 3l2.6 6.1 6.4.6-4.8 4.4 1.4 6.4L12 17.3 6.4 20.5 7.8 14 3 9.7l6.4-.6z';
  function starsHtml(rating) {
    var r = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
    var out = '';
    for (var i = 1; i <= 5; i++) {
      var op = i <= r ? '' : ' style="opacity:.22;"';
      out += '<svg width="14" height="14" viewBox="0 0 24 24"' + op + '><path d="' + STAR + '" fill="currentColor"/></svg>';
    }
    return out;
  }
  function toNameCase(s) {
    return (s || '').replace(/\b\w+/g, function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
  }
  function renderReview(r) {
    return '' +
      '<article class="review-card u-card flex flex-col p-5" style="background:#242427;">' +
        '<div class="flex items-center">' +
          '<span class="inline-flex gap-0.5" style="color:#27E0F5;">' + starsHtml(r.rating) + '</span>' +
        '</div>' +
        '<p class="font-body mt-3.5 flex-1" style="font-size:15px;line-height:1.55;text-wrap:pretty;">&ldquo;' + esc(r.text || '') + '&rdquo;</p>' +
        '<div class="font-display mt-3 pt-2.5" style="font-size:16px;letter-spacing:.03em;border-top:1px solid #3a3a3e;text-transform:none;">' + esc(toNameCase(r.name)) + '</div>' +
      '</article>';
  }
  function renderReviews(list) {
    var grid = document.getElementById('reviewGrid');
    if (!grid || !list) return;
    grid.innerHTML = list.map(renderReview).join('');
  }

  /* ========================================================================
     BUSINESS INFO  (data-biz-* hooks across the page)
     ----------------------------------------------------------------------
     Repeated values also carry a data-content-key so a change in one place
     updates EVERY instance at once (global content sync). data-content-key is
     the public-facing convention; data-biz-* drive the derived tel:/sms:/wa
     links. CK_FIELDS maps a content key to its business field.
     ===================================================================== */
  var CK_FIELDS = {
    'phone-number':  'phoneDisplay',
    'email':         'email',
    'address-line1': 'addressLine1',
    'address-line2': 'addressLine2',
    'hours-dispatch':'hoursDispatch',
    'hours-shop':    'hoursShop'
  };

  // Update every element sharing a data-content-key, plus the links derived
  // from the phone number. TODO: on backend, broadcast changes via websocket.
  function syncContentKey(key, value) {
    document.querySelectorAll('[data-content-key="' + key + '"]').forEach(function (el) { el.textContent = value; });
    if (key === 'phone-number') {
      var digits = String(value || '').replace(/\D/g, '');
      var norm = digits ? (digits.length === 10 ? '1' + digits : digits) : '';
      document.querySelectorAll('[data-biz-tel]').forEach(function (el) {
        el.setAttribute('href', 'tel:' + (norm ? '+' + norm : ''));
        var a = el.getAttribute('data-biz-aria-phone');
        if (a != null) el.setAttribute('aria-label', a + (value || ''));
      });
      document.querySelectorAll('[data-biz-sms]').forEach(function (el) { el.setAttribute('href', 'sms:' + (norm ? '+' + norm : '')); });
      document.querySelectorAll('[data-biz-wa]').forEach(function (el) { el.setAttribute('href', 'https://wa.me/' + norm); });
    }
  }

  function applyBusiness(b) {
    if (!b) return;
    var tel = b.phoneTel || '';
    document.querySelectorAll('[data-biz-tel]').forEach(function (el) {
      el.setAttribute('href', 'tel:' + tel);
      var ariaPrefix = el.getAttribute('data-biz-aria-phone');
      if (ariaPrefix != null) el.setAttribute('aria-label', ariaPrefix + (b.phoneDisplay || ''));
    });
    document.querySelectorAll('[data-biz-phone]').forEach(function (el) { el.textContent = b.phoneDisplay || ''; });
    document.querySelectorAll('[data-biz-sms]').forEach(function (el) { el.setAttribute('href', 'sms:' + tel); });
    document.querySelectorAll('[data-biz-wa]').forEach(function (el) { el.setAttribute('href', 'https://wa.me/' + (b.whatsapp || '')); });
    document.querySelectorAll('[data-biz-email]').forEach(function (el) { el.textContent = b.email || ''; });
    document.querySelectorAll('[data-biz-addr1]').forEach(function (el) { el.textContent = b.addressLine1 || ''; });
    document.querySelectorAll('[data-biz-addr2]').forEach(function (el) { el.textContent = b.addressLine2 || ''; });
    document.querySelectorAll('[data-biz-hours-dispatch]').forEach(function (el) { el.textContent = b.hoursDispatch || ''; });
    document.querySelectorAll('[data-biz-hours-shop]').forEach(function (el) { el.textContent = b.hoursShop || ''; });
    // Keep every data-content-key instance in sync from the single source.
    Object.keys(CK_FIELDS).forEach(function (k) {
      var v = b[CK_FIELDS[k]];
      if (v != null) document.querySelectorAll('[data-content-key="' + k + '"]').forEach(function (el) { el.textContent = v; });
    });
  }

  /* ========================================================================
     SERVICE FINDER  (consumed by app.js via a global)
     ===================================================================== */
  function applyServices(s) {
    if (!s) return;
    window.__ACME_SERVICES_OVERRIDE__ = s;
    // If app.js has already initialised, re-render live (admin preview path).
    if (typeof window.__acmeSetServices === 'function') window.__acmeSetServices(s);
  }

  /* ========================================================================
     CLICK-TO-EDIT CONTENT OVERRIDES  (Part 1 — { [path]: {type,value} })
     ===================================================================== */
  // Must stay in sync with EXCLUDE_SEL in admin.js (carousel + reviews are
  // managed via dedicated panels, so they're excluded here too).
  var EXCLUDE_SEL = [
    '.hazard', '.cred-tag', '.svc-tag', '.svc-num', '.cred-pillars', '.cred-dot',
    '.pulse-dot', '.counter', '.more-dots', '.more-label', '.svc-arrow-ico',
    'svg', 'script', 'style', 'noscript',
    '#heroParticles', '#serviceList', '#svcDots', '#svcTrack', '#reviewGrid',
    '#zoneMap', '#zoneMapWrap', '#zipResult', '#zoneGeoStatus', '#zoneDistrict', '#noteToast',
    '#loadingOverlay', '#loadingAnim', '#testLoadingBtn', '#callFab', '#msgFab', '#scrollTop',
    '.caution-stripe', '.trust-frost', '.svc-overlay', '.svc-bg-overlay',
    '.about-overlay', '.about-vignette', '.zone-map-scanline', '.acme-txt-skip'
  ].join(', ');

  function wrapMixedText() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.classList.contains('acme-txt')) return NodeFilter.FILTER_REJECT;
        try { if (p.closest(EXCLUDE_SEL)) return NodeFilter.FILTER_REJECT; } catch (e) { return NodeFilter.FILTER_REJECT; }
        var hasElChild = false;
        for (var i = 0; i < p.childNodes.length; i++) { if (p.childNodes[i].nodeType === 1) { hasElChild = true; break; } }
        return hasElChild ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      var span = document.createElement('span');
      span.className = 'acme-txt';
      tn.parentNode.replaceChild(span, tn);
      span.appendChild(tn);
    });
  }
  function applyOne(path, entry) {
    var el;
    try { el = document.querySelector(path); } catch (e) { return; }
    if (!el) return;
    if (entry.type === 'text') {
      el.textContent = entry.value;
    } else if (entry.type === 'image-src') {
      el.setAttribute('src', entry.value);
      el.removeAttribute('srcset');
      var pic = el.closest('picture');
      if (pic) pic.querySelectorAll('source').forEach(function (s) { s.setAttribute('srcset', entry.value); });
    } else if (entry.type === 'image-bg') {
      el.style.backgroundImage = 'url("' + entry.value + '")';
    }
  }
  function applyContent(map) {
    if (!map) return;
    var paths = Object.keys(map);
    if (!paths.length) return;
    if (paths.some(function (p) { return map[p] && map[p].type === 'text'; })) wrapMixedText();
    paths.forEach(function (p) { applyOne(p, map[p]); });
  }

  /* ========================================================================
     NAV LABELS  (data-nav-key hooks — desktop + mobile nav links)
     map: { home, services, about, reviews, contact } → custom text.
     TODO: on backend, broadcast changes via websocket.
     ===================================================================== */
  function applyNavLabels(map) {
    if (!map) return;
    Object.keys(map).forEach(function (key) {
      if (!map[key]) return;
      document.querySelectorAll('[data-nav-key="' + key + '"]').forEach(function (el) {
        el.textContent = map[key];
      });
    });
  }

  /* ── Expose for admin live-preview ── */
  window.ACME_PATCH = {
    renderCard: renderCard,
    renderCarousel: renderCarousel,
    renderReview: renderReview,
    renderReviews: renderReviews,
    applyBusiness: applyBusiness,
    applyServices: applyServices,
    applyContent: applyContent,
    syncContentKey: syncContentKey,
    applyNavLabels: applyNavLabels
  };

  /* ========================================================================
     AUTO-APPLY saved overrides on public page load.
     Order matters: structural renders first, then business (fills hooks in the
     freshly rendered CTA card), then services (before app.js reads the global),
     then click-to-edit content overrides last (against the final DOM).
     ===================================================================== */
  // TODO: rename apex_admin_*_v1 keys to acme_admin_*_v1 — keeping apex_ prefix to avoid wiping saved admin data
  var KEYS = {
    carousel: 'apex_admin_carousel_v1',
    reviews:  'apex_admin_reviews_v1',
    business: 'apex_admin_business_v1',
    services: 'apex_admin_services_v1',
    content:  'apex_admin_content_v1',
    menu:     'apex_admin_menu_v1'
  };

  function applyBundle(b) {
    b = b || {};
    if (b.carousel && b.carousel.length) renderCarousel(b.carousel);
    // Approved visitor reviews (fetched in app.js from /api/reviews) win over
    // the admin-curated list — don't clobber them once rendered.
    if (b.reviews && b.reviews.length && !window.__ACME_REVIEWS_FROM_API__) renderReviews(b.reviews);
    applyBusiness(b.business || D.business);
    if (b.services) applyServices(b.services);
    applyContent(b.content);
    applyNavLabels(b.menu);
  }

  // 1) Instant: apply the last-known state from the localStorage mirror
  //    (also the offline fallback when the backend is unreachable).
  applyBundle({
    carousel: getStore(KEYS.carousel, null),
    reviews:  getStore(KEYS.reviews, null),
    business: getStore(KEYS.business, null),
    services: getStore(KEYS.services, null),
    content:  getStore(KEYS.content, null),
    menu:     getStore(KEYS.menu, null)
  });

  // 2) Fresh: pull the published content from the backend, mirror it locally,
  //    re-apply. Skipped inside the admin preview iframe (the admin drives the
  //    preview itself) and skipped silently when the backend is unreachable.
  if (window.self === window.top && typeof window.apiFetch === 'function') {
    window.apiFetch('/api/content').then(function (res) {
      if (!res.ok || !res.data) return;                       // backend down → keep local
      var raw = res.data.content || {};
      // The backend stores each section as { value:'<json-string>', type }
      // under its key (carousel, services, ...) — unwrap + parse.
      var bundle = {}, hasAny = false;
      Object.keys(KEYS).forEach(function (k) {
        var entry = raw[k];
        var v = (entry && typeof entry === 'object' && 'value' in entry) ? entry.value : entry;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* keep string */ } }
        bundle[k] = (v == null) ? null : v;
        if (bundle[k] != null) hasAny = true;
      });
      if (!hasAny) return;                                    // nothing published yet
      Object.keys(KEYS).forEach(function (k) {
        try {
          if (bundle[k] != null) localStorage.setItem(KEYS[k], JSON.stringify(bundle[k]));
          else localStorage.removeItem(KEYS[k]);
        } catch (e) { /* storage full/blocked — non-fatal */ }
      });
      applyBundle(bundle);
    });
  }
})();




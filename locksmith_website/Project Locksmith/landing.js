/* ============================================================================
   landing.js — behaviour layer for the city SEO landing pages ONLY.
   ----------------------------------------------------------------------------
   The homepage uses app.js (1200+ lines wired to the finder / carousel / zone
   checker / review modal). Those elements don't exist on a landing page, and
   app.js accesses them unguarded at the top level — so it would throw. This is
   a lean, fully-guarded standalone script that powers just what the landing
   pages need, reusing the SAME markup + CSS classes as the homepage:

     1. Mobile menu (hamburger lock button + drawer)   → same as app.js
     2. Header shrink-on-scroll (.scrolled)            → same as app.js
     3. [data-bg] lazy background images               → same pattern as app.js
     4. "Send a Note" contact form → POST {API}/api/contact (needs config.js)

   Every block early-returns when its elements are absent, so this file is safe
   to include on any page. Language (EN/FR) is handled entirely by i18n.js.
   ========================================================================== */
(function () {
  'use strict';

  /* ── 1. Mobile menu ─────────────────────────────────────────────────────── */
  (function mobileMenu() {
    var lockBtn = document.getElementById('lockBtn');
    var lockSvg = document.getElementById('lockSvg');
    var menu = document.getElementById('mobileMenu');
    var header = document.getElementById('header');
    if (!lockBtn || !menu) return;

    var isOpen = false;

    function position() {
      if (!header) return;
      menu.style.top = header.getBoundingClientRect().bottom + 'px';
    }
    function toggle(force) {
      isOpen = typeof force === 'boolean' ? force : !isOpen;
      if (isOpen) position();
      lockBtn.classList.toggle('lock-open', isOpen);
      if (lockSvg) lockSvg.classList.toggle('lock-open', isOpen);
      menu.classList.toggle('open', isOpen);
      lockBtn.setAttribute('aria-expanded', String(isOpen));
    }

    lockBtn.addEventListener('click', function () {
      lockBtn.classList.remove('lk-bloom');
      void lockBtn.offsetWidth;          // restart the one-shot bloom
      lockBtn.classList.add('lk-bloom');
      toggle();
    });
    window.addEventListener('scroll', function () { if (isOpen) position(); }, { passive: true });
    // Close the drawer after tapping any link inside it.
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
  })();

  /* ── 2. Header shrink on scroll (desktop) ───────────────────────────────── */
  (function headerScroll() {
    var header = document.getElementById('header');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ── 3. [data-bg] lazy background images ────────────────────────────────── */
  (function lazyBg() {
    var nodes = document.querySelectorAll('[data-bg]');
    if (!nodes.length) return;
    var load = function (el) {
      var url = el.getAttribute('data-bg');
      if (!url) return;
      el.style.backgroundImage = 'url("' + url + '")';
      el.removeAttribute('data-bg');
    };
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(load);
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { load(e.target); obs.unobserve(e.target); }
      });
    }, { rootMargin: '300px' });
    nodes.forEach(function (n) { io.observe(n); });
  })();

  /* ── 4. "Send a Note" contact form → POST {API}/api/contact ─────────────── */
  (function contactForm() {
    var form = document.getElementById('contactForm');
    if (!form) return;

    var name = document.getElementById('contactName');
    var phone = document.getElementById('contactPhone');
    var postal = document.getElementById('contactPostal');
    var note = document.getElementById('contactNote');
    var fail = document.getElementById('contactFail');
    var success = document.getElementById('contactSuccess');

    // Validators / formatters — identical rules to the homepage (app.js).
    var POSTAL_RX = /^[A-Z]\d[A-Z]\s\d[A-Z]\d$/;
    var PHONE_RX = /^\(\d{3}\) \d{3}-\d{4}$/;
    var isValidPostal = function (v) { return POSTAL_RX.test(v); };
    var isValidPhone = function (v) { return PHONE_RX.test(v); };

    function formatPostal(raw) {
      var cleaned = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      var out = '';
      for (var i = 0; i < cleaned.length; i++) {
        var c = cleaned[i];
        var expectLetter = (i === 0 || i === 2 || i === 4);
        if (expectLetter && !/[A-Z]/.test(c)) break;
        if (!expectLetter && !/[0-9]/.test(c)) break;
        if (i === 3) out += ' ';
        out += c;
      }
      return out;
    }
    function formatPhone(raw) {
      var d = (raw || '').replace(/\D/g, '').slice(0, 10);
      if (d.length === 0) return '';
      if (d.length <= 3) return '(' + d;
      if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
      return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    }
    function showError(input) {
      if (!input) return;
      input.classList.add('invalid');
      var e = document.getElementById(input.id + '-error');
      if (e) e.classList.add('show');
    }
    function clearError(input) {
      if (!input) return;
      input.classList.remove('invalid');
      var e = document.getElementById(input.id + '-error');
      if (e) e.classList.remove('show');
    }

    if (postal) {
      postal.addEventListener('input', function (e) { e.target.value = formatPostal(e.target.value); clearError(e.target); });
      postal.addEventListener('blur', function (e) { if (e.target.value && !isValidPostal(e.target.value)) showError(e.target); });
    }
    if (phone) {
      phone.addEventListener('input', function (e) { e.target.value = formatPhone(e.target.value); clearError(e.target); });
      phone.addEventListener('blur', function (e) { if (e.target.value && !isValidPhone(e.target.value)) showError(e.target); });
    }
    if (name) name.addEventListener('input', function () { clearError(name); });
    if (note) note.addEventListener('input', function () { clearError(note); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      if (!name.value.trim()) { showError(name); valid = false; } else { clearError(name); }
      if (!isValidPhone(phone.value)) { showError(phone); valid = false; } else { clearError(phone); }
      if (!isValidPostal(postal.value)) { showError(postal); valid = false; } else { clearError(postal); }
      if (!note.value.trim()) { showError(note); valid = false; } else { clearError(note); }
      if (!valid) return;

      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      if (fail) fail.classList.remove('show');

      // Tag the message with the originating city page so the lead inbox knows
      // which landing page converted (data-source lives on the <form>).
      var src = form.getAttribute('data-source');
      var message = note.value.trim();
      if (src) message += '\n\n— Sent from the ' + src + ' page';

      if (typeof window.apiFetch !== 'function') {   // config.js missing → fail soft
        if (btn) btn.disabled = false;
        if (fail) fail.classList.add('show');
        return;
      }

      window.apiFetch('/api/contact', {
        method: 'POST',
        json: {
          name: name.value.trim(),
          phone: phone.value.replace(/\D/g, ''),
          postalCode: postal.value.trim().toUpperCase(),
          message: message
        }
      }).then(function (res) {
        if (btn) btn.disabled = false;
        if (res && res.ok) {
          if (success) success.classList.add('show');
          form.reset();
          setTimeout(function () { if (success) success.classList.remove('show'); }, 6000);
        } else {
          if (fail) fail.classList.add('show');
        }
      });
    });
  })();

  /* ── 5. Services carousel — ported verbatim from the homepage (app.js) so the
     landing pages use the SAME "What we do" carousel behaviour (arrows, dots,
     drag-to-scroll). Guarded by the #svcTrack check. ───────────────────────── */
  (function servicesCarousel() {
    var track = document.getElementById('svcTrack');
    if (!track) return;
    var dotsWrap = document.getElementById('svcDots');
    var prevBtn = document.querySelector('.svc-arrow[data-svc-dir="prev"]');
    var nextBtn = document.querySelector('.svc-arrow[data-svc-dir="next"]');

    var getSlides = function () { return Array.prototype.slice.call(track.children); };
    var step = function () {
      var s = getSlides();
      return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : (s[0] ? s[0].offsetWidth : 0);
    };

    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      getSlides().forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'svc-dot';
        b.setAttribute('aria-label', 'Go to service ' + (i + 1));
        b.addEventListener('click', function () { track.scrollTo({ left: i * step(), behavior: 'smooth' }); });
        dotsWrap.appendChild(b);
      });
    }
    function update() {
      var slides = getSlides();
      var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
      var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      var idx = atEnd ? slides.length - 1 : Math.round(track.scrollLeft / (step() || 1));
      idx = Math.max(0, Math.min(slides.length - 1, idx));
      dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
      if (nextBtn) nextBtn.disabled = atEnd;
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (nextBtn) nextBtn.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    buildDots();
    update();

    // mouse drag-to-scroll (touch uses native scrolling)
    var down = false, startX = 0, startScroll = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startScroll = track.scrollLeft;
      track.setPointerCapture(e.pointerId);
      track.classList.add('dragging');
    });
    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      track.scrollLeft = startScroll - dx;
    });
    var endDrag = function () {
      if (!down) return;
      down = false;
      track.classList.remove('dragging');
      update();
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  })();

  /* ── 6. Scroll-to-top button ────────────────────────────────────────────── */
  (function scrollToTop() {
    var btn = document.getElementById('scrollTop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      } else {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
      }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  /* ── 7. Message FAB (WhatsApp + SMS) — same behaviour as the homepage (app.js):
     tap to open the menu, tap-outside / Esc to close, close after picking an
     option. Guarded by #msgFab. The button + menu styling lives in styles.css
     (.msg-fab*), shared with the homepage. ─────────────────────────────────── */
  (function messageFab() {
    var fab = document.getElementById('msgFab');
    if (!fab) return;
    var btn = document.getElementById('msgFabToggle');
    if (!btn) return;
    function close() {
      fab.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !fab.classList.contains('open');
      fab.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (fab.classList.contains('open') && !fab.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fab.classList.contains('open')) close();
    });
    // Close after picking an option (so the menu doesn't linger on return).
    fab.querySelectorAll('.msg-fab-opt').forEach(function (opt) {
      opt.addEventListener('click', function () { close(); });
    });
  })();

})();

/* ============================================================================
   config.js — single source of truth for the backend API base URL.
   Loaded FIRST (before app.js / content-patch.js / admin-store.js) on both the
   public site and the admin panel. Never hardcode the URL anywhere else.
   ============================================================================ */
(function () {
  'use strict';

  /* ⚠️ DEMO COPY — the real backend URL has been removed on purpose.
     This tree is a rebranded, mocked showcase; it must never be able to reach
     the client's live API. demo-mock.js overrides apiFetch on every page that
     loads it, and this unroutable host is the backstop for anything that
     slips through: such a request fails instead of hitting production.
     Restoring a real URL here re-arms every page in this folder. */
  window.API_BASE_URL = 'https://demo.invalid';

  /* Tiny fetch helper shared by public + admin code.
     apiFetch(path, options) →
       { ok, status, data }   (data = parsed JSON body, or null)
     - path is appended to API_BASE_URL ('/api/...').
     - JSON bodies: pass options.json = {...} (sets header + stringifies).
     - Auth: pass options.token to send Authorization: Bearer <token>.
     - Network errors / timeouts NEVER throw — they resolve { ok:false,
       status:0, data:null } so every caller can degrade gracefully. */
  window.apiFetch = function (path, options) {
    options = options || {};
    var headers = options.headers || {};
    var init = { method: options.method || 'GET', headers: headers };
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.json);
    } else if (options.body !== undefined) {
      init.body = options.body; // e.g. FormData for uploads
    }
    if (options.token) headers['Authorization'] = 'Bearer ' + options.token;

    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    if (ctrl) {
      init.signal = ctrl.signal;
      setTimeout(function () { ctrl.abort(); }, options.timeout || 10000);
    }

    return fetch(window.API_BASE_URL + path, init)
      .then(function (res) {
        return res.json()
          .catch(function () { return null; })
          .then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .catch(function () { return { ok: false, status: 0, data: null }; });
  };
})();

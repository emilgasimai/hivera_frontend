/* ============================================================================
   demo-mock.js — ⚠️ TEMPORARY MOCKED PREVIEW — NOT PRODUCTION CODE ⚠️
   ----------------------------------------------------------------------------
   PURPOSE
     Lets admin.html / dispatch.html / tech.html run as a clickable showcase with
     NO backend, NO database and NO authentication. Everything below is invented
     sample data. Nothing here talks to a network.

   HOW IT WORKS
     config.js exposes window.apiFetch as the single choke point for every
     backend call ("Never hardcode the URL anywhere else"). This file replaces
     that function wholesale, so the app's own code is left completely untouched
     and stays reviewable. window.fetch is also wrapped, but ONLY to catch the
     two CSV-export calls in admin-store.js that bypass apiFetch.

   AUTH IS FAKE
     Any username/password is accepted. The role comes from the page you opened,
     not from a credential check. Do not read this as a security model — there
     isn't one. That is the whole point of the "mocked" label.

   LIFETIME
     ⚠️ THIS FILE MUST BE DELETED when the real isolated demo backend lands in
     the next phase. Remove the <script> tag from the three HTML pages at the
     same time. If you are reading this after that backend exists, this file is
     stale and should be gone.

   State lives in memory only. A page reload resets everything.
   ============================================================================ */
(function () {
  'use strict';

  var TAG = '[DEMO MOCK]';
  console.warn(TAG + ' Mocked preview active — no backend, no database, fake auth.');

  /* ── Which portal are we on? Drives the fake session's role. ─────────────── */
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var ROLE = page.indexOf('tech') === 0 ? 'technician'
           : page.indexOf('dispatch') === 0 ? 'dispatch'
           : 'admin';
  // The public marketing pages load this file too (so their API calls are
  // mocked), but they have no login and their own forms must be left alone.
  var IS_PORTAL = /^(admin|dispatch|tech)\./.test(page);

  var DEMO_CREDENTIALS = {
    admin:      { username: 'demo.admin',    password: 'demo1234', displayName: 'Dana Reyes' },
    dispatch:   { username: 'demo.dispatch', password: 'demo1234', displayName: 'Sam Okafor' },
    technician: { username: 'demo.tech',     password: 'demo1234', displayName: 'Alex Moreau' }
  };

  /* ========================================================================
     FAKE DATASET — invented people, phones and addresses. No real customers.
     Phone numbers use the 555-01xx block reserved for fiction.
     ===================================================================== */
  var NOW = Date.now();
  var hoursAgo = function (h) { return new Date(NOW - h * 3600e3).toISOString(); };

  var technicians = [
    { id: 't1', _id: 't1', firstName: 'Alex',  lastName: 'Moreau',  username: 'demo.tech',
      phone: '(555) 010-2001', active: true, status: 'on-shift',  currentShiftStart: hoursAgo(3) },
    { id: 't2', _id: 't2', firstName: 'Priya', lastName: 'Raman',   username: 'demo.tech2',
      phone: '(555) 010-2002', active: true, status: 'on-job',     currentShiftStart: hoursAgo(6) },
    { id: 't3', _id: 't3', firstName: 'Marco', lastName: 'Silva',   username: 'demo.tech3',
      phone: '(555) 010-2003', active: true, status: 'off-shift',  currentShiftStart: null }
  ];

  var jobs = [
    mkJob('1000041', 'pending-review', 'emergency', 'Jordan Blake',  '(555) 010-3101', 'Emergency Lockout',      'Locked out of the front unit, key snapped in the cylinder.', 0.4,  null,  0),
    mkJob('1000040', 'approved',       'high',      'Ivy Chen',      '(555) 010-3102', 'Car Lockout',            'Keys visible on the driver seat, doors auto-locked.',        1.2,  null,  0),
    mkJob('1000039', 'assigned',       'normal',    'Ruth Delgado',  '(555) 010-3103', 'Lock Rekey',             'Post-move rekey, three exterior doors.',                     2.5,  't1',  0),
    mkJob('1000038', 'in-progress',    'emergency', 'Owen Pratt',    '(555) 010-3104', 'Emergency Lockout',      'Tenant locked out, building side entrance.',                 3.1,  't2',  0),
    mkJob('1000037', 'in-progress',    'normal',    'Nadia Farouk',  '(555) 010-3105', 'Smart Lock Install',     'Keypad deadbolt supplied by customer.',                      4.8,  't1',  0),
    mkJob('1000036', 'completed',      'normal',    'Theo Lindqvist','(555) 010-3106', 'Commercial Rekey',       'Master key system, six offices.',                            26,   't2',  420),
    mkJob('1000035', 'completed',      'high',      'Grace Amadi',   '(555) 010-3107', 'Safe Opening',           'Combination lost, mechanical dial safe.',                    30,   't3',  285),
    mkJob('1000034', 'completed',      'normal',    'Hugo Vance',    '(555) 010-3108', 'Lock Repair',            'Sticking deadbolt, latch alignment.',                        52,   't1',  160),
    mkJob('1000033', 'cancelled',      'low',       'Mira Sandoval', '(555) 010-3109', 'Key Cutting',            'Customer resolved it before arrival.',                       74,   null,  0)
  ];

  function mkJob(jobId, status, priority, customerName, phone, serviceType, description, ageHours, techId, price) {
    var tech = techId ? technicians.filter(function (t) { return t.id === techId; })[0] : null;
    return {
      id: 'j' + jobId, _id: 'j' + jobId, jobId: jobId,
      source: 'manual', status: status, priority: priority,
      customerName: customerName, phone: phone, customerEmail: '',
      address: (100 + (+jobId % 800)) + ' Example Street', postalCode: 'A1A 1A1',
      serviceType: serviceType, description: description,
      originalMessage: description,
      assignedTechnician: tech ? { id: tech.id, firstName: tech.firstName, lastName: tech.lastName } : null,
      technicianId: techId || null,
      finalPrice: price, paymentMethod: price ? 'card' : null,
      photoUrls: [], internalNotes: [],
      aiSummary: description, aiSuggestedPriority: priority, aiCategory: serviceType,
      statusHistory: [{ status: status, changedBy: 'demo', timestamp: hoursAgo(ageHours), note: '' }],
      createdAt: hoursAgo(ageHours), updatedAt: hoursAgo(ageHours)
    };
  }

  var contacts = [
    { id: 'c1', customerName: 'Lena Fischer', name: 'Lena Fischer', phone: '(555) 010-3201',
      message: 'Do you rekey mailbox locks? No rush.', status: 'new', createdAt: hoursAgo(2) },
    { id: 'c2', customerName: 'Desmond Kaur', name: 'Desmond Kaur', phone: '(555) 010-3202',
      message: 'Quote for four office doors, please.', status: 'new', createdAt: hoursAgo(9) },
    { id: 'c3', customerName: 'Bea Ortiz', name: 'Bea Ortiz', phone: '(555) 010-3203',
      message: 'Smart lock recommendation for a rental?', status: 'read', createdAt: hoursAgo(28) }
  ];

  var quotes = [
    { id: 'q1', name: 'Aiden Cole', phone: '(555) 010-3301', serviceType: 'Commercial Rekey',
      message: 'Eight interior doors, one master.', status: 'new', createdAt: hoursAgo(5) },
    { id: 'q2', name: 'Sofia Marchetti', phone: '(555) 010-3302', serviceType: 'Smart Locks',
      message: 'Two keypad locks supplied and fitted.', status: 'new', createdAt: hoursAgo(21) }
  ];

  var reviews = [
    { id: 'r1', name: 'Jordan Blake', rating: 5, comment: 'Fast, tidy, explained the fix clearly.', status: 'approved', createdAt: hoursAgo(30) },
    { id: 'r2', name: 'Ruth Delgado', rating: 5, comment: 'Rekeyed three doors in under an hour.',  status: 'approved', createdAt: hoursAgo(54) },
    { id: 'r3', name: 'Owen Pratt',   rating: 4, comment: 'Good work, arrived a little late.',      status: 'pending',  createdAt: hoursAgo(12) },
    { id: 'r4', name: 'Grace Amadi',  rating: 5, comment: 'Opened the safe without a scratch.',     status: 'approved', createdAt: hoursAgo(76) }
  ];

  var users = [
    { id: 'u1', username: 'demo.admin',    role: 'admin',    displayName: 'Dana Reyes',  active: true, lastLogin: hoursAgo(1) },
    { id: 'u2', username: 'demo.dispatch', role: 'dispatch', displayName: 'Sam Okafor',  active: true, lastLogin: hoursAgo(4) },
    { id: 'u3', username: 'demo.night',    role: 'dispatch', displayName: 'Ola Nwosu',   active: true, lastLogin: hoursAgo(20) }
  ];

  var contentMap = {};   // editable site content — starts empty, fills as edited
  var snapshots = [{ id: 's1', label: 'Demo baseline', isDefault: true, isProtected: true, createdAt: hoursAgo(100) }];

  /* ── helpers ────────────────────────────────────────────────────────────── */
  function ok(data) { return Promise.resolve({ ok: true, status: 200, data: data }); }
  function err(status, message) { return Promise.resolve({ ok: false, status: status, data: { message: message } }); }
  function paged(items) { return { items: items, total: items.length, page: 1, pages: 1 }; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id || list[i]._id === id) return list[i]; return null; }
  function countBy(list, key) {
    var out = {};
    list.forEach(function (x) { out[x[key]] = (out[x[key]] || 0) + 1; });
    return out;
  }
  var revenue = function (list) {
    return list.reduce(function (sum, j) { return sum + (j.finalPrice || 0); }, 0);
  };

  /* ========================================================================
     ROUTER — method + path -> fake response
     ===================================================================== */
  function route(method, path, body) {
    var qs = path.indexOf('?') > -1 ? path.slice(path.indexOf('?') + 1) : '';
    var p = path.split('?')[0];
    var seg = p.replace(/^\/api\//, '').split('/');
    var completed = jobs.filter(function (j) { return j.status === 'completed'; });

    /* ── auth: accepts anything ── */
    if (p === '/api/auth/login') {
      var who = DEMO_CREDENTIALS[ROLE === 'technician' ? 'admin' : ROLE];
      return ok({
        token: 'demo-token', expiresIn: '8h',
        user: { id: 'u1', username: who.username, role: ROLE === 'technician' ? 'admin' : ROLE,
                displayName: who.displayName, active: true }
      });
    }
    if (p === '/api/auth/technician-login') {
      return ok({ token: 'demo-token', expiresIn: '8h', technician: technicians[0] });
    }
    if (p === '/api/auth/verify') {
      var w = DEMO_CREDENTIALS[ROLE];
      return ok({ user: { id: 'u1', username: w.username, role: ROLE, displayName: w.displayName, active: true } });
    }
    if (p === '/api/auth/change-password') return ok({ message: 'Password updated (demo — nothing was stored)' });

    /* ── site content ── */
    if (p === '/api/content' && method === 'GET') return ok({ content: contentMap });
    if (p === '/api/content' && method === 'PUT') {
      (body && body.updates || []).forEach(function (u) {
        contentMap[u.key] = { value: u.value, type: u.type || 'text', updatedAt: new Date().toISOString() };
      });
      return ok({ message: (body && body.updates || []).length + ' item(s) updated', content: contentMap });
    }
    if (p === '/api/content/snapshots' && method === 'GET') return ok({ snapshots: snapshots });
    if (p === '/api/content/snapshots' && method === 'POST') {
      var snap = { id: 's' + (snapshots.length + 1), label: (body && body.label) || 'Auto-saved',
                   isDefault: false, isProtected: false, createdAt: new Date().toISOString() };
      snapshots.push(snap);
      return ok({ snapshot: snap });
    }
    if (p.indexOf('/api/content/snapshots/') === 0) return ok({ message: 'Done (demo)', content: contentMap });

    /* ── dispatch board ── */
    if (p === '/api/dispatch' && method === 'GET') return ok(paged(jobs.filter(function (j) { return j.status !== 'cancelled'; })));
    if (p === '/api/dispatch' && method === 'POST') {
      var made = mkJob(String(1000042), 'pending-review', (body && body.priority) || 'normal',
        (body && body.customerName) || 'New Customer', (body && body.phone) || '(555) 010-3999',
        (body && body.serviceType) || 'Service Call', (body && body.description) || '', 0, null, 0);
      jobs.unshift(made);
      return ok({ job: made });
    }
    if (p === '/api/dispatch/stats') {
      return ok({ byStatus: countBy(jobs, 'status'), total: jobs.length, today: 3, completedToday: 1 });
    }
    if (p === '/api/dispatch/technicians' || p === '/api/technicians') return ok({ technicians: technicians });
    if (p === '/api/dispatch/my-jobs') {
      return ok({ jobs: jobs.filter(function (j) { return j.technicianId === 't1' && j.status !== 'completed'; }) });
    }
    if (p === '/api/dispatch/my-archive') {
      return ok({ jobs: jobs.filter(function (j) { return j.technicianId === 't1' && j.status === 'completed'; }) });
    }
    if (p === '/api/dispatch/deleted') return ok(paged([]));
    if (p === '/api/dispatch/search') return ok(paged(jobs.slice(0, 4)));
    if (p === '/api/dispatch/revenue') {
      return ok({ period: 'month', from: hoursAgo(720), to: new Date().toISOString(),
                  total: revenue(completed), count: completed.length });
    }
    if (p === '/api/dispatch/agreement-template') {
      return ok({ text: 'DEMO SERVICE AGREEMENT\n\nThis is placeholder text shown in the mocked preview. ' +
                        'The real agreement template lives in the backend and is not part of this demo.' });
    }
    if (p.indexOf('/api/dispatch/lookup/') === 0 || p.indexOf('/api/dispatch/customer/') === 0) {
      return ok({ phone: seg[2] || '', summary: { jobs: 2, lastSeen: hoursAgo(26) }, jobs: jobs.slice(5, 7) });
    }
    if (p === '/api/dispatch/manual-call') return ok({ message: 'Call logged (demo)' });
    /* Technician job actions. These carry the action in the path rather than a
       status field, so they need handling before the generic PATCH branch. */
    if (p.indexOf('/api/dispatch/') === 0 && seg.length === 3) {
      var target = byId(jobs, seg[1]);
      var action = seg[2];
      if (target) {
        var stamp = new Date().toISOString();
        if (action === 'complete') {
          target.status = 'completed';
          if (body && body.serviceFee != null) target.finalPrice = body.serviceFee;
          if (body && body.paymentMethod) target.paymentMethod = body.paymentMethod;
          target.completedAt = stamp;
        } else if (action === 'assign-self') {
          target.status = 'assigned';
          target.technicianId = 't1';
          target.assignedTechnician = { id: 't1', firstName: 'Alex', lastName: 'Moreau' };
        } else if (action === 'cancel') {
          target.status = 'cancelled';
        } else if (action === 'sign-agreement') {
          target.agreementSignedAt = stamp;   // retired flow, kept for compatibility
          target.status = 'in-progress';
        } else if (action === 'send-receipt') {
          return ok({ message: 'Receipt sent (demo — no email was sent)', email: '' });
        } else if (action === 'agreement') {
          return ok({ text: 'DEMO AGREEMENT — placeholder text.' });
        }
        target.statusHistory.push({ status: target.status, changedBy: 'demo', timestamp: stamp, note: action });
        target.updatedAt = stamp;
        return ok({ job: target, message: 'Done (demo — in memory only)' });
      }
      return err(404, 'Not found');
    }

    if (p.indexOf('/api/dispatch/') === 0) {
      var job = byId(jobs, seg[1]);
      if (method === 'GET') return job ? ok({ job: job }) : err(404, 'Not found');
      if (job && body) {                      // PATCH — let the board feel alive
        if (body.status) { job.status = body.status; job.statusHistory.push({ status: body.status, changedBy: 'demo', timestamp: new Date().toISOString(), note: '' }); }
        if (body.priority) job.priority = body.priority;
        if (body.technicianId !== undefined) {
          job.technicianId = body.technicianId;
          var t = byId(technicians, body.technicianId);
          job.assignedTechnician = t ? { id: t.id, firstName: t.firstName, lastName: t.lastName } : null;
        }
        if (body.finalPrice !== undefined) job.finalPrice = body.finalPrice;
        job.updatedAt = new Date().toISOString();
      }
      return ok({ job: job, message: 'Updated (demo — not saved)' });
    }

    /* ── dashboard widgets ── */
    if (p === '/api/dashboard/summary') {
      return ok({
        today: { newJobs: 3, completedJobs: 1, revenue: 420 },
        week:  { jobs: 9, revenue: revenue(completed) },
        month: { jobs: 24, revenue: revenue(completed) * 3 },
        pendingReviewJobs: jobs.filter(function (j) { return j.status === 'pending-review'; }).length,
        inProgressJobs: jobs.filter(function (j) { return j.status === 'in-progress'; }).length,
        newContacts: contacts.filter(function (c) { return c.status === 'new'; }).length,
        pendingReviews: reviews.filter(function (r) { return r.status === 'pending'; }).length,
        recentActivity: jobs.slice(0, 5).map(function (j) {
          return { jobId: j.jobId, customer: j.customerName, status: j.status, time: j.createdAt };
        })
      });
    }
    if (p === '/api/dashboard/status-breakdown') return ok(countBy(jobs, 'status'));
    if (p === '/api/dashboard/source-breakdown') return ok({ manual: 5, quote: 2, contact: 1, note: 1, call: 0 });
    if (p === '/api/dashboard/technician-workload') {
      return ok({ technicians: technicians.map(function (t) {
        return { id: t.id, name: t.firstName + ' ' + t.lastName,
                 jobs: jobs.filter(function (j) { return j.technicianId === t.id; }).length };
      }) });
    }
    if (p === '/api/dashboard/timeseries') {
      return ok({ metric: 'jobs', period: 'week', from: hoursAgo(168), to: new Date().toISOString(),
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [3, 5, 2, 6, 4, 7, 3] });
    }
    if (p === '/api/dashboard/unread-contacts') {
      var unread = contacts.filter(function (c) { return c.status === 'new'; });
      return ok({ total: unread.length, contacts: unread });
    }
    if (p === '/api/dashboard/jobs-detail') return ok({ type: 'all', from: null, to: null, total: jobs.length, jobs: jobs });

    /* ── technicians ── */
    if (p === '/api/technicians/me/current-shift') {
      return ok({ shift: { startTime: hoursAgo(3), elapsedSeconds: 3 * 3600 }, status: 'on-shift' });
    }
    if (p === '/api/technicians/me/status') return ok({ status: 'on-shift' });
    if (p.indexOf('/api/technicians/') === 0 && p.indexOf('/jobs') > -1) {
      return ok({ jobs: jobs.filter(function (j) { return j.technicianId === seg[1]; }) });
    }
    if (p.indexOf('/api/technicians/') === 0) {
      var tech = byId(technicians, seg[1]);
      return tech ? ok({ technician: tech }) : ok({ technicians: technicians });
    }

    /* ── inbox-style collections ── */
    if (p.indexOf('/api/contact') === 0)  return method === 'GET' ? ok(paged(contacts)) : ok({ message: 'Updated (demo)' });
    if (p.indexOf('/api/quotes') === 0)   return method === 'GET' ? ok(paged(quotes))   : ok({ message: 'Updated (demo)' });
    if (p.indexOf('/api/reviews') === 0)  return method === 'GET' ? ok(paged(reviews))  : ok({ message: 'Updated (demo)' });
    if (p.indexOf('/api/users') === 0)    return method === 'GET' ? ok({ users: users }) : ok({ message: 'Updated (demo)' });

    /* ── uploads are disabled outright ── */
    if (p.indexOf('/api/upload') === 0) return err(503, 'Image upload is disabled in the mocked preview.');

    if (p === '/api/health') return ok({ status: 'ok', db: 'mocked' });

    console.warn(TAG + ' unmapped endpoint: ' + method + ' ' + p + ' — returning empty payload');
    return ok({ items: [], total: 0, page: 1, pages: 1 });
  }

  /* ========================================================================
     INTERCEPTORS
     ===================================================================== */
  var LATENCY = 140; // small delay so loading spinners actually render

  window.API_BASE_URL = 'https://demo.invalid';   // any real call would fail loudly

  window.apiFetch = function (path, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var body = options.json;
    return new Promise(function (resolve) {
      setTimeout(function () { route(method, path, body).then(resolve); }, LATENCY);
    });
  };

  // admin-store.js calls fetch() directly for the two CSV exports. Hand back a
  // tiny fake CSV so the download path works instead of throwing.
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/') > -1) {
      var csv = 'jobId,customer,status,price\n' +
        jobs.map(function (j) { return [j.jobId, j.customerName, j.status, j.finalPrice].join(','); }).join('\n') + '\n';
      return Promise.resolve(new Response(new Blob([csv], { type: 'text/csv' }), { status: 200 }));
    }
    return nativeFetch ? nativeFetch(input, init) : Promise.reject(new Error('fetch unavailable'));
  };

  /* ========================================================================
     IFRAME BOUNDARY CONTAINMENT  (admin portal only)
     ------------------------------------------------------------------------
     admin.html embeds <iframe id="siteFrame" src="/"> as the Content Editor's
     live preview. In the real deployment "/" is the client's own marketing
     site. Here the origin root is the HIVERA MARKETING PAGE, so that
     root-relative URL loads Hivera instead — and because both are served from
     the same origin, nothing stops admin.js from reaching into it via
     frame.contentDocument (see onFrameLoad -> injectEditorStyles /
     wrapMixedText / attachFrameHandlers). It injects an editor stylesheet and
     rewrites text nodes in a page that isn't its own. It also recurses:
     Hivera embeds admin, admin loads Hivera, and so on.

     Two containment steps below:
       1. Blank siteFrame immediately, before it can load anything.
       2. Hide the Content Editor nav item so the flow is unreachable.
     The underlying editor code is left completely intact — only the door is
     shut. The real fix is serving the demo from its own origin (next phase).
     ===================================================================== */
  function containIframes() {
    var site = document.getElementById('siteFrame');
    if (site) {
      site.removeAttribute('src');
      site.src = 'about:blank';
      site.dataset.demoContained = 'true';
    }

    // admin.js sets dispatchFrame.src = '/dispatch.html?embed=1' — also
    // root-relative, so it 404s here. Rewrite it to the sibling file instead.
    var disp = document.getElementById('dispatchFrame');
    if (disp && !disp.dataset.demoObserved) {
      disp.dataset.demoObserved = 'true';
      new MutationObserver(function () {
        var v = disp.getAttribute('src');
        if (v && v.charAt(0) === '/') disp.setAttribute('src', v.replace(/^\/+/, ''));
      }).observe(disp, { attributes: true, attributeFilter: ['src'] });
    }
  }

  function hideContentEditor() {
    var btn = document.querySelector('#navList .nav-item[data-view="content"]');
    if (!btn || btn.dataset.demoHidden) return;
    btn.dataset.demoHidden = 'true';
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.setAttribute('tabindex', '-1');
    btn.title = 'Disabled in the mocked preview';
    btn.style.cssText += ';opacity:.42;cursor:not-allowed;pointer-events:none;';
    // Neutralise it even if something clicks it programmatically.
    btn.addEventListener('click', function (e) { e.stopImmediatePropagation(); e.preventDefault(); }, true);
    if (!btn.querySelector('.demo-soon')) {
      var tag = document.createElement('span');
      tag.className = 'demo-soon';
      tag.textContent = 'Coming soon';
      tag.style.cssText = 'margin-left:8px;padding:2px 6px;border:1px solid currentColor;border-radius:5px;' +
        'font-size:9px;letter-spacing:.06em;text-transform:uppercase;opacity:.8;vertical-align:middle;';
      btn.appendChild(tag);
    }
  }

  containIframes();

  /* ========================================================================
     LOGIN SCREEN — pre-fill the demo credentials and say so on screen
     ===================================================================== */
  var creds = DEMO_CREDENTIALS[ROLE];

  function prefill() {
    if (!IS_PORTAL) return false;
    var user = document.querySelector('#loginUser, #techUser, input[name="username"], input[type="text"][id*="ser"]');
    var pass = document.querySelector('#loginPass, #techPass, input[name="password"], input[type="password"]');
    if (user && !user.value) { user.value = creds.username; user.dispatchEvent(new Event('input', { bubbles: true })); }
    if (pass && !pass.value) { pass.value = creds.password; pass.dispatchEvent(new Event('input', { bubbles: true })); }
    return !!(user && pass);
  }

  function banner() {
    if (!IS_PORTAL) return;                       // never touch the public site's own forms
    if (document.getElementById('demoMockBanner')) return;
    var form = document.getElementById('loginForm') || document.querySelector('.login-card, form.login-form');
    if (!form) return;
    var note = document.createElement('div');
    note.id = 'demoMockBanner';
    note.setAttribute('role', 'note');
    note.style.cssText = 'margin:14px 0;padding:12px 14px;border:1px solid rgba(255,255,255,.22);' +
      'border-radius:10px;background:rgba(255,255,255,.06);font:500 13px/1.55 system-ui,sans-serif;' +
      'color:inherit;opacity:.92';
    note.innerHTML = '<strong>Demo preview</strong> — sample data only, no live system behind it.<br>' +
      'Credentials are filled in for you: <code>' + creds.username + '</code> / <code>' + creds.password + '</code>. ' +
      'Any value works.';
    form.insertBefore(note, form.firstChild);
  }

  function init() { containIframes(); hideContentEditor(); prefill(); banner(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // The dashboard (and its nav) is revealed after login, so keep re-applying
  // for a while rather than assuming everything exists at boot.
  var tries = 0;
  var retry = setInterval(function () {
    containIframes(); hideContentEditor(); banner();
    if (++tries > 30) clearInterval(retry);
  }, 400);
})();

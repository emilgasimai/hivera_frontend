/* ============================================================================
   dispatch.js — Acme Dispatch console
   Standalone from the admin panel. Talks to the same backend via config.js
   (window.apiFetch / window.API_BASE_URL). JWT lives in sessionStorage only,
   so closing the tab signs out. 30-minute inactivity auto-logout. Any 401
   clears the session and returns to the dispatch login.

   Backend contract (project_locksmith_backend):
     POST  /api/auth/login            → { token, user:{username,role,displayName} }
     GET   /api/dispatch/stats        → { byStatus:{[status]:n}, total, today, completedToday }
     GET   /api/dispatch?status=&priority=&limit=  → { items:[job], total, page, pages }
     PATCH /api/dispatch/:id/assign   → { assignedTo }            (staff)
     PATCH /api/dispatch/:id/unassign → clears tech assignment    (staff)
     PATCH /api/dispatch/:id/status   → { status }   (400 if unchanged) (staff)
     DELETE /api/dispatch/:id         → admin only — NOT exposed here.
   ============================================================================ */
(function () {
  'use strict';

  /* ───────────── Config / constants ───────────── */
  var SESSION_KEY = 'acme_dispatch_session_v1';
  var IDLE_MS     = 4 * 60 * 60 * 1000;  // 4-hour inactivity auto-logout
  var REFRESH_MS  = 25 * 1000;       // job-queue auto-refresh
  var JOB_LIMIT   = 100;
  var THEME_KEY   = 'acme_dispatch_theme';   // localStorage — persists across sessions
  var MUTE_KEY    = 'acme_dispatch_muted';   // localStorage — notification-sound preference

  var PRIORITY_RANK  = { emergency: 0, high: 1, normal: 2, low: 3 };
  var PRIORITY_LABEL = { emergency: 'Emergency', high: 'High', normal: 'Normal', low: 'Low' };
  var STATUS_LABEL   = {
    'pending-review': 'Pending Review', 'approved': 'Approved', 'assigned': 'Assigned',
    'in-progress': 'In Progress', 'completed': 'Completed', 'cancelled': 'Cancelled'
  };
  var STATUS_ORDER = ['pending-review', 'approved', 'assigned', 'in-progress', 'completed', 'cancelled'];
  var TERMINAL = { completed: 1, cancelled: 1 }; // sorted to the bottom of the live queue
  var PAYMENT_LABEL = { cash: 'Cash', card: 'Card', 'e-transfer': 'E-Transfer' };

  // Top-level views. Each tab owns a set of statuses; the queue is grouped by
  // these client-side (the working set is fetched once, unfiltered, into the
  // store below — so a status change can move a card between tabs instantly).
  var TAB_STATUSES = {
    active:    ['pending-review', 'approved', 'assigned', 'in-progress'],
    completed: ['completed'],
    cancelled: ['cancelled']
  };
  var TABS = ['active', 'completed', 'cancelled', 'calls', 'notes', 'archive']; // calls/notes source-based; archive is admin-only soft-deleted
  // statusHistory entries are status transitions; map each to a past-tense verb
  // for the per-card history panel ("Assigned by dispatch1 · 2h ago").
  var STATUS_VERB = {
    'pending-review': 'Opened', 'approved': 'Approved', 'assigned': 'Assigned',
    'in-progress': 'Started', 'completed': 'Completed', 'cancelled': 'Cancelled'
  };

  /* ───────────── client-side store (single source of truth) ─────────────
     state.jobs is the full working set from the last fetch. The visible queue
     is derived from it (tab → status/priority filters → sort), so mutations can
     update the store and re-render without a round-trip — cards move tabs and
     count badges update live. searchResults overrides the store while a search
     is active. */
  var state = {
    jobs: [],            // working set (all statuses), newest-first from server
    archiveJobs: [],     // soft-deleted jobs (admin only, loaded on demand)
    archiveTotal: 0,
    searchResults: [],   // results while searchActive
    tab: 'active',       // active | completed | cancelled | calls | notes | archive
    unassignedOnly: false, // legacy; superseded by activeFilter on active tab
    activeFilter: 'all', // all|assigned|unassigned|pending|in-progress (active tab)
    datePreset: 'today', // today|week|month|custom — the unified date filter (ALL tabs)
    dateFrom: '',        // custom-range start (only used when datePreset === 'custom')
    dateTo: '',          // custom-range end   (only used when datePreset === 'custom')
    total: 0,            // total jobs in working set from last fetch (for pagination indicator)
    expanded: {},        // { [jobId]: true } open history panels (survive re-render)
    origExpanded: {},    // { [noteId]: true } open "View original" panels (survive re-render)
    notesExpanded: {},   // { [jobId]: true } open internal notes panels
    pending: 0           // in-flight optimistic mutations (auto-refresh pauses while > 0)
  };

  /* ───────────── DOM refs ───────────── */
  var $ = function (id) { return document.getElementById(id); };
  var loginView = $('loginView'), dashView = $('dashView');
  var loginForm = $('loginForm'), loginUser = $('loginUser'), loginPass = $('loginPass');
  var loginBtn = $('loginBtn'), loginError = $('loginError'), loginNotice = $('loginNotice');
  var topUser = $('topUser'), logoutBtn = $('logoutBtn'), themeToggle = $('themeToggle');
  var statToday = $('statToday'), statPending = $('statPending'), statProgress = $('statProgress'), statCompleted = $('statCompleted');
  var filterStatus = $('filterStatus'), filterPriority = $('filterPriority'), statusFilterGroup = $('statusFilterGroup'), priorityFilterGroup = $('priorityFilterGroup');
  var tabBar = $('tabBar'), unassignedToggle = $('unassignedToggle'), newCallBtn = $('newCallBtn');
  var countActive = $('countActive'), countCompleted = $('countCompleted'), countCancelled = $('countCancelled');
  var countCalls = $('countCalls'), countNotes = $('countNotes');
  var callModal = $('callModal'), callForm = $('callForm'), callClose = $('callClose'), callError = $('callError'), callSubmit = $('callSubmit');
  var imgModal = $('imgModal'), imgModalImg = $('imgModalImg');
  var queue = $('queue'), lastUpdatedEl = $('lastUpdated'), refreshBtn = $('refreshBtn'), toastEl = $('toast');
  var searchForm = $('searchForm'), searchInput = $('searchInput'), searchClear = $('searchClear'), searchMeta = $('searchMeta');
  var muteToggle = $('muteToggle');
  var custModal = $('custModal'), custBody = $('custBody'), custClose = $('custClose'), custTitle = $('custTitle');
  var agrModal = $('agrModal'), agrBody = $('agrBody'), agrClose = $('agrClose'), agrTitle = $('agrTitle');

  var filters = { status: '', priority: '' };
  var lastActivity = Date.now();
  var lastFetchTs = 0;
  var toastTimer = null;
  var technicians = [];   // active technicians for the assign dropdown (Fix 3)
  var searchActive = false;     // when true, auto-refresh won't clobber search results
  var knownJobIds = null;       // Set of job ids seen so far (null until first load) — new-job sound
  var muted = false;            // notification-sound mute preference
  var audioCtx = null;          // lazily created on first user gesture

  /* ───────────── tiny helpers ───────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function telHref(phone) {
    var t = (String(phone || '').match(/[+\d]/g) || []).join('');
    return t ? 'tel:' + t : '';
  }
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (!t) return '';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return s + ' sec ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' h ago';
    var d = Math.floor(h / 24);
    if (d < 7) return d + ' d ago';
    return new Date(t).toLocaleDateString();
  }
  function agoShort(t) {
    if (!t) return '';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 8) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    return m + 'm ago';
  }

  /* ───────────── inline-edit helpers (Fix 2) ─────────────
     Dispatch (and admin) can fix bad/missing job info right on the card. Each
     editable field is wrapped in a .editable container that carries its raw
     value + metadata; a pencil swaps the static view for an inline editor that
     PATCHes /api/dispatch/:id. jobId is editable by admins only. */
  var EDIT_MAX = { customerName: 100, phone: 30, address: 300, eta: 100, serviceType: 100, description: 2000, aiSummary: 1000, jobId: 7 };
  // Fields whose card display is too complex to patch in place (e.g. the phone
  // button) — after a successful edit we rebuild the queue instead of applyValue.
  var REBUILD_FIELDS = { phone: 1 };

  // EMBED means we're inside the admin panel (admin role); standalone uses the
  // dispatch session's stored role.
  function isAdminUser() {
    if (EMBED) return true;
    var s = getSession();
    return !!(s && s.role === 'admin');
  }

  function pencilSvg() {
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  }

  // Shared inline icons (used by both job cards and the now-actionable note cards).
  var ICON_PIN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  var ICON_CLOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var ICON_PERSON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var ICON_PHONE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2 2a12 12 0 005 5l2-2 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/></svg>';
  var ICON_HIST = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  // Badge icons (11×11, currentColor — work in both dark and light themes).
  // Paths sourced from admin_icons/ folder.
  var BI_EMERGENCY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 10V13"/><path d="M12 16V15.99"/><path d="M10.25 5.15L3.65 17.03C2.91 18.36 3.87 20 5.4 20H18.6c1.53 0 2.49-1.64 1.75-2.97L13.75 5.15c-.76-1.37-2.74-1.37-3.5 0Z"/></svg>';
  var BI_HIGH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M12 5l-6 6M12 5l6 6"/></svg>';
  var BI_CLOCK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v5l-1.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';
  var BI_USERCHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 19.3L15.8 21 20 17M4 21c0-3.87 3.13-7 7-7 1.49 0 2.87.46 4 1.25M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>';
  var BI_WRENCH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
  var BI_CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.6L8.92 17.5 20 6.5"/></svg>';
  var BI_X = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.95 6.46L11.41 10l3.54 3.54-1.41 1.41L10 11.42l-3.53 3.53-1.42-1.42L8.58 10 5.05 6.47l1.42-1.42L10 8.58l3.54-3.53z"/></svg>';
  var BI_PHONE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2 2a12 12 0 005 5l2-2 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/></svg>';
  var BI_MESSAGE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v3m0 3h.01M21 12c0 4.97-4.03 9-9 9 0 0-6.96 0-6.96 0 0 0 1.56-3.74.94-5C3.34 14.8 3 13.44 3 12a9 9 0 0 1 18 0Z"/></svg>';
  var BI_PENCIL = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var BI_TRASH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
  var BI_RESTORE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4v6h6M3.51 15a9 9 0 1 0 .49-4.95"/></svg>';
  var BI_NOTE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  // Gear (parts & materials) + money (customer deposit) — for the parts/deposit chips.
  var BI_GEAR = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var BI_MONEY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.6 9.2A2.3 2.3 0 0 0 12.4 8h-.9a1.9 1.9 0 0 0 0 3.8h1.1a1.9 1.9 0 0 1 0 3.8h-1a2.3 2.3 0 0 1-2.2-1.2"/></svg>';

  // Tooltip helper — turns a description into the attributes a badge needs for the
  // hover/tap speech-bubble (see .badge[data-tip] in dispatch.css). Empty → nothing.
  function tip(text) { return text ? ' data-tip="' + esc(text) + '" tabindex="0"' : ''; }

  // Source → icon map
  var SOURCE_ICON = { call: BI_PHONE, note: BI_MESSAGE, manual: BI_PENCIL };
  var SOURCE_LABEL = { call: 'CALL', note: 'NOTE', manual: 'MANUAL' };
  // Status → badge icon map
  var STATUS_BADGE_ICON = {
    'pending-review': BI_CLOCK,
    'approved': BI_CHECK,
    'assigned': BI_USERCHECK,
    'in-progress': BI_WRENCH,
    'completed': BI_CHECK,
    'cancelled': BI_X
  };
  // Priority → badge icon map
  var PRIO_BADGE_ICON = {
    emergency: BI_EMERGENCY,
    high: BI_HIGH,
    normal: '',
    low: ''
  };

  // Builds an inline editable: optional `lead` markup, the value span, and a
  // pencil (unless opts.canEdit === false). opts: { label, type, placeholder,
  // valClass, lead, canEdit }.
  function editable(field, value, opts) {
    opts = opts || {};
    var raw = value == null ? '' : String(value);
    var isEmpty = raw.trim() === '';
    var ph = opts.placeholder || '—';
    var valCls = 'ed-val' + (opts.valClass ? ' ' + opts.valClass : '') + (isEmpty ? ' is-empty' : '');
    return '<span class="editable" data-edit="' + field + '" data-type="' + (opts.type || 'text') +
      '" data-label="' + esc(opts.label || field) + '" data-value="' + esc(raw) +
      '" data-placeholder="' + esc(ph) + '">' +
        (opts.lead || '') +
        '<span class="' + valCls + '" data-val>' + esc(isEmpty ? ph : raw) + '</span>' +
        (opts.canEdit === false ? '' :
          '<button type="button" class="ed-pencil" aria-label="Edit ' + esc(opts.label || field) + '">' + pencilSvg() + '</button>') +
      '</span>';
  }

  // Swap the static view for an editor.
  function startEdit(pencil) {
    var box = pencil.closest('.editable');
    if (!box || box.querySelector('.ed-editor')) return;
    var field = box.getAttribute('data-edit');
    var type = box.getAttribute('data-type') || 'text';
    var raw = box.getAttribute('data-value') || '';
    var label = box.getAttribute('data-label') || '';
    var max = EDIT_MAX[field] || 200;
    box._editBackup = box.innerHTML;
    var control = (type === 'textarea')
      ? '<textarea class="ed-input" rows="3" maxlength="' + max + '" aria-label="' + esc(label) + '">' + esc(raw) + '</textarea>'
      : '<input class="ed-input" type="text" maxlength="' + max + '"' +
          (field === 'jobId' ? ' inputmode="numeric" pattern="\\d{7}"' : '') +
          ' value="' + esc(raw) + '" aria-label="' + esc(label) + '"/>';
    box.innerHTML =
      '<span class="ed-editor">' + control +
        '<span class="ed-actions">' +
          '<button type="button" class="btn btn-primary ed-save">Save</button>' +
          '<button type="button" class="btn btn-ghost ed-cancel">Cancel</button>' +
        '</span>' +
      '</span>';
    var input = box.querySelector('.ed-input');
    if (input) { input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} }
  }

  function restoreView(box) {
    if (box._editBackup != null) { box.innerHTML = box._editBackup; box._editBackup = null; }
  }

  // Restore the static view, then patch in the new value (text + empty styling).
  function applyValue(box, raw) {
    restoreView(box);
    raw = raw == null ? '' : String(raw);
    box.setAttribute('data-value', raw);
    var val = box.querySelector('[data-val]');
    if (val) {
      var empty = raw.trim() === '';
      val.textContent = empty ? (box.getAttribute('data-placeholder') || '—') : raw;
      val.classList.toggle('is-empty', empty);
    }
  }

  function commitEdit(box) {
    if (!box) return;
    var card = box.closest('[data-id]'); if (!card) return;   // .job-card OR .note-card
    var id = card.getAttribute('data-id');
    var field = box.getAttribute('data-edit');
    var label = box.getAttribute('data-label') || 'Field';
    var input = box.querySelector('.ed-input'); if (!input) return;
    var val = (input.value || '').trim();
    if (field === 'jobId' && val && !/^\d{7}$/.test(val)) { toast('Job ID must be 7 digits.', 'err'); input.focus(); return; }
    if (field === 'customerName' && !val) { toast('Customer name can’t be empty.', 'err'); input.focus(); return; }
    if (field === 'serviceType' && !val) { toast('Service type can’t be empty.', 'err'); input.focus(); return; }
    if (field === 'phone' && val && !/^[0-9+()\-.\s]{7,30}$/.test(val)) { toast('Enter a valid phone number.', 'err'); input.focus(); return; }
    var saveBtn = box.querySelector('.ed-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }
    var body = {}; body[field] = val;
    authedFetch('/api/dispatch/' + id, { method: 'PATCH', json: body }).then(function (res) {
      if (res.ok) {
        var saved = (res.data && res.data[field] != null) ? res.data[field] : val;
        var jb = findJob(id); if (jb) jb[field] = saved; // keep the store in sync for re-renders
        if (REBUILD_FIELDS[field]) { render(false); } // phone button is rebuilt, not patched in place
        else { applyValue(box, saved); }
        toast(label + ' updated', 'ok');
      } else if (res.status !== 401) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
        toast((res.data && res.data.message) || 'Could not save — try again.', 'err');
      }
    });
  }

  /* ───────────── session ───────────── */
  function getSession() {
    try { var raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function setSession(s) {
    try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); }
    catch (e) { /* storage blocked — non-fatal */ }
  }
  function clearSession() { setSession(null); }

  /* ───────────── embedded mode (inside the admin panel) ─────────────
     When opened as /dispatch.html?embed=1 from the admin panel we run inside a
     same-origin iframe. There's no separate dispatch login: we reuse the admin
     JWT (apex_admin_session_v1), since the admin role has staff API access. The
     topbar + login are hidden via CSS, and the admin panel owns idle-logout. */
  var EMBED = /[?&]embed=1(?:&|$)/.test(location.search);
  var ADMIN_SESSION_KEY = 'apex_admin_session_v1';
  function getAdminSession() {
    // Admin session now lives in localStorage (survives app close).
    // localStorage is shared across all same-origin contexts, so no parent-frame fallback needed.
    try { var raw = localStorage.getItem(ADMIN_SESSION_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function activeToken() {
    if (EMBED) { var a = getAdminSession(); return a && a.token; }
    var s = getSession(); return s && s.token;
  }
  function hasActiveSession() { return !!activeToken(); }

  /* ───────────── authed backend call (401 → back to login) ───────────── */
  function authedFetch(path, options) {
    options = options || {};
    var token = activeToken();
    if (token) options.token = token;
    return window.apiFetch(path, options).then(function (res) {
      if (res.status === 401) { handleUnauthorized(); }
      return res;
    });
  }
  function handleUnauthorized() {
    if (EMBED) {
      // Don't show the dispatch login inside the admin panel — the admin owns auth.
      if (queue) queue.innerHTML = '<div class="queue-empty">Your admin session expired — reload the admin panel to sign in again.</div>';
      return;
    }
    clearSession();
    showLogin('Your session ended — please sign in again.');
  }

  /* ───────────── view switching ───────────── */
  function showLogin(noticeMsg) {
    dashView.hidden = true;
    loginView.hidden = false;
    if (noticeMsg) { loginNotice.textContent = noticeMsg; loginNotice.hidden = false; }
    else { loginNotice.hidden = true; }
    loginError.hidden = true;
    if (loginPass) loginPass.value = '';
    setTimeout(function () { try { (loginUser.value ? loginPass : loginUser).focus(); } catch (e) {} }, 30);
  }
  function showDashboard() {
    loginView.hidden = true;
    dashView.hidden = false;
    var s = getSession();
    topUser.textContent = (s && s.username) ? s.username : '—';
    // The "Unassigned" filter is useful to everyone; syncFilters() hides it on
    // the tabs where it doesn't apply (Calls / Notes).
    if (unassignedToggle) unassignedToggle.hidden = false;
    // Archive (soft-deleted jobs) is admin-only — reveal the tab for admins.
    var archiveTab = tabBar && tabBar.querySelector('[data-tab="archive"]');
    if (archiveTab) archiveTab.hidden = !isAdminUser();
    if (typeof reflectAudioLock === 'function') reflectAudioLock();
    lastActivity = Date.now();
    // Load technicians first so the very first render of the queue already has
    // the assign dropdown populated. Animate the first paint.
    loadTechnicians().then(function () { loadStats(); return loadJobs(true); })
      .then(function () { if (EMBED) notifyEmbedReady(); });   // tell the admin panel deep-links can be served now
  }

  /* ───────────── embedded deep-link bridge (admin panel) ─────────────
     The admin dashboard's card drill-downs can open a specific job here. We
     announce readiness to the parent only AFTER the first queue load, so a
     deep-linked search isn't clobbered by the initial render. */
  var embedReadyNotified = false;
  function notifyEmbedReady() {
    if (embedReadyNotified) return;
    embedReadyNotified = true;
    try { window.parent.postMessage({ type: 'acme-dispatch-ready' }, window.location.origin); } catch (e) {}
  }
  function onEmbedMessage(e) {
    if (e.origin !== window.location.origin) return;
    var d = e.data || {};
    if (d.type === 'acme-open-job' && d.jobId) {
      if (searchInput) searchInput.value = String(d.jobId);
      runSearch();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e2) {}
    }
  }

  /* ───────────── technicians (assign dropdown) ───────────── */
  function loadTechnicians() {
    return authedFetch('/api/dispatch/technicians').then(function (res) {
      if (res.ok && res.data) {
        technicians = (res.data.technicians || []).filter(function (t) { return t && (t._id || t.id); });
      }
    }).catch(function () { /* keep whatever we had; cards fall back to free-text */ });
  }

  /* ───────────── login / logout ───────────── */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = loginUser.value.trim();
    var password = loginPass.value;
    if (!username || !password) { return; }
    loginError.hidden = true; loginNotice.hidden = true;
    loginBtn.disabled = true; var label = loginBtn.textContent; loginBtn.textContent = 'Signing in…';

    window.apiFetch('/api/auth/login', { method: 'POST', json: { username: username, password: password } })
      .then(function (res) {
        loginBtn.disabled = false; loginBtn.textContent = label;
        var token = res.data && res.data.token;
        if (res.ok && token) {
          var u = (res.data && res.data.user) || {};
          var now = Date.now();
          setSession({
            token: token,
            username: u.displayName || u.username || username,
            role: u.role || '',
            createdAt: now,
            lastActivity: now
          });
          showDashboard();
        } else {
          loginError.textContent = (res.status === 0)
            ? 'Network error — check your connection and try again.'
            : 'Invalid username or password.';
          loginError.hidden = false;
        }
      });
  });

  function logout(reason) {
    clearSession();
    var msg = reason === 'idle' ? 'Signed out after 30 minutes of inactivity.' : null;
    showLogin(msg);
  }
  logoutBtn.addEventListener('click', function () { logout('manual'); });

  /* ───────────── light / dark theme (localStorage) ───────────── */
  function applyTheme(t) {
    var theme = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      var moonIco = themeToggle.querySelector('.theme-ico-moon');
      var sunIco = themeToggle.querySelector('.theme-ico-sun');
      if (moonIco) moonIco.style.display = theme === 'light' ? 'none' : '';
      if (sunIco) sunIco.style.display = theme === 'light' ? '' : 'none';
      themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      themeToggle.setAttribute('title', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
  }
  function initTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(t === 'light' ? 'light' : 'dark');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var next = cur === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });
  }

  /* ───────────── inactivity auto-logout (30 min) ───────────── */
  function bumpActivity() {
    lastActivity = Date.now();
    var s = getSession();
    if (s && Date.now() - (s.lastActivity || 0) > 15000) { // throttle writes
      s.lastActivity = Date.now(); setSession(s);
    }
  }
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function (ev) {
    window.addEventListener(ev, bumpActivity, { passive: true });
  });
  setInterval(function () {
    if (EMBED) return;            // admin panel owns idle-logout when embedded
    if (!getSession()) return;
    if (Date.now() - lastActivity > IDLE_MS) { logout('idle'); }
  }, 30000);

  /* ───────────── stats ───────────── */
  function loadStats() {
    return authedFetch('/api/dispatch/stats').then(function (res) {
      if (!res.ok) return;
      var d = res.data || {}; var bs = d.byStatus || {};
      statToday.textContent = d.today != null ? d.today : 0;
      statPending.textContent = bs['pending-review'] != null ? bs['pending-review'] : 0;
      statProgress.textContent = bs['in-progress'] != null ? bs['in-progress'] : 0;
      // Prefer completedToday; fall back to all-time completed on older backends.
      statCompleted.textContent = d.completedToday != null
        ? d.completedToday
        : (bs['completed'] != null ? bs['completed'] : 0);
    });
  }

  /* ───────────── job queue ───────────── */
  function sortJobs(items) {
    return items.slice().sort(function (a, b) {
      var at = TERMINAL[a.status] ? 1 : 0, bt = TERMINAL[b.status] ? 1 : 0;
      if (at !== bt) return at - bt;                                  // active jobs first
      var ar = PRIORITY_RANK[a.priority] != null ? PRIORITY_RANK[a.priority] : 9;
      var br = PRIORITY_RANK[b.priority] != null ? PRIORITY_RANK[b.priority] : 9;
      if (ar !== br) return ar - br;                                  // emergency → high → normal → low
      return new Date(b.createdAt) - new Date(a.createdAt);           // newest first within a tier
    });
  }

  function statusOptions(current) {
    return STATUS_ORDER.map(function (s) {
      return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>';
    }).join('');
  }

  // Phone — direct tel: link for one-tap dialing + a small history icon button.
  // Wrapped in .editable so dispatch can correct a wrong number (Fix 8).
  // Value is rebuilt on save (REBUILD_FIELDS).
  function phoneEditableHtml(phoneStr) {
    phoneStr = phoneStr || '';
    var tel = telHref(phoneStr);
    var inner = phoneStr
      ? (tel
          ? '<a class="job-phone-link" href="' + esc(tel) + '" aria-label="Call ' + esc(phoneStr) + '">' + ICON_PHONE + esc(phoneStr) + '</a>'
          : '<span class="job-phone-link">' + ICON_PHONE + esc(phoneStr) + '</span>') +
        '<button type="button" class="job-phone-hist" data-phone="' + esc(phoneStr) + '" title="Customer history" aria-label="View customer history">' + ICON_HIST + '</button>'
      : '<span class="job-phone-link is-empty" data-val>Add phone</span>';
    return '<span class="editable phone-editable" data-edit="phone" data-type="text" data-label="Phone"' +
      ' data-value="' + esc(phoneStr) + '" data-placeholder="Add phone">' +
        inner +
        '<button type="button" class="ed-pencil" aria-label="Edit phone">' + pencilSvg() + '</button>' +
      '</span>';
  }

  // Prominent assignment chip. showUnassigned draws the "needs a tech" tag for
  // active jobs; otherwise an unassigned terminal job just shows nothing.
  var TECH_STATUS_ICON = { active: '🟢', away: '🟡', busy: '🟠', meeting: '🟣', offline: '⚫' };
  var TECH_STATUS_COLOR = { active: '#22c55e', away: '#eab308', busy: '#f97316', meeting: '#a855f7', offline: '#6b7280' };
  var TECH_STATUS_LABEL = { active: 'Active', away: 'Away', busy: 'Busy', meeting: 'In a meeting', offline: 'Offline' };

  /* ── Unified date filter (all tabs) ─────────────────────────────────────────
     Each tab measures a job by a different timestamp: active/calls/notes by when
     it was created, completed by when it was completed, cancelled by when it was
     cancelled, archive by when it was deleted. The completed/cancelled times come
     from the statusHistory entry (not updatedAt), so an old job finished today is
     dated today. */
  function histTime(job, status) {
    var h = job.statusHistory || [];
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].status === status && h[i].timestamp) return h[i].timestamp; }
    return null;
  }
  function jobDateForTab(job, tab) {
    if (tab === 'completed') return histTime(job, 'completed') || job.updatedAt || job.createdAt;
    if (tab === 'cancelled') return histTime(job, 'cancelled') || job.updatedAt || job.createdAt;
    if (tab === 'archive')   return job.deletedAt || job.updatedAt || job.createdAt;
    return job.createdAt; // active, calls, notes
  }
  // Current preset → { from, to } in epoch-ms, or null when unbounded ('all').
  function dateWindow() {
    var preset = state.datePreset;
    var now = Date.now();
    if (preset === 'custom') {
      return {
        from: state.dateFrom ? new Date(state.dateFrom).getTime() : 0,
        to:   state.dateTo ? new Date(state.dateTo).getTime() + 86400000 : Infinity
      };
    }
    if (preset === 'today') { var d = new Date(); d.setHours(0, 0, 0, 0); return { from: d.getTime(), to: Infinity }; }
    if (preset === 'week')  return { from: now - 7 * 86400000, to: Infinity };
    if (preset === 'month') return { from: now - 30 * 86400000, to: Infinity };
    return null; // 'all'
  }
  function passesDate(job, tab) {
    var w = dateWindow();
    if (!w) return true;
    var t = new Date(jobDateForTab(job, tab) || 0).getTime();
    return t >= w.from && t <= w.to;
  }

  // Cancellation reason for a cancelled job — the note on its last 'cancelled'
  // statusHistory entry (staff/tech record a reason on cancel).
  function cancelReason(job) {
    var h = job.statusHistory || [];
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].status === 'cancelled' && h[i].note) return h[i].note; }
    return '';
  }
  // Current work status of the tech assigned to a job (for the tech-name tooltip).
  function techStatusFor(job) {
    if (!job.technicianId) return '';
    var jtid = String(job.technicianId);
    for (var i = 0; i < technicians.length; i++) {
      if (String(technicians[i]._id || technicians[i].id) === jtid) return technicians[i].status || '';
    }
    return '';
  }

  function assignTagHtml(job, showUnassigned) {
    if (job.assignedTo) {
      var dot = '';
      if (job.technicianId) {
        var jtid = String(job.technicianId);
        var tech = null;
        for (var ti = 0; ti < technicians.length; ti++) { if (String(technicians[ti]._id || technicians[ti].id) === jtid) { tech = technicians[ti]; break; } }
        if (tech && tech.status) {
          var col = TECH_STATUS_COLOR[tech.status] || '#6b7280';
          dot = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + col + ';margin-right:4px;vertical-align:middle;flex-shrink:0"></span>';
        }
      }
      var tst = techStatusFor(job);
      var techTip = tst ? (TECH_STATUS_LABEL[tst] || tst) : '';
      return '<span class="badge assigned-tag" data-assign-tag' + tip(techTip) + '>' + ICON_PERSON + dot + esc(job.assignedTo) + '</span>';
    }
    return showUnassigned ? '<span class="badge unassigned-tag" data-assign-tag' + tip('No technician assigned yet') + '>Unassigned</span>' : '<span data-assign-tag hidden></span>';
  }

  // Assign control — a technician dropdown when any exist, else the legacy
  // free-text input + hint. Selects the current tech by id, falling back to a
  // name match so free-text / legacy assignments still show as selected (Fix 7).
  function assignControlHtml(job) {
    if (technicians.length) {
      var jobTechId = job.technicianId ? String(job.technicianId) : '';
      var assignedName = (job.assignedTo || '').trim().toLowerCase();
      var opts = '<option value="">Select technician…</option>';
      technicians.forEach(function (t) {
        var tid = String(t._id || t.id);
        var nm = ((t.firstName || '') + ' ' + (t.lastName || '')).trim();
        var on = jobTechId ? (tid === jobTechId) : (!!assignedName && nm.toLowerCase() === assignedName);
        var label = nm + (t.openJobCount > 0 ? ' (' + t.openJobCount + ' open)' : '');
        opts += '<option value="' + esc(tid) + '"' + (on ? ' selected' : '') + '>' + esc(label) + '</option>';
      });
      return { control: '<select class="tech-select" aria-label="Assign technician">' + opts + '</select>', note: '' };
    }
    return {
      control: '<input class="tech-input" type="text" maxlength="100" placeholder="Technician name" value="' + esc(job.assignedTo || '') + '" aria-label="Technician name"/>',
      note: '<p class="tech-empty-note">No technicians added yet — add them in the admin panel.</p>'
    };
  }

  // Assign / status / price controls shared by job cards AND note cards.
  // Clear button only shows when there's a price to clear.
  // Unassign button only shows when a job is currently assigned.
  // Payment status tag — shown beside the priority/status badges. Green when the
  // payment has cleared, orange while a card/e-transfer is still pending.
  function paymentTagHtml(job) {
    var method = PAYMENT_LABEL[job.paymentMethod] || '';
    if (job.paymentStatus === 'paid')
      return '<span class="badge pay-tag pay-paid"' + tip('Paid' + (method ? ' · ' + method : '')) + '>' + BI_CHECK + 'Paid</span>';
    if (job.paymentStatus === 'pending')
      return '<span class="badge pay-tag pay-pending"' + tip('Awaiting' + (method ? ' · ' + method : '')) + '>' + BI_CLOCK + 'Pending Payment</span>';
    return '';
  }

  // Parts-cost + deposit chips — shown alongside the priority/status badges when
  // a technician has recorded either. Gear = parts & materials; money = deposit.
  function partsDepositTagsHtml(job) {
    var out = '';
    if (job.partsCost != null && Number(job.partsCost) > 0)
      out += '<span class="badge parts-tag"' + tip('Parts & Materials: ' + fmtMoney(job.partsCost)) + '>' + BI_GEAR + fmtMoney(job.partsCost) + '</span>';
    if (job.depositAmount != null && Number(job.depositAmount) > 0)
      out += '<span class="badge deposit-tag"' + tip('Deposit received: ' + fmtMoney(job.depositAmount)) + '>' + BI_MONEY + fmtMoney(job.depositAmount) + '</span>';
    return out;
  }

  // Cancellation-fee tag — only on cancelled jobs that carry a fee. Red until the
  // fee is collected, green once marked paid.
  function cancellationFeeTagHtml(job) {
    if (job.status !== 'cancelled' || job.cancellationFee == null) return '';
    var amt = fmtMoney(job.cancellationFee);
    return job.cancellationFeePaid
      ? '<span class="badge fee-tag fee-paid">Fee ' + amt + ' · Paid</span>'
      : '<span class="badge fee-tag fee-unpaid">Fee ' + amt + ' · Unpaid</span>';
  }

  // Payment method + Mark Paid control — for jobs with a recorded payment
  // (completed). Item 6: the method (Cash/Card/E-Transfer) shows near the price.
  function paymentInfoHtml(job) {
    var method = PAYMENT_LABEL[job.paymentMethod] || '';
    // pending → offer "Mark Paid"; paid → offer a subtle "Mark Unpaid" to reverse.
    var payBtn = '';
    if (job.paymentStatus === 'pending')
      payBtn = '<button type="button" class="btn btn-ghost btn-sm btn-mark-paid">Mark Paid</button>';
    else if (job.paymentStatus === 'paid')
      payBtn = '<button type="button" class="btn btn-ghost btn-sm btn-mark-unpaid" title="Reverse this payment back to pending">Mark Unpaid</button>';
    if (!method && !payBtn) return '';
    var methodHtml = method
      ? '<span class="pay-info"><span class="pay-info-label">Payment</span><span class="pay-info-method">' + esc(method) + '</span></span>'
      : '<span></span>';
    return '<div class="pay-info-row">' + methodHtml + payBtn + '</div>';
  }

  // Mark-Fee-Paid control for unpaid cancellation fees (staff collect the fee).
  function cancellationFeeControlHtml(job) {
    if (job.status !== 'cancelled' || job.cancellationFee == null || job.cancellationFeePaid) return '';
    return '<div class="fee-control-row">' +
      '<span class="fee-control-label">Cancellation fee ' + fmtMoney(job.cancellationFee) + ' · unpaid</span>' +
      '<button type="button" class="btn btn-ghost btn-sm btn-mark-fee-paid">Mark Fee Paid</button>' +
    '</div>';
  }

  function jobControlsHtml(job, status) {
    var a = assignControlHtml(job);
    var clearBtn = job.price != null
      ? '<button type="button" class="btn btn-ghost btn-price-clear">Clear</button>'
      : '';
    var unassignBtn = job.assignedTo
      ? '<button type="button" class="btn btn-ghost btn-unassign" title="Remove technician assignment">Unassign</button>'
      : '';
    return '<div class="job-controls">' +
        '<div class="assign-row">' + a.control +
          '<button type="button" class="btn btn-assign">Assign</button>' +
          unassignBtn +
        '</div>' +
        a.note +
        '<label class="status-row"><span>Update status</span>' +
          '<select class="status-select" data-current="' + status + '" aria-label="Update status">' + statusOptions(status) + '</select>' +
        '</label>' +
        '<div class="price-row">' +
          '<span class="price-label">Price</span>' +
          '<span class="price-currency" aria-hidden="true">$</span>' +
          '<input class="price-input" type="number" min="0" step="0.01" inputmode="decimal" value="' + (job.price != null ? esc(job.price) : '') + '" placeholder="0.00" aria-label="Job price"/>' +
          '<button type="button" class="btn btn-ghost btn-price">Save</button>' +
          clearBtn +
        '</div>' +
        paymentInfoHtml(job) +
        cancellationFeeControlHtml(job) +
      '</div>';
  }

  // A textarea editable-block with a corner pencil — AI summary, Details, note text.
  function editableBlockHtml(opts) {
    var empty = !(opts.value && String(opts.value).trim());
    return '<div class="' + opts.cls + ' editable editable-block" data-edit="' + opts.field + '" data-type="textarea" data-label="' + esc(opts.label) + '"' +
      ' data-value="' + esc(opts.value || '') + '" data-placeholder="' + esc(opts.placeholder) + '">' +
      (opts.labelHtml || '') +
      '<button type="button" class="ed-pencil ed-pencil-corner" aria-label="Edit ' + esc(opts.label) + '">' + pencilSvg() + '</button>' +
      '<p class="ed-val' + (opts.valClass ? ' ' + opts.valClass : '') + (empty ? ' is-empty' : '') + '" data-val>' + esc(empty ? opts.placeholder : opts.value) + '</p>' +
    '</div>';
  }

  // Internal dispatcher notes — staff-only comments on a job card.
  // The note list + "Add note" form below the controls. Expandable like history.
  function notesBlockHtml(job) {
    var id = String(job._id || job.id || '');
    var notes = job.internalNotes || [];
    var open = !!state.notesExpanded[id];
    var notesHtml = notes.length
      ? notes.slice().reverse().map(function (n) {
          return '<div class="int-note-row">' +
            '<span class="int-note-author">' + esc(n.author) + '</span>' +
            '<span class="int-note-time">' + timeAgo(n.timestamp) + '</span>' +
            '<p class="int-note-text">' + esc(n.text) + '</p>' +
          '</div>';
        }).join('')
      : '<div class="int-note-empty">No internal notes yet.</div>';
    return '<button type="button" class="job-history-toggle job-notes-toggle" data-notes-toggle aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="hist-caret" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>' + BI_NOTE + 'Notes (' + notes.length + ')' +
    '</button>' +
    '<div class="job-notes-panel" data-notes-panel' + (open ? '' : ' hidden') + '>' +
      notesHtml +
      '<div class="int-note-form">' +
        '<textarea class="int-note-input" rows="2" maxlength="2000" placeholder="Add an internal note…" aria-label="Add internal note"></textarea>' +
        '<button type="button" class="btn btn-primary btn-add-note">Add note</button>' +
      '</div>' +
    '</div>';
  }

  function cardHtml(job) {
    var id = String(job._id || job.id || '');
    var prio = PRIORITY_RANK[job.priority] != null ? job.priority : 'normal';
    var status = STATUS_LABEL[job.status] ? job.status : 'pending-review';
    var isActive = TAB_STATUSES.active.indexOf(status) !== -1;
    var phoneHtml = phoneEditableHtml(job.phone || '');

    // AI summary — always editable so dispatch can add/fix one when the AI failed.
    // (Rendered inline below with the new icon-based label instead of CSS ::before)

    // Details (description) — now editable (Fix 3).
    var descBlock = editableBlockHtml({
      cls: 'job-desc-block', field: 'description', label: 'Details', value: job.description,
      placeholder: 'Add job details…', valClass: 'job-desc',
      labelHtml: '<span class="job-desc-label">Details</span>'
    });
    var src = job.source || '';
    var srcIcon = SOURCE_ICON[src] || '';
    var srcLabel = SOURCE_LABEL[src] || src.toUpperCase();
    var sourceTag = src ? '<span class="job-source">' + srcIcon + srcLabel + '</span>' : '';

    // Address (editable) — street address for routing a tech. Postal code stays
    // as a read-only line beneath it.
    var addrHtml = '<div class="job-line job-loc">' + ICON_PIN +
      editable('address', job.address || '', { label: 'Address', placeholder: 'Add address' }) + '</div>';
    var postalHtml = job.postalCode
      ? '<div class="job-postal">' + ICON_PIN + esc(job.postalCode) + '</div>'
      : '';
    // ETA (editable).
    var etaHtml = '<div class="job-line job-eta">' + ICON_CLOCK +
      '<span class="job-line-label">ETA</span>' +
      editable('eta', job.eta || '', { label: 'ETA', placeholder: 'Set ETA' }) + '</div>';

    // Service type — now editable (Fix 3).
    var svcHtml = editable('serviceType', job.serviceType || '', { label: 'Service type', valClass: 'job-service-type', placeholder: 'Add service type' });

    var assignTag = assignTagHtml(job, isActive);

    // Job ID — editable by admins only (display-only for dispatch). The "#" is
    // drawn via CSS so it isn't part of the editable value.
    var jobIdHtml = job.jobId
      ? editable('jobId', job.jobId, { label: 'Job ID', valClass: 'job-id', canEdit: isAdminUser() })
      : '';

    // History panel (per-card toggle). statusHistory comes back on every job from
    // the list endpoint, newest entry last — we reverse for display.
    var expanded = !!state.expanded[id];
    var hist = job.statusHistory || [];
    var historyBlock =
      '<button type="button" class="job-history-toggle" data-history-toggle aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        '<span class="hist-caret" aria-hidden="true">' + (expanded ? '▾' : '▸') + '</span> History (' + hist.length + ')' +
      '</button>' +
      '<div class="job-history" data-history' + (expanded ? '' : ' hidden') + '>' + historyHtml(job) + '</div>';

    var notesBlock = notesBlockHtml(job);

    // Delete button — admin only, soft-delete moves job to archive
    var deleteBtn = isAdminUser()
      ? '<button type="button" class="btn btn-ghost btn-job-delete" title="Archive this job">' + BI_TRASH + '</button>'
      : '';

    // AI summary label icon instead of the old ::before "✦" text
    var aiLabelIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.26L4 11l5.91-1.74z"/></svg>';

    // Priority tooltip → the AI's suggested priority, when it made one.
    var prioTip = job.aiSuggestedPriority
      ? 'AI suggested: ' + (PRIORITY_LABEL[job.aiSuggestedPriority] || job.aiSuggestedPriority)
      : '';
    // Cancelled status tooltip → the recorded cancellation reason.
    var statusTip = status === 'cancelled' ? cancelReason(job) : '';

    return '' +
      '<div class="job-top">' +
        '<div class="job-badges">' +
          '<span class="badge prio prio-' + prio + '"' + tip(prioTip) + '>' + (PRIO_BADGE_ICON[prio] || '') + PRIORITY_LABEL[prio] + '</span>' +
          '<span class="badge status status-' + status + '" data-status-badge' + tip(statusTip) + '>' + (STATUS_BADGE_ICON[status] || '') + STATUS_LABEL[status] + '</span>' +
          assignTag +
          paymentTagHtml(job) +
          cancellationFeeTagHtml(job) +
          partsDepositTagsHtml(job) +
        '</div>' +
        '<div class="job-top-right">' +
          jobIdHtml +
          deleteBtn +
          '<time class="job-age" data-created="' + esc(job.createdAt) + '">' + timeAgo(job.createdAt) + '</time>' +
        '</div>' +
      '</div>' +
      '<div class="job-customer">' +
        editable('customerName', job.customerName || '', { label: 'Customer name', valClass: 'job-name', placeholder: 'Unknown' }) +
        phoneHtml + sourceTag +
      '</div>' +
      addrHtml +
      postalHtml +
      etaHtml +
      // Details section: service type + raw customer message + the AI summary,
      // consolidated into one block so there aren't two separate text areas.
      '<div class="job-service">' + svcHtml + descBlock +
        '<div class="job-ai editable-block" data-edit="aiSummary" data-type="textarea" data-label="AI summary" data-value="' + esc(job.aiSummary || '') + '" data-placeholder="No AI summary yet — click to add one.">' +
          '<span class="job-ai-label">' + aiLabelIcon + 'AI Summary' + (job.aiSuggestedPriority ? '<span class="ai-prio"> · suggests ' + esc(PRIORITY_LABEL[job.aiSuggestedPriority] || job.aiSuggestedPriority) + '</span>' : '') + '</span>' +
          '<button type="button" class="ed-pencil ed-pencil-corner" aria-label="Edit AI summary">' + pencilSvg() + '</button>' +
          '<p class="ed-val' + (!(job.aiSummary && job.aiSummary.trim()) ? ' is-empty' : '') + '" data-val>' + esc(!(job.aiSummary && job.aiSummary.trim()) ? 'No AI summary yet — click to add one.' : job.aiSummary) + '</p>' +
        '</div>' +
      '</div>' +
      jobControlsHtml(job, status) +
      agreementProofHtml(job) +
      notesBlock +
      historyBlock;
  }

  // "View signed agreement" proof — shown only once the customer has signed.
  // agreementSignedAt comes back on every job from the list endpoint; the full
  // text + signature image are fetched on demand when the modal opens.
  function agreementProofHtml(job) {
    if (!job.agreementSignedAt) return '';
    var id = String(job._id || job.id || '');
    return '<div class="job-agreement">' +
      '<button type="button" class="btn btn-ghost btn-sm btn-view-agreement" data-view-agreement data-id="' + esc(id) + '">' +
        '<svg class="agr-ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>' +
        'View signed agreement' +
      '</button>' +
      '<span class="agr-signed-hint">Signed ' + esc(fmtDate(job.agreementSignedAt)) + '</span>' +
    '</div>';
  }

  // statusHistory → readable rows, newest first. Each entry is a status
  // transition; `note` (e.g. a merge note) is shown when present.
  function historyHtml(job) {
    var h = (job.statusHistory || []).slice().reverse();
    if (!h.length) return '<div class="job-history-empty">No history recorded yet.</div>';
    return h.map(function (e) {
      var st = STATUS_LABEL[e.status] ? e.status : 'pending-review';
      var verb = STATUS_VERB[e.status] || STATUS_LABEL[st] || e.status;
      // Entries with a note (assignment, repeat-contact merge) lead with the note;
      // plain status transitions lead with the verb.
      var headline = e.note ? esc(e.note) : esc(verb);
      var who = e.changedBy ? ' by <b>' + esc(e.changedBy) + '</b>' : '';
      var when = e.timestamp ? ' · ' + timeAgo(e.timestamp) : '';
      return '<div class="hist-row">' +
        '<span class="hist-dot status-' + st + '" aria-hidden="true"></span>' +
        '<span class="hist-text">' + headline + who + when + '</span>' +
      '</div>';
    }).join('');
  }

  // Completed/cancelled tabs sort by most-recent activity; the active tab keeps
  // priority order (emergency → low) then newest-first within a tier.
  function jobTs(j) { return new Date(j.updatedAt || j.createdAt || 0).getTime(); }
  function sortForTab(items, tab) {
    if (tab !== 'active') {
      return items.slice().sort(function (a, b) { return jobTs(b) - jobTs(a); });
    }
    return items.slice().sort(function (a, b) {
      var ar = PRIORITY_RANK[a.priority] != null ? PRIORITY_RANK[a.priority] : 9;
      var br = PRIORITY_RANK[b.priority] != null ? PRIORITY_RANK[b.priority] : 9;
      if (ar !== br) return ar - br;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function findJob(id) {
    id = String(id);
    for (var i = 0; i < state.jobs.length; i++) {
      if (String(state.jobs[i]._id || state.jobs[i].id) === id) return state.jobs[i];
    }
    return null;
  }
  // Replace a store job with the authoritative server doc after a successful
  // mutation, then re-render so every derived view stays consistent.
  function reconcileJob(doc) {
    if (!doc) return;
    var id = String(doc._id || doc.id || '');
    for (var i = 0; i < state.jobs.length; i++) {
      if (String(state.jobs[i]._id || state.jobs[i].id) === id) { state.jobs[i] = doc; break; }
    }
    render(false);
  }

  function currentUserName() { var s = getSession(); return (s && s.username) ? s.username : ''; }
  // "Unassigned": jobs that still need a technician — a dispatcher's real work
  // queue. (Dispatch users assign techs, they don't own jobs, so the old "My jobs"
  // assignedTo===username match never matched. Repurposed to something useful.)
  function jobIsUnassigned(job) { return !((job.assignedTo || '').trim()); }

  // Tab membership. The status tabs (active/completed/cancelled) are status-based
  // and EXCLUDE notes (which live in their own calm inbox). Calls + Notes are
  // source-based and span all statuses. A call also shows in its status tab.
  function jobInTab(job, tab) {
    if (tab === 'calls') return job.source === 'call';
    if (tab === 'notes') return job.source === 'note';
    return job.source !== 'note' && TAB_STATUSES[tab] && TAB_STATUSES[tab].indexOf(job.status) !== -1;
  }
  function isSourceTab(tab) { return tab === 'calls' || tab === 'notes'; }

  // The store filtered down to what the current tab + dropdowns + toggle should show.
  function visibleJobs() {
    var list = state.jobs.filter(function (j) { return jobInTab(j, state.tab); });

    // Active tab: unified sub-filter pill (replaces old status dropdown + unassigned toggle).
    // "Pending" = assigned to a tech but not yet completed (assigned OR in-progress).
    if (state.tab === 'active') {
      var af = state.activeFilter;
      if (af === 'assigned')        list = list.filter(function (j) { return !jobIsUnassigned(j); });
      else if (af === 'unassigned') list = list.filter(function (j) { return jobIsUnassigned(j); });
      else if (af === 'pending')    list = list.filter(function (j) { return j.status === 'assigned' || j.status === 'in-progress'; });
      else if (af === 'in-progress') list = list.filter(function (j) { return j.status === 'in-progress'; });
    }

    if (filters.priority && state.tab !== 'notes') {
      list = list.filter(function (j) { return (j.priority || 'normal') === filters.priority; });
    }

    // Unified date filter — applies to every tab, measured by the tab's own timestamp.
    list = list.filter(function (j) { return passesDate(j, state.tab); });

    return list;
  }

  // Tab count badges reflect only the last 24 hours (not all-time totals), each
  // measured by the tab's own timestamp (created/completed/cancelled).
  function tabCounts() {
    var c = { active: 0, completed: 0, cancelled: 0, calls: 0, notes: 0 };
    var cutoff = Date.now() - 24 * 60 * 60 * 1000;
    function recent(j, tab) { return new Date(jobDateForTab(j, tab) || 0).getTime() >= cutoff; }
    state.jobs.forEach(function (j) {
      if (j.source === 'note') { if (recent(j, 'notes')) c.notes++; return; }
      if (j.source === 'call' && recent(j, 'calls')) c.calls++;
      if (TAB_STATUSES.active.indexOf(j.status) !== -1) { if (recent(j, 'active')) c.active++; }
      else if (j.status === 'completed') { if (recent(j, 'completed')) c.completed++; }
      else if (j.status === 'cancelled') { if (recent(j, 'cancelled')) c.cancelled++; }
    });
    return c;
  }

  function updateTabCounts() {
    var c = tabCounts();
    if (countActive) countActive.textContent = c.active;
    if (countCompleted) countCompleted.textContent = c.completed;
    if (countCancelled) countCancelled.textContent = c.cancelled;
    if (countCalls) countCalls.textContent = c.calls;
    if (countNotes) countNotes.textContent = c.notes;
    var countArchive = $('countArchive');
    if (countArchive) countArchive.textContent = state.archiveTotal || 0;
  }
  function syncTabButtons() {
    if (!tabBar) return;
    var tabs = tabBar.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === state.tab;
      tabs[i].classList.toggle('is-active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }
  // Status dropdown → hide on active tab (replaced by pills). Priority filter hides
  // on notes + archive. Date range shows on completed/cancelled. New Call on calls.
  function syncFilters() {
    var onActive = state.tab === 'active';
    var onArchive = state.tab === 'archive';
    // Status dropdown hidden on active tab (pills take over) and archive
    if (statusFilterGroup) statusFilterGroup.hidden = true; // always hidden now — pills replace it
    // Active sub-filter pills
    var pillGroup = $('activeFilterPills');
    if (pillGroup) pillGroup.hidden = !onActive;
    // Sync active pill states
    if (pillGroup) {
      var pills = pillGroup.querySelectorAll('[data-af]');
      for (var pi = 0; pi < pills.length; pi++) {
        var p = pills[pi];
        var on = p.getAttribute('data-af') === state.activeFilter;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    // Priority filter — hide on notes + archive
    var showPriority = state.tab !== 'notes' && !onArchive;
    if (priorityFilterGroup) priorityFilterGroup.hidden = !showPriority;
    if (!showPriority && filters.priority) { filters.priority = ''; if (filterPriority) filterPriority.value = ''; }
    // Unassigned toggle — legacy, now hidden (pills handle it on active)
    if (unassignedToggle) unassignedToggle.hidden = true;
    // New Call button
    if (newCallBtn) newCallBtn.hidden = state.tab !== 'calls';
    // Unified date filter — the preset buttons show on every tab; the custom
    // From/To inputs appear only while the "Custom" preset is selected.
    var presetGroup = $('datePresetGroup');
    if (presetGroup) presetGroup.hidden = false;
    var dateGroup = $('dateRangeGroup');
    if (dateGroup) dateGroup.hidden = state.datePreset !== 'custom';
    // Stats/search bar hidden in archive
    var statsBar = $('statsBar');
    if (statsBar) statsBar.hidden = onArchive;
  }

  function emptyMessage() {
    if (searchActive) return 'No jobs found.';
    if (state.tab === 'calls') return filters.priority ? 'No calls match these filters.' : 'No calls logged yet — use “+ New Call” to add one.';
    if (state.tab === 'notes') return 'No customer notes yet.';
    if (state.tab === 'archive') return 'Archive is empty — no jobs have been soft-deleted.';
    if (state.activeFilter !== 'all' || filters.priority) return 'No jobs match these filters.';
    if (state.tab === 'completed') return 'No completed jobs in the current window.';
    if (state.tab === 'cancelled') return 'No cancelled jobs in the current window.';
    return 'No active jobs right now.';
  }

  // Phone normalizer for grouping notes by customer (digits only, drop a leading 1).
  function normPhone(p) { var d = (String(p || '').match(/\d/g) || []).join(''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; }

  function paintQueue(html, animate) {
    queue.classList.toggle('animate-in', !!animate);
    queue.innerHTML = html;
    if (animate) setTimeout(function () { queue.classList.remove('animate-in'); }, 340);
    updateAges();
  }
  function jobCardOuter(job) {
    var prio = PRIORITY_RANK[job.priority] != null ? job.priority : 'normal';
    var cls = 'job-card prio-' + prio;
    return '<article class="' + cls + '" data-id="' + esc(String(job._id || job.id || '')) + '">' + cardHtml(job) + '</article>';
  }
  function archiveCardHtml(job) {
    var id = String(job._id || job.id || '');
    var status = STATUS_LABEL[job.status] ? job.status : 'pending-review';
    var deletedWhen = job.deletedAt ? timeAgo(job.deletedAt) : '';
    return '<article class="job-card archive-card" data-id="' + esc(id) + '">' +
      '<div class="job-top">' +
        '<div class="job-badges">' +
          '<span class="badge status status-' + status + '">' + (STATUS_BADGE_ICON[status] || '') + STATUS_LABEL[status] + '</span>' +
          (job.jobId ? '<span class="badge" style="font-family:var(--mono)">#' + esc(job.jobId) + '</span>' : '') +
        '</div>' +
        '<div class="job-top-right">' +
          '<span class="archive-meta">Archived ' + esc(deletedWhen) + ' by <b>' + esc(job.deletedBy || '?') + '</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="job-customer">' +
        '<span class="job-name">' + esc(job.customerName || 'Unknown') + '</span>' +
        (job.phone ? '<span class="job-phone-link">' + ICON_PHONE + esc(job.phone) + '</span>' : '') +
        (job.source ? '<span class="job-source">' + (SOURCE_ICON[job.source] || '') + (SOURCE_LABEL[job.source] || job.source.toUpperCase()) + '</span>' : '') +
      '</div>' +
      '<div class="job-service"><span class="job-service-type">' + esc(job.serviceType || '') + '</span></div>' +
      '<div class="archive-actions">' +
        '<button type="button" class="btn btn-primary btn-restore">' + BI_RESTORE + 'Restore job</button>' +
      '</div>' +
    '</article>';
  }

  // Single render path. `animate` plays the entrance animation (first load, tab
  // switch, filter change) — suppressed on optimistic/refresh re-renders so the
  // queue doesn't flash every 25s or on every click.
  function render(animate) {
    if (tabBar) tabBar.hidden = searchActive;
    if (!searchActive) { updateTabCounts(); syncTabButtons(); syncFilters(); }

    if (!searchActive && state.tab === 'notes') { renderNotes(animate); return; }
    if (!searchActive && state.tab === 'archive') { renderArchive(animate); return; }

    var list = searchActive ? state.searchResults : visibleJobs();
    if (!list.length) { paintQueue('<div class="queue-empty">' + esc(emptyMessage()) + '</div>', false); return; }
    var sorted = (searchActive || state.tab === 'calls') ? sortJobs(list) : sortForTab(list, state.tab);

    // Pagination indicator — shown when the working set was capped at JOB_LIMIT
    var pagHtml = '';
    if (!searchActive && state.total > state.jobs.length) {
      pagHtml = '<div class="pagination-info">Showing ' + state.jobs.length + ' of ' + state.total + ' jobs · ' +
        '<button type="button" class="link-btn" id="loadMoreBtn">Load more</button></div>';
    }

    paintQueue(sorted.map(jobCardOuter).join('') + pagHtml, animate);
    var lmb = $('loadMoreBtn'); if (lmb) lmb.addEventListener('click', loadMore);
  }

  function renderArchive(animate) {
    // Archive is date-filtered client-side by deletedAt (matches the other tabs).
    var jobs = state.archiveJobs.filter(function (j) { return passesDate(j, 'archive'); });
    if (!jobs.length) {
      paintQueue('<div class="queue-empty">' + esc(emptyMessage()) + '</div>', false);
      return;
    }
    var html = jobs.map(archiveCardHtml).join('');
    if (state.archiveTotal > state.archiveJobs.length) {
      html += '<div class="pagination-info">Showing ' + jobs.length + ' of ' + state.archiveTotal + ' archived jobs</div>';
    }
    paintQueue(html, animate);
  }

  /* ───────────── Customer Notes view (source === 'note') ─────────────
     Calm, muted inbox. Notes are grouped by phone so one customer's messages
     stay together. Each card shows the AI summary, an optional "View original"
     reveal of the raw message, and any attached photos (thumbnails → lightbox).
     Photos auto-expire server-side; when gone we just show the text, no error. */
  function renderNotes(animate) {
    var notes = state.jobs.filter(function (j) { return j.source === 'note' && passesDate(j, 'notes'); });
    if (!notes.length) { paintQueue('<div class="queue-empty">' + esc(emptyMessage()) + '</div>', false); return; }
    var groups = {};
    notes.forEach(function (j) {
      var key = normPhone(j.phone) || ('id:' + (j._id || j.id));
      if (!groups[key]) groups[key] = { phone: j.phone, name: j.customerName, items: [] };
      groups[key].items.push(j);
      if (!groups[key].name && j.customerName) groups[key].name = j.customerName;
    });
    var arr = Object.keys(groups).map(function (k) { return groups[k]; });
    arr.forEach(function (g) {
      g.items.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      g.latest = new Date(g.items[0].createdAt).getTime();
    });
    arr.sort(function (a, b) { return b.latest - a.latest; });
    paintQueue(arr.map(noteGroupHtml).join(''), animate);
  }

  function noteGroupHtml(g) {
    var phoneStr = g.phone || '';
    var phoneSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2 2a12 12 0 005 5l2-2 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/></svg>';
    var phoneHtml = phoneStr
      ? '<button type="button" class="job-phone note-phone" data-phone="' + esc(phoneStr) + '" title="View customer history" aria-label="View customer history for ' + esc(phoneStr) + '">' + phoneSvg + esc(phoneStr) + '</button>'
      : '';
    return '<section class="note-group">' +
      '<header class="note-group-head">' +
        '<span class="note-group-name">' + esc(g.name || 'Unknown') + '</span>' +
        phoneHtml +
        '<span class="note-group-count">' + g.items.length + ' note' + (g.items.length === 1 ? '' : 's') + '</span>' +
      '</header>' +
      g.items.map(noteCardHtml).join('') +
    '</section>';
  }

  // Note cards are fully actionable (Fix 2): service type + summary are editable,
  // and the same assign / status / price controls as a job card sit at the bottom.
  // The calm/muted note styling is kept; the note stays in this inbox regardless
  // of status (it's source-based), so a customer message can be worked end-to-end.
  function noteCardHtml(job) {
    var id = String(job._id || job.id || '');
    var status = STATUS_LABEL[job.status] ? job.status : 'pending-review';
    var when = '<time class="note-age" data-created="' + esc(job.createdAt) + '">' + timeAgo(job.createdAt) + '</time>';
    var svc = editable('serviceType', job.serviceType || '', { label: 'Service type', valClass: 'note-svc', placeholder: 'Add service type' });
    var assignTag = job.assignedTo ? '<span class="badge assigned-tag" data-assign-tag>' + ICON_PERSON + esc(job.assignedTo) + '</span>' : '';
    var summary = editableBlockHtml({
      cls: 'note-summary-edit', field: 'aiSummary', label: 'Summary', value: job.aiSummary,
      placeholder: 'No summary yet — click to add one.', valClass: 'note-summary'
    });

    var orig = job.originalMessage && String(job.originalMessage).trim();
    var open = !!state.origExpanded[id];
    var origBlock = orig
      ? '<button type="button" class="note-orig-toggle" data-orig-toggle aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="hist-caret" aria-hidden="true">' + (open ? '▾' : '▸') + '</span> View original</button>' +
        '<div class="note-orig" data-orig' + (open ? '' : ' hidden') + '><p>' + esc(job.originalMessage) + '</p></div>'
      : '';

    var photos = (job.photoUrls || []).filter(Boolean);
    var photoBlock = photos.length
      ? '<div class="note-photos">' + photos.map(function (u) {
          return '<button type="button" class="note-thumb" data-full="' + esc(u) + '" aria-label="Enlarge photo"><img src="' + esc(u) + '" alt="Attached photo" loading="lazy"/></button>';
        }).join('') + '</div>'
      : '';

    var actions = '<div class="note-actions">' + jobControlsHtml(job, status) + '</div>';

    return '<article class="note-card" data-id="' + esc(id) + '">' +
      '<div class="note-card-top">' + svc + assignTag + when + '</div>' +
      summary + origBlock + photoBlock + actions +
    '</article>';
  }

  function loadJobs(animate) {
    if (searchActive) return Promise.resolve();
    var params = new URLSearchParams();
    params.set('limit', String(JOB_LIMIT));
    return authedFetch('/api/dispatch?' + params.toString()).then(function (res) {
      if (!res.ok) {
        if (res.status !== 401) {
          queue.innerHTML = '<div class="queue-empty">Couldn’t load the job queue' +
            (res.status === 0 ? ' — backend unreachable.' : '.') + ' <button type="button" class="btn btn-ghost" id="retryBtn" style="margin-top:10px;">Retry</button></div>';
          var rb = $('retryBtn'); if (rb) rb.addEventListener('click', function () { loadJobs(true); });
        }
        return;
      }
      var items = (res.data && res.data.items) || [];
      detectNewJobs(items);
      state.jobs = items;
      state.total = (res.data && res.data.total) || items.length;
      render(!!animate);
      markUpdated();
    });
  }

  // Load more jobs (append to working set, incrementing the offset).
  function loadMore() {
    var params = new URLSearchParams();
    params.set('limit', String(JOB_LIMIT));
    params.set('page', String(Math.floor(state.jobs.length / JOB_LIMIT) + 1));
    authedFetch('/api/dispatch?' + params.toString()).then(function (res) {
      if (!res.ok) return;
      var items = (res.data && res.data.items) || [];
      state.jobs = state.jobs.concat(items);
      state.total = (res.data && res.data.total) || state.total;
      render(false);
    });
  }

  function loadArchive() {
    return authedFetch('/api/dispatch/deleted').then(function (res) {
      if (!res.ok) return;
      state.archiveJobs = (res.data && res.data.items) || [];
      state.archiveTotal = (res.data && res.data.total) || state.archiveJobs.length;
      renderArchive(true);
      updateTabCounts();
    });
  }

  // Notification sound: chime when a job ID we've never seen shows up on a
  // refresh (skips the very first load so the queue filling in is silent).
  function detectNewJobs(items) {
    var ids = items.map(function (j) { return j._id || j.id; }).filter(Boolean);
    if (knownJobIds !== null) {
      var hasNew = ids.some(function (id) { return !knownJobIds.has(id); });
      if (hasNew) playChime();
    } else {
      knownJobIds = new Set();
    }
    ids.forEach(function (id) { knownJobIds.add(id); });
  }

  /* ───────────── refresh orchestration ───────────── */
  function refresh() {
    return loadStats().then(function () {
      if (state.pending > 0) { markUpdated(); return; } // don't clobber an in-flight optimistic change
      var a = document.activeElement;
      var editing = a && queue.contains(a) && (a.matches && a.matches('input, select, textarea'));
      if (editing) { markUpdated(); return; } // don't clobber a dispatcher mid-edit
      return loadJobs(false);
    });
  }
  function markUpdated() { lastFetchTs = Date.now(); updateAges(); }

  function updateAges() {
    if (lastFetchTs) lastUpdatedEl.textContent = 'Updated ' + agoShort(lastFetchTs);
    var ages = queue.querySelectorAll('[data-created]');
    for (var i = 0; i < ages.length; i++) {
      ages[i].textContent = timeAgo(ages[i].getAttribute('data-created'));
    }
  }

  refreshBtn.addEventListener('click', function () { refresh(); });
  // Filters are client-side: changing one re-derives the view from the store (no
  // refetch) and exits search mode so the dropdown can't silently do nothing.
  if (filterStatus) filterStatus.addEventListener('change', function () {
    if (searchActive) clearSearch();
    filters.status = filterStatus.value;
    render(true);
  });
  filterPriority.addEventListener('change', function () {
    if (searchActive) clearSearch();
    filters.priority = filterPriority.value;
    render(true);
  });

  // Tabs (Active / Completed / Cancelled).
  if (tabBar) {
    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-tab]');
      if (!btn) return;
      var tab = btn.getAttribute('data-tab');
      if (TABS.indexOf(tab) === -1) return;
      if (searchActive) clearSearch();
      if (tab === state.tab) return;
      state.tab = tab;
      filters.status = ''; if (filterStatus) filterStatus.value = ''; // status filter is per-active-tab
      if (tab === 'archive') {
        // Archive is fetched on demand (admin only); show a loading state, then paint.
        queue.innerHTML = '<div class="acme-loading"><span class="acme-spinner"></span>Loading archive…</div>';
        syncTabButtons(); syncFilters();
        loadArchive();
        return;
      }
      render(true);
    });
  }

  // Active sub-filter pills (All / Assigned / Unassigned / Pending Review / In Progress).
  var activeFilterPills = $('activeFilterPills');
  if (activeFilterPills) {
    activeFilterPills.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-af]');
      if (!btn) return;
      var af = btn.getAttribute('data-af');
      if (af === state.activeFilter) return;
      if (searchActive) clearSearch();
      state.activeFilter = af;
      render(true);
    });
  }

  // Unified date filter — preset buttons (Today / Week / Month / Custom) apply to
  // EVERY tab. "Custom" reveals the From/To inputs; the others hide them.
  var datePresetGroup = $('datePresetGroup');
  var dateFromInput = $('dateFrom'), dateToInput = $('dateTo');
  if (datePresetGroup) {
    datePresetGroup.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-range]');
      if (!btn) return;
      var range = btn.getAttribute('data-range');
      state.datePreset = range;
      var btns = datePresetGroup.querySelectorAll('[data-range]');
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i] === btn;
        btns[i].classList.toggle('is-active', on);
        btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      var dateGroup = $('dateRangeGroup');
      if (dateGroup) dateGroup.hidden = range !== 'custom';
      if (searchActive) clearSearch();
      render(true);
    });
  }
  function applyDateRange() {
    state.dateFrom = dateFromInput ? dateFromInput.value : '';
    state.dateTo = dateToInput ? dateToInput.value : '';
    if (searchActive) clearSearch();
    render(true);
  }
  if (dateFromInput) dateFromInput.addEventListener('change', applyDateRange);
  if (dateToInput) dateToInput.addEventListener('change', applyDateRange);

  // "Unassigned" toggle — filters to jobs that still need a technician.
  if (unassignedToggle) {
    unassignedToggle.addEventListener('click', function () {
      state.unassignedOnly = !state.unassignedOnly;
      unassignedToggle.classList.toggle('is-on', state.unassignedOnly);
      unassignedToggle.setAttribute('aria-pressed', state.unassignedOnly ? 'true' : 'false');
      render(true);
    });
  }

  /* ───────────── New Call (manual call logging) ─────────────
     A dispatcher logs a phone call by hand until Twilio is wired up. POST creates
     a source:'call' job that lands in the Calls tab (and the Active tab). */
  function openCallModal() {
    if (!callModal) return;
    if (callForm) callForm.reset();
    if (callError) { callError.hidden = true; callError.textContent = ''; }
    callModal.hidden = false;
    void callModal.offsetWidth;
    callModal.classList.add('is-open');
    setTimeout(function () { var f = $('callName'); if (f) f.focus(); }, 60);
  }
  function closeCallModal() {
    if (!callModal) return;
    callModal.classList.remove('is-open');
    setTimeout(function () { if (!callModal.classList.contains('is-open')) callModal.hidden = true; }, 170);
  }
  if (newCallBtn) newCallBtn.addEventListener('click', openCallModal);
  if (callClose) callClose.addEventListener('click', closeCallModal);
  var callCancel = $('callCancel'); if (callCancel) callCancel.addEventListener('click', closeCallModal);
  if (callModal) callModal.addEventListener('click', function (e) { if (e.target === callModal) closeCallModal(); });
  if (callForm) {
    callForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = ($('callName').value || '').trim();
      var phone = ($('callPhone').value || '').trim();
      var service = ($('callService').value || '').trim();
      var addrEl = $('callAddress');
      var address = addrEl ? (addrEl.value || '').trim() : '';
      var desc = ($('callDesc').value || '').trim();
      var prio = ($('callPriority').value || '').trim();
      function showErr(m) { if (callError) { callError.textContent = m; callError.hidden = false; } }
      if (!name) return showErr('Enter the customer’s name.');
      if (!/^[0-9+()\-.\s]{7,30}$/.test(phone)) return showErr('Enter a valid phone number.');
      if (!service) return showErr('Enter the service type.');
      var body = { customerName: name, phone: phone, serviceType: service };
      if (address) body.address = address;
      if (desc) body.description = desc;
      if (prio) body.priority = prio;
      if (callError) callError.hidden = true;
      var lbl = callSubmit ? callSubmit.textContent : '';
      if (callSubmit) { callSubmit.disabled = true; callSubmit.textContent = 'Logging…'; }
      authedFetch('/api/dispatch/manual-call', { method: 'POST', json: body }).then(function (res) {
        if (callSubmit) { callSubmit.disabled = false; callSubmit.textContent = lbl; }
        if (res.ok && res.data) {
          state.jobs.unshift(res.data);                          // add to the store (newest first)
          if (knownJobIds) knownJobIds.add(res.data._id || res.data.id); // don't chime for our own entry
          state.tab = 'calls';
          render(true);
          closeCallModal();
          toast('Call logged · #' + (res.data.jobId || ''), 'ok');
        } else if (res.status !== 401) {
          showErr((res.data && res.data.message) || 'Could not log the call — try again.');
        }
      });
    });
  }

  /* ───────────── per-card actions (event delegation) ───────────── */
  queue.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var pencil = e.target.closest('.ed-pencil');
    if (pencil) { startEdit(pencil); return; }
    var edSave = e.target.closest('.ed-save');
    if (edSave) { commitEdit(edSave.closest('.editable')); return; }
    var edCancel = e.target.closest('.ed-cancel');
    if (edCancel) { restoreView(edCancel.closest('.editable')); return; }
    var histBtn = e.target.closest('[data-history-toggle]');
    if (histBtn) { toggleHistory(histBtn); return; }
    var origToggle = e.target.closest('[data-orig-toggle]');
    if (origToggle) { toggleOriginal(origToggle); return; }
    var thumb = e.target.closest('.note-thumb');
    if (thumb) { openLightbox(thumb.getAttribute('data-full')); return; }
    var assignBtn = e.target.closest('.btn-assign');
    if (assignBtn) { doAssign(assignBtn); return; }
    var clearBtn = e.target.closest('.btn-price-clear');
    if (clearBtn) {
      var clearCard = clearBtn.closest('[data-id]');
      var clearInput = clearCard && clearCard.querySelector('.price-input');
      var clearSave = clearCard && clearCard.querySelector('.btn-price');
      if (clearInput) clearInput.value = '';     // empty input → doSetPrice sends null
      if (clearSave) doSetPrice(clearSave);
      return;
    }
    var priceBtn = e.target.closest('.btn-price');
    if (priceBtn) { doSetPrice(priceBtn); return; }
    var markPaidBtn = e.target.closest('.btn-mark-paid');
    if (markPaidBtn) { doMarkPaid(markPaidBtn); return; }
    var markUnpaidBtn = e.target.closest('.btn-mark-unpaid');
    if (markUnpaidBtn) { doMarkUnpaid(markUnpaidBtn); return; }
    var markFeePaidBtn = e.target.closest('.btn-mark-fee-paid');
    if (markFeePaidBtn) { doMarkFeePaid(markFeePaidBtn); return; }
    // Tag tooltip — tap a badge to toggle its speech bubble (mobile); hover on desktop.
    var tipBadge = e.target.closest('.badge[data-tip]');
    if (tipBadge) {
      var wasOpen = tipBadge.classList.contains('tip-open');
      closeAllTips();
      if (!wasOpen) tipBadge.classList.add('tip-open');
      return;
    }
    closeAllTips();
    var unassignBtn = e.target.closest('.btn-unassign');
    if (unassignBtn) { doUnassign(unassignBtn); return; }
    var noteToggle = e.target.closest('[data-notes-toggle]');
    if (noteToggle) { toggleNotes(noteToggle); return; }
    var addNoteBtn = e.target.closest('.btn-add-note');
    if (addNoteBtn) { doAddNote(addNoteBtn); return; }
    var delBtn = e.target.closest('.btn-job-delete');
    if (delBtn) { doDelete(delBtn); return; }
    var restoreBtn = e.target.closest('.btn-restore');
    if (restoreBtn) { doRestore(restoreBtn); return; }
    var agrBtn = e.target.closest('.btn-view-agreement');
    if (agrBtn) { openAgreementModal(agrBtn.getAttribute('data-id')); return; }
    // History modal: small clock button on a job card, and the phone chip on note groups.
    var histPhone = e.target.closest('.job-phone-hist[data-phone]');
    if (histPhone) { openCustomerHistory(histPhone.getAttribute('data-phone')); return; }
    var phoneBtn = e.target.closest('.job-phone[data-phone]');
    if (phoneBtn) { openCustomerHistory(phoneBtn.getAttribute('data-phone')); return; }
  });
  queue.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('.status-select');
    if (sel) doStatus(sel);
  });
  // Close any open tag tooltip when clicking outside a badge (mobile tap-away).
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('.badge[data-tip]'))) closeAllTips();
  });
  // Enter inside a price input saves it.
  queue.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('price-input')) {
      e.preventDefault();
      var card = e.target.closest('[data-id]');
      var btn = card && card.querySelector('.btn-price');
      if (btn) doSetPrice(btn);
      return;
    }
    // Inline editors: Enter saves (single-line only), Escape cancels.
    if (e.target.classList && e.target.classList.contains('ed-input')) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        commitEdit(e.target.closest('.editable'));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        restoreView(e.target.closest('.editable'));
      }
    }
  });

  // Expand/collapse a card's history panel. Tracked in state.expanded so the
  // panel stays open through re-renders (auto-refresh, optimistic updates).
  function toggleHistory(btn) {
    var card = btn.closest('.job-card'); if (!card) return;
    var id = card.getAttribute('data-id');
    var panel = card.querySelector('[data-history]');
    var open = btn.getAttribute('aria-expanded') === 'true';
    var next = !open;
    btn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (panel) panel.hidden = !next;
    var caret = btn.querySelector('.hist-caret');
    if (caret) caret.textContent = next ? '▾' : '▸';
    if (next) state.expanded[id] = true; else delete state.expanded[id];
  }

  // "View original" on a note card — same expand/collapse pattern, tracked so it
  // survives the 25s auto-refresh re-render.
  function toggleOriginal(btn) {
    var card = btn.closest('.note-card'); if (!card) return;
    var id = card.getAttribute('data-id');
    var panel = card.querySelector('[data-orig]');
    var open = btn.getAttribute('aria-expanded') === 'true';
    var next = !open;
    btn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (panel) panel.hidden = !next;
    var caret = btn.querySelector('.hist-caret');
    if (caret) caret.textContent = next ? '▾' : '▸';
    if (next) state.origExpanded[id] = true; else delete state.origExpanded[id];
  }

  /* ───────────── photo lightbox (note thumbnails) ───────────── */
  function openLightbox(url) {
    if (!url || !imgModal || !imgModalImg) return;
    imgModalImg.src = url;
    imgModal.hidden = false;
    void imgModal.offsetWidth;
    imgModal.classList.add('is-open');
  }
  function closeLightbox() {
    if (!imgModal) return;
    imgModal.classList.remove('is-open');
    setTimeout(function () { if (!imgModal.classList.contains('is-open')) { imgModal.hidden = true; if (imgModalImg) imgModalImg.src = ''; } }, 170);
  }
  if (imgModal) imgModal.addEventListener('click', closeLightbox);

  function doSetPrice(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var input = card.querySelector('.price-input');
    var raw = (input.value || '').trim();
    var clearing = raw === '';                       // empty input clears the price (Fix 4)
    var price = clearing ? null : Number(raw);
    if (!clearing && (isNaN(price) || price < 0)) { toast('Enter a valid price.', 'err'); input.focus(); return; }
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    authedFetch('/api/dispatch/' + id + '/price', { method: 'PATCH', json: { price: price } })
      .then(function (res) {
        btn.disabled = false; btn.textContent = label;
        if (res.ok) {
          var newPrice = (res.data && res.data.price != null) ? res.data.price : null;
          input.value = newPrice != null ? newPrice : '';
          var jb = findJob(id); if (jb) jb.price = newPrice;
          syncPriceClearBtn(card, newPrice != null);    // add/remove the Clear button in place
          toast(clearing ? 'Price cleared' : 'Price saved · ' + fmtMoney(newPrice != null ? newPrice : price), 'ok');
          loadStats(); // revenue counters may shift
        } else if (res.status !== 401) {
          toast((res.data && res.data.message) || 'Could not save the price.', 'err');
        }
      });
  }
  // Keep the Clear button's presence in sync with whether a price is set, without
  // a full re-render (which would drop focus / collapse other open editors).
  function syncPriceClearBtn(card, hasPrice) {
    var row = card.querySelector('.price-row'); if (!row) return;
    var existing = row.querySelector('.btn-price-clear');
    if (hasPrice && !existing) {
      row.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-ghost btn-price-clear">Clear</button>');
    } else if (!hasPrice && existing) {
      existing.remove();
    }
  }

  function doAssign(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var sel = card.querySelector('.tech-select');
    var input = card.querySelector('.tech-input');

    var body, displayName;
    if (sel) {
      var tid = sel.value;
      if (!tid) { toast('Select a technician first.', 'err'); sel.focus(); return; }
      body = { technicianId: tid };
      displayName = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    } else if (input) {
      var name = (input.value || '').trim();
      if (!name) { toast('Enter a technician name first.', 'err'); input.focus(); return; }
      body = { assignedTo: name };
      displayName = name;
    } else { return; }

    var job = findJob(id);
    var prevAssigned = job ? job.assignedTo : '';
    var prevTechId = job ? job.technicianId : null;
    // Optimistic: show the name immediately (prominent tag updates on re-render).
    if (job) {
      job.assignedTo = displayName;
      job.technicianId = body.technicianId || null;
      render(false);
    }
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    state.pending++;
    authedFetch('/api/dispatch/' + id + '/assign', { method: 'PATCH', json: body })
      .then(function (res) {
        state.pending--;
        if (res.ok) {
          var nm = (res.data && res.data.assignedTo) || displayName;
          reconcileJob(res.data); // authoritative; also re-enables the (rebuilt) button
          toast('Assigned to ' + nm, 'ok');
        } else if (res.status !== 401) {
          if (job) { job.assignedTo = prevAssigned; job.technicianId = prevTechId; render(false); }
          else { btn.disabled = false; btn.textContent = label; }
          toast((res.data && res.data.message) || 'Could not assign — try again.', 'err');
        } else {
          btn.disabled = false; btn.textContent = label;
        }
      });
  }

  function doStatus(sel) {
    var card = sel.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var next = sel.value;
    var current = sel.getAttribute('data-current');
    if (next === current) return;

    // Guard against a misclick reopening a finished job (Fix 5). `current` mirrors
    // the job's status, so this fires whenever the job is currently terminal.
    if (TERMINAL[current]) {
      var ok = window.confirm('This job is ' + STATUS_LABEL[current] + '. Reopen it as “' + STATUS_LABEL[next] + '”?');
      if (!ok) { sel.value = current; return; }   // revert the dropdown, do nothing
    }

    var job = findJob(id);
    if (!job) {
      // Not in the store (e.g. a search result) — patch + update this card only.
      sel.disabled = true;
      authedFetch('/api/dispatch/' + id + '/status', { method: 'PATCH', json: { status: next } }).then(function (res) {
        sel.disabled = false;
        if (res.ok) {
          sel.setAttribute('data-current', next);
          var b = card.querySelector('[data-status-badge]');
          if (b) { b.className = 'badge status status-' + next; b.setAttribute('data-status-badge', ''); b.textContent = STATUS_LABEL[next]; }
          toast('Status → ' + STATUS_LABEL[next], 'status-' + next); loadStats();
        } else if (res.status !== 401) {
          sel.value = current; toast((res.data && res.data.message) || 'Could not update status.', 'err');
        }
      });
      return;
    }

    var prevStatus = job.status;
    var prevHistory = (job.statusHistory || []).slice();
    // Optimistic: update the store + append a provisional history entry, then
    // re-render so the card moves tabs / leaves a filtered view and the count
    // badges update immediately — no full reload.
    job.status = next;
    job.statusHistory = prevHistory.concat([{ status: next, changedBy: currentUserName() || 'you', timestamp: new Date().toISOString() }]);
    state.pending++;
    render(false);
    authedFetch('/api/dispatch/' + id + '/status', { method: 'PATCH', json: { status: next } })
      .then(function (res) {
        state.pending--;
        if (res.ok) {
          reconcileJob(res.data); // swap in the authoritative doc + real history
          toast('Status → ' + STATUS_LABEL[next], 'status-' + next);
          loadStats();
        } else if (res.status !== 401) {
          job.status = prevStatus; job.statusHistory = prevHistory; // revert
          render(false);
          toast((res.data && res.data.message) || 'Could not update status.', 'err');
        }
      });
  }

  // Return an assigned job to the unassigned pool (clears tech + free-text name).
  function doUnassign(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var job = findJob(id);
    var prevAssigned = job ? job.assignedTo : '';
    var prevTechId = job ? job.technicianId : null;
    if (job) { job.assignedTo = ''; job.technicianId = null; render(false); } // optimistic
    btn.disabled = true;
    state.pending++;
    authedFetch('/api/dispatch/' + id + '/unassign', { method: 'PATCH', json: {} })
      .then(function (res) {
        state.pending--;
        if (res.ok) {
          reconcileJob(res.data);
          toast('Returned to unassigned', 'ok');
        } else if (res.status !== 401) {
          if (job) { job.assignedTo = prevAssigned; job.technicianId = prevTechId; render(false); }
          else { btn.disabled = false; }
          toast((res.data && res.data.message) || 'Could not unassign — try again.', 'err');
        } else { btn.disabled = false; }
      });
  }

  // Expand/collapse a card's internal-notes panel. Tracked in state.notesExpanded
  // so it survives re-renders (auto-refresh, optimistic updates).
  function toggleNotes(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var panel = card.querySelector('[data-notes-panel]');
    var open = btn.getAttribute('aria-expanded') === 'true';
    var next = !open;
    btn.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (panel) panel.hidden = !next;
    var caret = btn.querySelector('.hist-caret');
    if (caret) caret.textContent = next ? '▾' : '▸';
    if (next) state.notesExpanded[id] = true; else delete state.notesExpanded[id];
  }

  // Append a dispatcher internal note. Keeps the panel open and re-renders so the
  // new note shows immediately with the authoritative server copy.
  function doAddNote(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var input = card.querySelector('.int-note-input');
    var text = input ? (input.value || '').trim() : '';
    if (!text) { toast('Write a note first.', 'err'); if (input) input.focus(); return; }
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    state.notesExpanded[id] = true; // keep the panel open across the re-render
    state.pending++;
    authedFetch('/api/dispatch/' + id + '/notes', { method: 'POST', json: { text: text } })
      .then(function (res) {
        state.pending--;
        btn.disabled = false; btn.textContent = label;
        if (res.ok) {
          reconcileJob(res.data);
          toast('Note added', 'ok');
        } else if (res.status !== 401) {
          toast((res.data && res.data.message) || 'Could not add the note.', 'err');
        }
      });
  }

  // Soft-delete (archive) a job — admin only. Confirm, then move it to the archive.
  function doDelete(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    var job = findJob(id);
    var name = job ? (job.customerName || 'this job') : 'this job';
    if (!window.confirm('Archive ' + name + '? It will be moved to the Archive tab and hidden from the queue. You can restore it later.')) return;
    btn.disabled = true;
    state.pending++;
    authedFetch('/api/dispatch/' + id + '/soft-delete', { method: 'PATCH' })
      .then(function (res) {
        state.pending--;
        if (res.ok) {
          // Drop it from the working set + bump the archive count, then re-render.
          state.jobs = state.jobs.filter(function (j) { return String(j._id || j.id) !== id; });
          if (state.total > 0) state.total--;
          state.archiveTotal++;
          render(false);
          toast('Job archived', 'ok');
          loadStats();
        } else if (res.status !== 401) {
          btn.disabled = false;
          toast((res.data && res.data.message) || 'Could not archive the job.', 'err');
        } else { btn.disabled = false; }
      });
  }

  // Restore a job from the archive back into the live queue — admin only.
  function doRestore(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    btn.disabled = true;
    authedFetch('/api/dispatch/' + id + '/restore', { method: 'PATCH' })
      .then(function (res) {
        if (res.ok) {
          state.archiveJobs = state.archiveJobs.filter(function (j) { return String(j._id || j.id) !== id; });
          if (state.archiveTotal > 0) state.archiveTotal--;
          renderArchive(false);
          updateTabCounts();
          toast('Job restored to the queue', 'ok');
          loadStats();
        } else if (res.status !== 401) {
          btn.disabled = false;
          toast((res.data && res.data.message) || 'Could not restore the job.', 'err');
        } else { btn.disabled = false; }
      });
  }

  // Mark a pending card/e-transfer payment as settled. Reconciles the returned
  // job doc so the badge flips Paid and the Mark Paid button disappears.
  function doMarkPaid(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    authedFetch('/api/dispatch/' + id + '/mark-paid', { method: 'PATCH' })
      .then(function (res) {
        if (res.ok) {
          reconcileJob(res.data);
          toast('Payment marked paid', 'ok');
        } else if (res.status !== 401) {
          btn.disabled = false; btn.textContent = label;
          toast((res.data && res.data.message) || 'Could not mark paid.', 'err');
        } else { btn.disabled = false; btn.textContent = label; }
      });
  }

  // Reverse a paid job back to pending (e.g. a settlement was logged in error).
  function doMarkUnpaid(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    authedFetch('/api/dispatch/' + id + '/mark-unpaid', { method: 'PATCH' })
      .then(function (res) {
        if (res.ok) {
          reconcileJob(res.data);
          toast('Payment reverted to pending', 'ok');
        } else if (res.status !== 401) {
          btn.disabled = false; btn.textContent = label;
          toast((res.data && res.data.message) || 'Could not mark unpaid.', 'err');
        } else { btn.disabled = false; btn.textContent = label; }
      });
  }

  // Close every open tag tooltip (outside-click / re-render).
  function closeAllTips() {
    var open = document.querySelectorAll('.badge.tip-open');
    for (var i = 0; i < open.length; i++) open[i].classList.remove('tip-open');
  }

  // Record that a cancelled job's cancellation fee has been collected.
  function doMarkFeePaid(btn) {
    var card = btn.closest('[data-id]'); if (!card) return;
    var id = card.getAttribute('data-id');
    btn.disabled = true; var label = btn.textContent; btn.textContent = '…';
    authedFetch('/api/dispatch/' + id + '/cancellation-fee-paid', { method: 'PATCH' })
      .then(function (res) {
        if (res.ok) {
          reconcileJob(res.data);
          toast('Cancellation fee marked paid', 'ok');
        } else if (res.status !== 401) {
          btn.disabled = false; btn.textContent = label;
          toast((res.data && res.data.message) || 'Could not mark the fee paid.', 'err');
        } else { btn.disabled = false; btn.textContent = label; }
      });
  }

  /* ───────────── job search (by jobId, phone, or name) ───────────── */
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      runSearch();
    });
  }
  if (searchClear) searchClear.addEventListener('click', exitSearch);

  function runSearch() {
    var q = (searchInput.value || '').trim();
    if (!q) { exitSearch(); return; }
    var param;
    if (/^\d{7}$/.test(q)) {
      param = 'jobId=' + encodeURIComponent(q);
    } else {
      var digits = q.replace(/[^\d+]/g, '');
      // A query with real digits (3+) is treated as a phone lookup; anything else
      // (letters / a short token) is a customer-name search.
      if (digits.replace(/\D/g, '').length >= 3) {
        param = 'phone=' + encodeURIComponent(digits);
      } else if (/[a-z]/i.test(q)) {
        param = 'name=' + encodeURIComponent(q);
      } else {
        toast('Search by Job ID, phone number, or customer name.', 'err');
        return;
      }
    }
    searchActive = true;
    var sb = $('searchBtn'); if (sb) sb.classList.add('is-loading');
    queue.innerHTML = '<div class="acme-loading"><span class="acme-spinner"></span>Searching…</div>';
    authedFetch('/api/dispatch/search?' + param).then(function (res) {
      if (sb) sb.classList.remove('is-loading');
      if (!res.ok) {
        if (res.status !== 401) {
          queue.innerHTML = '<div class="queue-empty">' +
            ((res.data && res.data.message) || 'Search failed — try again.') + '</div>';
        }
        return;
      }
      var items = (res.data && res.data.items) || [];
      state.searchResults = items;       // search spans all tabs; render() shows these
      render(true);                      // tab bar hides while searchActive
      searchMeta.hidden = false;
      searchMeta.innerHTML = 'Showing ' + items.length + ' result' + (items.length === 1 ? '' : 's') +
        ' for <b>' + esc(q) + '</b> · <button type="button" class="link-btn" id="searchMetaClear">show full queue</button>';
      var c = $('searchMetaClear'); if (c) c.addEventListener('click', exitSearch);
      if (searchClear) searchClear.hidden = false;
      markUpdated();
    });
  }
  // Reset the search UI/state without refetching (used when a filter/tab takes over).
  function clearSearch() {
    searchActive = false;
    state.searchResults = [];
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.hidden = true;
    if (searchMeta) { searchMeta.hidden = true; searchMeta.innerHTML = ''; }
  }
  function exitSearch() {
    clearSearch();
    loadJobs(true); // pull a fresh working set on an explicit exit
  }

  /* ───────────── customer history modal ───────────── */
  function openCustomerHistory(phone) {
    if (!phone || !custModal) return;
    custModal.hidden = false;
    void custModal.offsetWidth;            // reflow → fade-in transition
    custModal.classList.add('is-open');
    custBody.innerHTML = '<div class="acme-loading"><span class="acme-spinner"></span>Loading…</div>';
    custTitle.textContent = 'Customer · ' + phone;
    authedFetch('/api/dispatch/customer/' + encodeURIComponent(phone)).then(function (res) {
      if (!res.ok) {
        if (res.status === 401) { closeCustModal(); return; }
        custBody.innerHTML = '<div class="cust-empty">' + ((res.data && res.data.message) || 'Could not load customer history.') + '</div>';
        return;
      }
      renderCustomerHistory(res.data || {});
    });
  }
  function renderCustomerHistory(data) {
    var s = data.summary || {};
    var jobs = data.jobs || [];
    var tel = telHref(data.phone || '');
    var head =
      '<div class="cust-summary">' +
        '<div class="cust-stat"><span class="cust-stat-num">' + (s.totalJobs || 0) + '</span><span class="cust-stat-label">Total jobs</span></div>' +
        '<div class="cust-stat"><span class="cust-stat-num">' + (s.completedJobs || 0) + '</span><span class="cust-stat-label">Completed</span></div>' +
        '<div class="cust-stat"><span class="cust-stat-num">' + fmtMoney(s.totalRevenue || 0) + '</span><span class="cust-stat-label">Total revenue</span></div>' +
      '</div>' +
      '<div class="cust-contact">' +
        (tel ? '<a class="cust-call" href="' + esc(tel) + '">Call ' + esc(data.phone || '') + '</a>' : '') +
        '<span class="cust-dates">First: ' + fmtDate(s.firstContact) + ' · Last: ' + fmtDate(s.lastContact) + '</span>' +
      '</div>';
    var rows = jobs.length
      ? jobs.map(function (j) {
          var st = STATUS_LABEL[j.status] ? j.status : 'pending-review';
          return '<div class="cust-job">' +
            '<div class="cust-job-top">' +
              '<span class="cust-job-id">' + (j.jobId ? '#' + esc(j.jobId) : '—') + '</span>' +
              '<span class="badge status status-' + st + '">' + STATUS_LABEL[st] + '</span>' +
              '<span class="cust-job-date">' + fmtDate(j.createdAt) + '</span>' +
            '</div>' +
            '<div class="cust-job-svc">' + esc(j.serviceType || '—') +
              (j.price != null ? '<span class="cust-job-price">' + fmtMoney(j.price) + '</span>' : '') +
            '</div>' +
          '</div>';
        }).join('')
      : '<div class="cust-empty">No past jobs on record.</div>';
    custBody.innerHTML = head + '<div class="cust-jobs">' + rows + '</div>';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function closeCustModal() {
    if (!custModal) return;
    custModal.classList.remove('is-open');
    setTimeout(function () { if (!custModal.classList.contains('is-open')) custModal.hidden = true; }, 170);
  }
  if (custClose) custClose.addEventListener('click', closeCustModal);
  if (custModal) custModal.addEventListener('click', function (e) { if (e.target === custModal) closeCustModal(); });

  /* ───────────── signed-agreement viewer ─────────────
     Opens the snapshot of what the customer actually signed. We re-fetch the full
     job (GET /:id) because the list payload omits the heavy agreementText +
     base64 signature; those are only pulled when someone opens the proof. */
  function openAgreementModal(id) {
    if (!id || !agrModal) return;
    agrModal.hidden = false;
    void agrModal.offsetWidth;             // reflow → fade-in transition
    agrModal.classList.add('is-open');
    agrBody.innerHTML = '<div class="acme-loading"><span class="acme-spinner"></span>Loading…</div>';
    agrTitle.textContent = 'Signed Agreement';
    authedFetch('/api/dispatch/' + encodeURIComponent(id)).then(function (res) {
      if (!res.ok) {
        if (res.status === 401) { closeAgrModal(); return; }
        agrBody.innerHTML = '<div class="cust-empty">' + ((res.data && res.data.message) || 'Could not load the agreement.') + '</div>';
        return;
      }
      renderAgreement((res.data && res.data.job) || res.data || {});
    });
  }
  function renderAgreement(job) {
    if (!job.agreementSignedAt && !job.customerSignature && !job.agreementText) {
      agrBody.innerHTML = '<div class="cust-empty">No signed agreement on record for this job.</div>';
      return;
    }
    agrTitle.textContent = 'Signed Agreement' + (job.jobId ? ' · #' + job.jobId : '');
    var when = job.agreementSignedAt
      ? new Date(job.agreementSignedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
    var sigImg = job.customerSignature
      ? '<img class="agr-sig-img" src="' + esc(job.customerSignature) + '" alt="Customer signature"/>'
      : '<div class="agr-sig-empty">No signature image on file.</div>';
    var techHtml = job.assignedTo
      ? '<span class="agr-meta-tech">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          esc(job.assignedTo) + '</span>'
      : '';
    agrBody.innerHTML =
      '<div class="agr-meta">' +
        '<span class="agr-meta-name">' + esc(job.customerName || 'Customer') + '</span>' +
        techHtml +
        '<span class="agr-meta-when">Signed ' + esc(when) + '</span>' +
      '</div>' +
      '<div class="agr-doc">' + esc(job.agreementText || 'No agreement text was captured.') + '</div>' +
      '<div class="agr-sig-wrap">' +
        '<span class="agr-sig-label">Customer signature</span>' +
        '<div class="agr-sig-box">' + sigImg + '</div>' +
      '</div>';
  }
  function closeAgrModal() {
    if (!agrModal) return;
    agrModal.classList.remove('is-open');
    setTimeout(function () { if (!agrModal.classList.contains('is-open')) agrModal.hidden = true; }, 170);
  }
  if (agrClose) agrClose.addEventListener('click', closeAgrModal);
  if (agrModal) agrModal.addEventListener('click', function (e) { if (e.target === agrModal) closeAgrModal(); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (imgModal && !imgModal.hidden) { closeLightbox(); return; }
    if (callModal && !callModal.hidden) { closeCallModal(); return; }
    if (agrModal && !agrModal.hidden) { closeAgrModal(); return; }
    if (custModal && !custModal.hidden) closeCustModal();
  });

  /* ───────────── notification sound + mute ───────────── */
  function initMute() {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    reflectMute();
  }
  function reflectMute() {
    if (!muteToggle) return;
    var on = muteToggle.querySelector('.mute-ico-on');
    var off = muteToggle.querySelector('.mute-ico-off');
    if (on) on.style.display = muted ? 'none' : '';
    if (off) off.style.display = muted ? '' : 'none';
    muteToggle.setAttribute('aria-label', muted ? 'Unmute new-job sound' : 'Mute new-job sound');
    muteToggle.setAttribute('title', muted ? 'Unmute new-job sound' : 'Mute new-job sound');
    muteToggle.classList.toggle('is-muted', muted);
    if (typeof reflectAudioLock === 'function') reflectAudioLock();
  }
  if (muteToggle) {
    muteToggle.addEventListener('click', function () {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
      reflectMute();
      if (!muted) { unlockAudio(); playChime(); }   // confirm sound on unmute
    });
  }
  // Subtle hint: the new-job chime can't play until the browser unlocks audio on
  // a user gesture. Show it only when sound is wanted (not muted) and still locked.
  var audioHint = $('audioHint');
  function audioLocked() { return !audioCtx || audioCtx.state !== 'running'; }
  function reflectAudioLock() {
    if (!audioHint) return;
    audioHint.hidden = muted || !audioLocked();
  }
  // Browsers block audio until a user gesture — unlock on the first interaction.
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(reflectAudioLock, function () {});
      }
    } catch (e) { audioCtx = null; }
    reflectAudioLock();
  }
  ['click', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlockAudio, { once: true, passive: true });
  });
  // A short, soft two-note chime via Web Audio (no asset file needed).
  function playChime() {
    if (muted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t0 = audioCtx.currentTime;
      [[880.0, 0], [1174.66, 0.12]].forEach(function (pair) {
        var freq = pair[0], at = pair[1];
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.35);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t0 + at); osc.stop(t0 + at + 0.4);
      });
    } catch (e) { /* audio unavailable — silent */ }
  }

  /* ───────────── toast ───────────── */
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 3200);
  }

  /* ───────────── tickers ───────────── */
  setInterval(function () { if (hasActiveSession() && !dashView.hidden) updateAges(); }, 15000);     // freshen "X min ago" labels
  setInterval(function () { if (hasActiveSession() && !dashView.hidden) refresh(); }, REFRESH_MS);    // 25s auto-refresh

  /* ───────────── boot ───────────── */
  function init() {
    initTheme();
    initMute();
    if (EMBED) {
      // Embedded in the admin panel: reuse the admin JWT, skip the login UI.
      document.body.classList.add('is-embed');
      window.addEventListener('message', onEmbedMessage);   // accept deep-links from the admin dashboard
      if (activeToken()) showDashboard();
      else if (queue) { dashView.hidden = false; loginView.hidden = true; queue.innerHTML = '<div class="queue-empty">Open the dispatch board from the admin panel.</div>'; }
      return;
    }
    var s = getSession();
    if (s && s.token) {
      // A tab left open past the idle window should not silently resume.
      if (Date.now() - (s.lastActivity || s.createdAt || 0) > IDLE_MS) { logout('idle'); return; }
      lastActivity = s.lastActivity || Date.now();
      showDashboard();
    } else {
      showLogin();
    }
  }
  init();
})();

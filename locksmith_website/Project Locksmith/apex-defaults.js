/* ============================================================================
   apex-defaults.js — canonical seed / default data for admin-managed content.
   ----------------------------------------------------------------------------
   Loaded in BOTH the public site (index.html) and the admin panel (admin.html),
   before content-patch.js / admin-store.js. This is the single source of the
   "factory" content so:
     • the admin can SEED its editors when no override has been saved yet, and
     • the public site can FALL BACK to it if needed.

   When the admin saves an override, it is stored in localStorage under the
   matching apex_admin_*_v1 key and takes precedence over these defaults.
   // TODO: rename apex_admin_*_v1 → acme_admin_*_v1 once old localStorage data is no longer needed.

   TODO: replace with backend API call (fetch published content from server)
   ============================================================================ */
(function () {
  'use strict';

  // Per-card decorative icons, captured verbatim from the original markup so a
  // data-driven re-render preserves the exact look. New cards get DEFAULT_ICON.
  var ICONS = {
    phone:   '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27E0F5" stroke-width="2.2"><path d="M5 3h4l2 5-2 2a12 12 0 005 5l2-2 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/></svg>',
    house:   '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27E0F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 9.77806V16.2C19 17.8801 19 18.7202 18.673 19.3619C18.3854 19.9264 17.9265 20.3854 17.362 20.673C16.7202 21 15.8802 21 14.2 21H9.8C8.11984 21 7.27976 21 6.63803 20.673C6.07354 20.3854 5.6146 19.9264 5.32698 19.3619C5 18.7202 5 17.8801 5 16.2V9.7774M21 12L15.5668 5.96393C14.3311 4.59116 13.7133 3.90478 12.9856 3.65138C12.3466 3.42882 11.651 3.42887 11.0119 3.65153C10.2843 3.90503 9.66661 4.59151 8.43114 5.96446L3 12M14 12C14 13.1045 13.1046 14 12 14C10.8954 14 10 13.1045 10 12C10 10.8954 10.8954 9.99996 12 9.99996C13.1046 9.99996 14 10.8954 14 12Z"/></svg>',
    building:'<svg width="32" height="32" viewBox="0 0 24 24" fill="#27E0F5" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 4C4.44772 4 4 4.44772 4 5V19C4 19.5523 4.44772 20 5 20H12H13C13.5523 20 14 19.5523 14 19V5C14 4.44772 13.5523 4 13 4H5ZM5 22H12H13H19C20.6569 22 22 20.6569 22 19V9C22 7.34315 20.6569 6 19 6H16V5C16 3.34315 14.6569 2 13 2H5C3.34315 2 2 3.34315 2 5V19C2 20.6569 3.34315 22 5 22ZM19 20H15.8293C15.9398 19.6872 16 19.3506 16 19V8H19C19.5523 8 20 8.44772 20 9V19C20 19.5523 19.5523 20 19 20ZM7 14H5V16H7V14ZM8 14H10V16H8V14ZM13 14H11V16H13V14ZM17 14H19V16H17V14ZM19 10H17V12H19V10ZM5 10H7V12H5V10ZM10 10H8V12H10V10ZM11 10H13V12H11V10ZM7 6H5V8H7V6ZM8 6H10V8H8V6ZM13 6H11V8H13V6Z"/></svg>',
    car:     '<svg width="32" height="32" viewBox="0 0 24 24" fill="#27E0F5" aria-hidden="true"><path d="M6.5 12a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3m11 0a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3"/><path d="m20.77 9.16l-1.37-4.1a2.99 2.99 0 0 0-2.85-2.05H7.44a3 3 0 0 0-2.85 2.05l-1.37 4.1c-.72.3-1.23 1.02-1.23 1.84v5c0 .74.41 1.38 1 1.72V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2h12v2c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2.28a2 2 0 0 0 1-1.72v-5c0-.83-.51-1.54-1.23-1.84ZM7.44 5h9.12a1 1 0 0 1 .95.68L18.62 9H5.39L6.5 5.68A1 1 0 0 1 7.45 5ZM4 16v-5h16v5z"/></svg>',
    padlock: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27E0F5" stroke-width="2.2"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    safe:    '<svg width="32" height="32" viewBox="0 0 24 24" fill="#27E0F5" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.9426 1.25H12.0574C14.3658 1.24999 16.1748 1.24998 17.5863 1.43975C19.031 1.63399 20.1711 2.03933 21.0659 2.93414C21.9607 3.82895 22.366 4.96897 22.5603 6.41371C22.75 7.82519 22.75 9.63423 22.75 11.9426V12.0574C22.75 14.3658 22.75 16.1748 22.5603 17.5863C22.366 19.031 21.9607 20.1711 21.0659 21.0659C20.1711 21.9607 19.031 22.366 17.5863 22.5603C16.1748 22.75 14.3658 22.75 12.0574 22.75H11.9426C9.63423 22.75 7.82519 22.75 6.41371 22.5603C4.96897 22.366 3.82895 21.9607 2.93414 21.0659C2.03933 20.1711 1.63399 19.031 1.43975 17.5863C1.24998 16.1748 1.24999 14.3658 1.25 12.0574V11.9426C1.24999 9.63423 1.24998 7.82519 1.43975 6.41371C1.63399 4.96897 2.03933 3.82895 2.93414 2.93414C3.82895 2.03933 4.96897 1.63399 6.41371 1.43975C7.82519 1.24998 9.63423 1.24999 11.9426 1.25ZM6.61358 2.92637C5.33517 3.09825 4.56445 3.42514 3.9948 3.9948C3.42514 4.56445 3.09825 5.33517 2.92637 6.61358C2.75159 7.91356 2.75 9.62178 2.75 12C2.75 14.3782 2.75159 16.0864 2.92637 17.3864C3.09825 18.6648 3.42514 19.4355 3.9948 20.0052C4.56445 20.5749 5.33517 20.9018 6.61358 21.0736C7.91356 21.2484 9.62178 21.25 12 21.25C14.3782 21.25 16.0864 21.2484 17.3864 21.0736C18.6648 20.9018 19.4355 20.5749 20.0052 20.0052C20.5749 19.4355 20.9018 18.6648 21.0736 17.3864C21.2484 16.0864 21.25 14.3782 21.25 12C21.25 9.62178 21.2484 7.91356 21.0736 6.61358C20.9018 5.33517 20.5749 4.56445 20.0052 3.9948C19.4355 3.42514 18.6648 3.09825 17.3864 2.92637C16.0864 2.75159 14.3782 2.75 12 2.75C9.62178 2.75 7.91356 2.75159 6.61358 2.92637ZM6 6.25C6.41421 6.25 6.75 6.58579 6.75 7L6.75 17C6.75 17.4142 6.41421 17.75 6 17.75C5.58579 17.75 5.25 17.4142 5.25 17L5.25 7C5.25 6.58579 5.58579 6.25 6 6.25ZM9.46967 7.46967C9.76256 7.17678 10.2374 7.17678 10.5303 7.46967L11.932 8.8713C12.5248 8.47866 13.2357 8.25 14 8.25C14.7643 8.25 15.4752 8.47866 16.068 8.8713L17.4697 7.46967C17.7626 7.17678 18.2374 7.17678 18.5303 7.46967C18.8232 7.76256 18.8232 8.23744 18.5303 8.53033L17.1287 9.93196C17.5213 10.5248 17.75 11.2357 17.75 12C17.75 12.7643 17.5213 13.4752 17.1287 14.068L18.5303 15.4697C18.8232 15.7626 18.8232 16.2374 18.5303 16.5303C18.2374 16.8232 17.7626 16.8232 17.4697 16.5303L16.068 15.1287C15.4752 15.5213 14.7643 15.75 14 15.75C13.2357 15.75 12.5248 15.5213 11.932 15.1287L10.5303 16.5303C10.2374 16.8232 9.76256 16.8232 9.46967 16.5303C9.17678 16.2374 9.17678 15.7626 9.46967 15.4697L10.8713 14.068C10.4787 13.4752 10.25 12.7643 10.25 12C10.25 11.2357 10.4787 10.5248 10.8713 9.93196L9.46967 8.53033C9.17678 8.23744 9.17678 7.76256 9.46967 7.46967ZM14 9.75C12.7574 9.75 11.75 10.7574 11.75 12C11.75 13.2426 12.7574 14.25 14 14.25C15.2426 14.25 16.25 13.2426 16.25 12C16.25 10.7574 15.2426 9.75 14 9.75Z"/></svg>',
    camera:  '<svg width="32" height="32" viewBox="0 0 256 256" style="color:#27E0F5;" aria-hidden="true"><path fill="currentColor" d="M248 136a8 8 0 0 0-8 8v16h-44.69L177 141.66l50.34-50.35a16 16 0 0 0 0-22.62l-56-56a16 16 0 0 0-22.63 0L2.92 158.94A10 10 0 0 0 10 176h39.37l35.32 35.31a16 16 0 0 0 22.62 0L165.66 153L184 171.31a15.86 15.86 0 0 0 11.31 4.69H240v16a8 8 0 0 0 16 0v-48a8 8 0 0 0-8-8M160 24l12.69 12.69L49.37 160H24.46ZM96 200l-32-32L184 48l32 32Z"/></svg>'
  };

  // Default icon for admin-created cards (generic key).
  var DEFAULT_ICON = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27E0F5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/></svg>';

  // Placeholder image for a new card before the admin uploads/links one.
  var PLACEHOLDER_IMG = 'https://placehold.co/600x800/1A1A1A/27E0F5?text=ACME';

  window.ACME_DEFAULTS = {
    DEFAULT_ICON: DEFAULT_ICON,
    PLACEHOLDER_IMG: PLACEHOLDER_IMG,

    // ── Services carousel (the 8th, "HELP" CTA card is a fixed template, not data) ──
    carousel: [
      { id: 'c1', badge: '~15 MIN', title: '24/7 Emergency Lockouts',     desc: 'Home, office, car. 15-minute average response across Toronto & GTA.',                          image: 'upscaledimages/24emergency.webp',     icon: ICONS.phone },
      { id: 'c2', badge: 'SAME DAY', title: 'Residential Rekey & Install', desc: 'Rekey existing locks, install deadbolts, smart locks, mortise sets.',                          image: 'upscaledimages/residental.webp',      icon: ICONS.house },
      { id: 'c3', badge: 'SAME DAY', title: 'Commercial & Business',       desc: 'Master key systems, panic bars, high-security restricted keyways.',                          image: 'upscaledimages/commercial.webp',      icon: ICONS.building },
      { id: 'c4', badge: '~15 MIN', title: 'Automotive',                   desc: 'Car/truck lockouts, key programming, key cuts, ignition repair, protected vehicles and semi trailers.', image: 'brand_assets/carkey.jpg',         icon: ICONS.car },
      { id: 'c5', badge: 'BY APPT', title: 'Smart Locks & Access',         desc: 'Z-Wave, keypad, biometric. Integration with existing security.',                             image: 'upscaledimages/padlock.webp',         icon: ICONS.padlock },
      { id: 'c6', badge: 'SAME DAY', title: 'Safes — Open, Move, Install', desc: 'Combination recovery, electronic safe opening, in-floor installs.',                           image: 'upscaledimages/safe.webp',            icon: ICONS.safe },
      { id: 'c7', badge: 'SAME DAY', title: 'Security Systems',            desc: 'Camera installation, access control, and full security system setup for homes and businesses.', image: 'upscaledimages/securitycamera.webp', icon: ICONS.camera }
    ],

    // ── Reviews ──
    reviews: [
      { id: 'r1', name: 'Dana R.',  rating: 5, text: 'Got locked out at 11pm with my dog inside. Tech was at my door in 14 minutes flat and had me back in within 5 more. Clean job, no damage to the lock, fair price. Saved as a contact.' },
      { id: 'r2', name: 'Eli K.',   rating: 5, text: 'Had Acme rekey the whole house after closing. Marcus walked through every door and recommended swapping two deadbolts that were past their service life. No upsell pressure. Two-year warranty on the work.' },
      { id: 'r3', name: 'Priya S.', rating: 5, text: 'Used them for our coffee shop — master key system across four doors plus a safe combination change. Took maybe 90 minutes. Receipt was exactly the quote.' }
    ],

    // ── Business info ──────────────────────────────────────────────────────
    //   Derived from site-config.js (window.SITE_CONFIG) — THE single source of
    //   truth — so phone/email/hours stay in sync with the SEO/schema output.
    //   Falls back to literals if site-config.js failed to load. The admin
    //   "Business Info" panel can still override these at runtime.
    business: (function () {
      var S = window.SITE_CONFIG || {};
      var p = S.phone || {};
      var h = S.hours || {};
      return {
        phoneTel:     p.tel     || '+15550101234',       // tel:/sms: hrefs (E.164)
        phoneDisplay: p.display || '(555) 010-1234',     // visible text
        whatsapp:     p.whatsapp || '15550101234',       // digits only, for wa.me
        email:        S.email   || 'dispatch@acmeservices.example',
        addressLine1: '',                                 // no physical storefront
        addressLine2: S.areaSummary || 'Toronto & the GTA',
        hoursDispatch: h.dispatchLabel || '24/7',
        hoursShop:     h.daysLabel     || 'Open 365 days a year'
      };
    })(),

    // ── Service finder (mirror of PLANS in app.js; categories are fixed) ──
    services: {
      home: [
        'Break-in Repair', 'Broken Key/Lock', 'Smart Lock', 'Garage Door', 'Rekey',
        { main: 'Lockouts', sub: 'House, Apartment, Condo, Cars, Safes, Padlock, Mailbox' },
        { main: 'Installation', sub: 'High Security Locks, Smart Locks, Multipoint Locks, Deadbolts, Cylinders, Handles, Master Key' }
      ],
      car: ['Car/Truck Lockout', 'Protected Vehicle', 'Semi Trailer', 'Key Programming', 'Key Cuts', 'Ignition'],
      office: [
        'Break-in Repair', 'Store Lockout', 'Office Lockout', 'Gates Lockout', 'Access Control',
        { main: 'Installation', sub: 'High Security Locks, Smart Locks, Access Point, Mortise Locks, Push Bar, Cylinders, Handles, Door Opener, Master Key' }
      ],
      safe: ['Combination Locks', 'Keypad Locks', 'Key Locks', 'Safe Installation'],
      security: ['Security Camera Installation', 'Security System Setup', 'Camera Maintenance', 'Access Control Systems', 'Smart Home System']
    },

    // Display labels for the fixed service-finder categories.
    serviceLabels: {
      home: 'House / Apt',
      car: 'Car / Truck',
      office: 'Office / Commercial',
      safe: 'Safes',
      security: 'Security / Camera'
    }
  };
})();



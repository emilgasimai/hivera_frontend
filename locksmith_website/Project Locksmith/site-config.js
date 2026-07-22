/* ============================================================================
   site-config.js — ⭐ THE SINGLE SOURCE OF TRUTH for all business + SEO data.
   ----------------------------------------------------------------------------
   ▶▶ THIS IS THE ONE PLACE TO EDIT when the phone, email, domain, areas served,
      hours, or business name change. Everything else is derived from here:

        • <title>, meta description, canonical, robots   → seo.js (injected)
        • Open Graph + Twitter Card tags                 → seo.js (injected)
        • Schema.org JSON-LD (LocalBusiness + Services)  → seo.js (injected)
        • Footer service-area list + copyright year      → seo.js (injected)
        • Runtime phone / email / hours on the page      → apex-defaults.js reads
          SITE_CONFIG and feeds content-patch.js's data-biz-* / data-content-key

   ⚠️  TWO static files cannot read JavaScript and must be edited BY HAND when the
      DOMAIN changes (they only need the base URL, nothing else):
        • sitemap.xml   → the <loc> URL
        • robots.txt    → the "Sitemap:" line
      (Search "baseUrl" below — that value is mirrored into those two files.)

   Loaded FIRST and SYNCHRONOUSLY in <head> (before seo.js), so the SEO output is
   present in the DOM as early as possible for crawlers. Plain global, no build step.
   ============================================================================ */
(function () {
  'use strict';

  window.SITE_CONFIG = {

    /* ── IDENTITY ──────────────────────────────────────────────────────────── */
    name: 'Acme Services',
    legalName: 'Acme Services',
    foundingDate: '2022',            // year established
    priceRange: '$$',                // Google "price level" hint, not a real price

    /* ── CONTACT (changeable) ──────────────────────────────────────────────── */
    phone: {
      tel: '+15550101234',           // E.164, used in tel:/sms: hrefs + schema telephone
      display: '(555) 010-1234',     // human-visible text
      whatsapp: '15550101234'        // digits only, for wa.me links
    },
    email: 'dispatch@acmeservices.example',

    /* ── WEB (changeable: update sitemap.xml + robots.txt too on domain change) ── */
    baseUrl: 'https://acmeservices.example',   // NO trailing slash

    /* ── LOCATION ──────────────────────────────────────────────────────────────
       Mobile locksmith — NO public storefront / walk-ins. The registered business
       address below is emitted in the LocalBusiness JSON-LD for Google verification
       ONLY; it is intentionally NOT shown on the public page (no "visit us here").
       Service is otherwise described at city level + service area. ─────────────── */
    address: {
      street: '100 Example Street',
      locality: 'Etobicoke',
      region: 'ON',                  // ISO 2-letter for schema addressRegion
      regionName: 'Ontario',
      postalCode: 'A1A 1A1',
      country: 'CA'
    },
    geo: { lat: 43.6532, lng: -79.3832 },   // Toronto city centre (service-area anchor)

    /* Cities explicitly served (drives footer list + schema areaServed). */
    areasServed: [
      'Downtown Toronto', 'North York', 'Scarborough', 'Etobicoke',
      'Mississauga', 'Vaughan', 'Richmond Hill', 'Markham', 'Brampton'
    ],
    areasServedSuffix: '+ All GTA Locations',   // appended after the city list
    areaSummary: 'Toronto & the Greater Toronto Area',

    /* ── HOURS ─────────────────────────────────────────────────────────────── */
    hours: {
      is24x7: true,                  // true → schema emits 00:00–23:59 all 7 days
      dispatchLabel: '24/7',
      daysLabel: 'Open 365 days a year'
    },

    /* ── SOCIAL PROFILES (schema sameAs) ───────────────────────────────────────
       Add real profile URLs here as they go live (Google Business Profile,
       Facebook, Instagram, etc.). Empty = none emitted. ───────────────────────── */
    social: [],

    /* ── SERVICES (drives Service JSON-LD) ─────────────────────────────────────
       Truthful service list — mirrors the on-page services. No fake claims. ──── */
    services: [
      { name: 'Emergency Lockout Service', serviceType: 'Emergency lockout',
        desc: '24/7 emergency lockout service for homes, offices and vehicles across Toronto & the GTA — non-destructive entry, ~15-minute average response.' },
      { name: 'Lock Rekey & Installation', serviceType: 'Lock rekey and installation',
        desc: 'Residential rekeying, deadbolt and high-security lock installation, and lock repairs.' },
      { name: 'Commercial & Business Locksmith', serviceType: 'Commercial locksmith',
        desc: 'Master key systems, panic/push bars, access control and restricted high-security keyways for businesses.' },
      { name: 'Automotive Locksmith', serviceType: 'Automotive locksmith',
        desc: 'Car and truck lockouts, transponder key programming, key cutting and ignition repair.' },
      { name: 'Safe Opening & Installation', serviceType: 'Safe locksmith',
        desc: 'Safe opening, combination recovery, electronic safe service, moving and installation.' },
      { name: 'Smart Locks & Keyless Entry', serviceType: 'Smart lock installation',
        desc: 'Keypad, Z-Wave and biometric smart-lock supply, installation and integration.' },
      { name: 'Security Systems & Cameras', serviceType: 'Security system installation',
        desc: 'Security camera installation, access control and full security-system setup for homes and businesses.' }
    ],

    /* ── SEO COPY (editorial) ──────────────────────────────────────────────────
       title / description are applied by seo.js. index.html also carries a literal
       <title> + <meta description> as a no-JS fallback — keep them roughly in sync,
       but THIS is the authoritative copy. ───────────────────────────────────── */
    seo: {
      title: 'Acme Services — 24/7 Emergency Locksmith Toronto & GTA',
      description: 'Acme Services — fast, 24/7 mobile locksmith for Toronto & the GTA. Emergency lockouts, car lockouts, rekeys, lock installation, commercial, automotive, safes and smart locks. Non-destructive entry, ~15-min response. Call (555) 010-1234.',
      keywords: 'locksmith Toronto, emergency locksmith Toronto, 24/7 locksmith GTA, car lockout Toronto, rekey Toronto, commercial locksmith, automotive locksmith, smart locks, safe opening',
      // Dedicated 1200×630 social-share card (regenerate with `node make-og.mjs`).
      ogImage: 'brand_assets/og-image.jpg',  // resolved to an absolute URL by seo.js
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageType: 'image/jpeg',
      locale: 'en_CA',
      localeAlt: 'fr_CA'
    }
  };
})();

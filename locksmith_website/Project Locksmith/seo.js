/* ============================================================================
   seo.js — derives ALL SEO output from window.SITE_CONFIG (site-config.js).
   ----------------------------------------------------------------------------
   Do NOT hardcode business values here. Everything below is read from
   SITE_CONFIG so editing site-config.js updates the whole SEO surface:
     • <title> + meta description / keywords / robots / author
     • canonical + locale
     • Open Graph + Twitter Card tags
     • Schema.org JSON-LD  (@graph: Locksmith/LocalBusiness + Service nodes)
     • footer service-area list + copyright year (on DOMContentLoaded)

   Loaded SYNCHRONOUSLY in <head> immediately after site-config.js so the meta +
   JSON-LD land in the DOM early. Googlebot renders JS and reads injected JSON-LD.
   No AggregateRating/Review schema — reviews are placeholder; faking ratings
   violates Google policy.
   ============================================================================ */
(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  if (!C) { return; }  // config missing — degrade silently

  var head = document.head || document.getElementsByTagName('head')[0];

  /* ── helpers ────────────────────────────────────────────────────────────── */
  function abs(path) {
    if (!path) return C.baseUrl + '/';
    if (/^https?:\/\//i.test(path)) return path;
    return C.baseUrl.replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
  }
  // Create-or-update a <meta>. `sel` finds an existing tag; `attrs` is written.
  function meta(sel, attrs) {
    var el = head.querySelector(sel);
    if (!el) { el = document.createElement('meta'); head.appendChild(el); }
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]); }
    return el;
  }
  function metaName(name, content) {
    meta('meta[name="' + name + '"]', { name: name, content: content });
  }
  function metaProp(prop, content) {
    meta('meta[property="' + prop + '"]', { property: prop, content: content });
  }
  function link(rel, href) {
    var el = head.querySelector('link[rel="' + rel + '"]');
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); head.appendChild(el); }
    el.setAttribute('href', href);
    return el;
  }

  var homeUrl = C.baseUrl.replace(/\/+$/, '') + '/';
  var ogImg = abs(C.seo && C.seo.ogImage);

  /* ── <title> + primary meta ─────────────────────────────────────────────── */
  if (C.seo && C.seo.title) { document.title = C.seo.title; }
  if (C.seo && C.seo.description) { metaName('description', C.seo.description); }
  if (C.seo && C.seo.keywords) { metaName('keywords', C.seo.keywords); }
  metaName('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  metaName('author', C.name);
  link('canonical', homeUrl);

  /* ── Open Graph ─────────────────────────────────────────────────────────── */
  metaProp('og:type', 'website');
  metaProp('og:site_name', C.name);
  metaProp('og:title', (C.seo && C.seo.title) || C.name);
  metaProp('og:description', (C.seo && C.seo.description) || '');
  metaProp('og:url', homeUrl);
  metaProp('og:image', ogImg);
  metaProp('og:image:alt', C.name + ' — 24/7 locksmith, ' + (C.areaSummary || 'Toronto & GTA'));
  if (C.seo && C.seo.ogImageType)   { metaProp('og:image:type', C.seo.ogImageType); }
  if (C.seo && C.seo.ogImageWidth)  { metaProp('og:image:width', String(C.seo.ogImageWidth)); }
  if (C.seo && C.seo.ogImageHeight) { metaProp('og:image:height', String(C.seo.ogImageHeight)); }
  if (C.seo && C.seo.locale) { metaProp('og:locale', C.seo.locale); }
  if (C.seo && C.seo.localeAlt) { metaProp('og:locale:alternate', C.seo.localeAlt); }

  /* ── Twitter Card ───────────────────────────────────────────────────────── */
  metaName('twitter:card', 'summary_large_image');
  metaName('twitter:title', (C.seo && C.seo.title) || C.name);
  metaName('twitter:description', (C.seo && C.seo.description) || '');
  metaName('twitter:image', ogImg);

  /* ── Schema.org JSON-LD (LocalBusiness/Locksmith + Services) ─────────────── */
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  var business = {
    '@type': 'Locksmith',
    '@id': homeUrl + '#business',
    'name': C.name,
    'url': homeUrl,
    'telephone': C.phone && C.phone.tel,
    'email': C.email,
    'image': ogImg,
    'logo': ogImg,
    'priceRange': C.priceRange || '$$',
    'foundingDate': C.foundingDate,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': C.address && C.address.street,
      'addressLocality': C.address && C.address.locality,
      'addressRegion': C.address && C.address.region,
      'postalCode': C.address && C.address.postalCode,
      'addressCountry': C.address && C.address.country
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': C.geo && C.geo.lat,
      'longitude': C.geo && C.geo.lng
    },
    'areaServed': (C.areasServed || []).map(function (city) {
      return { '@type': 'City', 'name': city };
    }),
    'openingHoursSpecification': [{
      '@type': 'OpeningHoursSpecification',
      'dayOfWeek': DAYS,
      'opens': '00:00',
      'closes': '23:59'
    }]
  };
  if (C.social && C.social.length) { business.sameAs = C.social.slice(); }

  var services = (C.services || []).map(function (s) {
    return {
      '@type': 'Service',
      'name': s.name,
      'serviceType': s.serviceType || s.name,
      'description': s.desc,
      'provider': { '@id': homeUrl + '#business' },
      'areaServed': { '@type': 'AdministrativeArea', 'name': C.areaSummary || 'Toronto & the Greater Toronto Area' }
    };
  });

  var graph = { '@context': 'https://schema.org', '@graph': [business].concat(services) };

  var ld = head.querySelector('#ld-json-business');
  if (!ld) {
    ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'ld-json-business';
    head.appendChild(ld);
  }
  ld.textContent = JSON.stringify(graph);

  /* ── Footer: service-area list + copyright year (single-sourced) ─────────── */
  function fillFooter() {
    var areas = document.getElementById('footerAreas');
    if (areas) {
      var list = (C.areasServed || []).join(' · ');
      if (C.areasServedSuffix) { list += ' · ' + C.areasServedSuffix; }
      areas.textContent = list;
    }
    var year = document.getElementById('copyYear');
    if (year) { year.textContent = String(new Date().getFullYear()); }
    var nm = document.querySelectorAll('[data-biz-name]');
    for (var i = 0; i < nm.length; i++) { nm[i].textContent = C.name; }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillFooter);
  } else {
    fillFooter();
  }
})();

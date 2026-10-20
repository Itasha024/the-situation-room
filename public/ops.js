/*
 * The map-first view (user, 19 Oct): the desks' own pages, laid out round the map, with the tools an
 * operations room and a newsroom use. It is a layer: <html data-view="ops"> turns it on (src/lib/ops-view.ts);
 * without it the pages are the classic site, untouched. Everything on the page is still app.js's and
 * home.js's own (pins, notes, legends, the time filter, the feed, the brief, the numbers); this file only
 * moves those parts into the new frame and adds:
 * - a rail of tabs on the left (the brief, the fronts or arenas, the numbers, the timeline), the reports
 *   on the right, both folding away;
 * - a dock under the map: the time filter, Who and What, the last 48 hours side by side (drag across
 *   them to light only those hours' pins) and the log of the latest events;
 * - on the map: the place under the pointer in degrees and MGRS, a scale, a small overview map, a ruler
 *   (distance in km and nautical miles, bearing), range rings, a link to the view, full screen;
 * - live traffic: every aircraft over the region (military marked), ships when the server has their feed;
 * - new events as they come in, flagged on the map; Space goes to the latest; a broadcast mode for screens;
 * - keys for all of it (? lists them).
 */
(function () {
  'use strict';
  // Once a page (a copy of this script loaded twice would lay the page out twice).
  if (window.__opsView) return;
  window.__opsView = true;
  const H = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // app.js's names (its top-level script names are shared with this script).
  const app = (name) => { try { return eval(name); } catch (e) { return null; } };
  const A = (name) => app(name) || (() => null);
  const setView = (v) => { try { localStorage.setItem('desk-view', v); } catch (e) { /* private */ } };

  /* The classic site: only a way into the new view, in the site menu. */
  if (H.dataset.view !== 'ops') {
    const add = () => {
      const ul = $('#site-menu .sm-panel ul');
      if (!ul) return false;
      if (!$('#site-menu .sm-ops')) {
        const li = document.createElement('li');
        li.innerHTML = '<a class="sm-desk sm-ops" href="?view=ops"><span class="sm-t"><b>Map view</b><small>The new map-first layout</small></span></a>';
        ul.appendChild(li);
      }
      return true;
    };
    let n = 0;
    const t = setInterval(() => { if (add() || ++n > 60) clearInterval(t); }, 500);
    return;
  }

  /* ---------- Which page ---------- */
  let root = null, PAGE = null;
  const findRoot = () => {
    const d = document.getElementById('yemen-desk-root');
    if (d && d.querySelector('#map')) { root = d; PAGE = d.dataset.desk === 'iran' ? 'iran' : 'yemen'; return true; }
    const h = document.getElementById('home-root');
    if (h && h.querySelector('#h-map') && window.__home) { root = h; PAGE = 'all'; return true; }
    return false;
  };
  const isPhone = () => matchMedia('(max-width:760px)').matches;
  const TZ = { iran: 'Asia/Tehran', yemen: 'Asia/Aden' };
  const CAP = { iran: 'Tehran', yemen: 'Sanaa' };

  /* ---------- Small helpers ---------- */
  const ICON = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 15.5v-1.7l-7.6-4.6V4.1a1.4 1.4 0 0 0-2.8 0v5.1L3 13.8v1.7l7.6-2.3v5l-2 1.5V21l3.4-.9 3.4.9v-1.3l-2-1.5v-5z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2.5h2v3.2h3.4v5.6l3.2 1.1-2.4 5.6H6.8l-2.4-5.6 3.2-1.1V5.7H11zM3 20.2c1.5 0 1.5.9 3 .9s1.5-.9 3-.9 1.5.9 3 .9 1.5-.9 3-.9 1.5.9 3 .9 1.5-.9 3-.9v1.6c-1.5 0-1.5.9-3 .9s-1.5-.9-3-.9-1.5.9-3 .9-1.5-.9-3-.9-1.5.9-3 .9-1.5-.9-3-.9z"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7 13l2 2M9.5 10.5l1.4 1.4M12 8l2 2M14.5 5.5l1.4 1.4"/></svg>',
    rings: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="9.4" stroke-dasharray="2.4 2.2"/></g></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
    cast: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/></g><circle cx="7" cy="8.5" r="1.6" fill="currentColor"/></svg>',
    theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="currentColor" d="M12 3.5a8.5 8.5 0 0 1 0 17z"/></svg>',
    keys: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="6" width="19" height="12" rx="1.6"/><path stroke-linecap="round" d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/></g></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5 9l7 7 7-7"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></g></svg>',
  };
  const hm = (t, tz) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
  const dm = (t, tz) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz });
  const VIEW_TZ = () => (PAGE && TZ[PAGE]) || undefined;
  const ago = (t) => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

  /* Degrees and MGRS (WGS84, UTM), for the place under the pointer and for every event. */
  function mgrs(lat, lon) {
    if (!(lat > -80 && lat < 84)) return '';
    let zone = Math.floor((lon + 180) / 6) + 1;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
    if (lat >= 72) zone = lon < 9 ? 31 : lon < 21 ? 33 : lon < 33 ? 35 : lon < 42 ? 37 : zone;
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const phi = (lat * Math.PI) / 180, lam = (lon * Math.PI) / 180, lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
    const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
    const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, Ax = c * (lam - lam0);
    const M = a * ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * phi - ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) + ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
    const E = k0 * N * (Ax + ((1 - T + C) * Ax ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Ax ** 5) / 120) + 500000;
    let Nn = k0 * (M + N * t * ((Ax * Ax) / 2 + ((5 - T + 9 * C + 4 * C * C) * Ax ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Ax ** 6) / 720));
    if (lat < 0) Nn += 10000000;
    const band = 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)];
    const set = ((zone - 1) % 6) + 1;
    const col = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'][(set - 1) % 3][Math.floor(E / 100000) - 1];
    let row = Math.floor(Nn / 100000) % 20;
    if (set % 2 === 0) row = (row + 5) % 20;
    const p5 = (v) => String(Math.floor(v % 100000)).padStart(5, '0');
    return `${zone}${band} ${col}${'ABCDEFGHJKLMNPQRSTUV'[row]} ${p5(E)} ${p5(Nn)}`;
  }
  const deg = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
  const latlon = (lat, lng) => `${deg(lat, 'N', 'S')}, ${deg(lng, 'E', 'W')}`;
  const R_KM = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  function distKm(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_KM * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  const kmTxt = (km) => `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('en-GB')} km · ${(km / 1.852 < 10 ? (km / 1.852).toFixed(1) : Math.round(km / 1.852).toLocaleString('en-GB'))} nm`;
  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* refused */ }
    if (btn) { const was = btn.dataset.tip || ''; btn.dataset.tip = ok ? 'Copied' : text; btn.classList.add('tipped'); setTimeout(() => { btn.classList.remove('tipped'); btn.dataset.tip = was; }, 1600); }
    return ok;
  }

  /* ---------- The map and its events, whichever page ---------- */
  const getMap = () => (PAGE === 'all' ? window.__home && window.__home.map : app('map'));
  /** The events the page has, each with its desk. */
  function events() {
    if (PAGE === 'all') { const h = window.__home; return h && h.D ? h.D.events.filter((e) => !e.researched) : []; }
    if (PAGE === 'iran') { const p = app('iranPins'); return p && p.events ? p.events.filter((e) => !e.researched).map((e) => (e.desk ? e : Object.assign(e, { desk: 'iran' }))) : []; }
    const d = app('data');
    return d && d.events ? d.events.filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number').map((e) => (e.desk ? e : Object.assign(e, { desk: 'yemen' }))) : [];
  }
  const keyOf = (e) => `${e.desk}|${e.fp}`;
  /** Who acted, in the colour the desk gives them. */
  function sideOf(e) {
    if (e.desk === 'iran') {
      const k = A('iranSideOf')(e) || 'other';
      const r = (app('IRAN_PIN_SIDES') || []).find((x) => x[0] === k);
      return { name: r ? r[2] : 'Not stated', c: r ? r[1] : '#94a3b8' };
    }
    const k = A('yemenSideOf')(e) || 'unclear';
    const r = (A('YEMEN_PIN_SIDES')() || []).find((x) => x[0] === k);
    return { name: r ? r[2] : 'Not stated', c: r ? r[1] : '#94a3b8' };
  }
  function kindOf(e) {
    if (e.desk === 'iran') { const k = A('iranKindOf')(e) || 'strike'; return { k, name: (app('IRAN_KIND_LABEL') || {})[k] || k }; }
    const k = e.mapCat || e.cat || (A('classifyForMap')(`${e.label || ''} ${e.text || ''}`, String(e.type || '').toLowerCase())) || 'strike';
    return { k, name: (app('CATEGORY_LABEL') || {})[k] || k };
  }
  const glyph = (k) => ((app('EVENT_SVG') || {})[k] || '');
  const noteOf = (e) => (e.desk === 'iran' ? A('iranPopupHtml')(e) : A('popupHtml')(e)) || esc(e.label || '');

  /* ---------- The frame ---------- */
  const S = { left: true, right: true, dock: true, tab: null, rtab: 'rep', ptab: 'map', sel: null, tool: null, cast: false, air: false, airMil: false, airGround: false, sea: false, base: 'auto', names: false, grid: false, fills: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem('ops-state2') || '{}'), { tool: null, sel: null, cast: false }); } catch (e) { /* none kept */ }
  const keep = () => { try { const { left, right, dock, tab, rtab, air, airMil, airGround, sea, base, names, grid, fills } = S; localStorage.setItem('ops-state2', JSON.stringify({ left, right, dock, tab, rtab, air, airMil, airGround, sea, base, names, grid, fills })); } catch (e) { /* private */ } };

  let shell, strip, bar, nav, leftEl, rightEl, dock, stage, mapWrap;
  const NAV_ICON = {
    brief: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8 8h8M8 11.5h8M8 15h5"/></g></svg>',
    fronts: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-1 4-5 7-5s3 4 6 4 3-3 5-4"/><path d="M6 13.5l1.6-2.6M11 9.8V6.8M16 13.6l1.6-2.4"/></g></svg>',
    numbers: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 20v-6M12 20V6M17 20v-9"/></g></svg>',
    timeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 4v16"/><circle cx="6" cy="7" r="1.6" fill="currentColor"/><circle cx="6" cy="13" r="1.6" fill="currentColor"/><path d="M10 7h9M10 13h7M10 18.5h5"/></g></svg>',
    theatres: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z"/></g></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/></g></svg>',
  };
  const LEFT_TABS = {
    yemen: [['situation', 'Brief', 'brief'], ['fronts-wrap', 'Fronts', 'fronts'], ['cas-wrap', 'Numbers', 'numbers'], ['timeline-wrap', 'Timeline', 'timeline']],
    iran: [['situation', 'Brief', 'brief'], ['fronts-wrap', 'Arenas', 'fronts'], ['cas-wrap', 'Numbers', 'numbers'], ['timeline-wrap', 'Timeline', 'timeline']],
    all: [['ops-theatres', 'Theatres', 'theatres']],
  };
  const PAGE_NAME = { all: 'All theatres', iran: 'Iran', yemen: 'Yemen' };
  /* Date-time group, Zulu: 192047Z OCT 26. */
  const dtg = (t) => { const d = new Date(t); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()} ${String(d.getUTCFullYear()).slice(2)}`; };

  function build() {
    root.classList.add('ops-on');
    shell = root;
    // The status strip: live, the time in Zulu and on the desk's clock, the last update, the counts.
    strip = document.createElement('div');
    strip.className = 'ops-strip';
    strip.innerHTML = `<span class="ops-live"><i></i>Live</span>
      <span class="ops-sf"><small>DTG</small><b id="ops-dtg">--</b></span>
      ${PAGE !== 'all' ? `<span class="ops-sf"><small>${esc(CAP[PAGE])}</small><b id="ops-local">--:--</b></span>` : `<span class="ops-sf"><small>Sanaa</small><b data-tz="Asia/Aden">--:--</b></span><span class="ops-sf"><small>Tehran</small><b data-tz="Asia/Tehran">--:--</b></span><span class="ops-sf"><small>Jerusalem</small><b data-tz="Asia/Jerusalem">--:--</b></span>`}
      <span class="ops-sf ops-upd"></span>
      <span class="ops-sf ops-cnt"><small>Events 24 h</small><b id="ops-n24">–</b></span>
      <span class="ops-sf ops-cnt"><small>48 h</small><b id="ops-n48">–</b></span>
      <span class="ops-tag">Open source</span>`;
    // The bar: the name, the theatres, the view's own buttons.
    bar = document.createElement('div');
    bar.className = 'ops-bar';
    const mast = $('.mast', root), top = $('header.top', root);
    if (mast) bar.appendChild(mast);
    if (top) {
      bar.appendChild(top);
      const st = $('.stamp', top);
      if (st) $('.ops-upd', strip).appendChild(st);
    }
    const acts = document.createElement('div');
    acts.className = 'ops-acts';
    acts.innerHTML = `
      <button type="button" class="ops-btn" data-op="layers" aria-expanded="false" title="Layers: base map, aircraft, ships, grid (T)">${NAV_ICON.layers}<span>Layers</span></button>
      <button type="button" class="ops-btn" data-op="traffic" title="Live aircraft and ships (T)">${ICON.plane}<span>Traffic</span></button>
      <button type="button" class="ops-btn ops-ico" data-op="cast" aria-pressed="false" title="Broadcast mode, for screens and TV (B)">${ICON.cast}<span class="sr">Broadcast mode</span></button>
      <button type="button" class="ops-btn ops-ico" data-op="theme" title="Day or night">${ICON.theme}<span class="sr">Day or night</span></button>
      <button type="button" class="ops-btn ops-ico" data-op="keys" title="Keys (?)">${ICON.keys}<span class="sr">Keys</span></button>
      <a class="ops-classic" href="?view=classic" title="The site's classic layout">Classic</a>`;
    bar.appendChild(acts);
    root.insertBefore(bar, root.firstChild);
    root.insertBefore(strip, bar);

    // The tool rail and the left panel: the brief's parts.
    const tabs = LEFT_TABS[PAGE].filter(([id]) => id === 'ops-theatres' || document.getElementById(id));
    nav = document.createElement('nav');
    nav.className = 'ops-nav';
    nav.setAttribute('aria-label', 'Panels');
    nav.innerHTML = tabs.map(([id, n, ic]) => `<button type="button" data-tab="${id}" title="${esc(n)}">${NAV_ICON[ic]}<span>${esc(n)}</span></button>`).join('')
      + `<span class="ops-nav-sp"></span><button type="button" data-op="layers" title="Layers (T)">${NAV_ICON.layers}<span>Layers</span></button>`;
    leftEl = document.createElement('aside');
    leftEl.className = 'ops-left';
    leftEl.innerHTML = `<div class="ops-phead"><h2 class="ops-ptitle"></h2><button type="button" class="ops-fold" data-op="left" title="Close the panel ([)">${ICON.left}</button></div><div class="ops-panes"></div>`;
    const panes = $('.ops-panes', leftEl);
    tabs.forEach(([id]) => {
      let el = document.getElementById(id);
      if (!el) { el = document.createElement('section'); el.id = id; }
      el.classList.add('ops-pane');
      panes.appendChild(el);
    });
    const foot = root.querySelector(':scope > footer');
    if (foot) panes.appendChild(foot);
    if (!tabs.some(([id]) => id === S.tab)) S.tab = tabs[0] && tabs[0][0];
    stage = $('main.stage', root);
    // The stage's own box in the page (the All page keeps it in a wrapper).
    let item = stage;
    while (item.parentNode !== root) item = item.parentNode;
    item.classList.add('ops-stage');
    root.insertBefore(nav, item);
    root.insertBefore(leftEl, item);
    mapWrap = $('.map-wrap', stage);

    // The right panel: the reports, and the events placed on the map.
    rightEl = document.createElement('aside');
    rightEl.className = 'ops-right';
    rightEl.innerHTML = `<div class="ops-phead ops-rtabs"><nav class="ops-tabs" role="tablist"><button type="button" role="tab" data-rtab="rep">Reports</button><button type="button" role="tab" data-rtab="ev">Events <small class="ops-ev-n"></small></button></nav><button type="button" class="ops-fold" data-op="right" title="Close the panel (])">${ICON.right}</button></div>
      <div class="ops-rpane ops-rp-rep"></div>
      <div class="ops-rpane ops-rp-ev"><div class="ops-evf"><input class="ops-q ops-evq" type="search" placeholder="Filter events: a place, a side, a weapon" aria-label="Filter the events"><small class="ops-log-n"></small></div><ol class="ops-log-l"></ol></div>`;
    root.insertBefore(rightEl, item.nextSibling);
    const rail = $('#rail', root);
    if (rail) $('.ops-rp-rep', rightEl).appendChild(rail);
    const split = $('#rail-splitter', root);
    if (split) split.hidden = true;
    if (PAGE === 'all') buildAllRail($('.ops-rp-rep', rightEl));

    // The strip under the map: the time filter, Who and What, the last 48 hours.
    dock = document.createElement('div');
    dock.className = 'ops-dock';
    dock.innerHTML = `<div class="ops-drow ops-dtop"><div class="ops-quick" role="group" aria-label="Show the last"><span>Last</span><button type="button" data-qr="1">24 h</button><button type="button" data-qr="2">48 h</button><button type="button" data-qr="7">7 days</button></div><div class="ops-time"></div><button type="button" class="ops-fold ops-fold-d" data-op="dock" title="Fold the timeline (\\)">${ICON.down}</button></div>
      <div class="ops-drow ops-who"></div>
      <div class="ops-drow ops-mx">
        <div class="ops-act"><div class="ops-act-h"><b>Last 48 hours</b><span class="ops-act-sel" hidden></span><small>Drag across the hours to show only their events</small></div><svg class="ops-amx" role="img" aria-label="Events in the last 48 hours, by side and hour"></svg></div>
      </div>`;
    const tb = $('.toolbar', root);
    if (tb) $('.ops-time', dock).appendChild(tb);
    const legend = $('#legend', root) || $('#h-legend', root);
    if (legend) {
      $('.ops-who', dock).appendChild(legend);
      // Open, always: in the strip it is the Who and What rows (the page draws it again now and then).
      const open = () => { if (legend.classList.contains('collapsed')) { const h = $('.leg-head', legend); if (h) h.click(); } };
      open();
      new MutationObserver(open).observe(legend, { attributes: true, attributeFilter: ['class'], childList: true });
    }
    mapWrap.appendChild(dock);
    // The phone's tabs: the map, then each part of the page.
    const pt = document.createElement('nav');
    pt.className = 'ops-ptabs';
    pt.innerHTML = [['map', 'Map'], ...tabs, ['rail', 'Reports'], ['events', 'Events']].map(([id, n]) => `<button type="button" data-ptab="${id}">${n}</button>`).join('');
    root.insertBefore(pt, bar.nextSibling);
    if (PAGE === 'all') drawTheatres();
    paintFrame();
    if (window.ResizeObserver) new ResizeObserver(sizeDock).observe(dock);
    sizeDock();
    wireFrame();
  }
  /* The last day, two days or week on the map, through the page's own period boxes. */
  const shiftYmd = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function quickRange(days) {
    const per = $('#btn-period', root), from = $('#map-date', root), to = $('#map-to', root), box = $('#tf-range', root);
    if (!per || !from || !to) return false;
    if (box && box.hidden) per.click();
    const end = to.max || to.value;
    if (!end) return false;
    from.value = shiftYmd(end, -(days - 1));
    to.value = end;
    to.dispatchEvent(new Event('change', { bubbles: true }));
    S.qr = days;
    paintQuick();
    return true;
  }
  function paintQuick() {
    const on = $('#btn-period', root) && $('#btn-period', root).classList.contains('on');
    dock.querySelectorAll('[data-qr]').forEach((b) => b.setAttribute('aria-pressed', String(on && +b.dataset.qr === S.qr)));
  }
  function sizeDock() {
    if (!dock) return;
    // The map keeps at least 60% of its box, whatever the strip holds.
    const h = isPhone() || !S.dock ? 0 : Math.min(dock.offsetHeight, Math.round(mapWrap.clientHeight * 0.4));
    mapWrap.style.setProperty('--dock-h', h + 'px');
    const m = getMap();
    if (m) try { m.invalidateSize({ pan: false }); } catch (e) { /* not yet */ }
  }
  function paintFrame() {
    root.classList.toggle('ops-noleft', !S.left);
    root.classList.toggle('ops-noright', !S.right);
    root.classList.toggle('ops-nodock', !S.dock);
    H.classList.toggle('ops-cast', S.cast);
    H.classList.toggle('ops-fills', !!S.fills);
    root.dataset.opsPtab = S.ptab;
    root.dataset.opsRtab = S.rtab;
    nav.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(S.left && b.dataset.tab === S.tab)));
    const cur = LEFT_TABS[PAGE].find(([id]) => id === S.tab);
    $('.ops-ptitle', leftEl).textContent = cur ? cur[1] : '';
    leftEl.querySelectorAll('.ops-pane').forEach((p) => p.classList.toggle('on', p.id === S.tab));
    rightEl.querySelectorAll('[data-rtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rtab === S.rtab)));
    root.querySelectorAll('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === S.ptab)));
    const c = $('[data-op="cast"]', bar); if (c) c.setAttribute('aria-pressed', String(S.cast));
    setTimeout(sizeDock, 30);
    setTimeout(sizeDock, 260);
  }
  function wireFrame() {
    root.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-op],[data-tab],[data-ptab],[data-rtab]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.tab) {
        // The open panel's own button closes it again.
        if (S.left && S.tab === t.dataset.tab && !isPhone()) S.left = false; else { S.tab = t.dataset.tab; S.left = true; }
        keep(); paintFrame(); return;
      }
      if (t.dataset.rtab) { S.rtab = t.dataset.rtab; keep(); paintFrame(); return; }
      if (t.dataset.ptab) {
        const p = t.dataset.ptab;
        S.ptab = p;
        if (LEFT_TABS[PAGE].some(([id]) => id === p)) S.tab = p;
        if (p === 'rail') S.rtab = 'rep';
        if (p === 'events') S.rtab = 'ev';
        paintFrame(); if (p !== 'map') window.scrollTo({ top: 0 }); return;
      }
      const op = t.dataset.op;
      if (op === 'left') { S.left = !S.left; keep(); paintFrame(); }
      else if (op === 'right') { S.right = !S.right; keep(); paintFrame(); }
      else if (op === 'dock') { S.dock = !S.dock; keep(); paintFrame(); }
      else if (op === 'cast') { S.cast = !S.cast; paintFrame(); paintCast(); }
      else if (op === 'keys') toggleKeys();
      else if (op === 'theme') { const set = app('setTheme'), nx = app('nextTheme'); if (set && nx) set(nx(app('THEME'))); }
      else if (op === 'layers') toggleLayers();
      else if (op === 'traffic') { if (!S.air && !S.sea) { S.air = true; S.sea = true; keep(); runTraffic(); } toggleLayers(true); }
    });
    dock.addEventListener('click', (ev) => {
      const q = ev.target.closest('[data-qr]');
      if (q) quickRange(+q.dataset.qr);
      else if (ev.target.closest('.time-filter button')) { S.qr = 0; setTimeout(paintQuick, 50); }
    });
    rightEl.addEventListener('input', (ev) => { if (ev.target.matches('.ops-evq')) { evQ = ev.target.value.trim().toLowerCase(); drawLog(recent()); } });
    // The column edges, to open a closed panel again.
    ['left', 'right'].forEach((side) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `ops-unfold ops-unfold-${side}`; b.dataset.op = side;
      b.title = side === 'left' ? 'Open the panel ([)' : 'Open the reports (])';
      b.innerHTML = side === 'left' ? ICON.right : ICON.left;
      mapWrap.appendChild(b);
    });
    const ud = document.createElement('button');
    ud.type = 'button'; ud.className = 'ops-unfold ops-unfold-dock'; ud.dataset.op = 'dock'; ud.title = 'Open the timeline (\\)';
    ud.innerHTML = `<span>Time · Who and What · Last 48 hours</span>`;
    mapWrap.appendChild(ud);
    addEventListener('resize', () => { sizeDock(); drawMatrix(); });
  }

  /* The All page's reports: both desks', newest first, and Trump's latest (home.js's own cards). */
  let allRail = null, allTab = 'rep', allN = 60, allQ = '';
  function buildAllRail(into) {
    allRail = document.createElement('div');
    allRail.className = 'rail ops-rail';
    allRail.id = 'ops-rail';
    into.appendChild(allRail);
    allRail.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-rt],[data-more]');
      if (!t) return;
      if (t.dataset.rt) { allTab = t.dataset.rt; allN = 60; drawAllRail(); }
      else { allN += 60; drawAllRail(); }
    });
    allRail.addEventListener('input', (ev) => { if (ev.target.matches('.ops-q')) { allQ = ev.target.value.trim().toLowerCase(); allN = 60; drawAllRail(true); } });
    drawAllRail();
  }
  function drawAllRail(listOnly) {
    const h = window.__home;
    if (!allRail || !h) return;
    const all = allTab === 'rep' ? h.D.reports : h.D.trump;
    const list = allQ ? all.filter((r) => `${r.h} ${r.src} ${r.body || ''}`.toLowerCase().includes(allQ)) : all;
    const cards = list.slice(0, allN).map((r) => (allTab === 'rep' ? h.card(r) : h.trumpCard(r))).join('');
    const body = `<div id="feed" class="feed">${cards || '<p class="ops-empty">Nothing here yet.</p>'}</div>${list.length > allN ? '<button type="button" class="more" data-more>Show more</button>' : ''}`;
    if (listOnly && allRail.querySelector('.ops-rbody')) { allRail.querySelector('.ops-rbody').innerHTML = body; return; }
    allRail.innerHTML = `<div class="ops-seg" role="tablist"><button type="button" role="tab" data-rt="rep" aria-selected="${allTab === 'rep'}">All desks</button><button type="button" role="tab" data-rt="tr" aria-selected="${allTab === 'tr'}">Trump’s latest</button></div>
      <input class="ops-q" type="search" placeholder="Filter: a place, a person, a weapon" value="${esc(allQ)}" aria-label="Filter the reports">
      <div class="ops-rbody">${body}</div>`;
  }

  /* The All page's left panel: each theatre at a glance, from the events and reports the page has. */
  const DESK_INFO = { iran: ['Iran', 'Israel, the US, Iran and its allies', '/iran-conflict-desk'], yemen: ['Yemen', 'The Houthis, the government, the coalition, the Red Sea', '/yemen-conflict-desk'] };
  function drawTheatres() {
    const el = document.getElementById('ops-theatres');
    const h = window.__home;
    if (!el || !h || !h.D) return;
    const now = Date.now();
    const ev = events();
    el.innerHTML = Object.entries(DESK_INFO).map(([desk, [name, sub, href]]) => {
      const mine = ev.filter((e) => e.desk === desk);
      const d24 = mine.filter((e) => now - Date.parse(e.at) < 864e5), d48 = mine.filter((e) => now - Date.parse(e.at) < 1728e5);
      const by = new Map();
      d24.forEach((e) => { const s = sideOf(e); const r = by.get(s.name) || { s, n: 0 }; r.n++; by.set(s.name, r); });
      const sides = [...by.values()].sort((a, b) => b.n - a.n);
      const max = Math.max(1, ...sides.map((x) => x.n));
      const reps = (h.D.reports || []).filter((r) => (r.desks || []).includes(desk));
      const lastRep = reps[0];
      const latest = mine.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 5);
      return `<article class="ops-th">
        <header><h3><a href="${href}">${esc(name)}</a></h3><a class="ops-th-go" href="${href}">Open desk ${ICON.right}</a></header>
        <p class="ops-th-sub">${esc(sub)}</p>
        <dl class="ops-kpi"><div><dt>Events 24 h</dt><dd>${d24.length}</dd></div><div><dt>48 h</dt><dd>${d48.length}</dd></div><div><dt>Last report</dt><dd>${lastRep ? esc(ago(lastRep.at).replace(' ago', '')) : '–'}</dd></div></dl>
        ${sides.length ? `<ul class="ops-bars">${sides.map((x) => `<li><span>${esc(x.s.name)}</span><i style="--c:${x.s.c};--w:${Math.round((x.n / max) * 100)}%"></i><b>${x.n}</b></li>`).join('')}</ul>` : '<p class="ops-empty">No events on the map in the last 24 hours.</p>'}
        ${latest.length ? `<ol class="ops-th-ev">${latest.map((e) => `<li><button type="button" data-thev="${esc(keyOf(e))}"><time>${esc(hm(e.at))}</time><span>${esc(e.label || e.place || '')}</span></button></li>`).join('')}</ol>` : ''}
      </article>`;
    }).join('') + `<p class="ops-th-note">Every mark on the map is a report placed where it happened. Open a desk for its brief, fronts, numbers and timeline.</p>`;
    if (!el._wired) {
      el._wired = true;
      el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-thev]'); if (b) { const e = events().find((x) => keyOf(x) === b.dataset.thev); if (e) focusEvent(e); } });
    }
  }

  /* ---------- Clocks ---------- */
  function tick() {
    const now = Date.now();
    const z = document.getElementById('ops-dtg');
    if (z) z.textContent = dtg(now);
    const l = document.getElementById('ops-local');
    if (l && PAGE !== 'all') l.textContent = hm(now, TZ[PAGE]);
    strip && strip.querySelectorAll('[data-tz]').forEach((b) => { b.textContent = hm(now, b.dataset.tz); });
    if (S.cast) paintCast();
  }
  function counts() {
    const now = Date.now(), ev = events();
    const n24 = ev.filter((e) => now - Date.parse(e.at) < 864e5).length, n48 = ev.filter((e) => now - Date.parse(e.at) < 1728e5).length;
    const a = document.getElementById('ops-n24'), b = document.getElementById('ops-n48');
    if (a) a.textContent = n24; if (b) b.textContent = n48;
  }

  /* ---------- On the map: place, scale, overview, ruler, rings, link ---------- */
  let hud = null, coordsEl = null, mini = null, miniBox = null, miniDots = null, toolLayer = null, last = null;
  function buildHud(m) {
    hud = document.createElement('div');
    hud.className = 'ops-hud';
    hud.innerHTML = `
      <div class="ops-tools" role="toolbar" aria-label="Map tools">
        <button type="button" data-tool="ruler" title="Measure: click points, double-click to end (M)">${ICON.ruler}<span class="sr">Measure</span></button>
        <button type="button" data-tool="rings" title="Range rings: click a place (R)">${ICON.rings}<span class="sr">Range rings</span></button>
        <button type="button" data-do="link" title="Copy a link to this view (L)">${ICON.link}<span class="sr">Link to this view</span></button>
        <button type="button" data-do="full" title="Full screen (F)">${ICON.full}<span class="sr">Full screen</span></button>
      </div>
      <div class="ops-tooltip" hidden></div>
      <div class="ops-coords" aria-live="off"><span class="ops-ll">Point at the map</span><span class="ops-mgrs"></span></div>
      <div class="ops-mini" aria-hidden="true"><div class="ops-mini-map"></div></div>
      <div class="ops-toasts" aria-live="polite"></div>
      <div class="ops-card" hidden></div>
      <div class="ops-menu" hidden></div>
      <div class="ops-lower" hidden></div>`;
    mapWrap.appendChild(hud);
    L.DomEvent.disableClickPropagation(hud);
    L.DomEvent.disableScrollPropagation(hud);
    coordsEl = $('.ops-coords', hud);
    try { L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 }).addTo(m); } catch (e) { /* no scale */ }
    m.on('mousemove', (ev) => {
      last = ev.latlng;
      $('.ops-ll', coordsEl).textContent = latlon(ev.latlng.lat, ev.latlng.lng);
      $('.ops-mgrs', coordsEl).textContent = 'MGRS ' + mgrs(ev.latlng.lat, ev.latlng.lng);
      if (S.tool === 'ruler' && ruler.pts.length) drawRuler(ev.latlng);
    });
    coordsEl.title = 'Click to copy';
    coordsEl.onclick = () => { if (last) copy(`${last.lat.toFixed(5)}, ${last.lng.toFixed(5)} (MGRS ${mgrs(last.lat, last.lng)})`, coordsEl); };
    hud.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-tool],[data-do]');
      if (!t) return;
      if (t.dataset.tool) setTool(S.tool === t.dataset.tool ? null : t.dataset.tool);
      else if (t.dataset.do === 'link') copyLink(t);
      else if (t.dataset.do === 'full') fullScreen();
    });
    // The tools' lines in their own pane, over the control colours and at full strength.
    if (!m.getPane('opsTools')) { m.createPane('opsTools'); m.getPane('opsTools').style.zIndex = 640; m.getPane('opsTools').style.pointerEvents = 'none'; }
    toolLayer = L.layerGroup().addTo(m);
    m.on('click', (ev) => {
      if (S.tool === 'ruler') { ruler.pts.push(ev.latlng); drawRuler(); }
      else if (S.tool === 'rings') addRings(ev.latlng);
    });
    m.on('dblclick', (ev) => { if (S.tool === 'ruler') { L.DomEvent.stop(ev); setTool(null, true); } });
    buildMini(m);
  }
  function setTool(t, keepDrawn) {
    S.tool = t;
    const m = getMap();
    hud.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    m.getContainer().classList.toggle('ops-crosshair', !!t);
    if (t === 'ruler') { ruler.pts = []; m.doubleClickZoom.disable(); } else m.doubleClickZoom.enable();
    if (!t && !keepDrawn) { toolLayer.clearLayers(); ruler.pts = []; }
    tip(t === 'ruler' ? 'Click points to measure. Double-click or Esc to end.' : t === 'rings' ? 'Click a place for range rings. Esc to clear.' : '');
  }
  function tip(text) { const el = $('.ops-tooltip', hud); el.textContent = text; el.hidden = !text; }
  const ruler = { pts: [], line: null, labels: [] };
  function drawRuler(hover) {
    const m = getMap();
    toolLayer.eachLayer((l) => { if (l.options && l.options.opsRuler) toolLayer.removeLayer(l); });
    const pts = hover ? [...ruler.pts, hover] : ruler.pts;
    if (!pts.length) return;
    L.polyline(pts, { pane: 'opsTools', opsRuler: true, color: '#ffd166', weight: 2, dashArray: '6 5', interactive: false }).addTo(toolLayer);
    let tot = 0;
    pts.forEach((p, i) => {
      L.circleMarker(p, { pane: 'opsTools', opsRuler: true, radius: 3.5, color: '#ffd166', weight: 2, fillColor: '#111', fillOpacity: 1, interactive: false }).addTo(toolLayer);
      if (!i) return;
      tot += distKm(pts[i - 1], p);
    });
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    if (a && b) {
      const brg = Math.round(bearing(a, b));
      L.marker(b, { opsRuler: true, interactive: false, icon: L.divIcon({ className: 'ops-rlabel', iconSize: [0, 0], html: `<span>${esc(kmTxt(tot))}<small>${String(brg).padStart(3, '0')}° true</small></span>` }) }).addTo(toolLayer);
    }
    void m;
  }
  const RINGS = [100, 300, 500, 1000, 2000];
  function addRings(c) {
    const g = L.layerGroup().addTo(toolLayer);
    L.circleMarker(c, { pane: 'opsTools', radius: 3, color: '#7dd3fc', weight: 2, fillColor: '#7dd3fc', fillOpacity: 1, interactive: false }).addTo(g);
    RINGS.forEach((km, i) => {
      L.circle(c, { pane: 'opsTools', radius: km * 1000, color: '#7dd3fc', weight: 1.4, opacity: 0.85 - i * 0.1, fill: false, dashArray: i > 2 ? '5 6' : null, interactive: false }).addTo(g);
      const n = L.latLng(c.lat + (km / R_KM) * (180 / Math.PI), c.lng);
      L.marker(n, { interactive: false, icon: L.divIcon({ className: 'ops-ringlabel', iconSize: [0, 0], html: `<span>${km.toLocaleString('en-GB')} km</span>` }) }).addTo(g);
    });
  }
  function copyLink(btn) {
    const m = getMap();
    const c = m.getCenter();
    copy(`${location.origin}${location.pathname}#at=${c.lat.toFixed(3)},${c.lng.toFixed(3)},${m.getZoom().toFixed(2)}`, btn);
  }
  function openAt(m) {
    const at = /#at=(-?[\d.]+),(-?[\d.]+),([\d.]+)/.exec(location.hash || '');
    if (!at) return;
    setTimeout(() => { try { m.setView([+at[1], +at[2]], +at[3]); } catch (e) { /* bad link */ } }, 900);
  }
  function fullScreen() {
    const el = shell;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  /* The overview map: the region, where the main map is looking, and the last 48 hours' events. */
  function buildMini(m) {
    const el = $('.ops-mini-map', hud);
    mini = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false, zoomSnap: 0.25 });
    mini._t = L.tileLayer(app('TILE_URL') || 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { noWrap: true }).addTo(mini);
    mini.fitBounds([[10, 31], [40, 63]]);
    miniDots = L.layerGroup().addTo(mini);
    miniBox = L.rectangle(m.getBounds(), { color: '#ffd166', weight: 1.5, fillOpacity: 0.08, interactive: false }).addTo(mini);
    const sync = () => { try { miniBox.setBounds(m.getBounds()); } catch (e) { /* gone */ } };
    m.on('move zoom', sync);
    mini.on('click', (ev) => m.panTo(ev.latlng));
    // Drag on the overview to move the map.
    let down = false;
    el.addEventListener('pointerdown', (ev) => { down = true; el.setPointerCapture(ev.pointerId); });
    el.addEventListener('pointermove', (ev) => { if (!down) return; const r = el.getBoundingClientRect(); m.panTo(mini.containerPointToLatLng([ev.clientX - r.left, ev.clientY - r.top]), { animate: false }); });
    el.addEventListener('pointerup', () => { down = false; });
  }
  function drawMiniDots(list) {
    if (!miniDots) return;
    miniDots.clearLayers();
    list.forEach((e) => L.circleMarker([e.lat, e.lng], { radius: 1.8, stroke: false, fillColor: sideOf(e).c, fillOpacity: 0.95, interactive: false }).addTo(miniDots));
  }
  function themeTiles() {
    if (mini && mini._t) mini._t.setUrl(app('TILE_URL') || mini._t._url);
  }

  /* ---------- The last 48 hours, side by side ---------- */
  const SPAN = 48 * 3600e3;
  let rng = null; // [from, to] picked by dragging, or null
  let rows = [];
  function recent() {
    const now = Date.now();
    return events().filter((e) => { const t = Date.parse(e.at); return t > now - SPAN && t <= now + 60e3; });
  }
  function drawMatrix() {
    const svg = dock && $('.ops-amx', dock);
    if (!svg) return;
    const list = recent();
    const now = Date.now(), t0 = now - SPAN;
    const by = new Map();
    list.forEach((e) => { const s = sideOf(e); const r = by.get(s.name) || { name: s.name, c: s.c, ev: [] }; r.ev.push(e); by.set(s.name, r); });
    rows = [...by.values()].sort((a, b) => b.ev.length - a.ev.length);
    const W = Math.max(240, svg.clientWidth || svg.parentNode.clientWidth || 600), LW = 132, RH = 11, top = 3;
    const H2 = top + Math.max(1, rows.length) * RH + 18;
    svg.setAttribute('viewBox', `0 0 ${W} ${H2}`);
    svg.style.height = H2 + 'px';
    const x = (t) => LW + ((t - t0) / SPAN) * (W - LW - 6);
    const hour = 3600e3, first = Math.ceil(t0 / hour) * hour;
    let out = '';
    // The hours on the desk's clock: a faint line every six, midnight marked with its day, noon with its hour.
    const hOf = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: VIEW_TZ() });
    const ty = H2 - 3;
    for (let t = first; t <= now; t += hour) {
      const h = Number(hOf.format(t));
      if (h % 6) continue;
      out += `<line class="g${h === 0 ? ' d' : ''}" x1="${x(t)}" x2="${x(t)}" y1="${top - 2}" y2="${H2 - 15}"/>`;
      if ((h === 0 || h === 12) && x(t) > LW + 24 && x(t) < W - 40) out += `<text class="tk${h === 0 ? ' day' : ''}" x="${x(t)}" y="${ty}" text-anchor="middle">${h === 0 ? dm(t, VIEW_TZ()) : '12:00'}</text>`;
    }
    rows.forEach((r, i) => {
      const y = top + i * RH;
      out += `<text class="lab" x="${LW - 8}" y="${y + 8.5}" text-anchor="end">${esc(r.name.length > 20 ? r.name.slice(0, 19) + '…' : r.name)}</text>`;
      out += `<line class="row" x1="${LW}" x2="${W - 6}" y1="${y + 6}" y2="${y + 6}"/>`;
      // An hour's events as one block, darker with more.
      const bins = new Map();
      r.ev.forEach((e) => { const b = Math.floor(Date.parse(e.at) / hour); bins.set(b, (bins.get(b) || 0) + 1); });
      bins.forEach((n, b) => {
        const a = Math.max(t0, b * hour), z = Math.min(now, (b + 1) * hour);
        out += `<rect class="cell" x="${x(a).toFixed(1)}" y="${y + 1.5}" width="${Math.max(2, x(z) - x(a) - 0.8).toFixed(1)}" height="8" rx="1" fill="${r.c}" fill-opacity="${Math.min(1, 0.35 + n * 0.16).toFixed(2)}"><title>${esc(r.name)}: ${n} event${n === 1 ? '' : 's'}, ${hm(b * hour, VIEW_TZ())}–${hm((b + 1) * hour, VIEW_TZ())}</title></rect>`;
      });
    });
    if (!rows.length) out += `<text class="lab" x="${LW}" y="${top + 9.5}">No events on the map in the last 48 hours.</text>`;
    out += `<text class="tk now" x="${W - 6}" y="${ty}" text-anchor="end">Now</text>`;
    out += `<line class="nowl" x1="${x(now)}" x2="${x(now)}" y1="${top - 2}" y2="${H2 - 15}"/>`;
    if (rng) out += `<rect class="sel" x="${x(rng[0])}" y="${top - 3}" width="${Math.max(2, x(rng[1]) - x(rng[0]))}" height="${H2 - 14 - top}"/>`;
    out += `<rect class="hit" data-mx x="${LW}" y="0" width="${W - LW - 6}" height="${H2 - 12}"/>`;
    svg.innerHTML = out;
    svg._x = { t0, LW, W };
    const sel = $('.ops-act-sel', dock);
    sel.hidden = !rng;
    if (rng) sel.innerHTML = `${esc(hm(rng[0], VIEW_TZ()))}–${esc(hm(rng[1], VIEW_TZ()))} <button type="button" data-clear title="Show every hour again">${ICON.x}<span class="sr">Clear</span></button>`;
    drawLog(list);
    drawMiniDots(list);
    counts();
    if (PAGE === 'all') drawTheatres();
    dimPins();
  }
  function wireMatrix() {
    const svg = $('.ops-amx', dock);
    let start = null;
    const tAt = (ev) => { const r = svg.getBoundingClientRect(), k = svg._x; const px = ((ev.clientX - r.left) / r.width) * k.W; return k.t0 + ((px - k.LW) / (k.W - k.LW - 6)) * SPAN; };
    svg.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('[data-mx], .cell')) return; start = tAt(ev); svg.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    svg.addEventListener('pointermove', (ev) => {
      if (start == null) return;
      const t = tAt(ev), now = Date.now();
      const a = Math.max(now - SPAN, Math.min(start, t)), b = Math.min(now, Math.max(start, t));
      if (b - a > 10 * 60e3) { rng = [a, b]; drawMatrix(); }
    });
    svg.addEventListener('pointerup', (ev) => {
      if (start == null) return;
      const t = tAt(ev);
      // A click, not a drag: the hour clicked.
      if (Math.abs(t - start) < 6 * 60e3) { const h = Math.floor(t / 3600e3) * 3600e3; rng = [h, h + 3600e3]; drawMatrix(); }
      start = null;
    });
    dock.addEventListener('click', (ev) => { if (ev.target.closest('[data-clear]')) { rng = null; drawMatrix(); } });
  }
  /* Pins outside the hours picked fade (the pins drawn one by one; the whole war's canvas is left alone). */
  function dimPins() {
    const m = getMap();
    if (!m) return;
    const at = new Map();
    events().forEach((e) => { if (e.label) at.set(e.label, Date.parse(e.at)); });
    m.getPane('markerPane').querySelectorAll('.ev[title]').forEach((el) => {
      const t = at.get(el.getAttribute('title'));
      const out = !!rng && !(t >= rng[0] && t <= rng[1]);
      el.classList.toggle('ops-dim', out);
    });
  }

  /* The events: the hours picked, else the last 48 hours, newest first, filtered; a click goes to the pin and opens its note. */
  let logList = [], evQ = '';
  function drawLog(list) {
    const l = rightEl && $('.ops-log-l', rightEl);
    if (!l) return;
    let pick = (rng ? list.filter((e) => { const t = Date.parse(e.at); return t >= rng[0] && t <= rng[1]; }) : list).sort((a, b) => (a.at < b.at ? 1 : -1));
    if (evQ) pick = pick.filter((e) => `${e.label || ''} ${e.place || ''} ${sideOf(e).name} ${kindOf(e).name} ${e.source || ''}`.toLowerCase().includes(evQ));
    logList = pick.slice(0, 200);
    $('.ops-log-n', rightEl).textContent = rng ? `${pick.length} in the hours picked` : `${pick.length} in 48 hours`;
    const n = $('.ops-ev-n', rightEl); if (n) n.textContent = list.length;
    let day = '';
    l.innerHTML = logList.map((e, i) => {
      const s = sideOf(e), k = kindOf(e);
      const d = dm(e.at, VIEW_TZ());
      const head = d !== day ? `<li class="ops-day">${esc(d)}</li>` : '';
      day = d;
      return `${head}<li><button type="button" data-ev="${i}" style="--c:${s.c}"><time>${esc(hm(e.at, VIEW_TZ()))}</time><span class="k" title="${esc(k.name)}">${glyph(k.k)}</span><span class="t"><b>${esc(e.label || e.place || k.name)}</b><small>${esc([s.name, k.name, e.place].filter(Boolean).join(' · '))}${e.source ? ` · <i>${esc(e.source)}</i>` : ''}</small></span></button></li>`;
    }).join('') || '<li class="ops-empty">No events here.</li>';
  }
  function wireLog() {
    $('.ops-log-l', rightEl).addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ev]');
      if (b) focusEvent(logList[+b.dataset.ev]);
    });
  }
  /** An event on the map: its own pin if drawn (its note opened), else a mark of ours with its note. */
  let pingLayer = null;
  function markerOf(e) {
    const m = getMap();
    let found = null;
    m.eachLayer((l) => {
      if (found || !(l instanceof L.Marker) || !l.getElement) return;
      const el = l.getElement();
      const ev = el && el.querySelector('.ev');
      if (!ev || ev.getAttribute('title') !== (e.label || '')) return;
      if (l.getLatLng().distanceTo([e.lat, e.lng]) < 30000) found = l;
    });
    return found;
  }
  function focusEvent(e) {
    if (!e) return;
    const m = getMap();
    if (isPhone()) { S.ptab = 'map'; paintFrame(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    m.closePopup();
    const go = () => {
      const mk = markerOf(e);
      if (mk) { mk.openPopup(); pulse(mk.getElement()); return; }
      ping(e, true);
    };
    m.once('moveend', () => setTimeout(go, 60));
    m.flyTo([e.lat, e.lng], Math.max(m.getZoom(), 7.5), { duration: 0.7 });
  }
  function pulse(el) { if (!el) return; el.classList.remove('ops-pulse'); void el.offsetWidth; el.classList.add('ops-pulse'); setTimeout(() => el.classList.remove('ops-pulse'), 4200); }
  function ping(e, withNote) {
    const m = getMap();
    if (!pingLayer) pingLayer = L.layerGroup().addTo(m);
    const s = sideOf(e);
    const mk = L.marker([e.lat, e.lng], { zIndexOffset: 5000, icon: L.divIcon({ className: 'ops-ping', iconSize: [0, 0], html: `<span style="--c:${s.c}"></span>` }) }).addTo(pingLayer);
    if (withNote) {
      mk.bindPopup(() => noteOf(e), { maxWidth: 300, maxHeight: 360, className: 'ops-note' }).openPopup();
      mk.on('popupclose', () => setTimeout(() => pingLayer.removeLayer(mk), 200));
    } else setTimeout(() => pingLayer.removeLayer(mk), 9000);
  }

  /* ---------- New events as they come in ---------- */
  let seen = null, cycle = -1;
  function watch() {
    const list = events();
    if (!list.length) return;
    if (!seen) { seen = new Set(list.map(keyOf)); return; }
    const fresh = list.filter((e) => !seen.has(keyOf(e)) && Date.now() - Date.parse(e.at) < 6 * 3600e3);
    list.forEach((e) => seen.add(keyOf(e)));
    fresh.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 3).forEach((e) => { toast(e); ping(e); });
    if (fresh.length) { drawMatrix(); if (PAGE === 'all') drawAllRail(); }
  }
  function toast(e) {
    const box = $('.ops-toasts', hud);
    const s = sideOf(e), k = kindOf(e);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ops-toast';
    b.innerHTML = `<span class="k" style="--c:${s.c}">${glyph(k.k)}</span><span class="t"><small>New · ${esc(s.name)} · ${esc(hm(e.at, VIEW_TZ()))}</small>${esc(e.label || k.name)}</span>`;
    b.onclick = () => { focusEvent(e); b.remove(); };
    box.prepend(b);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => b.classList.add('out'), 14000);
    setTimeout(() => b.remove(), 14600);
  }
  /* Space: the latest event, then the one before it. */
  function nextLatest() {
    const list = recent().sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!list.length) return;
    cycle = (cycle + 1) % Math.min(list.length, 30);
    focusEvent(list[cycle]);
  }

  /* ---------- Layers: the base map, names, a grid, control areas, live traffic ---------- */
  const T = { air: [], at: '', seaOk: null, ships: [], seaAt: '', seaNote: '', timer: null, layer: null, rend: null, sel: null, trail: new Map(), src: [] };
  const AIR_MS = 10000;
  const ESRI_T = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const BASES = [
    ['auto', 'Plain', 'Grey, with Day or Night'],
    ['sat', 'Satellite', 'Esri World Imagery'],
    ['relief', 'Relief', 'Hills and mountains'],
  ];
  const night = () => H.dataset.theme !== 'broadsheet-day';
  const baseUrl = (b) => (b === 'sat' ? ESRI_T + 'World_Imagery/MapServer/tile/{z}/{y}/{x}' : b === 'relief' ? ESRI_T + `Elevation/World_Hillshade${night() ? '_Dark' : ''}/MapServer/tile/{z}/{y}/{x}` : '');
  const namesUrl = () => (S.base === 'sat' ? ESRI_T + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}' : ESRI_T + `Canvas/World_${night() ? 'Dark' : 'Light'}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`);
  const LY = { base: null, names: null, grid: null };
  function pane(m, name, z) {
    if (!m.getPane(name)) { m.createPane(name); m.getPane(name).style.zIndex = z; m.getPane(name).style.pointerEvents = 'none'; }
    return name;
  }
  function drawBase() {
    const m = getMap();
    if (!m) return;
    const u = baseUrl(S.base);
    if (LY.base && (!u || LY.base._url !== u)) { m.removeLayer(LY.base); LY.base = null; }
    if (u && !LY.base) LY.base = L.tileLayer(u, { pane: pane(m, 'opsBase', 205), maxZoom: 18, maxNativeZoom: S.base === 'relief' ? 16 : 18, noWrap: true, attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(m);
    H.classList.toggle('ops-base-sat', S.base === 'sat');
    H.classList.toggle('ops-base-relief', S.base === 'relief');
    const nu = S.names ? namesUrl() : '';
    if (LY.names && (!nu || LY.names._url !== nu)) { m.removeLayer(LY.names); LY.names = null; }
    if (nu && !LY.names) LY.names = L.tileLayer(nu, { pane: pane(m, 'opsNames', 455), maxZoom: 18, maxNativeZoom: 16, noWrap: true }).addTo(m);
    drawGrid();
  }
  /* A grid of latitude and longitude, its spacing set by the zoom, its lines named at the map's edges. */
  function drawGrid() {
    const m = getMap();
    if (!m) return;
    if (!LY.grid) LY.grid = L.layerGroup().addTo(m);
    LY.grid.clearLayers();
    if (!S.grid) return;
    const z = m.getZoom(), b = m.getBounds().pad(0.05);
    const step = z < 4.5 ? 10 : z < 6 ? 5 : z < 7.5 ? 2 : z < 8.5 ? 1 : z < 10 ? 0.5 : 0.25;
    const p = pane(m, 'opsGrid', 430);
    const st = { pane: p, interactive: false, weight: 1, opacity: 1, className: 'ops-gl' };
    const lab = (ll, t, cls) => L.marker(ll, { pane: p, interactive: false, icon: L.divIcon({ className: `ops-glab ${cls}`, iconSize: [0, 0], html: `<span>${t}</span>` }) }).addTo(LY.grid);
    const vb = m.getBounds();
    const dp = step < 1 ? 2 : 0;
    for (let lat = Math.ceil(b.getSouth() / step) * step; lat <= b.getNorth(); lat += step) {
      L.polyline([[lat, b.getWest()], [lat, b.getEast()]], st).addTo(LY.grid);
      lab([lat, vb.getWest()], `${Math.abs(lat).toFixed(dp)}°${lat >= 0 ? 'N' : 'S'}`, 'w');
    }
    for (let lng = Math.ceil(b.getWest() / step) * step; lng <= b.getEast(); lng += step) {
      L.polyline([[b.getSouth(), lng], [b.getNorth(), lng]], st).addTo(LY.grid);
      lab([vb.getNorth(), lng], `${Math.abs(lng).toFixed(dp)}°${lng >= 0 ? 'E' : 'W'}`, 'n');
    }
  }
  function toggleLayers(force) {
    const menu = $('.ops-menu', hud);
    if (!menu) return;
    const open = force != null ? force : menu.hidden;
    menu.hidden = !open;
    root.querySelectorAll('[data-op="layers"]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) paintLayers();
  }
  const toggleTrafficMenu = toggleLayers;
  const sw = (k, on, label, sub, extra = '') => `<label class="ops-sw ${extra}"><input type="checkbox" data-ly="${k}" ${on ? 'checked' : ''} ${/off/.test(extra) ? 'disabled' : ''}><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</label>`;
  function paintLayers() {
    const menu = $('.ops-menu', hud);
    if (!menu || menu.hidden) return;
    const mil = T.air.filter((a) => a[13]);
    const ground = T.air.filter((a) => a[16]).length;
    const seaNo = T.seaOk === false;
    const airTxt = S.air && T.at ? `<b>${(T.air.length - ground).toLocaleString('en-GB')}</b> in the air${ground ? `, ${ground} on the ground` : ''} · ${esc(ago(T.at))}` : 'Every aircraft broadcasting its position';
    const seaTxt = seaNo ? 'Waiting for the live ship feed to be connected' : S.sea && T.seaAt ? `<b>${T.ships.length.toLocaleString('en-GB')}</b> ships · ${T.seaNote === 'live' ? 'live' : esc(T.seaNote || '')}` : 'Every ship broadcasting its position (AIS)';
    menu.innerHTML = `<div class="ops-mh"><b>Layers</b><button type="button" class="ops-x" data-ly="close" aria-label="Close">${ICON.x}</button></div>
      <p class="ops-mlab">Base map</p>
      <div class="ops-bases">${BASES.map(([k, n, s]) => `<button type="button" data-base="${k}" aria-pressed="${S.base === k}" title="${esc(s)}"><i class="ops-bthumb ${k}"></i>${esc(n)}</button>`).join('')}</div>
      <p class="ops-mlab">On the map</p>
      ${sw('names', S.names, 'Place names', '')}
      ${sw('grid', S.grid, 'Grid', 'Latitude and longitude')}
      ${sw('fills', S.fills, 'Areas of control, shaded', 'Who holds what, in colour')}
      <p class="ops-mlab">Live traffic</p>
      ${sw('air', S.air, `${ICON.plane}Aircraft`, airTxt)}
      ${sw('mil', S.airMil, 'Military only', S.air ? `${mil.length} military aircraft` : '', `sub ${S.air ? '' : 'off'}`)}
      ${sw('gnd', S.airGround, 'Also on the ground', S.air ? 'At airfields and bases' : '', `sub ${S.air ? '' : 'off'}`)}
      ${sw('sea', S.sea && !seaNo, `${ICON.ship}Ships`, seaTxt, seaNo ? 'off' : '')}
      ${S.air && mil.length ? `<div class="ops-mil"><p>Military aircraft now</p><ul>${mil.slice(0, 60).map((a) => `<li><button type="button" data-hex="${esc(a[0])}"><b>${esc(a[8] || a[9] || a[0])}</b><span>${esc(a[11] || a[10] || '')}</span><em>${a[16] ? 'GND' : a[3] != null ? esc(fl(a[3])) : ''}</em></button></li>`).join('')}</ul></div>` : ''}
      <p class="ops-src">Aircraft: ${(T.src.length ? T.src : ['adsb.fi', 'adsb.lol']).map(esc).join(' and ')} open data, every 10 seconds. Ships: AISStream. Only what broadcasts is seen; many military flights do not.</p>`;
  }
  const fl = (ft) => (ft >= 18000 ? 'FL' + String(Math.round(ft / 100)).padStart(3, '0') : `${ft.toLocaleString('en-GB')} ft`);
  function wireTraffic() {
    const menu = $('.ops-menu', hud);
    menu.addEventListener('change', (ev) => {
      const k = ev.target.dataset.ly, v = ev.target.checked;
      if (k === 'air') S.air = v;
      if (k === 'mil') S.airMil = v;
      if (k === 'gnd') S.airGround = v;
      if (k === 'sea') S.sea = v;
      if (k === 'names') S.names = v;
      if (k === 'grid') S.grid = v;
      if (k === 'fills') { S.fills = v; paintFrame(); }
      keep();
      if (/^(air|sea)$/.test(k)) runTraffic();
      if (/^(names|grid)$/.test(k)) drawBase();
      drawTraffic(); paintLayers();
    });
    menu.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-ly="close"]')) toggleLayers(false);
      const bb = ev.target.closest('[data-base]');
      if (bb) { S.base = bb.dataset.base; keep(); drawBase(); drawTraffic(); paintLayers(); }
      const h = ev.target.closest('[data-hex]');
      if (h) { const a = T.air.find((x) => x[0] === h.dataset.hex); if (a) { selectAc(a, true); if (isPhone()) toggleLayers(false); } }
    });
  }
  async function pull(kind) {
    try {
      const r = await fetch(`/api/traffic?kind=${kind}`, { cache: 'no-store' });
      return r.ok ? r.json() : null;
    } catch (e) { return null; }
  }
  async function airTick() {
    if (document.hidden) return;
    if (S.air) {
      const j = await pull('air');
      if (j && j.ok) {
        T.air = j.ac || []; T.at = j.at; T.src = j.src || T.src;
        if (j.ships === false) T.seaOk = false;
        const now = Date.now();
        T.air.forEach((a) => { const tr = T.trail.get(a[0]) || []; const p = tr[tr.length - 1]; if (!p || p[0] !== a[1] || p[1] !== a[2]) tr.push([a[1], a[2], now]); if (tr.length > 60) tr.shift(); T.trail.set(a[0], tr); });
        for (const [k, tr] of T.trail) if (now - tr[tr.length - 1][2] > 20 * 60e3) T.trail.delete(k);
      }
    }
    if (S.sea && T.seaOk !== false) {
      const j = await pull('sea');
      if (j && j.ok) { T.ships = j.ships || []; T.seaAt = j.at; T.seaNote = j.note || ''; T.seaOk = true; } else if (j && j.note === 'no-key') T.seaOk = false;
    }
    drawTraffic(); paintLayers();
    if (T.sel) refreshSel();
  }
  function runTraffic() {
    clearInterval(T.timer);
    T.timer = null;
    if (S.air || S.sea) { airTick(); T.timer = setInterval(airTick, AIR_MS); }
    $('[data-op="traffic"]', bar).classList.toggle('on', S.air || S.sea);
  }
  /* The aircraft and ships, drawn on one canvas: a mark turned to its heading. */
  let TrafficMark = null;
  const PLANE = new Path2D('M0-9 1.4-3.2 8 1v1.8L1.4 1 1 6.2 3.2 8v1.3L0 8.4-3.2 9.3V8L-1 6.2-1.4 1-8 2.8V1l6.6-4.2z');
  const BOAT = new Path2D('M0-8 3.2-2.5V7H-3.2V-2.5z');
  /* A mark turned to its heading, with a line ahead of it for its speed (a minute's travel at high zoom),
     and, close in, its callsign beside it. */
  function trafficClass() {
    if (TrafficMark) return TrafficMark;
    TrafficMark = L.CircleMarker.extend({
      _updatePath() {
        const r = this._renderer;
        if (!r || !r._drawing || this._empty()) return;
        const ctx = r._ctx, p = this._point, o = this.options;
        const a = ((o.hdg || 0) * Math.PI) / 180;
        if (o.vec > 2 && o.hdg != null) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(a) * o.vec, p.y - Math.cos(a) * o.vec);
          ctx.lineWidth = 1; ctx.strokeStyle = o.ink; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        const k = (o.big ? 1.15 : 0.85) * (o.gnd ? 0.75 : 1);
        ctx.scale(k, k);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = o.edge;
        ctx.fillStyle = o.ink;
        ctx.globalAlpha = o.gnd ? 0.6 : 1;
        ctx.stroke(o.ship ? BOAT : PLANE);
        ctx.fill(o.ship ? BOAT : PLANE);
        ctx.restore();
        if (o.tag) {
          ctx.font = '500 10.5px "IBM Plex Mono", ui-monospace, monospace';
          ctx.lineWidth = 3; ctx.strokeStyle = o.edge; ctx.fillStyle = o.ink;
          ctx.strokeText(o.tag, p.x + 11, p.y + 4); ctx.fillText(o.tag, p.x + 11, p.y + 4);
        }
        if (o.sel) { ctx.beginPath(); ctx.rect(p.x - 13, p.y - 13, 26, 26); ctx.lineWidth = 1.5; ctx.strokeStyle = o.selInk; ctx.stroke(); }
      },
    });
    return TrafficMark;
  }
  const INK = () => (night() && S.base !== 'sat'
    ? { civ: '#9fb8d0', mil: '#f0a53a', emg: '#ff5a4f', ship: '#6fc3c9', tank: '#d9a066', navy: '#f0a53a', edge: 'rgba(8,11,14,.9)', sel: '#ffffff' }
    : S.base === 'sat' ? { civ: '#e6eef6', mil: '#ffb547', emg: '#ff5a4f', ship: '#7fe0e6', tank: '#ffc27a', navy: '#ffb547', edge: 'rgba(0,0,0,.85)', sel: '#ffffff' }
      : { civ: '#3f5566', mil: '#b25e00', emg: '#c62828', ship: '#00838f', tank: '#a15c12', navy: '#b25e00', edge: 'rgba(255,255,255,.95)', sel: '#000000' });
  function shipInk(type, I) {
    const t = Number(type) || 0;
    if (t >= 80 && t < 90) return I.tank; // tankers
    if (t === 35) return I.navy; // military
    return I.ship;
  }
  function drawTraffic() {
    const m = getMap();
    if (!m) return;
    if (!T.rend) T.rend = L.canvas({ padding: 0.2, pane: pane(m, 'opsTraffic', 590) });
    if (T.layer) m.removeLayer(T.layer);
    T.layer = L.layerGroup();
    const Mk = trafficClass();
    const I = INK(), z = m.getZoom();
    // A minute's travel, in pixels at this zoom (metres per pixel at the region's latitude).
    const mpp = (40075016 * Math.cos((25 * Math.PI) / 180)) / (256 * 2 ** z);
    const vecOf = (kt) => (kt ? Math.min(60, ((kt * 1852) / 60) / mpp) : 0);
    if (S.air) T.air.forEach((a) => {
      if (S.airMil && !a[13]) return;
      if (a[16] && !S.airGround) return;
      const emg = a[7] === '7500' || a[7] === '7600' || a[7] === '7700';
      const sel = T.sel && T.sel.kind === 'air' && T.sel.id === a[0];
      const tag = (z >= 7.5 || (a[13] && z >= 6)) && !a[16] ? a[8] || a[9] || '' : '';
      const mk = new Mk([a[1], a[2]], { renderer: T.rend, radius: 9, hdg: a[5], vec: a[16] ? 0 : vecOf(a[4]), ink: emg ? I.emg : a[13] ? I.mil : I.civ, edge: I.edge, selInk: I.sel, big: !!a[13] || emg, gnd: !!a[16], tag, sel, stroke: false, fill: true, bubblingMouseEvents: false });
      mk.on('click', () => selectAc(a));
      T.layer.addLayer(mk);
    });
    if (S.sea) T.ships.forEach((s) => {
      const sel = T.sel && T.sel.kind === 'sea' && T.sel.id === s[0];
      const tag = z >= 9 ? s[1] || '' : '';
      const mk = new Mk([s[2], s[3]], { renderer: T.rend, radius: 9, hdg: s[6] != null ? s[6] : s[5], vec: s[4] > 0.5 ? vecOf(s[4]) * 10 : 0, ink: shipInk(s[8], I), edge: I.edge, selInk: I.sel, ship: true, tag, sel, stroke: false, fill: true, bubblingMouseEvents: false });
      mk.on('click', () => selectShip(s));
      T.layer.addLayer(mk);
    });
    // The picked aircraft's track since the layer was turned on.
    if (T.sel && T.sel.kind === 'air') {
      const tr = T.trail.get(T.sel.id);
      if (tr && tr.length > 1) L.polyline(tr.map((p) => [p[0], p[1]]), { pane: 'opsTraffic', color: I.sel, weight: 1.5, opacity: 0.75, dashArray: '4 4', interactive: false }).addTo(T.layer);
    }
    T.layer.addTo(m);
  }
  const SQUAWK = { 7500: 'Hijack', 7600: 'Radio failure', 7700: 'Emergency' };
  function selectAc(a, fly) {
    T.sel = { kind: 'air', id: a[0] };
    const m = getMap();
    if (fly) m.flyTo([a[1], a[2]], Math.max(m.getZoom(), 7), { duration: 0.7 });
    paintSel(); drawTraffic();
  }
  function selectShip(s) { T.sel = { kind: 'sea', id: s[0] }; paintSel(); drawTraffic(); }
  function refreshSel() {
    const still = T.sel.kind === 'air' ? T.air.some((a) => a[0] === T.sel.id) : T.ships.some((s) => s[0] === T.sel.id);
    if (still) paintSel(); else closeSel();
  }
  const row = (k, v) => (v == null || v === '' ? '' : `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`);
  const NAV = ['Under way, engine', 'At anchor', 'Not under command', 'Restricted', 'Constrained by draught', 'Moored', 'Aground', 'Fishing', 'Under way, sailing'];
  const SHIP_TYPE = (t) => { t = Number(t) || 0; return t >= 80 && t < 90 ? 'Tanker' : t >= 70 && t < 80 ? 'Cargo' : t >= 60 && t < 70 ? 'Passenger' : t === 35 ? 'Military' : t === 30 ? 'Fishing' : t === 52 ? 'Tug' : t ? `Type ${t}` : ''; };
  function paintSel() {
    const card = $('.ops-card', hud);
    if (!T.sel) { card.hidden = true; return; }
    let html = '';
    if (T.sel.kind === 'air') {
      const a = T.air.find((x) => x[0] === T.sel.id);
      if (!a) return;
      const sq = a[7] && SQUAWK[a[7]] ? `<b class="emg">${esc(a[7])} · ${SQUAWK[a[7]]}</b>` : esc(a[7] || '');
      html = `<div class="ops-ch"><span class="ops-ck ${a[13] ? 'mil' : ''}">${ICON.plane}${a[13] ? 'Military' : 'Aircraft'}</span><button type="button" class="ops-x" data-sel="x" aria-label="Close">${ICON.x}</button></div>
        <h3>${esc(a[8] || a[9] || a[0].toUpperCase())}</h3>
        <p class="ops-csub">${esc([a[11] || a[10], a[12]].filter(Boolean).join(' · '))}</p>
        ${a[14] && a[15] ? `<p class="ops-route"><b>${esc(a[14])}</b><span>→</span><b>${esc(a[15])}</b><small>Scheduled route of the flight number</small></p>` : ''}
        <dl>${row('Altitude', a[16] ? 'On the ground' : a[3] != null ? esc(fl(a[3])) : '')}${row('Speed', a[4] != null ? `${a[4]} kt` : '')}${row('Heading', a[5] != null ? `${String(a[5]).padStart(3, '0')}°` : '')}${row('Climb', a[6] ? `${a[6] > 0 ? '+' : ''}${a[6].toLocaleString('en-GB')} ft/min` : '')}${row('Squawk', sq)}${row('Registration', esc(a[9] || ''))}${row('Hex', esc(String(a[0]).toUpperCase()))}${row('Position', esc(latlon(a[1], a[2])))}${row('MGRS', esc(mgrs(a[1], a[2])))}</dl>
        <p class="ops-clinks"><a href="https://globe.adsb.fi/?icao=${esc(a[0])}" target="_blank" rel="noopener">adsb.fi ${ICON.ext}</a></p>`;
    } else {
      const s = T.ships.find((x) => x[0] === T.sel.id);
      if (!s) return;
      html = `<div class="ops-ch"><span class="ops-ck">${ICON.ship}${esc(SHIP_TYPE(s[8]) || 'Ship')}</span><button type="button" class="ops-x" data-sel="x" aria-label="Close">${ICON.x}</button></div>
        <h3>${esc(s[1] || 'MMSI ' + s[0])}</h3>
        <dl>${row('Destination', esc(s[9] || ''))}${row('Speed', s[4] != null ? `${s[4]} kt` : '')}${row('Course', s[5] != null ? `${Math.round(s[5])}°` : '')}${row('Status', esc(NAV[s[7]] || ''))}${row('Length', s[12] ? `${s[12]} m` : '')}${row('MMSI', esc(s[0]))}${row('IMO', esc(s[11] || ''))}${row('Call sign', esc(s[10] || ''))}${row('Position', esc(latlon(s[2], s[3])))}${row('Seen', esc(ago(s[13])))}</dl>
        <p class="ops-clinks"><a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${esc(s[0])}" target="_blank" rel="noopener">MarineTraffic ${ICON.ext}</a></p>`;
    }
    card.innerHTML = html;
    card.hidden = false;
  }
  function closeSel() { T.sel = null; paintSel(); drawTraffic(); }

  /* ---------- Broadcast mode: the map alone, a title strip and the latest line ---------- */
  function paintCast() {
    const el = hud && $('.ops-lower', hud);
    if (!el) return;
    el.hidden = !S.cast;
    if (!S.cast) return;
    const name = PAGE === 'all' ? 'The wars with Iran and in Yemen' : PAGE === 'iran' ? 'Iran conflict' : 'Yemen conflict';
    const latest = recent().sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    el.innerHTML = `<div class="ops-lt"><span class="live">Live</span><b>${esc(name)}</b>${PAGE !== 'all' ? `<span class="clk">${esc(CAP[PAGE])} ${esc(hm(Date.now(), TZ[PAGE]))}</span>` : ''}<span class="brand">The Situation Room</span></div>${latest ? `<div class="ops-lb"><time>${esc(hm(latest.at, VIEW_TZ()))}</time>${esc(latest.label || '')}</div>` : ''}`;
  }

  /* ---------- Keys ---------- */
  const KEYS = [['Space', 'The latest event, then the one before'], ['T', 'Layers and live traffic'], ['G', 'Grid'], ['S', 'Base map: plain, satellite, relief'], ['M', 'Measure a distance'], ['R', 'Range rings'], ['L', 'Copy a link to this view'], ['F', 'Full screen'], ['B', 'Broadcast mode'], ['[  ]', 'Close or open the left panel, the reports'], ['\\', 'Fold the timeline under the map'], ['Esc', 'Close, clear'], ['?', 'These keys']];
  function toggleKeys(force) {
    let el = $('.ops-keys');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ops-keys';
      el.hidden = true;
      el.innerHTML = `<div class="ops-kbox" role="dialog" aria-label="Keys"><div class="ops-mh"><b>Keys</b><button type="button" class="ops-x" aria-label="Close">${ICON.x}</button></div><dl>${KEYS.map(([k, v]) => `<div><dt>${k.split('  ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`;
      el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.closest('.ops-x')) toggleKeys(false); });
      document.body.appendChild(el);
    }
    el.hidden = force != null ? !force : !el.hidden;
  }
  function wireKeys() {
    addEventListener('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = ev.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = ev.key;
      if (k === 'Escape') {
        if ($('.ops-keys') && !$('.ops-keys').hidden) return toggleKeys(false);
        if (S.tool) return setTool(null);
        if (T.sel) return closeSel();
        if (!$('.ops-menu', hud).hidden) return toggleTrafficMenu(false);
        if (rng) { rng = null; return drawMatrix(); }
        if (S.cast) { S.cast = false; paintFrame(); paintCast(); }
        return;
      }
      const act = {
        ' ': nextLatest, t: () => toggleTrafficMenu(), g: () => { S.grid = !S.grid; keep(); drawGrid(); paintLayers(); }, s: () => { const i = BASES.findIndex((b) => b[0] === S.base); S.base = BASES[(i + 1) % BASES.length][0]; keep(); drawBase(); drawTraffic(); paintLayers(); }, m: () => setTool(S.tool === 'ruler' ? null : 'ruler'), r: () => setTool(S.tool === 'rings' ? null : 'rings'),
        l: () => copyLink($('[data-do="link"]', hud)), f: fullScreen, b: () => { S.cast = !S.cast; paintFrame(); paintCast(); },
        '[': () => { S.left = !S.left; keep(); paintFrame(); }, ']': () => { S.right = !S.right; keep(); paintFrame(); }, '\\': () => { S.dock = !S.dock; keep(); paintFrame(); }, '?': () => toggleKeys(),
      }[k.length === 1 ? k.toLowerCase() : k];
      if (act) { ev.preventDefault(); act(); }
    }, true); // Before the map's own keys (it stops Esc once it has closed a note).
  }

  /* ---------- Start ---------- */
  let started = false;
  function startHud() {
    const m = getMap();
    // The page's map, made and with a size (a map read before then has no place yet).
    if (!m || !m.getContainer || !window.L || !m._loaded || !(m.getSize().y > 0)) { setTimeout(startHud, 200); return; }
    buildHud(m);
    wireMatrix(); wireLog(); wireTraffic(); wireKeys();
    $('.ops-card', hud).addEventListener('click', (ev) => { if (ev.target.closest('[data-sel="x"]')) closeSel(); });
    sizeDock();
    // The desk's own part of the map, in the new map box (the page fitted it to the old one).
    const own = (app('DESK_GO') || {})[PAGE === 'all' ? '/' : PAGE === 'iran' ? '/iran-conflict-desk' : '/yemen-conflict-desk'];
    if (own && !/#(at|pin)=/.test(location.hash) && !sessionStorage.getItem('desk-go')) { try { m.invalidateSize(); m.fitBounds(own.b, { padding: [8, 8] }); } catch (e) { /* kept */ } }
    openAt(m);
    // The map opens on the last 48 hours, as the timeline under it (a link to a pin or a place keeps its own).
    if (!/#(at|pin)=/.test(location.hash)) {
      let tries = 0;
      const first = () => { if (!quickRange(2) && ++tries < 20) setTimeout(first, 300); };
      setTimeout(first, 400);
    }
    drawBase();
    m.on('zoomend', () => { if (S.air || S.sea) drawTraffic(); });
    m.on('moveend', () => { if (S.grid) drawGrid(); });
    drawMatrix();
    runTraffic();
    // The theme: the overview's tiles and the traffic's edges follow it.
    new MutationObserver(() => { themeTiles(); drawBase(); drawTraffic(); drawMatrix(); }).observe(H, { attributes: true, attributeFilter: ['data-theme'] });
    // The pins are drawn again by the page now and then: fade the ones outside the hours picked again.
    let dimT = 0;
    new MutationObserver(() => { if (rng) { clearTimeout(dimT); dimT = setTimeout(dimPins, 80); } }).observe(m.getPane('markerPane'), { childList: true });
    tick(); setInterval(tick, 15000);
    // The 48 hours roll on every minute; new events are looked for as the page brings them in.
    setInterval(() => { drawMatrix(); watch(); if (PAGE === 'all') drawAllRail(); }, 60000);
    let n = 0;
    const early = setInterval(() => { drawMatrix(); watch(); if (PAGE === 'all' && n < 3) drawAllRail(); if (++n > 12) clearInterval(early); }, 2500);
  }
  function start() {
    if (started) return;
    if (!findRoot()) return;
    started = true;
    try { build(); tick(); counts(); startHud(); } catch (e) {
      // Anything wrong: the classic page, as it is.
      console.error('map view', e);
      H.dataset.view = 'classic';
    }
  }
  // The page's scripts can take seconds on a slow server: the view waits for them (20 Oct: after 9 s the
  // All page gave up and showed the classic design, so readers on a slow load never saw this view).
  const poll = setInterval(() => { start(); if (started) clearInterval(poll); }, 60);
  setTimeout(() => {
    if (started) return;
    clearInterval(poll); /* no page of ours: nothing to do */
    // An All page that never came up at all: the classic page, as it is, rather than "Loading" for ever.
    if (document.getElementById('home-root')) H.dataset.view = 'classic';
  }, 90000);
  // A desk's page: the map's box exists from the start, so the layout is set before the map is drawn.
  start();
  window.opsView = { setView, focusEvent };
})();

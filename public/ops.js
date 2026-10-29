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
 * - new events as they come in, flagged on the map; Space goes to the latest;
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
  const setView = (v) => { try { sessionStorage.setItem('desk-view', v); } catch (e) { /* private */ } };

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
    if (d && d.querySelector('#map')) { root = d; PAGE = d.dataset.desk === 'iran' || d.dataset.desk === 'gaza' ? d.dataset.desk : 'yemen'; return true; }
    const h = document.getElementById('home-root');
    if (h && h.querySelector('#h-map') && window.__home) { root = h; PAGE = 'all'; return true; }
    return false;
  };
  const isPhone = () => matchMedia('(max-width:760px)').matches;
  const TZ = { iran: 'Asia/Tehran', yemen: 'Asia/Aden', gaza: 'Asia/Jerusalem' };
  const CAP = { iran: 'Tehran', yemen: 'Sanaa', gaza: 'Jerusalem' };
  // The desks app.js draws with the Iran desk's code: Iran's and the Gaza – Judea & Samaria desk's (user, 23 Oct).
  const IRAN_LIKE = (d) => d === 'iran' || d === 'gaza';
  const DESK_PATH = { all: '/', iran: '/iran-conflict-desk', yemen: '/yemen-conflict-desk', gaza: '/gaza-judea-samaria-desk' };

  /* ---------- Small helpers ---------- */
  const ICON = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 15.5v-1.7l-7.6-4.6V4.1a1.4 1.4 0 0 0-2.8 0v5.1L3 13.8v1.7l7.6-2.3v5l-2 1.5V21l3.4-.9 3.4.9v-1.3l-2-1.5v-5z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2.5h2v3.2h3.4v5.6l3.2 1.1-2.4 5.6H6.8l-2.4-5.6 3.2-1.1V5.7H11zM3 20.2c1.5 0 1.5.9 3 .9s1.5-.9 3-.9 1.5.9 3 .9 1.5-.9 3-.9 1.5.9 3 .9 1.5-.9 3-.9v1.6c-1.5 0-1.5.9-3 .9s-1.5-.9-3-.9-1.5.9-3 .9-1.5-.9-3-.9-1.5.9-3 .9-1.5-.9-3-.9z"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7 13l2 2M9.5 10.5l1.4 1.4M12 8l2 2M14.5 5.5l1.4 1.4"/></svg>',
    rings: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="9.4" stroke-dasharray="2.4 2.2"/></g></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
    theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="currentColor" d="M12 3.5a8.5 8.5 0 0 1 0 17z"/></svg>',
    keys: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="6" width="19" height="12" rx="1.6"/><path stroke-linecap="round" d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9"/></g></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.6 1-.8 2.7 1.9 2-1.9 2 .8 2.7-2.6 1-.6 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.6-2.7-2.6-1 .8-2.7-1.9-2 1.9-2-.8-2.7 2.6-1 .6-2.7 2.7.7z"/></g></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5 9l7 7 7-7"/></svg>',
    ext: '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></g></svg>',
  };
  // One formatter per clock, made once (each call making its own cost seconds on a phone).
  const FMT = new Map();
  const fmt = (kind, tz) => { const k = `${kind}|${tz || ''}`; let f = FMT.get(k); if (!f) { f = new Intl.DateTimeFormat('en-GB', kind === 't' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz } : { day: 'numeric', month: 'short', timeZone: tz }); FMT.set(k, f); } return f; };
  const hm = (t, tz) => fmt('t', tz).format(new Date(t));
  const dm = (t, tz) => fmt('d', tz).format(new Date(t));
  // The times in the view: the desk's clock (the All page: the reader's), the reader's own, or UTC, as set.
  const VIEW_TZ = () => (P.tz === 'utc' ? 'UTC' : P.tz === 'local' ? undefined : (PAGE && TZ[PAGE]) || undefined);
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
  const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60); return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${v >= 0 ? pos : neg}`; };
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
  const n1 = (v) => (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-GB'));
  const kmTxt = (km) => (P.units === 'km' ? `${n1(km)} km` : P.units === 'nm' ? `${n1(km / 1.852)} nm` : `${n1(km)} km · ${n1(km / 1.852)} nm`);
  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* refused */ }
    if (btn) { const was = btn.dataset.tip || ''; btn.dataset.tip = ok ? 'Copied' : text; btn.classList.add('tipped'); setTimeout(() => { btn.classList.remove('tipped'); btn.dataset.tip = was; }, 1600); }
    return ok;
  }

  /* ---------- The map and its events, whichever page ---------- */
  const getMap = () => (PAGE === 'all' ? window.__home && window.__home.map : app('map'));
  /** The events the page has, each with its desk. */
  function events(withResearched) {
    const own = (e) => withResearched || !e.researched;
    if (PAGE === 'all') { const h = window.__home; return h && h.D ? h.D.events.filter(own) : []; }
    if (IRAN_LIKE(PAGE)) { const p = app('iranPins'); return p && p.events ? p.events.filter(own).map((e) => (e.desk ? e : Object.assign(e, { desk: PAGE }))) : []; }
    const d = app('data');
    return d && d.events ? d.events.filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number').map((e) => (e.desk ? e : Object.assign(e, { desk: 'yemen' }))) : [];
  }
  const keyOf = (e) => `${e.desk}|${e.fp}`;
  /** Who acted, in the colour the desk gives them. */
  function sideOf(e) {
    if (IRAN_LIKE(e.desk)) {
      const k = A('iranSideOf')(e) || 'other';
      const r = (app('IRAN_PIN_SIDES') || []).find((x) => x[0] === k);
      return { name: r ? r[2] : 'Not stated', c: r ? r[1] : '#94a3b8' };
    }
    const k = A('yemenSideOf')(e) || 'unclear';
    const r = (A('YEMEN_PIN_SIDES')() || []).find((x) => x[0] === k);
    return { name: r ? r[2] : 'Not stated', c: r ? r[1] : '#94a3b8' };
  }
  function kindOf(e) {
    if (IRAN_LIKE(e.desk)) { const k = A('iranKindOf')(e) || 'strike'; return { k, name: (app('IRAN_KIND_LABEL') || {})[k] || k }; }
    const k = e.mapCat || e.cat || (A('classifyForMap')(`${e.label || ''} ${e.text || ''}`, String(e.type || '').toLowerCase())) || 'strike';
    return { k, name: (app('CATEGORY_LABEL') || {})[k] || k };
  }
  const glyph = (k) => ((app('EVENT_SVG') || {})[k] || '');
  const noteOf = (e) => (IRAN_LIKE(e.desk) ? A('iranPopupHtml')(e) : A('popupHtml')(e)) || esc(e.label || '');

  /* ---------- The frame ---------- */
  const S = { left: true, right: true, dock: true, tab: null, rtab: 'rep', ptab: 'map', sel: null, tool: null, air: false, airMil: false, airGround: false, sea: false, base: 'auto', names: false, grid: false, fills: true, fillsV: 3 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('ops-state2') || '{}'), { tool: null, sel: null }); } catch (e) { /* none kept */ }
  // The map writes its own place names (20 Oct: the Place names layer went from Layers).
  S.names = false;
  // Every map shows the sides' colours again (user, 22 Oct: "return the colors on the map according to each side"); an Off kept from before goes.
  if (!(S.fillsV >= 3)) { S.fills = true; S.fillsV = 3; }
  const keep = () => { try { const { left, right, dock, tab, rtab, air, airMil, airGround, sea, base, names, grid, fills, fillsV, trafficSeen } = S; localStorage.setItem('ops-state2', JSON.stringify({ left, right, dock, tab, rtab, air: TRAFFIC ? air : kept.air, airMil, airGround, sea: TRAFFIC ? sea : kept.sea, base, names, grid, fills, fillsV, trafficSeen })); } catch (e) { /* private */ } };
  /* The reader's settings (20 Oct: "make a settings page too to make the site very customizable"). */
  const PREF_DEF = { v: 3, tz: 'desk', range: 'today', pin: 'm', alerts: true, sound: false, units: 'both', coords: 'mgrs', text: 100, still: false, airStart: false };
  const P = { ...PREF_DEF };
  try { Object.assign(P, JSON.parse(localStorage.getItem('ops-prefs') || '{}')); } catch (e) { /* none kept */ }
  // Every map opens on the last 24 hours (20 Oct); settings kept before then had 48.
  // Maps open on today (20 Oct, later: "today should be the default"; the 24-hour button went).
  if (!(P.v >= 3)) { P.v = 3; P.range = 'today'; }
  const keepPrefs = () => { try { localStorage.setItem('ops-prefs', JSON.stringify(P)); } catch (e) { /* private */ } };
  // The panels' and the strip's sizes as the reader dragged them (lw, rw, dh in pixels; see paintSizes).
  let SZ = {};
  try { SZ = JSON.parse(localStorage.getItem('ops-sizes') || '{}') || {}; } catch (e) { /* none kept */ }
  const inFullFrame = (() => { try { return window.top !== window && window.top.__opsFull === true; } catch (e) { return false; } })();
  // The left panel's content as wide as the right panel (user, 27 Oct): a width dragged before that is let go once.
  if (SZ.v !== 2) { delete SZ.lw; SZ.v = 2; }
  // The left panel opens narrower (user, 22 Oct: "too wide right now"); a width dragged before then goes.
  if (!(SZ.v >= 2)) { delete SZ.lw; SZ.v = 2; }
  if (P.airStart) S.air = true;
  // Live traffic is the All desks page's alone (user, 23 Oct); a desk page leaves the choice made there as it was.
  let TRAFFIC = true;
  const kept = { air: S.air, sea: S.sea };

  let shell, strip, bar, nav, leftEl, rightEl, dock, stage, mapWrap;
  const NAV_ICON = {
    brief: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8 8h8M8 11.5h8M8 15h5"/></g></svg>',
    fronts: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-1 4-5 7-5s3 4 6 4 3-3 5-4"/><path d="M6 13.5l1.6-2.6M11 9.8V6.8M16 13.6l1.6-2.4"/></g></svg>',
    numbers: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 20v-6M12 20V6M17 20v-9"/></g></svg>',
    timeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 4v16"/><circle cx="6" cy="7" r="1.6" fill="currentColor"/><circle cx="6" cy="13" r="1.6" fill="currentColor"/><path d="M10 7h9M10 13h7M10 18.5h5"/></g></svg>',
    theatres: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z"/></g></svg>',
    explain: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5c2.7-1 5.3-1 8 .8v13c-2.7-1.8-5.3-1.8-8-.8z"/><path d="M20 5.5c-2.7-1-5.3-1-8 .8v13c2.7-1.8 5.3-1.8 8-.8z"/></g></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/></g></svg>',
  };
  const LEFT_TABS = {
    yemen: [['situation', 'Brief', 'brief'], ['fronts-wrap', 'Fronts', 'fronts'], ['cas-wrap', 'Numbers', 'numbers'], ['timeline-wrap', 'Timeline', 'timeline'], ['explain-wrap', 'Explainers', 'explain']],
    iran: [['situation', 'Brief', 'brief'], ['fronts-wrap', 'Arenas', 'fronts'], ['cas-wrap', 'Numbers', 'numbers'], ['timeline-wrap', 'Timeline', 'timeline'], ['explain-wrap', 'Explainers', 'explain']],
    gaza: [['situation', 'Brief', 'brief'], ['cas-wrap', 'Numbers', 'numbers'], ['timeline-wrap', 'Timeline', 'timeline'], ['explain-wrap', 'Explainers', 'explain']],
    all: [['ops-theatres', 'Brief', 'brief']],
  };
  const PAGE_NAME = { all: 'All theatres', iran: 'Iran', yemen: 'Yemen', gaza: 'Gaza – Judea & Samaria' };
  /* The day, plainly: Tue 20 Oct 2026 (20 Oct: a military date-time group read as the 26th). */
  const dayTxt = (t, tz) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
  /* The site's mark: a plotting scope in a room's frame, its sweep in the view's amber. */
  const LOGO = '<svg class="ops-logo" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M3 9V3h6M23 3h6v6M29 23v6h-6M9 29H3v-6"/><circle cx="16" cy="16" r="9.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="16" r="4.6" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/><path class="sw" d="M16 16V6.8a9.2 9.2 0 0 1 8.4 5.45z"/><path stroke="currentColor" stroke-width="1.5" d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3"/><circle class="bl" cx="20.4" cy="11" r="1.5"/></svg>';

  function build() {
    root.classList.add('ops-on');
    shell = root;
    // The status strip: live, the date, the time on the desks' clocks, the last update, the counts.
    strip = document.createElement('div');
    strip.className = 'ops-strip';
    strip.innerHTML = `<span class="ops-live"><i></i>Live</span>
      <span class="ops-sf"><b id="ops-date">${esc(dayTxt(Date.now()))}</b></span>
      ${PAGE !== 'all' ? `<span class="ops-sf"><small>${esc(CAP[PAGE])}</small><b id="ops-local">--:--</b></span>` : `<span class="ops-sf"><small>Sanaa</small><b data-tz="Asia/Aden">--:--</b></span><span class="ops-sf"><small>Tehran</small><b data-tz="Asia/Tehran">--:--</b></span><span class="ops-sf"><small>Jerusalem</small><b data-tz="Asia/Jerusalem">--:--</b></span>`}
      <span class="ops-sf ops-upd"></span>`;
    // No event counts in the strip, the last update at its right end, "Open-source intelligence" under the name (user, 22 Oct).
    // The bar: the mark and name, the theatres, the view's own buttons.
    bar = document.createElement('div');
    bar.className = 'ops-bar';
    const home = document.createElement('a');
    home.className = 'ops-home';
    home.href = '/';
    home.title = 'The Situation Room';
    home.innerHTML = `${LOGO}<span class="sr">The Situation Room</span>`;
    bar.appendChild(home);
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
      ${TRAFFIC ? `<span class="ops-trfw"><button type="button" class="ops-btn" data-op="traffic" aria-pressed="false" title="Live aircraft and ships, on or off (T)"><i class="ops-trfi">${ICON.plane}${ICON.ship}</i><span>Traffic</span></button><button type="button" class="ops-btn ops-ico ops-trfm" data-op="trafmenu" aria-expanded="false" title="Traffic options">${ICON.down}<span class="sr">Traffic options</span></button></span>` : ''}
      <button type="button" class="ops-btn ops-ico" data-op="theme" title="Day or night">${ICON.theme}<span class="sr">Day or night</span></button>
      <button type="button" class="ops-btn ops-ico ops-keysbtn" data-op="keys" title="Keys (?)">${ICON.keys}<span class="sr">Keys</span></button>
      <button type="button" class="ops-btn ops-ico" data-op="settings" title="Settings (,)">${ICON.gear}<span class="sr">Settings</span></button>
      ${document.fullscreenEnabled || inFullFrame ? `<button type="button" class="ops-btn ops-ico" data-op="full" title="Full screen (F)">${ICON.full}<span class="sr">Full screen</span></button>` : ''}`;
    bar.appendChild(acts);
    root.insertBefore(bar, root.firstChild);
    // The desks' tabs give up their names, the other desks' first, rather than run under the buttons (user, 23 Oct).
    const fitTabs = () => {
      const row = $('.dt-row', bar);
      if (!row) return;
      row.classList.remove('dt-tight', 'dt-tighter');
      if (row.scrollWidth > row.clientWidth + 1) row.classList.add('dt-tight');
      if (row.scrollWidth > row.clientWidth + 1) row.classList.add('dt-tighter');
    };
    try { new ResizeObserver(() => requestAnimationFrame(fitTabs)).observe(bar); } catch (e) { addEventListener('resize', fitTabs); }
    fitTabs();
    try { document.fonts.ready.then(fitTabs); } catch (e) { /* the first fit stands */ }
    root.insertBefore(strip, bar);

    // The tool rail and the left panel: the brief's parts.
    const tabs = LEFT_TABS[PAGE].filter(([id]) => id === 'ops-theatres' || document.getElementById(id));
    nav = document.createElement('nav');
    nav.className = 'ops-nav';
    nav.setAttribute('aria-label', 'Panels');
    // Layers sit on the map at its bottom right and Keys in the bar, on every page (user, 21 Oct).
    nav.innerHTML = tabs.map(([id, n, ic]) => `<button type="button" data-tab="${id}" title="${esc(n)}">${NAV_ICON[ic]}<span>${esc(n)}</span></button>`).join('');
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
    // The All page's footer is the tiles' credit, which the map carries already.
    const foot = root.querySelector(':scope > footer');
    if (foot && PAGE === 'all') foot.hidden = true;
    else if (foot) panes.appendChild(foot);
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
    rightEl.innerHTML = `<div class="ops-phead ops-rtabs"><nav class="ops-tabs" role="tablist"><button type="button" role="tab" data-rtab="rep">Reports</button><button type="button" role="tab" data-rtab="ev">Events</button></nav><button type="button" class="ops-fold" data-op="right" title="Close the panel (])">${ICON.right}</button></div>
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
    dock.innerHTML = `<div class="ops-drow ops-dtop"><div class="ops-quick" role="group" aria-label="Show the last"><span>Last</span><button type="button" data-qr="2">48 h</button><button type="button" data-qr="7">7 days</button></div><div class="ops-time"></div><button type="button" class="ops-fold ops-fold-d" data-op="dock" title="Fold the timeline (\\)">${ICON.down}</button></div>
      <div class="ops-drow ops-who"></div>`;
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
    // Map, Brief, Reports, the fronts or arenas, Numbers, Events, Timeline (user, 21 Oct).
    const tab = (id) => tabs.find((x) => x[0] === id);
    const phone = [['map', 'Map'], tab('situation') || tab('ops-theatres'), ['rail', 'Reports'], tab('fronts-wrap'), tab('cas-wrap'), ['events', 'Events'], tab('timeline-wrap'), tab('explain-wrap')].filter(Boolean);
    pt.innerHTML = phone.map(([id, n]) => `<button type="button" data-ptab="${id}">${n}</button>`).join('');
    root.insertBefore(pt, bar.nextSibling);
    pt.addEventListener('scroll', notch, { passive: true });
    addEventListener('resize', notch);
    if (PAGE === 'all') drawTheatres();
    paintFrame();
    if (window.ResizeObserver) new ResizeObserver(sizeDock).observe(dock);
    sizeDock();
    wireFrame();
    wireGrips();
    new MutationObserver(slimSoon).observe(leftEl, { childList: true, subtree: true });
    document.addEventListener('fullscreenchange', () => { paintFrame(); });
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
  /* The span a page opens on: today (the page's own Today), or the last 48 hours or 7 days. */
  function openRange(v) {
    if (v === 'today' || !(Number(v) > 1)) { const t = $('#btn-day-today', root); if (!t) return false; t.click(); S.qr = 0; paintQuick(); return true; }
    return quickRange(Number(v));
  }
  function paintQuick() {
    const on = $('#btn-period', root) && $('#btn-period', root).classList.contains('on');
    dock.querySelectorAll('[data-qr]').forEach((b) => b.setAttribute('aria-pressed', String(on && +b.dataset.qr === S.qr)));
  }
  function sizeDock() {
    if (!dock) return;
    // The map keeps at least 60% of its box, whatever the strip holds.
    const h = isPhone() ? 0 : !S.dock ? dock.offsetHeight : Math.min(dock.offsetHeight, Math.round(mapWrap.clientHeight * (SZ.dh ? 0.75 : 0.4)));
    mapWrap.style.setProperty('--dock-h', h + 'px');
    const m = getMap();
    if (m) try {
      // A panel opened or closed keeps the map on what it showed (user, 27 Oct: the area slid under the opened
      // panel): the whole area stays whole, else the same middle stays in the middle.
      const was = m.getSize(), c = m.getCenter(), b = areaB();
      const whole = !!b && m.getBounds().contains(L.latLngBounds(b));
      m.invalidateSize({ pan: false });
      const now = m.getSize();
      if (was.x && was.y && (was.x !== now.x || was.y !== now.y)) {
        if (whole && !m.getBounds().contains(L.latLngBounds(b))) m.fitBounds(b, { padding: [8, 8], animate: false });
        else m.setView(c, m.getZoom(), { animate: false });
      }
    } catch (e) { /* not yet */ }
  }
  /* On a wide screen the side panels and the strip under the map are as wide or as tall as the reader drags them
     (user, 21 Oct); a double-click on a handle puts it back. Kept per browser (SZ). */
  // The desk's own part of the map: what the page opens on.
  const areaB = () => { const o = (app('DESK_GO') || {})[DESK_PATH[PAGE]]; return o && o.b; };
  /* The map is never narrower than the desk's whole area needs at the map's height (user, 21 Oct: "in max narrow of
     the map we should still see the full area"). */
  function mapMinW() {
    const m = getMap(), b = areaB();
    let need = 380;
    if (m && b) try {
      const B = L.latLngBounds(b), nw = m.project(B.getNorthWest(), 0), se = m.project(B.getSouthEast(), 0);
      const h = mapWrap.clientHeight - (parseFloat(mapWrap.style.getPropertyValue('--dock-h')) || 0) - 16;
      if (h > 120) need = Math.max(need, Math.round(h * (se.x - nw.x) / (se.y - nw.y)) + 16);
    } catch (e) { /* no map yet */ }
    return Math.min(need, innerWidth - 2 * 240 - 56);
  }
  let sizing = '', gripsOn = false;
  function paintSizes() {
    const W = innerWidth;
    if (isPhone()) { root.style.removeProperty('--ops-lw'); root.style.removeProperty('--ops-rw'); }
    else {
      const mid = W <= 1180;
      const defR = mid ? 320 : Math.max(320, Math.min(0.24 * W, 400)), defL = defR + 120;
      const MINL = 260, MINR = 240;
      let lw = Math.max(MINL, SZ.lw || defL), rw = Math.max(MINR, SZ.rw || defR);
      // The panels give way, the one not being dragged first, so the map keeps its whole area.
      let over = (S.left ? lw : 0) + (S.right ? rw : 0) - (W - (nav.offsetWidth || 56) - mapMinW());
      const give = (k) => { if (over <= 0) return; if (k === 'lw' && S.left) { const c = Math.min(over, lw - MINL); lw -= c; over -= c; } if (k === 'rw' && S.right) { const c = Math.min(over, rw - MINR); rw -= c; over -= c; } };
      if (sizing === 'lw') { give('rw'); give('lw'); } else { give(sizing === 'rw' ? 'lw' : 'rw'); give(sizing === 'rw' ? 'rw' : 'lw'); }
      root.style.setProperty('--ops-lw', Math.round(lw) + 'px');
      root.style.setProperty('--ops-rw', Math.round(rw) + 'px');
    }
    dock.style.height = SZ.dh && !isPhone() ? Math.max(90, Math.min(SZ.dh, Math.round(mapWrap.clientHeight * 0.75))) + 'px' : '';
    dock.classList.toggle('ops-dock-sized', !!SZ.dh && !isPhone());
    sizeDock();
  }
  function wireGrips() {
    const grip = (host, cls, title) => { const g = document.createElement('div'); g.className = 'ops-grip ' + cls; g.title = title; g.setAttribute('aria-hidden', 'true'); host.appendChild(g); return g; };
    const parts = [
      [grip(leftEl, 'ops-grip-l', 'Drag to widen or narrow (double-click: back to the start)'), 'lw', (ev, r) => ev.clientX - r.left, leftEl],
      [grip(rightEl, 'ops-grip-r', 'Drag to widen or narrow (double-click: back to the start)'), 'rw', (ev, r) => r.right - ev.clientX, rightEl],
      // On the map's box, not the strip, so it stays on the strip's top edge when the strip scrolls.
      [grip(mapWrap, 'ops-grip-d', 'Drag to make the strip taller or shorter (double-click: back to the start)'), 'dh', (ev, r) => r.bottom - ev.clientY, mapWrap],
    ];
    // A map that showed the desk's whole area still shows all of it after a drag or a new window size.
    let whole = false;
    const wholeShown = () => { const m = getMap(), b = areaB(); try { return !!(m && b && m.getBounds().pad(0.02).contains(L.latLngBounds(b))); } catch (e) { return false; } };
    // Looking at the overview, not zoomed in on a place: no closer than the zoom that fits the area, and centred in it.
    const overview = () => { const m = getMap(), b = areaB(); try { const B = L.latLngBounds(b); return !!(m && b && B.contains(m.getCenter()) && m.getZoom() <= m.getBoundsZoom(B, false, L.point(16, 16)) + 0.5); } catch (e) { return false; } };
    const keepWhole = (was) => { const m = getMap(), b = areaB(); if (!was || !m || !b) return; try { m.invalidateSize({ pan: false }); if (!wholeShown()) m.fitBounds(b, { padding: [8, 8], animate: false }); } catch (e) { /* kept */ } };
    let rzWhole = null, rzT = 0;
    addEventListener('resize', () => { if (rzWhole == null) rzWhole = overview(); clearTimeout(rzT); rzT = setTimeout(() => { keepWhole(rzWhole); rzWhole = null; }, 300); });
    let raf = 0;
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { paintSizes(); drawMatrix(); }); };
    parts.forEach(([g, k, size, box]) => {
      let r = null;
      g.addEventListener('pointerdown', (ev) => { if (ev.button) return; r = box.getBoundingClientRect(); sizing = k; whole = overview(); g.setPointerCapture(ev.pointerId); H.classList.add('ops-sizing'); ev.preventDefault(); });
      g.addEventListener('pointermove', (ev) => { if (!r) return; SZ[k] = Math.round(size(ev, r)); redraw(); });
      const end = () => { if (!r) return; r = null; H.classList.remove('ops-sizing'); paintSizes(); sizing = ''; setTimeout(() => keepWhole(whole), 60); try { localStorage.setItem('ops-sizes', JSON.stringify(SZ)); } catch (e) { /* private */ } };
      g.addEventListener('pointerup', end);
      g.addEventListener('pointercancel', end);
      g.addEventListener('dblclick', () => { delete SZ[k]; redraw(); try { localStorage.setItem('ops-sizes', JSON.stringify(SZ)); } catch (e) { /* private */ } });
    });
    addEventListener('resize', redraw);
    gripsOn = true;
    paintSizes();
  }
  // Between a phone and a wide screen one side panel is open at a time, so the map keeps its room (20 Oct: at
  // 900 pixels both panels left the map 230 pixels).
  const midWidth = () => matchMedia('(min-width:761px) and (max-width:1180px)').matches;
  let lastOpen = 'left';
  function paintFrame() {
    if (midWidth() && S.left && S.right) { if (lastOpen === 'right') S.left = false; else S.right = false; }
    root.classList.toggle('ops-noleft', !S.left);
    root.classList.toggle('ops-noright', !S.right);
    root.classList.toggle('ops-nodock', !S.dock);
    const fd = $('.ops-fold-d', dock);
    if (fd) fd.title = S.dock ? 'Fold the timeline (\\)' : 'Open the timeline (\\)';
    H.classList.toggle('ops-fills', !!S.fills);
    root.dataset.opsPtab = S.ptab;
    root.dataset.opsRtab = S.rtab;
    nav.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(S.left && b.dataset.tab === S.tab)));
    const cur = LEFT_TABS[PAGE].find(([id]) => id === S.tab);
    $('.ops-ptitle', leftEl).textContent = cur ? cur[1] : '';
    leftEl.querySelectorAll('.ops-pane').forEach((p) => p.classList.toggle('on', p.id === S.tab));
    rightEl.querySelectorAll('[data-rtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rtab === S.rtab)));
    root.querySelectorAll('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === S.ptab)));
    paintSlim(true);
    notch();
    if (gripsOn) paintSizes();
    setTimeout(sizeDock, 30);
    setTimeout(sizeDock, 260);
  }
  /* A panel with its own side menu (the fronts or arenas, the numbers, the timeline, the All page's desks): the main
     rail beside it is its icons only, so the two menus do not take the panel's room (user, 21 Oct). */
  const SUB_SEL = '.pager-fronts ~ .pg-dots, .pager-timeline ~ .pg-dots, .num-cat, .ops-subnav';
  /* A brief's map pin sits beside the panel's "Brief" heading on a computer (user, 23 Oct); a phone has no heading
     row, so it stays in the brief. A brief drawn again brings a new pin, and the old one goes. */
  function headPin() {
    const head = $('.ops-phead', leftEl);
    if (!head) return;
    const phone = isPhone();
    head.querySelectorAll('.ops-headpin').forEach((b) => {
      if (!b._home || !b._home.isConnected) b.remove();
      else if (phone || b._pane !== S.tab) { b.classList.remove('ops-headpin'); b._home.appendChild(b); }
    });
    const pane = !phone && S.left && document.getElementById(S.tab);
    const btn = pane && pane.querySelector('.sit-head > .sit-map-btn:not(.front-map-btn)');
    if (!btn) return;
    btn._home = btn.parentElement;
    btn._pane = S.tab;
    btn.classList.add('ops-headpin');
    $('.ops-ptitle', leftEl).after(btn);
  }
  function paintSlim(quiet) {
    headPin();
    const p = S.left && !isPhone() && document.getElementById(S.tab);
    const on = !!(p && p.querySelector(SUB_SEL));
    if (root.classList.contains('ops-slim') === on) return;
    root.classList.toggle('ops-slim', on);
    if (!quiet && gripsOn) paintSizes();
  }
  // A side menu drawn after the panel opened (the All page's desks come with the data), and full screen, check it
  // again (user, 22 Oct: the rail kept its words beside the desks' menu in full screen).
  let slimRaf = 0;
  const slimSoon = () => { cancelAnimationFrame(slimRaf); slimRaf = requestAnimationFrame(() => paintSlim(false)); };
  /* On a phone the side menu is a row under the tabs; a notch in it points up at the tab it belongs to (user, 22 Oct). */
  function notch() {
    if (!isPhone()) return;
    const b = root.querySelector('.ops-ptabs [aria-selected="true"]');
    if (!b) return;
    const r = b.getBoundingClientRect(), l = leftEl.getBoundingClientRect();
    root.style.setProperty('--ops-nx', Math.round(r.left + r.width / 2 - l.left) + 'px');
  }
  function wireFrame() {
    root.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-op],[data-tab],[data-ptab],[data-rtab]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.tab) {
        // The open panel's own button closes it again.
        if (S.left && S.tab === t.dataset.tab && !isPhone()) S.left = false; else { S.tab = t.dataset.tab; S.left = true; lastOpen = 'left'; }
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
      if (op === 'left') { S.left = !S.left; lastOpen = 'left'; keep(); paintFrame(); }
      else if (op === 'right') { S.right = !S.right; lastOpen = 'right'; keep(); paintFrame(); }
      else if (op === 'dock') { S.dock = !S.dock; keep(); paintFrame(); }
      else if (op === 'keys') toggleKeys();
      else if (op === 'theme') { const set = app('setTheme'), nx = app('nextTheme'); if (set && nx) set(nx(app('THEME'))); }
      else if (op === 'layers') toggleLayers();
      else if (op === 'traffic') trafficOnOff();
      else if (op === 'trafmenu') toggleTraffic();
      else if (op === 'settings') openSettings();
      else if (op === 'full') fullScreen();
    });
    leftEl.addEventListener('click', (ev) => {
      const b = ev.target.closest('.ops-subnav [data-th]');
      if (!b) return;
      S.th = b.dataset.th;
      leftEl.querySelectorAll('.ops-subnav [data-th]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      leftEl.querySelectorAll('article.ops-th').forEach((a) => a.classList.toggle('on', a.dataset.th === S.th));
    });
    dock.addEventListener('click', (ev) => {
      const q = ev.target.closest('[data-qr]');
      if (q) quickRange(+q.dataset.qr);
      else if (ev.target.closest('.time-filter button')) { S.qr = 0; setTimeout(paintQuick, 50); }
    });
    rightEl.addEventListener('input', (ev) => { if (ev.target.matches('.ops-evq')) { evQ = ev.target.value.trim().toLowerCase(); drawLog(recent()); } });
    // The column edges, to open a closed panel again: a tab with its name (20 Oct: a bare arrow was barely seen).
    ['left', 'right'].forEach((side) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `ops-unfold ops-unfold-${side}`; b.dataset.op = side;
      const name = side === 'left' ? 'Brief' : 'Reports';
      b.title = side === 'left' ? `Open the ${name.toLowerCase()} ([)` : 'Open the reports and events (])';
      b.innerHTML = `${side === 'left' ? ICON.right : ICON.left}<span>${name}</span>`;
      mapWrap.appendChild(b);
    });
    const ud = document.createElement('button');
    ud.type = 'button'; ud.className = 'ops-unfold ops-unfold-dock'; ud.dataset.op = 'dock'; ud.title = 'Open the timeline (\\)';
    ud.innerHTML = `<span>Time · Who and What · Since the start</span>`;
    mapWrap.appendChild(ud);
    addEventListener('resize', () => { if (midWidth() && S.left && S.right) paintFrame(); sizeDock(); drawMatrix(); });
    // Going to another desk: its tab lights at once and the page shows it is on its way (the page's own
    // link handler, on the document, has already started the move; this runs after it).
    addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[data-desk-go]');
      if (!a || !ev.defaultPrevented || a.getAttribute('aria-current') === 'page') return;
      const to = new URL(a.href, location.href).pathname.replace(/\/+$/, '') || '/';
      root.querySelectorAll('.ops-bar .dt-btn').forEach((b) => { const p = new URL(b.href, location.href).pathname.replace(/\/+$/, '') || '/'; if (p === to) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      H.classList.add('ops-going');
    });
    addEventListener('pageshow', () => H.classList.remove('ops-going'));
  }

  /* The All page's reports: both desks', newest first, and Trump's latest (home.js's own cards). */
  let allRail = null, allTab = 'rep', allN = 60, allQ = '', allMore = true;
  function buildAllRail(into) {
    allRail = document.createElement('div');
    allRail.className = 'rail ops-rail';
    allRail.id = 'ops-rail';
    into.appendChild(allRail);
    allRail.addEventListener('click', async (ev) => {
      const t = ev.target.closest('[data-rt],[data-more]');
      if (!t) return;
      if (t.dataset.rt) { allTab = t.dataset.rt; allN = 60; drawAllRail(); return; }
      // Past the reports the page has: the next page of each desk's, older (every report since 28 Feb).
      const h = window.__home;
      if (allTab === 'rep' && !allQ && allN + 60 > h.D.reports.length && h.older && allMore) {
        t.disabled = true; t.textContent = 'Loading…';
        allMore = await h.older();
      }
      allN += 60; drawAllRail(true);
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
    const body = `<div id="feed" class="feed">${cards || '<p class="ops-empty">Nothing here yet.</p>'}</div>${list.length > allN || (allTab === 'rep' && !allQ && allMore) ? '<button type="button" class="more" data-more>Earlier reports</button>' : ''}`;
    if (listOnly && allRail.querySelector('.ops-rbody')) { allRail.querySelector('.ops-rbody').innerHTML = body; return; }
    allRail.innerHTML = `<div class="ops-seg" role="tablist"><button type="button" role="tab" data-rt="rep" aria-selected="${allTab === 'rep'}">All desks</button><button type="button" role="tab" data-rt="tr" aria-selected="${allTab === 'tr'}">Trump’s latest</button></div>
      <input class="ops-q" type="search" placeholder="Filter: a place, a person, a weapon" value="${esc(allQ)}" aria-label="Filter the reports">
      <div class="ops-rbody">${body}</div>`;
  }

  /* The All page's left panel: each theatre at a glance, from the events and reports the page has. */
  const DESK_INFO = { iran: ['Iran', 'Israel, the US, Iran and its allies', '/iran-conflict-desk'], yemen: ['Yemen', 'The Houthis, the government, the coalition, the Red Sea', '/yemen-conflict-desk'], gaza: ['Gaza – Judea & Samaria', 'Israel, Hamas, the factions and the PA', '/gaza-judea-samaria-desk'] };
  /* Each desk's own brief, its latest developments in short (20 Oct: "make like a brief off of the desk's brief";
     the counts and the bars of sides went). */
  // Drawn again once the briefs are in (27 Oct: the brief stayed on "Loading" until the map's next event).
  window.__opsTheatres = () => { if (PAGE === 'all') drawTheatres(); };
  function drawTheatres() {
    const el = document.getElementById('ops-theatres');
    const h = window.__home;
    if (!el || !h || !h.D) return;
    const briefs = { iran: h.D.ibrief, yemen: h.D.ybrief, gaza: h.D.gbrief };
    const key = JSON.stringify([...Object.values(briefs), h.D.abrief].map((b) => (b ? b.updatedAt || 1 : 0)).concat(h.D.reports.length));
    if (el._k === key) return;
    el._k = key;
    const when = (t) => (t ? `${hm(t, 'Asia/Jerusalem')}, ${dm(t, 'Asia/Jerusalem')}` : '');
    // One brief made from every desk's (user, 23 Oct: "only one brief, from all desks"): each desk's points in its own
    // order of importance, taken in turn, each marked with its desk's flag.
    // Each point with the report it was written from (its first [[n]]), for the desk line under it (user, 27 Oct).
    const lists = Object.keys(DESK_INFO).map((desk) => {
      const s = briefs[desk] && briefs[desk].situation;
      if (s && Array.isArray(s.points) && s.points.length) return s.points.slice(0, 6).map((p) => { const n = /\[\[(\d+)\]\]/.exec(p); const ref = n && (s.refs || [])[+n[1] - 1]; return [desk, String(p).replace(/\s*\[\[\d+\]\]/g, '').trim(), ref && ref.fp]; });
      return (s && s.line ? String(s.line).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).slice(0, 6) : []).map((p) => [desk, p, null]);
    });
    // The site's own order when it has one (user, 27 Oct: "ordered from 01 the most important down to the least"):
    // every desk's points ranked together, the ones not worth a brief left out (all-brief.ts).
    const ranked = h.D.abrief && h.D.abrief.points;
    const pts = ranked && ranked.length ? ranked.map((p) => [p.desk, p.text, p.fp]) : [];
    if (!pts.length) for (let i = 0; i < 6; i++) lists.forEach((l) => { if (l[i]) pts.push(l[i]); });
    pts.splice(12);
    const latest = Object.values(briefs).map((b) => b && b.updatedAt).filter(Boolean).sort().pop();
    const HF = window.__homeFlags || {};
    const more = (fp) => { const r = fp && h.D.reports.find((x) => x.fp === fp); return !!(r && r.more); };
    const flagsOf = (fp) => { const r = fp && h.D.reports.find((x) => x.fp === fp); return (r && r.flags) || []; };
    el.classList.remove('ops-subwrap');
    el.innerHTML = `<article class="ops-th ops-th-one">
        ${latest ? `<p class="ops-th-sub">From the Iran, Yemen and Gaza desks · updated ${esc(when(latest))}</p>` : ''}
        ${pts.length ? `<ol class="ops-th-pts">${pts.map(([desk, p, fp]) => `<li><span class="ops-th-flag">${HF.countryTag ? HF.countryTag(p, desk, flagsOf(fp)) : ''}</span><span class="ops-th-p">${esc(p)}${HF.deskRef ? (fp ? HF.deskRef(desk, fp, more(fp)) : `<a class="x-desk" href="${DESK_INFO[desk][2]}" data-desk-go>On the ${esc(DESK_INFO[desk][0])} desk →</a>`) : ''}</span></li>`).join('')}</ol>` : `<p class="ops-empty">${briefs.iran || briefs.yemen || briefs.gaza ? 'No brief yet for this window.' : 'Loading the brief…'}</p>`}
      </article>`;
  }

  /* ---------- Clocks ---------- */
  function tick() {
    const now = Date.now();
    const z = document.getElementById('ops-date');
    if (z) z.textContent = dayTxt(now, PAGE !== 'all' ? TZ[PAGE] : undefined);
    const l = document.getElementById('ops-local');
    if (l && PAGE !== 'all') l.textContent = hm(now, TZ[PAGE]);
    strip && strip.querySelectorAll('[data-tz]').forEach((b) => { b.textContent = hm(now, b.dataset.tz); });
  }
  function counts() {
    const now = Date.now(), ev = events();
    const n24 = ev.filter((e) => now - Date.parse(e.at) < 864e5).length, n48 = ev.filter((e) => now - Date.parse(e.at) < 1728e5).length;
    const a = document.getElementById('ops-n24'), b = document.getElementById('ops-n48');
    if (a) a.textContent = n24; if (b) b.textContent = n48;
  }

  /* ---------- On the map: place, scale, overview, ruler, rings, link ---------- */
  let hud = null, coordsEl = null, toolLayer = null, last = null;
  function buildHud(m) {
    hud = document.createElement('div');
    hud.className = 'ops-hud';
    hud.innerHTML = `
      <div class="ops-tools" role="toolbar" aria-label="Map tools">
        <button type="button" data-tool="ruler" title="Measure: click points, double-click to end (M)">${ICON.ruler}<span class="sr">Measure</span></button>
        <button type="button" data-tool="rings" title="Range rings: click a place (R)">${ICON.rings}<span class="sr">Range rings</span></button>
        <button type="button" data-do="link" title="Copy a link to this view (L)">${ICON.link}<span class="sr">Link to this view</span></button>
      </div>
      <div class="ops-tooltip" hidden></div>
      <div class="ops-coords" aria-live="off"><span class="ops-ll">Point at the map</span><span class="ops-mgrs"></span></div>
      <div class="ops-toasts" aria-live="polite"></div>
      <div class="ops-card" hidden></div>
      <div class="ops-menu ops-lyr" hidden></div>
      <div class="ops-menu ops-trf" hidden></div>
      <button type="button" data-do="layers" class="ops-lyrbtn" aria-expanded="false" title="Layers: base map, grid, Yemen's control areas (Y)">${NAV_ICON.layers}<span class="sr">Layers</span></button>`;
    mapWrap.appendChild(hud);
    L.DomEvent.disableClickPropagation(hud);
    L.DomEvent.disableScrollPropagation(hud);
    coordsEl = $('.ops-coords', hud);
    try { L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 }).addTo(m); } catch (e) { /* no scale */ }
    m.on('mousemove', (ev) => {
      last = ev.latlng;
      $('.ops-ll', coordsEl).textContent = P.coords === 'dms' ? `${dms(ev.latlng.lat, 'N', 'S')} ${dms(ev.latlng.lng, 'E', 'W')}` : latlon(ev.latlng.lat, ev.latlng.lng);
      $('.ops-mgrs', coordsEl).textContent = P.coords === 'deg' || P.coords === 'dms' ? '' : 'MGRS ' + mgrs(ev.latlng.lat, ev.latlng.lng);
      if (S.tool === 'ruler' && ruler.pts.length) drawRuler(ev.latlng);
    });
    coordsEl.title = 'Click to copy';
    coordsEl.onclick = () => { if (last) copy(`${last.lat.toFixed(5)}, ${last.lng.toFixed(5)} (MGRS ${mgrs(last.lat, last.lng)})`, coordsEl); };
    hud.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-tool],[data-do]');
      if (!t) return;
      if (t.dataset.tool) setTool(S.tool === t.dataset.tool ? null : t.dataset.tool);
      else if (t.dataset.do === 'link') copyLink(t);
      else if (t.dataset.do === 'layers') toggleLayers();
    });
    // The tools' lines in their own pane, over the control colours and at full strength.
    if (!m.getPane('opsTools')) { m.createPane('opsTools'); m.getPane('opsTools').style.zIndex = 640; m.getPane('opsTools').style.pointerEvents = 'none'; }
    toolLayer = L.layerGroup().addTo(m);
    m.on('click', (ev) => {
      if (S.tool === 'ruler') { ruler.pts.push(ev.latlng); drawRuler(); }
      else if (S.tool === 'rings') addRings(ev.latlng);
    });
    m.on('dblclick', (ev) => { if (S.tool === 'ruler') { L.DomEvent.stop(ev); setTool(null, true); } });
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
  // Full screen (user, 27 Oct: "full screen takes time to load"): the page itself goes full screen at once. Only a
  // move to another page while full screen (user, 27 Oct, earlier: moving to another desk left full screen) opens
  // that page in a frame that stays full screen; the pages change inside it and only the button, F or Esc ends it, at
  // the page last open.
  function fullScreen() {
    if (inFullFrame) { try { window.top.__opsExitFull(); } catch (e) { /* the frame was let go */ } return; }
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (H.requestFullscreen) H.requestFullscreen().catch(() => {});
  }
  function fullFrame(href) {
    const f = document.createElement('iframe');
    f.src = href;
    f.allow = 'fullscreen';
    f.title = document.title;
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#0b0e12';
    let on = false;
    const close = () => {
      if (!f.isConnected) return;
      let u = '';
      try { u = f.contentWindow.location.href; } catch (e) { /* not ours */ }
      f.remove();
      window.__opsFull = false;
      document.removeEventListener('fullscreenchange', changed);
      if (u && u !== location.href && u.startsWith(location.origin)) location.href = u;
    };
    const changed = () => { if (document.fullscreenElement === f) on = true; else if (on) close(); };
    window.__opsFull = true;
    window.__opsExitFull = () => { if (document.fullscreenElement) document.exitFullscreen().catch(close); else close(); };
    document.addEventListener('fullscreenchange', changed);
    document.body.appendChild(f);
    if (!f.requestFullscreen) { close(); location.href = href; return; }
    f.requestFullscreen().catch(() => { close(); location.href = href; });
  }
  /** Another page of the site while the page is full screen: in the frame. True when taken. */
  window.__opsGoFull = (href) => {
    if (inFullFrame) return false;
    // The same click seen twice (a link and its desk handler): one frame.
    if (window.__opsFull) return true;
    if (document.fullscreenElement !== H) return false;
    let u;
    try { u = new URL(href, location.href); } catch (e) { return false; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return false;
    fullFrame(u.href);
    return true;
  };
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || ev.defaultPrevented || a.target === '_blank' || a.hasAttribute('download') || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;
    if (window.__opsGoFull(a.href)) ev.preventDefault();
  }, true);




  /* ---------- The whole war, side by side: a column a day since the desk's start (20 Oct: "since 13 Jul on the
     Yemen desk, since 28 Feb on the Iran desk and the All page") ---------- */
  const SPAN = 48 * 3600e3;
  const DAY = 864e5, D_OFF = 3 * 3600e3; // the days of the region's clock (UTC+3)
  const dayOf = (t) => Math.floor((t + D_OFF) / DAY) * DAY - D_OFF;
  let rng = null; // [from, to] picked by dragging, or null
  function recent(withResearched) {
    const now = Date.now();
    return events(withResearched).filter((e) => { const t = Date.parse(e.at); return t > now - SPAN && t <= now + 60e3; });
  }
  // The last 48 hours' events and what hangs on them. The chart of every day by side that stood under the map is
  // gone (user, 27 Oct: "remove diagram below map from site in all pages … its not useful").
  function drawMatrix() {
    if (!dock) return;
    drawLog(recent());
    counts();
    if (PAGE === 'all') drawTheatres();
    dimPins();
  }
  /* Pins outside the days picked fade (the pins drawn one by one; the whole war's canvas is left alone). Each pin
     is matched to its own event by its label and its place. */
  function dimPins() {
    const m = getMap();
    if (!m) return;
    const pane = m.getPane('markerPane');
    if (!rng) { pane.querySelectorAll('.ev.ops-dim').forEach((el) => el.classList.remove('ops-dim')); return; }
    const byLabel = new Map();
    events(true).forEach((e) => { const k = e.label || ''; const l = byLabel.get(k) || []; l.push(e); byLabel.set(k, l); });
    m.eachLayer((l) => {
      if (!(l instanceof L.Marker) || !l.getElement) return;
      const el = l.getElement(), ev = el && el.querySelector('.ev[title]');
      if (!ev) return;
      const cands = byLabel.get(ev.getAttribute('title') || '') || [];
      const ll = l.getLatLng();
      let best = null, bd = Infinity;
      cands.forEach((e) => { const d = ll.distanceTo([e.lat, e.lng]); if (d < bd) { bd = d; best = e; } });
      const t = best && bd < 40000 ? tOf(best) : NaN;
      ev.classList.toggle('ops-dim', !(t >= rng[0] && t < rng[1]));
    });
  }
  /* The days picked go to the map: its period set to them, through the page's own date boxes. */
  const ymdOf = (t) => new Date(t + D_OFF).toISOString().slice(0, 10);
  function pickToMap() {
    if (!rng) return;
    const per = $('#btn-period', root), from = $('#map-date', root), to = $('#map-to', root), box = $('#tf-range', root);
    if (!per || !from || !to) return;
    if (box && box.hidden) per.click();
    from.value = ymdOf(rng[0]);
    to.value = ymdOf(rng[1] - 3600e3);
    to.dispatchEvent(new Event('change', { bubbles: true }));
    S.qr = 0;
    paintQuick();
  }
  /* The whole war's events, read once soon after the page is up (pins only, small), for the chart. */
  function warForChart() {
    const go = () => { try { if (PAGE === 'all') window.__home.loadWar(); else if (PAGE === 'yemen') A('loadAllPins')(); } catch (e) { /* what there is */ } };
    if (window.requestIdleCallback) setTimeout(() => requestIdleCallback(go, { timeout: 4000 }), 5000); else setTimeout(go, 6000);
  }

  /* The events: the hours picked, else the last 48 hours, newest first, filtered; a click goes to the pin and opens its note. */
  /* Every event since the desk's start (20 Oct: Yemen from 13 Jul, Iran and the All page from 28 Feb), newest first; the
     hours picked under the map, when picked. Drawn a page at a time as the reader scrolls; the older ones are read
     from the server only when the reader reaches them. */
  const LOG_FROM = { yemen: Date.parse('2026-07-13T00:00:00+03:00'), iran: Date.parse('2026-02-28T00:00:00+03:00'), gaza: Date.parse('2025-10-10T00:00:00+03:00'), all: Date.parse('2025-10-10T00:00:00+03:00') };
  const LOG_STEP = 100;
  let logList = [], evQ = '', logN = LOG_STEP, logOld = 'no';
  const tOf = (e) => { if (e._t == null) e._t = Date.parse(e.at) || 0; return e._t; };
  /* The researched attacks' words (who, where, the source) are in their own file, read when the list reaches them. */
  const NOTES = { list: null, p: null };
  function notesFor(list) {
    if (!list.some((e) => e.researched && e.ni != null && !e.noted)) return;
    if (NOTES.list) { list.forEach((e) => { const n = e.researched && e.ni != null && !e.noted && NOTES.list[e.ni]; if (n) { [e.rfp, e.place, e.label, e.source, e.url] = n; e.also = (n[5] || []).map(([source, url]) => ({ source, url })); e.noted = true; } }); return; }
    if (NOTES.p) return;
    const v = (() => { try { return /[?&]v=([^&]+)/.exec(document.querySelector('script[src*="/app.js?v="]').src)[1]; } catch (e) { return 'n'; } })();
    NOTES.p = fetch(`/iran-map-notes.json?v=${v}`).then((r) => (r.ok ? r.json() : null)).then((j) => { NOTES.list = (j && j.notes) || []; drawLog(); }).catch(() => { NOTES.list = []; });
  }
  /* The older events, read once when the list's end is reached: the whole war's pins of the page. */
  async function olderEvents() {
    if (logOld !== 'no') return;
    logOld = 'loading';
    try {
      if (PAGE === 'all') await window.__home.loadWar();
      else if (PAGE === 'yemen') await A('loadAllPins')();
    } catch (e) { /* kept as is */ }
    logOld = 'done';
    drawLog();
  }
  function drawLog() {
    const l = rightEl && $('.ops-log-l', rightEl);
    if (!l) return;
    const from = LOG_FROM[PAGE] || 0;
    let pick = events(true).filter((e) => { const t = tOf(e); return rng ? t >= rng[0] && t < rng[1] : t >= from && t <= Date.now() + 60e3; }).sort((a, b) => tOf(b) - tOf(a));
    if (evQ) { notesFor(pick); pick = pick.filter((e) => `${e.label || ''} ${e.place || ''} ${sideOf(e).name} ${kindOf(e).name} ${e.source || ''}`.toLowerCase().includes(evQ)); }
    logList = pick.slice(0, logN);
    notesFor(logList);
    $('.ops-log-n', rightEl).textContent = rng ? `${dm(rng[0] + 4 * 3600e3, 'Asia/Riyadh')}${rng[1] - rng[0] > 864e5 ? '–' + dm(rng[1] - 3600e3, 'Asia/Riyadh') : ''}` : '';
    let day = '';
    const year = new Date().getFullYear();
    l.innerHTML = logList.map((e, i) => {
      const s = sideOf(e), k = kindOf(e);
      const d = dm(e.at, VIEW_TZ());
      const head = d !== day ? `<li class="ops-day">${esc(d)}${new Date(tOf(e)).getFullYear() !== year ? ' ' + new Date(tOf(e)).getFullYear() : ''}</li>` : '';
      day = d;
      return `${head}<li><button type="button" data-ev="${i}" style="--c:${s.c}"><time>${e.dayOnly ? '' : esc(hm(e.at, VIEW_TZ()))}</time><span class="k" title="${esc(k.name)}">${glyph(k.k)}</span><span class="t"><b>${esc(e.label || e.place || k.name)}</b><small>${esc([s.name, k.name, e.label ? e.place : ''].filter(Boolean).join(' · '))}${e.source ? ` · <i>${esc(e.source)}</i>` : ''}</small></span><span class="ops-evpin" title="Show on map">${PIN_ICON}</span></button></li>`;
    }).join('') + (pick.length > logN || (!rng && logOld !== 'done' && !IRAN_LIKE(PAGE)) ? '<li class="ops-log-more"><button type="button" class="more" data-log-more>Earlier events</button></li>' : '') || '<li class="ops-empty">No events here.</li>';
  }
  async function moreLog() {
    const from = LOG_FROM[PAGE] || 0;
    const have = events(true).filter((e) => tOf(e) >= from).length;
    if (logN >= have && logOld !== 'done' && !IRAN_LIKE(PAGE)) await olderEvents();
    logN += LOG_STEP;
    drawLog();
  }
  function wireLog() {
    $('.ops-log-l', rightEl).addEventListener('click', (ev) => {
      if (ev.target.closest('[data-log-more]')) { moreLog(); return; }
      const b = ev.target.closest('[data-ev]');
      if (b) focusEvent(logList[+b.dataset.ev]);
    });
    autoMore(rightEl);
  }
  /* "Earlier" and "Show more" at the end of a list press themselves when the reader scrolls to them: the next page
     is there before they look for it (20 Oct), and nothing is read before then. */
  function autoMore(box) {
    if (!window.IntersectionObserver) return;
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      const b = en.target;
      if (!en.isIntersecting) { b._auto = false; return; }
      if (b.disabled || b._auto) return;
      b._auto = true;
      setTimeout(() => { if (b.isConnected && !b.disabled) b.click(); }, 120);
    }), { rootMargin: '0px 0px 300px 0px' });
    const look = () => box.querySelectorAll('.more, [data-more], [data-log-more]').forEach((b) => { if (!b._io) { b._io = true; io.observe(b); } });
    new MutationObserver(look).observe(box, { childList: true, subtree: true });
    look();
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
  /* Only a pin that is new on the map is flagged (20 Oct): the page's events come in over its first seconds,
     so what it has in its first 25 seconds is what was there already; after that, an event with a place that
     was not there before, from the last six hours, is new. */
  let seen = null, cycle = -1;
  const T0 = Date.now();
  function watch() {
    const list = events().filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number');
    if (!list.length) return;
    if (!seen) seen = new Set();
    if (Date.now() - T0 < 25000) { list.forEach((e) => seen.add(keyOf(e))); return; }
    const fresh = list.filter((e) => !seen.has(keyOf(e)) && Date.now() - Date.parse(e.at) < 6 * 3600e3);
    list.forEach((e) => seen.add(keyOf(e)));
    // One card with pins at two places is one notice (user, 23 Oct: "why 2 pins same"); each pin still pings.
    const told = new Set();
    const once = fresh.sort((a, b) => (a.at < b.at ? 1 : -1)).filter((e) => { const k = `${e.url || ''}|${e.label || ''}`; if (told.has(k)) return false; told.add(k); return true; });
    if (P.alerts) { once.slice(0, 3).forEach(toast); fresh.slice(0, 6).forEach(ping); }
    if (fresh.length && P.sound && P.alerts) beep();
    if (fresh.length) { drawMatrix(); if (PAGE === 'all') drawAllRail(); }
  }
  function toast(e) {
    const box = $('.ops-toasts', hud);
    const s = sideOf(e), k = kindOf(e);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ops-toast';
    b.title = 'Go to it on the map';
    b.innerHTML = `<span class="k" style="--c:${s.c}">${glyph(k.k)}</span><span class="t"><small>New on the map · ${esc(hm(e.at, VIEW_TZ()))}</small>${esc(e.label || k.name)}</span>`;
    b.onclick = () => { focusEvent(e); b.remove(); };
    box.prepend(b);
    while (box.children.length > 3) box.lastChild.remove();
    // Only whole notes: an older one that no longer fits above the newest goes (user, 27 Oct: they were cut).
    while (box.children.length > 1 && box.scrollHeight > box.clientHeight + 1) box.lastChild.remove();
    setTimeout(() => b.classList.add('out'), 12000);
    setTimeout(() => b.remove(), 12600);
  }
  let actx = null;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.0001, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, actx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.35);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.4);
    } catch (e) { /* no sound */ }
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
  /* Two panels, each with its own things (20 Oct: the layers and the traffic were one menu): Layers is the map
     itself (base, names, grid, shading), Traffic is what moves on it (aircraft, ships). */
  function toggleLayers(force) {
    const menu = $('.ops-lyr', hud);
    if (!menu) return;
    const open = force != null ? force : menu.hidden;
    menu.hidden = !open;
    root.querySelectorAll('[data-op="layers"], .ops-lyrbtn').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) { if (isPhone()) toggleTraffic(false); paintLayers(); }
  }
  function toggleTraffic(force) {
    const menu = $('.ops-trf', hud);
    if (!menu) return;
    const open = force != null ? force : menu.hidden;
    menu.hidden = !open;
    root.querySelectorAll('[data-op="traffic"]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) {
      if (isPhone()) toggleLayers(false);
      paintTraffic();
    }
  }
  /* The Traffic button: the aircraft and the ships on, or off again (20 Oct); its arrow opens the options. */
  function trafficOnOff(force) {
    const on = force != null ? force : !(S.air || S.sea);
    S.air = on; S.sea = on;
    if (!on) { T.sel = null; T.route = null; paintSel(); }
    keep(); runTraffic(); drawTraffic(); paintTraffic();
  }
  const sw = (k, on, label, sub, extra = '') => `<label class="ops-sw ${extra}"><input type="checkbox" data-ly="${k}" ${on ? 'checked' : ''} ${/off/.test(extra) ? 'disabled' : ''}><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</label>`;
  function paintLayers() {
    const menu = $('.ops-lyr', hud);
    if (!menu || menu.hidden) return;
    menu.innerHTML = `<div class="ops-mh"><b>Layers</b><button type="button" class="ops-x" data-ly="close" aria-label="Close">${ICON.x}</button></div>
      <p class="ops-mlab">Base map</p>
      <div class="ops-bases">${BASES.map(([k, n, s]) => `<button type="button" data-base="${k}" aria-pressed="${S.base === k}" title="${esc(s)}"><i class="ops-bthumb ${k}"></i>${esc(n)}</button>`).join('')}</div>
      <p class="ops-mlab">On the map</p>
      ${sw('grid', S.grid, 'Grid', 'Latitude and longitude, named at the edges')}
      ${sw('fills', S.fills, "Sides' colours", 'Who holds what, in each side’s colour')}`;
  }
  function paintTraffic() {
    const menu = $('.ops-trf', hud);
    if (!menu || menu.hidden) return;
    const mil = T.air.filter((a) => a[13] && (S.airGround || !a[16]));
    const ground = T.air.filter((a) => a[16]).length;
    const seaNo = T.seaOk === false;
    // Only the counts (20 Oct: "no need for all the explanations in that menu").
    const est = T.air.filter((a) => a[21] === 1).length;
    const airTxt = S.air ? (T.at ? `<b>${(T.air.length - ground).toLocaleString('en-GB')}</b> in the air${est ? `, ${est.toLocaleString('en-GB')} of them estimated` : ''}` : 'Loading…') : '';
    const seaTxt = seaNo ? 'Not connected yet' : S.sea ? (T.seaAt ? `<b>${T.ships.length.toLocaleString('en-GB')}</b> ships` : 'Loading…') : '';
    menu.innerHTML = `<div class="ops-mh"><b>Traffic</b><button type="button" class="ops-x" data-ly="close" aria-label="Close">${ICON.x}</button></div>
      ${sw('air', S.air, `${ICON.plane}Aircraft`, airTxt)}
      ${sw('mil', S.airMil, 'Military only', S.air ? `${mil.length} now` : '', `sub ${S.air ? '' : 'off'}`)}
      ${sw('gnd', S.airGround, 'On the ground too', '', `sub ${S.air ? '' : 'off'}`)}
      ${sw('sea', S.sea && !seaNo, `${ICON.ship}Ships`, seaTxt, seaNo ? 'off' : '')}
      ${S.air && mil.length ? `<div class="ops-mil"><p>Military aircraft now</p><ul>${mil.slice(0, 80).map((a) => `<li><button type="button" data-hex="${esc(a[0])}"><b>${esc(a[8] || a[9] || a[0])}</b><span>${esc(a[11] || a[10] || '')}</span><em>${a[16] ? 'GND' : a[3] != null ? esc(fl(a[3])) : ''}</em></button></li>`).join('')}</ul></div>` : ''}`;
  }
  const fl = (ft) => (ft >= 18000 ? 'FL' + String(Math.round(ft / 100)).padStart(3, '0') : `${ft.toLocaleString('en-GB')} ft`);
  function wireTraffic() {
    [$('.ops-lyr', hud), $('.ops-trf', hud)].forEach((menu) => {
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
        drawTraffic(); paintLayers(); paintTraffic();
      });
      menu.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-ly="close"]')) { if (menu.classList.contains('ops-lyr')) toggleLayers(false); else toggleTraffic(false); }
        const bb = ev.target.closest('[data-base]');
        if (bb) { S.base = bb.dataset.base; keep(); drawBase(); drawTraffic(); paintLayers(); }
        const h = ev.target.closest('[data-hex]');
        if (h) { const a = T.air.find((x) => x[0] === h.dataset.hex); if (a) { selectAc(a, true); if (isPhone()) toggleTraffic(false); } }
      });
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
    // Both feeds at once, each drawn as it lands.
    const sea = S.sea && T.seaOk !== false ? pull('sea') : null;
    if (S.air) {
      const j = await pull('air');
      if (j && j.ok) {
        T.air = j.ac || []; T.at = j.at; T.airT = Date.parse(j.at) || Date.now(); T.src = j.src || T.src;
        if (j.ships === false) T.seaOk = false;
        const now = Date.now();
        T.air.forEach((a) => { const tr = T.trail.get(a[0]) || []; const p = tr[tr.length - 1]; if (!p || p[0] !== a[1] || p[1] !== a[2]) tr.push([a[1], a[2], now]); if (tr.length > 60) tr.shift(); T.trail.set(a[0], tr); });
        for (const [k, tr] of T.trail) if (now - tr[tr.length - 1][2] > 20 * 60e3) T.trail.delete(k);
      }
    }
    if (sea) {
      if (S.air) { drawTraffic(); paintTraffic(); }
      const j = await sea;
      if (j && j.ok) { T.ships = j.ships || []; T.seaAt = j.at; T.seaNote = j.note || ''; T.seaOk = true; } else if (j && j.note === 'no-key') T.seaOk = false;
    }
    drawTraffic(); paintTraffic();
    if (T.sel) refreshSel();
  }
  function runTraffic() {
    clearInterval(T.timer);
    T.timer = null;
    if (S.air || S.sea) { airTick(); T.timer = setInterval(airTick, AIR_MS); }
    const tb = $('[data-op="traffic"]', bar);
    if (tb) { tb.classList.toggle('on', S.air || S.sea); tb.setAttribute('aria-pressed', String(S.air || S.sea)); }
    clearInterval(T.anim); T.anim = 0;
    if (S.air || S.sea) T.anim = setInterval(moveTraffic, isPhone() ? 2000 : 1000);
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
        // An estimate (out of every receiver's reach, moved on along its route) is drawn faint.
        ctx.globalAlpha = o.est ? 0.42 : o.gnd ? 0.6 : 1;
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
    // The new marks go on before the old come off: the canvas is never blank between them (20 Oct: the map flinched at each zoom).
    const old = T.layer;
    T.layer = L.layerGroup();
    T.marks = [];
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
      const mk = new Mk([a[1], a[2]], { renderer: T.rend, radius: 9, hdg: a[5], vec: a[16] ? 0 : vecOf(a[4]), ink: emg ? I.emg : a[13] ? I.mil : I.civ, edge: I.edge, selInk: I.sel, big: !!a[13] || emg, gnd: !!a[16], est: a[21] === 1, tag, sel, stroke: false, fill: true, interactive: false });
      // Where it was when last heard (row 17: seconds before the feed's time), to move it on at its speed.
      T.marks.push({ ll: [a[1], a[2]], air: a, mk, t: a[18] ? a[18] * 1000 : (T.airT || Date.now()) - (Number(a[17]) || 0) * 1000, kt: a[16] ? 0 : Number(a[4]) || 0, hdg: a[5] });
      T.layer.addLayer(mk);
    });
    if (S.sea) T.ships.forEach((s) => {
      const sel = T.sel && T.sel.kind === 'sea' && T.sel.id === s[0];
      const tag = z >= 9 ? s[1] || '' : '';
      const mk = new Mk([s[2], s[3]], { renderer: T.rend, radius: 9, hdg: s[6] != null ? s[6] : s[5], vec: s[4] > 0.5 ? vecOf(s[4]) * 10 : 0, ink: shipInk(s[8], I), edge: I.edge, selInk: I.sel, ship: true, tag, sel, stroke: false, fill: true, interactive: false });
      T.marks.push({ ll: [s[2], s[3]], sea: s, mk, t: s[14] ? s[14] * 1000 : Date.parse(s[13]) || Date.now(), kt: s[4] > 0.5 ? Number(s[4]) : 0, hdg: s[5] != null ? s[5] : s[6] });
      T.layer.addLayer(mk);
    });
    // The picked aircraft's or ship's route, when shown: where it flew or sailed, and on to where it is going.
    if (T.sel && T.route && T.route.show && T.route.id === T.sel.id && T.route.d) drawRoute(T.layer, T.route.d, I);
    else if (T.sel && T.sel.kind === 'air') {
      const tr = T.trail.get(T.sel.id);
      if (tr && tr.length > 1) L.polyline(tr.map((p) => [p[0], p[1]]), { pane: 'opsTraffic', color: I.sel, weight: 1.5, opacity: 0.75, dashArray: '4 4', interactive: false }).addTo(T.layer);
    }
    T.layer.addTo(m);
    if (old) m.removeLayer(old);
    moveTraffic();
  }
  /* Each aircraft and ship moves on at its own live speed and heading between the feed's reads (20 Oct: "move
     according to their real speed"): from where it was last heard, for as long as since then (two minutes at most). */
  const R_M = 6371008.8;
  function ahead(lat, lng, hdg, m) {
    const d = m / R_M, b = rad(hdg), p1 = rad(lat), l1 = rad(lng);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
  }
  function moveTraffic() {
    if (!T.marks || document.hidden || P.still) return;
    const now = Date.now();
    for (const k of T.marks) {
      if (!k.kt || k.hdg == null || !k.mk) continue;
      const src = k.air ? [k.air[1], k.air[2]] : [k.sea[2], k.sea[3]];
      const sec = Math.min(120, Math.max(0, (now - k.t) / 1000));
      k.ll = ahead(src[0], src[1], k.hdg, k.kt * 0.514444 * sec);
      k.mk.setLatLng(k.ll);
    }
  }
  /* A route: the track flown or sailed (solid), on from where it is now to where it is going (dashed). */
  function drawRoute(layer, d, I) {
    const st = { pane: 'opsTraffic', interactive: false };
    const tr = (d.track || []).filter((p) => p && p[0] != null).map((p) => [p[0], p[1]]);
    const k = (T.marks || []).find((x) => (x.air ? x.air[0] : x.sea && x.sea[0]) === T.sel.id);
    const here = k ? k.ll : tr[tr.length - 1];
    const o = d.origin, t = d.destination;
    if (o && o.lat != null && tr.length && distKm({ lat: o.lat, lng: o.lon }, { lat: tr[0][0], lng: tr[0][1] }) > 30) L.polyline(arc([o.lat, o.lon], tr[0]), { ...st, color: I.sel, weight: 1.5, opacity: 0.5, dashArray: '2 5' }).addTo(layer);
    else if (o && o.lat != null && !tr.length && here) L.polyline(arc([o.lat, o.lon], here), { ...st, color: I.sel, weight: 1.5, opacity: 0.5, dashArray: '2 5' }).addTo(layer);
    if (tr.length > 1) L.polyline(here ? [...tr, here] : tr, { ...st, color: I.sel, weight: 2, opacity: 0.85 }).addTo(layer);
    if (t && t.lat != null && here) L.polyline(arc(here, [t.lat, t.lon]), { ...st, color: I.sel, weight: 1.6, opacity: 0.7, dashArray: '6 6' }).addTo(layer);
    [o, t].forEach((a) => { if (a && a.lat != null) L.circleMarker([a.lat, a.lon], { ...st, radius: 4, color: I.sel, weight: 2, fillColor: I.edge, fillOpacity: 1 }).addTo(layer); });
  }
  /* The great circle between two points, in short steps (a long flight's line bends as on a globe). */
  function arc(a, b) {
    const out = [], n = 48, p1 = rad(a[0]), l1 = rad(a[1]), p2 = rad(b[0]), l2 = rad(b[1]);
    const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
    if (!d) return [a, b];
    for (let i = 0; i <= n; i++) {
      const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
      out.push([(Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI, (Math.atan2(y, x) * 180) / Math.PI]);
    }
    return out;
  }
  /* Where a flight or a voyage came from and is going, and its track (/api/traffic?route=), kept five minutes. */
  const ROUTES = new Map();
  function routeOf(kind, id, cs) {
    const key = kind + '|' + id;
    const had = ROUTES.get(key);
    if (had && Date.now() - had.at < 5 * 60e3) return had.p;
    const q = kind === 'sea' ? '/api/traffic?kind=sea&mmsi=' + encodeURIComponent(id) : '/api/traffic?route=' + encodeURIComponent(id) + (cs ? '&cs=' + encodeURIComponent(String(cs).trim()) : '');
    const pr = fetch(q).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    ROUTES.set(key, { at: Date.now(), p: pr });
    return pr;
  }
  const SQUAWK = { 7500: 'Hijack', 7600: 'Radio failure', 7700: 'Emergency' };
  function selectAc(a, fly) {
    T.sel = { kind: 'air', id: a[0] };
    const m = getMap();
    if (fly) m.flyTo([a[1], a[2]], Math.max(m.getZoom(), 7), { duration: 0.7 });
    loadRoute('air', a[0], a[8]); drawTraffic();
  }
  function selectShip(s) { T.sel = { kind: 'sea', id: s[0] }; loadRoute('sea', s[0]); drawTraffic(); }
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
      // The route answer's details (21 Oct: "as many details as Flightradar24"): the airline and the flight number as
      // sold, the airframe's maker, owner and the owner's country.
      const d = T.route && T.route.id === a[0] && T.route.d ? T.route.d : null;
      const al = d && d.airline, fr = d && d.airframe;
      const cs = String(a[8] || '').trim();
      const title = d && d.flightNo && d.flightNo !== cs ? `${d.flightNo} <small>${esc(cs)}</small>` : esc(cs || a[9] || a[0].toUpperCase());
      const sub = [al ? `${flagImg(al.iso)}${esc(al.name)}` : esc(a[12] || ''), esc(a[11] || a[10] || '')].filter(Boolean).join(' · ');
      const kind = fr && (fr.maker || fr.type) ? [fr.maker, fr.type].filter(Boolean).join(' ') : a[11] || a[10] || '';
      // One screen, no scrolling (20 Oct): the photo beside the name, where from and where to, the figures in three columns.
      html = `<div class="ops-ch"><span class="ops-ck ${a[13] ? 'mil' : ''}">${ICON.plane}${a[13] ? 'Military' : 'Aircraft'}</span><button type="button" class="ops-x" data-sel="x" aria-label="Close">${ICON.x}</button></div>
        <div class="ops-chead"><div class="ops-photo" data-hex="${esc(a[0])}"></div><div><h3>${title}</h3><p class="ops-csub">${sub}</p></div></div>
        ${a[21] === 1 ? `<p class="ops-est">Estimated position: out of receivers' reach for ${esc(Math.max(1, Math.round((Number(a[17]) || 0) / 60)))} min, moved on along its route at its last speed</p>` : ''}
        ${routeBox('air', a[0])}
        <dl>${row('Altitude', a[16] ? 'Ground' : a[3] != null ? esc(fl(a[3])) : '')}${row('Speed', a[4] != null ? `${a[4]} kt` : '')}${row('Heading', a[5] != null ? `${String(a[5]).padStart(3, '0')}°` : '')}${row('Climb', a[6] ? `${a[6] > 0 ? '+' : ''}${a[6].toLocaleString('en-GB')} ft/m` : '')}${row('Squawk', sq)}${row('Reg.', esc(a[9] || (fr && fr.reg) || String(a[0]).toUpperCase()))}${row('Mode S', esc(String(a[0]).toUpperCase()))}${row('Seen', esc(a[17] != null ? (a[17] < 60 ? `${a[17]} s ago` : `${Math.round(a[17] / 60)} min ago`) : ''))}${row('Source', esc({ fi: 'adsb.fi', lol: 'adsb.lol', os: 'OpenSky' }[a[20]] || ''))}</dl>
        ${kind || (fr && fr.owner) ? `<dl class="ops-wide">${row('Aircraft', esc(kind))}${row('Owner', fr && fr.owner ? `${flagImg(fr.ownerIso)}${esc(fr.owner)}` : '')}</dl>` : ''}
        <p class="ops-clinks"><a href="https://globe.adsb.fi/?icao=${esc(a[0])}" target="_blank" rel="noopener">adsb.fi ${ICON.ext}</a>${a[8] ? `<a href="https://www.flightradar24.com/${esc(String(a[8]).trim())}" target="_blank" rel="noopener">Flightradar24 ${ICON.ext}</a>` : ''}</p>`;
    } else {
      const s = T.ships.find((x) => x[0] === T.sel.id);
      if (!s) return;
      // 21 Oct (user: "look how many details on each vessel" on MarineTraffic): the flag, a photo by its IMO number,
      // draught, size, IMO and call sign, where it left and when, where it is going and its ETA, and the past track.
      const flag = s[18] ? `${flagImg(s[18])}${esc(country(s[18]))}` : '';
      // 22 Oct: the Hormuz monitor's own category ("Crude Oil Tanker") when it gave one; its deadweight; whose position.
      const kindOf = s[19] || SHIP_TYPE(s[8]);
      html = `<div class="ops-ch"><span class="ops-ck">${ICON.ship}${esc(kindOf || 'Ship')}</span><button type="button" class="ops-x" data-sel="x" aria-label="Close">${ICON.x}</button></div>
        <div class="ops-chead"><div class="ops-photo" data-imo="${esc(s[11] || '')}" data-hex="ship-${esc(s[0])}"></div><div><h3>${esc(s[1] || 'MMSI ' + s[0])}</h3><p class="ops-csub">${[flag, esc(kindOf || '')].filter(Boolean).join(' · ')}</p></div></div>
        ${routeBox('sea', s[0], s[9])}
        <dl>${row('Speed', s[4] != null ? `${s[4]} kt` : '')}${row('Course', s[5] != null ? `${Math.round(s[5])}°` : '')}${row('Heading', s[6] != null ? `${Math.round(s[6])}°` : '')}${row('Status', esc(NAV[s[7]] || ''))}${row('Draught', s[16] ? `${s[16]} m` : '')}${row('Size', s[12] ? `${s[12]}${s[17] ? ' × ' + s[17] : ''} m` : '')}${row('Deadweight', s[20] ? `${Math.round(s[20]).toLocaleString('en-GB')} t` : '')}${row('IMO', esc(s[11] || ''))}${row('MMSI', esc(s[0]))}${row('Call sign', esc(s[10] || ''))}${row('Seen', esc(ago(s[13])))}${row('Source', s[21] === 'hz' ? '<a href="https://hormuz.data-tracking.net/" target="_blank" rel="noopener">Hormuz Ship Monitor</a>' : s[21] === 'ais' ? 'AISStream' : '')}</dl>
        <p class="ops-clinks"><a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${esc(s[0])}" target="_blank" rel="noopener">MarineTraffic ${ICON.ext}</a><a href="${s[11] ? 'https://www.vesselfinder.com/vessels/details/' + esc(s[11]) : 'https://www.vesselfinder.com/?mmsi=' + esc(s[0])}" target="_blank" rel="noopener">VesselFinder ${ICON.ext}</a></p>`;
    }
    // The card is drawn again every ten seconds: the photo found once is kept.
    const ph = $('.ops-photo', card);
    const keepPh = ph && card._ph && card._ph.hex === ph.dataset.hex ? card._ph.html : null;
    card.innerHTML = html;
    card.hidden = false;
    const ph2 = $('.ops-photo', card);
    if (ph2) { if (keepPh != null) ph2.innerHTML = keepPh; else photoOf(ph2.dataset.hex, card, ph2.dataset.imo); }
  }
  /* A small flag (flagcdn.com's free flag images; Windows shows no flag emoji) and a country's name in English. */
  const flagImg = (iso) => (iso && /^[A-Za-z]{2}$/.test(iso) ? `<img class="ops-flag" src="https://flagcdn.com/w40/${iso.toLowerCase()}.png" alt="" width="16" height="12" loading="lazy">` : '');
  let REGION = null;
  const country = (iso) => { try { REGION = REGION || new Intl.DisplayNames(['en'], { type: 'region' }); return REGION.of(String(iso).toUpperCase()) || iso; } catch (e) { return iso; } };
  /* Where from, where to, and the route on the map at a click: read once when a mark is picked (/api/traffic?route=). */
  const place = (x) => (x ? `<b>${esc(x.iata || x.icao || x.locode || '')}</b><span>${esc(x.city || x.name || '')}</span>` : '<b>—</b><span>Not known</span>');
  function routeBox(kind, id, aisTo) {
    const r = T.route && T.route.id === id ? T.route : null;
    const d = r && r.d;
    if (!r || r.loading) return `<div class="ops-route"><p class="ops-rline"><span class="ops-rwait">Finding where it came from and where it is going…</span></p></div>`;
    const to = d && d.destination ? d.destination : aisTo ? { name: aisTo } : null;
    // Ships: shown with their past track only (21 Oct: the route button came back once the desk kept twelve hours of it).
    const known = d && (kind === 'air' ? d.origin || d.destination || (d.track && d.track.length > 1) : d.track && d.track.length > 2);
    return `<div class="ops-route"><p class="ops-rline"><span class="ops-rp">${place(d && d.origin)}</span><i aria-hidden="true">${ICON.right}</i><span class="ops-rp">${place(to)}</span></p>
      ${routeTimes(kind, id, d)}
      ${known ? `<button type="button" class="ops-rbtn" data-route aria-pressed="${!!r.show}">${r.show ? 'Hide the route' : kind === 'air' ? 'Show the route on the map' : 'Show the past track'}</button>` : ''}
      ${d && d.source && d.source.length ? `<small>${esc([].concat(d.source).slice(0, 2).map((x) => String(x).replace(/ *\(.*\)/, '')).join(', '))}${d.confidence && d.confidence !== 'confirmed' ? ' · ' + esc(d.confidence) : ''}</small>` : ''}</div>`;
  }
  /* Under the route: for a flight, how far it has flown, how far is left and when it should land at its speed; for a
     ship, when it left (where it lay still last) and the ETA its crew set. */
  function routeTimes(kind, id, d) {
    if (!d) return '';
    const bits = [];
    const tz = VIEW_TZ();
    if (kind === 'air') {
      const a = T.air.find((x) => x[0] === id);
      const o = d.origin, t = d.destination;
      if (a && o && t && o.lat != null && t.lat != null && !a[16]) {
        const here = { lat: a[1], lng: a[2] };
        const done = distKm({ lat: o.lat, lng: o.lon }, here), left = distKm(here, { lat: t.lat, lng: t.lon });
        bits.push(`${Math.round(done).toLocaleString('en-GB')} km flown`, `${Math.round(left).toLocaleString('en-GB')} km to go`);
        if (a[4] > 120 && left > 5) bits.push(`lands about ${hm(Date.now() + (left / (a[4] * 1.852)) * 3600e3 + 10 * 60e3, tz)}`);
      }
    } else {
      const o = d.origin, t = d.destination;
      if (o && o.left) bits.push(`left ${hm(Date.parse(o.left), tz)}, ${esc(dm(Date.parse(o.left), tz))}`);
      if (t && t.eta) bits.push(`ETA ${hm(Date.parse(t.eta), tz)}, ${esc(dm(Date.parse(t.eta), tz))}`);
    }
    return bits.length ? `<p class="ops-rtimes">${bits.join(' · ')}</p>` : '';
  }
  async function loadRoute(kind, id, cs) {
    T.route = { id, kind, loading: true, show: false };
    paintSel();
    const d = await routeOf(kind, id, cs);
    if (!T.route || T.route.id !== id) return;
    T.route = { id, kind, d: d && d.ok !== false ? d : null, show: false };
    paintSel();
  }
  /* A photo of the airframe, from Planespotters' open photo service, credited and linked. */
  const PHOTOS = new Map();
  async function photoOf(hex, card, imo) {
    let html = PHOTOS.get(hex);
    if (html == null) {
      html = '';
      try {
        if (hex.startsWith('ship-')) html = imo ? await shipPhoto(imo) : '';
        else {
          const r = await fetch(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(hex)}`);
          const j = r.ok ? await r.json() : null;
          const p = j && j.photos && j.photos[0];
          if (p && p.thumbnail_large) html = `<a href="${esc(p.link)}" target="_blank" rel="noopener"><img src="${esc(p.thumbnail_large.src)}" alt="" loading="lazy"><small>Photo: ${esc(p.photographer || 'Planespotters.net')}</small></a>`;
          else {
            // None there: the photo adsbdb lists for the airframe (airport-data.com), once the route answer has it.
            const d = await routeOf('air', hex);
            const f = d && d.airframe;
            if (f && (f.thumb || f.photo)) html = `<a href="${esc(f.photo || f.thumb)}" target="_blank" rel="noopener"><img src="${esc(f.thumb || f.photo)}" alt="" loading="lazy"><small>Photo: airport-data.com</small></a>`;
          }
        }
      } catch (e) { /* none */ }
      PHOTOS.set(hex, html);
    }
    card._ph = { hex, html };
    const el = $(`.ops-photo[data-hex="${CSS.escape(hex)}"]`, card);
    if (el) el.innerHTML = html;
  }
  /* A ship's photo from Wikimedia Commons, where ships are filed by their IMO number ("Category:IMO 9321483": the
     photos, or the ship's own category holding them); credited and linked. Free and open to any page. */
  async function shipPhoto(imo) {
    const api = (q) => fetch('https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + q).then((r) => (r.ok ? r.json() : null));
    const files = (cat) => api('action=query&generator=categorymembers&gcmtype=file&gcmlimit=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&iiextmetadatafilter=Artist&gcmtitle=' + encodeURIComponent(cat));
    let j = await files('Category:IMO ' + imo);
    let pages = j && j.query && j.query.pages;
    if (!pages) {
      const c = await api('action=query&list=categorymembers&cmtype=subcat&cmlimit=1&cmtitle=' + encodeURIComponent('Category:IMO ' + imo));
      const sub = c && c.query && c.query.categorymembers && c.query.categorymembers[0];
      if (sub) { j = await files(sub.title); pages = j && j.query && j.query.pages; }
    }
    const pg = pages && Object.values(pages)[0], ii = pg && pg.imageinfo && pg.imageinfo[0];
    if (!ii || !ii.thumburl) return '';
    const by = ii.extmetadata && ii.extmetadata.Artist ? String(ii.extmetadata.Artist.value).replace(/<[^>]*>/g, '').trim().slice(0, 40) : '';
    return `<a href="${esc(ii.descriptionurl)}" target="_blank" rel="noopener"><img src="${esc(ii.thumburl)}" alt="" loading="lazy"><small>Photo: ${esc(by || 'Wikimedia Commons')}</small></a>`;
  }
  function closeSel() { T.sel = null; T.route = null; paintSel(); drawTraffic(); }
  /* The route on the map, or off again; shown, the map takes in the whole of it. */
  function toggleRoute() {
    if (!T.route || !T.route.d) return;
    T.route.show = !T.route.show;
    paintSel(); drawTraffic();
    if (!T.route.show) return;
    const d = T.route.d, pts = (d.track || []).map((p) => [p[0], p[1]]);
    [d.origin, d.destination].forEach((x) => { if (x && x.lat != null) pts.push([x.lat, x.lon]); });
    const k = (T.marks || []).find((x) => (x.air ? x.air[0] : x.sea && x.sea[0]) === T.sel.id);
    if (k) pts.push(k.ll);
    if (pts.length > 1) try { getMap().flyToBounds(pts, { padding: [40, 40], maxZoom: 8, duration: 0.8 }); } catch (e) { /* no bounds */ }
  }
  /* A click on an aircraft or a ship opens its details (20 Oct: clicks did not reach them). The marks are drawn on
     one canvas that lets the map's own clicks through, so the click is measured here first: the nearest mark
     within 14 pixels takes it, and the pin or province under it does not. */
  function trafficAt(m, ev) {
    if (!T.marks || !T.marks.length || S.tool) return null;
    const r = m.getContainer().getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 14 * 14;
    for (const k of T.marks) {
      const p = m.latLngToContainerPoint(k.ll);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function wireTrafficClicks(m) {
    const box = m.getContainer();
    // A press on the map itself closes the Layers and the Traffic menus (user, 22 Oct).
    let down = null;
    box.addEventListener('pointerdown', (ev) => {
      down = { x: ev.clientX, y: ev.clientY };
      if (ev.target.closest('.leaflet-control, .ops-hud > *')) return;
      if (!$('.ops-lyr', hud).hidden) toggleLayers(false);
      if (!$('.ops-trf', hud).hidden) toggleTraffic(false);
    });
    box.addEventListener('click', (ev) => {
      if (ev.target.closest('.leaflet-control, .ops-hud > *, .leaflet-popup, .ev-wrap')) return;
      const k = trafficAt(m, ev);
      // A click on the map away from any aircraft or ship closes the open card (user, 22 Oct); a drag does not.
      if (!k) { if (T.sel && down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 6) closeSel(); return; }
      ev.stopPropagation(); ev.preventDefault();
      if (k.air) selectAc(k.air); else selectShip(k.sea);
    }, true);
    let raf = 0;
    box.addEventListener('mousemove', (ev) => {
      if (raf || !T.marks || !T.marks.length) return;
      raf = requestAnimationFrame(() => { raf = 0; box.classList.toggle('ops-over-trf', !!trafficAt(m, ev)); });
    });
  }

  /* ---------- Keys ---------- */
  const KEYS = [['Space', 'The latest event, then the one before'], ['T', 'Live traffic on or off: aircraft and ships'], ['Y', 'Layers: the map itself'], ['G', 'Grid'], ['S', 'Base map: plain, satellite, relief'], ['M', 'Measure a distance'], ['R', 'Range rings'], ['L', 'Copy a link to this view'], ['F', 'Full screen'], [',', 'Settings'], ['[  ]', 'Close or open the left panel, the reports'], ['\\', 'Fold the timeline under the map'], ['Esc', 'Close, clear'], ['?', 'These keys']];
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
        if ($('.ops-set') && !$('.ops-set').hidden) return closeSettings();
        if ($('.ops-keys') && !$('.ops-keys').hidden) return toggleKeys(false);
        if (S.tool) return setTool(null);
        if (T.sel) return closeSel();
        if (!$('.ops-trf', hud).hidden) return toggleTraffic(false);
        if (!$('.ops-lyr', hud).hidden) return toggleLayers(false);
        if (rng) { rng = null; return drawMatrix(); }
        return;
      }
      const act = {
        ' ': () => nextLatest(), t: () => { if (TRAFFIC) trafficOnOff(); }, y: () => toggleLayers(), g: () => { S.grid = !S.grid; keep(); drawGrid(); paintLayers(); }, s: () => { const i = BASES.findIndex((b) => b[0] === S.base); S.base = BASES[(i + 1) % BASES.length][0]; keep(); drawBase(); drawTraffic(); paintLayers(); }, m: () => setTool(S.tool === 'ruler' ? null : 'ruler'), r: () => setTool(S.tool === 'rings' ? null : 'rings'),
        l: () => copyLink($('[data-do="link"]', hud)), f: fullScreen, ',': () => openSettings(),
        '[': () => { S.left = !S.left; keep(); paintFrame(); }, ']': () => { S.right = !S.right; keep(); paintFrame(); }, '\\': () => { S.dock = !S.dock; keep(); paintFrame(); }, '?': () => toggleKeys(),
      }[k.length === 1 ? k.toLowerCase() : k];
      if (act) { ev.preventDefault(); act(); }
    }, true); // Before the map's own keys (it stops Esc once it has closed a note).
  }

  /* ---------- Settings (20 Oct: "a settings page too, to make the site very customizable") ---------- */
  const SET_ROWS = [
    ['Look', [
      ['theme', 'Theme', 'Night is a dark operations room, Day a newsroom page; Device follows your phone or computer.', [['auto', 'Device'], ['night', 'Night'], ['day', 'Day']]],
      ['text', 'Text size', 'The panels’ text: the brief, the reports, the events.', [[90, 'Small'], [100, 'Normal'], [112, 'Large'], [125, 'Larger']]],
      ['pin', 'Pin size', 'The marks on the map.', [['s', 'Small'], ['m', 'Normal'], ['l', 'Large']]],
      ['still', 'Motion', 'Still keeps the map and the marks from moving on their own.', [[false, 'Moving'], [true, 'Still']]],
    ]],
    ['Time', [
      ['tz', 'Times shown in', 'For the events, the timeline and the alerts.', [['desk', 'The desk’s clock'], ['local', 'Your clock'], ['utc', 'UTC']]],
      ['range', 'The map opens on', 'The events the map shows when a page opens.', [['today', 'Today'], [2, 'Last 48 h'], [7, 'Last 7 days']]],
    ]],
    ['Map', [
      ['base', 'Base map', '', [['auto', 'Plain'], ['sat', 'Satellite'], ['relief', 'Relief']], 'S'],
      ['grid', 'Grid', 'Latitude and longitude.', [[false, 'Off'], [true, 'On']], 'S'],
      ['fills', "Sides' colours", 'Who holds what, in each side’s colour.', [[false, 'Off'], [true, 'On']], 'S'],
      ['coords', 'Place under the pointer', '', [['mgrs', 'Degrees and MGRS'], ['deg', 'Degrees'], ['dms', 'Degrees, minutes, seconds']]],
      ['units', 'Distances', 'The ruler and the range rings.', [['both', 'km and nm'], ['km', 'km'], ['nm', 'nm']]],
    ]],
    ['Live', [
      ['alerts', 'New events', 'A small note on the map when a new event is placed on it.', [[true, 'Show'], [false, 'Hide']]],
      ['sound', 'Sound', 'A short tone with each new event.', [[false, 'Off'], [true, 'On']]],
      ['airStart', 'Aircraft', 'Live aircraft on the map from the start.', [[false, 'When I turn them on'], [true, 'Always on']]],
    ]],
    ['Panels', [
      ['left', 'Left panel', 'The brief and its parts.', [[true, 'Open'], [false, 'Closed']], 'S'],
      ['right', 'Reports and events', '', [[true, 'Open'], [false, 'Closed']], 'S'],
      ['dock', 'Timeline under the map', '', [[true, 'Open'], [false, 'Folded']], 'S'],
    ]],
  ];
  const themeNow = () => { try { const t = localStorage.getItem('desk-theme'); return t === 'broadsheet-day' ? 'day' : t === 'broadsheet-night' ? 'night' : 'auto'; } catch (e) { return 'auto'; } };
  function setThemePref(v) {
    const set = app('setTheme');
    const dev = matchMedia('(prefers-color-scheme: light)').matches ? 'broadsheet-day' : 'broadsheet-night';
    const t = v === 'day' ? 'broadsheet-day' : v === 'night' ? 'broadsheet-night' : dev;
    if (set) set(t, v !== 'auto');
    if (v === 'auto') { try { localStorage.removeItem('desk-theme'); } catch (e) { /* private */ } }
  }
  function applyPrefs() {
    H.dataset.opsPin = P.pin;
    H.style.setProperty('--ops-zoom', String((Number(P.text) || 100) / 100));
    H.classList.toggle('ops-still', !!P.still);
  }
  function openSettings() {
    let el = $('.ops-set');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ops-set';
      el.hidden = true;
      document.body.appendChild(el);
      el.addEventListener('click', (ev) => {
        if (ev.target === el || ev.target.closest('[data-set-x]')) return closeSettings();
        if (ev.target.closest('[data-set-reset]')) {
          Object.assign(P, PREF_DEF); keepPrefs(); applyPrefs(); setThemePref('auto');
          Object.assign(S, { base: 'auto', names: false, grid: false, fills: true, left: true, right: true, dock: true }); keep();
          drawBase(); paintFrame(); drawMatrix(); paintSettings(); return;
        }
        const b = ev.target.closest('[data-k]');
        if (!b) return;
        const row = SET_ROWS.flatMap((g) => g[1]).find((r) => r[0] === b.dataset.k);
        const v = row[3][+b.dataset.i][0];
        if (row[0] === 'theme') setThemePref(v);
        else if (row[4] === 'S') { S[row[0]] = v; keep(); drawBase(); drawTraffic(); paintFrame(); paintLayers(); }
        else {
          P[row[0]] = v; keepPrefs(); applyPrefs();
          if (row[0] === 'range') openRange(v);
          if (row[0] === 'airStart' && v && !S.air && TRAFFIC) { S.air = true; keep(); runTraffic(); }
          if (row[0] === 'tz') { drawMatrix(); tick(); }
        }
        paintSettings();
      });
    }
    paintSettings();
    el.hidden = false;
    if (location.hash !== '#settings') history.replaceState(null, '', '#settings');
    const f = $('[data-set-x]', el); if (f) f.focus();
  }
  function closeSettings() {
    const el = $('.ops-set');
    if (el) el.hidden = true;
    if (location.hash === '#settings') history.replaceState(null, '', location.pathname + location.search);
  }
  function paintSettings() {
    const el = $('.ops-set');
    if (!el) return;
    const cur = (r) => (r[0] === 'theme' ? themeNow() : r[4] === 'S' ? (S[r[0]] == null ? r[3][0][0] : S[r[0]]) : P[r[0]]);
    // Drawn again open: only the buttons change, the list stays where the reader is (20 Oct: it went back to the top).
    if ($('.ops-sbody', el)) {
      el.querySelectorAll('[data-k]').forEach((b) => { const r = SET_ROWS.flatMap((g) => g[1]).find((x) => x[0] === b.dataset.k); b.setAttribute('aria-pressed', String(cur(r) === r[3][+b.dataset.i][0])); });
      return;
    }
    el.innerHTML = `<div class="ops-sbox" role="dialog" aria-label="Settings">
      <header><span class="ops-sh">${LOGO}<b>Settings</b></span><button type="button" class="ops-x" data-set-x aria-label="Close">${ICON.x}</button></header>
      <div class="ops-sbody">${SET_ROWS.map(([g, rows]) => `<section><h3>${esc(g)}</h3>${rows.map((r) => `<div class="ops-srow"><div class="ops-sl"><b>${esc(r[1])}</b>${r[2] ? `<small>${esc(r[2])}</small>` : ''}</div><div class="ops-sopts" role="group" aria-label="${esc(r[1])}">${r[3].map(([v, n], i) => `<button type="button" data-k="${r[0]}" data-i="${i}" aria-pressed="${String(cur(r) === v)}">${esc(n)}</button>`).join('')}</div></div>`).join('')}</section>`).join('')}
        <section class="ops-sabout"><h3>About</h3><p>The Situation Room follows the wars with Iran and in Yemen from open sources: news sites, wires, official channels and social media, each report linked to where it came from. Every mark on the map is a report placed where it happened.</p><p><a href="/yemen-conflict-desk/sources">Sources and method</a> · Settings are kept in this browser only.</p></section>
      </div>
      <footer><button type="button" class="ops-btn" data-set-reset>Back to the defaults</button><button type="button" class="ops-btn ops-sdone" data-set-x>Done</button></footer>
    </div>`;
  }

  /* ---------- One world: the map can't be pulled past the world's edge, nor zoomed out so far that the world
     no longer fills it (20 Oct: broadcast mode showed "map data not available" beside the world). ---------- */
  function oneWorld(m) {
    const fit = () => {
      const sz = m.getSize();
      if (!sz.x || !sz.y) return;
      const snap = m.options.zoomSnap || 1;
      const z = Math.max(1, Math.ceil(Math.log2(Math.max(sz.x / 256, sz.y / (256 * 0.83))) / snap) * snap);
      m.setMinZoom(z);
      if (m.getZoom() < z) m.setZoom(z, { animate: false });
    };
    m.setMaxBounds([[-85, -180], [85, 180]]);
    m.options.maxBoundsViscosity = 1;
    m.options.worldCopyJump = false;
    fit();
    m.on('resize', fit);
  }

  /* ---------- The page's own parts, in this view's terms ---------- */
  /* Who and What, each on its own line (20 Oct). The legend is drawn again by the page now and then. */
  /* 21 Oct (user: Who and What "taking too much space and heavy on the eyes"): each one line, its name fixed at
     the start and its marks sliding sideways, faded at the edge where more are hidden. */
  function splitLegend() {
    const body = $('.ops-who .leg-body', root);
    if (!body) return;
    const loose = [...body.children].filter((c) => c.matches('.leg-sec, .leg-sub, .leg-item'));
    if (!loose.length) return;
    let chips = null;
    loose.forEach((el) => {
      if (!el.classList.contains('leg-item')) {
        const row = document.createElement('div');
        row.className = 'ops-lrow';
        chips = document.createElement('div');
        chips.className = 'ops-lchips';
        el.before(row);
        row.append(el, chips);
        chips.addEventListener('scroll', () => edgeFade(chips), { passive: true });
        // A mouse wheel slides the line sideways.
        chips.addEventListener('wheel', (ev) => { if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX) && chips.scrollWidth > chips.clientWidth) { chips.scrollLeft += ev.deltaY; ev.preventDefault(); } }, { passive: false });
        return;
      }
      if (!chips) {
        const row = document.createElement('div');
        row.className = 'ops-lrow';
        chips = document.createElement('div');
        chips.className = 'ops-lchips';
        el.before(row);
        row.append(chips);
      }
      chips.appendChild(el);
    });
    body.querySelectorAll('.ops-br').forEach((b) => b.remove());
    body.querySelectorAll('.ops-lchips').forEach(edgeFade);
  }
  function edgeFade(c) {
    const more = c.scrollWidth - c.clientWidth;
    c.classList.toggle('ops-fade-r', more > 2 && c.scrollLeft < more - 2);
    c.classList.toggle('ops-fade-l', more > 2 && c.scrollLeft > 2);
  }
  /* Every front or arena at once, each in its box, not one at a time (20 Oct: "lay it out more professionally"). */
  function unpage() {
    root.querySelectorAll('.ops-left .pg-slide[inert], .ops-left .pg-slide[aria-hidden]').forEach((s) => { s.removeAttribute('inert'); s.removeAttribute('aria-hidden'); });
    // Open, every point (20 Oct: "the latest developments open"); the page keeps a box open once it is.
    root.querySelectorAll('.ops-left .situation:not(.sit-open)').forEach((s) => s.classList.add('sit-open'));
    root.querySelectorAll('.ops-left .front-card:not(.open)').forEach((s) => s.classList.add('open'));
    // The numbers' long lists, a row a block, each figure named by its column (20 Oct: the tables ran past the panel).
    root.querySelectorAll('.ops-left table.list:not([data-ops-l])').forEach((t) => {
      t.dataset.opsL = '1';
      const heads = [...t.querySelectorAll('tr:first-child th')].map((h) => h.textContent.trim());
      t.querySelectorAll('tr').forEach((tr, i) => { if (!i) return; [...tr.children].forEach((td, j) => { if (j > 1 && heads[j]) td.dataset.h = heads[j]; }); });
    });
    // Every box's name over its box, not inside it (user, 21 Oct).
    root.querySelectorAll('.ops-left .tally-box > h3:first-child').forEach((h) => { h.classList.add('ops-boxhead'); h.parentElement.before(h); });
    attackPins();
    // The sources' ratings, in short, at the right of the sources filter over the reports (user, 22 Oct).
    const fl = PAGE !== 'all' && document.getElementById('feed-legend');
    if (fl && !fl.querySelector('.ops-srclink')) fl.insertAdjacentHTML('beforeend', `<a class="ops-srclink" href="/${PAGE === 'gaza' ? 'gaza-judea-samaria' : `${PAGE}-conflict`}-desk/sources" title="How reliable each source has been">Source ratings</a>`);
    paintSlim();
  }

  /* ---------- The attacks on ships and on energy sites, each row with its place on the map (user, 21 Oct) ----------
     A row is matched to its pin on the desk's map (the same day or the day either side, the same kind of event, a
     word of its place in the pin's); a row with no pin opens on its place from the map's own list of places. The
     pin opens the small map, as every Show on map does. */
  const PIN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a7 7 0 0 0-7 7c0 5.1 6.1 11.4 6.4 11.7a.8.8 0 0 0 1.2 0c.3-.3 6.4-6.6 6.4-11.7a7 7 0 0 0-7-7zm0 9.7a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4z"/></svg>';
  const MON3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  /** "13 Oct" (or "13 Oct 2026") as a day, in the year that puts it last before today. */
  function rowDay(txt) {
    const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?(?:\s+(\d{4}))?/.exec(String(txt || ''));
    if (!m || MON3[m[2].toLowerCase()] == null) return null;
    const now = new Date();
    let y = m[3] ? +m[3] : now.getUTCFullYear();
    let t = Date.UTC(y, MON3[m[2].toLowerCase()], +m[1], 12);
    if (!m[3] && t > Date.now() + 2 * 864e5) t = Date.UTC(--y, MON3[m[2].toLowerCase()], +m[1], 12);
    return t;
  }
  const STOP = /^(?:the|of|in|at|on|off|near|and|by|from|to|nautical|miles?|km|north|south|east|west|northern|southern|eastern|western|coast|port|station|stations|pump|field|gas|oil|crude|pipeline|refinery|refineries|depot|plant|terminals?|regions?|province|headquarters|facility|facilities|processing|electricity|power|fuel|bulk|airport|city|central|three|two|four|five|six|one|vessel|ship|tanker|attack|attacked|saudi|arabia|yemen|iran|iraq|red|sea|gulf|al)$/i;
  const words = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z]+/).filter((w) => w.length > 3 && !STOP.test(w)).map((w) => w.toLowerCase());
  const SEA_KINDS = /vessel|ship|maritime|sea|naval/;
  const LAND_KINDS = /port|energy|infra|strike|oil/;
  // The same place under the spellings the sources use.
  const SAME = { mukha: 'mocha', makha: 'mocha', jizan: 'jazan', gizan: 'jazan', hudaydah: 'hodeidah', hodeida: 'hodeidah', mukalla: 'mukalla' };
  function rowPin(kind, day, place, desk) {
    if (day == null) return null;
    const ws = words(place).map((w) => SAME[w] || w);
    const near = events(true).filter((e) => e.desk === desk && typeof e.lat === 'number' && Math.abs(Date.parse(e.at) - day) < 1.6 * 864e5)
      .filter((e) => { const k = kindOf(e).k; return kind === 'sea' ? SEA_KINDS.test(k) : LAND_KINDS.test(k) || SEA_KINDS.test(k); });
    // A ship's row with no place of its own ("Off the Yemeni coast"): the one attack on a ship that day, if there is one.
    const sameDay = (e) => Math.abs(Date.parse(e.at) - day) < 0.6 * 864e5;
    const lone = () => { const d = near.filter(sameDay); return kind === 'sea' && d.length === 1 ? d[0] : null; };
    if (!ws.length) return lone();
    let best = null, bestN = 0;
    for (const e of near) {
      const hay = words(`${e.place || ''} ${e.label || ''} ${e.text || ''}`).map((w) => SAME[w] || w).join(' ');
      const n = ws.filter((w) => hay.includes(w)).length;
      if (n > bestN || (n === bestN && best && Math.abs(Date.parse(e.at) - day) < Math.abs(Date.parse(best.at) - day))) { best = e; bestN = n; }
    }
    return bestN ? best : lone();
  }
  /* The places a row can name: the region's cities and the desks' list of places; a country, when that is all it names. */
  let CITIES = null;
  function loadCities() {
    if (CITIES) return;
    CITIES = [];
    fetch('/iran-cities.json').then((r) => r.json()).then((j) => { CITIES = (j.cities || []).map((c) => ({ name: c[0], ll: [c[1], c[2]], rank: c[3] })); attackPins(true); }).catch(() => { /* the desks' places only */ });
  }
  // The seas, straits and oil sites the attack lists name that are not towns.
  const WATERS = [['Strait of Hormuz', 26.57, 56.25], ['Gulf of Oman', 24.6, 58.3], ['Gulf of Aden', 12.6, 47.5], ['Arabian Sea', 16.5, 61], ['Persian Gulf', 27.2, 51.3], ['Arabian Gulf', 27.2, 51.3], ['Bab al-Mandab', 12.6, 43.35], ['Suez Canal', 30.6, 32.33], ['Kharg Island', 29.25, 50.32], ['Lavan Island', 26.8, 53.36], ['Sirri Island', 25.9, 54.54], ['Asaluyeh', 27.47, 52.61], ['Mahshahr', 30.56, 49.2], ['Jubail', 27.0, 49.66], ['Khurais', 25.07, 48.0], ['Manifa', 27.6, 48.98], ['Juaymah', 26.85, 50.03], ['Shedgum', 25.66, 49.4], ['Tanajib', 27.83, 48.88], ['Ras Laffan', 25.9, 51.55], ['Mina al-Fahal', 23.63, 58.52], ['Mina al-Ahmadi', 29.06, 48.15], ['South Pars', 27.47, 52.61], ['Khor Mor', 35.07, 44.83], ['Medina', 24.47, 39.61], ['Jazan', 16.89, 42.55], ['Jizan', 16.89, 42.55], ['Basra', 30.51, 47.81], ['Fordow', 34.88, 50.99], ['Duqm', 19.66, 57.7], ['Ras Tanura', 26.64, 50.16], ['Bonji', 25.7, 57.6]].map(([name, a, b]) => ({ name, ll: [a, b], rank: 2 }));
  const COUNTRY_LL = { kuwait: [29.31, 47.98], bahrain: [26.07, 50.55], qatar: [25.3, 51.2], 'united arab emirates': [24.3, 54.4], uae: [24.3, 54.4], oman: [21.5, 57], israel: [31.6, 34.9], iraq: [33.2, 43.7], jordan: [31.2, 36.5], lebanon: [33.9, 35.8], syria: [35, 38.5], cyprus: [35, 33.2], djibouti: [11.7, 42.6], eritrea: [15.3, 39], somalia: [6, 46], sudan: [16, 30], egypt: [27, 30] };
  const plain = (s) => ` ${String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z]+/g, ' ').trim()} `;
  /** A place the map knows by name, from the row's words (the longest name first). */
  function rowPlace(place) {
    loadCities();
    const t = plain(place);
    const gaz = ((app('GAZ') || {}).places || []).flatMap((p) => [p.name, ...(p.aliases || [])].map((n) => ({ name: n, ll: [p.lat, p.lng], rank: 2, shown: p.name })));
    let best = null;
    for (const c of [...gaz, ...WATERS, ...(CITIES || [])]) {
      const n = plain(c.name);
      const at = n.length < 6 ? -1 : t.indexOf(n);
      if (at < 0) continue;
      // The place named first (the site, before its province or country), then the longest name.
      if (!best || at < best.at || (at === best.at && (n.length > best.n.length || (n.length === best.n.length && c.rank < best.c.rank)))) best = { c, n, at };
    }
    if (best) return { ll: best.c.ll, name: best.c.shown || best.c.name };
    const spans = A('placeSpans')(` in ${place}`) || [];
    const sp = spans.find((s) => s[2] && (s[2].ll || s[2].kind === 'area'));
    if (!sp) {
      const k = Object.keys(COUNTRY_LL).find((x) => t.includes(` ${x} `));
      return k ? { ll: COUNTRY_LL[k], name: k.replace(/\b\w/g, (c) => c.toUpperCase()).replace('Uae', 'UAE'), country: true } : null;
    }
    const en = sp[2];
    if (en.ll) return { ll: en.ll, name: en.name };
    try { const f = en.kind === 'gov' ? null : en.ref; const c = f && L.geoJSON(f).getBounds().getCenter(); return c ? { ll: [c.lat, c.lng], name: en.name } : null; } catch (e) { return null; }
  }
  function attackPins(retry) {
    root.querySelectorAll('.ops-left table.list').forEach((t) => {
      const ships = t.classList.contains('ships') || /maritime|vessel|ship|incident/i.test(t.className);
      const heads = [...t.querySelectorAll('tr:first-child th')].map((h) => h.textContent.trim().toLowerCase());
      const placeCol = heads.findIndex((h) => /^(?:location|place|site|where|target|facility)/.test(h));
      const sites = t.classList.contains('sites') || placeCol >= 0 && /site|facility|target/.test(heads[placeCol]);
      if (!ships && !sites) return;
      const desk = PAGE === 'all' ? null : PAGE;
      if (!desk || placeCol < 0) return;
      t.querySelectorAll('tr').forEach((tr, i) => {
        // A row with no place found yet is looked at again when the map's events change.
        if (!i || tr.dataset.opsPin === '1' || (tr.dataset.opsPin === '0' && !retry)) return;
        const cells = [...tr.children];
        const place = cells[placeCol] ? cells[placeCol].textContent.trim() : '';
        const day = rowDay(cells[0] && cells[0].textContent);
        const e = rowPin(ships ? 'sea' : 'land', day, place, desk);
        const spot = e ? null : rowPlace(place);
        tr.dataset.opsPin = e || spot ? '1' : '0';
        if (!e && !spot) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ops-rowpin';
        b.title = 'Show on map';
        b.setAttribute('aria-label', `Show ${place} on the map`);
        b.innerHTML = PIN_ICON;
        b.addEventListener('click', (ev) => { ev.stopPropagation(); openRowMap(e, spot, place, b); });
        cells[placeCol].appendChild(b);
      });
    });
  }
  function openRowMap(e, spot, place, anchor) {
    const wide = !isPhone() ? anchor : null;
    if (e && IRAN_LIKE(e.desk)) return A('openIranMapPop')([e], e.label || place, wide, () => A('showIranPin')(String(e.fp)));
    if (e) return A('openPinSheet')(e, wide);
    const pop = app('openMapPop');
    if (!pop || !spot) return;
    pop({
      title: place,
      anchor: wide,
      legend: '',
      build: (m) => {
        m.setView(spot.ll, spot.country ? 5.5 : 7);
        // The sides' colours, as every other small map has them (user, 22 Oct).
        if (PAGE === 'yemen') A('devBaseMap')(m);
        else {
          const geo = (app('iranPins') || {}).countryGeo;
          if (geo) L.geoJSON(geo, { style: app('iranCountryStyle'), interactive: false }).addTo(m);
          A('iranYemenLayer')(m, 'overlayPane');
          A('drawAdminLayer')(m);
        }
        L.circleMarker(spot.ll, { radius: 9, color: '#fff', weight: 2, fillColor: '#e0a43c', fillOpacity: 0.95 }).bindTooltip(spot.name, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(m);
      },
    });
  }
  /* Every map pin on a computer opens its small map when the pointer rests on it, and the map closes as the
     pointer leaves both (user, 22 Oct); the pins that only opened on a click (the Iran desk's cards and arenas,
     the attack rows) are given it here. A phone opens it with a tap, as before. */
  const PIN_SEL = '.card-map, .sit-map-btn, .ops-rowpin';
  const canHover = () => matchMedia('(hover: hover)').matches && innerWidth >= 720;
  let pinT = 0;
  function wirePinHover() {
    const sheet = () => document.getElementById('pin-sheet');
    const shut = () => { const s = sheet(); if (s && s.classList.contains('as-pop') && !s.matches(':hover')) A('hideFrontFloat')(); };
    document.addEventListener('mouseover', (ev) => {
      const b = ev.target.closest && ev.target.closest(PIN_SEL);
      if (!b || !canHover() || b.onmouseenter || b.matches('.card-map[data-pin-of]')) return;
      clearTimeout(pinT);
      pinT = setTimeout(() => { if (b.matches(':hover')) b.click(); }, 120);
    });
    document.addEventListener('mouseout', (ev) => {
      const b = ev.target.closest && ev.target.closest(PIN_SEL);
      if (!b || b.contains(ev.relatedTarget) || b.onmouseenter || b.matches('.card-map[data-pin-of]')) return;
      clearTimeout(pinT);
      pinT = setTimeout(shut, 300);
    });
  }
  /* A report opened from the All page (#r=…): the reports panel, open. */
  const OPEN_REPORT = /^#r=/.test(location.hash || '');

  /* ---------- Start ---------- */
  let started = false;
  function startHud() {
    const m = getMap();
    // The page's map, made and with a size (a map read before then has no place yet).
    if (!m || !m.getContainer || !window.L || !m._loaded || !(m.getSize().y > 0)) { setTimeout(startHud, 200); return; }
    buildHud(m);
    wireLog(); wireTraffic(); wireKeys(); wireTrafficClicks(m); wirePinHover();
    $('.ops-card', hud).addEventListener('click', (ev) => { if (ev.target.closest('[data-sel="x"]')) closeSel(); else if (ev.target.closest('[data-route]')) toggleRoute(); });
    sizeDock();
    oneWorld(m);
    // The desk's own part of the map, in the new map box (the page fitted it to the old one).
    const own = (app('DESK_GO') || {})[DESK_PATH[PAGE]];
    if (own && !/#(at|pin)=/.test(location.hash) && !sessionStorage.getItem('desk-go')) { try { m.invalidateSize(); m.fitBounds(own.b, { padding: [8, 8], animate: false }); } catch (e) { /* kept */ } }
    // The map shows once it is in its place (20 Oct: the Yemen map shook for a second as the frame settled round it).
    // The page fits its map again as the frame settles: the map shows when it has held still for 400 ms.
    { let at = '', still = 0, n = 0; const t = setInterval(() => { const c = m.getCenter(), k = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${m.getZoom()}`; still = k === at ? still + 1 : 0; at = k; if (still >= 4 || ++n > 40) { clearInterval(t); root.classList.add('ops-ready'); } }, 100); }
    openAt(m);
    // The note on the map, its own line right under the map (user, 27 Oct: "make sure the disclaimer line under the map is
    // visible"; it sat small in the credits' corner).
    try { if (dock && !$('.ops-discl-m', dock)) dock.insertAdjacentHTML('afterbegin', '<p class="ops-discl-m">Map shows the majority of events, each only as accurate as its source.</p>'); } catch (e) { /* no strip */ }
    // The map opens on the reader's span, as the timeline under it (a link to a pin or a place keeps its own).
    if (!/#(at|pin)=/.test(location.hash)) {
      let tries = 0;
      const first = () => { if (!openRange(P.range) && ++tries < 20) setTimeout(first, 300); };
      setTimeout(first, 400);
    }
    drawBase();
    // Day and night as they are now on the map: each place lit or dark by its own hour, with the cities' lights
    // as seen from space on the night side (20 Oct; public/daynight.js).
    try { if (window.deskDayNight) T.dn = window.deskDayNight.add(m, { theme: night() ? 'night' : 'day' }); } catch (e) { /* the plain map */ }
    m.on('zoomend', () => { if (S.air || S.sea) drawTraffic(); });
    m.on('moveend', () => { if (S.grid) drawGrid(); });
    drawMatrix();
    warForChart();
    runTraffic();
    if (location.hash === '#settings') openSettings();
    // The theme: the overview's tiles and the traffic's edges follow it.
    // The tab's icon is the site's logo in the theme shown (user, 21 Oct).
    const tabIcon = () => { const l = document.querySelector('link[rel="icon"]'); if (l) l.href = `/ops-icon-${night() ? 'night' : 'day'}.svg?v=1`; };
    tabIcon();
    new MutationObserver(() => { drawBase(); drawTraffic(); drawMatrix(); tabIcon(); if (T.dn) T.dn.setTheme(night() ? 'night' : 'day'); }).observe(H, { attributes: true, attributeFilter: ['data-theme'] });
    // The pins are drawn again by the page now and then: fade the ones outside the hours picked again.
    let dimT = 0;
    new MutationObserver(() => { if (rng) { clearTimeout(dimT); dimT = setTimeout(dimPins, 80); } }).observe(m.getPane('markerPane'), { childList: true });
    tick(); setInterval(tick, 15000);
    // The page's events come in over its first seconds and then every few minutes: the panels follow them as they
    // change (20 Oct: they waited up to half a minute and showed nothing meanwhile), checked cheaply each second.
    let sig = '';
    const look = () => {
      const ev = events();
      let top = '';
      for (const e of ev) if (e.at > top) top = e.at;
      // The All page's briefs come in after its events: the panel shows them as they do (it said Loading for up to a minute).
      const h = PAGE === 'all' && window.__home;
      const s = `${ev.length}|${top}|${h ? [h.D.reports.length, h.D.ibrief && h.D.ibrief.updatedAt, h.D.ybrief && h.D.ybrief.updatedAt].join(',') : ''}`;
      if (s !== sig) { sig = s; drawMatrix(); if (PAGE === 'all') drawAllRail(); attackPins(true); }
      watch();
    };
    look();
    setInterval(look, 1000);
    // The 48 hours roll on every minute.
    setInterval(drawMatrix, 60000);
  }
  function start() {
    if (started) return;
    if (!findRoot()) return;
    started = true;
    TRAFFIC = PAGE === 'all';
    // The Online tab (23 Oct) and the Mood tab (29 Oct) are gone: a tab kept from either is Reports.
    if (S.rtab === 'on' || S.rtab === 'mood') S.rtab = 'rep';
    if (S.ptab === 'mood') S.ptab = 'map';
    if (!TRAFFIC) { S.air = false; S.sea = false; }
    // Shown in any case after a few seconds, whatever kept the map from being placed.
    setTimeout(() => root && root.classList.add('ops-ready'), 5000);
    try {
      applyPrefs();
      if (OPEN_REPORT) { S.right = true; S.rtab = 'rep'; S.ptab = 'rail'; lastOpen = 'right'; }
      // app.js found the report of a "#r=" link (user, 24 Oct): the reports panel opens on it, whenever that is.
      addEventListener('desk:open-report', () => {
        S.right = true; S.rtab = 'rep'; S.ptab = 'rail'; lastOpen = 'right';
        paintFrame();
      });
      build(); tick(); counts(); startHud();
      if (PAGE !== 'all') loadCities();
      const leg = $('.ops-who', root);
      if (leg) { splitLegend(); new MutationObserver(splitLegend).observe(leg, { childList: true, subtree: true }); }
      unpage();
      new MutationObserver(unpage).observe(leftEl, { subtree: true, attributes: true, attributeFilter: ['inert', 'aria-hidden'], childList: true });
    } catch (e) {
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
  window.opsView = { setView, focusEvent, traffic: T };
})();

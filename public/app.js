/* =============================================================================
 *  Yemen War Desk — browser client
 * =============================================================================
 *
 *  All copy on this page is English, written to the desk style book in
 *  src/lib/desk/wire-style.ts. That file is the canonical set of rules; the
 *  short version, repeated here because this file also writes copy when a row
 *  arrives without any:
 *
 *    • Headlines are one sentence, sentence case, no terminal full stop.
 *    • Attribution decides the grammar. A wire service is reported as fact
 *      ("Air strikes hit Houthi positions in Marib"); a belligerent's own
 *      channel is a claim ("Houthi media claims …"); a single Telegram or OSINT
 *      account is a report ("Reports of a ballistic missile launch towards
 *      Riyadh").
 *    • Verbs are plain, active and past tense. No "eliminated", "liberated",
 *      "martyred", "terrorist" — those are the sources' words, not ours.
 *    • Numbers follow AP: words for one to nine, figures from 10, and casualty
 *      counts always carry "at least".
 *    • What we do not know, we say we do not know.
 * ========================================================================== */

/* ---------------------------------------------------------------- *
 * Palette and category marks
 * ---------------------------------------------------------------- */

const COLORS = { houthi: '#c45c26', plc: '#22c55e', saudi: '#1f8a7a', contested: '#e9c46a', mixed: '#457b9d' };
const EVENT_COLORS = { combat: '#facc15', strike: '#dc2626', vessel: '#06b6d4', port: '#f97316' };

/*
 * Map marks: bold, filled glyphs that read at a glance against the basemap.
 *
 * These are drawn heavy on purpose. The previous ground-fighting mark was
 * crossed swords at hairline weight, which collapsed into an unreadable
 * squiggle at pin size — the operator could not tell what it meant, which is
 * the one job the mark has.
 */
const EVENT_SVG = {
  // Rocket: nose up, fins and exhaust, so it reads as a launch or strike.
  strike:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.2c2.6 2.3 4.1 5.4 4.3 9.2l1.9 2a1 1 0 0 1 .3.7v3.3l-3.3-1.7-.8.8v2.1l-2.4 2.4-2.4-2.4v-2.1l-.8-.8L5.5 18v-3.3a1 1 0 0 1 .3-.7l1.9-2c.2-3.8 1.7-6.9 4.3-9.2zm0 5.1a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
  // Two crossed swords: thick blades, visible crossguards, clear X at 24px.
  combat:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.3 2.2 7 2.9l11.4 11.4-2.1 2.1L4.9 5 3.3 2.2zm17.4 0L19.1 5 14 10.1l2.1 2.1L21.1 7l.7-3.7-1.1-1.1zM2.9 19.3l2.6-2.6 2.1 2.1-2.6 2.6a1.5 1.5 0 0 1-2.1-2.1zm18.2 0a1.5 1.5 0 0 1-2.1 2.1l-2.6-2.6 2.1-2.1 2.6 2.6zM8.9 13.2l2.1 2.1-2.4 2.4-2.1-2.1 2.4-2.4z"/></svg>',
  vessel:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6 15 6h2.4l-4.2 2.1V11l7 2.6v2.1c-2.7 1.8-5.8 2.7-8.2 2.7s-5.5-.9-8.2-2.7v-2.1l7-2.6V8.1L6.6 6H9zM3 19.4h18V21c-3 .8-6 .9-9 .9s-6-.1-9-.9z"/></svg>',
  port:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h3.2v7.6h8.2V7.4L21 12l-5.6 4.6v-3.2H7.2V21H4zm-1 18.4h18V23H3z"/></svg>',
};

/** Marker HTML: a floating pill that lifts off the map, with a fresh-event ring. */
function eventIconHtml(cat, fresh, title) {
  const svg = EVENT_SVG[cat] || EVENT_SVG.combat;
  return `<div class="ev ${cat}${fresh || ''}" title="${title || ''}"><span class="ev-glyph">${svg}</span><span class="ev-stem" aria-hidden="true"></span></div>`;
}

const LABELS = {
  houthi: 'Houthi forces',
  plc: 'Government forces',
  saudi: 'Saudi Arabia',
  contested: 'Contested',
  mixed: 'Mixed',
};

const CATEGORY_LABEL = {
  combat: 'Ground fighting',
  strike: 'Strike or launch',
  vessel: 'Vessel attacked',
  port: 'Port or terminal hit',
  statement: 'Statement',
};

/*
 * How much of the feed is on screen before you ask for more.
 *
 * Eight cards covered barely half an hour of a busy evening, which made a desk
 * that had collected all day look like it had filed twice. The feed is the
 * heart of this desk; it should read as a running wire, so it opens deep and
 * pages in large steps.
 */
const INITIAL_REPORTS = 10;
const MORE_STEP = 10;

/* ---------------------------------------------------------------- *
 * Gazetteer — canonical English place names, loaded from the file the
 * server generates from src/lib/desk/gazetteer.ts
 * ---------------------------------------------------------------- */

let GAZ = { places: [] };
let PLACE_COORDS = {};
let PLACE_META = {};

async function loadGazetteer() {
  if (GAZ.places.length) return;
  try {
    GAZ = await fetch('/gazetteer.json').then((r) => r.json());
  } catch (e) {
    GAZ = { places: [] };
  }
  PLACE_COORDS = {};
  PLACE_META = {};
  for (const p of GAZ.places || []) {
    PLACE_COORDS[p.name] = [p.lat, p.lng];
    PLACE_META[p.name] = p;
  }
}

/** Longest name first, so "Bab al-Mandab" wins over a bare "Mandab". */
function placeNamesByLength() {
  return Object.keys(PLACE_META).sort((a, b) => b.length - a.length);
}

/**
 * Add a short locator the first time an unfamiliar place appears in body copy.
 * Sanaa, Aden, Riyadh, Jeddah and the Red Sea are never glossed.
 *
 * Short is the whole point. The previous version inserted the full `region`
 * description — "Taiz, a city and governorate in south-western Yemen" — which
 * read as padding and, inside a list of places, left the reader unable to tell
 * where the description ended: "hit positions in Taiz, a city and governorate
 * in south-western Yemen, Al-Jawf and Marib". `where` comes from the same
 * `shortWhere()` the server uses, so the two can never drift.
 */
function annotatePlaces(text) {
  let s = String(text || '');
  if (!s) return s;
  for (const name of placeNamesByLength()) {
    const meta = PLACE_META[name];
    if (!meta || meta.wellKnown || !meta.where) continue;
    const idx = s.indexOf(name);
    if (idx < 0) continue;
    // Already followed by a clause of its own — leave it alone.
    const after = s.slice(idx + name.length, idx + name.length + 6);
    if (/^\s*,/.test(after) || /^\s+(?:in|on|off|near|beside)\b/i.test(after)) continue;
    // Never gloss inside a speaker's title: "the governor of Marib in
    // east-central Yemen said" buries the verb behind geography the title
    // already implied.
    const before = s.slice(Math.max(0, idx - 12), idx);
    if (/\b(of|for)\s+$/i.test(before) && idx < 90) continue;
    // Never gloss a place that is part of a list — the locator would read as
    // if it described the whole list rather than the one place.
    if (/^\s*(?:,|and\b)/.test(after)) continue;

    const selfPrepositioned = /^(?:on|off|beside|near|inside|overlooking|between)\b/i.test(meta.where)
      || /^(?:north|south|east|west|north-east|north-west|south-east|south-west)\s+of\b/i.test(meta.where);
    const gloss = selfPrepositioned ? `${name} ${meta.where}` : `${name} in ${meta.where}`;
    s = s.slice(0, idx) + gloss + s.slice(idx + name.length);
    break; // one locator per paragraph keeps the copy readable
  }
  return s;
}

/* ---------------------------------------------------------------- *
 * State
 * ---------------------------------------------------------------- */

let map;
let geoLayer;
let saudiGeoLayer = null;
let eventLayers = [];
let islandLayers = [];
let islandGeoCache = null;
let data = null;
let geoCache = null;
let saudiGeoCache = null;
let miniGeo = null;
let brief = null;

let layersOn = { houthi: true, plc: true, saudi: true, contested: true, combat: true, strike: true, vessel: true, port: true };
let frontFloatTimer = null;
let frontFloatIdx = null;
let frontFloatWired = false;
let frontFloatAnchor = null;
let frontFloatOpenedAt = 0;
let highlightIds = new Set();
let highlightPulse = false;
let highlightTimer = null;
let straitHighlightLayer = null;
let straitLabelLayer = null;
let frontSpotLayer = null;
let islandTagLayers = [];
let keepHighlightUntil = 0;
let liveOverlay = {
  reports: [],
  scannedAt: null,
  sourcesOk: 0,
  sourcesTried: 0,
  rawHits: [],
  sourceStatus: [],
  cycleNote: '',
  reasons: [],
};
let paintedPinKeys = new Set();

const HOME_VIEW = [15.4, 47.6, 6];
const GOV_WEIGHT = {
  'YE-HD': 30, 'YE-MR': 8, 'YE-SH': 8, 'YE-AB': 5, 'YE-AD': 4, 'YE-SU': 2,
  'YE-HU': 6, 'YE-IB': 5, 'YE-SA': 4, 'YE-SN': 4, 'YE-SD': 3, 'YE-HJ': 3,
  'YE-DH': 3, 'YE-AM': 2, 'YE-MW': 1, 'YE-RA': 1,
  'YE-TA': 2, 'YE-MA': 2, 'YE-JA': 2, 'YE-LA': 2, 'YE-BA': 1, 'YE-DA': 1,
};

let reportsShown = INITIAL_REPORTS;
const openFeedFps = new Set(); // keep expanded cards open across auto-refresh
let mapFocus = false;
let mapDate = null; // YYYY-MM-DD in Asia/Jerusalem; null = today
let mapMode = 'day'; // day | range | all | control
let mapDateFrom = null;
let mapDateTo = null;
let activeEpoch = null;
let activeControlYmd = null;
let controlOverlayLayers = [];
const MAP_ROUND_START = '2026-07-01';
const CONFLICT_START = '2026-07-03';
const FRONT_HOME_VIEW = [15.35, 46.15, 6];
const MAX_MAP_PINS = 80;
// A range or "all" view must show the whole war, not the newest slice of it:
// the old 220 cut every pin from July and most of August. This only guards
// against a runaway feed.
const MAX_MAP_PINS_RANGE = 3000;

/* West-coast strips that changed hands in this round (Tihama and Bab). */
const COAST_AREAS = [
  { id: 'mocha', name: 'Mocha and the coast', ring: [
    [13.12, 43.08], [13.22, 43.06], [13.38, 43.10], [13.52, 43.18],
    [13.50, 43.42], [13.32, 43.48], [13.18, 43.38],
  ] },
  { id: 'dhubab', name: 'Dhubab', ring: [
    [12.72, 43.30], [12.88, 43.28], [13.08, 43.32], [13.12, 43.48],
    [12.95, 43.58], [12.72, 43.50],
  ] },
  { id: 'khokha', name: 'Al-Khokha', ring: [
    [13.68, 43.08], [13.88, 43.10], [13.95, 43.28], [13.82, 43.40],
    [13.68, 43.32],
  ] },
  { id: 'hays', name: 'Hays', ring: [
    [13.90, 43.22], [14.15, 43.24], [14.20, 43.48], [14.00, 43.55],
    [13.88, 43.42],
  ] },
];

/* ---------------------------------------------------------------- *
 * Time
 * ---------------------------------------------------------------- */

function reportTime(r) { return r.at || r.t || data?.updatedAt; }

function eventTime(e) {
  if (!e) return '';
  if (e.at || e.t) return e.at || e.t;
  if (e.when) {
    const w = String(e.when).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w + 'T12:00:00+03:00';
    return w;
  }
  return '';
}

function fmtStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${time} · ${date}`;
}

function fmtClock(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** "09:00 on 20 Sep" — used by the 12-hour brief stamps. */
function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short' });
  return `${fmtClock(ts)} on ${day}`;
}

function jerusalemYmd(ts) {
  if (!ts) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(ts));
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const d = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

function todayYmd() { return jerusalemYmd(Date.now()); }
function effectiveMapDate() { return mapDate || todayYmd(); }

function shiftYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function clampMapDate(ymd) {
  const today = todayYmd();
  if (!ymd || ymd < MAP_ROUND_START) return MAP_ROUND_START;
  if (ymd > today) return today;
  return ymd;
}

/* ---------------------------------------------------------------- *
 * HTML helpers
 * ---------------------------------------------------------------- */

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function collectMedia(obj) {
  const arr = obj && obj.media;
  if (!Array.isArray(arr)) return [];
  return arr.filter((m) => m && m.src && (m.type === 'image' || m.type === 'video' || !m.type)).slice(0, 4);
}

function mediaBlock(items, compact) {
  const list = Array.isArray(items) ? items : collectMedia(items);
  if (!list.length) return '';
  return `<div class="media-block${compact ? ' compact' : ''}">` + list.map((m) => {
    const cap = escapeHtml(m.caption || '');
    const credit = m.credit ? ` <span class="media-credit">${escapeHtml(m.credit)}</span>` : '';
    return `<figure class="media-fig"><button type="button" class="media-open" data-src="${escapeHtml(m.src)}"><img src="${escapeHtml(m.src)}" alt="${cap}"></button><figcaption>${cap}${credit}</figcaption></figure>`;
  }).join('') + '</div>';
}

function wireMediaClicks(root) {
  if (!root) return;
  root.querySelectorAll('.media-open').forEach((btn) => {
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      const src = btn.getAttribute('data-src');
      const flo = document.getElementById('media-float');
      if (!src || !flo) return;
      flo.hidden = false;
      flo.classList.add('show');
      flo.innerHTML = `<button type="button" class="media-float-close">Close</button><img src="${escapeHtml(src)}" alt="">`;
      const close = () => { flo.classList.remove('show'); flo.hidden = true; flo.innerHTML = ''; };
      const cl = flo.querySelector('.media-float-close');
      if (cl) cl.onclick = close;
      flo.onclick = (e) => { if (e.target === flo) close(); };
    };
  });
}

/* ---------------------------------------------------------------- *
 * Sources
 * ---------------------------------------------------------------- */

function sourceOf(r) {
  if (r && r.source) return String(r.source).replace(/\s*\/\s*/g, ' · ');
  return '';
}

/** Outlet alignment, used only for the coloured edge on a feed card. */
const SOURCE_LEAN = {
  YPA: 'houthi', Saba: 'houthi', 'Al-Masirah': 'houthi', 'Al Masirah': 'houthi',
  'Al Manar': 'houthi', 'Al-Mayadeen': 'houthi', 'Al Mayadeen': 'houthi',
  'Al-Akhbar': 'houthi', 'Al Akhbar': 'houthi', IRNA: 'houthi',
  'Al-Alam': 'houthi', 'Press TV': 'houthi',
  'Ali Bk': 'houthi', 'Sabereen News': 'houthi', Sabereen: 'houthi', Naya: 'houthi',
  'Al-Mihwar': 'houthi', 'Shin Persian': 'houthi', 'Shajab News': 'houthi',
  'Al-Aqsa Breaking': 'houthi', 'Yahya Saree': 'houthi', Saree: 'houthi',
  'Mohammed Abdulsalam': 'houthi', 'Mohammed Ali al-Houthi': 'houthi',
  Ansarollah: 'houthi', 'Baghdad Today': 'houthi', 'Al-Thawrah': 'houthi',
  'Hazam al-Asad': 'houthi', 'Abdulqader al-Murtada': 'houthi',
  'Bin Saeed': 'gov', 'Al Arabiya Breaking': 'gov', 'Al Arabiya': 'gov',
  'Al Hadath': 'gov', 'AlArabiya al-Hadath': 'gov', SPA: 'gov', Okaz: 'gov',
  'Al-Watan': 'gov', 'Al Watan': 'gov', 'Arab News': 'gov',
  'Asharq Al-Awsat': 'gov', 'Asharq News': 'gov', 'The National': 'gov',
  'September Net': 'gov', '26 September': 'gov', 'Ali Al-Sakani': 'gov',
  'Saudi Gazette': 'gov', 'Giants Brigades': 'gov', 'Nation Shield': 'gov',
  South24: 'south', 'Aden Observer': 'south', 'Aden Gad': 'south', 'Crater Sky': 'south',
  Almashhad: 'indep', Alsahwa: 'indep', 'Barran Press': 'indep', 'Yemen Monitor': 'indep',
  'Sheba Intelligence': 'indep', Yemenat: 'indep', 'Yemen Future': 'indep',
  'Al-Khabar al-Yemeni': 'indep',
  Reuters: 'intl', AFP: 'intl', AP: 'intl', BBC: 'intl', 'BBC Verify': 'intl',
  Anadolu: 'intl', Xinhua: 'intl', DPA: 'intl', Guardian: 'intl', 'The Guardian': 'intl',
  'Al Jazeera': 'intl', 'Al Jazeera Net': 'intl', 'Al-Araby Al-Jadeed': 'intl',
  'Al-Araby Television': 'intl', IOM: 'intl', UNHCR: 'intl', OCHA: 'intl',
  OHCHR: 'intl', WHO: 'intl', WFP: 'intl', UKMTO: 'intl',
  Axios: 'intl', ABC: 'intl', CBS: 'intl', CNN: 'intl', NYT: 'intl', 'NY Post': 'intl',
  'Washington Post': 'intl', 'US media': 'intl', 'Fox News': 'intl', Politico: 'intl',
  'Middle East Eye': 'intl', WSJ: 'intl', CNBC: 'intl', Alhurra: 'intl',
  'Erem News': 'intl', 'France 24': 'intl', 'Al-Monitor': 'intl', NPR: 'intl',
  ANSA: 'intl', 'Crisis Group': 'intl',
};

const LEAN_LABEL = {
  houthi: 'Houthi-aligned outlet',
  gov: 'Government or Saudi-aligned outlet',
  indep: 'No declared alignment',
  south: 'No declared alignment',
  intl: 'No declared alignment',
  other: 'No declared alignment',
};

function primaryOutlet(sourceStr) {
  const parts = String(sourceStr || '').split(/\s*[·|/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts[0] || '';
}

function sourceLean(sourceStr) {
  for (const name of String(sourceStr || '').split(/\s*[·|/]\s*/)) {
    const key = name.trim();
    if (SOURCE_LEAN[key]) return SOURCE_LEAN[key];
  }
  return 'other';
}

const SOURCE_HOME = {
  Reuters: 'https://www.reuters.com/', AP: 'https://apnews.com/', AFP: 'https://www.afp.com/',
  BBC: 'https://www.bbc.com/news', 'Al Jazeera': 'https://www.aljazeera.com/',
  Almashhad: 'https://www.almashhad.news/', 'Arab News': 'https://www.arabnews.com/',
  'Al Hadath': 'https://www.alarabiya.net/', 'Al Arabiya': 'https://www.alarabiya.net/',
  SPA: 'https://www.spa.gov.sa/', UKMTO: 'https://www.ukmto.org/',
};

/** A "A · B" string, or an array of names or {name, url} rows, as a flat list. */
function splitSources(sourceStr) {
  if (Array.isArray(sourceStr)) return sourceStr.filter(Boolean);
  return String(sourceStr || '').split(/\s*[·|/]\s*/).map((s) => s.trim()).filter(Boolean);
}

/** One canonical display name per outlet. */
function canonicalSourceName(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  const fixes = [
    [/^al[- ]?jazeera.*$/i, 'Al Jazeera'],
    [/^al[- ]?arabiya.*$/i, 'Al Arabiya'],
    [/^al[- ]?hadath.*$/i, 'Al Hadath'],
    [/^al[- ]?masirah.*$/i, 'Al-Masirah'],
    [/^al[- ]?akhbar.*$/i, 'Al-Akhbar'],
    [/^the guardian$/i, 'Guardian'],
    [/^associated press$/i, 'AP'],
    [/^ny ?times$|^new york times$/i, 'NYT'],
    [/^wall street journal$/i, 'WSJ'],
  ];
  for (const [re, to] of fixes) if (re.test(n)) return to;
  return n;
}

function hostLabelFromUrl(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h.split('.')[0].replace(/^./, (c) => c.toUpperCase());
  } catch (e) {
    return '';
  }
}

/** True if the URL is a site or section front rather than a specific report. */
function isHomepageOrSectionUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/+$/, '');
    if (!p || p === '/') return true;
    if (/^\/[a-z]{2}$/i.test(p)) return true;
    if (/^\/(news|world|middle-?east|politics|home)$/i.test(p)) return true;
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Source credits. Accepts a "A · B" string, or the {name, url} rows the curated
 * panels carry — passing an object list through a string path is how you end up
 * printing "[object Object]" at a reader.
 */
function sourceAnchors(sourceStrOrList, primaryUrl) {
  const entries = splitSources(sourceStrOrList)
    .map((s) => (typeof s === 'string' ? { name: canonicalSourceName(s), url: '' } : { name: canonicalSourceName(s && s.name), url: (s && s.url) || '' }))
    .filter((e) => e.name);
  const out = [];
  entries.forEach((e, i) => {
    const url = e.url
      || (i === 0 && primaryUrl && !isHomepageOrSectionUrl(primaryUrl) ? primaryUrl : '')
      || SOURCE_HOME[e.name]
      || '';
    if (url) out.push(`<a class="src-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(e.name)}</a>`);
    else out.push(`<span class="src-plain">${escapeHtml(e.name)}</span>`);
  });
  return out.join(' · ');
}

function sourceCreditsHtml(sourceStrOrList, primaryUrl) {
  const list = Array.isArray(sourceStrOrList) ? sourceStrOrList : splitSources(sourceStrOrList);
  const parts = [];
  for (const s of list) {
    if (typeof s === 'string') {
      const name = canonicalSourceName(s);
      const url = SOURCE_HOME[name] || '';
      parts.push(url
        ? `<a class="src-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
        : `<span class="src-plain">${escapeHtml(name)}</span>`);
    } else if (s && s.name) {
      const name = canonicalSourceName(s.name);
      parts.push(s.url
        ? `<a class="src-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
        : `<span class="src-plain">${escapeHtml(name)}</span>`);
    }
  }
  if (!parts.length && primaryUrl && !isHomepageOrSectionUrl(primaryUrl)) {
    parts.push(`<a class="src-link" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener">Read the report</a>`);
  }
  return parts.join(' · ');
}

function sourcesLine(list, primaryUrl) {
  const html = sourceCreditsHtml(list, primaryUrl);
  return html ? `<div class="srcs">Source: ${html}</div>` : '';
}

function cleanBody(text) {
  return String(text || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,:·\-–—\s]+/, '')
    .trim();
}

function hasNonLatinScript(s) {
  return /[؀-ۿ֐-׿]/.test(String(s || ''));
}

/**
 * Last-resort composer for a row that arrived without usable English. It
 * asserts only what the row's own fields support — type and place — and says
 * nothing more, because a row with no copy supports nothing more.
 */
function fallbackReport(r) {
  const place = r && r.place ? String(r.place) : '';
  const where = place ? ` in ${place}` : '';
  const kind = (r && r.type) || 'statement';
  let summary;
  if (kind === 'strike' || kind === 'missile' || kind === 'launch' || kind === 'drone') {
    summary = `Reports of a strike${where || ' in Yemen'}`;
  } else if (kind === 'combat' || kind === 'clash' || kind === 'capture') {
    summary = `Reports of ground fighting${where || ' in Yemen'}`;
  } else if (kind === 'port') {
    summary = `Reports of a strike on port facilities${place ? ` at ${place}` : ' in Yemen'}`;
  } else if (kind === 'vessel') {
    summary = `Reports of a vessel attacked${place ? ` off ${place}` : ' in the Red Sea'}`;
  } else if (kind === 'economy') {
    summary = 'Reported effect of the conflict on oil exports and shipping';
  } else {
    summary = `Statement on the fighting${where || ' in Yemen'}`;
  }
  // Neither "X carried the report" nor "could not be independently verified"
  // belongs in the copy: the outlet is already shown on the card, and a blanket
  // caveat on every line says nothing about any particular one.
  return { summary, text: `${summary}.` };
}

/** Headline for a feed card or map popup. */
function reportTeaser(r) {
  const custom = (r && (r.summary || r.label || r.teaser)) || '';
  if (custom && !hasNonLatinScript(custom) && String(custom).trim().length >= 8) {
    return String(custom).trim().replace(/[.\s]+$/, '');
  }
  return fallbackReport(r).summary;
}

/**
 * The card's body under the headline: the whole report, minus a first sentence
 * that only restates the headline. CSS clamps it to three lines and the card
 * offers "Read more" when it runs longer — never cut the text itself, or a
 * long report ends in "…" with no way to read the rest.
 * Returns "" when the body adds nothing the headline did not say.
 */
function reportLead(r) {
  const full = formatFullReport(r && r.text, r);
  if (!full) return '';
  const body = full.replace(/^[A-Z'’— .-]{3,32}\s*—\s*/, '').trim();
  if (!body) return '';

  const head = String(reportTeaser(r) || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out = [];
  for (const s of sentences) {
    const bare = s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    // Skip a first sentence that merely restates the headline.
    if (!out.length && head && (bare.startsWith(head.slice(0, 40)) || head.startsWith(bare.slice(0, 40)))) continue;
    out.push(s);
  }
  const lead = out.join(' ').trim();
  if (lead.length < 25) return '';
  return lead;
}

/** A pin whose report the reader wrote — its text is already glossed. */
function isReaderWritten(url) {
  if (!url || !data) return false;
  return (data.reports || []).some((r) => r && r.side && r.url === url);
}

/** Expanded body. Never shows source-language text. */
function formatFullReport(text, r) {
  const raw = String(text || '');
  // Reader-written copy (it carries `side`) already glosses places by the
  // desk's rules; glossing it again produced "Taiz in south-west Yemen
  // governorate". Only older copy is annotated here.
  if (raw && !hasNonLatinScript(raw)) return r && r.side ? cleanBody(raw) : annotatePlaces(cleanBody(raw));
  return fallbackReport(r || { text }).text;
}

function headlineFrom(text) {
  const t = cleanBody(text).split(/(?<=[.!?])\s+/)[0] || '';
  return t.replace(/[.\s]+$/, '');
}

function isWeakHeadline(h) {
  const s = String(h || '').trim();
  if (s.length < 10) return true;
  if (/^(event|update|desk)\b/i.test(s)) return true;
  return false;
}

/* ---------------------------------------------------------------- *
 * Map classification
 * ---------------------------------------------------------------- */

function isSeaishPlaceName(name) {
  return /^(Bab al-Mandab|Mayun|Hanish|the Red Sea|the Gulf of Aden|the Arabian Sea)/.test(String(name || ''));
}

/** True open water in Bab al-Mandab — not Mayun, not the Yemeni shore. */
function isOpenSeaNearBab(lat, lng) {
  if (lat == null || lng == null) return false;
  if (Math.hypot(lat - 12.65, lng - 43.414) < 0.05) return false;
  if (Math.hypot(lat - 13.73, lng - 42.75) < 0.15) return false;
  if (lng >= 43.40) return false;
  if (lng <= 43.12) return false;
  return lat >= 11.95 && lat <= 13.15;
}

/** Statements never float on open water; only vessel hits belong at sea. */
function allowCoordsForCategory(cat, placeName, lat, lng) {
  if (!cat) return false;
  if (cat === 'vessel') return true;
  if (cat === 'statement') {
    if (isSeaishPlaceName(placeName) || isOpenSeaNearBab(lat, lng)) return false;
    return true;
  }
  if (isOpenSeaNearBab(lat, lng)) return false;
  return true;
}

function guessCoords(text) {
  const t = String(text || '');
  if (!t) return null;
  const hits = [];
  for (const name of placeNamesByLength()) {
    const idx = t.indexOf(name);
    if (idx >= 0) {
      const ll = PLACE_COORDS[name];
      hits.push({ name, idx, len: name.length, lat: ll[0], lng: ll[1] });
    }
  }
  if (!hits.length) return null;
  const seaish = (n) => isSeaishPlaceName(n);
  const early = hits.filter((h) => h.idx < 180 && !seaish(h.name));
  const pool = early.length ? early : hits.filter((h) => !seaish(h.name));
  const use = (pool.length ? pool : hits).sort((a, b) => a.idx - b.idx || b.len - a.len)[0];
  return { lat: use.lat, lng: use.lng, place: use.name };
}

const GROUND_RE = /\bclash(?:es|ed)?\b|\bfighting\b|front line|contact lines?|ground (?:assault|engagement)|shelling|artillery|mortar|counter-attack|attack(?:ed)? government lines|seize|seized|retake|retook|infiltration/i;
const STRIKE_RE = /\bstrike[sd]?\b|air strikes?|\bmissile\b|ballistic|\bdrone\b|\bUAV\b|launch(?:ed|es)?\b|shot down|intercept(?:ed)?|air defence alerts?|air raid sirens?|explosion|blast/i;
const VESSEL_RE = /\bvessel\b|\btanker\b|merchant ship|bulk carrier|\bcrew\b|\bship\b|UKMTO/i;
const PORT_RE = /\bport\b|oil terminal|refinery|Aramco|terminal at/i;
const NONMAP_RE = /\bF-?35\b|arms (?:deal|sale)|approved a (?:possible )?sale|State Department|condemn(?:s|ed)?\b|expresses solidarity|appeal|funding|displaced|refugee|humanitarian|Crisis Group|travel warning/i;

/**
 * Strict map categories. Anything that is not an event at a point on the ground
 * or at sea returns null and stays in the feed.
 */
function classifyForMap(text, hintedType) {
  const t = String(text || '');
  const hint = String(hintedType || '').toLowerCase();
  if (hint === 'vessel') return 'vessel';
  if (hint === 'port') return 'port';
  if (hint === 'statement' || hint === 'diplomacy' || hint === 'intel') return 'statement';
  if (hint === 'combat' || hint === 'clash' || hint === 'capture' || hint === 'military') return 'combat';
  if (hint === 'economy' || hint === 'humanitarian') return null;
  if (hint === 'missile' || hint === 'strike' || hint === 'launch') {
    if (VESSEL_RE.test(t) && !PORT_RE.test(t)) return 'vessel';
    if (PORT_RE.test(t)) return 'port';
    return 'strike';
  }
  if (!t.trim()) return null;
  if (NONMAP_RE.test(t) && !GROUND_RE.test(t) && !STRIKE_RE.test(t)) return null;
  if (VESSEL_RE.test(t) && STRIKE_RE.test(t) && !PORT_RE.test(t)) return 'vessel';
  if (PORT_RE.test(t) && STRIKE_RE.test(t)) return 'port';
  const ground = GROUND_RE.test(t);
  const strike = STRIKE_RE.test(t);
  if (ground && strike) {
    const head = t.slice(0, 120);
    if (/air strikes?|missile|drone|launch/i.test(head) && !/clash|fighting|counter-attack/i.test(head)) return 'strike';
    return 'combat';
  }
  if (ground) return 'combat';
  if (strike) return 'strike';
  return null;
}

function inferType(text, fallback) {
  const c = classifyForMap(text, fallback);
  if (c === 'strike') return /drone|missile/i.test(text || '') ? 'missile' : 'strike';
  if (c === 'combat') return /seize|seized|retake|retook/i.test(text || '') ? 'capture' : 'combat';
  if (c === 'statement') return 'statement';
  return fallback || 'military';
}

function pinCategory(typeOrText) {
  const t = String(typeOrText || '').toLowerCase();
  if (t === 'strike' || t === 'missile' || t === 'launch') return 'strike';
  if (t === 'vessel') return 'vessel';
  if (t === 'port') return 'port';
  if (t === 'statement' || t === 'diplomacy' || t === 'intel') return 'statement';
  if (['combat', 'clash', 'capture', 'military', 'redeploy', 'deployment', 'position'].includes(t)) return 'combat';
  return classifyForMap(typeOrText, '') || 'combat';
}

function jitter(lat, lng, i) {
  const a = (i % 8) * 0.785;
  const r = 0.012 + (i % 5) * 0.004;
  return [lat + Math.sin(a) * r, lng + Math.cos(a) * r];
}

/* ---------------------------------------------------------------- *
 * Data loading
 * ---------------------------------------------------------------- */

async function fetchData() {
  const res = await fetch('/data.json?ts=' + Date.now());
  return res.json();
}

function stripNikud(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

/**
 * Collapse a wave of copy-cat posts into one card — but only a wave.
 *
 * This used to key on the whole DAY, so every strike reported in Marib between
 * midnight and midnight became a single card no matter how many separate
 * engagements they were. A day of fighting rendered as one line, which is the
 * opposite of what a running feed is for.
 *
 * Copy-cat posts arrive within minutes of each other, so a three-hour window
 * catches them while leaving a morning strike and an evening strike as the two
 * distinct events they are. Overnight Saudi alerts keep their own all-night
 * bucket below, because those genuinely are one story either side of midnight.
 */
function feedClusterKey(r) {
  const s = `${r.place || ''} ${r.summary || ''} ${r.text || ''}`;
  const ts = reportTime(r);
  let ymd = jerusalemYmd(ts) || String(r.at || '').slice(0, 10);
  const t = String(r.type || 'x').toLowerCase();
  const hourOf = (v) => {
    const h = parseInt(String(v || '').slice(11, 13), 10);
    return Number.isFinite(h) ? h : 0;
  };
  // Three-hour slot, appended to the day below for everything but alerts.
  const slot = Math.floor(hourOf(ts || r.at) / 3);
  let b = 'other';
  if (/air raid sirens|air defence alerts/i.test(s)) {
    b = 'ksa-alert';
    const hour = parseInt(String(ts || r.at || '').slice(11, 13), 10);
    if (Number.isFinite(hour) && hour < 5) {
      const d = Date.parse(ts);
      if (Number.isFinite(d)) ymd = jerusalemYmd(d - 5 * 3600 * 1000) || ymd;
    }
  } else if (/Kahbub|Bab al-Mandab|Mayun|Dhubab/i.test(s)) b = 'bab';
  else if (/Al-Wazi'iyah|Al-Dharifah|Sharirah|Al-Alqamah/i.test(s)) b = 'waziyah';
  else if (/Marib|Wadi Dhanah|East Balaq/i.test(s)) b = 'marib';
  else if (/Al-Jawf|Al-Hazm/i.test(s)) b = 'jawf';
  else if (/Lahj|Al-Aghbara|Al-Mudaribah/i.test(s)) b = 'lahj';
  else if (/Hodeidah|Al-Khokha/i.test(s)) b = 'hudaydah';
  else if (/Yanbu|crude|oil|Suez|Aramco/i.test(s) || t === 'economy') b = 'energy';
  else if (/Sanaa/i.test(s)) b = 'sanaa';
  // An overnight alert wave is one story across the whole night; everything
  // else is one story only within its three-hour slot.
  if (b === 'ksa-alert') return `${ymd}|${t}|${b}`;
  if (t === 'combat' || t === 'strike' || t === 'economy') return `${ymd}|${slot}|${t}|${b}`;
  // One speech arrives as many posts; a named speaker within a three-hour slot
  // is one story. Mirrors namedSpeaker() in yemen-scan.server.ts.
  if (t === 'statement' || t === 'diplomacy') {
    const who = namedSpeaker(r.summary);
    if (who) return `${ymd}|${slot}|stmt|${who}`;
  }
  return r.fp || r.url || s.slice(0, 40);
}

function namedSpeaker(summary) {
  const m = /^(.{2,48}?)(?::\s|\s(?:says|said|tells|told|warns|warned|denies|denied)\b)/.exec(String(summary || ''));
  if (!m) return '';
  const who = m[1].trim();
  if (/^(an?|the)\s/i.test(who)) return '';
  if (/^(spokes(?:man|woman|person)|officials?|sources?|commanders?|ministers?)$/i.test(who)) return '';
  return who.toLowerCase();
}

/**
 * A report collapsed into another card's story is attached to it, not dropped:
 * a second outlet's account of the same event stays one click away.
 */
function attachAccount(keep, other) {
  if (!keep || !other || !other.url || other.source === keep.source) return;
  const list = Array.isArray(keep.alsoReportedBy) ? keep.alsoReportedBy : [];
  if (list.some((a) => a.source === other.source)) return;
  keep.alsoReportedBy = [...list, { source: other.source, url: other.url }];
}

/** Every report by fp, so a follow-up card can quote the report it replies to. */
let reportByFp = new Map();

function sortedReports(d) {
  const raw = [...(d.reports || [])]
    .filter((r) => r && r.url && !isHomepageOrSectionUrl(r.url))
    .sort((a, b) => new Date(reportTime(b)) - new Date(reportTime(a)));
  reportByFp = new Map(raw.filter((r) => r.fp).map((r) => [String(r.fp), r]));
  const seen = new Map();
  const seenUrl = new Set();
  const seenHead = new Set();
  const out = [];
  const canon = (u) => String(u || '').split('?')[0].replace(/\/$/, '').toLowerCase();
  const score = (x) => String(x.summary || '').length + (String(x.summary).match(/\d/g) || []).length * 10 + (x.tier === 'agency' ? 60 : 0);
  for (const r of raw) {
    const u = canon(r.url);
    if (u && seenUrl.has(u)) continue;
    const ymd = jerusalemYmd(reportTime(r)) || String(r.at || '').slice(0, 10);
    const hk = `${ymd}|${stripNikud(r.summary || '').slice(0, 80)}`;
    if (seenHead.has(hk)) continue;
    // Only copies of one event fold together: the same story key AND posted
    // within 20 minutes of each other. A later development is its own card
    // (a reply, when the reader tied it to the earlier one), never hidden.
    const k = feedClusterKey(r);
    const t = Date.parse(reportTime(r));
    const group = seen.get(k) || [];
    const prev = group.find((p) => Math.abs(Date.parse(reportTime(p)) - t) <= 20 * 60 * 1000);
    if (!prev || r.replyTo) {
      group.push(r);
      seen.set(k, group);
      if (u) seenUrl.add(u);
      seenHead.add(hk);
      out.push(r);
      continue;
    }
    if (score(r) > score(prev) + 12) {
      const i = out.indexOf(prev);
      if (i >= 0) out[i] = r;
      group[group.indexOf(prev)] = r;
      attachAccount(r, prev);
    } else {
      attachAccount(prev, r);
    }
    if (u) seenUrl.add(u);
    seenHead.add(hk);
  }
  out.sort((a, b) => (Date.parse(reportTime(b)) || 0) - (Date.parse(reportTime(a)) || 0));
  return out;
}

/*
 * Everything the clock has collected, as opposed to what the last cycle saw.
 *
 * `/data.json` is baked at build time and `/api/scan` returns one cycle, so
 * without this the feed was a rolling window: a report that scrolled out of a
 * Telegram channel's recent messages disappeared from the desk even though it
 * was safely stored. This is the archive that makes the feed continuous.
 */
let deskArchive = { reports: [], events: [], updatedAt: null };

async function pullDesk() {
  try {
    const res = await fetch('/api/desk?limit=400&ts=' + Date.now());
    if (!res.ok) return;
    const body = await res.json();
    if (!body || body.ok === false) return;
    deskArchive = {
      reports: Array.isArray(body.reports) ? body.reports : [],
      events: Array.isArray(body.events) ? body.events : [],
      updatedAt: body.updatedAt || null,
    };
  } catch (e) {
    // The desk still renders from data.json and the live overlay. A failed
    // archive read costs depth, never the page.
    console.warn('desk archive', e);
  }
}

/*
 * Paging back through the archive. The page first loads the newest 400 rows;
 * when "Show earlier reports" reaches the end of those, it asks for the next
 * page strictly older than the oldest report it holds. Without this the feed
 * had a floor: deployed, anything past row 400 was stored but unreachable.
 */
let archiveExhausted = false;
const OLDER_PAGE = 200;

async function pullOlderDesk() {
  if (archiveExhausted || !data) return false;
  const times = (data.reports || []).map((r) => Date.parse(reportTime(r))).filter(Number.isFinite);
  if (!times.length) return false;
  const oldest = new Date(Math.min(...times)).toISOString();
  try {
    const res = await fetch('/api/desk?limit=' + OLDER_PAGE + '&before=' + encodeURIComponent(oldest));
    if (!res.ok) return false;
    const body = await res.json();
    const rows = body && Array.isArray(body.reports) ? body.reports : [];
    if (!rows.length) { archiveExhausted = true; return false; }
    if (rows.length < OLDER_PAGE) archiveExhausted = true;
    deskArchive.reports = [...deskArchive.reports, ...rows];
    deskArchive.events = [...deskArchive.events, ...(Array.isArray(body.events) ? body.events : [])];
    data = applyDeskArchive(data);
    return true;
  } catch (e) {
    console.warn('older reports', e);
    return false;
  }
}

/*
 * Freshness: is the stream flowing? Green while the last scan is recent, amber
 * after 15 minutes, red after 30 — so a stalled clock is visible on the page
 * instead of a quiet feed that merely looks like a quiet war.
 */
function renderFreshness() {
  const el = document.getElementById('feed-fresh');
  if (!el || !data) return;
  const last = Date.parse(liveOverlay.scannedAt || '');
  if (!Number.isFinite(last)) { el.textContent = ''; return; }
  const mins = Math.max(0, Math.round((Date.now() - last) / 60000));
  const hourAgo = Date.now() - 3600 * 1000;
  const lastHour = (data.reports || []).filter((r) => Date.parse(reportTime(r)) >= hourAgo).length;
  const ago = mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : mins < 120 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  el.textContent = `Last scan ${ago} · ${lastHour} ${lastHour === 1 ? 'report' : 'reports'} in the last hour`;
  el.classList.toggle('stale-amber', mins >= 15 && mins < 30);
  el.classList.toggle('stale-red', mins >= 30);
}

/**
 * Fold the archive into the base snapshot.
 *
 * Locally the archive IS data.json, so every row dedupes away and this is a
 * no-op — which is the point: one code path, both worlds.
 */
function applyDeskArchive(base) {
  if (!base || !deskArchive.reports.length) return base;
  const canon = (u) => String(u || '').split('?')[0].replace(/\/$/, '').toLowerCase();

  const haveUrl = new Set((base.reports || []).map((r) => canon(r.url)));
  const haveFp = new Set((base.reports || []).map((r) => String(r.fp || '')));
  const extra = deskArchive.reports.filter((r) => {
    if (!r || !r.url) return false;
    const u = canon(r.url);
    if (haveUrl.has(u) || haveFp.has(String(r.fp || ''))) return false;
    haveUrl.add(u);
    haveFp.add(String(r.fp || ''));
    return true;
  });
  if (extra.length) {
    base.reports = [...extra, ...(base.reports || [])];
    base.reports.sort((a, b) => (Date.parse(reportTime(b)) || 0) - (Date.parse(reportTime(a)) || 0));
  }

  const haveEvent = new Set((base.events || []).map((e) => String(e.fp || '')));
  const newEvents = deskArchive.events.filter((e) => e && e.fp && !haveEvent.has(String(e.fp)));
  if (newEvents.length) base.events = [...newEvents, ...(base.events || [])];

  return base;
}

function applyLiveOverlay(base) {
  if (!base) return base;
  const canon = (u) => String(u || '').split('?')[0].replace(/\/$/, '').toLowerCase();
  const haveUrl = new Set((base.reports || []).map((r) => canon(r.url)));
  // A story gains corroborating outlets over time, so refresh that on rows the
  // desk already holds — otherwise only reports first seen after grouping
  // landed would ever show "3 sources".
  const liveByUrl = new Map((liveOverlay.reports || []).filter((r) => r && r.url).map((r) => [canon(r.url), r]));
  for (const r of base.reports || []) {
    const live = liveByUrl.get(canon(r.url));
    if (live && Array.isArray(live.alsoReportedBy) && live.alsoReportedBy.length) {
      r.alsoReportedBy = live.alsoReportedBy;
    }
  }

  const extra = (liveOverlay.reports || []).filter((r) => {
    if (!r || !r.url) return false;
    const u = canon(r.url);
    if (haveUrl.has(u)) return false;
    // Same-story copies are folded by sortedReports within their 20 minutes;
    // dropping on the story key here hid every later development.
    haveUrl.add(u);
    return true;
  });
  if (extra.length) base.reports = [...extra, ...(base.reports || [])];
  if (liveOverlay.scannedAt) {
    const liveT = Date.parse(liveOverlay.scannedAt);
    const baseT = Date.parse(base.updatedAt || 0);
    if (Number.isFinite(liveT) && (!Number.isFinite(baseT) || liveT > baseT)) base.updatedAt = liveOverlay.scannedAt;
  }
  return base;
}

/**
 * Overall source health, not this cycle's fetch count.
 *
 * Sources are on staggered schedules, so a cycle where nothing was due is
 * normal — but reporting it as "0/0 sources" reads as a broken desk. The
 * accumulated per-source status is the honest answer to "is the desk healthy".
 */
function sourceHealth() {
  const all = Array.isArray(liveOverlay.sourceStatus) ? liveOverlay.sourceStatus : [];
  if (!all.length) return null;
  return { ok: all.filter((s) => s && s.ok).length, total: all.length };
}

function stampText() {
  const age = Math.max(0, Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 1000));
  const health = sourceHealth();
  const scan = health
    ? ` · live scan ${health.ok}/${health.total} sources`
    : ' · live scan every 5 min';
  return `Updated ${fmtClock(data.updatedAt)} · ${age}s ago${scan}`;
}

let liveInflight = null;

function isJunkLive(r) {
  const s = String((r && r.summary) || '').trim();
  if (!s || s.length < 14) return true;
  if (hasNonLatinScript(s)) return true;
  return false;
}

function ingestLivePayload(live) {
  if (!live || live.ok === false) return false;
  liveOverlay.scannedAt = live.scannedAt || liveOverlay.scannedAt;
  liveOverlay.sourcesOk = live.sourcesOk || 0;
  liveOverlay.sourcesTried = live.sourcesTried || 0;
  if (live.cycleNote) liveOverlay.cycleNote = live.cycleNote;
  if (Array.isArray(live.reasons)) liveOverlay.reasons = live.reasons;
  if (Array.isArray(live.sourceStatus)) liveOverlay.sourceStatus = live.sourceStatus;
  if (Array.isArray(live.unplaced)) liveOverlay.unplaced = live.unplaced;
  if (Array.isArray(live.rawHits)) {
    const haveRaw = new Set((liveOverlay.rawHits || []).map((h) => String(h.url || '').split('?')[0]));
    live.rawHits.filter((h) => h && h.url).forEach((h) => {
      const u = String(h.url).split('?')[0];
      if (!haveRaw.has(u)) {
        liveOverlay.rawHits.push(h);
        haveRaw.add(u);
      }
    });
    // Newest scanned first — the box is a log of what the scanner just pulled.
    liveOverlay.rawHits.sort((a, b) => scanSeen(b) - scanSeen(a));
    if (liveOverlay.rawHits.length > 140) liveOverlay.rawHits = liveOverlay.rawHits.slice(0, 140);
  }
  const incoming = Array.isArray(live.reports) ? live.reports : [];
  const have = new Set((liveOverlay.reports || []).map((r) => String(r.url || '').split('?')[0]));
  incoming.forEach((r) => {
    if (!r || !r.url || have.has(String(r.url).split('?')[0])) return;
    if (isJunkLive(r)) return;
    liveOverlay.reports.push(r);
    have.add(String(r.url).split('?')[0]);
  });
  liveOverlay.reports = (liveOverlay.reports || []).filter((r) => !isJunkLive(r));
  if (liveOverlay.reports.length > 60) liveOverlay.reports = liveOverlay.reports.slice(0, 60);
  return true;
}

/** When this desk first saw the item, falling back to publication time. */
function scanSeen(h) {
  const t = Date.parse(h && (h.seenAt || h.at));
  return Number.isFinite(t) ? t : 0;
}

async function hydrateSnapshot() {
  if (liveOverlay.reports.length) return;
  try {
    const res = await fetch('/live-reports.json?ts=' + Date.now());
    if (!res.ok) return;
    ingestLivePayload(await res.json());
  } catch (e) { /* no snapshot yet */ }
}

async function pullLive(opts) {
  const silent = !!(opts && opts.silent);
  if (!liveInflight) {
    liveInflight = (async () => {
      try {
        const res = await fetch('/api/scan?ts=' + Date.now());
        if (!res.ok) throw new Error('scan ' + res.status);
        ingestLivePayload(await res.json());
      } catch (e) {
        console.warn('live scan', e);
      }
    })().finally(() => { liveInflight = null; });
    liveInflight.then(() => paintLive());
  }
  if (silent) return liveInflight;
  await liveInflight;
  paintLive();
}

function paintLive() {
  if (!data) return;
  const beforeUrls = new Set((data.reports || []).map((r) => r.fp || r.url));
  data = applyLiveOverlay(data);
  const el = document.getElementById('updated');
  if (el) el.textContent = stampText();
  renderLiveScan();
  renderFreshness();
  const extra = (data.reports || []).filter((r) => r && (r.fp || r.url) && !beforeUrls.has(r.fp || r.url));
  if (extra.length) prependFeedCards(data);
  try { addNewMapPins(data); } catch (e) {}
}

/* ---------------------------------------------------------------- *
 * The 12-hour brief
 * ---------------------------------------------------------------- */

async function pullBrief() {
  try {
    const res = await fetch('/api/brief?ts=' + Date.now());
    if (!res.ok) return;
    const b = await res.json();
    if (b && b.ok) brief = b;
  } catch (e) { /* the panels fall back to their curated copy */ }
}

/**
 * The stamp under every 12-hourly panel. Says plainly when the panel last
 * refreshed and when it next will, and flags it when the refresh is overdue.
 */
function cadenceStamp() {
  if (!brief) return '<p class="cadence">Refreshes every 12 hours.</p>';
  const overdue = Date.now() > Date.parse(brief.nextUpdateAt);
  return `<p class="cadence${overdue ? ' late' : ''}">Updated ${escapeHtml(fmtWhen(brief.updatedAt))} · next ${escapeHtml(fmtWhen(brief.nextUpdateAt))}${overdue ? ' · refresh due' : ''}</p>`;
}

function frontActivity(id) {
  if (!brief || !Array.isArray(brief.fronts)) return null;
  return brief.fronts.find((f) => f.id === id) || null;
}

/* ---------------------------------------------------------------- *
 * Live scan box
 * ---------------------------------------------------------------- */

function renderLiveScan() {
  const meta = document.getElementById('live-scan-meta');
  const list = document.getElementById('live-scan-list');
  const details = document.getElementById('live-scan-details');
  if (meta) {
    const t = liveOverlay.scannedAt ? fmtClock(liveOverlay.scannedAt) : '—';
    meta.textContent = liveOverlay.scannedAt ? `Last scan ${t}` : 'Not scanned yet';
  }
  if (!details || !details.open || !list) return;

  const rows = [...(liveOverlay.rawHits || [])]
    .sort((a, b) => scanSeen(b) - scanSeen(a))
    .slice(0, 90);

  // Interesting / Not were removed: the verdicts only ever reached this
  // browser's localStorage, so they taught the desk nothing and the buttons
  // promised more than they did.
  list.innerHTML = rows.map((h) => {
    const u = String(h.url || '').split('?')[0];
    const seen = h.seenAt ? fmtStamp(h.seenAt) : '';
    const pub = h.at ? fmtStamp(h.at) : '';
    const sn = escapeHtml((h.snippet || '').slice(0, 240));
    return `<div class="ls-row" data-url="${escapeHtml(u)}">
      <div class="ls-top">
        <span class="ls-src">${escapeHtml(h.source || '')}</span>
        <span class="ls-at" title="Published ${escapeHtml(pub)}">scanned ${escapeHtml(seen || pub)}</span>
      </div>
      <p class="ls-sn">${sn}</p>
      <div class="ls-mark">
        <a class="src-link" href="${escapeHtml(h.url)}" target="_blank" rel="noopener">Open source</a>
      </div>
    </div>`;
  }).join('') || '<p class="ls-hint">Nothing raw in the last cycle.</p>';
}


/* ---------------------------------------------------------------- *
 * Panels
 * ---------------------------------------------------------------- */

function renderSituation(d) {
  const el = document.getElementById('situation');
  if (!el) return;
  // The hand-typed paragraph that used to sit in data.json is gone: it never
  // updated, so it aged into a description of a different week. The status is
  // now composed each window from what the desk actually logged.
  const derived = brief && brief.situation ? brief.situation.line : '';
  const fallback = String((d.situation || {}).summary || '').trim();
  const body = derived || fallback;
  if (!body) { el.innerHTML = ''; return; }
  el.innerHTML = `<strong>Situation</strong>
    <p class="situation-window">${escapeHtml(body)}</p>
    ${cadenceStamp()}`;
}

/*
 * "The conflict in numbers": three boxes from the server's official tally
 * (src/lib/desk/tally.ts), refreshed with the 12-hour brief. Each side's
 * figure counts fighters and civilians on that side; "Civilians" is every
 * side's civilians in one number. A figure no official body has given shows
 * as a dash, never an estimate.
 */
const TALLY_FALLBACK = {
  since: '2026-07-03',
  killed: { houthi: 278, gov: 216, saudi: 1, civilians: 150 },
  injured: { houthi: null, gov: null, saudi: 73, civilians: null },
  idp: 112000,
  refugees: 3000,
  from: {},
};

function fmtCount(n) {
  return Number.isFinite(n) ? Number(n).toLocaleString('en-US') : '—';
}

function renderCasualties() {
  const el = document.getElementById('casualties');
  if (!el) return;
  const t = (brief && brief.tally) || TALLY_FALLBACK;
  const row = (label, key, n) => {
    const src = t.from && t.from[key];
    const tip = src ? `${src.name}${src.date ? ', ' + src.date : ''}` : '';
    return `<div class="tally-row"${tip ? ` title="${escapeHtml(tip)}"` : ''}><span>${label}</span><strong>${fmtCount(n)}</strong></div>`;
  };
  const sides = (group) => [
    row('Houthi', `${group}.houthi`, t[group].houthi),
    row('Government', `${group}.gov`, t[group].gov),
    row('Saudi Arabia', `${group}.saudi`, t[group].saudi),
    row('Civilians', `${group}.civilians`, t[group].civilians),
  ].join('');
  const seen = new Set();
  const sources = Object.values(t.from || {}).filter((s) => {
    const k = s && s.name;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const srcHtml = sources.map((s) => (s.url
    ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>`
    : escapeHtml(s.name))).join(' · ');
  el.innerHTML = `
    <div class="tally">
      <div class="tally-box"><h3>Killed</h3>${sides('killed')}</div>
      <div class="tally-box"><h3>Injured</h3>${sides('injured')}</div>
      <div class="tally-box"><h3>Humanitarian</h3>
        ${row('Internally displaced', 'idp', t.idp)}
        ${row('Refugees', 'refugees', t.refugees)}
      </div>
    </div>
    <p class="tally-note">Since ${escapeHtml(fmtDay(t.since))}. Official figures only.</p>
    ${srcHtml ? `<div class="srcs">Sources: ${srcHtml}</div>` : ''}
    ${cadenceStamp()}`;
}

function computeControlShares(d) {
  const sums = { houthi: 0, plc: 0, contested: 0 };
  (d.governorates || []).forEach((g) => {
    if (String(g.id || '').startsWith('SA-')) return;
    const w = GOV_WEIGHT[g.id] || 1;
    const k = g.control === 'houthi' ? 'houthi' : (g.control === 'plc' ? 'plc' : 'contested');
    sums[k] += w;
  });
  (d.islandControl || []).forEach((isl) => {
    const k = isl.control === 'houthi' ? 'houthi' : (isl.control === 'plc' ? 'plc' : 'contested');
    sums[k] += 0.6;
  });
  if ((d.governorates || []).some((g) => g.id === 'YE-TA' && g.control !== 'houthi')) {
    sums.houthi += 1;
    sums.contested = Math.max(0, sums.contested - 1);
  }
  const tot = sums.houthi + sums.plc + sums.contested || 1;
  const h = Math.round(100 * sums.houthi / tot);
  const p = Math.round(100 * sums.plc / tot);
  return { houthi: h, plc: p, contested: Math.max(0, 100 - h - p) };
}

function renderBars(d) {
  const shares = computeControlShares(d);
  const rows = (d.control || []).filter((c) => c.id !== 'saudi').map((c) => {
    const pct = shares[c.id] != null ? shares[c.id] : c.pct;
    const color = c.id === 'plc' ? COLORS.plc : (c.color || COLORS[c.id]);
    return `<div class="bar" title="${escapeHtml(c.note || '')}">
      <h3>${escapeHtml(c.name)}</h3>
      <div class="pct" style="color:${color}">${pct}%</div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');
  document.getElementById('bars').innerHTML = rows;
}

function feedCardHtml(r, i) {
  const ts = reportTime(r);
  const src = sourceOf(r);
  const fp = r.fp || ('i' + i);
  const sum = reportTeaser(r);
  const srcHtml = sourceAnchors(src, r.url || '');
  const lead = reportLead(r);
  const also = Array.isArray(r.alsoReportedBy) && r.alsoReportedBy.length ? r.alsoReportedBy : null;
  const isOpen = openFeedFps.has(fp);
  const leanRaw = sourceLean(src);
  const lean = (leanRaw === 'south' || leanRaw === 'intl' || leanRaw === 'other') ? 'indep' : leanRaw;
  // The source name in the meta line links to the original, so the card has
  // no second "Read the report" link. "Read more" stays hidden until
  // wireFeedCard measures that the lead overflows its three lines.
  return `<article class="card lean-${lean}${isOpen ? ' open' : ''}" data-i="${i}" data-fp="${escapeHtml(fp)}" title="${escapeHtml(LEAN_LABEL[lean] || '')}">
      <div class="meta">
        <time datetime="${escapeHtml(ts)}">${escapeHtml(fmtStamp(ts))}</time>
        <span class="src-wrap">${srcHtml}</span>
      </div>
      ${replyQuote(r)}
      <p class="headline">${escapeHtml(sum)}</p>
      ${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}
      ${mediaBlock(r.media)}
      ${also ? `<p class="also">Also: ${also.map((a) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.source)}</a>`).join(' · ')}</p>` : ''}
      ${lead ? `<div class="actions"><button type="button" class="toggle" hidden>${isOpen ? 'Show less' : 'Read more'}</button></div>` : ''}
    </article>`;
}

/** "Follows 11:02 · <headline>": the earlier report this one develops. */
function replyQuote(r) {
  const parent = r.replyTo && reportByFp.get(String(r.replyTo));
  // A reply points back in time only.
  if (!parent || !(Date.parse(reportTime(parent)) < Date.parse(reportTime(r)))) return '';
  const pt = reportTime(parent);
  return `<a class="reply-to" href="#" data-parent="${escapeHtml(String(r.replyTo))}">↩ Follows ${escapeHtml(fmtStamp(pt))} · ${escapeHtml(reportTeaser(parent))}</a>`;
}

/** Does the clamped lead hide text? Measured; a length guess while hidden or open. */
function leadOverflows(card) {
  const lead = card.querySelector('.lead');
  if (!lead) return false;
  if (card.classList.contains('open') || !lead.clientHeight) return lead.textContent.length > 200;
  return lead.scrollHeight > lead.clientHeight + 2;
}

function wireFeedCard(card) {
  if (!card) return;
  const reply = card.querySelector('.reply-to');
  if (reply) {
    reply.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const target = document.querySelector(`#feed .card[data-fp="${CSS.escape(reply.dataset.parent)}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('flash');
      setTimeout(() => target.classList.remove('flash'), 1600);
    };
  }
  const btn = card.querySelector('.toggle');
  if (btn && leadOverflows(card)) {
    card.classList.add('expandable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', card.classList.contains('open') ? 'true' : 'false');
    btn.hidden = false;
  }
  const setCardOpen = (open) => {
    if (!card.classList.contains('expandable')) return;
    card.classList.toggle('open', open);
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (btn) btn.textContent = open ? 'Show less' : 'Read more';
    const fp = card.dataset.fp;
    if (fp) {
      if (open) openFeedFps.add(fp);
      else openFeedFps.delete(fp);
    }
  };
  const toggleCard = () => setCardOpen(!card.classList.contains('open'));
  if (card.classList.contains('expandable')) {
    card.onclick = (ev) => {
      const t = ev.target;
      if (!t) return;
      if (t.closest('a, button, details, summary, input, textarea, select, .media-block, figure')) return;
      toggleCard();
    };
    card.onkeydown = (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.target !== card) return;
      ev.preventDefault();
      toggleCard();
    };
  }
  if (btn) {
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      toggleCard();
    };
  }
}

function renderFeed(d) {
  const all = sortedReports(d);
  const slice = all.slice(0, reportsShown);
  const fc = document.getElementById('feed-count');
  if (fc) fc.textContent = `${Math.min(reportsShown, all.length)} / ${all.length}`;
  document.getElementById('feed').innerHTML = slice.map((r, i) => feedCardHtml(r, i)).join('');
  document.querySelectorAll('#feed .card').forEach(wireFeedCard);
  const more = document.getElementById('btn-more-reports');
  if (reportsShown < all.length) {
    more.hidden = false;
    more.textContent = `Show earlier reports (+${Math.min(MORE_STEP, all.length - reportsShown)})`;
  } else if (!archiveExhausted) {
    more.hidden = false;
    more.textContent = 'Load older reports from the archive';
  } else {
    more.hidden = true;
  }
  renderFreshness();
  wireMediaClicks(document.getElementById('feed'));
}

function prependFeedCards(d) {
  const feed = document.getElementById('feed');
  if (!feed) return;
  if (!feed.children.length) { renderFeed(d); return; }
  const have = new Set([...feed.querySelectorAll('.card')].map((el) => el.dataset.fp));
  const all = sortedReports(d);
  const newcomers = [];
  for (const r of all) {
    const fp = r.fp || r.url;
    if (have.has(fp)) break;
    newcomers.push(r);
    if (newcomers.length > 12) break;
  }
  if (!newcomers.length) return;
  feed.insertAdjacentHTML('afterbegin', newcomers.map((r, i) => feedCardHtml(r, i)).join(''));
  [...feed.querySelectorAll('.card')].slice(0, newcomers.length).forEach(wireFeedCard);
  const more = document.getElementById('btn-more-reports');
  if (reportsShown < all.length && more) {
    more.hidden = false;
    more.textContent = `Show earlier reports (+${Math.min(MORE_STEP, all.length - reportsShown)})`;
  }
  wireMediaClicks(feed);
}

/* ---------------------------------------------------------------- *
 * Front locator mini-map
 * ---------------------------------------------------------------- */

function miniFillFor(id, d) {
  if (id === 'YE-MY' || id === 'YE-HN') {
    const want = id === 'YE-MY' ? 'mayun' : 'hanish';
    const meta = ((d && d.islandControl) || []).find((x) => x.id === want);
    const ctrl = (meta && meta.control) || 'houthi';
    return COLORS[ctrl] || COLORS.houthi;
  }
  const g = ((d && d.governorates) || []).find((x) => x.id === id) || {};
  const ctrl = g.control === 'mixed' ? 'contested' : (g.control === 'saudi' ? 'saudi' : g.control);
  return COLORS[ctrl] || COLORS.contested || '#334155';
}

function parsePathNums(cmd) {
  return String(cmd).replace(/[A-Za-z]/g, ' ').trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
}

function pathBBox(dcmds) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  (dcmds || []).forEach((cmd) => {
    const nums = parsePathNums(cmd);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minx = Math.min(minx, nums[i]); maxx = Math.max(maxx, nums[i]);
      miny = Math.min(miny, nums[i + 1]); maxy = Math.max(maxy, nums[i + 1]);
    }
  });
  if (!Number.isFinite(minx) || minx > maxx) return null;
  return [minx, miny, maxx, maxy];
}

function pathCentroid(dcmds) {
  let sx = 0, sy = 0, n = 0;
  (dcmds || []).forEach((cmd) => {
    const nums = parsePathNums(cmd);
    for (let i = 0; i + 1 < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; n++; }
  });
  if (!n) return null;
  return [sx / n, sy / n];
}

function unionBox(a, b) {
  if (!b) return a;
  if (!a) return b.slice();
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function frontMiniSvg(front, d) {
  const mini = miniGeo;
  if (!mini || !mini.features || !mini.features.length) return '<p class="front-float-miss">No locator map</p>';
  const locator = (front && front.mapFocus) || {};
  const ids = new Set(locator.ids || []);
  const name = (front && front.name) || '';
  const isBab = (ids.has('YE-MY') || ids.has('YE-HN')) && !ids.has('YE-TA');
  if (!ids.size) {
    if (/Wazi'iyah|western Taiz|Mocha|Dhubab|coast/i.test(name)) ids.add('YE-TA');
    else if (/Marib/i.test(name)) ids.add('YE-MA');
    else if (/Dhale/i.test(name)) ids.add('YE-DA');
    else if (/Jawf|Hazm/i.test(name)) ids.add('YE-JA');
    else if (/Bab al-Mandab|Mayun|Hanish/i.test(name)) { ids.add('YE-LA'); ids.add('YE-MY'); ids.add('YE-HN'); }
  }
  let box = null;
  (mini.features || []).forEach((f) => { box = unionBox(box, pathBBox(f.d)); });
  const pad = 10;
  const vx = box ? (box[0] - pad) : 0;
  const vy = box ? (box[1] - pad) : 0;
  const vw = box ? (box[2] - box[0] + pad * 2) : (mini.w || 240);
  const vh = box ? (box[3] - box[1] + pad * 2) : (mini.h || 280);
  const featById = {};
  (mini.features || []).forEach((f) => { featById[f.id] = f; });
  const paths = (mini.features || []).map((f) => {
    const on = ids.has(f.id);
    const col = miniFillFor(f.id, d);
    const fill = on ? col : '#8aa0b4';
    const op = on ? 0.96 : 0.78;
    const stroke = on ? '#f8fafc' : '#c5d4e2';
    const sw = on ? 1.2 : 0.55;
    return (f.d || []).map((dp) => `<path d="${dp}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"/>`).join('');
  }).join('');
  let strait = '';
  if (isBab) {
    strait = `<g class="strait-mark">
      <path d="M58,236 C64,244 70,250 78,252" fill="none" stroke="#7dd3fc" stroke-width="1.4" stroke-dasharray="3 2.2" opacity="0.95"/>
      <text x="78" y="268" fill="#c8e7fa" font-size="7" text-anchor="start">Bab al-Mandab strait</text>
    </g>`;
  }
  let spotSvg = '';
  let sx, sy, lab;
  if (Array.isArray(locator.miniSpot) && locator.miniSpot.length === 2) {
    sx = locator.miniSpot[0]; sy = locator.miniSpot[1];
    lab = locator.miniLabel || '';
  } else if (isBab) {
    const my = featById['YE-MY'];
    const c = my && pathCentroid(my.d);
    if (c) { sx = c[0]; sy = c[1]; lab = 'Mayun'; }
  }
  if (sx != null) {
    spotSvg = `<g>
      <circle cx="${sx}" cy="${sy}" r="6.2" fill="#fbbf24" fill-opacity="0.28" stroke="#fde68a" stroke-width="1.3"/>
      <circle cx="${sx}" cy="${sy}" r="2.2" fill="#fbbf24" stroke="#111" stroke-width="0.5"/>
      ${lab ? `<text x="${sx}" y="${sy - 9}" fill="#fde68a" font-size="7.2" text-anchor="middle">${escapeHtml(lab)}</text>` : ''}
    </g>`;
  }
  return `<svg viewBox="${vx} ${vy} ${vw} ${vh}" class="front-mini" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#1a2836"/>
    ${paths}${strait}${spotSvg}
  </svg>`;
}

function hideFrontFloat() {
  const el = document.getElementById('front-float');
  if (!el) return;
  el.classList.remove('show');
  el.hidden = true;
  el.innerHTML = '';
  frontFloatIdx = null;
  frontFloatAnchor = null;
  document.querySelectorAll('.front-map-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function placeFrontFloat(anchor) {
  const el = document.getElementById('front-float');
  if (!el || !anchor) return;
  el.hidden = false;
  el.classList.add('show');
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth || 280;
  const h = el.offsetHeight || 320;
  let left = r.right + 2;
  if (left + w > window.innerWidth - 8) left = r.left - w - 2;
  if (left < 8) left = 8;
  let top = r.top;
  if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
  if (window.innerWidth < 800) {
    left = 8;
    el.style.right = '8px';
    el.style.left = '8px';
    el.style.width = 'auto';
    top = Math.min(r.bottom + 8, window.innerHeight - h - 8);
  } else {
    el.style.right = 'auto';
    el.style.width = '';
    el.style.left = left + 'px';
  }
  el.style.top = Math.max(8, top) + 'px';
}

function textOverlap(a, b) {
  const na = String(a || '').replace(/\s+/g, ' ').trim();
  const nb = String(b || '').replace(/\s+/g, ' ').trim();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(/\s+/).filter((w) => w.length > 3));
  const tb = nb.split(/\s+/).filter((w) => w.length > 3);
  if (!tb.length) return false;
  return tb.filter((w) => ta.has(w)).length / tb.length > 0.68;
}

/* ---------------------------------------------------------------- *
 * Map overlays
 * ---------------------------------------------------------------- */

function clearIslandTags() {
  islandTagLayers.forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  islandTagLayers = [];
}

function placeIslandTags(d) {
  clearIslandTags();
  if (!map || !window.L) return;
  ((d && d.islandControl) || []).forEach((isl) => {
    const hit = (isl.id === 'mayun' && highlightIds.has('YE-MY')) || (isl.id === 'hanish' && highlightIds.has('YE-HN'));
    if (!hit || isl.lat == null || isl.lng == null) return;
    const icon = L.divIcon({
      className: 'isl-tag-wrap',
      html: `<div class="isl-tag">${escapeHtml(isl.name)}</div>`,
      iconSize: [92, 22],
      iconAnchor: [-8, 11],
    });
    const m = L.marker([isl.lat, isl.lng], { icon, interactive: false, keyboard: false, zIndexOffset: 2200 });
    m.addTo(map);
    islandTagLayers.push(m);
  });
}

function clearStraitOverlay() {
  if (straitHighlightLayer && map) {
    try { map.removeLayer(straitHighlightLayer); } catch (e) {}
    straitHighlightLayer = null;
  }
  if (straitLabelLayer && map) {
    try { map.removeLayer(straitLabelLayer); } catch (e) {}
    straitLabelLayer = null;
  }
}

function placeStraitOverlay() {
  clearStraitOverlay();
  if (!map || !window.L) return;
  straitHighlightLayer = L.polyline(
    [[12.63, 43.36], [12.655, 43.39], [12.68, 43.42]],
    { color: '#7dd3fc', weight: 3.2, dashArray: '8 6', opacity: 0.95, interactive: false },
  ).addTo(map);
  const icon = L.divIcon({
    className: 'isl-tag-wrap',
    html: '<div class="isl-tag strait-tag">Bab al-Mandab strait</div>',
    iconSize: [132, 22],
    iconAnchor: [8, 28],
  });
  straitLabelLayer = L.marker([12.66, 43.50], { icon, interactive: false, keyboard: false, zIndexOffset: 2300 });
  straitLabelLayer.addTo(map);
  syncStraitForZoom();
}

function syncStraitForZoom() {
  if (!map) return;
  const z = map.getZoom();
  try {
    const el = straitLabelLayer && (straitLabelLayer.getElement ? straitLabelLayer.getElement() : straitLabelLayer._icon);
    if (el) el.style.display = '';
  } catch (e) {}
  if (straitHighlightLayer && straitHighlightLayer.setStyle) {
    try { straitHighlightLayer.setStyle({ weight: z >= 9 ? 3.2 : 2.6, opacity: z >= 7 ? 0.95 : 0.8 }); } catch (e) {}
  }
}

function resetHomeView() {
  if (!map) return;
  try { map.setView(HOME_VIEW.slice(0, 2), HOME_VIEW[2], { animate: true }); } catch (e) {}
}

function scrollToMap() {
  const el = document.querySelector('.toolbar') || document.getElementById('map-wrap');
  if (!el) return;
  const jump = () => {
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const st = (typeof getComputedStyle === 'function') ? getComputedStyle(node) : null;
      const oy = st && (st.overflowY || st.overflow);
      if (st && (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 8) {
        const top = el.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop - 6;
        try { node.scrollTop = Math.max(0, top); } catch (e) {}
      }
      node = node.parentElement;
    }
    const y = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - 4;
    const top = Math.max(0, y);
    try { window.scrollTo({ top, left: 0, behavior: 'instant' }); } catch (e) {
      try { window.scrollTo(0, top); } catch (e2) {}
    }
    try { document.documentElement.scrollTop = top; } catch (e) {}
    try { document.body.scrollTop = top; } catch (e) {}
    try { el.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' }); } catch (e) {}
  };
  jump();
  try { requestAnimationFrame(jump); } catch (e) {}
  setTimeout(jump, 50);
  setTimeout(() => { try { map && map.invalidateSize(); } catch (e) {} }, 50);
  setTimeout(() => { try { map && map.invalidateSize(); } catch (e) {} }, 280);
}

function setHighlightChip(front) {
  const chip = document.getElementById('map-chip');
  if (!chip) return;
  chip.classList.add('chip-hl');
  chip.innerHTML = `<span>Showing: ${escapeHtml(front.name || 'this front')}</span><button type="button" class="chip-clear" id="btn-clear-hl">Clear</button>`;
  const btn = document.getElementById('btn-clear-hl');
  if (btn) {
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      clearMapHighlight({ home: true });
      resetHomeView();
    };
  }
}

function clearMapHighlight(opts) {
  highlightIds = new Set();
  highlightPulse = false;
  if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
  clearStraitOverlay();
  if (frontSpotLayer && map) {
    try { map.removeLayer(frontSpotLayer); } catch (e) {}
    frontSpotLayer = null;
  }
  clearIslandTags();
  try { document.body.classList.remove('front-hl'); } catch (e) {}
  const chip = document.getElementById('map-chip');
  if (chip) chip.classList.remove('chip-hl');
  applyMapFilters();
  if (opts && opts.home) resetHomeView();
}

function highlightFrontOnMap(front) {
  const loc = front.mapFocus || {};
  highlightIds = new Set(loc.ids || []);
  highlightPulse = true;
  clearStraitOverlay();
  if (frontSpotLayer && map) {
    try { map.removeLayer(frontSpotLayer); } catch (e) {}
    frontSpotLayer = null;
  }
  clearIslandTags();
  try { document.body.classList.add('front-hl'); } catch (e) {}
  applyMapFilters();

  const applyView = () => {
    if (!map) return;
    try { map.setView(FRONT_HOME_VIEW.slice(0, 2), FRONT_HOME_VIEW[2], { animate: true }); } catch (e) {}
    if (frontSpotLayer && map) {
      try { map.removeLayer(frontSpotLayer); } catch (e) {}
      frontSpotLayer = null;
    }
    if (loc.spot && loc.spot.length >= 2 && window.L) {
      frontSpotLayer = L.circle([loc.spot[0], loc.spot[1]], {
        radius: loc.spotRadius || 9000,
        color: '#f8fafc',
        weight: 2.4,
        fillColor: '#fbbf24',
        fillOpacity: 0.28,
        className: 'front-spot',
        interactive: false,
      }).addTo(map);
    }
    if ((highlightIds.has('YE-MY') || highlightIds.has('YE-HN')) && window.L) {
      placeStraitOverlay();
      placeIslandTags(data);
    }
  };

  applyView();
  setHighlightChip(front);
  scrollToMap();
  setTimeout(() => {
    try { map && map.invalidateSize(); } catch (e) {}
    applyView();
  }, 420);
  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    highlightPulse = false;
    applyMapFilters();
  }, 8000);
}

function showFrontFloat(idx, anchor, d) {
  const fronts = [...(d.fronts || [])].sort((a, b) => (a.importance || 99) - (b.importance || 99));
  const f = fronts[idx];
  const el = document.getElementById('front-float');
  if (!f || !el) return;
  frontFloatIdx = idx;
  frontFloatAnchor = anchor;
  frontFloatOpenedAt = Date.now();
  document.querySelectorAll('.front-map-btn').forEach((b, i) => b.setAttribute('aria-expanded', i === idx ? 'true' : 'false'));
  const locator = f.mapFocus || {};
  el.innerHTML = `
    <p class="front-float-title">${escapeHtml(f.name)}</p>
    ${f.where ? `<p class="front-float-where">${escapeHtml(f.where)}</p>` : ''}
    ${frontMiniSvg(f, d)}
    <div class="front-float-key">
      <span><span class="sw" style="background:${COLORS.houthi}"></span>Houthi</span>
      <span><span class="sw" style="background:${COLORS.plc}"></span>Government</span>
      <span><span class="sw" style="background:${COLORS.contested}"></span>Contested</span>
    </div>
    ${locator.view || (locator.spot && locator.spot.length) ? '<button type="button" class="front-float-go">Show on the main map</button>' : ''}`;
  const go = el.querySelector('.front-float-go');
  if (go && (locator.view || (locator.spot && locator.spot.length))) {
    go.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); try { ev.stopImmediatePropagation(); } catch (e) {} }
      keepHighlightUntil = Date.now() + 2200;
      hideFrontFloat();
      scrollToMap();
      highlightFrontOnMap(f);
      try { requestAnimationFrame(scrollToMap); } catch (e) {}
      setTimeout(scrollToMap, 80);
      setTimeout(scrollToMap, 360);
    };
  }
  el.onmouseenter = () => { if (frontFloatTimer) { clearTimeout(frontFloatTimer); frontFloatTimer = null; } };
  el.onmouseleave = () => { frontFloatTimer = setTimeout(hideFrontFloat, 220); };
  placeFrontFloat(anchor);
}

function renderFronts(d) {
  const fronts = [...(d.fronts || [])].sort((a, b) => (a.importance || 99) - (b.importance || 99));
  document.getElementById('fronts').innerHTML = fronts.map((f, i) => {
    const act = frontActivity(f.id);
    /*
     * The composed paragraph replaces the curated prose rather than sitting
     * under it. The curated summary/direction/detail in data.json were written
     * once and never updated, so they aged into a description of a different
     * week while claiming to be current. They stay only as a fallback for a
     * front the brief has not covered yet.
     */
    const composed = act && act.line ? act.line.trim() : '';
    const plain = composed ? '' : (f.plain || '').trim();
    const sum = composed ? '' : (f.summary || f.status || '').trim();
    const dir = composed ? '' : (f.direction || '').trim();
    const detail = composed ? '' : (f.detail || '').trim();
    const showSum = sum && !textOverlap(plain, sum);
    const showDir = dir && !textOverlap(plain, dir) && !textOverlap(sum, dir);
    const showDetail = detail && !textOverlap(sum, detail) && detail.length > Math.max(80, (sum.length || 0) + 40);
    return `<article class="front-card">
      <div class="front-head">
        <strong>${escapeHtml(f.name)}</strong>
        <button type="button" class="front-map-btn" data-i="${i}" aria-expanded="false" aria-label="Show where this is">Map</button>
      </div>
      ${f.where ? `<p class="front-where">${escapeHtml(f.where)}</p>` : ''}
      ${plain ? `<p class="front-plain">${escapeHtml(plain)}</p>` : ''}
      ${showSum ? `<p class="front-sum">${escapeHtml(sum)}</p>` : ''}
      ${showDir ? `<p class="front-dir">${escapeHtml(dir)}</p>` : ''}
      ${composed ? `<p class="front-composed">${escapeHtml(composed)}</p>` : ''}
      ${!composed && act ? `<p class="front-activity">${escapeHtml(act.line)}</p>` : ''}
      ${composed ? '' : `<div class="srcs">Source: ${sourceAnchors(f.sources || [], '')}</div>`}
      ${showDetail ? `<div class="full">${escapeHtml(detail)}</div>
      <button type="button" class="toggle-front">Read more</button>` : ''}
    </article>`;
  }).join('') + cadenceStamp();

  document.querySelectorAll('.toggle-front').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.front-card');
      const open = card.classList.toggle('open');
      btn.textContent = open ? 'Hide' : 'Read more';
    };
  });
  const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.querySelectorAll('.front-map-btn').forEach((btn) => {
    const idx = parseInt(btn.dataset.i, 10);
    const open = () => {
      if (frontFloatTimer) { clearTimeout(frontFloatTimer); frontFloatTimer = null; }
      showFrontFloat(idx, btn, d);
    };
    const delayHide = () => { frontFloatTimer = setTimeout(hideFrontFloat, 280); };
    if (canHover) {
      btn.onmouseenter = open;
      btn.onmouseleave = delayHide;
    }
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      open();
    };
    btn.onpointerdown = (ev) => { if (ev) ev.stopPropagation(); };
  });
}

/* ---------------------------------------------------------------- *
 * Map: control polygons
 * ---------------------------------------------------------------- */

function controlByIso(d) {
  const m = {};
  (d.governorates || []).forEach((g) => { m[g.id] = g; });
  return m;
}

function controlLayerKey(ctrl) {
  if (ctrl === 'houthi' || ctrl === 'plc' || ctrl === 'saudi') return ctrl;
  return 'contested';
}

function controlVisible(ctrl) { return !!layersOn[controlLayerKey(ctrl)]; }

function styleFeature(feature, byIso) {
  const iso = feature.properties.shapeISO;
  const g = byIso[iso] || {};
  const ctrl = (g.control === 'mixed') ? 'contested' : g.control;
  const c = COLORS[ctrl] || COLORS.contested || '#334155';
  const on = controlVisible(ctrl);
  const hl = highlightIds.has(iso);
  return {
    fillColor: c,
    fillOpacity: on ? (hl ? 0.88 : (highlightIds.size ? 0.22 : 0.55)) : 0,
    color: hl ? '#f8fafc' : '#0b0f14',
    weight: hl ? 2.6 : (on ? 1.2 : 0.6),
    opacity: on ? 1 : 0.2,
    className: hl && highlightPulse ? 'gov-hl-pulse' : (hl ? 'gov-hl' : ''),
  };
}

function bindGov(feature, layer, byIso) {
  const iso = feature.properties.shapeISO;
  const g = byIso[iso];
  if (!g) return;
  const name = String(g.name || iso).trim();
  const ar = String(g.nameAr || '').trim();
  const isSaudi = String(g.id || iso || '').startsWith('SA-');
  const arLine = ar ? `<br/><span dir="rtl" lang="ar">${escapeHtml(ar)}</span>` : '';
  if (isSaudi) {
    layer.bindPopup(`<strong>${escapeHtml(name)}</strong>${arLine}`);
    return;
  }
  layer.bindPopup(`<strong>${escapeHtml(name)}</strong>${arLine}<br/>
    Control: ${escapeHtml(LABELS[g.control] || g.control)}<br/><small>${escapeHtml(g.note || '')}</small>`);
}

function clearEvents() {
  eventLayers.forEach((l) => map.removeLayer(l));
  eventLayers = [];
}

/* ---------------------------------------------------------------- *
 * Map: event pins
 * ---------------------------------------------------------------- */

function pinPaintKey(p) {
  return [jerusalemYmd(p.at), Math.round((p.lat || 0) * 100) / 100, Math.round((p.lng || 0) * 100) / 100, p.mapCat || p.type || '', p.fp || p.url || ''].join('|');
}

function buildMapPins(d) {
  const byFp = new Map();
  const push = (pin) => {
    if (!pin || pin.lat == null || pin.lng == null) return;
    if (isWeakHeadline(pin.label)) return;
    if (!pin.url || isHomepageOrSectionUrl(pin.url)) return;
    const cat = classifyForMap(pin.text || pin.label || '', pin.type);
    if (!cat || cat === 'statement') return;
    if (!allowCoordsForCategory(cat, pin.place, pin.lat, pin.lng)) return;
    pin.mapCat = cat;
    pin.type = cat === 'strike' ? (pin.type === 'missile' ? 'missile' : 'strike') : (pin.type || 'combat');
    const fp = pin.fp || (pin.label + '|' + pin.at);
    const prev = byFp.get(fp);
    if (!prev) { byFp.set(fp, pin); return; }
    const keep = String(pin.text || '').length > String(prev.text || '').length ? pin : prev;
    const other = keep === pin ? prev : pin;
    if ((!keep.media || !keep.media.length) && other.media && other.media.length) keep.media = other.media;
    byFp.set(fp, keep);
  };

  // noMap: a reader audit found the item is not a physical event (a statement,
  // a condemnation, a video, a build-up). It stays in the feed, off the map.
  sortedReports(d).forEach((r) => {
    if (r.noMap) return;
    const blob = [r.summary, r.text, r.place].filter(Boolean).join('\n');
    let lat = (typeof r.lat === 'number') ? r.lat : null;
    let lng = (typeof r.lng === 'number') ? r.lng : null;
    let place = r.place || '';
    if (lat == null || lng == null) {
      const g = guessCoords(blob);
      if (!g) return;
      lat = g.lat; lng = g.lng; if (!place) place = g.place;
    } else if (!place) {
      const g = guessCoords(blob);
      if (g) place = g.place;
    }
    const label = (r.summary && !isWeakHeadline(r.summary)) ? r.summary : headlineFrom(blob);
    if (isWeakHeadline(label)) return;
    const cat = classifyForMap(blob, r.type);
    if (!cat || cat === 'statement') return;
    if (r.live && !['strike', 'combat', 'vessel', 'port'].includes(cat)) return;
    if (!allowCoordsForCategory(cat, place, lat, lng)) return;
    push({
      fp: r.fp || blob.slice(0, 80),
      at: reportTime(r),
      type: inferType(blob, r.type || cat),
      lat, lng, place,
      label,
      text: r.text || blob,
      source: sourceOf(r),
      url: r.url || '',
      priority: r.priority || 2,
      media: collectMedia(r),
      live: !!r.live,
    });
  });

  (d.events || []).forEach((ev) => {
    if (ev.noMap) return;
    const blob = ev.text || ev.note || ev.label || '';
    let lat = ev.lat, lng = ev.lng, place = ev.place || '';
    if (lat == null || lng == null) {
      if (/^(desk-update|humanitarian|diplomacy|intel)$/i.test(ev.type || '')) return;
      const g = guessCoords(`${ev.label || ''} ${blob}`);
      if (!g) return;
      lat = g.lat; lng = g.lng; place = g.place;
    } else if (!place) {
      const g = guessCoords(`${ev.label || ''} ${blob}`);
      if (g) place = g.place;
    }
    const rawLabel = ev.label || '';
    const label = rawLabel && !isWeakHeadline(rawLabel) ? rawLabel : headlineFrom(blob);
    if (!blob && !label) return;
    push({
      fp: ev.fp || ev.id || label,
      at: eventTime(ev) || reportTime(ev),
      type: inferType(blob || label, (ev.type || 'military').toLowerCase()),
      lat, lng, place,
      label,
      text: blob || label,
      source: ev.source || sourceOf(ev),
      url: ev.url || '',
      priority: ev.priority || 2,
      mapOnly: !!ev.mapOnly,
      media: collectMedia(ev),
    });
  });

  const day = effectiveMapDate();
  const today = todayYmd();
  const from = mapDateFrom || CONFLICT_START;
  const to = mapDateTo || today;
  const pins = [...byFp.values()].filter((p) => {
    const y = jerusalemYmd(p.at);
    if (!y) return false;
    if (mapMode === 'control') return false;
    if (mapMode === 'all') return y >= CONFLICT_START && y <= today;
    if (mapMode === 'range') return y >= from && y <= to;
    return y === (day || today);
  }).sort((a, b) => new Date(b.at) - new Date(a.at));

  const seen = new Map();
  const deduped = [];
  for (const p of pins) {
    if (p.lat == null || p.lng == null) continue;
    const cat = p.mapCat || classifyForMap(p.text || '', p.type) || pinCategory(p.type);
    const k = [jerusalemYmd(p.at), Math.round(p.lat * 100) / 100, Math.round(p.lng * 100) / 100, cat].join('|');
    const prev = seen.get(k);
    if (!prev) { seen.set(k, p); deduped.push(p); continue; }
    if ((p.mapOnly && !prev.mapOnly) || String(p.text || '').length > String(prev.text || '').length) {
      const i = deduped.indexOf(prev);
      if (i >= 0) deduped[i] = p;
      seen.set(k, p);
    }
  }
  return deduped.slice(0, (mapMode === 'range' || mapMode === 'all') ? MAX_MAP_PINS_RANGE : MAX_MAP_PINS);
}

function popupHtml(ev) {
  let sum = (ev.label && !isWeakHeadline(ev.label)) ? ev.label : headlineFrom(ev.text || '');
  if (sum.length > 150) sum = sum.slice(0, 147).replace(/\s+\S*$/, '') + '…';
  const full = cleanBody(ev.text || '');
  let anchors = sourceAnchors(ev.source || ev.sources || '', ev.url || '');
  if (!anchors && ev.url && !isHomepageOrSectionUrl(ev.url)) {
    const name = canonicalSourceName(sourceOf(ev)) || hostLabelFromUrl(ev.url) || 'Read the report';
    anchors = `<a class="src-link" href="${escapeHtml(ev.url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`;
  }
  const srcLine = anchors ? `<p class="pop-src">Source: ${anchors}</p>` : '';
  const cat = ev.mapCat || classifyForMap(ev.text || '', ev.type) || pinCategory(ev.type);
  const catLabel = CATEGORY_LABEL[cat] || CATEGORY_LABEL.combat;
  const needExpand = full && full.length > sum.length + 24;
  return `<p class="pop-h">${escapeHtml(sum)}</p>
    <p class="pop-meta">${escapeHtml(fmtStamp(ev.at))}${ev.place ? ' · ' + escapeHtml(ev.place) : ''} · ${escapeHtml(catLabel)}</p>
    ${srcLine}
    ${mediaBlock(ev.media, true)}
    ${needExpand ? `<div class="pop-full">${escapeHtml(isReaderWritten(ev.url) ? full : annotatePlaces(full))}</div>
    <button type="button" class="pop-toggle">Read more</button>` : ''}`;
}

function placeMapPin(ev) {
  if (!map || !ev || ev.lat == null || ev.lng == null) return;
  const t = (ev.type || '').toLowerCase();
  const cat = ev.mapCat || classifyForMap(ev.text || ev.label || '', t) || pinCategory(t);
  if (!['strike', 'combat', 'vessel', 'port'].includes(cat)) return;
  if (!layersOn[cat]) return;
  const key = pinPaintKey(ev);
  if (paintedPinKeys.has(key)) return;
  paintedPinKeys.add(key);
  const ageH = (Date.now() - new Date(ev.at).getTime()) / 3600000;
  const fresh = ageH <= 6 ? ' fresh' : '';
  const icon = L.divIcon({
    className: 'ev-wrap',
    html: eventIconHtml(cat, fresh, escapeHtml(ev.label || '')),
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
  const m = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: Math.round(1000 - ageH), riseOnHover: true })
    .bindPopup(popupHtml(ev), {
      maxWidth: (ev.media && ev.media.length) ? 320 : 300,
      maxHeight: 360,
      autoPan: false,
      keepInView: false,
      autoClose: false,
      closeOnClick: false,
    });
  m.addTo(map);
  eventLayers.push(m);
}

function addNewMapPins(d) {
  if (!map || mapMode === 'control' || highlightIds.size) return;
  buildMapPins(d).forEach((ev) => placeMapPin(ev));
}

function renderEvents(d) {
  if (!map) return;
  clearEvents();
  paintedPinKeys = new Set();
  if (mapMode === 'control') {
    drawIslands(d);
    drawControlOverlays(activeEpoch);
    const chip = document.getElementById('map-chip');
    if (chip && !chip.classList.contains('chip-hl')) {
      const ymd = activeControlYmd || (activeEpoch && String(activeEpoch.at).slice(0, 10)) || '';
      chip.textContent = ymd ? `Control on ${fmtDay(ymd)}` : 'Control timeline — no event pins';
    }
    return;
  }
  clearControlOverlays();
  if (highlightIds.size) {
    drawIslands(d);
    return;
  }
  const pins = buildMapPins(d);
  const chip = document.getElementById('map-chip');
  if (chip) {
    const today = todayYmd();
    let label;
    if (mapMode === 'all') label = `${fmtDay(CONFLICT_START)} – ${fmtDay(today)}`;
    else if (mapMode === 'range') label = `${fmtDay(mapDateFrom || CONFLICT_START)} – ${fmtDay(mapDateTo || today)}`;
    else label = fmtDay(effectiveMapDate());
    chip.textContent = pins.length
      ? `${pins.length} event${pins.length === 1 ? '' : 's'} on ${label} · click a mark for detail`
      : `No mapped events for ${label}`;
  }
  const placeCount = {};
  pins.forEach((ev) => {
    const t = (ev.type || '').toLowerCase();
    const cat = ev.mapCat || classifyForMap(ev.text || ev.label || '', t) || pinCategory(t);
    if (!['strike', 'combat', 'vessel', 'port'].includes(cat)) return;
    if (!layersOn[cat]) return;
    const key = ev.place || (ev.lat + ',' + ev.lng);
    const n = placeCount[key] || 0;
    placeCount[key] = n + 1;
    const [lat, lng] = n ? jitter(ev.lat, ev.lng, n) : [ev.lat, ev.lng];
    placeMapPin({ ...ev, lat, lng, mapCat: cat });
  });
  drawIslands(d);
}

function fmtDay(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

function ensureMap(d) {
  if (map) return;
  map = L.map('map', { zoomControl: true, attributionControl: true, closePopupOnClick: false }).setView([18.5, 45.5], 5.4);
  try { window.__yemenMap = map; } catch (e) {}
  map.on('zoomend', syncStraitForZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: d.basemapAttribution || '© OpenStreetMap',
  }).addTo(map);
  map.on('popupopen', (e) => {
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.classList.add('popup-open');
    const root = e.popup.getElement();
    if (!root) return;
    wireMediaClicks(root);
    try { L.DomEvent.disableClickPropagation(root); L.DomEvent.disableScrollPropagation(root); } catch (err) {}
    const btn = root.querySelector('.pop-toggle');
    const full = root.querySelector('.pop-full');
    if (!btn || !full) return;
    const content = root.querySelector('.leaflet-popup-content');
    const setOpen = (open) => {
      full.classList.toggle('open', open);
      btn.textContent = open ? 'Hide detail' : 'Read more';
      try {
        if (typeof e.popup.update === 'function') {
          e.popup._updateLayout && e.popup._updateLayout();
          e.popup._updatePosition && e.popup._updatePosition();
        }
      } catch (err) {}
      if (content) content.scrollTop = 0;
    };
    const toggle = () => setOpen(!full.classList.contains('open'));
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      try { L.DomEvent.stop(ev); } catch (err) {}
      toggle();
    };
    if (content) {
      content.style.cursor = 'pointer';
      content.onclick = (ev) => {
        const t = ev.target;
        if (!t) return;
        if (t.closest('a, button, .pop-full')) return;
        toggle();
      };
    }
  });
  map.on('popupclose', () => {
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.classList.remove('popup-open');
  });
}

/* ---------------------------------------------------------------- *
 * Map: geometry
 * ---------------------------------------------------------------- */

function polyCentroid(poly) {
  const ring = (poly && poly[0]) || [];
  if (!ring.length) return { lat: 0, lng: 0, minLng: 0, maxLng: 0, minLat: 0, maxLat: 0 };
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
  };
}

function asMultiOrPoly(polys) {
  if (!polys.length) return null;
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  return { type: 'MultiPolygon', coordinates: polys };
}

function splitIslandFeatures(geo) {
  const mainland = [];
  const islands = [];
  (geo.features || []).forEach((f) => {
    const iso = (f.properties || {}).shapeISO;
    const geom = f.geometry || {};
    if (iso === 'YE-AD' && geom.type === 'MultiPolygon') {
      const aden = [];
      const mayun = [];
      (geom.coordinates || []).forEach((poly) => {
        const c = polyCentroid(poly);
        if (c.maxLng < 44.0) mayun.push(poly);
        else aden.push(poly);
      });
      const adenGeom = asMultiOrPoly(aden);
      if (adenGeom) mainland.push({ ...f, geometry: adenGeom });
      const mayunGeom = asMultiOrPoly(mayun);
      if (mayunGeom) {
        islands.push({ type: 'Feature', properties: { islandId: 'mayun', shapeISO: 'YE-MY' }, geometry: mayunGeom });
      }
      return;
    }
    if (iso === 'YE-HU' && geom.type === 'MultiPolygon') {
      const rest = [];
      const hanish = [];
      (geom.coordinates || []).forEach((poly) => {
        const c = polyCentroid(poly);
        if (c.lng < 42.82 && c.lat >= 13.58 && c.lat <= 14.10) hanish.push(poly);
        else rest.push(poly);
      });
      const restGeom = asMultiOrPoly(rest);
      if (restGeom) mainland.push({ ...f, geometry: restGeom });
      const hanishGeom = asMultiOrPoly(hanish);
      if (hanishGeom) {
        islands.push({ type: 'Feature', properties: { islandId: 'hanish', shapeISO: 'YE-HN' }, geometry: hanishGeom });
      }
      return;
    }
    mainland.push(f);
  });
  return {
    mainland: { type: 'FeatureCollection', features: mainland },
    islands: { type: 'FeatureCollection', features: islands },
  };
}

function islandPopupHtml(isl) {
  if (!isl) return '';
  const name = String(isl.name || '').trim();
  const ar = isl.nameAr ? `<br/><span dir="rtl" lang="ar">${escapeHtml(isl.nameAr)}</span>` : '';
  const note = isl.note ? `<br/><small>${escapeHtml(isl.note)}</small>` : '';
  return `<strong>${escapeHtml(name)}</strong>${ar}<br/>
    Control: ${escapeHtml(LABELS[isl.control] || isl.control)}${note}
    ${mediaBlock(isl.media, true)}`;
}

async function drawGeo(d) {
  const byIso = controlByIso(d);
  if (geoLayer) map.removeLayer(geoLayer);
  if (saudiGeoLayer) map.removeLayer(saudiGeoLayer);
  islandLayers.forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  islandLayers = [];

  if (!geoCache) geoCache = await fetch('/yemen-adm1.geojson').then((r) => r.json());
  const split = splitIslandFeatures(geoCache);
  islandGeoCache = split.islands;

  geoLayer = L.geoJSON(split.mainland, {
    style: (f) => styleFeature(f, byIso),
    onEachFeature: (f, layer) => bindGov(f, layer, byIso),
  }).addTo(map);

  try {
    if (!saudiGeoCache) {
      const res = await fetch('/saudi-adm1.geojson');
      if (res.ok) saudiGeoCache = await res.json();
    }
    if (saudiGeoCache) {
      saudiGeoLayer = L.geoJSON(saudiGeoCache, {
        style: () => {
          const on = controlVisible('saudi');
          return { fillColor: COLORS.saudi, fillOpacity: on ? 0.38 : 0, color: '#0b0f14', weight: 0.8, opacity: on ? 0.75 : 0.15 };
        },
        onEachFeature: (f, layer) => bindGov(f, layer, byIso),
      }).addTo(map);
    }
  } catch (e) { console.warn('saudi geo', e); }

  drawIslands(d);
}

function ensureIslandPane() {
  if (!map || map.getPane('islands')) return;
  map.createPane('islands');
  map.getPane('islands').style.zIndex = 450;
  map.getPane('islands').style.pointerEvents = 'auto';
}

function islandIdOfFeature(f) {
  const p = (f && f.properties) || {};
  if (p.islandId === 'mayun' || p.islandId === 'hanish') return p.islandId;
  if (p.shapeISO === 'YE-MY') return 'mayun';
  if (p.shapeISO === 'YE-HN') return 'hanish';
  return '';
}

function islandControlNow(id, d) {
  if (mapMode === 'control' && activeEpoch && activeEpoch.islands && id && activeEpoch.islands[id]) {
    return activeEpoch.islands[id];
  }
  const meta = ((d && d.islandControl) || []).find((x) => x && x.id === id);
  return (meta && meta.control) || 'houthi';
}

function drawIslands(d) {
  islandLayers.forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  islandLayers = [];
  if (!map) return;
  ensureIslandPane();
  const fc = islandGeoCache || { type: 'FeatureCollection', features: [] };
  if (!fc.features || !fc.features.length) return;
  const byId = {};
  ((d && d.islandControl) || []).forEach((isl) => {
    if (!isl || !isl.id) return;
    byId[isl.id] = { ...isl, control: islandControlNow(isl.id, d) };
  });
  const styleIsland = (f) => {
    const id = islandIdOfFeature(f);
    const ctrl = islandControlNow(id, d);
    const col = COLORS[ctrl] || COLORS.houthi;
    const on = controlVisible(ctrl);
    const iso = (f.properties || {}).shapeISO;
    const hl = highlightIds.has(iso) || (id === 'mayun' && highlightIds.has('YE-MY')) || (id === 'hanish' && highlightIds.has('YE-HN'));
    return {
      fillColor: col,
      fillOpacity: on ? (hl ? 0.92 : 0.78) : 0,
      color: hl ? '#f8fafc' : '#0b0f14',
      weight: hl ? 2.4 : 1.15,
      opacity: on ? 1 : 0.15,
      className: hl && highlightPulse ? 'gov-hl-pulse' : (hl ? 'gov-hl' : ''),
    };
  };
  const layer = L.geoJSON(fc, {
    pane: 'islands',
    style: styleIsland,
    onEachFeature: (f, lyr) => {
      const meta = byId[islandIdOfFeature(f)];
      if (!meta) return;
      lyr.bindPopup(islandPopupHtml(meta), { maxWidth: 300 });
    },
  });
  layer.addTo(map);
  try {
    layer.eachLayer((lyr) => {
      const st = styleIsland(lyr.feature || {});
      lyr.setStyle({ fillColor: st.fillColor, fillOpacity: st.fillOpacity, color: st.color, weight: st.weight, opacity: st.opacity });
    });
  } catch (e) {}
  islandLayers.push(layer);
}

function clearControlOverlays() {
  controlOverlayLayers.forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  controlOverlayLayers = [];
}

function drawControlOverlays(epoch) {
  clearControlOverlays();
  if (!map || !window.L || !epoch) return;
  const byId = {};
  (epoch.cities || []).forEach((c) => { if (c && c.id) byId[c.id] = c.control; });
  COAST_AREAS.forEach((area) => {
    const ctrl = byId[area.id];
    if (!ctrl) return;
    const col = COLORS[ctrl] || COLORS.contested;
    const poly = L.polygon(area.ring, {
      color: '#0b0f14', weight: 1.1, fillColor: col, fillOpacity: 0.7, pane: 'islands', interactive: true,
    }).bindPopup(`<strong>${escapeHtml(area.name)}</strong><br/>Control: ${escapeHtml(LABELS[ctrl] || ctrl)}`);
    poly.addTo(map);
    controlOverlayLayers.push(poly);
  });
}

function conflictDays() {
  const out = [];
  const start = Date.parse(CONFLICT_START + 'T12:00:00+03:00');
  const end = Date.parse(todayYmd() + 'T12:00:00+03:00');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [CONFLICT_START];
  for (let t = start; t <= end + 3600000; t += 86400000) {
    const y = jerusalemYmd(t);
    if (y && (!out.length || out[out.length - 1] !== y) && y <= todayYmd()) out.push(y);
  }
  return out;
}

function epochForDate(ymd) {
  const epochs = ((data && data.controlEpochs) || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  if (!epochs.length) return null;
  let pick = epochs[0];
  for (const e of epochs) if (String(e.at).slice(0, 10) <= ymd) pick = e;
  return pick;
}

function setControlDayByIndex(i) {
  const days = conflictDays();
  if (!days.length) return;
  const idx = Math.max(0, Math.min(days.length - 1, Number(i) || 0));
  activeControlYmd = days[idx];
  activeEpoch = epochForDate(activeControlYmd);
  mapMode = 'control';
  try { document.body.classList.add('ctrl-mode'); } catch (e) {}
  ['combat', 'strike', 'vessel', 'port'].forEach((k) => { layersOn[k] = false; });
  try { if (data) renderLegend(data); } catch (e) {}
  const lab = document.getElementById('ctrl-slider-label');
  if (lab && activeControlYmd) {
    const ep = activeEpoch && String(activeEpoch.at).slice(0, 10) === activeControlYmd ? (activeEpoch.label || '') : '';
    lab.textContent = ep ? `${fmtDay(activeControlYmd)} · ${ep}` : fmtDay(activeControlYmd);
  }
  const sl = document.getElementById('ctrl-slider');
  if (sl) sl.value = String(idx);
  document.querySelectorAll('#time-filter button').forEach((b) => b.classList.remove('on'));
  applyMapFilters();
}

function applyMapFilters() {
  if (!data) return;
  const byIso = controlByIso(data);
  if (geoLayer) geoLayer.setStyle((f) => styleFeature(f, byIso));
  if (saudiGeoLayer) {
    saudiGeoLayer.setStyle(() => {
      const on = controlVisible('saudi');
      return { fillColor: COLORS.saudi, fillOpacity: on ? 0.38 : 0, color: '#0b0f14', weight: 0.8, opacity: on ? 0.75 : 0.15 };
    });
  }
  drawIslands(data);
  renderEvents(data);
}

/* ---------------------------------------------------------------- *
 * Timeline and legend
 * ---------------------------------------------------------------- */

function renderTimeline(d) {
  const el = document.getElementById('timeline');
  const phases = d.timeline || [];
  el.innerHTML = phases.map((t) => {
    const isNow = t.id === 'phase_2026_09_offensive' || t === phases[phases.length - 1];
    const title = isNow && t.id === 'phase_2026_09_offensive' ? `${t.title} · now` : t.title;
    return `<button type="button" class="chip" data-id="${escapeHtml(t.id)}">
      <b>${escapeHtml(title)}</b>
      <i>${escapeHtml((t.from || '') + (t.to ? ' – ' + t.to : ''))}</i>
    </button>`;
  }).join('');

  const showPhase = (phase) => {
    el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === phase.id));
    const box = document.getElementById('phase');
    box.classList.add('show');
    box.innerHTML = `
      <div class="phase-head">
        <strong>${escapeHtml(phase.title)}</strong>
        <span class="muted">${escapeHtml((phase.from || '') + (phase.to ? ' – ' + phase.to : ''))}</span>
      </div>
      <p class="phase-sum">${escapeHtml(phase.summary || phase.mapNote || '')}</p>
      <div class="full">
        <p>${escapeHtml(phase.detail || (phase.bullets || []).join(' '))}</p>
        ${phase.mapNote ? `<p class="muted">On the map: ${escapeHtml(phase.mapNote)}</p>` : ''}
        <div class="srcs">Source: ${sourceCreditsHtml(phase.sources || [], '')}</div>
      </div>
      <button type="button" class="toggle-phase">Read more</button>`;
    const btn = box.querySelector('.toggle-phase');
    btn.onclick = () => {
      const open = box.classList.toggle('open');
      btn.textContent = open ? 'Hide' : 'Read more';
    };
  };

  el.querySelectorAll('.chip').forEach((btn) => {
    btn.onclick = () => {
      const phase = phases.find((x) => x.id === btn.dataset.id);
      if (phase) showPhase(phase);
    };
  });

  function goPresent(opts) {
    const scroll = !opts || opts.scroll !== false;
    const current = phases.find((p) => p.id === 'phase_2026_09_offensive') || phases[phases.length - 1];
    if (current) showPhase(current);
    mapDate = todayYmd();
    mapMode = 'day';
    activeEpoch = null;
    try { document.body.classList.remove('ctrl-mode'); } catch (e) {}
    const inp = document.getElementById('map-date');
    if (inp) { inp.value = mapDate; inp.max = mapDate; }
    if (data) renderEvents(data);
    syncDayNav();
    if (scroll) {
      const chip = el.querySelector('.chip.on');
      const box = document.getElementById('phase');
      const target = chip || box || document.getElementById('btn-now');
      if (target && target.scrollIntoView) {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {
          try { target.scrollIntoView(false); } catch (e2) {}
        }
      }
    }
  }

  document.getElementById('btn-now').onclick = () => goPresent({ scroll: true });
  goPresent({ scroll: false });
}

function renderLegend(d) {
  const shortName = (c) => {
    if (c.id === 'plc') return 'Government';
    if (c.id === 'houthi') return 'Houthi';
    if (c.id === 'contested') return 'Contested';
    return (c.name || '').split(' / ')[0] || c.name || '';
  };
  const inkFor = (hex) => {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return '';
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? ' ink-dark' : '';
  };
  const row = (layer, color, label, ico) => {
    const on = layersOn[layer] ? ' on' : '';
    const mark = ico
      ? `<span class="leg-ico ${layer}">${EVENT_SVG[layer] || ''}</span>`
      : `<span class="sw${inkFor(color)}" style="background:${color}"><span class="tick">✓</span></span>`;
    return `<button type="button" class="leg-item${on}" data-layer="${escapeHtml(layer)}" aria-pressed="${layersOn[layer] ? 'true' : 'false'}">
      ${mark}
      ${escapeHtml(label)}
    </button>`;
  };
  const controlRows = (d.control || []).map((c) => row(controlLayerKey(c.id), c.color, shortName(c))).join('');
  document.getElementById('legend').innerHTML = `
    <p class="leg-hint">Tick to show, untick to hide.</p>
    <div class="leg-sec">Territory</div>
    ${controlRows}
    ${row('saudi', COLORS.saudi, 'Saudi Arabia')}
    <div class="leg-sec">Events</div>
    ${row('combat', EVENT_COLORS.combat, 'Ground fighting', true)}
    ${row('strike', EVENT_COLORS.strike, 'Strike or launch', true)}
    ${row('vessel', EVENT_COLORS.vessel, 'Vessel attacked', true)}
    ${row('port', EVENT_COLORS.port, 'Port or terminal', true)}`;
  document.querySelectorAll('#legend .leg-item').forEach((btn) => {
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      const k = btn.dataset.layer;
      if (!k || !(k in layersOn)) return;
      layersOn[k] = !layersOn[k];
      renderLegend(d);
      applyMapFilters();
    };
  });
}

function syncDayNav() {
  const next = document.getElementById('btn-day-next');
  const today = todayYmd();
  const day = mapDate || today;
  if (next) next.hidden = mapMode !== 'day' ? true : day >= today;
  const todayBtn = document.getElementById('btn-day-today');
  if (todayBtn) todayBtn.classList.toggle('on', mapMode === 'day' && day === today);
}

function enterDayMode(ymd) {
  mapMode = 'day';
  mapDate = clampMapDate(ymd || todayYmd());
  activeEpoch = null;
  activeControlYmd = null;
  try { document.body.classList.remove('ctrl-mode'); } catch (e) {}
  clearControlOverlays();
}

/* ---------------------------------------------------------------- *
 * UI wiring
 * ---------------------------------------------------------------- */

function wireUi(d) {
  const ls = document.getElementById('live-scan-details');
  if (ls && ls.dataset.wired !== '1') {
    ls.dataset.wired = '1';
    ls.addEventListener('toggle', () => { if (ls.open) renderLiveScan(); });
  }

  const legendEl = document.getElementById('legend');
  if (legendEl && window.L) {
    try {
      L.DomEvent.disableClickPropagation(legendEl);
      L.DomEvent.disableScrollPropagation(legendEl);
    } catch (e) {}
  }
  const chipEl = document.getElementById('map-chip');
  if (chipEl && window.L) {
    try {
      L.DomEvent.disableClickPropagation(chipEl);
      L.DomEvent.disableScrollPropagation(chipEl);
    } catch (e) {}
  }

  const dateInp = document.getElementById('map-date');
  const markDayBtn = (id) => {
    document.querySelectorAll('#time-filter button').forEach((b) => b.classList.remove('on'));
    const el = document.getElementById(id);
    if (el) el.classList.add('on');
  };
  if (dateInp) {
    if (!mapDate) mapDate = todayYmd();
    dateInp.min = MAP_ROUND_START;
    dateInp.max = todayYmd();
    dateInp.value = mapDate;
    dateInp.onchange = () => {
      enterDayMode(dateInp.value);
      dateInp.value = mapDate;
      markDayBtn(null);
      syncDayNav();
      applyMapFilters();
    };
  }
  const prev = document.getElementById('btn-day-prev');
  const next = document.getElementById('btn-day-next');
  const todayBtn = document.getElementById('btn-day-today');
  if (prev) prev.onclick = () => {
    enterDayMode(shiftYmd(mapDate || todayYmd(), -1));
    if (dateInp) dateInp.value = mapDate;
    markDayBtn(null);
    syncDayNav();
    applyMapFilters();
  };
  if (next) next.onclick = () => {
    enterDayMode(shiftYmd(mapDate || todayYmd(), 1));
    if (dateInp) dateInp.value = mapDate;
    markDayBtn(null);
    syncDayNav();
    applyMapFilters();
  };
  if (todayBtn) todayBtn.onclick = (ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    enterDayMode(todayYmd());
    if (dateInp) { dateInp.value = mapDate; dateInp.max = mapDate; dateInp.blur(); }
    markDayBtn('btn-day-today');
    syncDayNav();
    applyMapFilters();
    requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (e) {} });
  };
  const allBtn = document.getElementById('btn-conflict-all');
  if (allBtn) allBtn.onclick = (ev) => {
    if (ev) ev.preventDefault();
    mapMode = 'all';
    mapDateFrom = CONFLICT_START;
    mapDateTo = todayYmd();
    activeEpoch = null;
    activeControlYmd = null;
    try { document.body.classList.remove('ctrl-mode'); } catch (e) {}
    clearControlOverlays();
    markDayBtn('btn-conflict-all');
    syncDayNav();
    applyMapFilters();
  };

  syncDayNav();
  document.getElementById('btn-more-reports').onclick = async () => {
    const btn = document.getElementById('btn-more-reports');
    if (reportsShown >= sortedReports(data).length) {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      await pullOlderDesk();
      btn.disabled = false;
    }
    reportsShown += MORE_STEP;
    renderFeed(data);
  };
  setInterval(renderFreshness, 30 * 1000);
  document.getElementById('btn-focus-map').onclick = () => {
    mapFocus = !mapFocus;
    document.body.classList.toggle('map-focus', mapFocus);
    document.getElementById('btn-focus-map').textContent = mapFocus ? 'Shrink map' : 'Expand map';
    setTimeout(() => map && map.invalidateSize(), 50);
  };

  if (!frontFloatWired) {
    frontFloatWired = true;
    document.addEventListener('click', (ev) => {
      if (Date.now() - frontFloatOpenedAt < 400) return;
      const t = ev.target;
      if (!t) return;
      if (t.closest('#front-float, .front-map-btn')) return;
      hideFrontFloat();
      const mf = document.getElementById('media-float');
      if (mf && !mf.hidden && !t.closest('#media-float, .media-open')) {
        mf.classList.remove('show'); mf.hidden = true; mf.innerHTML = '';
      }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      hideFrontFloat();
      clearMapHighlight({ home: true });
      const mf = document.getElementById('media-float');
      if (mf && !mf.hidden) { mf.classList.remove('show'); mf.hidden = true; mf.innerHTML = ''; }
    });
    window.addEventListener('scroll', () => {
      if (Date.now() - frontFloatOpenedAt < 400) return;
      if (!frontFloatAnchor) return;
      const r = frontFloatAnchor.getBoundingClientRect();
      const vis = r.bottom > 40 && r.top < window.innerHeight - 20;
      if (!vis) hideFrontFloat();
      else placeFrontFloat(frontFloatAnchor);
    }, true);
    document.addEventListener('click', (ev) => {
      if (Date.now() < keepHighlightUntil) return;
      const t = ev.target;
      if (!t) return;
      const path = (typeof ev.composedPath === 'function') ? ev.composedPath() : [];
      if (path.some((n) => n && n.matches && n.matches('#legend, .front-float-go, .front-map-btn, #front-float, #map-chip, .chip-clear, #btn-clear-hl'))) return;
      if (t.closest && t.closest('#legend, .front-float-go, .front-map-btn, #map-chip, .chip-clear')) return;
      if (highlightIds.size && !(t.closest && t.closest('.leaflet-interactive, .leaflet-popup, .leaflet-control'))) {
        clearMapHighlight({ home: true });
      }
    });
  }
}

function wireRailResize() {
  const stage = document.getElementById('stage');
  const split = document.getElementById('rail-splitter');
  const rail = document.getElementById('rail');
  if (!stage || !split || !rail) return;
  if (split.dataset.wired === '1') return;
  split.dataset.wired = '1';
  const KEY = 'yemenDeskRailW';
  const apply = (px) => {
    const min = 280;
    const max = Math.min(640, Math.max(320, Math.floor(window.innerWidth * 0.55)));
    const w = Math.max(min, Math.min(max, Math.round(px)));
    stage.style.setProperty('--rail-w', w + 'px');
    try { localStorage.setItem(KEY, String(w)); } catch (e) {}
    if (map) setTimeout(() => map && map.invalidateSize(), 40);
  };
  try {
    const saved = parseInt(localStorage.getItem(KEY) || '', 10);
    if (saved >= 280 && saved <= 640) apply(saved);
    else {
      localStorage.removeItem(KEY);
      apply(360);
    }
  } catch (e) { apply(360); }

  let dragging = false;
  // dir=ltr: the map is on the left and the rail on the right, so the rail's
  // width is the distance from the pointer to the stage's right edge.
  const onMove = (clientX) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    apply(rect.right - clientX);
  };
  split.addEventListener('pointerdown', (e) => {
    dragging = true;
    try { split.setPointerCapture(e.pointerId); } catch (err) {}
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  split.addEventListener('pointermove', (e) => { if (dragging) onMove(e.clientX); });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (map) map.invalidateSize();
  };
  split.addEventListener('pointerup', end);
  split.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => {
    const cur = parseInt(getComputedStyle(stage).getPropertyValue('--rail-w'), 10);
    if (cur) apply(cur);
  });
}

/* ---------------------------------------------------------------- *
 * Boot
 * ---------------------------------------------------------------- */

async function refresh(first) {
  if (first) await loadGazetteer();
  const baseP = fetchData();
  if (first) await hydrateSnapshot();
  const liveP = pullLive({ silent: true });
  const briefP = pullBrief();
  const deskP = pullDesk();
  if (first && !liveOverlay.reports.length) {
    await Promise.race([liveP, new Promise((r) => setTimeout(r, 2000))]);
  }
  if (first) await Promise.race([briefP, new Promise((r) => setTimeout(r, 2500))]);
  const base = await baseP;
  // The archive carries the bulk of the feed, so it is worth a short wait on
  // first paint rather than letting the page render a stub and jump.
  await Promise.race([deskP, new Promise((r) => setTimeout(r, first ? 2500 : 1200))]);
  data = applyLiveOverlay(applyDeskArchive(base));
  if (!miniGeo) {
    try { miniGeo = await fetch('/yemen-mini.json').then((r) => r.json()); }
    catch (e) { miniGeo = { w: 240, h: 280, features: [] }; }
  }
  const stamp = document.getElementById('updated');
  if (stamp) stamp.textContent = stampText();
  renderBars(data);
  renderSituation(data);
  renderLiveScan();
  renderCasualties(data);
  renderFeed(data);
  renderFronts(data);
  ensureMap(data);
  if (first) {
    try { renderTimeline(data); } catch (e) { console.error(e); }
    try { renderLegend(data); } catch (e) { console.error(e); }
    try { wireUi(data); } catch (e) { console.error(e); }
    const attrib = document.getElementById('attrib');
    if (attrib) attrib.textContent = data.basemapAttribution || '© OpenStreetMap contributors';
    const disc = document.getElementById('disclaimer');
    if (disc) disc.textContent = data.sourcesNote || '';
    try { await drawGeo(data); } catch (e) { console.error(e); }
  } else {
    applyMapFilters();
  }
  if (first) {
    try { renderEvents(data); } catch (e) { console.error(e); }
  }
  if (map) setTimeout(() => map && map.invalidateSize(), 30);
}

async function startYemenDesk() {
  const el = document.getElementById('map');
  if (!el) return;

  if (window.__yemenDeskTimer) { clearInterval(window.__yemenDeskTimer); window.__yemenDeskTimer = null; }
  if (window.__yemenLiveTimer) { clearInterval(window.__yemenLiveTimer); window.__yemenLiveTimer = null; }
  if (window.__yemenBriefTimer) { clearInterval(window.__yemenBriefTimer); window.__yemenBriefTimer = null; }

  const bootTimers = () => {
    const jsonMs = Math.max(30, Number(data?.refreshSeconds) || 60) * 1000;
    window.__yemenDeskTimer = setInterval(() => refresh(false), jsonMs);
    window.__yemenLiveTimer = setInterval(() => pullLive({ silent: true }), 5 * 60 * 1000);
    // The brief only changes on a 12-hour boundary; checking every 10 minutes is
    // enough to cross it promptly without hammering the endpoint.
    window.__yemenBriefTimer = setInterval(async () => {
      await pullBrief();
      if (data) { renderSituation(data); renderCasualties(data); renderFronts(data); }
    }, 10 * 60 * 1000);
  };

  if (map) {
    const container = map.getContainer && map.getContainer();
    if (!container || container !== el || !el.isConnected) {
      try { map.remove(); } catch (e) {}
      map = null;
      geoLayer = null;
      saudiGeoLayer = null;
      eventLayers = [];
      islandLayers = [];
    } else {
      try { await refresh(false); } catch (e) { console.error(e); }
      bootTimers();
      return;
    }
  }

  try {
    await refresh(true);
    try { wireRailResize(); } catch (e) { console.error(e); }
    bootTimers();
  } catch (err) {
    console.error(err);
    const stamp = document.getElementById('updated');
    if (stamp && !String(stamp.textContent || '').includes('Updated')) {
      stamp.textContent = 'Failed to load';
    }
  }
}

window.startYemenDesk = startYemenDesk;
startYemenDesk();

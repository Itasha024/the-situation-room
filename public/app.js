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
  // A ship side-on: hull, deck house, funnel and mast over a wave line.
  vessel:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2.5h1.4v4H11zM7.5 7h8.5v5H7.5zM16.8 5h2.4v7h-2.4zM1.5 13h21l-3.3 5.2H4.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M2 21.2c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2"/></svg>',
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
  strike: 'Launch/strike/alert',
  vessel: 'Vessel attacked',
  port: 'Port/terminal attacked',
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

/*
 * Hand corrections to the pins of live reports (public/map-fixes.json): a pin
 * that is no event is removed, a wrong category or spot is put right. The
 * reports themselves stay in the feed as they are.
 */
let MAP_FIXES = {};

async function loadMapFixes() {
  try {
    const j = await fetch('/map-fixes.json?ts=' + Date.now()).then((r) => r.json());
    MAP_FIXES = (j && j.fixes) || {};
  } catch (e) {
    MAP_FIXES = {};
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
let brief = null;

let layersOn = { houthi: true, plc: true, saudi: true, contested: true, combat: true, strike: true, vessel: true, port: true };
let legendCollapsed = false;
let legendWasOpen = true; // the state to restore when the map shrinks again
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

/**
 * A card's picture or video from its X or Telegram post (src/lib/desk/media.ts):
 * the picture itself at its own shape, a video's still with ▶ and its length.
 * Nothing plays until it is clicked; a video then plays in place from X or
 * Telegram, and a picture opens large. Telegram's file links expire, so a
 * failing one is asked for anew (/api/tgmedia); only then Telegram's own
 * player, and last the link.
 */
function cardMediaHtml(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !m.thumb) return Array.isArray(m) ? mediaBlock(m) : '';
  const d = Number(m.duration) || 0;
  // A video over a minute and a half is a TV package, not the moment: not shown.
  if (m.kind === 'video' && d > 90) return '';
  const dur = m.kind === 'video' && d ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` : '';
  const video = m.kind === 'video';
  const where = m.from === 'tg' ? 'Telegram' : 'X';
  const w = Number(m.w) || 0;
  const h = Number(m.h) || 0;
  const shape = w > 0 && h > 0 ? ` style="aspect-ratio:${w}/${h}"` : '';
  return `<div class="cm${video ? ' cm-video' : ' cm-photo'}" data-kind="${escapeHtml(m.kind)}" data-from="${escapeHtml(m.from)}" data-post="${escapeHtml(m.post || '')}" data-src="${escapeHtml(m.src || '')}" data-embed="${escapeHtml(m.embed || '')}" data-thumb="${escapeHtml(m.thumb)}">
      <button type="button" class="cm-still"${shape} aria-label="${video ? 'Play the video' : 'Open the picture'}">
        <img src="${escapeHtml(m.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">
        ${video ? '<span class="cm-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' : ''}
        ${dur ? `<span class="cm-dur">${dur}</span>` : ''}
      </button>
      <a class="cm-link" href="${escapeHtml(m.post)}" target="_blank" rel="noopener">${video ? '▶ Watch' : 'View'} on ${where}</a>
    </div>`;
}

/** Fresh links for a Telegram post's media, asked once per card. */
function freshTgMedia(box) {
  if (box._fresh) return box._fresh;
  const post = /t\.me\/([A-Za-z0-9_]+)\/(\d+)/.exec(box.dataset.post || '');
  box._fresh = !post ? Promise.resolve(null)
    : fetch(`/api/tgmedia?post=${post[1]}/${post[2]}`).then((r) => r.json()).then((j) => (j && j.ok && j.media) || null).catch(() => null);
  return box._fresh;
}

function wireCardMedia(card) {
  const box = card && card.querySelector('.cm');
  if (!box) return;
  const img = box.querySelector('.cm-still img');
  if (img) {
    img.onerror = () => {
      if (box.dataset.from !== 'tg' || img.dataset.retried) { box.classList.add('cm-gone'); return; }
      img.dataset.retried = '1';
      freshTgMedia(box).then((m) => {
        if (!m || !m.thumb) { box.classList.add('cm-gone'); return; }
        box.dataset.thumb = m.thumb;
        if (m.src) box.dataset.src = m.src;
        img.src = m.thumb;
      });
    };
  }
  const still = box.querySelector('.cm-still');
  if (!still) return;
  if (box.dataset.kind === 'photo' && img) pinchInCard(still, img);
  const gone = () => { box.innerHTML = ''; box.appendChild(still); box.classList.add('cm-gone'); };
  const tgPlayer = () => {
    const { embed } = box.dataset;
    if (embed) box.innerHTML = `<iframe class="cm-player cm-tg" src="${escapeHtml(embed)}" loading="lazy" allow="autoplay; fullscreen" referrerpolicy="no-referrer" title="Telegram video"></iframe>`;
    else gone();
  };
  // The video's own file, in a frame that names no referrer (X's video host
  // refuses one that names another site). A failing Telegram file is asked
  // for anew once, then Telegram's own player, then the link.
  const play = (src, retried) => {
    const { from, thumb } = box.dataset;
    const doc = `<meta name="referrer" content="no-referrer"><style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;display:block}</style>`
      + `<video controls autoplay playsinline poster="${escapeHtml(thumb)}" src="${escapeHtml(src)}"></video>`;
    const ratio = still.style.aspectRatio;
    box.innerHTML = `<iframe class="cm-player cm-xv" srcdoc="${escapeHtml(doc)}" referrerpolicy="no-referrer" allow="autoplay; fullscreen" allowfullscreen title="Video"${ratio ? ` style="aspect-ratio:${ratio}"` : ''}></iframe>`;
    const frame = box.querySelector('iframe');
    frame.onload = () => {
      const v = frame.contentDocument && frame.contentDocument.querySelector('video');
      if (!v) return;
      const failed = () => {
        if (from !== 'tg') { gone(); return; }
        if (retried) { tgPlayer(); return; }
        freshTgMedia(box).then((m) => (m && m.src ? play(m.src, true) : tgPlayer()));
      };
      // A dead link can fail before the frame has loaded.
      if (v.error) failed();
      else v.addEventListener('error', failed, { once: true });
    };
  };
  still.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const { kind, from, src, thumb } = box.dataset;
    if (kind === 'photo') {
      openMediaFloat(thumb);
      return;
    }
    if (src) play(src, false);
    // A card saved before the file was kept: ask for it now.
    else if (from === 'tg') freshTgMedia(box).then((m) => (m && m.src ? play(m.src, true) : tgPlayer()));
    else gone();
  };
}

/** A picture opened large, with a small × square on its top right corner. */
function openMediaFloat(src) {
  const flo = document.getElementById('media-float');
  if (!flo || !src) return;
  flo.hidden = false;
  flo.classList.add('show');
  flo.innerHTML = `<div class="media-float-frame"><img src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer"><button type="button" class="media-float-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;
  const close = () => { flo.classList.remove('show'); flo.hidden = true; flo.innerHTML = ''; };
  flo.querySelector('.media-float-close').onclick = close;
  flo.onclick = (e) => { if (e.target === flo) close(); };
  zoomInFrame(flo.querySelector('.media-float-frame'), flo.querySelector('img'));
}

/**
 * Zoom into the picture inside its frame; the frame keeps its size. The wheel
 * or a pinch zooms at the pointer, a double click or double tap zooms in or
 * back out, and a zoomed picture is dragged to move around it.
 */
function zoomInFrame(frame, img) {
  if (!frame || !img) return;
  let s = 1;
  let x = 0;
  let y = 0;
  const pts = new Map();
  let pinch = null;
  let lastTap = 0;
  let tapFrom = null;
  const apply = () => {
    if (s <= 1.01) { s = 1; x = 0; y = 0; }
    const mx = (frame.clientWidth * (s - 1)) / 2;
    const my = (frame.clientHeight * (s - 1)) / 2;
    x = Math.max(-mx, Math.min(mx, x));
    y = Math.max(-my, Math.min(my, y));
    img.style.transform = s === 1 ? '' : `translate(${x}px,${y}px) scale(${s})`;
    frame.classList.toggle('zoomed', s > 1);
  };
  // The point under the pointer stays where it is.
  const zoomAt = (to, cx, cy) => {
    const ns = Math.max(1, Math.min(5, to));
    const r = frame.getBoundingClientRect();
    const px = cx - r.left - r.width / 2;
    const py = cy - r.top - r.height / 2;
    x = px - ((px - x) * ns) / s;
    y = py - ((py - y) * ns) / s;
    s = ns;
    apply();
  };
  img.draggable = false;
  img.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(s * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX, e.clientY);
  }, { passive: false });
  img.addEventListener('dblclick', (e) => { e.preventDefault(); zoomAt(s > 1 ? 1 : 2.5, e.clientX, e.clientY); });
  img.addEventListener('pointerdown', (e) => {
    img.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tapFrom = pts.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s };
    }
    frame.classList.add('dragging');
  });
  img.addEventListener('pointermove', (e) => {
    const was = pts.get(e.pointerId);
    if (!was) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      zoomAt((pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (pts.size === 1 && s > 1) {
      x += e.clientX - was.x;
      y += e.clientY - was.y;
      apply();
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) frame.classList.remove('dragging');
    // A double tap on a phone, where no dblclick comes.
    const still = tapFrom && Math.hypot(e.clientX - tapFrom.x, e.clientY - tapFrom.y) < 10;
    if (e.type === 'pointerup' && e.pointerType === 'touch' && !pts.size && still) {
      const now = Date.now();
      if (now - lastTap < 300) { zoomAt(s > 1 ? 1 : 2.5, e.clientX, e.clientY); lastTap = 0; } else lastTap = now;
    }
  };
  img.addEventListener('pointerup', up);
  img.addEventListener('pointercancel', up);
}

/**
 * On a phone, two fingers zoom into a card's picture where it stands: the
 * picture keeps its place and size in the card. One finger then moves around
 * the zoomed picture; a tap, or pinching back out, returns it. Without a pinch
 * a tap still opens it large.
 */
function pinchInCard(box, img) {
  if (!box || !img || box._pinch) return;
  box._pinch = true;
  let s = 1;
  let x = 0;
  let y = 0;
  let from = null;
  let last = null;
  let zoomedAt = 0;
  const apply = (anim) => {
    if (s <= 1.02) { s = 1; x = 0; y = 0; }
    const mx = (box.clientWidth * (s - 1)) / 2;
    const my = (box.clientHeight * (s - 1)) / 2;
    x = Math.max(-mx, Math.min(mx, x));
    y = Math.max(-my, Math.min(my, y));
    img.style.transition = anim ? 'transform .18s ease-out' : 'none';
    img.style.transform = s === 1 ? '' : `translate(${x}px,${y}px) scale(${s})`;
    box.classList.toggle('pinched', s > 1);
  };
  const two = (t) => {
    const r = box.getBoundingClientRect();
    return {
      d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1,
      cx: (t[0].clientX + t[1].clientX) / 2 - r.left - r.width / 2,
      cy: (t[0].clientY + t[1].clientY) / 2 - r.top - r.height / 2,
    };
  };
  box.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      from = { ...two(e.touches), s, x, y };
    } else if (e.touches.length === 1 && s > 1) {
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: false });
  box.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && from) {
      e.preventDefault();
      const now = two(e.touches);
      const ns = Math.max(1, Math.min(5, (from.s * now.d) / from.d));
      // The point between the fingers stays under them, and follows them.
      x = now.cx - ((from.cx - from.x) * ns) / from.s;
      y = now.cy - ((from.cy - from.y) * ns) / from.s;
      s = ns;
      zoomedAt = Date.now();
      apply(false);
    } else if (e.touches.length === 1 && s > 1 && last) {
      e.preventDefault();
      x += e.touches[0].clientX - last.x;
      y += e.touches[0].clientY - last.y;
      last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      zoomedAt = Date.now();
      apply(false);
    }
  }, { passive: false });
  const end = (e) => {
    if (e.touches.length < 2) from = null;
    if (!e.touches.length) { last = null; if (s <= 1.02) apply(true); }
  };
  box.addEventListener('touchend', end);
  box.addEventListener('touchcancel', end);
  // iOS pinches the whole page otherwise.
  box.addEventListener('gesturestart', (e) => e.preventDefault());
  // A tap on a zoomed picture returns it; right after a pinch, nothing opens.
  box.addEventListener('click', (e) => {
    if (s > 1 || Date.now() - zoomedAt < 400) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (Date.now() - zoomedAt >= 400) { s = 1; apply(true); }
    }
  }, true);
}

function wireMediaClicks(root) {
  if (!root) return;
  root.querySelectorAll('.media-open').forEach((btn) => {
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      const src = btn.getAttribute('data-src');
      if (src) openMediaFloat(src);
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
  'Al-Aqsa Breaking': 'houthi', 'Al-Aqsa TV': 'houthi', 'Yahya Saree': 'houthi', Saree: 'houthi',
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
  'Al-Araby Television': 'intl', 'Al-Araby TV': 'intl', IOM: 'intl', UNHCR: 'intl', OCHA: 'intl',
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
    // Rows stored before the breaking-feed marker came off the outlet names.
    const bare = stripBreakingMarker(key);
    if (bare !== key && SOURCE_LEAN[bare]) return SOURCE_LEAN[bare];
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

/**
 * A channel's name often carries which of the outlet's feeds it is — "Al
 * Arabiya Breaking", "Al-Araby TV (breaking)", "الأقصى عاجل". The reader is
 * being told who reported it, not which desk inside that outlet posted it
 * first, so the marker comes off the displayed name. Rows already in the
 * database carry the old names, which is why this strips rather than relying on
 * the scanner's table alone.
 */
function stripBreakingMarker(name) {
  const n = String(name || '').trim();
  const out = n
    .replace(/\s*[([]\s*(?:breaking(?:\s*news)?|urgent|عاجل)\s*[)\]]\s*$/i, '')
    .replace(/[\s·|—–-]+(?:breaking(?:\s*news)?|urgent|عاجل)\s*$/i, '')
    .trim();
  // "Breaking" on its own is the whole name, not a marker on one.
  return out || n;
}

/** One canonical display name per outlet. */
function canonicalSourceName(name) {
  const n = stripBreakingMarker(name);
  if (!n) return '';
  const fixes = [
    [/^al[- ]?jazeera.*$/i, 'Al Jazeera'],
    [/^al[- ]?arabiya.*$/i, 'Al Arabiya'],
    [/^al[- ]?hadath.*$/i, 'Al Hadath'],
    // The channel, not the newspaper (Al-Araby Al-Jadeed), which is its own
    // outlet and must not be folded in here.
    [/^al[- ]?araby (?:tv|television)$/i, 'Al-Araby TV'],
    [/^al[- ]?aqsa(?: tv| channel)?$/i, 'Al-Aqsa TV'],
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

/** "Arrow in a box" — external-link glyph after a source name, same href as the name. */
const SRC_GO_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
function srcGoLink(url) {
  return `<a class="src-go" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="Open source">${SRC_GO_SVG}</a>`;
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
    if (url) out.push(`<a class="src-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(e.name)}</a>${srcGoLink(url)}`);
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
        ? `<a class="src-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>${srcGoLink(url)}`
        : `<span class="src-plain">${escapeHtml(name)}</span>`);
    } else if (s && s.name) {
      const name = canonicalSourceName(s.name);
      parts.push(s.url
        ? `<a class="src-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>${srcGoLink(s.url)}`
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
  // A short report is its headline: an empty body stays empty, never a placeholder.
  if (!raw.trim() && r && r.summary && !hasNonLatinScript(r.summary)) return '';
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

// Ground fighting: clashes, advances, and the capture of positions or of
// commanders, soldiers and senior figures.
const GROUND_RE = /\bclash(?:es|ed)?\b|\bfighting\b|front line|contact lines?|ground (?:assault|engagement)|shelling|artillery|mortar|counter-attack|attack(?:ed)? government lines|seize|seized|retake|retook|infiltration|\bcaptur(?:e|es|ed|ing)\b|\btaken prisoner\b|\bprisoners? of war\b|\bstorm(?:s|ed)?\b|\badvance[sd]?\b|\btook control\b|\bpositions? (?:fell|taken)\b/i;
// Launch/strike/alert: raids by fighter jets, drone and missile launches,
// interceptions, and sirens or air-defence alerts.
const STRIKE_RE = /\bstrike[sd]?\b|air strikes?|air raids?|warplanes?|fighter jets?|\bjets?\b|bomb(?:ed|ing|ard)|\bmissile\b|ballistic|\bdrone\b|\bUAV\b|launch(?:ed|es)?\b|shot down|intercept(?:ed|ion|s)?|air defence alerts?|air raid sirens?|sirens?\b|explosion|blast/i;

/** The exact kind inside the launch/strike/alert category, for a pin's note. */
function strikeKind(text) {
  const t = String(text || '');
  if (/sirens?\b|air defence alerts?|\balert\b|warning to residents/i.test(t)) return 'Alert';
  if (/intercept|shot down/i.test(t)) return 'Interception';
  if (/launch(?:ed|es)?\b|fired|toward|towards/i.test(t) && !/air raids?|warplanes?|jets?\b|air strikes?/i.test(t)) return 'Launch';
  return 'Strike';
}
// No bare "boats" or "crew": "a fuel station supplying fishermen's boats" on
// Kamaran island made an air strike a vessel attack.
const VESSEL_RE = /\bvessels?\b|\btankers?\b|merchant ships?|bulk carriers?|cargo ships?|container ?ships?|\bships?\b|UKMTO/i;
// A port or oil terminal that was itself hit. Aramco alone is not a port: tanks
// near Riyadh and a site in Najran are not ports.
const PORT_RE = /\b(?:on|at|hit|hits|struck|strikes? on|target(?:s|ed|ing)?|shelling of|fire on) (?:the )?(?:port|harbou?r|oil terminal)\b|\bport of\b|oil terminal|terminal at/i;
// A ship pin is an attack on a ship. Traffic figures, cargo unloaded and
// shipping trends are not events.
const VESSEL_ATTACK_RE = /attack|projectile|struck|\bhit\b|\bhits\b|target|seiz|board|hijack|explo|fire[sd]? (?:on|at)|missile|drone|damag|\bsank\b|sink|intercept|harass|approached by|capsiz|abduct/i;
// The middle of a country is no place: a pin there says only "somewhere".
const COUNTRY_PLACE_RE = /^(?:Yemen|Saudi Arabia|Oman|Iran|the Red Sea)$/i;
const NONMAP_RE = /\bF-?35\b|arms (?:deal|sale)|approved a (?:possible )?sale|State Department|condemn(?:s|ed)?\b|expresses solidarity|appeal|funding|displaced|refugee|humanitarian|Crisis Group|travel warning/i;

/**
 * Strict map categories. Anything that is not an event at a point on the ground
 * or at sea returns null and stays in the feed.
 */
function classifyForMap(text, hintedType) {
  const t = String(text || '');
  const hint = String(hintedType || '').toLowerCase();
  // The reader's type is final. A strike stays a strike: an island, a coast or
  // a word like "boats" does not turn it into an attack on a ship.
  // A ship icon needs a ship and something done to it; an airport, an air
  // base, an alert or a port hit the reader typed as a ship attack is drawn
  // as what it is (the server does the same for new cards: maritime.ts).
  if (hint === 'vessel') {
    if (VESSEL_RE.test(t) && VESSEL_ATTACK_RE.test(t)) return 'vessel';
    if (/\bport\b|harbou?r|oil terminal|refinery/i.test(t) && VESSEL_ATTACK_RE.test(t)) return 'port';
    if (/airport|air ?base|\balerts?\b|sirens?|intercept|missile|drone|air ?strikes?|hangar/i.test(t)) return 'strike';
    return null;
  }
  if (hint === 'port') return 'port';
  if (hint === 'statement' || hint === 'diplomacy' || hint === 'intel') return 'statement';
  if (hint === 'combat' || hint === 'clash' || hint === 'capture' || hint === 'military') return 'combat';
  if (hint === 'economy' || hint === 'humanitarian') return null;
  if (hint === 'missile' || hint === 'strike' || hint === 'launch') {
    // Hand-logged items typed "missile" say "strike on the port" in words.
    if (PORT_RE.test(t)) return 'port';
    return 'strike';
  }
  if (!t.trim()) return null;
  if (NONMAP_RE.test(t) && !GROUND_RE.test(t) && !STRIKE_RE.test(t)) return null;
  if (VESSEL_RE.test(t) && VESSEL_ATTACK_RE.test(t) && !PORT_RE.test(t)) return 'vessel';
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

/** Same event: most headline words shared. Mirrors sameWords() in yemen-scan.server.ts. */
function headWords(summary) {
  const said = String(summary || '').replace(/^[^:]{2,60}:\s/, '');
  const stop = new Set('the and for with from that this into over after amid near its his her their has have had was were are will been says said say'.split(' '));
  return new Set((said.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !stop.has(w)).map((w) => w.replace(/s$/, '')));
}
function sameWords(a, b) {
  const x = headWords(a);
  const y = headWords(b);
  if (!x.size || !y.size) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both) >= 0.4;
}

function namedSpeaker(summary) {
  const m = /^(.{2,48}?)(?::\s|\s(?:says|said|tells|told|warns|warned|denies|denied|condemns|condemned|urges|urged|calls for|called for|announces|announced|rejects|rejected|meets|met|stresses|stressed|affirms|affirmed|welcomes|welcomed|discusses|discussed|receives|received)\b)/.exec(String(summary || ''));
  if (!m) return '';
  const who = m[1].trim();
  if (/^(an?|the)\s/i.test(who)) return '';
  if (/^(spokes(?:man|woman|person)|officials?|sources?|commanders?|ministers?)$/i.test(who)) return '';
  // One key per person, whatever the title (as speakerKey on the server).
  const w = who.toLowerCase().replace(/^(?:the\s+)?(?:u\.?s\.?|us|american|former)\s+/, '');
  const known = /\b(trump|rubio|vance|hegseth|biden|netanyahu|khamenei|araghchi|pezeshkian|guterres|grundberg|fletcher)\b/.exec(w);
  if (known) return known[1];
  const aliases = [
    [/bin salman|\bmbs\b|saudi crown prince/, 'mbs'],
    [/faisal bin farhan|saudi (?:foreign minister|fm)\b/, 'saudi fm'],
    [/zindani|yemen(?:i|'s)? (?:foreign minister|fm)\b/, 'yemen fm'],
    [/\balimi\b|presidential (?:leadership )?council (?:head|chair(?:man)?|president)|\bplc (?:head|chair(?:man)?)/, 'alimi'],
    [/abdul-?malik al-houthi|houthi leader/, 'houthi leader'],
    [/\bsaree\b|houthi (?:military|armed forces) spokesman/, 'saree'],
    [/abdul-?salam|houthi (?:chief )?negotiator|houthi spokesman/, 'abdulsalam'],
    [/turki al-maliki|coalition spokesman/, 'maliki'],
  ];
  for (const [re, key] of aliases) if (re.test(w)) return key;
  return w.replace(/^(?:president|secretary of state|secretary|minister|prime minister)\s+/, '');
}

/**
 * A report collapsed into another card's story is attached to it, not dropped:
 * a second outlet's account of the same event stays one click away.
 */
function attachAccount(keep, other) {
  if (!keep || !other || !other.url || other.source === keep.source) return;
  const list = Array.isArray(keep.alsoReportedBy) ? keep.alsoReportedBy : [];
  if (list.some((a) => a.source === other.source)) return;
  keep.alsoReportedBy = [...list, { source: other.source, url: other.url, ...(other.summary ? { summary: other.summary } : {}) }];
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
    const prev = group.find((p) => Math.abs(Date.parse(reportTime(p)) - t) <= 20 * 60 * 1000 && sameWords(p.summary, r.summary));
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
    const res = await fetch('/api/desk?limit=400');
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
  // The reader never sees the scan at work: no line under the heading that
  // comes and goes and moves the column. The header's dot tells a stall.
  el.textContent = '';
  // The header's dot: green while the scans arrive, amber then red when they stop.
  const dot = document.querySelector('.stamp .pulse');
  if (dot) {
    dot.classList.toggle('stale-amber', mins >= 15 && mins < 30);
    dot.classList.toggle('stale-red', mins >= 30);
  }
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

function stampText() {
  return `Updated ${fmtClock(data.updatedAt)}`;
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
    // An item read again by a later scan takes that scan's time: the box lists
    // what the LAST scan read, and a re-read item was part of it.
    const byUrl = new Map((liveOverlay.rawHits || []).map((h) => [String(h.url || '').split('?')[0], h]));
    live.rawHits.filter((h) => h && h.url).forEach((h) => {
      const u = String(h.url).split('?')[0];
      const had = byUrl.get(u);
      if (!had || scanSeen(h) > scanSeen(had)) byUrl.set(u, h);
    });
    liveOverlay.rawHits = [...byUrl.values()];
    // Newest scanned first — the box is a log of what the scanner just pulled.
    liveOverlay.rawHits.sort((a, b) => scanSeen(b) - scanSeen(a));
    if (liveOverlay.rawHits.length > 600) liveOverlay.rawHits = liveOverlay.rawHits.slice(0, 600);
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
        const res = await fetch('/api/scan');
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
    const res = await fetch('/api/brief');
    if (!res.ok) return;
    const b = await res.json();
    if (b && b.ok) brief = b;
  } catch (e) { /* the panels fall back to their curated copy */ }
}

/**
 * The stamp under every 12-hourly panel. Says plainly when the panel last
 * refreshed and when it next will, and flags it when the refresh is overdue.
 */
/** `top`: the stamp sits under a column's heading rather than at its foot. */
function cadenceStamp(top = false) {
  const cls = top ? 'cadence at-head' : 'cadence';
  if (!brief) return `<p class="${cls}">Refreshes every 12 hours.</p>`;
  const overdue = Date.now() > Date.parse(brief.nextUpdateAt);
  return `<p class="${cls}${overdue ? ' late' : ''}">Updates every 12 hours · Next ${escapeHtml(fmtWhen(brief.nextUpdateAt))}${overdue ? ' · refresh due' : ''}</p>`;
}

function frontActivity(id) {
  if (!brief || !Array.isArray(brief.fronts)) return null;
  return brief.fronts.find((f) => f.id === id) || null;
}

/* ---------------------------------------------------------------- *
 * Live scan box
 * ---------------------------------------------------------------- */

/*
 * The box lists what the last scan read, newest first: a few at a time, with a
 * button that pages through the rest of that same scan, the way the report
 * column does. Older scans are not listed; a new scan starts the list over.
 */
const SCAN_FIRST = 6;
const SCAN_STEP = 10;
let scanShown = SCAN_FIRST;
let scanShownFor = 0;

function lastScanHits() {
  const all = liveOverlay.rawHits || [];
  const latest = all.reduce((m, h) => Math.max(m, scanSeen(h)), 0);
  const pub = (h) => { const t = Date.parse(h.at || ''); return Number.isFinite(t) ? t : 0; };
  return { latest, rows: all.filter((h) => scanSeen(h) === latest).sort((a, b) => pub(b) - pub(a)) };
}

function renderLiveScan() {
  const meta = document.getElementById('live-scan-meta');
  const list = document.getElementById('live-scan-list');
  const details = document.getElementById('live-scan-details');
  const { latest, rows } = lastScanHits();
  if (latest !== scanShownFor) { scanShown = SCAN_FIRST; scanShownFor = latest; }
  if (meta) {
    const t = liveOverlay.scannedAt ? fmtClock(liveOverlay.scannedAt) : '—';
    meta.textContent = liveOverlay.scannedAt
      ? `Last scan ${t}`
      : 'Not scanned yet';
  }
  if (!details || !details.open || !list) return;

  // Interesting / Not were removed: the verdicts only ever reached this
  // browser's localStorage, so they taught the desk nothing and the buttons
  // promised more than they did.
  const html = rows.slice(0, scanShown).map((h) => {
    const u = String(h.url || '').split('?')[0];
    const pub = h.at ? fmtStamp(h.at) : '';
    const sn = escapeHtml((h.snippet || '').slice(0, 240));
    return `<div class="ls-row" data-url="${escapeHtml(u)}">
      <div class="ls-top">
        <span class="ls-src">${escapeHtml(canonicalSourceName(h.source))}</span>
        <span class="ls-at">${escapeHtml(pub)}</span>
      </div>
      <p class="ls-sn">${sn}</p>
      <div class="ls-mark">
        <a class="src-link" href="${escapeHtml(h.url)}" target="_blank" rel="noopener">Open source</a>
      </div>
    </div>`;
  }).join('') || '<p class="ls-hint">Nothing read in the last scan.</p>';
  const left = rows.length - scanShown;
  list.innerHTML = html + (left > 0
    ? `<button type="button" class="more" id="ls-more">Show more (+${Math.min(SCAN_STEP, left)})</button>`
    : '');
  const more = document.getElementById('ls-more');
  if (more) more.onclick = () => { scanShown += SCAN_STEP; renderLiveScan(); };
}


/* ---------------------------------------------------------------- *
 * Panels
 * ---------------------------------------------------------------- */

/*
 * The prose names the places the desk's pins stand on. Each name links to the
 * pin of the report its sentence was written from: the pin at that place whose
 * headline shares the most words with the sentence, else the newest there. A
 * click takes the main map to it and makes it jump (Latest developments, Fronts).
 */
const NOT_A_PIN_NAME = /^(?:yemen|saudi arabia|the red sea)$/i;
const PROSE_PIN_MS = 36 * 3600 * 1000;
const PROSE_WEEK_MS = 7 * 24 * 3600 * 1000;
/** How far either side of a place name its clause is read, in characters. */
const PROSE_REACH = 60;
const PROSE_COMMON = new Set(('saudi arabia yemen yemeni houthi houthis government forces coalition province governorate ' +
  'district area areas reported report reports said says over from with that this their were have been also into after ' +
  'while near city town military sources media front fronts defense defence ministry minister ministers officials security ' +
  // The governorates: "Taiz and Lahj" says nothing of which Lahj report a clause was written from.
  'taiz lahj marib saada hodeidah sanaa aden dhale jawf hajjah abyan shabwa bayda dhamar amran mahrah hadramout ' +
  'raymah mahwit socotra jizan najran asir').split(' ').map((w) => w.slice(0, 6)));

function pinsForProse() {
  if (!mappableByFp.size && data && window.L) { try { buildMapPins(data); } catch (e) {} }
  // The prose's own window: the reports it was written from, not today's.
  const end = Date.parse((brief && brief.updatedAt) || '') || Date.now();
  // The week before it too: a place the prose names finds its newest pin there.
  return [...mappableByFp.values()].filter((p) => p.place && Date.parse(p.at) >= end - PROSE_WEEK_MS && Date.parse(p.at) <= end + 3600e3);
}

/** A text's words of four letters or more, cut to six: "recapturing" meets "recapture". */
function proseWords(s) {
  return new Set((String(s || '').toLowerCase().match(/[a-zÀ-ɏ']{4,}/g) || []).map((w) => w.slice(0, 6)));
}

/** The governorates and provinces the prose names, under every spelling the pins use. */
const PROSE_REGIONS = [
  ['hodeidah', 'hudaydah', 'hudaidah'], ['saada', "sa'dah", 'sadah'], ['marib', "ma'rib"], ['dhale', "dhale'", "ad dali'", 'dalea'],
  ['mahrah', 'mahra'], ['hadramout', 'hadramawt', 'hadhramout', 'hadhramaut'], ['bayda', 'baydha', 'beida'], ['sanaa', "sana'a"],
  ['mecca', 'makkah'], ['jizan', 'jazan'], ['taiz', "ta'izz"], ['abyan'], ['shabwa', 'shabwah'], ['lahj'], ['aden'], ['jawf'],
  ['hajjah'], ['amran'], ['dhamar'], ['raymah'], ['mahwit'], ['socotra'], ['najran'], ['asir', "'asir"], ['riyadh'],
];
/** A place name used as the name of a thing ("the Mecca defense pact") is not a place. */
const NAME_OF_A_THING = /^\s+(?:defen[cs]e\s+)?(?:pact|agreement|accord|talks|summit|declaration|process|conference|initiative)\b/i;

/** A name as a pattern that forgives the vowels a transliteration moves: Qurfan = Qarfan, Saada = Sa'dah. */
function placePattern(name) {
  const core = name.toLowerCase().replace(/^(?:al|el|ad|as|ash|ar)[- ]/, '').replace(/[^a-z' -]/g, '').replace(/'/g, '');
  if (core.replace(/[^a-z]/g, '').length < 3) return null;
  const pre = "(?:\\b(?:al|el|ad|as|ash|ar)[- ])?\\b";
  // Two consonants are too few to forgive vowels by ("Aden" would meet "done").
  // (A closing h is optional, so it doesn't count: "Riyadh" would meet "Red".)
  if (core.replace(/h\b/g, '').replace(/[^a-z]|[aeiouy]/g, '').replace(/(.)\1+/g, '$1').length < 3) return `${pre}${core.replace(/[- ]+/g, '[- ]')}\\b`;
  const body = core.split(/[- ]+/).filter(Boolean).map((w) => w.replace(/h$/, '')
    .split(/[aeiouy]+/)
    .map((c) => c.split('').map((ch) => ch + '+').join(''))
    .join("[aeiouy']{0,2}")).join('[- ]');
  return `${pre}${body}h?\\b`;
}

function linkPlaces(text, pins) {
  const t = String(text || '');
  if (!pins || !pins.length) return escapeHtml(t);
  const norm = t.replace(/[’‘]/g, "'").replace(/[‐-―]/g, '-');
  // Every part of every pin's place ("Jabal Qurfan, Taiz" is both), and each
  // governorate by all its spellings, so a governorate named in the prose finds
  // a pin inside it.
  const regionOf = (s) => PROSE_REGIONS.find((r) => r.includes(s.toLowerCase().replace(/^(?:al|as|ad|ar|ash)[- ]/, '')));
  const byKey = new Map();
  const add = (key, name, p) => {
    const pat = placePattern(name);
    if (!pat) return;
    if (!byKey.has(key)) byKey.set(key, { pats: new Set(), pins: new Set() });
    byKey.get(key).pats.add(pat);
    byKey.get(key).pins.add(p);
  };
  for (const p of pins) {
    for (const seg of String(p.place).split(',')) {
      const name = seg.replace(/[’‘]/g, "'").replace(/[‐-―]/g, '-').trim();
      if (!name || NOT_A_PIN_NAME.test(name)) continue;
      const r = regionOf(name);
      if (r) r.forEach((alias) => add(`r:${r[0]}`, alias, p));
      else add(`p:${placePattern(name)}`, name, p);
    }
  }
  const end = Date.parse((brief && brief.updatedAt) || '') || Date.now();
  const inWindow = (p) => Date.parse(p.at) >= end - PROSE_PIN_MS;
  const entries = [...byKey.values()].map((v) => ({
    re: new RegExp([...v.pats].sort((a, b) => b.length - a.length).join('|'), 'gi'),
    pins: [...v.pins],
    len: Math.max(...[...v.pats].map((s) => s.length)),
  })).sort((a, b) => b.len - a.len);
  const spans = [];
  for (const m of norm.matchAll(/[^.!?]+[.!?]*/g)) {
    const sent = m[0];
    for (const { re, pins: ps } of entries) {
      re.lastIndex = 0;
      for (const hit of sent.matchAll(re)) {
        const start = m.index + hit.index;
        const stop = start + hit[0].length;
        if (spans.some((s) => start < s[1] && stop > s[0])) continue;
        if (NAME_OF_A_THING.test(sent.slice(hit.index + hit[0].length))) continue;
        // The pin whose report the clause at the name was written from: the words
        // around it shared with the report, past places and the war's everyday
        // words; else the newest pin there in the prose's window, else this week.
        const words = proseWords(sent.slice(Math.max(0, hit.index - PROSE_REACH), hit.index + hit[0].length + PROSE_REACH));
        const place = proseWords(hit[0]);
        const own = (w) => words.has(w) && !place.has(w) && !PROSE_COMMON.has(w);
        const newest = (a, b) => Date.parse(b.at) - Date.parse(a.at);
        const scored = ps.map((p) => ({ p, n: [...proseWords(p.label)].filter(own).length }))
          .sort((a, b) => b.n - a.n || (inWindow(b.p) - inWindow(a.p)) || newest(a.p, b.p));
        const best = scored[0] && scored[0].p;
        if (best) spans.push([start, stop, best]);
      }
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = 0;
  for (const [s, e, p] of spans) {
    out += `${escapeHtml(t.slice(at, s))}<a href="#map" class="prose-pin" data-fp="${escapeHtml(p.fp)}" title="${escapeHtml(p.label)}">${escapeHtml(t.slice(s, e))}</a>`;
    at = e;
  }
  return out + escapeHtml(t.slice(at));
}

function wireProsePins(root) {
  if (!root) return;
  root.querySelectorAll('.prose-pin').forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      const pin = mappableByFp.get(a.dataset.fp);
      if (pin) goToPinOnMainMap(pin, { note: false });
    };
  });
}

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
  el.innerHTML = `<div class="sit-head"><h2>Latest developments</h2><a class="to-fronts" href="#fronts-wrap">Fronts <span aria-hidden="true">→</span></a></div>${cadenceStamp(true)}
    <p class="situation-window">${linkPlaces(body, pinsForProse())}</p>`;
  wireProsePins(el);
  const go = el.querySelector('.to-fronts');
  if (go) go.onclick = (ev) => {
    ev.preventDefault();
    const to = document.getElementById('fronts-wrap');
    if (!to) return;
    to.scrollIntoView({ behavior: 'smooth', block: 'start' });
    to.setAttribute('tabindex', '-1');
    to.focus({ preventScroll: true });
  };
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

/*
 * One pager for Fronts and Numbers. Every slide sits in the same grid cell, so
 * the box is as tall as its tallest slide and the section under it never
 * moves. Dots under the box, arrows inside it on a wide screen, a swipe on a
 * phone, the arrow keys from the keyboard; a short slide-and-fade between
 * slides, a plain fade when the reader asks for less motion.
 */
function pagerHtml(kind, slides, idx, labels) {
  const many = slides.length > 1;
  const items = slides.map((s, i) => `<div class="pg-slide${i === idx ? ' on' : ''}" data-i="${i}" role="group" aria-roledescription="slide" aria-label="${escapeHtml(labels[i])} (${i + 1} of ${slides.length})"${i === idx ? '' : ' aria-hidden="true" inert'}>${s}</div>`).join('');
  const dots = labels.map((l, i) => `<button type="button" role="tab" data-i="${i}" title="${escapeHtml(l)}" aria-label="${escapeHtml(l)}" aria-selected="${i === idx}" class="${i === idx ? 'on' : ''}"></button>`).join('');
  return `<div class="pager pager-${kind}${many ? ' many' : ''}" aria-roledescription="carousel">
      <div class="pg-track">${items}</div>
      ${many ? `<button type="button" class="pg-arrow pg-prev" aria-label="Previous"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>
      <button type="button" class="pg-arrow pg-next" aria-label="Next"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>` : ''}
    </div>
    ${many ? `<div class="pg-dots" role="tablist">${dots}</div>` : ''}`;
}

/** A page turned: the box read out on the last one closes, so the pager is its own height again. */
function closeReadMore(root, cardSel, btnSel) {
  root.querySelectorAll(`${cardSel}.open`).forEach((c) => {
    c.classList.remove('open');
    const b = c.querySelector(btnSel);
    if (b) b.textContent = 'Read more';
  });
}

function wirePager(root, idx, onChange, opts) {
  const wrap = !opts || opts.wrap !== false;
  const pager = root.querySelector('.pager');
  if (!pager) return;
  const slides = [...pager.querySelectorAll('.pg-slide')];
  const dots = [...root.querySelectorAll('.pg-dots button')];
  const n = slides.length;
  let cur = idx;
  const go = (i, dir) => {
    if (!wrap && (i < 0 || i >= n)) return;
    const next = ((i % n) + n) % n;
    if (n < 2 || next === cur) return;
    const d = dir || (next > cur ? 1 : -1);
    const from = slides[cur];
    const to = slides[next];
    // The new slide comes in from the side it is on; the old one leaves the other way.
    to.style.transition = 'none';
    to.style.setProperty('--from', String(d));
    void to.offsetWidth;
    to.style.transition = '';
    from.style.setProperty('--from', String(-d));
    from.classList.remove('on');
    from.setAttribute('aria-hidden', 'true');
    from.inert = true;
    to.classList.add('on');
    to.removeAttribute('aria-hidden');
    to.inert = false;
    dots.forEach((b, j) => { b.classList.toggle('on', j === next); b.setAttribute('aria-selected', String(j === next)); });
    cur = next;
    ends();
    onChange(next);
  };
  const prev = pager.querySelector('.pg-prev');
  const nextBtn = pager.querySelector('.pg-next');
  // Without wrapping, an arrow with nowhere to go is hidden.
  const ends = () => {
    if (wrap) return;
    if (prev) prev.hidden = cur === 0;
    if (nextBtn) nextBtn.hidden = cur === n - 1;
  };
  ends();
  if (prev) prev.onclick = () => go(cur - 1, -1);
  if (nextBtn) nextBtn.onclick = () => go(cur + 1, 1);
  dots.forEach((b) => { b.onclick = () => go(Number(b.dataset.i) || 0); });
  root.onkeydown = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1, -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1, 1); }
  };
  let x0 = null;
  let y0 = null;
  const track = pager.querySelector('.pg-track');
  track.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }, { passive: true });
}

/*
 * The conflict in numbers: Killed, Injured, Humanitarian, one box at a time.
 * Each row a group of people, each column who counts them — the official
 * count, the Houthis' own sources, the government's or Saudi Arabia's — and
 * every figure links to where it was published (numbers.ts, /api/brief "figures").
 */
const NUM_BOXES = [
  ['Killed', [['Houthi', 'killed.houthi'], ['Government', 'killed.gov'], ['Saudi Arabia', 'killed.saudi'], ['Civilians', 'killed.civilians'], ['All sides', 'killed.total']]],
  ['Injured', [['Houthi', 'injured.houthi'], ['Government', 'injured.gov'], ['Saudi Arabia', 'injured.saudi'], ['Civilians', 'injured.civilians'], ['All sides', 'injured.total']]],
  ['Humanitarian', [['Displaced in Yemen', 'idp'], ['Refugees abroad', 'refugees'], ['Facing acute hunger', 'food']]],
];
/** Every load opens on Killed. */
let casBox = 0;

/** Cells from the tally alone, while /api/brief has not answered. */
function fallbackNumbers(t) {
  const cells = {};
  const put = (key, v) => {
    if (Number.isFinite(v)) cells[key] = { official: { ...((t.from || {})[key] || { name: '', url: '', date: '' }), value: v } };
  };
  ['killed', 'injured'].forEach((g) => Object.keys(t[g] || {}).forEach((k) => put(`${g}.${k}`, t[g][k])));
  put('idp', t.idp);
  put('refugees', t.refugees);
  return { cells };
}

function numCell(c, cls) {
  if (!c || !Number.isFinite(c.value)) return `<td class="${cls} none" title="Not published: no count for this round from these sources">—</td>`;
  const n = c.value >= 1e6 ? `${(c.value / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : Number(c.value).toLocaleString('en-US');
  const q = c.q ? `<small class="q">${escapeHtml(c.q)}</small> ` : '';
  const when = c.date ? new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const tip = [c.name, when].filter(Boolean).join(', ') + (c.note ? ` — ${c.note}` : '');
  const inner = c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${q}${n}</a>` : `${q}${n}`;
  return `<td class="${cls}" title="${escapeHtml(tip)}">${inner}</td>`;
}

function renderCasualties() {
  const el = document.getElementById('casualties');
  if (!el) return;
  const nums = (brief && brief.figures && brief.figures.cells ? brief.figures : null) || fallbackNumbers((brief && brief.tally) || TALLY_FALLBACK);
  const head = '<tr><th></th><th scope="col">Official</th><th scope="col" class="h">Houthi sources</th><th scope="col" class="g">Gov. / Saudi sources</th></tr>';
  const boxes = NUM_BOXES.map(([title, rows]) => `<div class="tally-box claims"><h3>${title}</h3><table>${head}${rows.map(([label, key]) => {
    const r = nums.cells[key] || {};
    return `<tr><th scope="row">${label}</th>${numCell(r.official, 'off')}${numCell(r.houthi, 'h')}${numCell(r.gov, 'g')}</tr>`;
  }).join('')}</table></div>`);
  el.innerHTML = `${cadenceStamp(true)}
    <div class="tally one">${pagerHtml('numbers', boxes, casBox, NUM_BOXES.map((b) => b[0]))}</div>
`;
  wirePager(el, casBox, (i) => { casBox = i; });
}

function computeControlShares(d) {
  const sums = { houthi: 0, plc: 0, contested: 0 };
  // By area, district by district, once the districts are in.
  if (districtGeo) {
    const byIso = controlByIso(d);
    districtGeo.features.forEach((f) => {
      const s = districtSide(f.properties, byIso);
      const k = s === 'houthi' ? 'houthi' : (s === 'plc' ? 'plc' : 'contested');
      sums[k] += f.properties.km2 || 0;
    });
    const all = sums.houthi + sums.plc + sums.contested || 1;
    const hh = Math.round(100 * sums.houthi / all);
    const pp = Math.round(100 * sums.plc / all);
    return { houthi: hh, plc: pp, contested: Math.max(0, 100 - hh - pp) };
  }
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
        <span class="src-wrap">${srcHtml}${r.citing ? `<span class="citing">, citing ${escapeHtml(r.citing)}</span>` : ''}</span>
        ${mappableByFp.has(fp) ? '<button type="button" class="card-map">Show on map</button>' : ''}
      </div>
      ${replyQuote(r)}
      <p class="headline">${escapeHtml(sum)}</p>
      ${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}
      ${!Array.isArray(r.media) && (r.type === 'statement' || r.type === 'diplomacy') ? '' : cardMediaHtml(r.media)}
      ${also ? `<p class="also">Also: ${also.map((a) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(canonicalSourceName(a.source))}</a>`).join(' · ')}</p>` : ''}
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

function flashCard(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

/**
 * After a jump to an earlier report, a way back to the one it was opened
 * from, shown only while that card is out of sight.
 */
let jumpBack = null;
function offerJumpBack(from) {
  if (jumpBack) jumpBack.stop();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'jump-back';
  btn.innerHTML = '<span aria-hidden="true">↑</span> Back';
  btn.setAttribute('aria-label', 'Back to the report you came from');
  btn.hidden = true;
  const feed = document.getElementById('feed');
  const place = () => {
    const box = (feed || document.body).getBoundingClientRect();
    btn.style.left = `${Math.round(box.left + box.width / 2)}px`;
  };
  const io = new IntersectionObserver(([e]) => {
    btn.hidden = e.isIntersecting;
    if (!btn.hidden) place();
  });
  const timer = setTimeout(() => stop(), 20000);
  function stop() {
    io.disconnect();
    clearTimeout(timer);
    btn.remove();
    if (jumpBack && jumpBack.btn === btn) jumpBack = null;
  }
  btn.onclick = () => {
    from.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashCard(from);
    stop();
  };
  document.body.appendChild(btn);
  // Observed once the jump's scroll has started, so the card is judged where it lands.
  setTimeout(() => io.observe(from), 400);
  jumpBack = { btn, stop };
}

function wireFeedCard(card) {
  if (!card) return;
  wireCardMedia(card);
  const mapBtn = card.querySelector('.card-map');
  if (mapBtn) {
    mapBtn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showReportOnMap(card.dataset.fp, mapBtn);
    };
    // Desktop: resting on the button opens the map beside the card.
    mapBtn.onmouseenter = () => {
      if (!window.matchMedia('(hover: hover)').matches || window.innerWidth < 720) return;
      clearTimeout(pinPopTimer);
      pinPopTimer = setTimeout(() => {
        const pin = mappableByFp.get(card.dataset.fp);
        if (pin && map) openPinSheet(pin, mapBtn);
      }, 250);
    };
    mapBtn.onmouseleave = () => {
      clearTimeout(pinPopTimer);
      const el = document.getElementById('pin-sheet');
      if (el && el.classList.contains('as-pop')) pinPopTimer = setTimeout(closePinSheet, 300);
    };

  }
  const reply = card.querySelector('.reply-to');
  if (reply) {
    // The earlier report may have no card of its own (folded into another
    // card's copies): then the link leads nowhere and is not shown.
    const findParent = () => document.querySelector(`#feed .card[data-fp="${CSS.escape(reply.dataset.parent)}"]`);
    if (!findParent()) reply.remove();
    reply.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const target = findParent();
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashCard(target);
      offerJumpBack(card);
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

/**
 * `?media-test` only: two sample cards built from real posts, to show how a
 * card's picture or video looks and plays. Nothing is stored; no reader sees it.
 */
function mediaTestCards() {
  if (!/[?&]media-test\b/.test(location.search)) return '';
  const now = new Date().toISOString();
  const x = 'https://x.com/Yem_army_media/status/2103244538957459764';
  return [
    {
      fp: 'media-test-x', at: now, source: 'Yemeni Armed Forces (X) · TEST', url: x, type: 'strike', live: true,
      summary: 'TEST — Government drone strikes Houthi vehicles north of the front, army media video shows',
      text: 'Sample card to show a video on a card. The Yemeni army media office posted drone footage of the Eighth Brigade striking Houthi vehicles.',
      media: { kind: 'video', from: 'x', post: x, thumb: 'https://pbs.twimg.com/media/HTA5vTEWUAAchW1.jpg', src: 'https://video.twimg.com/amplify_video/2103243072716832769/vid/avc1/710x360/FsT-_qcTVd03YGVs.mp4?tag=29', duration: 71 },
    },
    {
      fp: 'media-test-tg-photo', at: now, source: 'Ali Bk (Telegram) · TEST', url: "https://t.me/Alibk3/37033", type: 'combat', live: true,
      summary: "TEST — Heavy clashes in the Kahbub mountains, Ali Bk map shows",
      text: "Sample card to show a Telegram picture on a card, at its own shape.",
      media: {"kind":"photo","from":"tg","post":"https://t.me/Alibk3/37033","thumb":"https://cdn4.telesco.pe/file/FYOmwOqC1GvIuN3Oz6Baungau6OCuqZmB8oQgHpd2LSH06FL_VvWlmndvBA0r6vEKMA7fxyS-YxRPWa4HfrytiTaJfWXwb6KxmYlaEOXoOlnjXJ3ERE0ZePtjLc14GIs2TgIITnh6Su4NdbUfZSHq_YGnOT3N_Xdb8MMofT_Y8IijRvmH9mPqDKD6xYfMj0182Y6w6_Lfx5WXSVV-xqA7a5fJLNGkCUeh9DaPVb8ufUiOGUAAfGfe1tDsBFP9TpJ57uv_pv9J-RG8PKCfz_Vc7dNMx0C-s8T-qtx68MH4X3q3Wpvia2JzCc0f_T5su8bpUpbRIiNnt9hIkCgPU_oHg.jpg","w":800,"h":468},
    },
    {
      fp: 'media-test-tg', at: now, source: 'Ali Bk (Telegram) · TEST', url: "https://t.me/Alibk3/37041", type: 'combat', live: true,
      summary: "TEST — Satellite images show direct hits on King Fahd Air Base in Taif",
      text: "Sample card to show a Telegram video on a card; it plays the file itself, like X.",
      media: {"kind":"video","from":"tg","post":"https://t.me/Alibk3/37041","thumb":"https://cdn4.telesco.pe/file/kg5joOV_FCLhXGxnzXxGJCtpuF4iDhZx8TY65EVshG6zlvIVDeifrvG53jJnX-YxwRRBv9eOid4uf7tusWCiukHW3iBUPbfwQu_Zu4eurRZ-GzKadWXQTRCHf9ZBI-aEst3typZq9CsZSiXDqg7N_lfC7uTs05PFthI2NPGG5xJVfBm7UA9mY7tKCGwHPhOIOyXz7b_9RWt_bJQqCBOO2ujjWaH2TczYYlKtdkolN73R-kTMjELnM3mKgFsIlIlZNqthmOBgBDDPgSOLs9wNwAYyRgBUQNRzVucH9pTGdEFyMAkIDGgoF-c07E6tDHvV-2IMcYkpIGqORFy5XWhMSw","src":"https://cdn4.telesco.pe/file/2ccd834ef9.mp4?token=GKCEbUCkx9aS4pilvYh_MuEaJZCUcUz6JG2DeXm6bQGNjDH8-RefXLetyCDqjoFsWqbE49p5URMNnJc4_tbNzapIEWWkPOgF2sZHwbOmr_LyuvVpa5WJdL6tV7guqPp8iQ72qJh2LltWncDfIAqcctPkFuuOi_hk2zhK7CRD13RKtwkMHkpn5jGb5nA1mfOfZ9xfENvl4niUkZKyan1kRJk7okAYRTooBdsq-A9bTqevigpjL42p7X2_vIaqLMv18diaiRcKjiHwcWXHJd4HDBdAahxcb4pRgpF69EoNmlDCzgapGE9QOXgYpUHsVA90tA5QJHndH2g739xCbweb8Q","embed":"https://t.me/Alibk3/37041?embed=1&mode=tme","duration":3,"w":624,"h":420},
    },
  ].map((r, i) => feedCardHtml(r, i)).join('');
}

function renderFeed(d) {
  const all = sortedReports(d);
  const slice = all.slice(0, reportsShown);
  const fc = document.getElementById('feed-count');
  if (fc) fc.textContent = `${Math.min(reportsShown, all.length)} / ${all.length}`;
  // Refresh the pin index BEFORE the cards are built: `feedCardHtml` decides
  // whether to offer "Show on map" from `mappableByFp`, so a stale index means
  // a report that is on the map renders without the button.
  if (data && window.L) { try { buildMapPins(data); } catch (e) {} }
  document.getElementById('feed').innerHTML = mediaTestCards() + slice.map((r, i) => feedCardHtml(r, i)).join('');
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
  const cards = [...feed.querySelectorAll('.card')];
  const have = new Set(cards.map((el) => el.dataset.fp));
  const all = sortedReports(d);
  // Everything the column is showing, not just what sits above the top card.
  // A report can arrive late and still belong further down: the feed is ordered
  // by each report's own timestamp and the scanner accepts posts up to 72 hours
  // old, so stopping at the first familiar card dropped every back-dated
  // arrival out of the feed until the next full render.
  const visible = all.slice(0, Math.max(reportsShown, cards.length));
  const newcomers = [];
  visible.forEach((r, i) => {
    if (!have.has(r.fp || r.url)) newcomers.push({ r, i });
  });
  if (!newcomers.length) return;
  // Past a handful, a clean rebuild is cheaper than splicing them in one by one.
  if (newcomers.length > 12) { renderFeed(d); return; }
  // The reports that just landed are not in the pin index yet, and the index is
  // what decides whether a card offers "Show on map". Without this, a fresh
  // report sits in the feed with no way to reach its own pin until the next
  // full render — which is why cards kept turning up "not on the map".
  if (window.L) { try { buildMapPins(d); } catch (e) {} }
  const posOf = new Map(visible.map((r, i) => [r.fp || r.url, i]));
  for (const { r, i } of newcomers) {
    const holder = document.createElement('div');
    holder.innerHTML = feedCardHtml(r, i);
    const card = holder.firstElementChild;
    if (!card) continue;
    // Insert it before the first card already on screen that sorts after it,
    // so a back-dated report lands in its right place instead of at the top.
    const after = [...feed.querySelectorAll('.card')].find((c) => {
      const pos = posOf.get(c.dataset.fp);
      return pos !== undefined && pos > i;
    });
    if (after) feed.insertBefore(card, after);
    else feed.appendChild(card);
    wireFeedCard(card);
  }
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

/** The governorates a front covers, for its locator map. */
/** Ray-casting point-in-ring test. `ring` is a GeoJSON [lng,lat] point list. */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Point-in-polygon for a GeoJSON Polygon/MultiPolygon geometry (holes excluded). */
function pointInGeometry(x, y, geom) {
  if (!geom) return false;
  const inPoly = (poly) => {
    if (!pointInRing(x, y, poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (pointInRing(x, y, poly[k])) return false;
    return true;
  };
  if (geom.type === 'Polygon') return inPoly(geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some(inPoly);
  return false;
}

/** Which governorate a [lat,lng] spot falls inside, by scanning the loaded admin polygons. */
function governorateIdAtSpot(spot, features) {
  if (!Array.isArray(spot) || spot.length !== 2 || !Array.isArray(features)) return null;
  const [lat, lng] = spot;
  for (const f of features) {
    if (pointInGeometry(lng, lat, f.geometry)) return f.properties.shapeISO;
  }
  return null;
}

/**
 * Which governorates a front belongs to. Curated fronts carry `mapFocus.ids`;
 * dynamically-opened ones (new-fronts.ts) never do, so fall back to a name
 * match and, failing that, to locating the front's own spot in the loaded
 * governorate polygons (`features`, when the caller has them to hand).
 */
function frontMiniIds(front, features) {
  const locator = (front && front.mapFocus) || {};
  const ids = new Set(locator.ids || []);
  const name = (front && front.name) || '';
  if (!ids.size) {
    if (/Wazi'iyah|western Taiz|Mocha|Dhubab|coast/i.test(name)) ids.add('YE-TA');
    else if (/Marib/i.test(name)) ids.add('YE-MA');
    else if (/Dhale/i.test(name)) ids.add('YE-DA');
    else if (/Jawf|Hazm/i.test(name)) ids.add('YE-JA');
    else if (/Bab al-Mandab|Mayun|Hanish/i.test(name)) { ids.add('YE-LA'); ids.add('YE-MY'); ids.add('YE-HN'); }
  }
  if (!ids.size && locator.spot) {
    const iso = governorateIdAtSpot(locator.spot, features);
    if (iso) ids.add(iso);
  }
  return ids;
}

/**
 * Front-map governorate styling: the front's own governorates at full,
 * strong control colour under a thick yellow border; the rest at a fixed,
 * still-readable lower opacity — independent of the main map's hover/"Show
 * on map" highlight state (`highlightIds`), which `styleFeature` uses and
 * which would otherwise bleed stale fades into this map between hovers.
 */
function frontFeatureStyle(feature, byIso, ids) {
  const iso = feature.properties.shapeISO;
  const g = byIso[iso] || {};
  const ctrl = (g.control === 'mixed') ? 'contested' : g.control;
  const c = COLORS[ctrl] || COLORS.contested || '#334155';
  const on = controlVisible(ctrl);
  const lit = ids.has(iso);
  // Districts carry the colours; the governorates outside the front are dimmed.
  if (districtGeo) {
    return { fillColor: '#0b0f14', fillOpacity: lit ? 0 : 0.35, color: lit ? '#fde047' : '#0b0f14', weight: lit ? 3.5 : 1.2, opacity: 1 };
  }
  return {
    fillColor: c,
    fillOpacity: on ? (lit ? 0.88 : 0.55) : 0,
    color: lit ? '#fde047' : '#0b0f14',
    weight: lit ? 3.5 : 1.2,
    opacity: on ? 1 : 0.2,
  };
}

/**
 * The front's map: the same map as a report's pop-up (control colours,
 * governorate and Saudi city names), no pins, framed on the front with Yemen
 * around it. The front's governorates keep their full colour under a thick
 * yellow border; the rest fade, still readable as control areas.
 */
async function buildFrontMap(m, front, d) {
  if (!geoCache) geoCache = await fetch('/yemen-adm1.geojson').then((r) => r.json()).catch(() => null);
  await loadDistricts();
  if (sheetMap !== m || !geoCache) return;
  const byIso = controlByIso(d);
  const lit = L.latLngBounds([]);
  const mainland = splitIslandFeatures(geoCache).mainland;
  const ids = frontMiniIds(front, mainland.features);
  districtLayer(m, byIso);
  const layer = L.geoJSON(mainland, {
    interactive: false,
    style: (f) => frontFeatureStyle(f, byIso, ids),
    onEachFeature: (f, l) => { if (ids.has(f.properties.shapeISO)) lit.extend(l.getBounds()); },
  }).addTo(m);
  layer.eachLayer((l) => { if (ids.has(l.feature.properties.shapeISO)) l.bringToFront(); });
  govNameLayer(m, mainland.features, byIso);
  saudiCityLayer(m);
  // A front opened from several clusters in one governorate has a spot for each.
  for (const spot of frontSpots(front.mapFocus)) {
    const r = (front.mapFocus.spotRadius || 15000) * 1.6;
    L.circle(spot, { radius: r, color: '#fde047', weight: 3, fillColor: '#fde047', fillOpacity: 0.25, interactive: false }).addTo(m);
    lit.extend(L.latLng(spot).toBounds(r * 2));
  }
  const frame = () => {
    if (sheetMap !== m) return;
    try { m.invalidateSize(); } catch (e) {}
    if (lit.isValid()) m.fitBounds(lit, { padding: [40, 40], maxZoom: 7, animate: false });
    else m.setView(FRONT_HOME_VIEW.slice(0, 2), FRONT_HOME_VIEW[2], { animate: false });
  };
  frame();
  setTimeout(frame, 80);
}

function hideFrontFloat() {
  closePinSheet();
  frontFloatIdx = null;
  frontFloatAnchor = null;
  document.querySelectorAll('.front-map-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
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

/** A front's spots: several for a front opened from clusters in one governorate, else its one spot. */
function frontSpots(loc) {
  const ok = (s) => Array.isArray(s) && s.length >= 2 && Number.isFinite(+s[0]) && Number.isFinite(+s[1]);
  if (loc && Array.isArray(loc.spots) && loc.spots.some(ok)) return loc.spots.filter(ok);
  return loc && ok(loc.spot) ? [loc.spot] : [];
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
    if (frontSpotLayer && map) {
      try { map.removeLayer(frontSpotLayer); } catch (e) {}
      frontSpotLayer = null;
    }
    const spots = frontSpots(loc);
    if (spots.length && window.L) {
      frontSpotLayer = L.featureGroup(spots.map((s) => L.circle([s[0], s[1]], {
        radius: loc.spotRadius || 9000,
        color: '#f8fafc',
        weight: 2.4,
        fillColor: '#fbbf24',
        fillOpacity: 0.28,
        className: 'front-spot',
        interactive: false,
      }))).addTo(map);
    }
    if ((highlightIds.has('YE-MY') || highlightIds.has('YE-HN')) && window.L) {
      placeStraitOverlay();
      placeIslandTags(data);
    }
  };

  applyView();
  setHighlightChip(front);
  scrollToMap();
  // One move, once the page has scrolled and the map has its size: straight
  // onto the front, with the legend's side kept as padding.
  setTimeout(() => {
    if (!map) return;
    try { map.invalidateSize(); } catch (e) {}
    const b = frontBounds();
    try {
      if (b) map.flyToBounds(b, { ...legendPadding(), maxZoom: 8, duration: 0.8 });
      else map.flyTo(FRONT_HOME_VIEW.slice(0, 2), FRONT_HOME_VIEW[2], { duration: 0.8 });
    } catch (e) {}
  }, 380);
  if (highlightTimer) clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => {
    highlightPulse = false;
    applyMapFilters();
  }, 8000);
}

function showFrontFloat(idx, anchor, d) {
  const f = allFronts(d)[idx];
  if (!f) return;
  document.querySelectorAll('.front-map-btn').forEach((b, i) => b.setAttribute('aria-expanded', i === idx ? 'true' : 'false'));
  openMapPop({
    title: f.name,
    anchor,
    build: (m) => buildFrontMap(m, f, d),
    go: () => {
      keepHighlightUntil = Date.now() + 2200;
      hideFrontFloat();
      scrollToMap();
      highlightFrontOnMap(f);
      try { requestAnimationFrame(scrollToMap); } catch (e) {}
      setTimeout(scrollToMap, 80);
      setTimeout(scrollToMap, 360);
    },
  });
  frontFloatIdx = idx;
}

/**
 * The tracked fronts, then any the brief opened for a new cluster of fighting
 * (src/lib/desk/new-fronts.ts), which carry only a map spot.
 */
function allFronts(d) {
  const base = [...(d.fronts || [])].sort((a, b) => (a.importance || 99) - (b.importance || 99));
  const opened = ((brief && brief.fronts) || [])
    .filter((f) => f.extra && Array.isArray(f.spot) && !base.some((b) => b.id === f.id))
    .map((f) => ({ id: f.id, name: f.name, where: f.where || '', importance: 50, mapFocus: { ids: [], spot: f.spot, spots: Array.isArray(f.spots) ? f.spots : undefined, spotRadius: 15000 } }));
  return [...base, ...opened];
}

/*
 * One front at a time, in the shared pager (dots under the box, arrows inside
 * it on a wide screen, a swipe on a phone). Every load opens on Bab al-Mandab.
 */
let frontIdx = null;

function renderFronts(d) {
  const fronts = allFronts(d);
  const stamp = document.getElementById('fronts-stamp');
  if (stamp) stamp.innerHTML = cadenceStamp(true);
  if (frontIdx == null || frontIdx >= fronts.length) frontIdx = Math.max(0, fronts.findIndex((f) => f.id === 'bab' || /Bab al-Mandab/i.test(f.name || '')));
  const pins = pinsForProse();
  const cards = fronts.map((f, i) => {
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
      ${f.where ? `<p class="front-where">${linkPlaces(f.where, pins)}</p>` : ''}
      ${plain ? `<p class="front-plain">${linkPlaces(plain, pins)}</p>` : ''}
      ${showSum ? `<p class="front-sum">${linkPlaces(sum, pins)}</p>` : ''}
      ${showDir ? `<p class="front-dir">${linkPlaces(dir, pins)}</p>` : ''}
      ${composed ? `<p class="front-composed">${linkPlaces(composed, pins)}</p>` : ''}
      ${!composed && act ? `<p class="front-activity">${linkPlaces(act.line, pins)}</p>` : ''}
      ${composed ? '' : `<div class="srcs">Source: ${sourceAnchors(f.sources || [], '')}</div>`}
      ${showDetail ? `<div class="full">${linkPlaces(detail, pins)}</div>
      <button type="button" class="toggle-front">Read more</button>` : ''}
    </article>`;
  });
  const box = document.getElementById('fronts');
  box.classList.add('one-front');
  box.innerHTML = pagerHtml('fronts', cards, frontIdx, fronts.map((f) => f.name));
  wireProsePins(box);
  wirePager(box, frontIdx, (i) => {
    frontIdx = i;
    closeReadMore(box, '.front-card', '.toggle-front');
  });

  document.querySelectorAll('.toggle-front').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.front-card');
      const open = card.classList.toggle('open');
      btn.textContent = open ? 'Hide' : 'Read more';
    };
  });
  const canHover = () => window.matchMedia('(hover: hover)').matches && window.innerWidth >= 720;
  document.querySelectorAll('.front-map-btn').forEach((btn) => {
    const idx = parseInt(btn.dataset.i, 10);
    btn.onmouseenter = () => {
      if (!canHover()) return;
      clearTimeout(pinPopTimer);
      pinPopTimer = setTimeout(() => showFrontFloat(idx, btn, d), 250);
    };
    btn.onmouseleave = () => {
      clearTimeout(pinPopTimer);
      const el = document.getElementById('pin-sheet');
      if (el && el.classList.contains('as-pop')) pinPopTimer = setTimeout(hideFrontFloat, 300);
    };
    btn.onclick = (ev) => {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      clearTimeout(pinPopTimer);
      showFrontFloat(idx, canHover() ? btn : null, d);
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

/*
 * Control district by district. public/control.json sets the districts whose
 * control differs from, or splits, their governorate (Mocha and Dhubab are
 * Houthi while Taiz city is not; Kahbub is fought over); every other district
 * takes its governorate's. The districts are shaded, and the governorates are
 * drawn over them as outlines, so a governorate held in part reads as such.
 */
let districtGeo = null;
let districtControl = null;
let districtLayerMain = null;

async function loadDistricts() {
  if (districtGeo && districtControl) return true;
  try {
    const [g, c] = await Promise.all([
      fetch('/yemen-adm2.geojson').then((r) => (r.ok ? r.json() : null)),
      fetch('/control.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (g && c && Array.isArray(g.features)) { districtGeo = g; districtControl = c; }
  } catch (e) {}
  return !!(districtGeo && districtControl);
}

/**
 * A district's own control: the 12-hour clock's live layer (/api/brief
 * "controlLive", from the capture reports) over the hand baseline. A past day
 * on the control slider shows the baseline only.
 */
function districtOwn(p) {
  const live = !activeControlYmd && brief && brief.controlLive && brief.controlLive.districts ? brief.controlLive.districts[p.id] : null;
  if (live) return live;
  return (districtControl && districtControl.districts && districtControl.districts[p.id]) || null;
}

/** The outlets behind a change the 12-hour clock made, as links. */
function liveSrcHtml(own) {
  const src = own && Array.isArray(own.src) ? own.src.filter((x) => x && typeof x === 'object' && x.outlet) : [];
  if (!src.length) return '';
  const links = src.map((x) => (x.url ? `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.outlet)}</a>` : escapeHtml(x.outlet)));
  return `<br/><small>Reported by ${links.join(', ')}</small>`;
}

function districtSide(p, byIso) {
  const own = districtOwn(p);
  const s = (own && own.side) || (byIso[p.gov] || {}).control;
  return s === 'mixed' ? 'contested' : s;
}

function districtStyle(f, byIso) {
  const ctrl = districtSide(f.properties, byIso);
  const on = controlVisible(ctrl);
  return { fillColor: COLORS[ctrl] || COLORS.contested, fillOpacity: on ? 0.55 : 0, color: '#0b0f14', weight: 0.35, opacity: on ? 0.45 : 0.1 };
}

/** The district layer on a map, beneath the governorate outlines; null before it has loaded. */
function districtLayer(m, byIso) {
  if (!districtGeo || !window.L) return null;
  return L.geoJSON(districtGeo, { style: (f) => districtStyle(f, byIso), interactive: false }).addTo(m);
}

function districtAt(lat, lng) {
  if (!districtGeo) return null;
  for (const f of districtGeo.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (polys.some((p) => pointInRing(lng, lat, p[0]))) return f.properties;
  }
  return null;
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
  // Districts carry the colours; the governorate is its outline, and a lit one
  // a pale wash over its districts.
  if (districtGeo) {
    return {
      fillColor: '#f8fafc',
      fillOpacity: hl ? 0.18 : 0,
      color: hl ? '#f8fafc' : '#0b0f14',
      weight: hl ? 2.6 : 1.3,
      opacity: 0.9,
      className: hl && highlightPulse ? 'gov-hl-pulse' : (hl ? 'gov-hl' : ''),
    };
  }
  return {
    fillColor: c,
    // Highlighting one governorate used to fade every other one to 0.22, which
    // left the whole map looking washed out until the highlight was cleared.
    // The highlight reads perfectly well from its brighter fill, white border
    // and pulse — the rest of the map keeps its real control colours.
    fillOpacity: on ? (hl ? 0.88 : 0.55) : 0,
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
  const govHtml = `<strong>${escapeHtml(name)}</strong>${arLine}<br/>
    Control: ${escapeHtml(LABELS[g.control] || g.control)}<br/><small>${escapeHtml(g.note || '')}</small>`;
  // The district under the click, with its own control and why.
  layer.on('click', (e) => {
    const dct = districtAt(e.latlng.lat, e.latlng.lng);
    const own = dct && districtOwn(dct);
    const side = dct && districtSide(dct, byIso);
    const dHtml = dct
      ? `<hr style="margin:.35rem 0;border:0;border-top:1px solid #334155"/><strong>${escapeHtml(dct.name)} district</strong><br/>Control: ${escapeHtml(LABELS[side] || side)}${own && own.since ? ` · since ${escapeHtml(fmtDay(own.since))}` : ''}${own && own.note ? `<br/><small>${escapeHtml(own.note)}</small>` : ''}${liveSrcHtml(own)}`
      : '';
    L.popup().setLatLng(e.latlng).setContent(govHtml + dHtml).openOn(layer._map || map);
  });
}

function clearEvents() {
  eventLayers.forEach((l) => map.removeLayer(l));
  eventLayers = [];
  markerByFp = new Map();
}

/*
 * "Show on map" from a feed card opens the small map of that day's pins: beside
 * the button on a wide screen (the same pop-up hovering opens), a sheet on a
 * phone. Only the pop-up's own "Show on the main map" moves the big map.
 */
let mappableByFp = new Map();
let markerByFp = new Map();
let sheetMap = null;

function showReportOnMap(fp, anchor) {
  const pin = mappableByFp.get(fp);
  if (!pin || !map) return;
  clearTimeout(pinPopTimer);
  if (window.innerWidth < 720) return openPinSheet(pin);
  // Hovering may already have opened it beside this button: leave it be.
  const el = document.getElementById('pin-sheet');
  if (el && el.classList.contains('show') && frontFloatAnchor === anchor) return;
  openPinSheet(pin, anchor);
}

function pulsePin(el) {
  const ev = el && el.querySelector('.ev');
  if (!ev) return;
  ev.classList.remove('pin-pulse');
  void ev.offsetWidth;
  ev.classList.add('pin-pulse');
  setTimeout(() => ev.classList.remove('pin-pulse'), 5200);
}

/** A link only makes the pin jump; the reader opens its report by clicking it. */
function goToPinOnMainMap(pin, { note = false } = {}) {
  if (highlightIds.size) clearMapHighlight({});
  const ymd = jerusalemYmd(pin.at);
  if (mapMode !== 'day' || effectiveMapDate() !== ymd) {
    enterDayMode(ymd);
    const dateInp = document.getElementById('map-date');
    if (dateInp) dateInp.value = mapDate;
    document.querySelectorAll('#time-filter button').forEach((b) => b.classList.remove('on'));
    if (ymd === todayYmd()) { const t = document.getElementById('btn-day-today'); if (t) t.classList.add('on'); }
    syncDayNav();
  }
  if (!layersOn[pin.mapCat]) layersOn[pin.mapCat] = true;
  applyMapFilters();
  scrollToMap();
  setTimeout(() => {
    if (!map) return;
    try { map.invalidateSize(); } catch (e) {}
    // A pin the day's map folded into another at its spot (or capped out) has
    // no marker of its own: draw it, so the link lands on its own report.
    let m = markerByFp.get(pin.fp);
    if (!m) {
      const cat = pin.mapCat || classifyForMap(pin.text || pin.label || '', (pin.type || '').toLowerCase()) || pinCategory((pin.type || '').toLowerCase());
      if (!layersOn[cat]) layersOn[cat] = true;
      paintedPinKeys.delete(pinPaintKey({ ...pin, mapCat: cat }));
      placeMapPin({ ...pin, mapCat: cat });
      m = markerByFp.get(pin.fp);
    }
    const ll = m ? m.getLatLng() : L.latLng(pin.lat, pin.lng);
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      if (m) { if (note) { try { m.openPopup(); } catch (e) {} } pulsePin(m.getElement()); }
    };
    map.once('moveend', land);
    setTimeout(land, 1200);
    try {
      map.flyToBounds(L.latLngBounds(ll, ll), { ...legendPadding(), maxZoom: Math.max(map.getZoom(), 8), duration: 0.8 });
    } catch (e) {}
  }, 380);
}

function closePinSheet() {
  const el = document.getElementById('pin-sheet');
  if (el) el.classList.remove('show');
  if (sheetMap) { try { sheetMap.remove(); } catch (e) {} sheetMap = null; }
}

/**
 * The map pop-up shared by a report's "Show on map" and a front's "Map": beside
 * the button on desktop, a sheet on a phone (no anchor). `build(m)` draws the
 * map and frames it; `go` is the blue "Show on the main map".
 */
function openMapPop({ title, anchor, build, go }) {
  let el = document.getElementById('pin-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pin-sheet';
    el.className = 'pin-sheet';
    document.body.appendChild(el);
  }
  closePinSheet();
  el.innerHTML = `<div class="pin-sheet-box" role="dialog" aria-label="Map">
      <div class="pin-sheet-head"><p class="front-float-title">${escapeHtml(title || '')}</p>
      <button type="button" class="pin-sheet-x" aria-label="Close">×</button></div>
      <div id="pin-sheet-map"></div>
      ${popLegendHtml()}
      <button type="button" class="front-float-go">Show on the main map</button>
    </div>`;
  el.classList.toggle('as-pop', !!anchor);
  el.classList.add('show');
  if (anchor) placePinPop(el.firstElementChild, anchor);
  frontFloatAnchor = anchor || null;
  frontFloatOpenedAt = Date.now();
  sheetMap = L.map('pin-sheet-map', { zoomControl: true, attributionControl: false, zoomSnap: 0.5 }).setView(FRONT_HOME_VIEW.slice(0, 2), FRONT_HOME_VIEW[2]);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(sheetMap);
  build(sheetMap);
  setTimeout(() => { try { sheetMap && sheetMap.invalidateSize(); } catch (e) {} }, 60);
  el.querySelector('.pin-sheet-x').onclick = closePinSheet;
  el.onclick = (ev) => { if (ev.target === el) closePinSheet(); };
  el.querySelector('.front-float-go').onclick = (ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    closePinSheet();
    go();
  };
  const box = el.firstElementChild;
  box.onmouseenter = () => { clearTimeout(pinPopTimer); };
  box.onmouseleave = () => { if (el.classList.contains('as-pop')) pinPopTimer = setTimeout(hideFrontFloat, 250); };
}

function openPinSheet(pin, anchor) {
  openMapPop({
    title: pin.label,
    anchor,
    go: () => goToPinOnMainMap(pin),
    build: (m) => {
      m.setView([pin.lat, pin.lng], 6.5);
      if (geoCache) {
        const byIso = controlByIso(data);
        const mainland = splitIslandFeatures(geoCache).mainland;
        districtLayer(m, byIso);
        L.geoJSON(mainland, { style: (f) => styleFeature(f, byIso), interactive: false }).addTo(m);
        govNameLayer(m, mainland.features, byIso);
        saudiCityLayer(m);
      }
      const ymd = jerusalemYmd(pin.at);
      [...mappableByFp.values()].filter((p) => jerusalemYmd(p.at) === ymd && layersOn[p.mapCat] !== false).forEach((p) => {
        const me = p.fp === pin.fp;
        const icon = L.divIcon({ className: 'ev-wrap', html: eventIconHtml(p.mapCat, me ? ' pin-pulse' : '', escapeHtml(p.label || '')), iconSize: [34, 42], iconAnchor: [17, 40] });
        L.marker([p.lat, p.lng], { icon, zIndexOffset: me ? 2000 : 0 }).bindPopup(popupHtml(p), { maxWidth: 260 }).addTo(m);
      });
    },
  });
}

/** On desktop the sheet floats beside the card's button, like the fronts' map. */
let pinPopTimer = null;
function placePinPop(box, anchor) {
  const r = anchor.getBoundingClientRect();
  const w = Math.min(420, window.innerWidth - 16);
  const h = 400;
  let left = r.right + 8;
  if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 8);
  let top = r.top - 20;
  if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${w}px`;
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
    const cat = pin.mapCat || classifyForMap(pin.classText || pin.text || pin.label || '', pin.type);
    if (!cat || cat === 'statement') return;
    if (COUNTRY_PLACE_RE.test(String(pin.place || '').trim())) return;
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
    const fix = MAP_FIXES[r.fp] || null;
    if (fix && fix.remove) return;
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
    if (fix && typeof fix.lat === 'number') { lat = fix.lat; lng = fix.lng; place = fix.place || place; }
    const label = (r.summary && !isWeakHeadline(r.summary)) ? r.summary : headlineFrom(blob);
    if (isWeakHeadline(label)) return;
    const cat = (fix && fix.cat) || classifyForMap(blob, r.type);
    if (!cat || cat === 'statement') return;
    if (r.live && !['strike', 'combat', 'vessel', 'port'].includes(cat)) return;
    if (!allowCoordsForCategory(cat, place, lat, lng)) return;
    push({
      fp: r.fp || blob.slice(0, 80),
      at: reportTime(r),
      type: fix && fix.cat ? (fix.cat === 'strike' ? 'strike' : fix.cat) : inferType(blob, r.type || cat),
      mapCat: fix && fix.cat ? fix.cat : undefined,
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
    if (MAP_FIXES[ev.fp] && MAP_FIXES[ev.fp].remove) return;
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
      // Headline and body together: the attack is often named only in the headline.
      classText: [rawLabel, blob].filter(Boolean).join('\n'),
    });
  });

  const day = effectiveMapDate();
  const today = todayYmd();
  const from = mapDateFrom || CONFLICT_START;
  const to = mapDateTo || today;
  // Every report that has a place on the map, on any day: the feed's "Show on map".
  mappableByFp = byFp;
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
  const catLabel = cat === 'strike'
    ? strikeKind(`${ev.label || ''} ${ev.text || ''}`)
    : (CATEGORY_LABEL[cat] || CATEGORY_LABEL.combat);
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
  // Several notes stay open side by side; each closes with its ×, its pin, or
  // "Close all" (a click on the note itself expands it).
  m.addTo(map);
  if (ev.fp) markerByFp.set(ev.fp, m);
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
    syncOpenNotes();
    const root = e.popup.getElement();
    if (!root) return;
    setTimeout(() => panClearOfLegend(boxInMap(root)), 30);
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
  map.on('popupclose', () => setTimeout(syncOpenNotes, 0));
}

/** The notes open on the map now. */
function openNotes() {
  const out = [];
  // A pin's note is bound to its pin; a district's note stands on its own.
  if (map) map.eachLayer((l) => {
    if (l.getPopup && l.isPopupOpen && l.isPopupOpen()) out.push(l);
    else if (l instanceof L.Popup && l._source == null) out.push(l);
  });
  return out;
}

function closeNote(l) {
  if (l instanceof L.Popup) map.closePopup(l);
  else l.closePopup();
}

/** Keeps the map's state in step with its open notes: the class, and "Close all (N)" when 2+. */
function syncOpenNotes() {
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;
  const n = openNotes().length;
  wrap.classList.toggle('popup-open', n > 0);
  let btn = document.getElementById('close-notes');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'close-notes';
    btn.className = 'close-notes';
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openNotes().forEach(closeNote);
      syncOpenNotes();
    };
    wrap.appendChild(btn);
  }
  btn.textContent = `Close all (${n})`;
  btn.hidden = n < 2;
}

/** An element's box in map-container pixels. */
function boxInMap(el) {
  const mc = map && map.getContainer();
  if (!el || !mc) return null;
  const a = el.getBoundingClientRect();
  const b = mc.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, right: a.right - b.left, bottom: a.bottom - b.top };
}

/**
 * Pans the least that takes `box` (map-container pixels) off the legend in the
 * bottom-left corner: right past it, or up above it, whichever is shorter.
 */
function panClearOfLegend(box, animate = true) {
  const lg = document.getElementById('legend');
  if (!map || !box || !lg || !lg.offsetWidth || getComputedStyle(lg).display === 'none') return;
  const l = boxInMap(lg);
  const gap = 8;
  // A box hanging off the left or top edge comes inside first.
  const inX = Math.max(0, gap - box.left);
  const inY = Math.max(0, gap - box.top);
  const b = { left: box.left + inX, right: box.right + inX, top: box.top + inY, bottom: box.bottom + inY };
  let dx = inX;
  let dy = inY;
  if (!(b.right <= l.left || b.left >= l.right || b.bottom <= l.top || b.top >= l.bottom)) {
    const right = l.right + gap - b.left;
    const up = b.bottom - (l.top - gap);
    const room = map.getSize();
    // Moving right must not push the box off the far edge; up must not push it off the top.
    const canRight = b.right + right <= room.x;
    const canUp = b.top - up >= 0;
    if (canRight && (!canUp || right <= up)) dx += right;
    else if (canUp) dy -= up;
    else dx += right;
  }
  if (dx || dy) map.panBy([-dx, -dy], { animate });
}

/** The highlighted front's areas and spot, as map bounds. */
function frontBounds() {
  if (!map || !window.L) return null;
  const b = L.latLngBounds([]);
  if (geoLayer) geoLayer.eachLayer((l) => { if (l.feature && highlightIds.has(l.feature.properties.shapeISO)) b.extend(l.getBounds()); });
  if (frontSpotLayer && frontSpotLayer.getBounds) b.extend(frontSpotLayer.getBounds());
  return b.isValid() ? b : null;
}

/**
 * fitBounds padding that keeps a target off the legend: the legend's width on
 * its side, or its height, whichever costs the map less room.
 */
function legendPadding() {
  const gap = 16;
  const pad = { paddingTopLeft: [gap, gap], paddingBottomRight: [gap, gap] };
  const lg = document.getElementById('legend');
  if (!map || !lg || !lg.offsetWidth || getComputedStyle(lg).display === 'none') return pad;
  const l = boxInMap(lg);
  const s = map.getSize();
  const onLeft = l.left < s.x / 2;
  const onTop = l.top < s.y / 2;
  const w = (onLeft ? l.right : s.x - l.left) + gap;
  const h = (onTop ? l.bottom : s.y - l.top) + gap;
  if (w / s.x <= h / s.y) {
    if (onLeft) pad.paddingTopLeft[0] = w; else pad.paddingBottomRight[0] = w;
  } else if (onTop) pad.paddingTopLeft[1] = h; else pad.paddingBottomRight[1] = h;
  return pad;
}

/** The highlighted front (its areas and spot) in map-container pixels. */
function frontBoxInMap() {
  const b = frontBounds();
  if (!b) return null;
  const nw = map.latLngToContainerPoint(b.getNorthWest());
  const se = map.latLngToContainerPoint(b.getSouthEast());
  return { left: nw.x, top: nw.y, right: se.x, bottom: se.y };
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

/** Where a governorate's name sits: the centroid of its largest polygon. */
function featureLabelPoint(f) {
  const g = f && f.geometry;
  if (!g) return null;
  const polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
  let best = null;
  let bestA = 0;
  for (const poly of polys) {
    const ring = poly[0] || [];
    let ar = 0; let cx = 0; let cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const k = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      ar += k; cx += (ring[j][0] + ring[i][0]) * k; cy += (ring[j][1] + ring[i][1]) * k;
    }
    if (Math.abs(ar) > bestA) { bestA = Math.abs(ar); best = [cy / (3 * ar), cx / (3 * ar)]; }
  }
  return best;
}

/**
 * The governorate names, drawn by the desk above the control colours: the
 * tiles' own names sit under the fill and can barely be read.
 */
/* ---------------------------------------------------------------- *
 * Map labels: one shared collision pass
 *
 * Every name the desk draws on a map — governorate names and Saudi city names
 * — is placed at a point and sized by its own text, so at some zooms they sit
 * on top of each other and the map turns heavy to read. Zoom thresholds alone
 * cannot fix that: two labels can be far apart in degrees and still touch on
 * screen. So each layer registers its labels with a priority, and one greedy
 * pass over the rendered boxes hides the lower-priority label of any
 * overlapping pair. Governorate names outrank city names; among the cities the
 * tiers rank themselves.
 * ---------------------------------------------------------------- */

const mapLabels = new WeakMap();

function registerLabels(m, group, entries) {
  const kept = (mapLabels.get(m) || []).filter((e) => e.group !== group);
  mapLabels.set(m, [...kept, ...entries].sort((a, b) => a.prio - b.prio));
  if (!m._deskLabelPass) {
    // Deferred by a frame on purpose. A zoom also flips `names-small` and the
    // Saudi tier classes from their own handlers, and those decide how big a
    // label is and whether it is drawn at all; measuring in the same tick
    // measures the previous zoom's type. The flag coalesces a burst of view
    // events into one pass.
    m._deskLabelPass = () => {
      if (m._deskLabelQueued) return;
      m._deskLabelQueued = true;
      requestAnimationFrame(() => { m._deskLabelQueued = false; declutterLabels(m); });
    };
    m.on('zoomend moveend viewreset resize', m._deskLabelPass);
  }
  m._deskLabelPass();
}

/**
 * Hide every label whose box overlaps one already placed.
 *
 * What is measured is the text itself, not the marker. A `divIcon` with
 * `iconSize: null` has no size of its own: the Saudi markers, whose text is
 * absolutely positioned, measured 0x0 and so were never checked against
 * anything, and the governorate markers measured a box sitting at the anchor
 * point while the name is actually drawn half its width left and half its
 * height up from there. Measuring the span is the only way the boxes match
 * what the reader sees.
 */
function declutterLabels(m) {
  const all = mapLabels.get(m);
  if (!all || !all.length) return;
  try {
    const z = m.getZoom();
    const boxes = [];
    for (const e of all) {
      const root = e.marker.getElement();
      const el = root && (root.querySelector('span') || root);
      if (!el) continue;
      // Clear first: a label hidden at the last zoom may fit at this one, and
      // a hidden element measures as a zero-sized box.
      el.classList.remove('lbl-collide');
      if (e.visible && !e.visible(z)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Wider than a hairline: every label carries a white halo, so two boxes
      // that merely touch already read as one smudge.
      const pad = 3;
      const hit = boxes.some((b) => r.left < b.right + pad && r.right > b.left - pad
        && r.top < b.bottom + pad && r.bottom > b.top - pad);
      if (hit) el.classList.add('lbl-collide');
      else boxes.push(r);
    }
  } catch (e) {}
}

function govNameLayer(m, features, byIso) {
  if (!m.getPane('govNames')) {
    m.createPane('govNames');
    m.getPane('govNames').style.zIndex = 460;
    m.getPane('govNames').style.pointerEvents = 'none';
  }
  const group = L.layerGroup();
  const entries = [];
  (features || []).forEach((f) => {
    const iso = f.properties && f.properties.shapeISO;
    const g = byIso[iso] || {};
    const name = String(g.name || (f.properties && f.properties.shapeName) || '').trim();
    const pt = featureLabelPoint(f);
    if (!name || !pt) return;
    const marker = L.marker(pt, {
      pane: 'govNames', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'gov-name', html: `<span>${escapeHtml(name)}</span>`, iconSize: null }),
    }).addTo(group);
    entries.push({ group: 'gov', prio: 0, marker });
  });
  group.addTo(m);
  const sync = () => { try { m.getContainer().classList.toggle('names-small', m.getZoom() < 6.5); } catch (e) {} };
  m.on('zoomend', sync);
  sync();
  registerLabels(m, 'gov', entries);
  return group;
}

/**
 * Saudi cities: the big ones always, and the border towns and targets the
 * Houthis have struck as the map zooms in (tier 2 from zoom 6, tier 3 from 7.5,
 * where close neighbours no longer collide).
 */
const SAUDI_CITIES = [
  ['Riyadh', 24.713, 46.675, 1], ['Jeddah', 21.543, 39.173, 1], ['Mecca', 21.389, 39.858, 1],
  ['Medina', 24.467, 39.611, 1], ['Dammam', 26.434, 50.103, 1], ['Taif', 21.27, 40.415, 1], ['Yanbu', 24.089, 38.064, 1],
  ['Najran', 17.565, 44.228, 2], ['Jizan', 16.889, 42.551, 2], ['Abha', 18.216, 42.505, 2],
  ['Khamis Mushait', 18.3, 42.729, 2], ['Sharurah', 17.466, 47.106, 2], ['Dhahran al-Janub', 17.667, 43.505, 2],
  ['Sabya', 17.15, 42.626, 3], ['Samtah', 16.596, 42.944, 3], ['Ahad al-Masarihah', 16.708, 42.955, 3],
  ['al-Tuwal', 16.525, 42.99, 3], ['Abqaiq', 25.937, 49.668, 3], ['Ras Tanura', 26.643, 50.159, 3],
];

function saudiCityLayer(m) {
  if (!m.getPane('govNames')) {
    m.createPane('govNames');
    m.getPane('govNames').style.zIndex = 460;
    m.getPane('govNames').style.pointerEvents = 'none';
  }
  const group = L.layerGroup();
  // SAUDI_CITIES is already tier-ordered (1, then 2, then 3) — that order is
  // also the collision priority: a lower tier never yields to a higher one.
  // They all rank below the governorate names, which is what `prio` encodes.
  const entries = SAUDI_CITIES.map(([name, lat, lng, tier]) => ({
    group: 'saudi',
    prio: tier,
    visible: (z) => !(tier === 2 && z < 6) && !(tier === 3 && z < 7.5),
    marker: L.marker([lat, lng], {
      pane: 'govNames', interactive: false, keyboard: false,
      icon: L.divIcon({ className: `sa-city t${tier}`, html: `<i></i><span>${escapeHtml(name)}</span>`, iconSize: null }),
    }).addTo(group),
  }));
  group.addTo(m);
  const tiers = () => {
    try {
      const z = m.getZoom();
      const c = m.getContainer().classList;
      c.toggle('sa-t2-off', z < 6);
      c.toggle('sa-t3-off', z < 7.5);
    } catch (e) {}
  };
  m.on('zoomend', tiers);
  tiers();
  registerLabels(m, 'saudi', entries);
  return group;
}

let govNamesLayer = null;
let saudiCitiesLayer = null;

async function drawGeo(d) {
  const byIso = controlByIso(d);
  if (geoLayer) map.removeLayer(geoLayer);
  if (saudiGeoLayer) map.removeLayer(saudiGeoLayer);
  islandLayers.forEach((l) => { try { map.removeLayer(l); } catch (e) {} });
  islandLayers = [];

  if (!geoCache) geoCache = await fetch('/yemen-adm1.geojson').then((r) => r.json());
  const split = splitIslandFeatures(geoCache);
  islandGeoCache = split.islands;

  if (await loadDistricts()) {
    if (districtLayerMain) { try { map.removeLayer(districtLayerMain); } catch (e) {} }
    districtLayerMain = districtLayer(map, byIso);
    try { renderBars(d); } catch (e) {}
  }

  geoLayer = L.geoJSON(split.mainland, {
    style: (f) => styleFeature(f, byIso),
    onEachFeature: (f, layer) => bindGov(f, layer, byIso),
  }).addTo(map);
  if (govNamesLayer) { try { map.removeLayer(govNamesLayer); } catch (e) {} }
  govNamesLayer = govNameLayer(map, split.mainland.features, byIso);
  if (!saudiCitiesLayer) saudiCitiesLayer = saudiCityLayer(map);

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
  if (districtLayerMain) districtLayerMain.setStyle((f) => districtStyle(f, byIso));
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

/*
 * The Timeline, one phase at a time in the same pager as Fronts and Numbers.
 * It opens on Now; the left arrow (or a swipe right) steps back one phase at a
 * time to the origins. The Now box takes the text the server rewrites every
 * three days (/api/brief "timelineNow"); earlier phases never change.
 */
let timelineIdx = null;

function phaseDates(p, isNow) {
  const fmt = (s) => {
    const m = /^(\d{4})-(\d{2})$/.exec(String(s || ''));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : String(s || '');
  };
  if (isNow) return `${fmt(p.from)} – now`;
  return fmt(p.from) + (p.to && p.to !== p.from ? ` – ${fmt(p.to)}` : '');
}

function renderTimeline(d) {
  const el = document.getElementById('timeline');
  if (!el) return;
  const phases = d.timeline || [];
  if (!phases.length) { el.innerHTML = ''; return; }
  const last = phases.length - 1;
  const live = brief && brief.timelineNow && brief.timelineNow.summary ? brief.timelineNow : null;
  const slides = phases.map((p, i) => {
    const isNow = i === last;
    const summary = (isNow && live ? live.summary : p.summary || p.mapNote || '').trim();
    const detail = (isNow && live ? live.detail : p.detail || (p.bullets || []).join(' ')).trim();
    const asOf = isNow && live && live.asOf ? new Date(live.asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    return `<article class="phase-card${isNow ? ' now' : ''}">
      <div class="phase-head">
        <strong>${isNow ? '<span class="now-tag">Now</span> ' : ''}${escapeHtml(p.title)}</strong>
        <span class="muted">${escapeHtml(phaseDates(p, isNow))}</span>
      </div>
      <p class="phase-sum">${escapeHtml(summary)}</p>
      ${detail ? `<div class="full">
        <p>${escapeHtml(detail)}</p>
        ${p.mapNote && !isNow ? `<p class="muted">On the map: ${escapeHtml(p.mapNote)}</p>` : ''}
        <div class="srcs">${asOf ? `Updated ${escapeHtml(asOf)} · ` : ''}Source: ${sourceCreditsHtml(p.sources || [], '')}</div>
      </div>
      <button type="button" class="toggle-phase">Read more</button>` : ''}
    </article>`;
  });
  const idx = timelineIdx == null ? last : Math.min(timelineIdx, last);
  el.innerHTML = pagerHtml('timeline', slides, idx, phases.map((p, i) => (i === last ? `Now: ${p.title}` : p.title)));
  // An open box left behind would keep the pager at its height: it closes.
  wirePager(el, idx, (i) => { timelineIdx = i; closeReadMore(el, '.phase-card', '.toggle-phase'); }, { wrap: false });
  el.querySelectorAll('.toggle-phase').forEach((btn) => {
    btn.onclick = () => {
      const card = btn.closest('.phase-card');
      const open = card.classList.toggle('open');
      btn.textContent = open ? 'Hide' : 'Read more';
    };
  });
}

let legendFitWired = false;

/**
 * The legend does not scroll: a key that hides half its rows behind a scrollbar
 * is not a key. When the map is too short for the full list it switches to the
 * compact scale instead (`.tight` — the hint line goes, the rows close up).
 * Measured rather than guessed, because the map's height is a `clamp()` of the
 * viewport and the list's length depends on how many control sides exist today.
 */
function fitLegend() {
  const legend = document.getElementById('legend');
  if (!legend) return;
  legend.classList.remove('tight', 'cols');
  if (legendCollapsed) return;
  // `overflow:hidden` plus a max-height, so anything clipped shows up here.
  const clipped = () => legend.scrollHeight > legend.clientHeight + 1;
  if (!clipped()) return;
  legend.classList.add('tight');
  if (!clipped()) return;
  legend.classList.add('cols');
}

/** The name a control side goes by in a key: "Houthi", not "Houthi / Ansar Allah". */
function controlShortName(c) {
  if (c.id === 'plc') return 'Government';
  if (c.id === 'houthi') return 'Houthi';
  if (c.id === 'contested') return 'Contested';
  return (c.name || '').split(' / ')[0] || c.name || '';
}

/**
 * The control key for a pop-up map: one row between the map and the button to
 * the main map. The pop-ups paint governorates in the main map's colours but
 * carry none of its legend, so a reader who opened one straight from a card had
 * no way to read them. Sides only — the pop-ups draw no Saudi fill, and the
 * report pop-up's pins already carry their own labels.
 */
function popLegendHtml() {
  const sides = (data && Array.isArray(data.control) ? data.control : []).filter((c) => c && c.color);
  if (!sides.length) return '';
  const row = (c) => `<span><i class="sw" style="background:${escapeHtml(c.color)}"></i>${escapeHtml(controlShortName(c))}</span>`;
  return `<div class="pop-legend">${sides.map(row).join('')}</div>`;
}

function renderLegend(d) {
  const shortName = controlShortName;
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
  const legend = document.getElementById('legend');
  legend.classList.toggle('collapsed', legendCollapsed);
  legend.innerHTML = `
    <div class="leg-head">
      <span class="leg-title">Legend</span>
      <button type="button" class="leg-collapse" aria-label="${legendCollapsed ? 'Expand legend' : 'Collapse legend'}" aria-expanded="${legendCollapsed ? 'false' : 'true'}">${legendCollapsed ? '▸' : '▾'}</button>
    </div>
    <div class="leg-body">
      <p class="leg-hint">Tick to show, untick to hide.</p>
      <div class="leg-sec">Territory</div>
      ${controlRows}
      ${row('saudi', COLORS.saudi, 'Saudi Arabia')}
      <div class="leg-sec">Events</div>
      ${row('combat', EVENT_COLORS.combat, 'Ground fighting', true)}
      ${row('strike', EVENT_COLORS.strike, 'Launch/strike/alert', true)}
      ${row('vessel', EVENT_COLORS.vessel, 'Vessel attacked', true)}
      ${row('port', EVENT_COLORS.port, 'Port/terminal attacked', true)}
    </div>`;
  fitLegend();
  if (!legendFitWired) {
    legendFitWired = true;
    window.addEventListener('resize', fitLegend);
  }
  legend.querySelector('.leg-collapse').onclick = (ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    legendCollapsed = !legendCollapsed;
    renderLegend(d);
  };
  legend.querySelectorAll('.leg-item').forEach((btn) => {
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
    // On a phone the expanded map is nearly all the screen there is, so the key
    // folds itself away and the reader opens it if they want it. On a desktop
    // there is room for both and the legend is left alone. Shrinking puts back
    // whatever they had before, not an unconditional "open".
    if (window.innerWidth <= 720) {
      if (mapFocus) { legendWasOpen = !legendCollapsed; legendCollapsed = true; }
      else legendCollapsed = !legendWasOpen;
    }
    try { if (data) renderLegend(data); } catch (e) {}
    setTimeout(() => { if (map) map.invalidateSize(); fitLegend(); }, 50);
  };

  if (!frontFloatWired) {
    frontFloatWired = true;
    document.addEventListener('click', (ev) => {
      if (Date.now() - frontFloatOpenedAt < 400) return;
      const t = ev.target;
      if (!t) return;
      if (t.closest('#pin-sheet, .front-map-btn, .card-map')) return;
      const ps = document.getElementById('pin-sheet');
      if (ps && ps.classList.contains('as-pop')) hideFrontFloat();
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
      else { const box = document.querySelector('#pin-sheet.as-pop .pin-sheet-box'); if (box) placePinPop(box, frontFloatAnchor); }
    }, true);
    document.addEventListener('click', (ev) => {
      if (Date.now() < keepHighlightUntil) return;
      const t = ev.target;
      if (!t) return;
      const path = (typeof ev.composedPath === 'function') ? ev.composedPath() : [];
      if (path.some((n) => n && n.matches && n.matches('#legend, .front-float-go, .front-map-btn, #pin-sheet, #map-chip, .chip-clear, #btn-clear-hl'))) return;
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
  if (first) await Promise.all([loadGazetteer(), loadMapFixes()]);
  const feedEl = document.getElementById('feed');
  const shown = first ? null : new Set([...(feedEl ? feedEl.querySelectorAll('.card') : [])].map((el) => el.dataset.fp));

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
  const stamp = document.getElementById('updated');
  if (stamp) stamp.textContent = stampText();
  renderBars(data);
  renderLiveScan();
  renderCasualties(data);
  renderFeed(data);
  // After the feed: its render builds the pin index the prose links to.
  renderSituation(data);
  // New cards since the last refresh flash once.
  if (shown && shown.size && feedEl) {
    [...feedEl.querySelectorAll('.card')].filter((el) => !shown.has(el.dataset.fp)).forEach(flashCard);
  }
  renderFreshness();
  renderFronts(data);
  ensureMap(data);
  if (first) {
    try { renderTimeline(data); } catch (e) { console.error(e); }
    // A brief slower than first paint still brings the Now box's latest text.
    briefP.then(() => { try { if (brief && brief.timelineNow) renderTimeline(data); } catch (e) { console.error(e); } });
    try { renderLegend(data); } catch (e) { console.error(e); }
    try { wireUi(data); } catch (e) { console.error(e); }
    const attrib = document.getElementById('attrib');
    if (attrib) attrib.textContent = data.basemapAttribution || '© OpenStreetMap contributors';
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
    // A tab in the background asks nothing; it catches up the moment it is shown.
    window.__yemenDeskTimer = setInterval(() => { if (!document.hidden) refresh(false); }, jsonMs);
    window.__yemenLiveTimer = setInterval(() => { if (!document.hidden) pullLive({ silent: true }); }, 5 * 60 * 1000);
    if (!window.__yemenVisHook) {
      window.__yemenVisHook = true;
      let hiddenAt = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); return; }
        if (hiddenAt && Date.now() - hiddenAt > jsonMs) refresh(false);
      });
    }
    // The brief only changes on a 12-hour boundary; checking every 10 minutes is
    // enough to cross it promptly without hammering the endpoint.
    window.__yemenBriefTimer = setInterval(async () => {
      if (document.hidden) return;
      await pullBrief();
      if (data) { renderSituation(data); renderCasualties(data); renderFronts(data); renderTimeline(data); renderBars(data); applyMapFilters(); }
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

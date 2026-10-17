/*
 * The home page: every desk on one map, then "Follow a story" (user, 17 Oct).
 * - The map is the desks' own: their toolbar, their pins (the mark says what happened, the colour who did it),
 *   their control colours (Yemen's districts, the Iran war's countries), their legends (pick a desk's to see it
 *   in full), their count in the box at the top right. A banner by each war leads to its desk.
 * - A pin's note is the desk's own note, with a link to the same pin on its desk.
 * - The header's desk menu opens a desk's own page; there is one page per desk.
 * Everything comes from the live feeds: /api/desk, /api/brief, /api/trump and /api/oil.
 * public/app.js is loaded on every page; the pins, notes, legends, masthead and colours are its own.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const phone = () => matchMedia('(max-width:720px)').matches;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // app.js's top-level names (a classic script's are shared with this one).
  // Functions and the objects app.js never replaces are looked up once (a lookup per pin made the whole war take seconds).
  const APP = new Map();
  const VALUES = new Set(['districtGeo', 'geoCache', 'brief']);
  const app = (name) => {
    if (APP.has(name)) return APP.get(name);
    let v = null;
    try { v = eval(name); } catch (e) { return null; }
    if (v && !VALUES.has(name) && (typeof v === 'function' || typeof v === 'object')) APP.set(name, v);
    return v;
  };
  const setApp = (name, v) => { try { window.__homeV = v; (0, eval)(`${name} = window.__homeV`); } catch (e) { /* not there */ } finally { delete window.__homeV; } };
  const A = (name) => app(name) || (() => null);

  /* ---------- The desks ---------- */
  const HD = {
    iran: { name: 'Iran conflict', short: 'Iran', desk: 'Iran conflict desk', href: '/iran-conflict-desk', from: '2026-02-28' },
    yemen: { name: 'Yemen conflict', short: 'Yemen', desk: 'Yemen conflict desk', href: '/yemen-conflict-desk', from: '2026-07-13' },
  };
  const WAR_FROM = '2026-02-28';
  const appDesks = app('DESKS') || [];
  const flagOf = (id) => {
    const d = appDesks.find && appDesks.find((x) => x.id === id);
    const fs = app('flagSvg');
    if (d && fs) return fs(d);
    const c = id === 'iran' ? ['#239f40', '#ffffff', '#da0000'] : ['#ce1126', '#ffffff', '#000000'];
    return `<svg class="flag" viewBox="0 0 18 12" aria-hidden="true">${c.map((x, i) => `<rect y="${i * 4}" width="18" height="4" fill="${x}"/>`).join('')}</svg>`;
  };
  const FLAG = { iran: flagOf('iran'), yemen: flagOf('yemen') };
  const ICON_EXT = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

  /* ---------- Times: the reader's own clock, as on the desks; the map's days on the desks' clock ---------- */
  const fmt = (at) => {
    const d = new Date(at);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };
  const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
  const dayOf = (at) => DAY_FMT.format(new Date(at));
  /* A pin's day, worked out once. */
  const evDay = (e) => e._d || (e._d = dayOf(e.at));
  const today = () => dayOf(Date.now());
  const shift = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayName = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const longDay = (ymd) => { const f = app('fmtDay'); return f ? f(ymd) : dayName(ymd); };

  /* ---------- The map's views ---------- */
  const REGION = [[11.5, 32.5], [38.5, 61]];

  /* ---------- The data ---------- */
  const D = { asOf: null, reports: [], events: [], trump: [], arenas: [], fronts: [], oil: null, ydata: null, ybrief: null };
  let byFp = new Map();
  const getJson = (u, o) => fetch(u, o).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const srcName = (s) => { const f = app('canonicalSourceName'); return f ? f(s) : String(s || ''); };
  function leanCls(r) {
    if (r.desks[0] === 'iran' && r.lean) return 'ir-' + r.lean;
    const f = app('sourceLean');
    const l = f ? f(r.srcRaw) : 'other';
    return 'lean-' + (l === 'houthi' || l === 'gov' ? l : 'indep');
  }
  function reportsOf(desk, rows) {
    return (rows || []).map((r) => ({
      fp: String(r.fp), at: r.at, srcRaw: r.source, src: srcName(r.source), url: r.url || '', h: r.summary || '',
      also: Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : [], desks: Array.isArray(r.desks) && r.desks.length ? [desk, ...r.desks.filter((d) => d !== desk)] : [desk],
      lean: r.lean, replyTo: r.replyTo, flags: r.flags || [],
    })).filter((r) => r.h && r.at);
  }
  /* A pin as its desk draws it: the kind of event (the mark) and who acted (the colour). */
  function yemenPin(e) {
    const t = String(e.type || '').toLowerCase();
    const classify = app('classifyForMap'), cat0 = app('pinCategory');
    const cat = ['strike', 'combat', 'vessel', 'port'].includes(t) ? t : (classify && classify(`${e.label || ''} ${e.text || ''}`, t)) || (cat0 && cat0(t)) || 'strike';
    if (!['strike', 'combat', 'vessel', 'port'].includes(cat)) return null;
    return { ...e, desk: 'yemen', fp: String(e.fp), mapCat: cat, cat };
  }
  const iranPin = (e) => ({ ...e, desk: 'iran', fp: String(e.fp), mapCat: ['strike', 'combat', 'vessel', 'port'].includes(e.type) ? e.type : 'strike', cat: A('iranKindOf')(e) || 'strike' });
  const eventsOf = (desk, rows) => (rows || []).filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number')
    .filter((e) => desk !== 'iran' || A('iranPinShown')(e) !== false)
    .map((e) => (desk === 'iran' ? iranPin(e) : yemenPin(e))).filter(Boolean);
  /* "…[[2]]." as the text and the report it rests on. */
  const plain = (p) => String(p || '').replace(/\s*\[\[\d+\]\]/g, '').trim();
  const firstRef = (p, refs) => { const m = /\[\[(\d+)\]\]/.exec(p); return m && refs ? refs[Number(m[1]) - 1] || null : null; };
  const ptsOf = (o) => (o && Array.isArray(o.points) ? o.points.map((p) => ({ t: plain(p), ref: firstRef(p, o.refs) })).filter((p) => p.t) : []);

  function mergeReports(lists) {
    const m = new Map();
    for (const r of lists.flat()) {
      const had = m.get(r.fp);
      if (had) { r.desks.forEach((d) => { if (!had.desks.includes(d)) had.desks.push(d); }); continue; }
      m.set(r.fp, r);
    }
    return [...m.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
  }
  const keyOf = (e) => e.desk + '|' + e.fp;
  function addEvents(list, replace) {
    const keep = new Map(D.events.map((e) => [keyOf(e), e]));
    list.forEach((e) => { if (replace || !keep.has(keyOf(e))) keep.set(keyOf(e), e); });
    D.events = [...keep.values()];
  }

  async function load() {
    const [di, dy, bi, by, ti, ty, oil, sy, si] = await Promise.all([
      getJson('/api/desk?desk=iran'), getJson('/api/desk?desk=yemen'), getJson('/api/brief?desk=iran'), getJson('/api/brief?desk=yemen'),
      getJson('/api/trump'), getJson('/api/trump?desk=yemen'), getJson('/api/oil'),
      getJson('/api/scan?only=time', { cache: 'no-cache' }), getJson('/api/scan?desk=iran&only=time', { cache: 'no-cache' }),
    ]);
    if (di || dy) {
      D.reports = mergeReports([reportsOf('yemen', dy && dy.reports), reportsOf('iran', di && di.reports)]);
      byFp = new Map(D.reports.map((r) => [r.fp, r]));
      addEvents([...eventsOf('yemen', dy && dy.events), ...eventsOf('iran', di && di.events)], true);
      // When the desks last looked, as each desk shows it, not the newest report's time.
      const t = Math.max(...[di && di.updatedAt, dy && dy.updatedAt, sy && sy.scannedAt, si && si.scannedAt].map((x) => Date.parse(x || '') || 0));
      if (t) D.asOf = new Date(t).toISOString();
    }
    if (bi && bi.ok !== false && !bi.pending) D.arenas = bi.arenas || D.arenas;
    if (by && by.ok !== false) {
      D.fronts = by.fronts || D.fronts;
      // Yemen's control as the desk has it now: its update clock's live layer over the hand baseline.
      D.ybrief = by;
      setApp('brief', by);
    }
    if (ti || ty) {
      const m = new Map();
      [['iran', ti], ['yemen', ty]].forEach(([desk, f]) => ((f && f.statements) || []).forEach((s) => {
        if (!s || !s.id) return;
        const had = m.get(s.id);
        if (had) { had.desks.push(desk); return; }
        m.set(s.id, { id: s.id, at: s.at, desks: [desk], src: srcName(s.source), url: s.url, h: String(s.headline || '').replace(/^Trump:\s*/, ''), body: s.body || '' });
      }));
      D.trump = [...m.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
    }
    if (oil && oil.ok && oil.rows && oil.rows.length) D.oil = oil;
  }

  /* The whole war's pins, read once, soon after the page is up, so a longer view comes at once. */
  let warP = null, warIn = false;
  const assetV = () => { try { const m = /[?&]v=([^&]+)/.exec(document.querySelector('script[src*="/app.js?v="]').src); return m ? m[1] : 'h'; } catch (e) { return 'h'; } };
  function loadWar() {
    warP ??= Promise.all([
      getJson(`/api/desk?desk=yemen&since=${HD.yemen.from}`),
      getJson(`/api/desk?desk=iran&since=${HD.iran.from}`),
      getJson(`/iran-map-pins.json?v=${assetV()}`),
    ]).then(([y, i, past]) => {
      const ir = eventsOf('iran', i && i.events);
      addEvents([...eventsOf('yemen', y && y.events), ...ir]);
      // The war's researched attacks, before the Iran desk began reading (the desk's own file, map-pack.cjs).
      const first = ir.reduce((m, e) => Math.min(m, Date.parse(e.at) || Infinity), Infinity);
      if (past && Array.isArray(past.pins)) {
        const out = [];
        past.pins.forEach(([md, actor, lat, lng, hm, sea, kind], ni) => {
          const at = hm ? `${past.year}-${md}T${hm}:00Z` : `${past.year}-${md}T12:00:00+03:00`;
          if (!(Date.parse(at) < first)) return;
          out.push(iranPin({ fp: 'rs#' + ni, ni, researched: true, dayOnly: !hm, mapOnly: true, at, lat, lng, actor, sea: !!sea, kind: typeof kind === 'number' ? kind : undefined, type: 'strike', place: '', label: '', text: '', source: '', url: '', also: [] }));
        });
        addEvents(out);
      }
      warIn = true;
      return true;
    }).catch(() => { warP = null; return false; });
    return warP;
  }

  /* ---------- Small pieces ---------- */
  const deskTag = (desk) => (desk === 'both'
    ? `<span class="h-tags">${deskTag('iran')}${deskTag('yemen')}</span>`
    : `<a class="h-tag h-tag-${desk}" href="${HD[desk].href}" data-desk-go title="${esc(HD[desk].desk)}">${FLAG[desk]}<span>${esc(HD[desk].short)}</span></a>`);
  const deskOfReport = (r) => (r.desks.includes('iran') && r.desks.includes('yemen') ? 'both' : r.desks[0]);

  /** A report's pins on the map (one report can be pinned on several places). */
  const pinsOf = (fp) => D.events.filter((e) => !e.researched && (e.fp === fp || e.fp.split('-pin-')[0] === fp));
  function card(r, o) {
    const opts = o || {};
    const parent = r.replyTo && byFp.get(String(r.replyTo));
    const reply = parent && !opts.noReply && parent.at < r.at ? `<a class="reply-to" href="${esc(parent.url)}" target="_blank" rel="noopener">↩ Follows ${esc(fmt(parent.at))} · ${esc(parent.h)}</a>` : '';
    const seen = new Set([r.src]);
    const also = r.also.filter((a) => { const n = srcName(a.source); return n && !seen.has(n) && seen.add(n); });
    return `<article class="card ${leanCls(r)}" data-fp="${esc(r.fp)}">
      <div class="meta">
        <time datetime="${esc(r.at)}">${esc(fmt(r.at))}</time>
        <span class="src-wrap"><a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.src)}</a><a class="src-go" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Open source">${ICON_EXT}</a></span>
        ${pinsOf(r.fp).length ? `<button type="button" class="card-map" data-pin-of="${esc(r.fp)}">Show on map</button>` : ''}
        ${deskTag(deskOfReport(r))}
      </div>
      ${reply}
      <p class="headline">${esc(r.h)}</p>
      ${also.length ? `<p class="also">Also: ${also.slice(0, 4).map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(srcName(a.source))}</a>`).join(' · ')}</p>` : ''}
    </article>`;
  }
  function trumpCard(s) {
    return `<article class="card ir-us trump-st" data-fp="${esc(s.id)}">
      <div class="meta">
        <time datetime="${esc(s.at)}">${esc(fmt(s.at))}</time>
        <span class="src-wrap"><a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a><a class="src-go" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="Open source">${ICON_EXT}</a></span>
      </div>
      <p class="headline">Trump: ${esc(s.h)}</p>
    </article>`;
  }

  /* ---------- Stories ---------- */
  const re = (r) => D.reports.filter((x) => r.test(x.h));
  const flagged = (f) => D.reports.filter((x) => x.flags.includes(f));
  const uniq = (list) => { const s = new Set(); return list.filter((r) => r && !s.has(r.fp) && s.add(r.fp)).sort((a, b) => (a.at < b.at ? 1 : -1)); };
  const arena = (id) => D.arenas.find((a) => a.id === id);
  const front = (id) => D.fronts.find((f) => f.id === id);
  const inB = (e, b) => e.lat >= b[0][0] && e.lat <= b[1][0] && e.lng >= b[0][1] && e.lng <= b[1][1];
  const PICKS = ['hormuz', 'bab', 'oil', 'trump'];
  /* Ships go to the sea they are in (user, 18 Oct: no Shipping story beside Hormuz and Bab al-Mandab, they repeated it). */
  const SHIP_RE = /\b(?:ships?|vessels?|tankers?|freighters?|ukmto|seafarers?|crew)\b/i;
  const GULF_SEA_RE = /hormuz|gulf of oman|persian gulf|arabian gulf|\bthe gulf\b|fujairah|khor fakkan|bandar abbas|qeshm|ras al-khaimah|jask|chabahar|kharg/i;
  const RED_SEA_RE = /red sea|bab al-mandab|bab el-mandeb|gulf of aden|hodeidah|mocha|aden|yanbu|jeddah|eritrea|djibouti/i;
  /* Inside Iran is Iran's land; Hormuz, its waters and islands (user, 18 Oct: the two stories repeated each other). */
  const AT_SEA_RE = /hormuz|strait|tanker|\bships?\b|vessel|naval|navy|gulf of oman|persian gulf|seized? (?:a )?(?:ship|tanker)/i;
  const STRAIT_ISLE_RE = /hormuz|strait|qeshm|larak|hengam|abu musa|tunbs?\b|island/i;
  const inRing = (lng, lat, ring) => { let x = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) x = !x; } return x; };
  /** The country a pin is in, from the Iran desk's map of the war's countries; null at sea or before the map is read. */
  function countryAt(e) {
    if (!irGeo || !irGeo.features) return null;
    for (const f of irGeo.features) {
      const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      if (polys.some((p) => inRing(e.lng, e.lat, p[0]) && !p.slice(1).some((h) => inRing(e.lng, e.lat, h)))) return f.properties.name;
    }
    return null;
  }
  const atSea = (e) => !!e.sea || e.cat === 'vessel' || A('iranAtSea')(e) === true;
  const placeText = (e) => `${e.label || ''} ${e.place || ''}`;
  // On Iran's land and not on the strait's islands; Iran's strikes on the Kurds in Iraq belong here too.
  const onIranLand = (e) => !atSea(e) && !STRAIT_ISLE_RE.test(placeText(e)) && (countryAt(e) === 'Iran' || (countryAt(e) === 'Iraq' && e.actor === 'iran'));
  const inStrait = (e) => atSea(e) || STRAIT_ISLE_RE.test(placeText(e));
  let T = [], TOPIC = {};
  function buildTopics() {
    T = [
      { id: 'hormuz', name: 'Strait of Hormuz', desk: 'iran', bounds: [[24.3, 54.6], [27.8, 59]], erx: /hormuz|strait|tanker|vessel|ship|bandar abbas|qeshm|fujairah/i, where: inStrait, pts: ptsOf(arena('hormuz')),
        cards: uniq([...flagged('arena:hormuz'), ...re(/hormuz/i), ...re(SHIP_RE).filter((r) => GULF_SEA_RE.test(r.h))]) },
      { id: 'bab', name: 'Bab al-Mandab and the Red Sea', short: 'Bab al-Mandab', desk: 'yemen', bounds: [[11.4, 40.8], [16.4, 45.8]], erx: /red sea|bab al-mandab|hodeidah|ship|vessel|tanker|island/i, pts: ptsOf(front('bab')),
        cards: uniq([...re(/red sea|bab al-mandab|hodeidah|yanbu|gulf of aden/i), ...re(SHIP_RE).filter((r) => RED_SEA_RE.test(r.h))]) },
      { id: 'oil', name: 'Oil prices', desk: 'both', bounds: [[16, 44], [30.5, 60]], geo: false, oil: D.oil,
        cards: uniq(re(/\boil prices?\b|\bbrent\b|\bwti\b|crude (?:price|futures|oil price)|per barrel|\bopec\b|oil market/i)) },
      { id: 'trump', name: 'Trump’s latest', desk: 'both', bounds: REGION, geo: false, trump: D.trump, cards: [] },
      { id: 'energy', name: 'Energy sites under fire', short: 'Energy', desk: 'both', bounds: [[16.5, 38], [28.5, 56]], erx: /aramco|refiner|pipeline|oil (?:field|facilit|terminal)|power (?:station|plant)|gas field|energy/i,
        cards: uniq(re(/aramco|refiner|pipeline|oil (field|facilit|terminal)|power (station|plant)|gas field/i)) },
      { id: 'saudi', name: 'Saudi Arabia under Houthi fire', short: 'Saudi Arabia', desk: 'yemen', bounds: [[16, 36], [29, 56]], erx: /saudi arabia|riyadh|dhahran|jizan|jazan|najran|yanbu|abha|khamis mushait/i, pts: ptsOf(front('saudi-home')),
        cards: uniq(re(/saudi|riyadh|dhahran|jizan|jazan|najran|yanbu|abha|khamis mushait/i).filter((r) => r.desks.includes('yemen'))) },
      { id: 'lebanon', name: 'Lebanon and Israel', short: 'Lebanon', desk: 'iran', bounds: [[32.4, 34.6], [34.7, 36.9]], erx: /./, pts: ptsOf(arena('lebanon')),
        cards: uniq([...flagged('arena:lebanon'), ...re(/lebanon|hezbollah|bint jbeil|beirut|galilee|litani|nabatieh|tyre/i)]) },
      { id: 'talks', name: 'Talks and mediation', short: 'Talks', desk: 'both', bounds: REGION, geo: false, pts: ptsOf(arena('talks')),
        cards: uniq([...flagged('arena:talks'), ...re(/\btalks\b|negotiat|ceasefire|truce|mediat|envoy/i)]) },
      { id: 'nuclear', name: 'Iran’s nuclear file', short: 'Nuclear', desk: 'iran', bounds: [[23.5, 44], [39.8, 63]], erx: /nuclear|fordow|natanz|bushehr|arak|enrich/i, pts: ptsOf(arena('nuclear')),
        cards: uniq([...flagged('arena:nuclear'), ...re(/nuclear|uranium|iaea|enrich|fordow|natanz/i)]) },
      { id: 'fronts', name: 'Yemen’s front lines', short: 'Yemen fronts', desk: 'yemen', bounds: [[12.4, 42.6], [17.2, 46.6]], erx: /./,
        pts: ['west-taiz', 'marib', 'dhale', 'lahj', 'jawf'].map(front).filter(Boolean).map((f) => { const p = ptsOf(f)[0]; return p && { ...p, t: f.name + ': ' + p.t }; }).filter(Boolean),
        cards: uniq(re(/taiz|marib|dhale|lahj|jawf|saada|bayda|\bfront\b/i).filter((r) => r.desks.includes('yemen'))) },
      { id: 'inside', name: 'Inside Iran', desk: 'iran', bounds: [[25, 44], [39.8, 63]], erx: /./, where: onIranLand, pts: ptsOf(arena('inside-iran')).filter((p) => !AT_SEA_RE.test(p.t)),
        cards: uniq([...flagged('arena:inside-iran'), ...re(/tehran|irgc|iranian (army|parliament|official)|khamenei|pezeshkian/i).filter((r) => r.desks.includes('iran'))]).filter((r) => !AT_SEA_RE.test(r.h)) },
    ];
    // One report, and one point, in one story only (user, 17 Oct: Hormuz news was in Hormuz and in Inside Iran):
    // the story about a place before the wider ones.
    const seenCard = new Set(), seenPt = [];
    ['hormuz', 'bab', 'lebanon', 'saudi', 'nuclear', 'energy', 'oil', 'talks', 'fronts', 'inside'].map((id) => T.find((t) => t.id === id)).filter(Boolean).forEach((t) => {
      // Inside one story no report twice either: the same event from several outlets is shown once.
      t.cards = t.cards.filter((r) => !seenCard.has(r.fp) && !seenCard.has(r.url)).filter((r, i, all) => !all.slice(0, i).some((q) => alike(q.h, r.h)));
      t.cards.forEach((r) => { seenCard.add(r.fp); if (r.url) seenCard.add(r.url); });
      if (t.pts) {
        t.pts = t.pts.filter((p, i, all) => !seenPt.some((q) => (p.ref && q.ref && p.ref.url && p.ref.url === q.ref.url) || alike(p.t, q.t)) && !all.slice(0, i).some((q) => alike(p.t, q.t)));
        seenPt.push(...t.pts);
      }
    });
    T.forEach((t) => {
      t.short = t.short || t.name;
      // A small map only for a story whose own events are on the map (user, 17 Oct): the pins of its reports,
      // or, for a place, the pins on that place.
      const fps = new Set(t.cards.map((r) => r.fp));
      // The maps show today's events; the nuclear file's, every attack on a nuclear site since 28 Feb (user, 18 Oct).
      const day = today();
      t.mapNote = t.id === 'nuclear' ? 'Attacks on nuclear sites since 28 Feb' : 'Today’s events';
      t.events = t.geo === false ? [] : t.id === 'nuclear'
        ? D.events.filter((e) => e.desk === 'iran' && A('iranKindOf')(e) === 'nuclear')
        : D.events.filter((e) => !e.researched && evDay(e) === day && inB(e, t.bounds) && (t.desk === 'both' || e.desk === t.desk) && (fps.has(e.fp) || (t.erx && t.erx.test(`${e.label || ''} ${e.place || ''}`))) && (!t.where || t.where(e)));
      // A story both desks share is one desk's when all its reports are that desk's (user, 18 Oct: an Emirati plane landing in Tehran is no Yemen news).
      if (t.desk === 'both' && t.cards.length && !t.trump && !t.oil) {
        const ds = new Set(t.cards.flatMap((r) => r.desks));
        if (ds.size === 1) t.desk = [...ds][0];
      }
    });
    // A story with nothing in it is not shown.
    T = T.filter((t) => (t.trump ? t.trump.length : t.oil || t.cards.length || (t.pts && t.pts.length)));
    TOPIC = Object.fromEntries(T.map((t) => [t.id, t]));
  }
  const latestOf = (t) => [t.cards[0] && t.cards[0].at, t.trump && t.trump[0] && t.trump[0].at, t.oil && t.oil.rows[0].at, t.pts && t.pts[0] && t.pts[0].ref && t.pts[0].ref.at].filter(Boolean).sort().pop();
  const timeOf = (at) => (at ? fmt(at) : '');
  const kicker = (t) => `<span class="h2-kick">${t.desk === 'both' ? `${FLAG.iran}${FLAG.yemen}<span>Both desks</span>` : `${FLAG[t.desk]}<span>${HD[t.desk].short} desk</span>`}</span>`;

  /* Oil: the prices as Yahoo Finance gives them, read by the server every ten minutes. */
  const money = (v) => '$' + v.toFixed(2);
  const pctTxt = (p) => (p == null ? '' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`);
  const oilLine = (o) => o.rows.map((x) => `${x.k} ${money(x.v)} (${pctTxt(x.day)})`).join(' · ');
  function oilHtml(o) {
    const newest = o.rows.map((x) => x.at).sort().pop();
    const since = (x) => (x.since ? `Highest since ${dayName(x.since)}` : '');
    return `<div class="h2-oil">${o.rows.map((x) => `<div class="h2-px"><span class="k">${esc(x.k)}</span><b>${esc(money(x.v))}</b>${x.day == null ? '' : `<span class="d ${x.day >= 0 ? 'up' : 'dn'}">${x.day >= 0 ? '▲' : '▼'} ${esc(pctTxt(x.day))}</span>`}<small>${esc([x.note, x.week == null ? '' : `Week ${pctTxt(x.week)}`, since(x)].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>
      <p class="h2-oil-src">${esc(fmt(newest))} · ${o.rows.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.k)}</a>`).join(', ')} via ${esc(o.src)}</p>`;
  }
  const said = (s, n) => { const q = [...String(s.body).matchAll(/“([^”]+)”/g)].map((m) => m[1].trim()); return q.length ? q.slice(0, n).join(' ') : String(s.body).replace(/[“”]/g, ''); };
  const quote = (s) => `<figure class="h2-quote big"><blockquote>“${esc(said(s, 2))}”</blockquote><figcaption><b>${esc(s.h)}</b><span>${esc(fmt(s.at))} · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a></span></figcaption></figure>`;

  /* The reports under a story's lines, without the ones the lines came from. */
  const words = (s) => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
  const alike = (a, b) => { const X = words(a), Y = words(b); let n = 0; X.forEach((w) => Y.has(w) && n++); return n / Math.max(1, Math.min(X.size, Y.size)) > 0.6; };
  const rest = (t) => { const shown = (t.pts || []).slice(0, 4); const urls = new Set(shown.map((p) => p.ref && p.ref.url)); return t.cards.filter((r) => !urls.has(r.url) && !shown.some((p) => alike(r.h, p.t))); };

  /* ---------- Page state ---------- */
  const S = { mode: 'day', day: null, from: null, to: null, story: null, legend: 'yemen' };
  let map, marks, tiles, legendBox, chipEl, canvas = null;
  const tileUrl = () => 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + (document.documentElement.dataset.theme === 'broadsheet-day' ? 'World_Light_Gray_Base' : 'World_Dark_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}';

  /* The desks' own ticks (app.js): a side, a kind of event or a territory unticked in a legend leaves the map here too. */
  const yeLayers = () => app('layersOn') || {};
  const yeSides = () => app('yemenSidesOn') || {};
  const irPins = () => app('iranPins') || { on: {}, kinds: {}, where: { land: true, sea: true } };
  const yeInk = (e) => A('yemenInk')(e) || '#94a3b8';
  const irInk = (e) => { const ink = app('IRAN_PIN_INK') || {}; const side = A('iranSideOf')(e) || 'other'; return ink[side] || '#94a3b8'; };
  // One colour per side, worked out once (and again when the theme changes).
  const INK = new Map();
  const inkOf = (e) => { const k = e.desk + '|' + e.actor; let c = INK.get(k); if (!c) { c = e.desk === 'iran' ? irInk(e) : yeInk(e); INK.set(k, c); } return c; };
  function ticked(e) {
    if (e.desk === 'yemen') return yeLayers()[e.cat] !== false && yeSides()[A('yemenSideOf')(e) || 'unclear'] !== false;
    const p = irPins();
    const w = p.where || { land: true, sea: true };
    const sea = !!e.sea || e.cat === 'vessel';
    return p.on[A('iranSideOf')(e) || 'other'] !== false && (p.kinds || {})[e.cat] !== false && ((w.land && w.sea) || (sea ? w.sea : w.land));
  }
  function inTime(e) {
    const k = evDay(e);
    if (S.mode === 'day') return k === (S.day || today());
    if (S.mode === 'range') return k >= S.from && k <= S.to;
    return true;
  }
  const shownEvents = () => D.events.filter((e) => inTime(e) && ticked(e));

  /* ---------- The pins: each its own, as on the desks ---------- */
  function noteHtml(e) {
    let body;
    if (e.desk === 'iran') {
      const f = app('iranPopupHtml');
      body = f ? f(e) : esc(e.label);
    } else {
      const f = app('popupHtml');
      body = f ? f(e) : esc(e.label);
    }
    return `${body}<p class="pop-desk"><a data-desk-go href="${HD[e.desk].href}#pin=${encodeURIComponent(e.fp)}">On the ${esc(HD[e.desk].desk)} →</a></p>`;
  }
  const markOf = new Map();
  function drawMarks() {
    if (!map) return;
    // All the pins are put in off the map, then the layer goes on once: one drawing, not one per pin.
    map.removeLayer(marks);
    marks.clearLayers();
    markOf.clear();
    // Every event its own pin, never one mark with a number (user, 17 Oct). Newest on top.
    const evs = shownEvents().sort((a, b) => (a.at < b.at ? -1 : 1));
    // The whole war is thousands of pins: the same pins, drawn on one canvas.
    const many = evs.length > 1500;
    if (many && !canvas) canvas = L.canvas({ padding: 0.3 });
    const atSpot = new Map();
    const jit = app('jitter') || ((lat, lng) => [lat, lng]);
    const icon = app('sidePinIcon'), mark = app('pinMark');
    const lean = app('popLeanClass');
    for (const e of evs) {
      const k = `${Math.round(e.lat * 100)},${Math.round(e.lng * 100)}`;
      const n = atSpot.get(k) || 0;
      atSpot.set(k, n + 1);
      const ll = n ? jit(e.lat, e.lng, n) : [e.lat, e.lng];
      const ink = inkOf(e);
      const ageH = (Date.now() - Date.parse(e.at)) / 3600e3;
      const mk = many ? mark(ll, { renderer: canvas, cat: e.cat, ink })
        : L.marker(ll, { icon: icon(e.cat, ink, ageH <= 6 ? ' fresh' : '', esc(e.label || '')), keyboard: true, zIndexOffset: Math.round(1000 - ageH), riseOnHover: true });
      mk.bindPopup(() => noteHtml(e), { className: e.desk === 'yemen' && lean ? lean(e) : '', maxWidth: 300, maxHeight: 360, autoPan: true });
      // A researched Iran pin's note is read when it is first opened (the desk's own file).
      if (e.researched) mk.on('popupopen', () => {
        const p = irPins();
        p.notesP = p.notesP || A('loadIranNotes')();
        Promise.resolve(p.notesP).then(() => { if (mk.isPopupOpen()) mk.setPopupContent(noteHtml(e)); });
      });
      markOf.set(e.fp, mk);
      marks.addLayer(mk);
    }
    marks.addTo(map);
    drawChip(evs.length);
    drawBanners();
  }

  /* ---------- The control colours: Yemen's districts, the Iran war's countries ---------- */
  let yeDistricts = null, yeGovs = null, irCountries = null, irGeo = null, yeMain = null;
  async function drawControl() {
    if (!map) return;
    if (!map.getPane('hCtrl')) { map.createPane('hCtrl'); map.getPane('hCtrl').style.zIndex = 350; map.getPane('hCtrl').style.pointerEvents = 'none'; }
    // The Iran war's countries in their side's colour (the Iran desk's file and style).
    try {
      irGeo = irGeo || (await getJson('/iran-countries.geojson', { cache: 'no-cache' }));
      const st = app('iranCountryStyle');
      if (irGeo && st) {
        if (irCountries) map.removeLayer(irCountries);
        irCountries = L.geoJSON(irGeo, { pane: 'hCtrl', interactive: false, style: st }).addTo(map);
      }
    } catch (e) { console.warn('iran countries', e); }
    // Yemen's districts in their holder's colour, the governorates drawn over them (the Yemen desk's files and style).
    try {
      D.ydata = D.ydata || (await getJson(`/data.json?v=${assetV()}`));
      const byIso = A('controlByIso')(D.ydata || {}) || {};
      if (await A('loadDistricts')()) {
        const geo = app('districtGeo'), st = app('districtStyle');
        if (yeDistricts) map.removeLayer(yeDistricts);
        if (geo && st) yeDistricts = L.geoJSON(geo, { pane: 'hCtrl', interactive: false, style: (f) => st(f, byIso) }).addTo(map);
      }
      const adm1 = await A('loadAdm1')();
      const split = adm1 && app('splitIslandFeatures') ? app('splitIslandFeatures')(adm1) : null;
      const st1 = app('styleFeature');
      if (split) yeMain = split.mainland;
      if (split && st1) {
        if (yeGovs) map.removeLayer(yeGovs);
        yeGovs = L.geoJSON(split.mainland, { pane: 'hCtrl', interactive: false, style: (f) => st1(f, byIso) }).addTo(map);
      }
    } catch (e) { console.warn('yemen control', e); }
    minis.forEach(miniControl);
  }
  function restyleControl() {
    const byIso = A('controlByIso')(D.ydata || {}) || {};
    try { if (irCountries) irCountries.setStyle(app('iranCountryStyle')); } catch (e) { /* not yet */ }
    try { if (yeDistricts) yeDistricts.setStyle((f) => app('districtStyle')(f, byIso)); } catch (e) { /* not yet */ }
    try { if (yeGovs) yeGovs.setStyle((f) => app('styleFeature')(f, byIso)); } catch (e) { /* not yet */ }
  }

  /*
   * A callout by each war that leads to its desk (user, 17 Oct: rectangular, as map graphics do it): a dot on
   * the country itself, a leader of two lines (out, then a right angle), and a card at its end with the desk's
   * flag and name, today's events and the way in. The card sits in open space, and turns to whichever side
   * keeps it on the map.
   */
  const BANNERS = [
    // Hadramawt, inside Yemen; the leader runs east over the Arabian Sea, then down.
    { desk: 'yemen', at: [15.6, 48.6], out: 92, drop: 34 },
    // The middle of Iran (Dasht-e Kavir); the leader runs east over Afghanistan, then down.
    { desk: 'iran', at: [33.9, 55.6], out: 118, drop: 30 },
  ];
  let bannerLayer = null;
  const todayCount = (desk) => { const t = today(); return D.events.filter((e) => e.desk === desk && evDay(e) === t).length; };
  function bannerHtml(b, sx, sy) {
    const n = todayCount(b.desk);
    // Shorter leaders on a phone's small map.
    const k = phone() ? 0.55 : 1;
    const dx = Math.round(sx * b.out * k), dy = Math.round(sy * b.drop * k);
    return `<span class="h-co-dot" aria-hidden="true"></span>
      <svg class="h-co-line" aria-hidden="true" width="1" height="1"><path d="M0 0H${dx}V${dy}"/></svg>
      <a class="h-co h-co-${sx < 0 ? 'l' : 'r'}${sy < 0 ? 't' : 'b'}" href="${HD[b.desk].href}" data-desk-go style="left:${dx}px;top:${dy}px" aria-label="Open the ${esc(HD[b.desk].desk)}">
        <span class="h-co-flag" aria-hidden="true">${FLAG[b.desk]}</span>
        <span class="h-co-body">
          <span class="h-co-kick"><span class="h-co-live"></span>Live desk</span>
          <b>${esc(HD[b.desk].name)}</b>
          <span class="h-co-foot"><span>${n ? `${n.toLocaleString('en-GB')} event${n === 1 ? '' : 's'} today` : 'Latest reports'}</span><em>Open desk <i aria-hidden="true">→</i></em></span>
        </span>
      </a>`;
  }
  const bannerSide = new Map();
  function drawBanners() {
    if (!map) return;
    if (bannerLayer) map.removeLayer(bannerLayer);
    bannerLayer = L.layerGroup(BANNERS.map((b) => {
      const [sx, sy] = bannerSide.get(b.desk) || [1, 1];
      return L.marker(b.at, { keyboard: false, interactive: false, zIndexOffset: 3000, icon: L.divIcon({ className: 'h-co-wrap', iconSize: [0, 0], iconAnchor: [0, 0], html: bannerHtml(b, sx, sy) }) });
    })).addTo(map);
  }
  /* A card that would run off the map turns to the other side of its dot. */
  function placeBanners() {
    if (!map) return;
    const box = map.getContainer().getBoundingClientRect();
    let moved = false;
    BANNERS.forEach((b) => {
      const p = map.latLngToContainerPoint(b.at);
      const card = map.getContainer().querySelector(`.h-co[href="${HD[b.desk].href}"]`);
      const w = card ? card.offsetWidth : 200, h = card ? card.offsetHeight : 70;
      const k = phone() ? 0.55 : 1;
      const sx = p.x + b.out * k + w + 8 > box.width ? -1 : 1;
      const sy = p.y + b.drop * k + h + 8 > box.height ? -1 : 1;
      const was = bannerSide.get(b.desk) || [1, 1];
      if (was[0] !== sx || was[1] !== sy) { bannerSide.set(b.desk, [sx, sy]); moved = true; }
    });
    if (moved) drawBanners();
  }
  let bannerWired = false;
  function wireBanners() {
    if (bannerWired) return;
    bannerWired = true;
    const fade = () => { map.getContainer().classList.toggle('h-close-in', map.getZoom() > 6.5); placeBanners(); };
    map.on('zoomend moveend resize', fade);
    fade();
  }

  /* ---------- The legend: each desk's own, in full; pick whose ---------- */
  function legendBody(desk) {
    if (desk === 'yemen') {
      const lo = yeLayers();
      const row = app('sideLegendRow');
      const ctl = ((D.ydata && D.ydata.control) || []).map((c) => row(A('sideColor')(c), A('controlShortName')(c), !!lo[A('controlLayerKey')(c.id)], `data-layer="${esc(A('controlLayerKey')(c.id))}"`)).join('');
      const colors = app('COLORS') || {};
      return `<div class="leg-sec">Who</div>${ctl}${row(colors.saudi, 'Saudi Arabia', !!lo.saudi, 'data-layer="saudi"')}${A('yemenEventRows')() || ''}`;
    }
    const p = irPins();
    const sides = (app('IRAN_PIN_SIDES') || []).filter(([k]) => k !== 'other' || D.events.some((e) => e.desk === 'iran' && A('iranSideOf')(e) === 'other'));
    const row = app('sideLegendRow');
    return `<p class="leg-sub leg-who">Who</p>${sides.map(([k, c, n]) => row(c, n, p.on[k] !== false, `data-side="${k}"`)).join('')}
      ${A('iranKindRows')() || ''}`;
  }
  let legendCollapsed = true; // Closed at first, as on the desks (user, 17 Oct).
  function drawLegend() {
    const d = S.legend;
    legendBox.classList.toggle('collapsed', legendCollapsed);
    legendBox.innerHTML = `<div class="leg-head"><span class="leg-title">Legend</span><button type="button" class="leg-collapse" aria-label="${legendCollapsed ? 'Expand legend' : 'Collapse legend'}" aria-expanded="${legendCollapsed ? 'false' : 'true'}">${legendCollapsed ? '▸' : '▾'}</button></div>
      <div class="h-leg-pick" role="tablist" aria-label="Whose legend">${['yemen', 'iran'].map((k) => `<button type="button" role="tab" data-leg="${k}" aria-selected="${k === d}">${FLAG[k]}<span>${HD[k].short}</span></button>`).join('')}</div>
      <div class="leg-body"><p class="leg-hint">Tick to show, untick to hide.</p>${legendBody(d)}</div>`;
  }
  function wireLegend() {
    try { L.DomEvent.disableClickPropagation(legendBox); L.DomEvent.disableScrollPropagation(legendBox); } catch (e) { /* no map yet */ }
    legendBox.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const t = ev.target;
      const pick = t.closest('[data-leg]');
      // Opens from a click anywhere on it, closes from its head (user, 18 Oct).
      if (t.closest('.leg-head') || (legendCollapsed && !pick)) { legendCollapsed = !legendCollapsed; drawLegend(); return; }
      if (pick) { S.legend = pick.dataset.leg; drawLegend(); return; }
      const b = t.closest('.leg-item');
      if (!b) return;
      if (S.legend === 'yemen') {
        if (b.dataset.side) { const s = yeSides(); s[b.dataset.side] = s[b.dataset.side] === false; }
        else if (b.dataset.layer) { const lo = yeLayers(); lo[b.dataset.layer] = !lo[b.dataset.layer]; }
      } else {
        const p = irPins();
        if (b.dataset.kind) p.kinds[b.dataset.kind] = p.kinds[b.dataset.kind] === false;
        else if (b.dataset.side) p.on[b.dataset.side] = !p.on[b.dataset.side];
      }
      drawLegend(); restyleControl(); drawMarks();
    });
  }

  /* ---------- The page's frame ---------- */
  function chromeHtml() {
    return `<div class="mast">
      <span class="mast-date"></span>
      <div class="mast-mid"><a class="mast-name" href="/" aria-label="The Situation Room"><span class="mn">The Situation Room</span></a><span class="mast-line">Open-source intelligence</span></div>
      <span class="mast-end"></span>
    </div>
    <header class="top">
      <div class="brand">
        <h1 class="desk-label desk-tabs" aria-label="All desks">${A('deskTabsHtml')(null) || ''}</h1>
      </div>
      <div class="stamp"><span class="pulse" aria-hidden="true"></span><span id="h2-upd"></span></div>
    </header>`;
  }
  const toolbarHtml = () => `<div class="toolbar">
    <div class="time-filter" id="time-filter">
      <span class="tf-label">Map:</span>
      <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
      <input type="date" id="map-date" min="${WAR_FROM}" aria-label="Day" />
      <span class="tf-range" id="tf-range" hidden><span class="tf-to" aria-hidden="true">to</span><input type="date" id="map-to" min="${WAR_FROM}" aria-label="To" /></span>
      <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day" hidden><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
      <button type="button" id="btn-day-today">Today</button>
      <span class="tf-sep" aria-hidden="true"></span>
      <button type="button" id="btn-conflict-all" aria-label="The whole war"><span class="tf-long">Whole war</span><span class="tf-short">All</span></button>
      <button type="button" id="btn-period" aria-expanded="false" aria-controls="tf-range" aria-label="Pick your own dates">Custom</button>
    </div>
  </div>`;
  const stageHtml = () => `<main class="stage h-stage h-solo" id="h2-stage">
    <section class="map-wrap" id="map-wrap"><div id="h-map"></div><button type="button" class="map-full" id="h-focus" aria-pressed="false" aria-label="Full screen map" title="Full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="mf-open" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path class="mf-close" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button><div class="legend" id="h-legend"></div><div class="map-chip" id="h2-chip"></div></section>
  </main>`;

  function wireChrome() {
    // A desk's button, callout or link flies the map in to that desk, which carries on from there (app.js deskGo).
    A('wireDeskGo')(() => map);
    // The desks' own masthead menu (public/app.js); the theme is picked there.
    try { const f = app('installMast'); if (f) f(); } catch (e) { console.error(e); }
    // The theme lives on <html>; the maps and their colours follow it.
    new MutationObserver(() => {
      if (tiles) tiles.setUrl(tileUrl());
      INK.clear(); restyleControl(); drawLegend(); drawMarks();
      // The stories' maps are drawn again in the new colours.
      if ($('panel') && minis.length) mountMinis($('panel'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function stampUpd() {
    const el = $('h2-upd');
    if (el && D.asOf) el.textContent = 'Updated ' + (app('fmtClock') ? app('fmtClock')(D.asOf) : new Date(D.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  }

  /* ---------- The toolbar: a day, the whole war or a period, as on the desks ---------- */
  function syncToolbar() {
    const d = S.day || today(), max = today();
    const date = $('map-date'), to = $('map-to'), box = $('tf-range');
    date.max = max; to.max = max;
    date.value = S.mode === 'range' ? S.from : d;
    if (S.mode === 'range') to.value = S.to;
    box.hidden = S.mode !== 'range';
    $('btn-day-today').classList.toggle('on', S.mode === 'day' && d === max);
    $('btn-conflict-all').classList.toggle('on', S.mode === 'all');
    $('btn-period').classList.toggle('on', S.mode === 'range');
    $('btn-period').setAttribute('aria-expanded', String(S.mode === 'range'));
    // Forward only on a day before today (user, 17 Oct), as on the desks.
    $('btn-day-next').hidden = S.mode !== 'day' || d >= max;
    $('btn-day-prev').disabled = S.mode === 'day' && d <= WAR_FROM;
  }
  function setView(mode, a, b) {
    S.mode = mode;
    if (mode === 'day') S.day = a;
    if (mode === 'range') { S.from = a <= b ? a : b; S.to = a <= b ? b : a; }
    syncToolbar(); drawMarks();
    // A day before the live pins, the whole war or a period: the war's pins (read soon after the page is up).
    const oldest = D.events.filter((e) => !e.researched).reduce((m, e) => (e.at < m ? e.at : m), '9');
    const need = !warIn && (mode === 'all' || (mode === 'day' && a < dayOf(oldest)) || (mode === 'range' && S.from < dayOf(oldest)));
    if (need) { chipEl.textContent = 'Loading the whole war’s pins…'; loadWar().then((ok) => { if (ok) drawMarks(); }); }
  }
  function wireToolbar() {
    const date = $('map-date'), to = $('map-to');
    $('btn-day-prev').onclick = () => setView('day', shift(S.mode === 'day' ? (S.day || today()) : today(), -1));
    $('btn-day-next').onclick = () => { const n = shift(S.day || today(), 1); if (n <= today()) setView('day', n); };
    $('btn-day-today').onclick = () => setView('day', today());
    $('btn-conflict-all').onclick = () => setView('all');
    const keep = (v) => (v < WAR_FROM ? WAR_FROM : v > today() ? today() : v);
    // The period's first day is the day's own date box, its last a second one beside it (user, 17 Oct).
    date.onchange = () => {
      if (!date.value) return;
      if (S.mode === 'range') setView('range', keep(date.value), keep(to.value || today()));
      else setView('day', keep(date.value));
    };
    to.onchange = () => { if (to.value) setView('range', keep(date.value || today()), keep(to.value)); };
    $('btn-period').onclick = () => {
      if (S.mode === 'range') { setView('day', today()); return; }
      const end = S.mode === 'day' ? (S.day || today()) : today();
      setView('range', S.mode === 'day' && S.day && S.day !== today() ? S.day : keep(shift(end, -6)), end);
    };
  }
  /* The box at the map's top right, as on the desks: how many events the map shows, and when. */
  function drawChip(n) {
    const d = S.day || today();
    const many = `${n.toLocaleString('en-GB')} event${n === 1 ? '' : 's'}`;
    chipEl.textContent = S.mode === 'all'
      ? (n ? `${many} on the map since ${longDay(WAR_FROM)}` : 'No event on the map')
      : S.mode === 'range'
        ? (n ? `${many} on the map, ${longDay(S.from)} to ${longDay(S.to)}` : `No event on the map, ${longDay(S.from)} to ${longDay(S.to)}`)
        : (n ? `${many} on the map on ${longDay(d)}` : `No event on the map on ${longDay(d)}`);
  }
  /** "Show on map" on a story's report: its pin on this map, on its day, its note open (user, 17 Oct). */
  function showPin(fp) {
    const e = pinsOf(fp)[0];
    if (!e || !map) return;
    if (S.mode !== 'day' || (S.day || today()) !== evDay(e)) setView('day', evDay(e));
    scrollToMap();
    setTimeout(() => {
      try { map.invalidateSize(); } catch (err) { /* gone */ }
      const mk = markOf.get(e.fp);
      map.once('moveend', () => { if (mk) mk.openPopup(); });
      map.flyTo([e.lat, e.lng], Math.max(map.getZoom(), 7), { duration: 0.8 });
    }, 380);
  }
  /*
   * "Show on map" opens the small map, as on the desks (user, 18 Oct): beside the button on a wide
   * screen, a sheet on a phone, the report's pins pulsing among that day's others on its desk; only
   * its "Show on the main map" moves the big map.
   */
  let popWired = false;
  function showPinPop(fp, anchor) {
    const mine = pinsOf(fp);
    const open = app('openMapPop');
    if (!mine.length || !open || !window.L) return showPin(fp);
    if (!popWired) {
      popWired = true;
      const off = () => { const ps = document.getElementById('pin-sheet'); if (ps && ps.classList.contains('show')) A('closePinSheet')(); };
      document.addEventListener('click', (ev) => { if (!ev.target || ev.target.closest('#pin-sheet, .card-map')) return; const ps = document.getElementById('pin-sheet'); if (ps && ps.classList.contains('as-pop')) off(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') off(); });
    }
    const fps = new Set(mine.map((e) => e.fp));
    const day = evDay(mine[0]);
    const others = D.events.filter((e) => !e.researched && !fps.has(e.fp) && e.desk === mine[0].desk && evDay(e) === day);
    const r = byFp.get(fp);
    const icon = app('sidePinIcon'), lean = app('popLeanClass');
    open({
      title: (r && r.h) || mine[0].label || '',
      anchor: window.innerWidth < 720 ? null : anchor,
      legend: '',
      go: () => showPin(fp),
      build: (m) => {
        miniControl(m);
        [...others, ...mine].forEach((e) => {
          const me = fps.has(e.fp);
          const mk = icon
            ? L.marker([e.lat, e.lng], { icon: icon(e.cat, inkOf(e), me ? ' pin-pulse' : '', esc(e.label || '')), zIndexOffset: me ? 2000 : 0 })
            : L.circleMarker([e.lat, e.lng], { radius: me ? 6 : 4, weight: 1, color: '#fff', fillColor: inkOf(e), fillOpacity: 0.95 });
          mk.bindPopup(() => noteHtml(e), { className: e.desk === 'yemen' && lean ? lean(e) : '', maxWidth: 260, maxHeight: 300 }).addTo(m);
        });
        const b = L.latLngBounds(mine.map((e) => [e.lat, e.lng]));
        m.fitBounds(b.pad(0.5), { maxZoom: 7, animate: false });
      },
    });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.card-map[data-pin-of]');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    showPinPop(b.dataset.pinOf, b);
  });
  function scrollToMap() {
    const el = document.querySelector('.toolbar');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 6, behavior: 'smooth' });
  }

  /* ---------- Small maps for the stories ---------- */
  let minis = [];
  /* A story's map is the big map in small (user, 17 Oct): the same control colours, the same pins and notes. */
  function miniControl(m) {
    if (!m.getPane('hCtrl')) { m.createPane('hCtrl'); m.getPane('hCtrl').style.zIndex = 350; m.getPane('hCtrl').style.pointerEvents = 'none'; }
    (m._hCtrl || []).forEach((l) => m.removeLayer(l));
    m._hCtrl = [];
    const byIso = A('controlByIso')(D.ydata || {}) || {};
    const add = (geo, style) => { if (geo && style) m._hCtrl.push(L.geoJSON(geo, { pane: 'hCtrl', interactive: false, style }).addTo(m)); };
    try { add(irGeo, app('iranCountryStyle')); } catch (e) { /* not yet */ }
    try { const st = app('districtStyle'); add(app('districtGeo'), st && ((f) => st(f, byIso))); } catch (e) { /* not yet */ }
    try { const st1 = app('styleFeature'); add(yeMain, st1 && ((f) => st1(f, byIso))); } catch (e) { /* not yet */ }
  }
  function miniMap(el, id) {
    const t = TOPIC[id];
    // It moves and zooms as the big one, on a phone too (user, 17 Oct: move around in the story maps).
    const m = L.map(el, { zoomControl: true, attributionControl: false, dragging: true, scrollWheelZoom: false, doubleClickZoom: true, boxZoom: false, keyboard: false, touchZoom: true, tap: true, zoomSnap: 0.25 });
    m._hTiles = L.tileLayer(tileUrl(), { noWrap: true }).addTo(m);
    m.fitBounds(t.bounds, { padding: [6, 6] });
    miniControl(m);
    // Zooms with the wheel too, once clicked, so the page still scrolls past it; pinch and double-click always (user, 18 Oct).
    m.on('click mousedown focus', () => m.scrollWheelZoom.enable());
    m.on('mouseout blur', () => m.scrollWheelZoom.disable());
    const icon = app('sidePinIcon'), lean = app('popLeanClass'), jit = app('jitter') || ((lat, lng) => [lat, lng]);
    const atSpot = new Map();
    t.events.slice().sort((a, b) => (a.at < b.at ? -1 : 1)).forEach((e) => {
      const k = `${Math.round(e.lat * 100)},${Math.round(e.lng * 100)}`;
      const n = atSpot.get(k) || 0;
      atSpot.set(k, n + 1);
      const ageH = (Date.now() - Date.parse(e.at)) / 3600e3;
      const mk = icon
        ? L.marker(n ? jit(e.lat, e.lng, n) : [e.lat, e.lng], { icon: icon(e.cat, inkOf(e), ageH <= 6 ? ' fresh' : '', esc(e.label || '')), zIndexOffset: Math.round(1000 - ageH), riseOnHover: true })
        : L.circleMarker([e.lat, e.lng], { radius: 4, weight: 1, color: '#fff', fillColor: inkOf(e), fillOpacity: 0.95 });
      mk.bindPopup(() => noteHtml(e), { className: e.desk === 'yemen' && lean ? lean(e) : '', maxWidth: 260, maxHeight: 300, autoPan: true });
      mk.addTo(m);
    });
    minis.push(m);
  }
  const mini = (id) => `<div class="h2-mini-map" data-mini="${id}" aria-label="${esc(TOPIC[id].name)}: map of its events"></div>`;
  function mountMinis(root) {
    minis.forEach((m) => { try { m.remove(); } catch (e) { /* gone */ } });
    minis = [];
    root.querySelectorAll('[data-mini]').forEach((el) => miniMap(el, el.dataset.mini));
  }

  /* ---------- Follow a story ---------- */
  function ordered() {
    const byTime = T.filter((t) => !PICKS.includes(t.id)).sort((a, b) => ((latestOf(b) || '') > (latestOf(a) || '') ? 1 : -1));
    return [...PICKS.map((id) => TOPIC[id]).filter(Boolean), ...byTime];
  }
  const deskLinks = (t) => `<div class="h2-links">${(t.desk === 'both' ? ['iran', 'yemen'] : [t.desk]).map((d) => `<a class="h2-go h2-go-desk" href="${HD[d].href}" data-desk-go>${FLAG[d]}${HD[d].short} desk →</a>`).join('')}</div>`;
  function show(id) {
    const t = TOPIC[id];
    if (!t) return;
    S.story = id;
    document.querySelectorAll('#index button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.i === id)));
    let left, right;
    if (t.trump) {
      left = t.trump[0] ? quote(t.trump[0]) : '';
      right = t.trump.length > 1 ? `<h4>Earlier</h4><div class="feed">${t.trump.slice(1, 5).map((s) => trumpCard(s)).join('')}</div>` : '';
    } else if (t.oil) {
      left = oilHtml(t.oil);
      right = t.cards.length ? `<h4>Latest reports</h4><div class="feed">${t.cards.slice(0, 4).map((r) => card(r, { noReply: true })).join('')}</div>` : '';
    } else {
      // The latest: its first point, the rest behind Read more (user, 17 Oct).
      const pts = (t.pts || []).slice(0, 4);
      const more = pts.length > 1 ? `<ol class="pts h2-more" start="2" hidden>${pts.slice(1).map((p) => `<li>${esc(p.t)}</li>`).join('')}</ol><button type="button" class="h2-readmore toggle-sit" aria-expanded="false">Read more</button>` : '';
      // What the map shows, in a short plain line above it (user, 18 Oct).
      left = (t.events.length ? `<p class="h2-map-note">${esc(t.mapNote || '')}</p>${mini(id)}` : '') +(pts.length ? `<div class="h2-latest${more ? ' h2-tap' : ''}"><h4${t.events.length ? ' style="margin-top:.8rem"' : ''}>The latest</h4><ol class="pts"><li>${esc(pts[0].t)}</li></ol>${more}</div>` : '');
      const list = rest(t).slice(0, 4);
      right = list.length ? `<h4>Latest reports</h4><div class="feed">${list.map((r) => card(r, { noReply: true })).join('')}</div>` : '';
    }
    $('panel').innerHTML = `${kicker(t)}<h3>${esc(t.name)}</h3><div class="g-body"><div>${left}</div><div>${right}</div></div>${deskLinks(t)}`;
    mountMinis($('panel'));
    // The whole Latest area opens and closes it, not only the button (user, 17 Oct).
    const rm = $('panel').querySelector('.h2-readmore'), tap = $('panel').querySelector('.h2-tap');
    if (rm && tap) tap.onclick = (e) => {
      if (e.target.closest('a') || String(getSelection()).trim()) return;
      const ol = $('panel').querySelector('.h2-more'), open = ol.hidden;
      ol.hidden = !open;
      rm.textContent = open ? 'Show less' : 'Read more';
      rm.setAttribute('aria-expanded', String(open));
    };
  }
  function renderStories() {
    const items = ordered();
    const idx = $('index');
    idx.innerHTML = items.map((t) => `<button type="button" role="tab" data-i="${t.id}" aria-selected="false">${kicker(t)}<b>${esc(t.name)}</b><time>${esc(timeOf(latestOf(t)))}</time></button>`).join('');
    edges();
    const keep = items.find((t) => t.id === S.story);
    if (items.length) show(keep ? keep.id : items[0].id); else $('panel').innerHTML = '';
  }
  let wrap, idxEl;
  function edges() {
    const max = idxEl.scrollWidth - idxEl.clientWidth;
    wrap.classList.toggle('at-start', idxEl.scrollLeft <= 4);
    wrap.classList.toggle('at-end', idxEl.scrollLeft >= max - 4);
  }

  /* ---------- Start ---------- */
  function bodyHtml() {
    return `<div id="g-body">
      <section class="h2-sec">
        <h2>Follow a story</h2>
        <div class="g-wrap">
          <div class="g-idx at-start" id="idx">
            <button type="button" class="g-arrow prev" aria-label="Earlier stories"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
            <nav class="g-index" id="index" role="tablist" aria-label="Stories"></nav>
            <button type="button" class="g-arrow next" aria-label="More stories"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
          </div>
          <div class="g-panel" id="panel"></div>
        </div>
      </section>
    </div>
    <footer><span>Tiles © Esri</span></footer>`;
  }

  let started = false;
  async function startHome() {
    const root = $('home-root');
    if (!root || root.dataset.on) return;
    if (!window.L || !app('sidePinIcon')) { setTimeout(startHome, 150); return; }
    root.dataset.on = '1';
    started = true;
    root.innerHTML = `<div id="chrome">${chromeHtml()}</div><div id="toolbar">${toolbarHtml()}</div><div id="stage">${stageHtml()}</div>${bodyHtml()}`;
    wireChrome();
    chipEl = $('h2-chip');
    legendBox = $('h-legend');
    if (phone()) legendCollapsed = true;
    map = L.map($('h-map'), { zoomControl: true, attributionControl: true, worldCopyJump: false, minZoom: 3, zoomSnap: 0.25, closePopupOnClick: false });
    tiles = L.tileLayer(tileUrl(), { maxZoom: 18, noWrap: true, attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ' }).addTo(map);
    map.fitBounds(REGION);
    // Back from a desk: the map starts where the desk's flight out ended.
    A('deskArrive')(map);
    marks = L.layerGroup().addTo(map);
    // Full screen, as on the desks (user, 17 Oct): the map alone under the header; Escape or the button again leaves it.
    const fb = $('h-focus');
    const focus = (on) => {
      document.body.classList.toggle('map-focus', on);
      fb.setAttribute('aria-pressed', String(on));
      fb.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen map');
      fb.title = on ? 'Exit full screen' : 'Full screen';
      if (on) $('map-wrap').scrollIntoView({ block: 'start' });
      setTimeout(() => { map.invalidateSize(); placeBanners(); }, 60);
    };
    L.DomEvent.disableClickPropagation(fb);
    fb.onclick = () => focus(!document.body.classList.contains('map-focus'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('map-focus') && !document.querySelector('.leaflet-popup')) focus(false); });
    // A note's "Read more", its pictures and videos, as on the desks.
    map.on('popupopen', (e) => {
      const el = e.popup.getElement();
      if (!el) return;
      try { const w = app('wireMediaClicks'); if (w) w(el); L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el); } catch (err) { /* plain note */ }
      const btn = el.querySelector('.pop-toggle'), full = el.querySelector('.pop-full');
      if (!btn || !full) return;
      const toggle = () => { const open = !full.classList.contains('open'); full.classList.toggle('open', open); btn.textContent = open ? 'Hide detail' : 'Read more'; try { e.popup._updateLayout(); e.popup._updatePosition(); } catch (err) { /* laid out */ } };
      btn.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); toggle(); };
      // Anywhere on the note opens and closes it, as on the desks (user, 18 Oct).
      const content = el.querySelector('.leaflet-popup-content');
      if (content) {
        content.style.cursor = 'pointer';
        content.onclick = (ev) => { if (ev.target.closest('a, button, img, video, .media') || String(window.getSelection() || '')) return; toggle(); };
      }
    });
    wireToolbar();
    wireLegend();
    S.day = today();
    syncToolbar();
    drawLegend();
    drawBanners(); wireBanners();
    chipEl.textContent = 'Loading the map…';

    wrap = $('idx'); idxEl = $('index');
    idxEl.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges);
    wrap.querySelector('.next').onclick = () => idxEl.scrollBy({ left: idxEl.clientWidth * 0.7, behavior: 'smooth' });
    wrap.querySelector('.prev').onclick = () => idxEl.scrollBy({ left: -idxEl.clientWidth * 0.7, behavior: 'smooth' });
    // A small nudge the first time the row comes into view on a phone, so it reads as something to swipe.
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting && phone()) { wrap.classList.add('hinting'); o.disconnect(); } }, { threshold: 0.6 }).observe(wrap);
    idxEl.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) show(b.dataset.i); });

    const ctrl = drawControl();
    await load();
    buildTopics();
    stampUpd();
    drawMarks();
    drawLegend();
    renderStories();
    await ctrl;
    restyleControl();
    drawLegend();
    // The countries' map is read now: Inside Iran's map can tell Iran's land from the rest.
    buildTopics();
    renderStories();
    // The whole war's pins come in behind the page, so Whole war and older days open at once,
    // and the nuclear file's map has every attack on a nuclear site since 28 Feb.
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    idle(() => loadWar().then((ok) => { if (!ok) return; if (S.mode !== 'day') drawMarks(); buildTopics(); renderStories(); }));

    // New reports every two minutes while the page is in view.
    setInterval(async () => {
      if (document.hidden) return;
      await load();
      buildTopics();
      stampUpd();
      drawMarks();
      renderStories();
    }, 120_000);
  }
  window.startHome = startHome;
  if (!started && document.getElementById('home-root')) startHome();
})();

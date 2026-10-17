/*
 * The home page (Mock G, chosen by the user on 17 Oct).
 * - One shared map for every desk, with the desks' own toolbar above it and Latest reports on its right.
 * - The header's desk menu turns the page into a desk in place: the address changes (#iran, #yemen), the map
 *   flies to the desk and the part under the map cross-fades to the desk's own. Back and forward work.
 * - Latest developments under the map, most important first; then "Follow a story".
 * Everything comes from the live feeds: /api/desk, /api/brief, /api/trump and /api/oil.
 * public/app.js is loaded on every page; its masthead menu, theme button and source names are used here.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const phone = () => matchMedia('(max-width:720px)').matches;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = (name) => { try { return eval(name); } catch (e) { return null; } };

  /* ---------- The desks ---------- */
  const HD = {
    iran: { name: 'Iran conflict', short: 'Iran', href: '/iran-conflict-desk', from: '2026-02-28', tz: 'Asia/Tehran', clock: 'Tehran' },
    yemen: { name: 'Yemen conflict', short: 'Yemen', href: '/yemen-conflict-desk', from: '2026-07-13', tz: 'Asia/Aden', clock: 'Sanaa' },
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
  const ALL_FLAG = '<svg class="flag" viewBox="0 0 18 12" aria-hidden="true"><rect width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-opacity=".55"/><path d="M3 4h12M3 6h12M3 8h8" stroke="currentColor" stroke-opacity=".55"/></svg>';
  const ICON_EXT = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';

  /* ---------- Times: the reader's own clock, as on the desks; the map's days on the desks' clock ---------- */
  const fmt = (at) => {
    const d = new Date(at);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };
  const dayOf = (at) => new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const today = () => dayOf(Date.now());
  const shift = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayName = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  /* ---------- Pins: one set for every desk ---------- */
  const EVENT_SVG = {
    strike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.2c2.6 2.3 4.1 5.4 4.3 9.2l1.9 2a1 1 0 0 1 .3.7v3.3l-3.3-1.7-.8.8v2.1l-2.4 2.4-2.4-2.4v-2.1l-.8-.8L5.5 18v-3.3a1 1 0 0 1 .3-.7l1.9-2c.2-3.8 1.7-6.9 4.3-9.2zm0 5.1a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    combat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.3 2.2 7 2.9l11.4 11.4-2.1 2.1L4.9 5 3.3 2.2zm17.4 0L19.1 5 14 10.1l2.1 2.1L21.1 7l.7-3.7-1.1-1.1zM2.9 19.3l2.6-2.6 2.1 2.1-2.6 2.6a1.5 1.5 0 0 1-2.1-2.1zm18.2 0a1.5 1.5 0 0 1-2.1 2.1l-2.6-2.6 2.1-2.1 2.6 2.6zM8.9 13.2l2.1 2.1-2.4 2.4-2.1-2.1 2.4-2.4z"/></svg>',
    vessel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2.5h1.4v4H11zM7.5 7h8.5v5H7.5zM16.8 5h2.4v7h-2.4zM1.5 13h21l-3.3 5.2H4.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M2 21.2c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.3-1.2 1.7 1.2 3.4 1.2"/></svg>',
    energy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1c1.9 2.2 4 4 4 6.8a4 4 0 0 1-8 0c0-1.5.8-2.5 1.6-3.3.1 1.2.7 2 1.4 2.2C10.5 4.7 11 2.8 12 1z"/><path fill="currentColor" fill-rule="evenodd" d="M4 13.5h16V22H4zM4 16.4h16v1.3H4zM4 19.2h16v.01H4z"/></svg>',
    nuclear: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="12" r="2.3"/><path d="M17 3.34A10 10 0 0 0 7 3.34L10.2 8.88A3.6 3.6 0 0 1 13.8 8.88z"/><path d="M17 3.34A10 10 0 0 0 7 3.34L10.2 8.88A3.6 3.6 0 0 1 13.8 8.88z" transform="rotate(120 12 12)"/><path d="M17 3.34A10 10 0 0 0 7 3.34L10.2 8.88A3.6 3.6 0 0 1 13.8 8.88z" transform="rotate(240 12 12)"/></g></svg>',
  };
  const PIN_KINDS = [['strike', 'Strike or launch'], ['energy', 'Energy site hit'], ['nuclear', 'Nuclear site hit'], ['combat', 'Fighting'], ['vessel', 'At sea']];
  const PIN_INK = { strike: '#ef4444', energy: '#f97316', nuclear: '#a3e635', combat: '#facc15', vessel: '#22d3ee' };
  const IRAN_SIDES = [['iran', 'Iran', '#dc2626'], ['israel', 'Israel', '#60a5fa'], ['us', 'US', '#2563eb'], ['hezbollah', 'Hezbollah', '#eab308'], ['iraqi_militias', 'Iraqi and Syrian militias', '#f97316'], ['houthi', 'Houthis', '#16a34a'], ['gulf', 'Gulf states and others', '#a855f7'], ['other', 'Not stated', '#94a3b8']];
  const IRAN_INK = Object.fromEntries(IRAN_SIDES.map(([k, , c]) => [k, c]));
  const sideOf = (e) => (IRAN_INK[e.actor] ? e.actor : 'other');
  /* A strike is "energy" or "nuclear" only when the report names the site hit; otherwise it stays a strike. */
  const NUCLEAR = /\bnuclear (site|facilit|plant|reactor|complex)|\b(fordow|natanz|bushehr|arak|isfahan nuclear|enrichment (site|plant|facilit))/i;
  const ENERGY = /aramco|refiner|oil (field|facilit|terminal|depot|install)|fuel (depot|tank|storage)|storage tank|pipeline|power (station|plant)|gas (field|plant|facilit)|petrochem|\blng\b|desalination|electricity (station|grid)/i;
  const AT_SEA = /\b(ship|ships|vessel|tanker|container ship|frigate|sank|sunk|sunken|sinks|anti-ship|naval mine|cargo)\b/i;
  const GROUND = /\b(artillery|shell|shells|shelling|tank|sniper|clash|clashes)\b|\b(forces|army|troops)\b[^|]*\b(burn|bring|combing|sweep|carr(?:y|ied) out|raid|advance|deploy|demoli)/i;
  function kindOf(e) {
    const s = e.label || '';
    if (NUCLEAR.test(s)) return 'nuclear';
    if (ENERGY.test(s) && !/tanker/i.test(s)) return 'energy';
    if (e.desk !== 'iran') return PIN_INK[e.type] ? e.type : 'strike';
    if (e.sea || AT_SEA.test(s)) return 'vessel';
    if (GROUND.test(s)) return 'combat';
    return 'strike';
  }

  /* ---------- Map views ---------- */
  const REGION = [[11.5, 32.5], [38.5, 61]];
  const DESK_BOUNDS = { iran: [[24.5, 33.5], [39.8, 62.5]], yemen: [[12, 38.5], [27.5, 54.5]] };

  /* ---------- The data ---------- */
  const D = { asOf: null, reports: [], events: [], trump: [], devs: {}, arenas: [], fronts: [], oil: null, briefs: {} };
  let byFp = new Map();
  const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
  /* The Iran map leaves out the Houthis' attacks and the pins it shares with the Yemen desk, as the desk does. */
  const iranPinShown = (e) => e.actor !== 'houthi' && !(Array.isArray(e.desks) && e.desks.includes('yemen'));
  function eventsOf(desk, rows) {
    return (rows || []).filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number' && (desk !== 'iran' || iranPinShown(e)))
      .map((e) => {
        const x = { desk, fp: String(e.fp), at: e.at, lat: e.lat, lng: e.lng, place: e.place || '', label: e.label || '', src: srcName(e.source), url: e.url || '', type: e.type, actor: e.actor, sea: !!e.sea, ni: e.ni, researched: !!e.researched };
        x.kind = kindOf(x);
        return x;
      });
  }
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

  async function load() {
    const [di, dy, bi, by, ti, ty, oil] = await Promise.all([
      getJson('/api/desk?desk=iran'), getJson('/api/desk?desk=yemen'), getJson('/api/brief?desk=iran'), getJson('/api/brief?desk=yemen'),
      getJson('/api/trump'), getJson('/api/trump?desk=yemen'), getJson('/api/oil'),
    ]);
    if (di || dy) {
      D.reports = mergeReports([reportsOf('yemen', dy && dy.reports), reportsOf('iran', di && di.reports)]);
      byFp = new Map(D.reports.map((r) => [r.fp, r]));
      const ye = eventsOf('yemen', dy && dy.events), yeFps = new Set(ye.map((e) => e.fp));
      const live = [...ye, ...eventsOf('iran', di && di.events).filter((e) => !yeFps.has(e.fp))];
      // Pins already read for a longer view stay.
      const keep = new Map(D.events.map((e) => [e.desk + e.fp, e]));
      live.forEach((e) => keep.set(e.desk + e.fp, e));
      D.events = [...keep.values()];
      D.asOf = [di && di.updatedAt, dy && dy.updatedAt].filter(Boolean).sort().pop() || D.asOf;
    }
    if (bi || by) {
      D.briefs = { iran: bi && bi.ok !== false && !bi.pending ? bi : D.briefs.iran, yemen: by && by.ok !== false ? by : D.briefs.yemen };
      D.arenas = (D.briefs.iran && D.briefs.iran.arenas) || [];
      D.fronts = (D.briefs.yemen && D.briefs.yemen.fronts) || [];
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

  /* The whole war's pins, read once when a longer view is asked for. */
  let warP = null;
  function loadWar() {
    warP ??= Promise.all([
      getJson(`/api/desk?desk=yemen&since=${HD.yemen.from}`),
      getJson(`/api/desk?desk=iran&since=${HD.iran.from}`),
      getJson(`/iran-map-pins.json?v=${assetV()}`),
    ]).then(([y, i, past]) => {
      const keep = new Map(D.events.map((e) => [e.desk + e.fp, e]));
      const ye = eventsOf('yemen', y && y.events);
      ye.forEach((e) => { if (!keep.has('yemen' + e.fp)) keep.set('yemen' + e.fp, e); });
      const ir = eventsOf('iran', i && i.events);
      ir.forEach((e) => { if (!keep.has('iran' + e.fp)) keep.set('iran' + e.fp, e); });
      // The war's researched attacks, before the desk began reading (the Iran desk's own file).
      const first = ir.reduce((m, e) => Math.min(m, Date.parse(e.at) || Infinity), Infinity);
      if (past && Array.isArray(past.pins)) {
        past.pins.forEach(([md, actor, lat, lng, hm, sea], ni) => {
          const at = hm ? `${past.year}-${md}T${hm}:00Z` : `${past.year}-${md}T12:00:00+03:00`;
          if (!(Date.parse(at) < first)) return;
          const e = { desk: 'iran', fp: 'rs#' + ni, ni, researched: true, at, lat, lng, actor, sea: !!sea, place: '', label: '', src: '', url: '', type: 'strike' };
          e.kind = sea ? 'vessel' : 'strike';
          keep.set('iran' + e.fp, e);
        });
      }
      D.events = [...keep.values()];
      return true;
    }).catch(() => { warP = null; return false; });
    return warP;
  }
  const assetV = () => { try { const m = /[?&]v=([^&]+)/.exec(document.querySelector('script[src*="/app.js?v="]').src); return m ? m[1] : 'h'; } catch (e) { return 'h'; } };
  /* The researched pins' notes: read only when one of them is opened. */
  let notesP = null, notes = null;
  const loadNotes = () => (notesP ??= getJson(`/iran-map-notes.json?v=${assetV()}`).then((n) => { notes = (n && n.notes) || []; }));
  function noted(e) {
    if (!e.researched || e.label) return true;
    const n = notes && notes[e.ni];
    if (!n) return false;
    [, e.place, e.label, e.src, e.url] = n;
    e.kind = kindOf(e);
    return true;
  }

  /* ---------- Small pieces ---------- */
  const deskTag = (desk) => (desk === 'both'
    ? `<span class="h-tags">${deskTag('iran')}${deskTag('yemen')}</span>`
    : `<button type="button" class="h-tag h-tag-${desk}" data-zoom-desk="${desk}" title="${esc(HD[desk].name)}">${FLAG[desk]}<span>${esc(HD[desk].short)}</span></button>`);
  const deskOfReport = (r) => (r.desks.includes('iran') && r.desks.includes('yemen') ? 'both' : r.desks[0]);

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
        ${deskTag(deskOfReport(r))}
      </div>
      ${reply}
      <p class="headline">${esc(r.h)}</p>
      ${also.length ? `<p class="also">Also: ${also.slice(0, 4).map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(srcName(a.source))}</a>`).join(' · ')}</p>` : ''}
    </article>`;
  }
  function trumpCard(s, o) {
    const opts = o || {};
    return `<article class="card ir-us trump-st" data-fp="${esc(s.id)}">
      <div class="meta">
        <time datetime="${esc(s.at)}">${esc(fmt(s.at))}</time>
        <span class="src-wrap"><a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a><a class="src-go" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="Open source">${ICON_EXT}</a></span>
      </div>
      <p class="headline">Trump: ${esc(s.h)}</p>
      ${opts.body ? `<p class="lead">${esc(s.body)}</p>` : ''}
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
  let T = [], TOPIC = {};
  function buildTopics() {
    T = [
      { id: 'hormuz', name: 'Strait of Hormuz', desk: 'iran', bounds: [[24.3, 54.6], [27.8, 59]], pts: ptsOf(arena('hormuz')),
        cards: uniq([...flagged('arena:hormuz'), ...re(/hormuz/i)]) },
      { id: 'bab', name: 'Bab al-Mandab and the Red Sea', short: 'Bab al-Mandab', desk: 'yemen', bounds: [[11.4, 40.8], [16.4, 45.8]], pts: ptsOf(front('bab')),
        cards: uniq(re(/red sea|bab al-mandab|hodeidah|yanbu/i)) },
      { id: 'oil', name: 'Oil prices', desk: 'both', bounds: [[16, 44], [30.5, 60]], oil: D.oil,
        cards: uniq(re(/\boil prices?\b|\bbrent\b|\bwti\b|crude (?:price|futures|oil price)|per barrel|\bopec\b|oil market/i)) },
      { id: 'trump', name: 'Trump’s latest', desk: 'both', bounds: REGION, trump: D.trump, cards: [] },
      { id: 'energy', name: 'Energy sites under fire', short: 'Energy', desk: 'both', bounds: [[16.5, 38], [28.5, 56]],
        cards: uniq(re(/aramco|refiner|pipeline|oil (field|facilit|terminal)|power (station|plant)|gas field/i)) },
      { id: 'shipping', name: 'Shipping and attacks at sea', short: 'Shipping', desk: 'both', bounds: [[11, 37], [28.5, 60]],
        cards: uniq([...flagged('arena:hormuz').filter((r) => /\bship|vessel|tanker/i.test(r.h)), ...re(/\bships?\b|vessel|tanker|ukmto|freight|shipping/i)]) },
      { id: 'saudi', name: 'Saudi Arabia under Houthi fire', short: 'Saudi Arabia', desk: 'yemen', bounds: [[16, 36], [29, 56]], pts: ptsOf(front('saudi-home')),
        cards: uniq(re(/saudi|riyadh|dhahran|jizan|jazan|najran|yanbu|abha|khamis mushait/i).filter((r) => r.desks.includes('yemen'))) },
      { id: 'lebanon', name: 'Lebanon and Israel', short: 'Lebanon', desk: 'iran', bounds: [[32.4, 34.6], [34.7, 36.9]], pts: ptsOf(arena('lebanon')),
        cards: uniq([...flagged('arena:lebanon'), ...re(/lebanon|hezbollah|bint jbeil|beirut|galilee|litani|nabatieh|tyre/i)]) },
      { id: 'talks', name: 'Talks and mediation', short: 'Talks', desk: 'both', bounds: REGION, pts: ptsOf(arena('talks')),
        cards: uniq([...flagged('arena:talks'), ...re(/\btalks\b|negotiat|ceasefire|truce|mediat|envoy/i)]) },
      { id: 'nuclear', name: 'Iran’s nuclear file', short: 'Nuclear', desk: 'iran', bounds: [[25, 44], [39.8, 63]], pts: ptsOf(arena('nuclear')),
        cards: uniq([...flagged('arena:nuclear'), ...re(/nuclear|uranium|iaea|enrich|fordow|natanz/i)]) },
      { id: 'fronts', name: 'Yemen’s front lines', short: 'Yemen fronts', desk: 'yemen', bounds: [[12.4, 42.6], [17.2, 46.6]],
        pts: ['west-taiz', 'marib', 'dhale', 'lahj', 'jawf'].map(front).filter(Boolean).map((f) => { const p = ptsOf(f)[0]; return p && { ...p, t: f.name + ': ' + p.t }; }).filter(Boolean),
        cards: uniq(re(/taiz|marib|dhale|lahj|jawf|saada|bayda|\bfront\b/i).filter((r) => r.desks.includes('yemen'))) },
      { id: 'inside', name: 'Inside Iran', desk: 'iran', bounds: [[25, 44], [39.8, 63]], pts: ptsOf(arena('inside-iran')),
        cards: uniq([...flagged('arena:inside-iran'), ...re(/tehran|irgc|iranian (army|parliament|official)|khamenei|pezeshkian/i).filter((r) => r.desks.includes('iran'))]) },
    ];
    T.forEach((t) => {
      t.short = t.short || t.name;
      t.events = D.events.filter((e) => !e.researched && inB(e, t.bounds) && (t.desk === 'both' || e.desk === t.desk));
    });
    // A story with nothing in it is not shown.
    T = T.filter((t) => (t.trump ? t.trump.length : t.oil || t.cards.length || (t.pts && t.pts.length)));
    TOPIC = Object.fromEntries(T.map((t) => [t.id, t]));
  }
  const latestOf = (t) => [t.cards[0] && t.cards[0].at, t.trump && t.trump[0] && t.trump[0].at, t.oil && t.oil.rows[0].at, t.pts && t.pts[0] && t.pts[0].ref && t.pts[0].ref.at].filter(Boolean).sort().pop();
  const lastLine = (t) => (t.trump ? (t.trump[0] ? 'Trump: ' + t.trump[0].h : '') : t.oil ? oilLine(t.oil) : t.pts && t.pts[0] ? t.pts[0].t : t.cards[0] ? t.cards[0].h : '');
  const timeOf = (at) => (at ? fmt(at).split(' · ')[0] + ' · ' + fmt(at).split(' · ')[1] : '');
  const kicker = (t) => `<span class="h2-kick">${t.desk === 'both' ? `${FLAG.iran}${FLAG.yemen}<span>Both desks</span>` : `${FLAG[t.desk]}<span>${HD[t.desk].short} desk</span>`}</span>`;

  /* Oil: the prices as Yahoo Finance gives them, read by the server every ten minutes. */
  const money = (k, v) => '$' + v.toFixed(k === 'Natural gas' ? 2 : 2);
  const pctTxt = (p) => (p == null ? '' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`);
  const oilLine = (o) => o.rows.map((x) => `${x.k} ${money(x.k, x.v)} (${pctTxt(x.day)})`).join(' · ');
  function oilHtml(o) {
    const newest = o.rows.map((x) => x.at).sort().pop();
    const since = (x) => (x.since ? `Highest since ${dayName(x.since)}` : '');
    return `<div class="h2-oil">${o.rows.map((x) => `<div class="h2-px"><span class="k">${esc(x.k)}</span><b>${esc(money(x.k, x.v))}</b>${x.day == null ? '' : `<span class="d ${x.day >= 0 ? 'up' : 'dn'}">${x.day >= 0 ? '▲' : '▼'} ${esc(pctTxt(x.day))}</span>`}<small>${esc([x.note, x.week == null ? '' : `Week ${pctTxt(x.week)}`, since(x)].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>
      <p class="h2-oil-src">${esc(fmt(newest))} · ${o.rows.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.k)}</a>`).join(', ')} via ${esc(o.src)}</p>`;
  }
  const said = (s, n) => { const q = [...String(s.body).matchAll(/“([^”]+)”/g)].map((m) => m[1].trim()); return q.length ? q.slice(0, n).join(' ') : String(s.body).replace(/[“”]/g, ''); };
  const quote = (s) => `<figure class="h2-quote big"><blockquote>“${esc(said(s, 2))}”</blockquote><figcaption><b>${esc(s.h)}</b><span>${esc(fmt(s.at))} · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a></span></figcaption></figure>`;

  /* The reports under a story's lines, without the ones the lines came from. */
  const words = (s) => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
  const alike = (a, b) => { const A = words(a), B = words(b); let n = 0; A.forEach((w) => B.has(w) && n++); return n / Math.max(1, Math.min(A.size, B.size)) > 0.6; };
  const rest = (t) => { const shown = (t.pts || []).slice(0, 4); const urls = new Set(shown.map((p) => p.ref && p.ref.url)); return t.cards.filter((r) => !urls.has(r.url) && !shown.some((p) => alike(r.h, p.t))); };

  /* ---------- Page state ---------- */
  const S = { desk: 'all', view: 'all', topic: null, mode: 'day', day: null, from: null, to: null, shown: 0, story: null };
  let map, marks, tiles, legendBox, chipEl;
  const tileUrl = () => 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + (document.documentElement.dataset.theme === 'broadsheet-day' ? 'World_Light_Gray_Base' : 'World_Dark_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}';

  function shownEvents() {
    const d = S.day || today();
    return D.events.filter((e) => {
      const k = dayOf(e.at);
      if (S.mode === 'day') return k === d;
      if (S.mode === 'range') return k >= S.from && k <= S.to;
      return true;
    });
  }

  /* ---------- Map marks: one pin per event ---------- */
  const pinIcon = (e, cls) => L.divIcon({
    className: 'ev-wrap',
    html: `<div class="ev h2-ev ${e.kind} ${cls || ''}" style="--ev-ink:${PIN_INK[e.kind]}"><span class="ev-glyph">${EVENT_SVG[e.kind]}</span>${e.desk === 'iran' ? `<span class="h2-side" style="--ink:${IRAN_INK[sideOf(e)]}"></span>` : ''}<span class="ev-stem" aria-hidden="true"></span></div>`,
    iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -34],
  });
  function popRow(e) {
    noted(e);
    const go = S.desk === e.desk ? '' : `<button type="button" class="h-pop-go h2-pop-go" data-zoom-desk="${e.desk}">${FLAG[e.desk]}${esc(HD[e.desk].name)} →</button>`;
    return `<div class="h-pop-meta">${deskTag(e.desk)}<time>${esc(e.researched && /T12:00:00\+03:00$/.test(e.at) ? dayName(dayOf(e.at)) : fmt(e.at))}</time></div><p class="h-pop-h">${esc(e.label || '…')}</p><p class="h-pop-src">${esc(e.place || '')}${e.place && e.src ? ' · ' : ''}${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.src)}</a>` : ''}</p>${go}`;
  }
  const popupHtml = (g) => `<div class="h-pop">${popRow(g[0])}</div>`;
  /* The i-th pin on one spot, set round it on a widening spiral (the desks' own rule): every pin on its own. */
  const jitter = (lat, lng, i) => { const a = i * 2.39996, r = 0.01 * Math.sqrt(i); return [lat + Math.sin(a) * r, lng + Math.cos(a) * r]; };
  let canvas = null;
  function drawMarks() {
    if (!map) return;
    marks.clearLayers();
    // Every event its own pin, never one mark with a number (user, 17 Oct). Newest on top.
    const evs = shownEvents().sort((a, b) => (a.at < b.at ? -1 : 1));
    // The whole war is thousands of pins: drawn on one canvas, in the same colours, as the Iran desk does.
    const many = evs.length > 1500;
    if (many && !canvas) canvas = L.canvas({ padding: 0.3 });
    const atSpot = new Map();
    for (const e of evs) {
      const k = `${Math.round(e.lat * 100)},${Math.round(e.lng * 100)}`;
      const n = atSpot.get(k) || 0;
      atSpot.set(k, n + 1);
      const ll = n ? jitter(e.lat, e.lng, n) : [e.lat, e.lng];
      const dim = S.desk !== 'all' && e.desk !== S.desk;
      const mk = many
        ? L.circleMarker(ll, { renderer: canvas, radius: 5, weight: 1.5, color: e.desk === 'iran' ? IRAN_INK[sideOf(e)] : '#fff', fillColor: PIN_INK[e.kind], fillOpacity: dim ? 0.3 : 1, opacity: dim ? 0.3 : 1 })
        : L.marker(ll, { icon: pinIcon(e, dim ? 'h2-dim' : ''), keyboard: true, title: e.label || e.place || '', zIndexOffset: dim ? -500 : 0 });
      mk.bindPopup(() => popupHtml([e]), { maxWidth: 300 });
      if (e.researched && !e.label) mk.on('popupopen', () => { loadNotes().then(() => mk.getPopup() && mk.getPopup().setContent(popupHtml([e]))); });
      mk.addTo(marks);
    }
    drawLegend();
  }

  /* ---------- The key: an Iran part and a Yemen part; one part once a desk is picked ---------- */
  const kindRow = ([k, n]) => `<div class="h-leg-row"><span class="h2-mini ev" style="--ev-ink:${PIN_INK[k]}"><span class="ev-glyph">${EVENT_SVG[k]}</span></span>${esc(n)}</div>`;
  function pinKey(desk) {
    const evs = D.events.filter((e) => e.desk === desk);
    const kinds = PIN_KINDS.filter(([k]) => evs.some((e) => e.kind === k) || k === 'strike' || k === 'energy' || (desk === 'iran' && k === 'nuclear'));
    let h = `<div class="h2-legdesk">${FLAG[desk]}<b>${esc(HD[desk].name)}</b></div><div class="h2-leggrid">${kinds.map(kindRow).join('')}</div>`;
    if (desk === 'iran') {
      const present = new Set(evs.map(sideOf));
      const sides = IRAN_SIDES.filter(([k]) => present.has(k) || k === 'iran' || k === 'us' || k === 'israel');
      h += `<div class="h2-legsub">Side that acted</div><div class="h2-leggrid">${sides.map(([k, n]) => `<div class="h-leg-row"><span class="h2-sidekey" style="--ink:${IRAN_INK[k]}"></span>${esc(n)}</div>`).join('')}</div>`;
    }
    return `<div class="h2-legsec">${h}</div>`;
  }
  function drawLegend() {
    const body = (S.desk === 'all' ? ['iran', 'yemen'] : [S.desk]).map(pinKey).join('');
    legendBox.innerHTML = `<div class="leg-head"><span class="leg-title">Map key</span><button type="button" class="leg-collapse" aria-label="Collapse legend">▾</button></div><div class="leg-body">${body}</div>`;
    legendBox.querySelector('.leg-collapse').onclick = () => legendBox.classList.toggle('collapsed');
  }

  /* ---------- The page's frame ---------- */
  function chromeHtml() {
    const item = (k, name, flag) => `<li><button type="button" class="h2-pick" data-pick="${k}">${flag}<span>${esc(name)}</span></button></li>`;
    return `<div class="mast">
      <span class="mast-date"></span>
      <div class="mast-mid"><a class="mast-name" href="/" aria-label="The Situation Room"><span class="mn">The Situation Room</span></a><span class="mast-line">Open-source intelligence</span></div>
      <span class="mast-end"></span>
    </div>
    <header class="top">
      <div class="brand">
        <h1 class="desk-label"><span class="dl-pre">Desk:</span> <span class="dl-name"><button type="button" class="desk-pick" aria-haspopup="true" aria-expanded="false" aria-controls="h2-desk-list"><span id="h2-dl">All desks</span><svg class="dp-car" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"></path></svg></button></span></h1>
        <ul class="desk-list h-desk-list h2-desk-list" id="h2-desk-list" hidden>
          ${item('all', 'All desks', ALL_FLAG)}${item('yemen', 'Yemen conflict', FLAG.yemen)}${item('iran', 'Iran conflict', FLAG.iran)}
        </ul>
      </div>
      <div class="stamp">
        <span class="ye-clock"><span class="yc-label">Sanaa</span><time data-tz="Asia/Aden">--:--:--</time></span>
        <span class="ye-clock h-clock2"><span class="yc-label">Tehran</span><time data-tz="Asia/Tehran">--:--:--</time></span>
        <span class="pulse" aria-hidden="true"></span>
        <span id="h2-upd"></span>
      </div>
    </header>`;
  }
  const toolbarHtml = () => `<div class="toolbar">
    <div class="time-filter" id="time-filter">
      <span class="tf-label">Map:</span>
      <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
      <input type="date" id="map-date" min="${WAR_FROM}" aria-label="Day" />
      <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day"><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
      <button type="button" id="btn-day-today">Today</button>
      <span class="tf-sep" aria-hidden="true"></span>
      <button type="button" id="btn-conflict-all" aria-label="The whole war"><span class="tf-long">Whole war</span><span class="tf-short">All</span></button>
      <button type="button" id="btn-period" aria-expanded="false" aria-controls="tf-range">Period</button>
    </div>
    <div class="tf-range" id="tf-range" hidden>
      <label>From <input type="date" id="map-from" min="${WAR_FROM}" /></label>
      <label>To <input type="date" id="map-to" min="${WAR_FROM}" /></label>
    </div>
  </div>`;
  const stageHtml = () => `<main class="stage h-stage" id="h2-stage">
    <section class="map-wrap"><div id="h-map"></div><div class="legend h-legend h2-legend" id="h-legend"></div><div class="map-chip h-chip h2-chip" id="h2-chip"></div></section>
    <div class="rail-splitter" aria-hidden="true"></div>
    <aside class="rail">
      <div class="rail-head"><h2>Latest reports</h2></div>
      <div class="h2-railnote" id="h2-railnote" hidden></div>
      <div class="feed" id="h-feed"></div>
      <button type="button" class="more h-more" id="h-more">Show earlier reports</button>
    </aside>
  </main>`;

  function wireChrome() {
    const pick = document.querySelector('.desk-pick'), list = $('h2-desk-list');
    const open = (on) => { list.hidden = !on; pick.setAttribute('aria-expanded', String(on)); };
    pick.onclick = (e) => { e.stopPropagation(); open(list.hidden); };
    document.addEventListener('click', (e) => { if (!list.contains(e.target)) open(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden) { open(false); pick.focus(); } });
    const tick = () => document.querySelectorAll('.stamp time[data-tz]').forEach((t) => { t.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: t.dataset.tz, hourCycle: 'h23' }); });
    tick(); setInterval(tick, 1000);
    // The desks' own masthead menu and theme button (public/app.js).
    try { const f = app('installMast'); if (f) f(); } catch (e) { console.error(e); }
    try { const f = app('installThemeButton'); if (f) f(); } catch (e) { console.error(e); }
    // The theme lives on <html>; the maps follow it.
    new MutationObserver(() => { if (tiles) tiles.setUrl(tileUrl()); minis.forEach((m) => m._hTiles.setUrl(tileUrl())); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  function stampUpd() {
    const el = $('h2-upd');
    if (el && D.asOf) el.textContent = 'Updated ' + new Date(D.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }

  /* ---------- The toolbar: a day, the whole war or a period ---------- */
  function syncToolbar() {
    const d = S.day || today();
    const date = $('map-date');
    date.max = today(); date.value = d;
    $('map-from').max = today(); $('map-to').max = today();
    $('btn-day-today').classList.toggle('on', S.mode === 'day' && d === today());
    $('btn-conflict-all').classList.toggle('on', S.mode === 'all');
    $('btn-day-next').disabled = S.mode === 'day' && d >= today();
  }
  function setView(mode, a, b) {
    S.mode = mode;
    if (mode === 'day') S.day = a;
    if (mode === 'range') { S.from = a <= b ? a : b; S.to = a <= b ? b : a; }
    syncToolbar(); drawMarks(); drawChip();
    // A day before the live pins, the whole war or a period: the war's pins, read once.
    const oldest = D.events.filter((e) => !e.researched).reduce((m, e) => (e.at < m ? e.at : m), '9');
    const need = mode === 'all' || (mode === 'day' && a < dayOf(oldest)) || (mode === 'range' && S.from < dayOf(oldest));
    if (need) loadWar().then((ok) => { if (ok) { drawMarks(); } });
  }
  function wireToolbar() {
    const date = $('map-date');
    $('btn-day-prev').onclick = () => setView('day', shift(S.mode === 'day' ? (S.day || today()) : today(), -1));
    $('btn-day-next').onclick = () => { const n = shift(S.day || today(), 1); if (n <= today()) setView('day', n); };
    $('btn-day-today').onclick = () => setView('day', today());
    $('btn-conflict-all').onclick = () => setView('all');
    date.onchange = () => { if (date.value) setView('day', date.value); };
    const per = $('btn-period'), rng = $('tf-range'), f = $('map-from'), t = $('map-to');
    per.onclick = () => {
      rng.hidden = !rng.hidden; per.setAttribute('aria-expanded', String(!rng.hidden)); per.classList.toggle('on', !rng.hidden);
      if (!rng.hidden && !f.value) { f.value = shift(today(), -6); t.value = today(); }
    };
    const apply = () => { if (f.value && t.value) setView('range', f.value, t.value); };
    f.onchange = apply; t.onchange = apply;
  }

  /* ---------- The reports column follows the desk and the story ---------- */
  const STEP = () => (phone() ? 6 : 14);
  function drawRail() {
    const note = $('h2-railnote'), head = document.querySelector('#h2-stage .rail-head h2');
    let list = null, trump = null;
    if (S.topic && TOPIC[S.topic]) {
      const t = TOPIC[S.topic];
      head.textContent = 'Latest on ' + t.short;
      note.hidden = false;
      note.innerHTML = `<span>${deskTag(t.desk)}</span><button type="button" data-clear-topic>All latest reports ✕</button>`;
      if (t.trump) trump = t.trump; else list = t.cards;
    } else {
      head.textContent = 'Latest reports'; note.hidden = true;
      list = D.reports.filter((r) => S.desk === 'all' || r.desks.includes(S.desk));
    }
    const n = S.shown || STEP();
    const feed = $('h-feed');
    if (trump) feed.innerHTML = trump.slice(0, n).map((s, i) => trumpCard(s, { body: i < 3 })).join('');
    else feed.innerHTML = list.length ? list.slice(0, n).map((x) => card(x)).join('') : '<p class="h-empty">No reports on this yet.</p>';
    $('h-more').hidden = (trump || list).length <= n;
  }
  function drawChip() {
    const d = S.day || today();
    const when = S.mode === 'all' ? 'Whole war' : S.mode === 'range' ? `${dayName(S.from)} to ${dayName(S.to)}` : d === today() ? `Today, ${dayName(d)}` : dayName(d);
    let h;
    if (S.topic && TOPIC[S.topic]) h = `<b>${esc(TOPIC[S.topic].short)}</b> · ${esc(when)}`;
    else if (S.desk !== 'all') h = `${FLAG[S.desk]}<b>${esc(HD[S.desk].name)}</b> · ${esc(when)}`;
    else h = `All desks · ${esc(when)}`;
    chipEl.innerHTML = h;
  }

  /* ---------- Desks in place ---------- */
  function pickDesk(d, o) {
    const opts = o || {};
    if (!(d === 'all' || HD[d])) d = 'all';
    const from = S.view;
    const run = () => { S.view = d; doPick(d, opts); if (from !== d) renderBody(d); };
    if (from !== d && !opts.noPush) history.pushState({ desk: d }, '', d === 'all' ? location.pathname + location.search : '#' + d);
    document.title = d === 'all' ? 'The Situation Room' : HD[d].name + ' · The Situation Room';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from !== d && document.startViewTransition && !reduce && !opts.instant) {
      const vt = document.startViewTransition(run);
      vt.ready.catch(() => {}); vt.finished.catch(() => {});
    } else run();
  }
  function doPick(d, opts) {
    S.desk = d; S.shown = 0; S.topic = null;
    $('h2-dl').textContent = d === 'all' ? 'All desks' : HD[d].name;
    document.querySelectorAll('.h2-pick').forEach((b) => { b.classList.toggle('on', b.dataset.pick === d); b.setAttribute('aria-current', b.dataset.pick === d ? 'true' : 'false'); });
    if (map && !opts.noFly) map.flyToBounds(d === 'all' ? REGION : DESK_BOUNDS[d], { duration: opts.instant ? 0 : 0.9, animate: !opts.instant });
    if (opts.scroll) scrollToMap();
    drawRail(); drawChip(); drawMarks();
  }
  function scrollToMap() {
    const el = document.querySelector('.toolbar');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 6, behavior: 'smooth' });
  }
  function focusTopic(id) {
    const t = TOPIC[id];
    if (!t) return;
    S.topic = id; S.shown = 0;
    scrollToMap();
    map.flyToBounds(t.bounds, { duration: 0.9 });
    drawRail(); drawChip();
  }

  /* ---------- Small maps for the stories ---------- */
  let minis = [];
  function miniMap(el, id) {
    const t = TOPIC[id];
    const m = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false });
    m._hTiles = L.tileLayer(tileUrl(), { noWrap: true }).addTo(m);
    m.fitBounds(t.bounds, { padding: [6, 6] });
    t.events.forEach((e) => L.circleMarker([e.lat, e.lng], { radius: 3.6, weight: 1, color: '#fff', opacity: 0.8, fillColor: PIN_INK[e.kind], fillOpacity: 0.95, interactive: false }).addTo(m));
    el.addEventListener('click', () => focusTopic(id));
    minis.push(m);
  }
  const mini = (id) => `<div class="h2-mini-map" data-mini="${id}" role="button" tabindex="0" aria-label="${esc(TOPIC[id].name)} on the big map"></div>`;
  function mountMinis(root) {
    minis.forEach((m) => { try { m.remove(); } catch (e) { /* gone */ } });
    minis = [];
    root.querySelectorAll('[data-mini]').forEach((el) => miniMap(el, el.dataset.mini));
  }

  /* ---------- Latest developments: most important first ---------- */
  const MAX_DEVS = 6;
  /* A desk's points in its brief's importance bands (rank-points.ts), the writer's order kept inside a band. */
  function deskPoints(desk) {
    const b = D.briefs[desk], s = b && b.situation;
    if (!s || !Array.isArray(s.points)) return [];
    return s.points.map((p, i) => ({ p, i, band: Array.isArray(s.bands) ? s.bands[i] : 2, desk, refs: s.refs || [] }))
      .sort((a, c) => a.band - c.band || a.i - c.i);
  }
  function devPoints(view) {
    if (view !== 'all') return deskPoints(view).slice(0, MAX_DEVS);
    // Both desks as one list: band first, then each desk's own order, the two desks taking turns.
    const all = [...deskPoints('yemen').map((x, k) => ({ ...x, k })), ...deskPoints('iran').map((x, k) => ({ ...x, k }))];
    return all.sort((a, c) => a.band - c.band || a.k - c.k || (a.desk === 'yemen' ? -1 : 1)).slice(0, MAX_DEVS);
  }
  function devsHtml(view) {
    const pts = devPoints(view);
    if (!pts.length) return '';
    // The references renumbered for the list shown: one number per report.
    const refs = [], idx = new Map();
    const num = (x, n) => {
      const r = x.refs[n - 1];
      if (!r) return null;
      const key = r.url || r.fp;
      if (!idx.has(key)) { refs.push(r); idx.set(key, refs.length); }
      return idx.get(key);
    };
    const text = (x) => {
      const t = String(x.p).replace(/((?:\[\[\d+\]\])+)([.,;:!?])/g, '$2$1');
      return esc(t).replace(/(?:\[\[\d+\]\])+/g, (run) => {
        const ns = [...run.matchAll(/\[\[(\d+)\]\]/g)].map((m) => num(x, Number(m[1]))).filter(Boolean);
        return ns.length ? `<sup class="ref-n">${ns.map((n) => `<a class="ref-btn" href="${esc(refs[n - 1].url)}" target="_blank" rel="noopener">${n}</a>`).join('<span aria-hidden="true">,</span>')}</sup>` : '';
      });
    };
    const items = pts.map((x) => `<li>${view === 'all' ? deskTag(x.desk) + ' ' : ''}${text(x)}</li>`).join('');
    const next = [view === 'all' || view === 'yemen' ? D.briefs.yemen : null, view === 'all' || view === 'iran' ? D.briefs.iran : null].filter(Boolean).map((b) => b.nextUpdateAt).filter(Boolean).sort()[0];
    const nx = next ? new Date(next) : null;
    const when = nx ? ` · Updates ${nx.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}${dayOf(nx) === today() ? '' : ', ' + dayName(dayOf(nx))}` : '';
    const refLine = (r, i) => `<li><a class="ref-btn ref-line" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="ref-num">${i + 1}</span>${esc(r.trump ? 'Trump, ' + r.source : srcName(r.source))}, ${esc(fmt(r.at).split(' · ').reverse().join(', '))}</a></li>`;
    return `<section class="situation h-situation" id="h-devs">
      <div class="sit-head"><h2>Latest developments</h2></div>
      <p class="cadence at-head">${view === 'all' ? 'Based on latest reports from both desks' : 'Based on latest reports'}${esc(when)}</p>
      <div class="sit-body"><ol class="pts">${items}</ol>
        ${refs.length ? `<button type="button" class="toggle-sit h-toggle" aria-expanded="false">Read more</button><div class="refs-box"><ol class="refs" aria-label="References">${refs.map(refLine).join('')}</ol></div>` : ''}
      </div>
    </section>`;
  }
  function wireDevs(root) {
    root.querySelectorAll('.h-toggle').forEach((b) => {
      b.onclick = () => {
        const box = b.closest('.situation');
        const open = box.classList.toggle('sit-open');
        b.textContent = open ? 'Show less' : 'Read more';
        b.setAttribute('aria-expanded', String(open));
      };
    });
  }

  /* ---------- Follow a story ---------- */
  function ordered() {
    const byTime = T.filter((t) => !PICKS.includes(t.id)).sort((a, b) => ((latestOf(b) || '') > (latestOf(a) || '') ? 1 : -1));
    return [...PICKS.map((id) => TOPIC[id]).filter(Boolean), ...byTime];
  }
  const deskLinks = (t) => {
    const ds = (t.desk === 'both' ? ['iran', 'yemen'] : [t.desk]).filter((d) => d !== S.view);
    return ds.length ? `<div class="h2-links">${ds.map((d) => `<button type="button" class="h2-go h2-go-desk" data-zoom-desk="${d}">${FLAG[d]}${HD[d].short} desk →</button>`).join('')}</div>` : '';
  };
  function show(id) {
    const t = TOPIC[id];
    if (!t) return;
    S.story = id;
    document.querySelectorAll('#index button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.i === id)));
    let left, right;
    if (t.trump) {
      const list = t.trump.filter((s) => S.view === 'all' || s.desks.includes(S.view));
      left = list[0] ? quote(list[0]) : '';
      right = list.length > 1 ? `<h4>Earlier</h4><div class="feed">${list.slice(1, 5).map((s) => trumpCard(s)).join('')}</div>` : '';
    } else if (t.oil) {
      left = oilHtml(t.oil);
      right = t.cards.length ? `<h4>Latest reports</h4><div class="feed">${t.cards.slice(0, 4).map((r) => card(r, { noReply: true })).join('')}</div>` : '';
    } else {
      left = mini(id) + (t.pts && t.pts.length ? `<h4 style="margin-top:.8rem">The latest</h4><ol class="pts">${t.pts.slice(0, 4).map((p) => `<li>${esc(p.t)}</li>`).join('')}</ol>` : '');
      const list = rest(t).slice(0, 4);
      right = list.length ? `<h4>Latest reports</h4><div class="feed">${list.map((r) => card(r, { noReply: true })).join('')}</div>` : '';
    }
    $('panel').innerHTML = `${kicker(t)}<h3>${esc(t.name)}</h3><div class="g-body"><div>${left}</div><div>${right}</div></div>${deskLinks(t)}`;
    mountMinis($('panel'));
  }
  function renderBody(view) {
    const devs = $('devs');
    devs.innerHTML = devsHtml(view);
    wireDevs(devs);
    const items = view === 'all' ? ordered() : ordered().filter((t) => t.desk === view || t.desk === 'both');
    const idx = $('index');
    idx.innerHTML = items.map((t) => `<button type="button" role="tab" data-i="${t.id}" aria-selected="false">${kicker(t)}<b>${esc(t.name)}</b><time>${esc(timeOf(latestOf(t)))}</time><p>${esc(lastLine(t))}</p></button>`).join('');
    idx.scrollLeft = 0; idx.scrollTop = 0;
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
      <div id="devs"></div>
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
    if (!window.L) { setTimeout(startHome, 150); return; }
    root.dataset.on = '1';
    started = true;
    root.innerHTML = `<div id="chrome">${chromeHtml()}</div><div id="toolbar">${toolbarHtml()}</div><div id="stage">${stageHtml()}</div>${bodyHtml()}`;
    wireChrome();
    chipEl = $('h2-chip');
    legendBox = $('h-legend');
    if (phone()) legendBox.classList.add('collapsed');
    map = L.map($('h-map'), { zoomControl: true, attributionControl: true, worldCopyJump: false, minZoom: 3 });
    tiles = L.tileLayer(tileUrl(), { maxZoom: 18, noWrap: true, attribution: 'Tiles © Esri — Esri, DeLorme, NAVTEQ' }).addTo(map);
    map.fitBounds(REGION);
    marks = L.layerGroup().addTo(map);
    wireToolbar();
    S.day = today();
    syncToolbar();
    drawLegend(); drawChip();
    $('h-feed').innerHTML = '<p class="h-empty">Loading the latest reports…</p>';

    wrap = $('idx'); idxEl = $('index');
    idxEl.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges);
    wrap.querySelector('.next').onclick = () => idxEl.scrollBy({ left: idxEl.clientWidth * 0.7, behavior: 'smooth' });
    wrap.querySelector('.prev').onclick = () => idxEl.scrollBy({ left: -idxEl.clientWidth * 0.7, behavior: 'smooth' });
    // A small nudge the first time the row comes into view on a phone, so it reads as something to swipe.
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting && phone()) { wrap.classList.add('hinting'); o.disconnect(); } }, { threshold: 0.6 }).observe(wrap);
    idxEl.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) show(b.dataset.i); });
    $('h-more').onclick = () => { S.shown = (S.shown || STEP()) + STEP(); drawRail(); };
    root.addEventListener('click', (ev) => {
      const p = ev.target.closest('[data-pick]');
      if (p) { $('h2-desk-list').hidden = true; document.querySelector('.desk-pick').setAttribute('aria-expanded', 'false'); pickDesk(p.dataset.pick); return; }
      if (ev.target.closest('[data-clear-topic]')) { S.topic = null; S.shown = 0; map.flyToBounds(S.desk === 'all' ? REGION : DESK_BOUNDS[S.desk], { duration: 0.9 }); drawRail(); drawChip(); }
    });
    // Desk links anywhere, the map's notes among them (Leaflet puts those in the map pane).
    document.addEventListener('click', (ev) => {
      const z = ev.target.closest('[data-zoom-desk]');
      if (!z || !document.getElementById('home-root')) return;
      ev.preventDefault();
      if (map) map.closePopup();
      pickDesk(z.dataset.zoomDesk, { scroll: !z.closest('#h2-stage') });
    });

    addEventListener('popstate', () => pickDesk((history.state && history.state.desk) || (HD[location.hash.slice(1)] ? location.hash.slice(1) : 'all'), { noPush: true }));
    const start = location.hash.slice(1);
    history.replaceState({ desk: HD[start] ? start : 'all' }, '');

    await load();
    buildTopics();
    stampUpd();
    if (HD[start]) { S.view = start; doPick(start, { noPush: true, instant: true }); document.title = HD[start].name + ' · The Situation Room'; }
    else { drawRail(); drawMarks(); }
    renderBody(S.view);

    // New reports every two minutes while the page is in view; the developments and stories with them.
    setInterval(async () => {
      if (document.hidden) return;
      await load();
      buildTopics();
      stampUpd();
      drawRail(); drawMarks();
      if (!document.querySelector('#g-body .sit-open')) renderBody(S.view);
    }, 120_000);
  }
  window.startHome = startHome;
  if (!started && document.getElementById('home-root')) startHome();
})();

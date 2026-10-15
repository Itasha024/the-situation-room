/**
 * The main desk's page (option C): fills the shell in
 * src/components/main-desk.tsx from /api/region. One map and one wire for the
 * whole region; a country or a sea is a focus of the same page, and the wars
 * keep their own desks.
 *
 * Ported from mockups/v2 (the design the user chose, 15 Oct), with the rules
 * that hold on the live site:
 *   - no counts on the main page (user, 9 Oct): no "N reports", no tallies;
 *   - no sourcing labels in copy: a card shows its outlet, never a type;
 *   - nothing is guessed onto the map (the mock's launch arcs drew launch
 *     points no report named, so they are not here);
 *   - reads only: the page asks /api/region, never anything that scans.
 */
import { flag, placeHeadHtml } from "./place-head";
import { CATEGORIES, FOCI, REGION_BOUNDS, WAR_DESKS, focusById, focusBySlug, warDay, type Bounds, type Focus, type FocusId } from "@/lib/region";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Leaflet = any;

type Also = { source?: string; url?: string; summary?: string };
type Rep = {
  fp: string;
  at: string;
  ms: number;
  source: string;
  url?: string;
  type?: string;
  summary: string;
  text?: string;
  place?: string;
  lat?: number;
  lng?: number;
  tier?: string;
  alsoReportedBy?: Also[];
  replyTo?: string;
  countries: string[];
  desks: string[];
  cat: string;
  where?: string | null;
  kids: string[];
  parent?: string;
};
type Pin = { ms: number; cat: string; la: number; ln: number; where: string | null };
type Ref = { fp?: string; source?: string; at?: string; url?: string; headline?: string };
type BriefSec = { id: string; name: string; points: string[]; refs: Ref[] };
type Brief = { updatedAt?: string; line: string; points: string[]; refs: Ref[]; sections: BriefSec[] };
type Lens = "reports" | "activity" | "control" | "shipping" | "quiet";
type Geo = { type: string; features: { type: string; properties: Record<string, any>; geometry: { type: string; coordinates: any } }[] };

const H = 3_600_000;
const DAY = 86_400_000;
const PAGE = 40;
const TZ = "Asia/Aden";

/* ---------------------------------------------------------------- vocabulary */

const CAT: Record<string, { name: string; col: string }> = Object.fromEntries(CATEGORIES.map((c) => [c.id, { name: c.name, col: c.color }]));
CAT.other = { name: "Other", col: "#a99d93" };
const catCol = (c: string) => (CAT[c] || CAT.other).col;
const catName = (c: string) => (CAT[c] || CAT.other).name;

/** Shape = kind of event, colour says it again (the APP-6 idea): readable in grey too. */
const ICON: Record<string, string> = {
  strike: '<svg viewBox="0 0 12 12"><path d="M6 0l1.4 3.6L11 2.4 8.6 5.6 12 7 8.2 7.6 9 12 6 9 3 12l.8-4.4L0 7l3.4-1.4L1 2.4l3.6 1.2z"/></svg>',
  combat: '<svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
  shipping: '<svg viewBox="0 0 12 12"><path d="M1 7h10l-2 3.5H3zM5 2h2v4H5z"/></svg>',
  diplomacy: '<svg viewBox="0 0 12 12"><circle cx="4" cy="6" r="3"/><circle cx="8" cy="6" r="3" fill-opacity=".6"/></svg>',
  statement: '<svg viewBox="0 0 12 12"><path d="M1 2h10v6H5l-3 3V8H1z"/></svg>',
  economy: '<svg viewBox="0 0 12 12"><path d="M1 11h10M2 10V6h2v4M5 10V3h2v7M8 10V5h2v5" stroke="currentColor" stroke-width="1.2"/></svg>',
};

/** The places in the focus bar: every country and sea not set aside. */
const BAR: Focus[] = FOCI.filter((f) => !f.hidden);

/** Where a place's label sits when the map is far out (one label per place, not pins). */
const LABEL_AT: Partial<Record<FocusId, [number, number]>> = {
  saudi: [22.4, 43.6], gulf: [25.6, 51.7], redsea: [19, 38.6], hormuz: [24.4, 58.6], israel: [31.2, 34.4],
  lebanon: [34, 35.4], iran: [32.5, 54], iraq: [33.6, 43.6], yemen: [15.4, 47],
};

/** Which brief sections speak for which place. */
const BRIEF_FOR: Record<string, FocusId[]> = {
  "Bab al-Mandab": ["redsea", "yemen"], "Red Sea coast": ["yemen", "redsea"], "Saudi Arabia": ["saudi"],
  "Strait of Hormuz": ["hormuz"], Lebanon: ["lebanon"], "Inside Iran": ["iran"], "Nuclear file": ["iran"], Talks: ["iran", "us"],
  Sanctions: ["iran", "us", "iraq"], "The U.S.": ["us"], "Axis of Resistance": ["iraq", "yemen"],
};

/** The two shipping lanes the Shipping mode draws: Suez to Bab al-Mandab, and the Gulf out through Hormuz. */
const LANES: [number, number][][] = [
  [[29.9, 32.6], [27.5, 34], [20, 38.5], [15, 41.8], [12.6, 43.4], [12, 45], [12.6, 50], [13, 54]],
  [[29.5, 48.6], [27.5, 50.5], [26.4, 53.5], [26.5, 56.3], [25.6, 57], [24.5, 59], [22.5, 61]],
];

/** Names too common to make a story of their own. */
const STOP = new Set(
  "Houthi Houthis Yemen Yemeni Saudi Arabia Iran Iranian Israel Israeli Lebanon Lebanese Iraq Iraqi Trump United States Strait Hormuz Red Sea Coalition Government Forces Minister President Official Officials Council Ministry Sanaa Aden Taiz Marib Riyadh Tehran Beirut Washington Gulf Treasury Security Prime Foreign Defence Defense Army Military Southern Northern Western Eastern Brigade Brigades Footage Reports Report Hezbollah IRGC Arabia Senior Former Hodeidah Saada Lahj Abyan Shabwa Sources Source Media Yemeni Saudi-led".split(" "),
);

/* ---------------------------------------------------------------- helpers */

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const fHM = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const fDM = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const fLong = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hm = (ms: number) => fHM.format(ms);
const dm = (ms: number) => fDM.format(ms);
const dayKey = (ms: number) => fDay.format(ms);
const ago = (ms: number) => {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60_000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const noRefs = (s: string) => s.replace(/\[\[\d+\]\]/g, "").replace(/\s+([.,;:])/g, "$1");
const firstPara = (s: string) => (s || "").split(/\n+/).map((x) => x.trim()).filter(Boolean)[0] || "";
const inB = (la: number, ln: number, b: Bounds) => la >= b[0][0] && la <= b[1][0] && ln >= b[0][1] && ln <= b[1][1];
const cssVar = (name: string, fallback: string) => {
  const root = document.getElementById("main-desk") || document.documentElement;
  return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
};
const isDay = () => document.documentElement.dataset.theme === "broadsheet-day";
const tileUrl = () =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${isDay() ? "Light" : "Dark"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("md." + k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem("md." + k, JSON.stringify(v));
    } catch {
      /* private window: the page works without it */
    }
  },
};

/* ---------------------------------------------------------------- the page */

/** Figures for a country or sea page, from /api/region?figures=<id>. */
type Figs = {
  focus: string;
  tz: string;
  week: number;
  d1: number;
  d0: number;
  pins24: number;
  outlets: number;
  days: [string, number][];
  hours: number[];
  cats: Record<string, number>;
  places: { name: string; n: number; at: string; fp: string; lat?: number; lng?: number }[];
  actors: { id: string; name: string; n: number }[];
  got: number;
};

export type MainDeskOpts = {
  /** The page's place: a country or sea page passes its own; the front page, none. */
  focus?: FocusId | "region";
  /** A reader picked a place: the page's router moves to its address and calls focus(). */
  onFocus?: (f: Focus | null) => void;
};
export type MainDeskHandle = { stop: () => void; focus: (id: FocusId | "region") => void };

export function startMainDesk(opts: MainDeskOpts = {}): MainDeskHandle {
  const root = document.getElementById("main-desk");
  if (!root) return { stop: () => {}, focus: () => {} };
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const cleanups: (() => void)[] = [];
  let L: Leaflet = (window as any).L;

  /* ---------- state ---------- */
  const params = new URLSearchParams(location.search);
  const S = {
    focus: (opts.focus ?? focusBySlug(params.get("focus") || "")?.id ?? "region") as FocusId | "region",
    lens: "reports" as Lens,
    cat: "all",
    view: "cards" as "cards" | "log" | "table",
    span: DAY,
    /** The end of the period on the map; null is now. */
    end: null as number | null,
    claims: true,
  };
  const now = () => Date.now();
  const endMs = () => S.end ?? now();
  // "New" = since the reader's last visit. A first visit has nothing new, and a
  // reload in the same tab keeps the same mark rather than starting over.
  let lastVisit = now();
  try {
    const kept = Number(sessionStorage.getItem("md.base"));
    lastVisit = kept > 0 ? kept : store.get<number>("last", now());
    sessionStorage.setItem("md.base", String(lastVisit));
  } catch {
    /* private window: nothing is marked new */
  }
  let shown = PAGE;
  let tableTab: "places" | "sources" = "places";
  const openStories = new Set<string>();
  const openThreads = new Set<string>();

  /* ---------- data ---------- */
  let R: Rep[] = [];
  const byFp = new Map<string, Rep>();
  let PINS: Pin[] = [];
  const pinKeys = new Set<string>();
  const BRIEFS: { yemen?: Brief; iran?: Brief } = {};
  const deep = new Set<string>();
  let reachedEnd = false;
  let STORY = new Map<string, string>();
  const FIGS = new Map<string, Figs>();

  function addReports(list: any[]): number {
    let added = 0;
    for (const x of list) {
      if (!x?.fp || byFp.has(x.fp)) continue;
      const r: Rep = { ...x, ms: Date.parse(x.at), kids: [], countries: x.countries ?? [], desks: x.desks ?? [], cat: x.cat ?? "other" };
      if (!Number.isFinite(r.ms)) continue;
      byFp.set(r.fp, r);
      added++;
    }
    if (added) {
      R = [...byFp.values()].sort((a, b) => b.ms - a.ms);
      threads();
      stories();
    }
    return added;
  }
  function addPins(rows: { at: string; cat: string; la: number; ln: number; where: string | null }[]) {
    for (const p of rows) {
      const ms = Date.parse(p.at.length === 16 ? p.at + ":00Z" : p.at);
      const k = `${p.at.slice(0, 16)}|${p.la.toFixed(2)}|${p.ln.toFixed(2)}`;
      if (!Number.isFinite(ms) || pinKeys.has(k)) continue;
      pinKeys.add(k);
      PINS.push({ ms, cat: p.cat, la: p.la, ln: p.ln, where: p.where });
    }
    PINS.sort((a, b) => b.ms - a.ms);
  }
  /** A thread: cards that answer one card (replyTo); the first is the parent. */
  function threads() {
    for (const r of R) {
      r.kids = [];
      r.parent = undefined;
    }
    const groups = new Map<string, Rep[]>();
    for (const r of R) if (r.replyTo) (groups.get(r.replyTo) ?? groups.set(r.replyTo, []).get(r.replyTo)!).push(r);
    for (const [key, list] of groups) {
      list.sort((a, b) => a.ms - b.ms);
      const head = byFp.get(key) ?? list[0];
      for (const k of list) if (k !== head) {
        k.parent = head.fp;
        head.kids.push(k.fp);
      }
    }
  }
  /** Stories: many cards on one event fold into one block, keyed on a rare proper name. */
  function stories() {
    const tok: Record<string, Rep[]> = {};
    for (const r of R.slice(0, 600)) {
      const words = new Set(
        (r.summary.match(/\b(?:Al-|al-)?[A-Z][a-z]{4,}(?:\s[A-Z][a-z]{3,})?/g) || []).filter(
          (w) => !STOP.has(w.replace(/^(Al-|al-)/, "")) && !STOP.has(w.split(" ")[0]),
        ),
      );
      for (const w of words) (tok[w] = tok[w] || []).push(r);
    }
    STORY = new Map();
    Object.entries(tok)
      .filter(([, l]) => l.length >= 6 && l[0].ms - l[l.length - 1].ms < 14 * H)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([w, l]) => l.forEach((r) => !STORY.has(r.fp) && STORY.set(r.fp, w)));
  }

  async function getJson(url: string) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }
  function eventsToPins(events: any[]) {
    addPins(
      (events || [])
        .filter((e) => typeof e.lat === "number" && typeof e.lng === "number")
        .map((e) => ({ at: String(e.at).slice(0, 16), cat: e.cat, la: e.lat, ln: e.lng, where: e.where ?? null })),
    );
  }
  async function loadRegion(focus: string | null, before?: string, limit = 400) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (focus && focus !== "region") q.set("focus", focus);
    if (before) q.set("before", before);
    const j = await getJson(`/api/region?${q}`);
    const added = addReports(j.reports || []);
    eventsToPins(j.events || []);
    if (j.briefs) Object.assign(BRIEFS, j.briefs);
    if (before && !added) reachedEnd = true;
    return added;
  }

  /* ---------- focus ---------- */
  const F = () => (S.focus === "region" ? null : focusById(S.focus) ?? null);
  const boundsOf = (): Bounds => F()?.bounds ?? REGION_BOUNDS;
  const inFocus = (r: Rep) => S.focus === "region" || r.countries.includes(S.focus);
  const pinInFocus = (p: Pin) => S.focus === "region" || F()?.kind === "actor" || p.where === S.focus;
  const inWin = (ms: number) => ms <= endMs() && ms > endMs() - S.span;
  const isClaim = (r: Rep) => r.tier === "claim" && !(r.alsoReportedBy || []).length;

  /** Busier or calmer than the day before, from the map's pins: a direction, never a number. */
  function trend(id: string): [string, string, string] {
    const t = now();
    let a = 0;
    let b = 0;
    for (const p of PINS) {
      if (p.ms <= t - 2 * DAY) break;
      if (p.where !== id) continue;
      if (p.ms > t - DAY) a++;
      else b++;
    }
    if (!a && !b) return ["md-flat", "·", "no pins in two days"];
    if (!b) return ["md-up", "▲", "busier than yesterday"];
    const d = (a - b) / b;
    return d > 0.15 ? ["md-up", "▲", "busier than yesterday"] : d < -0.15 ? ["md-down", "▼", "calmer than yesterday"] : ["md-flat", "→", "about the same as yesterday"];
  }

  /* ---------- map ---------- */
  let map: Leaflet;
  let tiles: Leaflet;
  let rDots: Leaflet;
  let G: Record<string, Leaflet> = {};
  let countriesGeo: Geo | null = null;
  let yemenGeo: Geo | null = null;
  let countryLayer: Leaflet = null;
  let yemenLayer: Leaflet = null;
  let districtLayer: Leaflet = null;
  let control: { geo: Geo; base: any; govs: Record<string, string>; live: any } | null = null;

  function makeMap() {
    map = L.map("md-map", { zoomControl: false, zoomSnap: 0.25, minZoom: 2.5, maxZoom: 13, preferCanvas: true, attributionControl: true });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.fitBounds(boundsOf(), { animate: false, ...pad() });
    // The page scrolls past the map; the wheel zooms only once the map is clicked.
    map.scrollWheelZoom.disable();
    map.on("click", () => map.scrollWheelZoom.enable());
    const c = map.getContainer();
    const off = () => map.scrollWheelZoom.disable();
    c.addEventListener("mouseleave", off);
    tiles = L.tileLayer(tileUrl(), { maxZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap" }).addTo(map);
    ["md-shade", "md-fog", "md-dots"].forEach((p, i) => (map.createPane(p).style.zIndex = String(340 + i * 10)));
    rDots = L.canvas({ pane: "md-dots" });
    G = {
      dots: L.layerGroup().addTo(map),
      pins: L.layerGroup().addTo(map),
      labels: L.layerGroup().addTo(map),
      heat: L.layerGroup(),
      fog: L.layerGroup(),
      ship: L.layerGroup(),
    };
    for (const l of LANES) L.polyline(l, { pane: "md-shade", color: "#5fa8dc", weight: 2, opacity: 0.45, dashArray: "6 6", interactive: false }).addTo(G.ship);
    let t: ReturnType<typeof setTimeout>;
    map.on("zoomend moveend", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        drawPins();
        drawMini();
        if (S.lens === "activity") drawHeat();
      }, 80);
    });
  }

  function pad() {
    return innerWidth <= 860 ? { padding: [10, 10] } : { paddingTopLeft: [190, 60], paddingBottomRight: [60, 60] };
  }

  async function loadShapes() {
    try {
      const [c, y] = await Promise.all([getJson("/iran-countries.geojson"), getJson("/yemen-adm1.geojson")]);
      countriesGeo = c;
      yemenGeo = y;
      countryLayer = L.geoJSON(countriesGeo, { pane: "md-shade", interactive: false, style: () => ({}) }).addTo(map);
      yemenLayer = L.geoJSON(yemenGeo, { pane: "md-shade", interactive: false, style: () => ({}) }).addTo(map);
      shade();
      drawMini();
    } catch (e) {
      console.error(e);
    }
  }

  /** Outlines; the places outside the focus are dimmed. */
  function shade() {
    if (!countryLayer) return;
    const line = cssVar("--line2", "#4a433d");
    const dimFill = isDay() ? "#fff1e5" : "#000";
    const f = F();
    const own = (name: string) => {
      if (!f || f.kind !== "country") return true;
      const id = { "Saudi Arabia": "saudi", Lebanon: "lebanon", "Israel, Judea and Samaria": "israel", Iraq: "iraq", Iran: "iran", Syria: "syria", "United Arab Emirates": "gulf", Qatar: "gulf", Bahrain: "gulf", Kuwait: "gulf", Oman: "gulf" }[name];
      return id === f.id;
    };
    countryLayer.setStyle((ft: any) => {
      const mine = own(ft.properties.name);
      return { color: line, weight: f && mine ? 1.4 : 0.7, fillColor: dimFill, fillOpacity: f && !mine ? 0.35 : 0 };
    });
    const yemenOn = !f || f.id === "yemen" || f.kind !== "country";
    yemenLayer.setStyle(() => ({ color: line, weight: 0.7, fillColor: dimFill, fillOpacity: S.lens === "control" ? 0 : yemenOn ? 0 : 0.35 }));
  }

  function dotList(end: number, span: number) {
    const out: { la: number; ln: number; col: string; a: number; cat: string }[] = [];
    for (const p of PINS) {
      if (p.ms > end) continue;
      if (p.ms <= end - span) break;
      out.push({ la: p.la, ln: p.ln, col: catCol(p.cat), a: pinInFocus(p) ? 1 : 0.25, cat: p.cat });
    }
    return out;
  }
  function drawDots() {
    if (!map) return;
    G.dots.clearLayers();
    const ship = S.lens === "shipping";
    const r = map.getZoom() < 5 ? 2.4 : 3.2;
    for (const p of dotList(endMs(), Math.max(S.span, DAY))) {
      if (ship && p.cat !== "shipping") continue;
      L.circleMarker([p.la, p.ln], { renderer: rDots, radius: r, weight: 0, fillColor: p.col, fillOpacity: 0.65 * p.a, interactive: false }).addTo(G.dots);
    }
    map.getPane("md-dots").style.opacity = S.lens === "activity" ? "0.25" : "1";
  }
  function drawHeat() {
    G.heat.clearLayers();
    const z = map.getZoom();
    const cell = z < 5 ? 1 : z < 7 ? 0.4 : 0.15;
    const g: Record<string, number> = {};
    for (const p of dotList(endMs(), Math.max(S.span, DAY))) {
      if (p.a < 0.5) continue;
      const k = Math.floor(p.la / cell) + ":" + Math.floor(p.ln / cell);
      g[k] = (g[k] || 0) + 1;
    }
    const mx = Math.max(1, ...Object.values(g));
    for (const [k, n] of Object.entries(g)) {
      const [a, b] = k.split(":").map(Number);
      const t = Math.sqrt(n / mx);
      L.rectangle([[a * cell, b * cell], [(a + 1) * cell, (b + 1) * cell]], { pane: "md-shade", weight: 0, fillColor: t > 0.66 ? "#f4a58a" : t > 0.33 ? "#e2694f" : "#7a3526", fillOpacity: 0.2 + 0.6 * t, interactive: false }).addTo(G.heat);
    }
  }
  function drawFog() {
    G.fog.clearLayers();
    if (!countriesGeo || !yemenGeo) return;
    const pts = dotList(endMs(), Math.max(S.span, DAY));
    const fill = isDay() ? "#5c4a3d" : "#000";
    const fog = (f: any, label: boolean) => {
      const b = L.geoJSON(f).getBounds();
      if (pts.some((p) => b.contains([p.la, p.ln]))) return;
      L.geoJSON(f, { pane: "md-fog", interactive: false, style: { weight: 0, fillColor: fill, fillOpacity: 0.5 } }).addTo(G.fog);
      if (label) L.marker(b.getCenter(), { interactive: false, icon: L.divIcon({ className: "md-plain", iconSize: null, html: '<span class="md-fogtxt">No reports</span>' }) }).addTo(G.fog);
    };
    yemenGeo.features.forEach((f) => fog(f, true));
    countriesGeo.features.forEach((f) => fog(f, false));
  }

  /** Yemen's control map: the districts' own control over their governorates', with the update clock's live changes. */
  async function loadControl() {
    if (control) return control;
    const [geo, base, data, brief] = await Promise.all([
      getJson("/yemen-adm2.geojson"),
      getJson("/control.json"),
      getJson("/data.json").catch(() => null),
      getJson("/api/brief").catch(() => null),
    ]);
    const govs: Record<string, string> = {};
    for (const g of data?.governorates ?? []) govs[g.id] = g.control;
    control = { geo, base, govs, live: brief?.controlLive ?? null };
    return control;
  }
  async function drawControl() {
    try {
      const c = await loadControl();
      if (S.lens !== "control") return;
      const col: Record<string, string> = {
        houthi: cssVar("--houthi", "#e2694f"), plc: cssVar("--plc", "#3fb0b3"), saudi: cssVar("--saudi", "#7aa5d6"), contested: cssVar("--contested", "#d9aa45"),
      };
      const side = (p: any) => {
        const own = c.live?.districts?.[p.id] ?? c.base?.districts?.[p.id];
        const s = own?.side || c.govs[p.gov];
        return s === "mixed" ? "contested" : s;
      };
      if (districtLayer) map.removeLayer(districtLayer);
      districtLayer = L.geoJSON(c.geo, {
        pane: "md-shade",
        interactive: false,
        style: (f: any) => {
          const s = side(f.properties);
          return { fillColor: col[s] || col.contested, fillOpacity: s ? 0.5 : 0, color: isDay() ? "#5c4a3d" : "#0b0f14", weight: 0.35, opacity: 0.45 };
        },
      }).addTo(map);
      if (yemenLayer) yemenLayer.bringToFront();
      renderLegend();
    } catch (e) {
      console.error(e);
      toast("The control map did not load");
    }
  }

  function pinIcon(r: Rep) {
    const c = catCol(r.cat);
    const claim = isClaim(r);
    return L.divIcon({
      className: "md-plain",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: `<div class="md-pin ${claim ? "claim" : ""} ${r.ms > lastVisit ? "new" : ""}" style="background:${c};color:${claim ? c : "#1b1918"}">${ICON[r.cat] || ""}</div>`,
    });
  }
  function drawPins() {
    if (!map) return;
    G.pins.clearLayers();
    G.labels.clearLayers();
    // Far out over the whole region: one label per place instead of a cloud of pins.
    if (S.focus === "region" && map.getZoom() < 5.4) return drawLabels();
    const ship = S.lens === "shipping";
    const seen = new Set<string>();
    R.filter((r) => r.lat != null && r.lng != null && inWin(r.ms) && inFocus(r) && (S.cat === "all" || r.cat === S.cat) && (!ship || r.cat === "shipping") && (S.claims || !isClaim(r)))
      .slice(0, 160)
      .forEach((r) => {
        const k = `${r.lat!.toFixed(2)},${r.lng!.toFixed(2)}`;
        // Two pins on one point fan out a little, so both can be clicked.
        const n = seen.has(k) ? 1 : 0;
        seen.add(k);
        const ll = n ? [r.lat! + ((r.ms % 7) - 3) * 0.008, r.lng! + ((r.ms % 5) - 2) * 0.01] : [r.lat!, r.lng!];
        L.marker(ll, { icon: pinIcon(r), riseOnHover: true, title: r.summary, keyboard: true }).on("click", () => select(r)).addTo(G.pins);
      });
  }
  function drawLabels() {
    for (const f of BAR) {
      const at = LABEL_AT[f.id];
      if (!at) continue;
      const last = R.find((r) => r.countries.includes(f.id));
      const tr = trend(f.id);
      // On a PC the two coastal labels sit left of their point, clear of each other; a phone has no room there.
      const left = (f.id === "israel" || f.id === "lebanon") && innerWidth > 860;
      L.marker(at, {
        icon: L.divIcon({
          className: "md-plain",
          iconSize: null,
          iconAnchor: [0, 14],
          html: `<div class="md-tlabel md-glass" style="${left ? "transform:translateX(-100%)" : ""}" data-focus="${f.id}">${flag(f.id)}<b>${esc(f.name)}</b><span class="${tr[0]}" title="${tr[2]}">${tr[1]}</span><small>${last ? ago(last.ms) : ""}</small></div>`,
        }),
      }).addTo(G.labels);
    }
  }

  function applyLens() {
    [G.heat, G.fog, G.ship].forEach((l) => map.removeLayer(l));
    if (districtLayer && S.lens !== "control") {
      map.removeLayer(districtLayer);
      districtLayer = null;
    }
    if (S.lens === "activity") {
      drawHeat();
      G.heat.addTo(map);
    }
    if (S.lens === "quiet") {
      drawFog();
      G.fog.addTo(map);
    }
    if (S.lens === "shipping") G.ship.addTo(map);
    if (S.lens === "control") void drawControl();
    shade();
    renderModes();
    renderLegend();
    drawDots();
    drawPins();
  }

  /* ---------- minimap ---------- */
  function drawMini() {
    const c = $<HTMLCanvasElement>("md-miniC");
    if (!c || !map) return;
    const x = c.getContext("2d")!;
    const W = c.width;
    const Hh = c.height;
    x.clearRect(0, 0, W, Hh);
    const B = REGION_BOUNDS;
    const px = (la: number, ln: number) => [((ln - B[0][1]) / (B[1][1] - B[0][1])) * W, ((B[1][0] - la) / (B[1][0] - B[0][0])) * Hh];
    x.strokeStyle = cssVar("--line2", "#4a433d");
    x.lineWidth = 1;
    for (const g of [countriesGeo, yemenGeo]) {
      for (const f of g?.features ?? []) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const poly of polys)
          for (const ring of poly) {
            x.beginPath();
            ring.forEach((p: number[], i: number) => {
              const [a, b] = px(p[1], p[0]);
              if (i) x.lineTo(a, b);
              else x.moveTo(a, b);
            });
            x.stroke();
          }
      }
    }
    for (const p of dotList(endMs(), Math.max(S.span, DAY))) {
      const [a, b] = px(p.la, p.ln);
      x.globalAlpha = 0.75 * p.a;
      x.fillStyle = p.col;
      x.fillRect(a - 1, b - 1, 2.4, 2.4);
    }
    x.globalAlpha = 1;
    const v = map.getBounds();
    const [l, t] = px(v.getNorth(), v.getWest());
    const [r, bm] = px(v.getSouth(), v.getEast());
    x.strokeStyle = cssVar("--accent", "#f4a58a");
    x.lineWidth = 2;
    x.strokeRect(l, t, r - l, bm - t);
  }

  /* ---------- the selected report ---------- */
  function select(r: Rep, fly = true) {
    if (fly && r.lat != null && r.lng != null) map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 7), { duration: 1 });
    const head = r.parent ? byFp.get(r.parent) : null;
    const kids = r.kids.map((k) => byFp.get(k)).filter(Boolean) as Rep[];
    const also = (r.alsoReportedBy || []).filter((a) => a.source);
    const el = $("md-sel");
    el.innerHTML = `<button type="button" class="x" data-close-sel aria-label="Close">✕</button>
      <div class="md-meta"><span class="md-tyl" style="background:${catCol(r.cat)}">${esc(catName(r.cat))}</span><span>${dm(r.ms)} ${hm(r.ms)}</span>${r.place ? `<span>${esc(r.place)}</span>` : ""}<span class="md-src">${esc(r.source)}</span></div>
      <h4>${esc(r.summary)}</h4>${r.text && r.text !== r.summary ? `<p class="body">${esc(r.text.slice(0, 320))}${r.text.length > 320 ? "…" : ""}</p>` : ""}
      ${also.length ? `<p class="md-also">Also reported by ${also.slice(0, 4).map((a) => (a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.source)}</a>` : esc(a.source))).join(", ")}</p>` : ""}
      <div class="md-acts">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Read at the source ↗</a>` : ""}${r.lat != null ? `<button type="button" data-near="${esc(r.fp)}">Nearby, 7 days</button>` : ""}${r.countries.filter((c) => focusById(c) && !focusById(c)!.hidden && c !== S.focus).slice(0, 3).map((c) => `<button type="button" data-focus="${c}">${esc(focusById(c)!.name)}</button>`).join("")}</div>
      ${head || kids.length ? `<div class="md-chain"><div class="md-kicker">Thread</div>${[head, ...kids].filter(Boolean).slice(0, 5).map((k) => `<div class="md-step" data-sel="${esc(k!.fp)}">${hm(k!.ms)} · ${esc(k!.summary)}</div>`).join("")}</div>` : ""}`;
    el.classList.add("show");
  }

  /* ---------- masthead strip, focus bar, key event ---------- */
  function renderDateline() {
    const t = now();
    const days = WAR_DESKS.filter((d) => d.start && !d.planned).map((d) => `${esc(d.short)}, day ${warDay(d, t)}`);
    $("md-dateline").innerHTML = `<b>${esc(fLong.format(t))}</b> · ${days.join(" · ")}`;
  }
  function tick() {
    const pc = document.getElementById("md-pclock");
    const pf = F();
    if (pc && pf?.tz) pc.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: pf.tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now());
    const clocks = [["Sanaa", "Asia/Aden"], ["Tehran", "Asia/Tehran"], ["Beirut", "Asia/Beirut"], ["Washington", "America/New_York"]];
    $("md-clocks").innerHTML = clocks
      .map(([n, tz]) => `${n} <b>${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now())}</b>`)
      .join(" · ");
  }

  function renderFocusBar() {
    const fresh = (id: string) => R.some((r) => r.ms > lastVisit && r.countries.includes(id));
    const btn = (id: string, name: string) =>
      `<a class="md-fb ${S.focus === id ? "on" : ""}" href="/${focusById(id)?.slug ?? ""}" data-focus="${id}" title="${esc(focusById(id)?.context || "Everything, on one map")}"${S.focus === id ? ' aria-current="page"' : ""}>${flag(id)}${esc(name)}${id !== "region" && S.focus !== id && fresh(id) ? '<span class="hot" title="New since your last visit"></span>' : ""}</a>`;
    const desks = WAR_DESKS.map((d) =>
      d.planned
        ? `<span class="md-fb soon" title="${esc(d.context)}">${esc(d.short)}<span class="n">soon</span></span>`
        : `<a class="md-fb" href="${d.path}" title="${esc(d.context)}">${esc(d.name)}<span class="n">day ${warDay(d, now())}</span></a>`,
    );
    $("md-focusbar").innerHTML = `<div class="md-fbg">${btn("region", "Whole region")}</div><span class="md-fbs"></span><span class="md-fbl">Countries &amp; seas</span><div class="md-fbg">${BAR.map((f) => btn(f.id, f.name)).join("")}</div><span class="md-fbs"></span><span class="md-fbl">Desks</span><div class="md-fbg">${desks.join("")}</div>`;
  }

  /**
   * The key event: the first point of a desk's brief (the desk's own choice of
   * what matters most), with the card it cites. The newer brief, if its point
   * is a strike, fighting or shipping; else the Yemen desk's.
   */
  function keyEvent(): { text: string; r: Rep | null; at: number } | null {
    const pick = (b?: Brief) => {
      if (!b?.points?.length) return null;
      const m = /\[\[(\d+)\]\]/.exec(b.points[0]);
      const ref = m ? b.refs[Number(m[1]) - 1] : b.refs[0];
      const r = ref?.fp ? byFp.get(ref.fp) ?? null : null;
      return { text: noRefs(b.points[0]), r, at: Date.parse(b.updatedAt || "") || 0, hard: !!r && ["strike", "combat", "shipping"].includes(r.cat) };
    };
    const y = pick(BRIEFS.yemen);
    const i = pick(BRIEFS.iran);
    const both = [y, i].filter(Boolean) as NonNullable<ReturnType<typeof pick>>[];
    const hard = both.filter((x) => x.hard).sort((a, b) => b.at - a.at)[0];
    return hard ?? y ?? i ?? null;
  }
  function renderKey() {
    const k = keyEvent();
    const id = k ? k.r?.fp ?? k.text.slice(0, 60) : "";
    if (!k || store.get("keyx", "") === id || S.focus !== "region") {
      $("md-key").innerHTML = "";
      return;
    }
    $("md-key").innerHTML = `<div class="md-keyev"><span class="md-kicker">Key event</span><a href="#" ${k.r ? `data-sel="${esc(k.r.fp)}"` : ""}>${esc(k.text)}</a><span class="md-kmeta">${k.r ? `${hm(k.r.ms)} · ${esc(k.r.source)}` : ""}</span><button type="button" class="md-pill" data-keyx="${esc(id)}" aria-label="Dismiss" style="margin-left:auto">✕</button></div>`;
  }

  /* ---------- lead ---------- */
  function leadPick() {
    const all = R.filter((r) => inFocus(r) && r.ms <= endMs());
    // A country or sea page leads with what happened there, not what only names it.
    const own = F() && F()!.kind !== "actor" ? all.filter((r) => r.where === S.focus) : [];
    const list = own.length >= 4 ? own : all;
    const hard = list.filter((r) => ["strike", "combat", "shipping"].includes(r.cat));
    const score = (r: Rep) => (r.alsoReportedBy?.length || 0) * 3 + (r.tier === "agency" ? 2 : 0) + (r.place ? 1 : 0) - (endMs() - r.ms) / (3 * H);
    const lead = [...hard.slice(0, 60)].sort((a, b) => score(b) - score(a))[0] || list[0];
    const side: Rep[] = [];
    const used = new Set([lead?.cat]);
    for (const r of list) {
      if (side.length >= 3) break;
      if (r === lead) continue;
      if (!used.has(r.cat) || side.length >= 2) {
        side.push(r);
        used.add(r.cat);
      }
    }
    return { lead, side };
  }
  function renderLead() {
    const { lead, side } = leadPick();
    const f = F();
    const kick = !f ? "The whole region" : `Latest from ${f.name}`;
    const viewing = S.end ? ` · <span style="color:var(--gold)">to ${dm(S.end)} ${hm(S.end)}</span>` : "";
    $("md-lead").innerHTML = lead
      ? `<div>
        <div class="md-kicker">${f ? "" : `${flag(S.focus)} `}${esc(kick)} · <b>●</b> updated ${hm(R[0]?.ms ?? now())} Sanaa${viewing}</div>
        <h2 data-sel="${esc(lead.fp)}">${esc(lead.summary)}</h2>
        <div class="md-meta"><span class="md-src">${esc(lead.source)}</span><span>${dm(lead.ms)} ${hm(lead.ms)}</span>${lead.place ? `<span>${esc(lead.place)}</span>` : ""}${lead.countries.filter((c) => focusById(c) && !focusById(c)!.hidden && c !== S.focus).map((c) => `<span class="md-ctag" data-focus="${c}">${esc(focusById(c)!.name)}</span>`).join("")}</div>
      </div>
      <div class="md-side">${side.map((r) => `<div class="it" data-sel="${esc(r.fp)}"><div class="md-kicker" style="font-size:9.5px">${esc(catName(r.cat))} · ${hm(r.ms)} · ${esc(r.source)}</div><h3>${esc(r.summary)}</h3></div>`).join("")}</div>`
      : `<div><h2>No reports in this period</h2></div>`;
  }

  /** Today in brief: each desk's own top line, or the brief sections that speak for this place. */
  function dailyHtml() {
    const f = F();
    const at = Math.max(Date.parse(BRIEFS.yemen?.updatedAt || "") || 0, Date.parse(BRIEFS.iran?.updatedAt || "") || 0);
    let body = "";
    if (!f) {
      const y = firstPara(BRIEFS.yemen?.line || "");
      const i = firstPara(BRIEFS.iran?.line || "");
      body = `${i ? `<p><b>Iran war</b>${esc(i)}</p>` : ""}${y ? `<p><b>Yemen war</b>${esc(y)}</p>` : ""}`;
    } else {
      const secs = [...(BRIEFS.yemen?.sections || []), ...(BRIEFS.iran?.sections || [])].filter((s) => (BRIEF_FOR[s.name] || (f.id === "yemen" && BRIEFS.yemen?.sections.includes(s) ? ["yemen"] : [])).includes(f.id));
      body = secs.slice(0, 2).map((s) => `<p><b>${esc(s.name)}</b>${esc(noRefs(s.points[0] || ""))}</p>`).join("");
    }
    return body ? `<div class="md-daily"><span class="md-kicker">Today in brief${at ? ` · ${hm(at)} Sanaa` : ""}</span>${body}</div>` : "";
  }

  /* ---------- HUD ---------- */
  function renderModes() {
    const M: [Lens, string][] = [["reports", "Reports"], ["activity", "Activity"], ["control", "Control in Yemen"], ["shipping", "Shipping"], ["quiet", "Quiet areas"]];
    $("md-modes").innerHTML = `<div class="ttl">Map mode</div>${M.map(([id, n]) => `<button type="button" data-lens="${id}" class="${S.lens === id ? "on" : ""}" aria-pressed="${S.lens === id}">${n}</button>`).join("")}<hr><label><input type="checkbox" data-tg="claims" ${S.claims ? "checked" : ""}>Hollow pins (one side's account)</label>`;
  }
  function renderLegend() {
    let h = "";
    if (S.lens === "control") {
      const asOf = control?.live?.asOf || control?.base?.asOf || "";
      h = `<span><i style="background:${cssVar("--houthi", "#e2694f")}"></i>Houthi forces</span><span><i style="background:${cssVar("--plc", "#3fb0b3")}"></i>Government</span><span><i style="background:${cssVar("--contested", "#d9aa45")}"></i>Contested</span>${asOf ? `<span style="color:var(--faint)">Assessed control, as of ${esc(dm(Date.parse(asOf)))}</span>` : ""}`;
    } else if (S.lens === "activity") h = '<span><i style="background:#7a3526"></i>Few</span><span><i style="background:#e2694f"></i>More</span><span><i style="background:#f4a58a"></i>Most pins</span>';
    else if (S.lens === "quiet") h = '<span><i style="background:#000;border:1px solid var(--line2)"></i>No reports in this period: no news, not calm</span>';
    else h = CATEGORIES.slice(0, 3).map((c) => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join("") + '<span><i style="border:1.5px dashed var(--muted)"></i>Hollow: one side\'s account so far</span>';
    $("md-legend").innerHTML = h;
  }
  /** New in the last two hours, grouped by place: never one chip per pin, and never a number. */
  function renderChips() {
    const g = new Map<string, Rep>();
    for (const r of R) {
      if (r.ms <= now() - 2 * H) break;
      if (!inFocus(r) || r.ms <= lastVisit) continue;
      const k = r.place || focusById(r.where || "")?.name;
      if (k && !g.has(k)) g.set(k, r);
    }
    $("md-chips").innerHTML = [...g.entries()].slice(0, 3).map(([k, r]) => `<span class="md-chip" data-sel="${esc(r.fp)}">New · ${esc(k)} · ${hm(r.ms)}</span>`).join("");
  }

  /* ---------- replay strip ---------- */
  const START = () => Math.max(now() - 120 * DAY, PINS.length ? PINS[PINS.length - 1].ms : now() - 30 * DAY);
  function drawTrack() {
    const c = $<HTMLCanvasElement>("md-trackC");
    const w = c.clientWidth * 2;
    if (!w) return;
    c.width = w;
    const x = c.getContext("2d")!;
    const t = now();
    const days = Math.max(1, Math.ceil((t - START()) / DAY));
    const bars = new Array(days).fill(0);
    const b = boundsOf();
    for (const p of PINS) {
      if (S.focus !== "region" && F()?.kind !== "actor" ? p.where !== S.focus && !inB(p.la, p.ln, b) : false) continue;
      const i = Math.floor((t - p.ms) / DAY);
      if (i >= 0 && i < days) bars[i]++;
    }
    const mx = Math.max(1, ...bars);
    const bw = w / days;
    const e = endMs();
    const on = cssVar("--accent2", "#e2694f");
    const off = cssVar("--line2", "#4a433d");
    bars.forEach((v, i) => {
      const bx = w - (i + 1) * bw;
      const h = Math.sqrt(v / mx) * 46;
      const d = t - i * DAY;
      x.fillStyle = d <= e + DAY / 2 && d > e - Math.max(S.span, DAY) ? on : off;
      x.fillRect(bx + 0.5, 56 - h, Math.max(1, bw - 1), h);
    });
    x.fillStyle = cssVar("--faint", "#766b62");
    x.font = "18px JetBrains Mono, monospace";
    x.fillText(dm(START()), 4, 18);
    const y = WAR_DESKS.find((d) => d.id === "yemen");
    const wy = y?.start ? Math.floor((t - Date.parse(`${y.start}T00:00:00+03:00`)) / DAY) : -1;
    if (wy >= 0 && wy < days) {
      x.fillStyle = cssVar("--houthi", "#c45c26");
      x.fillRect(w - wy * bw, 0, 2, 60);
      x.fillText("Yemen war", w - wy * bw + 6, 18);
    }
  }
  function setEnd(ms: number | null, fromSlider = false) {
    const t = now();
    S.end = ms == null || ms >= t - 30 * 60_000 ? null : Math.max(START() + DAY, ms);
    const rng = $<HTMLInputElement>("md-range");
    if (!fromSlider) rng.value = String(Math.round(((endMs() - START()) / (t - START())) * 1000));
    $("md-thumb").style.left = `calc(${Number(rng.value) / 10}% - 1px)`;
    $("md-thumbLbl").textContent = S.end ? dm(S.end) : "Now";
    $("md-span").textContent = S.span === DAY ? "24 h" : S.span === 7 * DAY ? "7 days" : "30 days";
    drawTrack();
    drawDots();
    drawPins();
    drawMini();
    if (S.lens === "activity") drawHeat();
    if (S.lens === "quiet") drawFog();
    renderLead();
    renderFeed();
  }
  let playT: ReturnType<typeof setInterval> | null = null;
  let speed = 1;
  function play() {
    if (playT) return stopPlay();
    if (!S.end) setEnd(Math.max(START() + DAY, now() - 45 * DAY));
    $("md-play").textContent = "❚❚";
    playT = setInterval(() => {
      if (!S.end) return stopPlay();
      setEnd(S.end + (DAY * speed) / 4);
    }, 250);
  }
  function stopPlay() {
    if (playT) clearInterval(playT);
    playT = null;
    $("md-play").textContent = "▶";
  }

  /* ---------- the wire ---------- */
  function feedList() {
    return R.filter((r) => inFocus(r) && r.ms <= endMs() && (S.cat === "all" || r.cat === S.cat));
  }
  function card(r: Rep, small = false): string {
    const also = (r.alsoReportedBy || []).map((a) => a.source).filter(Boolean) as string[];
    const tags = small ? "" : r.countries.slice(0, 3).filter((c) => c !== S.focus && focusById(c) && !focusById(c)!.hidden).map((c) => `<span class="md-ctag" data-focus="${c}">${esc(focusById(c)!.name)}</span>`).join("");
    return `<div class="md-card ${r.ms > lastVisit ? "new" : ""} ${isClaim(r) ? "claim" : ""}" data-sel="${esc(r.fp)}"><span class="md-edge" style="background:${catCol(r.cat)}"></span><div>
      <div class="m"><span>${dayKey(r.ms) === dayKey(now()) ? "" : dm(r.ms) + " "}${hm(r.ms)}</span><span class="md-src">${esc(r.source)}</span>${tags}</div>
      <h3>${esc(r.summary)}</h3>
      <div class="sub">${r.place ? `<span>◉ ${esc(r.place)}</span>` : ""}${also.length ? `<span>Also: <b>${also.slice(0, 3).map(esc).join(", ")}</b></span>` : ""}${r.kids.length && !small ? `<a href="#" data-thread="${esc(r.fp)}">${openThreads.has(r.fp) ? "Hide the thread" : "Show the thread"}</a>` : ""}</div>
      </div></div>${openThreads.has(r.fp) ? `<div class="md-thread">${r.kids.map((k) => byFp.get(k)).filter(Boolean).map((k) => card(k!, true)).join("")}</div>` : ""}`;
  }
  function storyBlock(word: string, list: Rep[], developing: boolean) {
    const open = openStories.has(word);
    const span = `${hm(list[list.length - 1].ms)}–${hm(list[0].ms)}`;
    return `<div class="md-story"><button type="button" class="md-storyh" data-story="${esc(word)}"><span class="md-kicker" style="color:var(--${developing ? "accent2" : "accent"})">${developing ? "Developing story" : "Story"}</span><b>${esc(word)}</b><span>${span}</span><span class="tg">${open ? "Fold" : "Show all"}</span></button>${(open ? list : list.slice(0, developing ? 3 : 2)).map((x) => card(x, developing)).join("")}</div>`;
  }
  function renderFeed() {
    const all = feedList();
    const top = all.filter((r) => !r.parent || !byFp.has(r.parent) || !all.includes(byFp.get(r.parent)!));
    const f = F();
    const title = f ? `${f.name}: latest` : "Latest reports";
    let body = "";
    if (S.view === "cards") {
      const used = new Set<string>();
      const dev: Record<string, Rep[]> = {};
      for (const r of top) {
        const st = STORY.get(r.fp);
        if (st && endMs() - r.ms < 12 * H) (dev[st] = dev[st] || []).push(r);
      }
      const devS = Object.entries(dev).filter(([, l]) => l.length >= 6);
      body = devS.map(([st, l]) => (used.add(st), storyBlock(st, l, true))).join("");
      body += top
        .filter((r) => !used.has(STORY.get(r.fp) || ""))
        .slice(0, shown)
        .map((r) => {
          const st = STORY.get(r.fp);
          if (!st) return card(r);
          if (used.has(st)) return "";
          used.add(st);
          const l = top.filter((x) => STORY.get(x.fp) === st);
          return l.length < 3 ? card(r) : storyBlock(st, l, false);
        })
        .join("");
      if (!top.length) body = '<p class="md-empty">No reports in this period.</p>';
      if (top.length > shown || !reachedEnd) body += '<button type="button" class="md-more" data-more="1">Earlier reports</button>';
    } else if (S.view === "log") {
      body = `<div class="md-log">${all.slice(0, 200).map((r) => `<div data-sel="${esc(r.fp)}"><span class="t">${hm(r.ms)}</span><span style="color:${catCol(r.cat)}">${esc(catName(r.cat).toUpperCase())}</span><span class="t">${esc((r.place || focusById(r.countries[0] || "")?.name || "").slice(0, 15))}</span><span>${esc(r.summary)}</span></div>`).join("")}</div>`;
    } else body = table(all);
    const fg = f ? FIGS.get(f.id) : undefined;
    const cats = [["all", "All", ""], ...CATEGORIES.filter((c) => !fg || fg.cats[c.id] || S.cat === c.id).map((c) => [c.id, c.name, c.color])];
    $("md-feed").innerHTML = `${dailyHtml()}<div class="md-sech"><h2>${esc(title)}<small>${S.end ? `to ${dm(S.end)} ${hm(S.end)}` : "live"}</small></h2>
      <span class="md-views">${(["cards", "log", "table"] as const).map((v) => `<button type="button" data-view="${v}" class="${S.view === v ? "on" : ""}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</span></div>
      <div class="md-cats">${cats.map(([id, n, c]) => {
        // A country or sea page shows each kind's seven days; the main page, no counts.
        const k = fg ? (id === "all" ? fg.week : fg.cats[id] || 0) : null;
        return `<button type="button" data-cat="${id}" class="${S.cat === id ? "on" : ""}"${k != null ? ' title="Reports in the last 7 days"' : ""}>${c ? `<i style="background:${c}"></i>` : ""}${n}${k != null ? ` <span class="md-cn">${k}</span>` : ""}</button>`;
      }).join("")}</div>${body}`;
  }
  /** The table: the latest from each place or outlet, newest first. A list, not a tally. */
  function table(list: Rep[]) {
    const g = new Map<string, Rep>();
    for (const r of list) {
      const k = tableTab === "places" ? r.place : r.source;
      if (k && !g.has(k)) g.set(k, r);
    }
    const rows = [...g.entries()].slice(0, 80);
    const head = tableTab === "places" ? "<th>Place</th><th>Area</th><th>Latest report</th><th>When</th>" : "<th>Outlet</th><th>Latest report</th><th>When</th>";
    return `<div class="md-cats">${(["places", "sources"] as const).map((k) => `<button type="button" data-ttab="${k}" class="${tableTab === k ? "on" : ""}">${k === "places" ? "Places" : "Outlets"}</button>`).join("")}</div>
      <div style="overflow-x:auto"><table class="md-tbl"><thead><tr>${head}</tr></thead><tbody>${rows
        .map(([k, r]) =>
          tableTab === "places"
            ? `<tr data-sel="${esc(r.fp)}"><td>${esc(k)}</td><td class="w">${esc(focusById(r.where || r.countries[0] || "")?.name || "")}</td><td class="h">${esc(r.summary)}</td><td class="w">${ago(r.ms)}</td></tr>`
            : `<tr data-sel="${esc(r.fp)}"><td>${esc(k)}</td><td class="h">${esc(r.summary)}</td><td class="w">${ago(r.ms)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`;
  }

  /* ---------- a country or sea page ---------- */
  async function loadFigures(id: string) {
    const had = FIGS.get(id);
    if (had && now() - had.got < 10 * 60_000) return;
    try {
      const j = await getJson(`/api/region?figures=${encodeURIComponent(id)}`);
      if (!j.ok) return;
      FIGS.set(id, { ...j, got: now() });
      if (stopped || S.focus !== id) return;
      renderPlace();
      renderSide();
      renderFeed();
    } catch (e) {
      console.error(e);
    }
  }
  /** The page's head and figures strip; the main page has neither. */
  function renderPlace() {
    const el = $("md-place");
    const f = F();
    if (!f) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (el.dataset.focus !== f.id) {
      el.innerHTML = placeHeadHtml(f);
      el.dataset.focus = f.id;
      tick();
    }
    const fg = FIGS.get(f.id);
    $("md-figs").innerHTML = fg ? figsHtml(fg) : '<div class="md-fig"><span class="k">Figures</span><b>…</b></div>';
  }
  function figsHtml(fg: Figs) {
    const dir = fg.d1 > fg.d0 * 1.15 ? ["md-up", "▲"] : fg.d1 < fg.d0 * 0.85 ? ["md-down", "▼"] : ["md-flat", "→"];
    const max = Math.max(1, ...fg.days.map((d) => d[1]));
    const spark = `<svg class="md-spark" viewBox="0 0 70 22" preserveAspectRatio="none" aria-hidden="true">${fg.days
      .map(([, n], i) => `<rect x="${i * 10 + 1}" y="${22 - Math.max(1, (n / max) * 22)}" width="8" height="${Math.max(1, (n / max) * 22)}"/>`)
      .join("")}</svg>`;
    const top = fg.places[0];
    const cell = (k: string, v: string, sub = "") => `<div class="md-fig"><span class="k">${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    return (
      cell("Reports, last 24 hours", String(fg.d1), `<span class="${dir[0]}">${dir[1]}</span> ${fg.d0} the day before`) +
      cell("Reports, 7 days", String(fg.week), spark) +
      (F()?.kind === "actor" ? "" : cell("Pins on the map, 24 hours", String(fg.pins24))) +
      cell("Outlets, 7 days", String(fg.outlets)) +
      (top ? cell("Most reported place", esc(top.name), `${top.n} reports in 7 days`) : "") +
      `<div class="md-figat">As of ${hm(fg.got)} Sanaa, renewed every ten minutes</div>`
    );
  }
  function whoHtml(fg: Figs) {
    if (!fg.actors.length) return "";
    const max = fg.actors[0].n;
    return `<div class="md-box"><h4>Who is active</h4><p class="md-boxsub">Reports that name each side, last 7 days</p>${fg.actors
      .slice(0, 8)
      .map((a) => `<div class="md-bar"><span class="nm">${esc(a.name)}</span><span class="tr"><i style="width:${Math.max(3, (a.n / max) * 100)}%"></i></span><span class="n">${a.n}</span></div>`)
      .join("")}</div>`;
  }
  function placesHtml(fg: Figs) {
    if (!fg.places.length) return "";
    return `<div class="md-box"><h4>Places</h4><p class="md-boxsub">Most reported, last 7 days</p><div class="md-plist">${fg.places
      .slice(0, 10)
      .map((p) => `<button type="button" ${byFp.has(p.fp) ? `data-sel="${esc(p.fp)}"` : p.lat != null ? `data-fly="${p.lat},${p.lng}"` : ""}><span class="nm">${esc(p.name)}</span><span class="n">${p.n}</span><span class="w">${ago(Date.parse(p.at))}</span></button>`)
      .join("")}</div></div>`;
  }
  /** When reports come in, by the hour of the place's own clock, over seven days. */
  function hourClockHtml(fg: Figs, f: Focus) {
    const max = Math.max(1, ...fg.hours);
    if (!fg.week) return "";
    const c = 80;
    const r0 = 24;
    const pt = (r: number, a: number) => `${(c + r * Math.sin(a)).toFixed(1)},${(c - r * Math.cos(a)).toFixed(1)}`;
    const wedges = fg.hours
      .map((n, h) => {
        const a0 = (h / 24) * 2 * Math.PI + 0.02;
        const a1 = ((h + 1) / 24) * 2 * Math.PI - 0.02;
        const r1 = r0 + 4 + (n / max) * 40;
        return `<path d="M${pt(r0, a0)} L${pt(r1, a0)} A${r1} ${r1} 0 0 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 0 0 ${pt(r0, a0)}Z" opacity="${(0.35 + 0.65 * (n / max)).toFixed(2)}"><title>${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00 · ${n}</title></path>`;
      })
      .join("");
    const peak = fg.hours.indexOf(max);
    const marks = [0, 6, 12, 18].map((h) => {
      const [x, y] = pt(r0 + 51, (h / 24) * 2 * Math.PI).split(",");
      return `<text x="${x}" y="${Number(y) + 3}">${String(h).padStart(2, "0")}</text>`;
    });
    const where = f.clock ?? "Sanaa";
    return `<div class="md-box"><h4>The hour clock</h4><p class="md-boxsub">When reports come in, ${esc(where)} time, last 7 days</p>
      <div class="md-hclock"><svg viewBox="-4 -4 168 168" role="img" aria-label="Reports by hour of the day">${wedges}${marks.join("")}<text x="80" y="78" class="c">${esc(where)}</text><text x="80" y="90" class="c">time</text></svg>
      <p>Busiest hour: <b>${String(peak).padStart(2, "0")}:00–${String((peak + 1) % 24).padStart(2, "0")}:00</b></p></div></div>`;
  }

  /* ---------- the side column ---------- */
  function renderSide() {
    const t = now();
    const f = F();
    const desks = WAR_DESKS.map((d) =>
      d.planned
        ? `<div class="md-area soon"><div class="t">${esc(d.name)}<span class="tr md-flat">being built</span></div><p>${esc(d.context)}</p></div>`
        : `<a class="md-area" href="${d.path}"><div class="t">${esc(d.name)}<span class="tr md-flat">day ${warDay(d, t)}</span></div><p>${esc(d.context)}</p><div class="md-meta">Control map, fronts, numbers, timeline →</div></a>`,
    ).join("");
    const how = `<div class="md-box"><h4>How we work</h4><p>Every report is traced to where it first appeared and written as plain wire copy. A pin marks one event; control changes only on several independent reports. <a href="/yemen-conflict-desk/methodology">Methodology →</a></p></div>`;
    const areas = BAR.filter((x) => x.id !== S.focus)
      .map((x) => {
        const last = R.find((r) => r.countries.includes(x.id));
        if (!last) return "";
        const tr = trend(x.id);
        return `<div class="md-area" data-focus="${x.id}"><div class="t">${flag(x.id)}${esc(x.name)}<span class="tr ${tr[0]}" title="${tr[2]}">${tr[1]} ${tr[2]}</span></div><p>${esc(last.summary)}</p><div class="md-meta">${ago(last.ms)} · ${esc(last.source)}</div></div>`;
      })
      .join("");
    let lead = "";
    if (f) {
      const secs = [...(BRIEFS.yemen?.sections || []), ...(BRIEFS.iran?.sections || [])].filter((s) => (BRIEF_FOR[s.name] || (f.id === "yemen" && BRIEFS.yemen?.sections.includes(s) ? ["yemen"] : [])).includes(f.id));
      const fg = FIGS.get(f.id);
      lead = `${secs.length ? `<div class="md-box"><h4>Latest developments</h4><ol style="margin:0;padding-left:18px;font-family:var(--serif)">${secs.slice(0, 4).map((s) => `<li style="margin-bottom:6px"><b style="font-family:var(--sans);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${esc(s.name)}</b><br>${s.points.slice(0, 2).map((p) => esc(noRefs(p))).join(" ")}</li>`).join("")}</ol></div>` : ""}${fg ? whoHtml(fg) + placesHtml(fg) + hourClockHtml(fg, f) : ""}`;
    }
    $("md-sidecol").innerHTML = `${lead}<div class="md-sech"><h2>Across the region</h2></div>${areas}<div class="md-sech" style="margin-top:18px"><h2>The desks</h2></div>${desks}${how}`;
  }

  /* ---------- moving between places ---------- */
  async function go(focus: FocusId | "region", instant = false) {
    S.focus = focus;
    shown = PAGE;
    const f = F();
    if (f?.lens && S.lens === "reports") S.lens = f.lens;
    if (instant) map.fitBounds(boundsOf(), { animate: false, ...pad() });
    else map.flyToBounds(boundsOf(), { duration: 1.4, easeLinearity: 0.25, ...pad() });
    // With a router, the address is already the place's own (/lebanon); alone, a ?focus= mark.
    if (!opts.onFocus) {
      const u = new URL(location.href);
      if (f) u.searchParams.set("focus", f.slug);
      else u.searchParams.delete("focus");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
    $("md-sel").classList.remove("show");
    renderAll();
    if (f) void loadFigures(f.id);
    if (f && !deep.has(f.id)) {
      deep.add(f.id);
      try {
        if (await loadRegion(f.id)) renderAll();
      } catch (e) {
        console.error(e);
      }
    }
  }
  function renderAll() {
    renderFocusBar();
    renderPlace();
    renderKey();
    renderLead();
    renderModes();
    renderLegend();
    renderChips();
    shade();
    applyLens();
    setEnd(S.end);
    renderSide();
  }

  /* ---------- events ---------- */
  let latestI = 0;
  function latest() {
    const list = R.filter((r) => r.lat != null && inFocus(r) && r.ms <= endMs());
    const r = list[latestI++ % Math.max(1, list.length)];
    if (r) select(r);
  }
  function toast(t: string) {
    const e = $("md-toast");
    e.textContent = t;
    e.classList.add("show");
    clearTimeout((toast as any).t);
    (toast as any).t = setTimeout(() => e.classList.remove("show"), 1800);
  }
  async function more() {
    shown += PAGE;
    const top = feedList();
    if (top.length < shown && !reachedEnd) {
      const oldest = R[R.length - 1];
      try {
        await loadRegion(S.focus === "region" ? null : S.focus, oldest?.at, 200);
      } catch (e) {
        console.error(e);
      }
    }
    renderFeed();
  }
  /** A reader picked a place: its own address when the page has a router, else a move in place. */
  function pick(id: FocusId | "region") {
    if (id === S.focus) return;
    if (opts.onFocus) opts.onFocus(id === "region" ? null : focusById(id) ?? null);
    else void go(id);
  }
  const scrollToMap = () => $("md-stage").scrollIntoView({ behavior: "smooth", block: "center" });

  function onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-focus],[data-sel],[data-cat],[data-lens],[data-view],[data-ttab],[data-thread],[data-story],[data-near],[data-keyx],[data-more],[data-close-sel],[data-fly]");
    if (!a) return;
    const d = a.dataset;
    // A place's link opened in a new tab or window stays a plain link.
    if (a.tagName === "A" && (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)) return;
    if (a.tagName === "A" && !a.getAttribute("target")) e.preventDefault();
    if (d.closeSel != null) return $("md-sel").classList.remove("show");
    if (d.focus) {
      pick(d.focus as FocusId | "region");
      if (!a.closest(".md-stage") && !a.closest(".md-focusbar")) scrollToMap();
      return;
    }
    if (d.thread) {
      e.stopPropagation();
      if (openThreads.has(d.thread)) openThreads.delete(d.thread);
      else openThreads.add(d.thread);
      return renderFeed();
    }
    if (d.story) {
      if (openStories.has(d.story)) openStories.delete(d.story);
      else openStories.add(d.story);
      return renderFeed();
    }
    if (d.sel) {
      const r = byFp.get(d.sel);
      if (!r) return;
      select(r);
      if (!a.closest(".md-stage")) scrollToMap();
      return;
    }
    if (d.cat) {
      S.cat = d.cat;
      shown = PAGE;
      renderFeed();
      return drawPins();
    }
    if (d.lens) {
      S.lens = d.lens as Lens;
      return applyLens();
    }
    if (d.view) {
      S.view = d.view as typeof S.view;
      return renderFeed();
    }
    if (d.ttab) {
      tableTab = d.ttab as typeof tableTab;
      return renderFeed();
    }
    if (d.near) {
      const r = byFp.get(d.near);
      if (!r || r.lat == null) return;
      map.flyTo([r.lat, r.lng], 9);
      S.span = 7 * DAY;
      setEnd(S.end);
      return toast("Nearby, the last 7 days");
    }
    if (d.keyx) {
      store.set("keyx", d.keyx);
      return renderKey();
    }
    if (d.fly) {
      const [la, ln] = d.fly.split(",").map(Number);
      if (Number.isFinite(la) && Number.isFinite(ln)) map.flyTo([la, ln], 9, { duration: 1 });
      return scrollToMap();
    }
    if (d.more) void more();
  }
  function onChange(e: Event) {
    const t = (e.target as HTMLInputElement).dataset?.tg;
    if (t === "claims") {
      S.claims = (e.target as HTMLInputElement).checked;
      drawPins();
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") $("md-sel").classList.remove("show");
  }

  /* ---------- start ---------- */
  let timers: ReturnType<typeof setInterval>[] = [];
  let observer: MutationObserver | null = null;
  let onResize: (() => void) | null = null;
  let stopped = false;

  async function boot() {
    // Leaflet is loaded by the page's root; wait for it.
    for (let i = 0; !L && i < 100; i++) {
      await new Promise((r) => setTimeout(r, 50));
      L = (window as any).L;
    }
    if (stopped || !L) return;
    makeMap();
    root!.addEventListener("click", onClick);
    root!.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    $("md-latest").onclick = latest;
    $("md-play").onclick = play;
    $("md-speed").onclick = () => {
      speed = speed === 1 ? 4 : speed === 4 ? 16 : 1;
      $("md-speed").textContent = `${speed} day${speed > 1 ? "s" : ""}/s`;
    };
    $("md-span").onclick = () => {
      S.span = S.span === DAY ? 7 * DAY : S.span === 7 * DAY ? 30 * DAY : DAY;
      setEnd(S.end);
    };
    $<HTMLInputElement>("md-range").oninput = () => {
      stopPlay();
      const v = Number($<HTMLInputElement>("md-range").value);
      setEnd(START() + (v / 1000) * (now() - START()), true);
    };
    $("md-mini").onclick = (e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const B = REGION_BOUNDS;
      map.flyTo([B[1][0] - ((e.clientY - r.top) / r.height) * (B[1][0] - B[0][0]), B[0][1] + ((e.clientX - r.left) / r.width) * (B[1][1] - B[0][1])], map.getZoom(), { duration: 0.6 });
    };
    renderDateline();
    tick();
    renderFocusBar();
    renderModes();
    renderLegend();
    void loadShapes();
    try {
      await loadRegion(S.focus === "region" ? null : S.focus);
      if (S.focus !== "region") deep.add(S.focus);
    } catch (e) {
      console.error(e);
      $("md-lead").innerHTML = '<div class="md-loading">The reports did not load. They will try again in a minute.</div>';
    }
    if (stopped) return;
    await go(S.focus, true);
    // The replay strip's history: every pin since the Yemen war began (both desks).
    getJson("/api/region?pins=2026-07-13")
      .then((j) => {
        addPins((j.pins || []).map((p: any[]) => ({ at: p[0], cat: p[1], la: p[2], ln: p[3], where: p[4] })));
        if (!stopped) setEnd(S.end);
        if (!stopped && S.focus === "region") drawPins();
      })
      .catch((e) => console.error(e));
    // New reports every minute while the page is in view.
    timers.push(
      setInterval(async () => {
        if (document.hidden) return;
        try {
          const added = await loadRegion(S.focus === "region" ? null : S.focus, undefined, 60);
          if (added) {
            renderFocusBar();
            renderChips();
            renderKey();
            if (!S.end) {
              renderLead();
              renderFeed();
              drawPins();
              drawDots();
            }
          }
        } catch {
          /* the next minute tries again */
        }
      }, 60_000),
    );
    timers.push(setInterval(() => (tick(), renderDateline()), 30_000));
    setTimeout(() => store.set("last", now()), 4000);
    // The site's Day and Night switch: new tiles and colours with no reload.
    observer = new MutationObserver(() => {
      const old = tiles;
      tiles = L.tileLayer(tileUrl(), { maxZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap" }).addTo(map);
      tiles.once("load", () => map.removeLayer(old));
      tiles.bringToBack();
      shade();
      applyLens();
      drawMini();
      drawTrack();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    onResize = () => drawTrack();
    window.addEventListener("resize", onResize);
  }
  void boot();

  const stop = () => {
    stopped = true;
    stopPlay();
    timers.forEach(clearInterval);
    timers = [];
    observer?.disconnect();
    if (onResize) window.removeEventListener("resize", onResize);
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", onChange);
    document.removeEventListener("keydown", onKey);
    cleanups.forEach((f) => f());
    try {
      map?.remove();
    } catch {
      /* already gone */
    }
  };
  return {
    stop,
    // The router moved to a place's address (or back): fly there.
    focus: (id) => {
      if (stopped || id === S.focus) return;
      if (!map) S.focus = id; // still starting: it opens there
      else void go(id);
    },
  };
}

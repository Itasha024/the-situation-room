/**
 * The main desk's places (option C). The site is one desk: one map and one
 * wire for the whole region. A reader focuses on a country or a sea, and the
 * wars keep their own desks. A report can belong to several places and
 * several desks; it is one card wherever it shows.
 *
 * Shared by the server (tagging, /api/region) and the page. Never import
 * server-only modules here.
 */
export type FocusId =
  | "yemen"
  | "saudi"
  | "redsea"
  | "iran"
  | "hormuz"
  | "israel"
  | "gaza"
  | "judea-samaria"
  | "lebanon"
  | "iraq"
  | "syria"
  | "gulf"
  | "us";

export type Bounds = [[number, number], [number, number]];

export type Focus = {
  id: FocusId;
  /** The page's address: thesituationroom.live/<slug>. */
  slug: string;
  name: string;
  kind: "country" | "sea" | "actor";
  /** South-west and north-east corners the map flies to. */
  bounds: Bounds;
  /** The desks (wars) this place is part of. */
  desks: WarDeskId[];
  /** One line for readers who land here from a search. */
  context: string;
  /** Flag stripes top to bottom; a sea draws waves instead. */
  flag?: string[];
  /** A map mode that answers this place's main question. */
  lens?: "shipping";
  /** The capital's clock. */
  tz?: string;
  clock?: string;
  /** Not in the bar (yet): tagged, but no page of its own. */
  hidden?: boolean;
};

/** The desks, one per war. Gaza and Judea and Samaria is planned (user, 16 Oct). */
export type WarDeskId = "yemen" | "iran" | "gaza";

export type WarDesk = {
  id: WarDeskId;
  name: string;
  short: string;
  path: string;
  /** Day one of the war; "day N" counts from here (Asia/Aden midnight). */
  start?: string;
  bounds: Bounds;
  places: FocusId[];
  context: string;
  planned?: boolean;
};

export const REGION_BOUNDS: Bounds = [[12, 33], [38.5, 61]];

export const FOCI: Focus[] = [
  { id: "yemen", slug: "yemen", name: "Yemen", kind: "country", bounds: [[12.1, 41.6], [19.2, 53.4]], desks: ["yemen"], flag: ["#ce1126", "#ffffff", "#000000"], tz: "Asia/Aden", clock: "Sanaa",
    context: "Houthi forces against Yemen's government and the Saudi-led coalition. The war began on 13 July 2026 with the strike on Sanaa airport." },
  { id: "saudi", slug: "saudi-arabia", name: "Saudi Arabia", kind: "country", bounds: [[16.2, 34.5], [32.2, 55.8]], desks: ["yemen", "iran"], flag: ["#006c35"], tz: "Asia/Riyadh", clock: "Riyadh",
    context: "The coalition's lead state and the Houthis' main target on land, exposed to Iran across the Gulf." },
  { id: "redsea", slug: "red-sea", name: "Red Sea", kind: "sea", bounds: [[11.2, 32.2], [28.5, 46]], desks: ["yemen"], lens: "shipping",
    context: "The Red Sea, Bab al-Mandab and the Gulf of Aden: the shipping lane between Suez and the Indian Ocean." },
  { id: "iran", slug: "iran", name: "Iran", kind: "country", bounds: [[24.6, 43.5], [39.8, 63.4]], desks: ["iran"], flag: ["#239f40", "#ffffff", "#da0000"], tz: "Asia/Tehran", clock: "Tehran",
    context: "At war with Israel and the United States since 28 February 2026; its allies fight on several fronts." },
  { id: "hormuz", slug: "hormuz", name: "Hormuz", kind: "sea", bounds: [[23.6, 53.6], [27.6, 59.6]], desks: ["iran"], lens: "shipping",
    context: "The Strait of Hormuz and the Gulf of Oman, where about a fifth of the world's oil passes." },
  { id: "israel", slug: "israel", name: "Israel", kind: "country", bounds: [[29.4, 33.6], [33.5, 36.2]], desks: ["iran", "gaza"], flag: ["#ffffff", "#0038b8", "#ffffff"], tz: "Asia/Jerusalem", clock: "Jerusalem",
    context: "Israel's wars beyond its borders: Iran, Lebanon, Gaza, and attacks on Israel." },
  { id: "gaza", slug: "gaza", name: "Gaza", kind: "country", bounds: [[31.2, 34.15], [31.65, 34.6]], desks: ["gaza"], hidden: true,
    context: "The Gaza Strip." },
  { id: "judea-samaria", slug: "judea-and-samaria", name: "Judea and Samaria", kind: "country", bounds: [[31.3, 34.85], [32.6, 35.6]], desks: ["gaza"], hidden: true,
    context: "Judea and Samaria." },
  { id: "lebanon", slug: "lebanon", name: "Lebanon", kind: "country", bounds: [[32.9, 34.9], [34.75, 36.75]], desks: ["iran"], flag: ["#ed1c24", "#ffffff", "#ed1c24"], tz: "Asia/Beirut", clock: "Beirut",
    context: "Hezbollah and Israel across the southern border, and Beirut's diplomacy between Iran and the West." },
  { id: "iraq", slug: "iraq", name: "Iraq", kind: "country", bounds: [[29, 38.7], [37.4, 48.7]], desks: ["iran"], flag: ["#ce1126", "#ffffff", "#000000"], tz: "Asia/Baghdad", clock: "Baghdad",
    context: "Iran-aligned militias, US forces and the Iraqi state: a launch ground and a banking channel." },
  { id: "syria", slug: "syria", name: "Syria", kind: "country", bounds: [[32.3, 35.6], [37.3, 42.4]], desks: ["iran"], flag: ["#007a3d", "#ffffff", "#000000"], hidden: true,
    context: "Syria." },
  { id: "gulf", slug: "gulf-states", name: "Gulf states", kind: "country", bounds: [[22.5, 47.5], [30.2, 57]], desks: ["iran", "yemen"], flag: ["#8d1b3d", "#ffffff"], tz: "Asia/Qatar", clock: "Doha",
    context: "The UAE, Qatar, Bahrain, Kuwait and Oman: bases, ports, mediation and missile defence." },
  { id: "us", slug: "united-states", name: "United States", kind: "actor", bounds: REGION_BOUNDS, desks: ["iran", "yemen"], flag: ["#b22234", "#ffffff", "#3c3b6e"], tz: "America/New_York", clock: "Washington",
    context: "What the United States itself does and says about the region: strikes, sanctions, talks." },
];

export const WAR_DESKS: WarDesk[] = [
  { id: "yemen", name: "Yemen desk", short: "Yemen war", path: "/yemen-conflict-desk", start: "2026-07-13", bounds: [[12, 36], [30, 56]],
    places: ["yemen", "saudi", "redsea", "gulf", "us"],
    context: "Houthi forces against Yemen's government and the Saudi-led coalition, on land, at sea and across the Saudi border. Since 13 July 2026." },
  { id: "iran", name: "Iran desk", short: "Iran war", path: "/iran-conflict-desk", start: "2026-02-28", bounds: [[22, 32.5], [40, 63.5]],
    places: ["iran", "israel", "lebanon", "iraq", "syria", "hormuz", "gulf", "saudi", "us"],
    context: "Iran against Israel and the United States, with fronts in Lebanon, Iraq, the Gulf and the Strait of Hormuz. Since 28 February 2026." },
  { id: "gaza", name: "Gaza and Judea and Samaria desk", short: "Gaza and Judea and Samaria", path: "/gaza-judea-samaria-desk", bounds: [[31.1, 34.1], [32.7, 35.7]],
    places: ["gaza", "judea-samaria", "israel"], planned: true,
    context: "Gaza and Judea and Samaria: a desk of its own, with the social media watched as well as the press. Being built." },
];

export const focusById = (id: string): Focus | undefined => FOCI.find((f) => f.id === id);
export const focusBySlug = (slug: string): Focus | undefined => FOCI.find((f) => f.slug === slug);
export const warDeskById = (id: string): WarDesk | undefined => WAR_DESKS.find((d) => d.id === id);

/** What a report is, by the desk's own event types. */
export type Category = "strike" | "combat" | "shipping" | "diplomacy" | "statement" | "economy" | "other";

export const CATEGORIES: { id: Category; name: string; color: string }[] = [
  { id: "strike", name: "Strikes", color: "#e2694f" },
  { id: "combat", name: "Fighting", color: "#e3b64d" },
  { id: "shipping", name: "Shipping", color: "#5fa8dc" },
  { id: "diplomacy", name: "Diplomacy", color: "#9b7fd1" },
  { id: "statement", name: "Statements", color: "#a99d93" },
  { id: "economy", name: "Economy", color: "#3fb0b3" },
];

export function categoryOf(type: unknown): Category {
  const t = String(type ?? "").toLowerCase();
  if (t === "strike" || t === "alert" || t === "intercept") return "strike";
  if (t === "combat" || t === "clash") return "combat";
  if (t === "vessel" || t === "port" || t === "maritime") return "shipping";
  if (t === "diplomacy") return "diplomacy";
  if (t === "statement") return "statement";
  if (t === "economy") return "economy";
  return "other";
}

/** "Day N" of a war on a given instant, counted in Yemen time like the desks. */
export function warDay(desk: WarDesk, at: number): number | null {
  if (!desk.start) return null;
  const start = Date.parse(`${desk.start}T00:00:00+03:00`);
  return Math.floor((at - start) / 86_400_000) + 1;
}

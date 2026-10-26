/**
 * The site's desks (Round 30). Each has its own page, clock and update rhythm;
 * public/app.js keeps the same list (DESKS) for the headline menu and the side
 * menu. Yemen's numbers here are the ones it has always run on.
 */
export type DeskId = "yemen" | "iran" | "gaza";

export type Desk = {
  id: DeskId;
  name: string;
  path: string;
  /** The flag's stripes, top to bottom, for the menus' strips and the bar by the name. */
  flag: string[];
  /** The clock in the top line. */
  tz: string;
  clockLabel: string;
  /** Hours between the overview, the numbers and the brief. */
  cadenceHours: number;
  /** The first day on the map. */
  mapFrom: string;
  /** Latest reports start here (ISO); no card older is served on this desk. */
  feedFrom?: string;
  description: string;
  /** Built but not yet shown: out of the menus, the home page and the All map; its page opens by its address. */
  hidden?: boolean;
};

export const DESKS: Desk[] = [
  {
    id: "yemen",
    name: "Yemen Conflict Desk",
    path: "/yemen-conflict-desk",
    flag: ["#ce1126", "#ffffff", "#000000"],
    tz: "Asia/Aden",
    clockLabel: "Yemen",
    cadenceHours: 6,
    mapFrom: "2026-07-13",
    description:
      "Live open-source reporting on the war in Yemen: who holds what, the fronts, strikes on Saudi Arabia, the Red Sea and the numbers, from every side's sources.",
  },
  {
    id: "iran",
    name: "Iran Conflict Desk",
    path: "/iran-conflict-desk",
    flag: ["#239f40", "#ffffff", "#da0000"],
    tz: "Asia/Tehran",
    clockLabel: "Iran",
    cadenceHours: 3,
    mapFrom: "2026-02-28",
    // The user, 8 Oct: the feed cannot reach back to February, so it starts
    // the day the desk began reading (00:00 Israel time).
    feedFrom: "2026-10-08T00:00:00+03:00",
    description:
      "Live open-source reporting on the war with Iran: strikes on every side, the Strait of Hormuz, the talks, the nuclear file and the numbers, from every side's sources.",
  },
  {
    // User, 23 Oct: the third desk; live from 26 Oct. Its map and numbers count from the ceasefire of 10 Oct 2025 (user, 26 Oct:
    // researched before the desk began reading on 23 Oct 2026, scripts/gaza-research).
    id: "gaza",
    name: "Gaza – Judea & Samaria Desk",
    path: "/gaza-judea-samaria-desk",
    flag: ["#0038b8", "#ffffff", "#0038b8"],
    tz: "Asia/Jerusalem",
    clockLabel: "Jerusalem",
    cadenceHours: 3,
    mapFrom: "2025-10-10",
    feedFrom: "2026-10-23T00:00:00+03:00",
    description:
      "Live open-source reporting on Gaza and Judea and Samaria: the IDF's operations, attacks and clashes, aid and the crossings, the Board of Peace, Palestinian politics, statements and sanctions, from every side's sources.",
  },
];

export const deskById = (id: DeskId): Desk => DESKS.find((d) => d.id === id) ?? DESKS[0];

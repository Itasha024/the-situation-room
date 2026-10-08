/**
 * The site's desks (Round 30). Each has its own page, clock and update rhythm;
 * public/app.js keeps the same list (DESKS) for the headline menu and the side
 * menu. Yemen's numbers here are the ones it has always run on.
 */
export type DeskId = "yemen" | "iran";

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
];

export const deskById = (id: DeskId): Desk => DESKS.find((d) => d.id === id) ?? DESKS[0];

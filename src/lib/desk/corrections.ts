/**
 * The desk's public corrections: every card removed, every figure moved and
 * every mark redrawn, with the day and the reason. Shown on the Methodology
 * page (#corrections). A script that removes or corrects published work adds
 * its line here in the same change.
 */
export type Correction = { date: string; what: string; why: string };

export const CORRECTIONS: Correction[] = [
  {
    date: "2026-10-01",
    what: "Numbers: the figures of Fares al-Hemyari, a journalist, moved from Official to the government-side column. The WHO's totals (838 killed, 3,643 wounded) now link to the WHO-led Health Cluster's own report on ReliefWeb instead of a news site. Almashhad's count of Houthi death notices moved from the Houthi column to the government side, and its count of 29 September (568, from 13 July) replaced the one of 24 September (693, from 1 July).",
    why: "Official means official bodies only; a journalist's or an outlet's count is unofficial and goes under the side it speaks for. Almashhad is a government-side outlet, and its newer count starts with the war.",
  },
  {
    date: "2026-10-01",
    what: "The start of this round moved from 3 July to 13 July everywhere: the map's range, the numbers and the text. Four pins from before 13 July left the \"Whole conflict\" map.",
    why: "The round began with the strike on Sanaa airport on 13 July.",
  },
  {
    date: "2026-09-30",
    what: "Energy attacks: the rows for Yanbu (30 Sep) and Abqaiq (30 Sep) were removed. The attack on the East-West pipeline is dated 11 September, not 10 September. A reported hit on Hodeidah port on 24 July is left out.",
    why: "The two rows were satellite pictures of older damage and of smoke, not new attacks. The Saudi Energy Ministry's post and Reuters date the pipeline attack to 11 September. The coalition says Hodeidah port was not hit that day.",
  },
  {
    date: "2026-09-30",
    what: "Six statement cards that came from relays (the Egyptian foreign ministry, Pakistan's defence minister, the UN envoy Hans Grundberg, the EU's Aspides mission, the British government) were traced again and linked to the original where it was found.",
    why: "A statement is published from the body that made it, not from the outlet that passed it on.",
  },
  {
    date: "2026-09-30",
    what: "Four \"ground taken\" flags in Taiz and Lahj (Jabal Qarfan, Al-Aghbara, Jabal al-Bazilah, Al-Mansurah) were redrawn as advances. Al-Bazilah and Al-Mansurah moved to their real places, a second flag for Jabal Qarfan was removed, and 23 pins moved in all.",
    why: "Each capture was claimed by one side only, and a flag needs two sides, a wire or the losing side admitting it. Two places had been matched to the article's dateline or to a namesake on the coast.",
  },
  {
    date: "2026-09-30",
    what: "A \"shelling\" mark near Riyadh was removed.",
    why: "It was Houthi shelling of Jabal Jarad in Taiz, matched to a Saudi hill with the same name. A place outside Yemen is now used only when the text names Saudi Arabia or a Saudi place.",
  },
  {
    date: "2026-09-30",
    what: "Two cards were removed: an Axios report on the US–Iran war (30 Sep, 01:38), and a card on Egyptian sailors held off Somalia (30 Sep, 08:37), with a second card on the same story.",
    why: "Out of scope: the US–Iran war counts only where it touches Yemen or the Houthis, and the tanker was seized in May by unidentified gunmen off Somalia, which is piracy, not this war.",
  },
];

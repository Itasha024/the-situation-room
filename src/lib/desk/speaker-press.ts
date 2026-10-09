/**
 * Which account leads a card, on every desk (user, 8 Oct): a report about a
 * country is taken from that country's own sources, the most official and
 * credible first — the government's own account, then its state agency, then
 * its big outlets; then the global wires; a third country's relay after them,
 * and an aggregator last. (Trump's words on the midterms were led by Al
 * Jazeera Mubasher while CNN and Bloomberg sat in "Also".)
 */
export type Nation =
  | "us"
  | "iran"
  | "israel"
  | "saudi"
  | "uae"
  | "qatar"
  | "oman"
  | "iraq"
  | "lebanon"
  | "yemen"
  | "russia"
  | "uk";

/** Each country's words in a headline: its name, people, places, bodies. */
const NATION_WORDS: [Nation, RegExp][] = [
  ["us", /\b(?:US|U\.S\.|USA|American|Americans|Washington|Trump|Vance|Rubio|Hegseth|Witkoff|Leavitt|Bessent|Waltz|Kushner|White House|Pentagon|State Department|Treasury|CENTCOM|Central Command)\b/],
  ["iran", /\b(?:Iran|Iranian|Iranians|Tehran|IRGC|Revolutionary Guards?|Basij|Khamenei|Pezeshkian|Araghchi|Baghaei|Ghalibaf|Larijani|Vahidi|Hatami|Mohajerani|Gharibabadi|Velayati|Jalili|Eslami|Isfahan|Bandar Abbas|Bushehr|Natanz|Fordow|Mashhad|Tabriz|Shiraz|Kharg|Sistan|Baluchestan|Khuzestan)\b/i],
  ["israel", /\b(?:Israel|Israeli|Israelis|Hebrew|IDF|Netanyahu|Katz|Saar|Zamir|Mossad|Tel Aviv|Jerusalem|Haifa|Eilat|Dimona)\b/i],
  ["saudi", /\b(?:Saudi|Saudis|Riyadh|Jeddah|Aramco|Najran|Jizan|Jazan|Khamis Mushait|Abha)\b/i],
  ["uae", /\b(?:UAE|Emirati|Emirates|Abu Dhabi|Dubai|Fujairah|Ras al-Khaimah)\b/i],
  ["qatar", /\b(?:Qatar|Qatari|Doha|Ras Laffan)\b/i],
  ["oman", /\b(?:Oman|Omani|Muscat|Duqm|Salalah)\b/i],
  ["iraq", /\b(?:Iraq|Iraqi|Baghdad|Erbil|Basra|Kataib Hezbollah|Nujaba|PMF|Popular Mobilisation)\b/i],
  ["lebanon", /\b(?:Lebanon|Lebanese|Beirut|Hezbollah|Qassem)\b/i],
  ["yemen", /\b(?:Yemen|Yemeni|Yemenis|Houthi|Houthis|Ansar Allah|Sanaa|Aden|Hodeidah|Marib|Saree|Abdulsalam|Zouba)\b/i],
  ["russia", /\b(?:Russia|Russian|Kremlin|Moscow|Putin|Peskov|Lavrov|Zakharova)\b/i],
  ["uk", /\b(?:UK|U\.K\.|Britain|British|London|Starmer|RAF|UKMTO)\b/],
];

/** The country a headline is about: the first one it names (the speaker, when it opens with one). */
export function subjectNation(headline: string): Nation | null {
  const h = String(headline || "");
  let best: Nation | null = null;
  let at = Infinity;
  for (const [n, re] of NATION_WORDS) {
    const m = re.exec(h);
    if (m && m.index < at) {
      at = m.index;
      best = n;
    }
  }
  return best;
}

/** Does the text name this country (its name, people, places, bodies)? */
export function namesNation(nation: Nation, text: string): boolean {
  const re = NATION_WORDS.find(([n]) => n === nation)?.[1];
  return !!re && re.test(String(text || ""));
}

/** The country an outlet or account belongs to: its government, state agency or own press. */
export function sourceNation(source: string, lean = ""): Nation | null {
  const s = String(source || "").trim();
  if (FOREIGN_SERVICE.test(s)) return null;
  return find(OFFICIAL, s) ?? find(AGENCY, s) ?? find(OUTLET_NATION, s) ?? leanNation(lean, "");
}

/** A wire every desk trusts for any country's story. */
export function isWireSource(source: string): boolean {
  return WIRE.test(String(source || "").trim());
}

/** A country's own official voices: its government's accounts and bodies. */
const OFFICIAL: [Nation, RegExp][] = [
  ["us", /^(?:CENTCOM|Truth Social|Donald J\. Trump|White House|US Embassy|US Mission|State Department|Department of|US Treasury|Pentagon|US Navy|NAVCENT|Rapid Response 47)/i],
  ["iran", /^(?:Khamenei's office|Abbas Araghchi|Masoud Pezeshkian|Iran Foreign Ministry|Iran's Supreme National Security|IRGC|Atomic Energy Organization of Iran|Fatemeh Mohajerani|Esmaeil Baghaei|Mohammad Bagher Ghalibaf|Ahmad Vahidi|Amir Hatami|Persian Gulf Strait Authority|Mizan|Iran's ambassador|Kazem Gharibabadi)/i],
  ["israel", /^(?:IDF|Israel Defense Forces|Israeli Prime Minister|Prime Minister of Israel|Israel MFA|Israel Ministry|Ella Waweya|Avichay Adraee)/i],
  ["saudi", /^(?:Saudi Ministry|Saudi Defense Ministry|Turki al-Maliki)/i],
  ["yemen", /^(?:Yahya Saree|Mohammed Abdulsalam)$/i],
  ["uk", /^(?:UKMTO|UK Ministry of Defence|UK MOD)$/i],
  ["lebanon", /^(?:Lebanese Army|Lebanese presidency|Lebanon's prime minister's office|Lebanon Foreign Ministry|Youssef Raggi)/i],
];
/** A country's state news agencies and broadcasters. */
const AGENCY: [Nation, RegExp][] = [
  ["iran", /^(?:IRNA|Tasnim|Fars|ISNA|Mehr|IRIB|Press TV|Nour News|Tehran Times|Al-Alam|ILNA|IMNA|SNN)\b/i],
  ["saudi", /^(?:SPA)$/i],
  ["uae", /^(?:WAM)$/i],
  ["qatar", /^(?:QNA)$/i],
  ["oman", /^(?:ONA|Oman News Agency)$/i],
  ["iraq", /^(?:INA|Iraqi News Agency)$/i],
  ["yemen", /^(?:Saba|Saba \(Houthi-run\)|Saba \(government\)|Al-?Masirah)$/i],
  ["us", /^(?:AP)$/i],
  ["russia", /^(?:TASS|RIA Novosti)$/i],
];
/** Outlets by country, beyond what the desks' groups say. */
const OUTLET_NATION: [Nation, RegExp][] = [
  ["us", /^(?:CNN|CBS|ABC|NBC News|Fox News|WSJ|NYT|Washington Post|NY Post|Axios|Politico|Bloomberg(?:\.com)?|Barak Ravid|Jennifer Jacobs|The Hill|Semafor|Punchbowl)$/i],
  ["israel", /^(?:N12|Kan|Kan \(Arab affairs\)|Channel 1[34]|i24 News|Walla|Ynet|Haaretz|Israel Hayom|Jerusalem Post|Times of Israel|Amit Segal|Israel 1|Hazfon 1)$/i],
  ["saudi", /^(?:Al Arabiya|Al Hadath|Asharq Al-Awsat|Asharq News|Arab News|Okaz|Saudi Gazette)$/i],
  ["uae", /^(?:Sky News Arabia|The National|Erem News)$/i],
  ["qatar", /^(?:Al Jazeera|Al Jazeera Mubasher|Al-Araby TV|Al-Araby Al-Jadeed|The New Arab)$/i],
  ["lebanon", /^(?:Al Mayadeen|Al-Akhbar|Al-Manar|L'Orient|Unews|NNA|National News Agency|LBCI|MTV Lebanon|Lebanon 24)/i],
  ["uk", /^(?:BBC|The Telegraph|The Guardian|Financial Times|Sky News)$/i],
];
/** Wires every desk trusts for any country's story. */
const WIRE = /^(?:Reuters|AP|AFP)$/i;
/** Fast aggregators, never a primary source (user, 3 Oct). */
const AGGREGATOR = /^(?:Axis military relay|Clash Report|OSINTdefender|OSINT Hexagone|Megatron|Visegrad24)$/i;
/** A government's services in other languages relay their own country's press. */
const FOREIGN_SERVICE = /^(?:VOA Farsi|Radio Farda|Alhurra|BBC Persian|Iran International|Press TV Hebrew)$/i;

const find = (list: [Nation, RegExp][], s: string) => list.find(([, re]) => re.test(s))?.[0] ?? null;

/**
 * How near `source` stands to a report about `nation`: its own government's
 * voice 13, its state agency 12, its outlet 11; a wire 5; anything else 1; an
 * aggregator 0. `lean` is the desk's group for the outlet ("us", "israel" …),
 * used when the lists above do not name it.
 */
export function nearness(source: string, nation: Nation | null, lean = "", side = ""): number {
  const s = String(source || "").trim();
  if (AGGREGATOR.test(s)) return 0;
  if (nation) {
    if (find(OFFICIAL, s) === nation) return 13;
    if (find(AGENCY, s) === nation) return 12;
    if (!FOREIGN_SERVICE.test(s)) {
      const own = find(OUTLET_NATION, s) ?? leanNation(lean, side);
      if (own === nation) return 11;
    }
    // Iran's diaspora press: Iranian, though not from inside; after the wires.
    if (nation === "iran" && lean === "opposition") return 4;
  }
  if (WIRE.test(s)) return 5;
  return 1;
}

/** A country from the desks' groups: the Iran desk's lean, the Yemen desk's side. */
function leanNation(lean: string, side: string): Nation | null {
  if (lean === "us" || lean === "israel") return lean;
  if (lean === "axis") return "iran";
  if (side === "yemen") return "yemen";
  return null;
}

/** Does the newcomer stand nearer the report's country than the card's lead? */
export function nearerSource(
  headline: string,
  r: { source: string; lean?: string; side?: string },
  home: { source: string; lean?: string; side?: string },
): boolean {
  const n = subjectNation(headline);
  return nearness(r.source, n, r.lean, r.side) > nearness(home.source, n, home.lean, home.side);
}

/** Who speaks in a headline: the words before its colon, or before "says". */
function speakerOf(headline: string): string {
  const h = String(headline || "").trim();
  return /^([^:"“]{2,70}):\s/.exec(h)?.[1] ?? /^([^:,"“]{2,70}?)\s+(?:says|say|said|tells|told)\b/.exec(h)?.[1] ?? TELLER.exec(h)?.[1] ?? "";
}
/**
 * A body or person that speaks by another verb (9 Oct: Tasnim's "US Embassy
 * in Israel warns Americans", Al-Alam's "IDF confirms major killed", Press
 * TV's "US Democratic lawmaker asks Congress"). Only a teller: an army,
 * embassy, ministry, spokesperson or lawmaker, never "Israeli shelling".
 */
const TELLER =
  /^((?:the )?(?:US|U\.S\.|American|Israeli|Israel's|British|UK)?\s?(?:Embassy|Mission|State Department|Treasury|Pentagon|Defense Department|CENTCOM|Central Command|Navy|military|army|IDF|Israel Defense Forces|Rep\.|Senator|Sen\.|Congressman|Congresswoman|lawmaker|Democratic lawmaker|Republican lawmaker|official|officials|spokes(?:man|person|woman)|minister|ministry|UKMTO|UK Maritime Trade Operations)\b[^:,"“]{0,50}?)\s+(?:warns|warned|urges|urged|asks|asked|calls|called|confirms|confirmed|announces|announced|denies|denied|claims|claimed|says|said|vows|threatens|demands|reports|reported)\b/i;

/**
 * One side's outlet carrying the other side's voice (user, 8 Oct: "Israeli
 * army says" went out from Al-Alam; the IDF, else Israeli media, tells it).
 * Iran's and its allies' outlets on what Israel or the US said, and Israeli
 * outlets on what Iran or the US said, are relays: the desk reads that side
 * directly. What the outlet reports itself is not a relay (`own`).
 */
export function rivalRelay(headline: string, source: string, lean = "", own = false): string | null {
  const s = String(source || "").trim();
  if (own || find(OFFICIAL, s) || WIRE.test(s) || AGGREGATOR.test(s)) return null;
  const speaker = speakerOf(headline);
  const who = subjectNation(speaker);
  if (!who) return null;
  const mine = sourceNation(s, lean);
  // A country's media retold by another country's outlet ("Israeli Channel 12: …" from Iran International, 9 Oct).
  if (MEDIA_SPEAKER.test(speaker) && mine !== who) return `relay: ${NAME[who]}'s media are read directly, not ${s}'s retelling`;
  // Israel's words from Israel's own sources only, whoever retells them (user, 9 Oct: "for the 100th time").
  if (who === "israel" && mine !== "israel") return `relay: Israel is told from its own sources (the IDF, Israeli officials, Israeli media), not ${s}`;
  // Iran's opposition outlets too (user, 9 Oct): Iran International and VOA Farsi
  // retelling Bessent and UKMTO while America's press and UKMTO's own post had them.
  const axis = lean === "axis" || lean === "opposition" || find(AGENCY, s) === "iran";
  const israeli = lean === "israel" || find(OUTLET_NATION, s) === "israel";
  // Britain's too: UKMTO's word on the Gulf's ships was Fars' card (9 Oct).
  if (axis && (who === "israel" || who === "us" || who === "uk")) return `relay: ${who === "us" ? "the US" : who === "uk" ? "Britain" : "Israel"} is told from its own sources, not ${s}'s relay`;
  if (israeli && (who === "iran" || who === "us")) return `relay: ${who === "us" ? "the US" : "Iran"} is told from its own sources, not ${s}'s relay`;
  return null;
}

/** A government's own voice, by the account's name: Truth Social, the IDF, Iran's foreign ministry. */
export function officialVoice(source: string): Nation | null {
  return find(OFFICIAL, String(source || "").trim());
}

/** A speaker that is an outlet: "Israeli Channel 12", "Hebrew media", "Iranian state TV". */
const MEDIA_SPEAKER = /(?:media|channel|newspaper|daily|TV|television|radio|outlet|press|broadcaster|Channel d+|Kan|Ynet|Haaretz|Maariv|Walla)/i;
const NAME: Record<Nation, string> = { us: "the US", iran: "Iran", israel: "Israel", saudi: "Saudi Arabia", uae: "the UAE", qatar: "Qatar", oman: "Oman", iraq: "Iraq", lebanon: "Lebanon", yemen: "Yemen", russia: "Russia", uk: "Britain" };

/** Where in Lebanon a strike lands. */
const LEBANON_PLACE = /\b(?:Lebanon|Lebanese|Beirut|Dahiyeh|Dahieh|Bint Jbeil|Tyre|Sidon|Nabatieh|Nabatiyeh|Marjayoun|Bekaa|Baalbek|Hermel|Khiam|Naqoura|Litani)\b/i;

/**
 * Israel's attacks in Lebanon are told by Lebanon's own sources (user, 8 Oct:
 * "Israeli shelling targets Baraashit" went out from Al-Alam, Iran's channel).
 * The IDF's own word on its own strike stays: that is Israel's side, told by
 * Israel. Any other country's outlet only relays what Lebanon reports.
 */
export function attackTeller(headline: string, source: string, actor: string, combat: boolean, lean = ""): string | null {
  if (!combat || actor !== "israel") return null;
  const s = String(source || "").trim();
  // Anywhere else (Gaza, Syria, Iraq): never from Iran's outlets (user, 9 Oct).
  if (!LEBANON_PLACE.test(String(headline || ""))) {
    const iranian = !find(OFFICIAL, s) && (sourceNation(s, lean) === "iran" || lean === "opposition");
    return iranian ? `relay: Israel's attacks are told by the place's own sources, Israel's or a wire, not ${s}` : null;
  }
  const n = find(OFFICIAL, s) ?? find(AGENCY, s) ?? find(OUTLET_NATION, s);
  if (n === "lebanon" || find(OFFICIAL, s) === "israel") return null;
  return `relay: Israel's attacks in Lebanon are told by Lebanon's own sources, not ${s}`;
}

# Yemen desk — OSINT source pool (operator list only)

The previous 288-endpoint catalog is **parked**. The desk now scans **only** the Telegram channels and websites the operator named.

**No Israeli sources.** Every named source on a card must have a real article/post URL.

**X / Twitter: read through FxTwitter.** An account's latest 20 public posts come from FxTwitter's open API (`api.fxtwitter.com/2/profile/<handle>/statuses`), every 5 minutes, with no login and no key. Reposts and replies to other accounts are left out; an account's own threads are kept. Each post then goes through the same gate and reader as a Telegram post; the reader is told it is an open-source analyst, whose own findings (a frontline mapped from satellite imagery, footage geolocated) are reports and whose questions and teasers are not. Tried on 24 September and not usable: x.com itself (login), the Nitter mirrors (down or behind bot checks, which the desk does not bypass), xcancel (451) and Twitter's syndication endpoint (429). `/api/status` shows each account's last read.

| X account | How often |
|---|---|
| The Cube — `@war_cube` | every 5 minutes |
| Spokesmen, ministries and front reporters (`@Yah_Saree`, `@abdusalamsalah`, `@spokespersonyem`, `@Yem_army_media`, `@YemenMOD`, `@CJFCSpox`, `@modgovksa`, `@KSAMOFA`, `@maldhabyani`, `@BashaReport`, `@SaudiNews50`, `@2decnews`, `@South24_net`, `@yementvyem`) | every 10 minutes |
| Sky News Arabia breaking — `@SkyNewsArabia_B`: **only posts where sources spoke to Sky News Arabia itself** ("مصادر لسكاي نيوز عربية", "لـ«سكاي نيوز عربية»", "خاص", "told Sky News Arabia"); the rest (other agencies' news) is dropped before the reader | every 10 minutes |
| Leaders, parties and the slower channels (`@PresidentRashad`, `@ERYANIM`, `@AbuZar3a`, `@tarikyemen`, `@AidrosAlzubidi`, `@Moh_Alhouthi`, `@hezamalasad` and others), plus journalist Fares al-Hemyari (`@FaresALhemyari`) | every 30 minutes |
| Yemen's Ministry of Human Rights — `@mohr_yemen` (government side; its casualty statements count as official). Added 1 Oct | every 15 minutes |
| **Governments, agencies and international bodies** (added 30 Sep). Only posts about this war pass: Yemen, the Houthis, the Saudi–Houthi war, the Red Sea, Bab al-Mandab, or Saudi energy under attack; their other diplomacy is dropped. Each is also where a relay of that body's words is looked up first. | |
| Gulf agencies and the US and UN in Yemen: SPA (`@spagov`), WAM (`@wamnews`), US State Department (`@StateDept`), UN in Yemen (`@UNinYE`) | every 10 minutes |
| Saudi Civil Defence (`@SaudiDCD`): only its posts on attacks, sirens and debris | every 10 minutes |
| Saudi Interior Ministry (`@MOISaudiArabia`): only posts about this war | every 15 minutes |
| Foreign ministries: Egypt (`@MfaEgypt`, `@MFAEgOfficial`), Iran (`@IRIMFA_EN`), Oman (`@FMofOman`), UAE (`@mofauae`), Iraq (`@Iraqimofa`), Kuwait (`@MOFAKuwait`), Bahrain (`@bahdiplomatic`), Qatar (`@MofaQatar_AR`), Jordan (`@ForeignMinistry`), Somalia (`@MOFASomalia`), Pakistan (`@ForeignOfficePk`), Turkey (`@MFATurkiye`, `@TC_Disisleri`) | every 15 minutes |
| United States: Marco Rubio (`@SecRubio`), Energy Department (`@ENERGY`), Treasury (`@USTreasury`), US Embassy Yemen (`@USEmbassyYemen`) | every 15 minutes |
| Suez and the EU and UN: Suez Canal Authority (`@SuezAuthorityEG`), European Commission (`@EU_Commission`), Ursula von der Leyen (`@vonderleyen`), EU in Yemen (`@EUinYemen`), UN OCHA (`@UNOCHA`), António Guterres (`@antonioguterres`), United Nations (`@UN`) | every 15 minutes |
| The sea and energy: UKMTO (`@UK_MTO`, every 5 minutes), Saudi Energy Ministry (`@MoEnergy_Saudi`, every 10 minutes), Kpler, TankerTrackers, MarineTraffic, Vortexa, Javier Blas, OSINT Hexagone, Egypt OSINT (every 15 minutes). Details below, under "The sea and energy" | |
| **Added 7 Oct (the user's 3 Oct list).** Yemen's own: Taiz military axis (`@axistaiz`) and Yemen Coast Guard, Aden (`@d74054`), every 10 minutes; the human rights minister, Mashdal Mohammed Omar (`@mashdal`), and the UK Middle East minister, Stephen Doughty (`@SDoughtyMP`, only this war), every 30 minutes | |
| Washington, only posts about this war: CENTCOM (`@CENTCOM`, 10 min), the White House (`@WhiteHouse`), President Trump (`@POTUS`), White House Rapid Response (`@RapidResponse47`) every 15 minutes; JD Vance (`@JDVance`, `@VP`) and Marco Rubio's own account (`@marcorubio`) every 30 minutes | |
| Reporters, only posts about this war: Barak Ravid (`@BarakRavid`, Axios; his posts carry his Axios stories, as axios.com refuses automated readers) every 15 minutes; Natasha Bertrand (`@NatashaBertrand`, CNN), Trey Yingst (`@TreyYingst`, Fox) and Jennifer Griffin (`@JenGriffinFNC`, Fox) every 30 minutes | |
| Fast aggregators, **never a primary source**: Clash Report (`@clashreport`, 10 min, and its Telegram channel) and OSINTdefender (`@sentdefender`, 15 min). First with a story, their card gives way to the first source of its own, and they move to "Also" | |
| Newspapers and broadcasters, only posts about this war. A post linking the outlet's article opens that article, read whole like the site's own listing: Reuters (10 min); WSJ, NYT, Washington Post, Axios, Bloomberg (`@business`), CNN, Fox News, Arab News, Asharq Al-Awsat (`@aawsat_News`) every 15 minutes; FT (`@ftworldnews`), Intelligence Online, CBS, ABC, NBC News, NY Post, Politico, The Telegraph, France 24 (EN, AR), Asharq Al-Awsat English, The National every 30 minutes; Al-Araby Al-Jadeed (`@alaraby_ar`) every 15 minutes. Paywalled articles give only what they show openly | |
| Added 7 Oct: Alhurra (`@alhurranews`, its war posts open the linked article) and Jennifer Griffin. Not added: The Guardian (left X in Nov 2024), Al-Akhbar English on X (silent since Mar 2026; its website is read, below), The New Arab (its account does not answer); Al-Akhbar and Erem News are already read through their Telegram channels | |

---

## Cadence (Asia/Jerusalem)

| Source | How often |
|---|---|
| Telegram channels | every 5 minutes |
| Al-Akhbar and Erem News channels | every 15 minutes |
| Almashhad (almashhad.news) | every 5 minutes |
| SPA | every 5 minutes |
| Al-Araby Al-Jadeed, Al-Araby TV | every 30 minutes |
| Asharq Al-Awsat | every 30 minutes |
| Erem News, Alhurra, Arab News | every 30 minutes |
| Sheba Intelligence | every hour |
| Reuters, WSJ, Washington Post, NYT, NY Post, Axios, CNN, ABC, CBS, Fox | every 30 minutes |
| Keyword safety nets (Arabic sites, English sites) | every hour |
| Al-Akhbar: the whole English edition, and the Arabic site via Google News | once a day, 07:00 Beirut |

First boot of the process hits **all** sources once, then the clock above.

The client pulls `/api/scan` every 5 minutes. The map/feed are patched in place — **no visual remount** on each scan.

---

## Telegram (exclusive)

- Al-Mihwar — `@Alomhoar`
- Ali Bk — `@Alibk3`
- Sabereen News — `@SabrenNewss`
- Naya — `@naya_foriraq`
- Shin Persian — `@shin_persian`
- Al-Araby TV breaking — `@AlarabyTvBrk`
- Shajab News — `@shajab_news`
- Bin Saeed — `@bin_1saeed`
- Al Jazeera — `@AjaNews`
- Al Hadath — `@alhadath_brk`
- Al Arabiya Breaking — `@alarabiyaBr`
- Saba — `@SabaNewsyeMedia`
- Yahya Saree — `@army21ye`
- Mohammed Abdulsalam — `@abdulsalamsalah`
- Al-Masirah — `@almasirah2`
- Al-Aqsa Breaking — `@alagsa3agel`
- Al-Akhbar — `@Alakhbar_News` (every 15 minutes)
- Erem News — `@eremnews` (every 15 minutes)
- Alfaqaar — `@Alfaqaar313` (Houthi-aligned; films the strikes on Saudi Arabia). Added 7 Oct
- Clash Report — `@clashreport` (every 15 minutes; a fast aggregator, never a primary source). Added 7 Oct

## Websites — read whole

Each site is read through the listing it keeps of **everything** it publishes
— its RSS feed or the news sitemap it gives search engines — not a keyword
search. Every read takes only what the desk has not judged before (the
`site-seen` record), however long since the last read. A model reads the new
headlines (`triage.ts`: free Groq models, then Gemma) and picks those that could
concern this war; each pick is opened and read in full (up to 5,000
characters), and the reader writes the card from the whole article. Headlines no
model got to are judged by keyword for now and asked about again next read.

| Site | Listing read | How often |
|---|---|---|
| Almashhad | `almashhad.news/feed` | 5 min |
| Al-Araby Al-Jadeed | `alaraby.co.uk/rss.xml` (answers a plain client, 403 to a browser) | 30 min |
| Asharq Al-Awsat | Google News, `site:aawsat.com` alone, last hour (Cloudflare 403) | 30 min |
| Erem News | Google News, `site:eremnews.com` alone, 2 h (Cloudflare 403) | 30 min |
| Al-Akhbar | English edition `en.al-akhbar.com`: the front page and the Yemen, Arabian Peninsula, Arab, World and Politics pages, full text (its sitemap has no headlines); the Arabic site, and its PDF edition, through Google News `site:al-akhbar.com` alone, 1 day (Cloudflare 403); its channel every 15 min | front page and Yemen every 30 min; the other pages daily 07:00 |
| Alhurra | `alhurra.com/rss` | 30 min |
| Arab News | `arabnews.com/rss.xml`; Google News `site:` when it answers 403 | 30 min |
| Reuters | `reuters.com/arc/outboundfeeds/news-sitemap` (all sections) | 30 min |
| WSJ | Google News, `site:wsj.com` alone, last hour (the Dow Jones feeds stopped in Jan 2025; the sitemap is 403) | 30 min |
| Washington Post | `feeds.washingtonpost.com/rss/world`, `/national`, `/politics` | 30 min |
| NYT | `nytimes.com/sitemaps/new/news.xml.gz` (every section, 48 h) | 30 min |
| NY Post | `nypost.com/feed/` | 30 min |
| Axios | `api.axios.com/feed/` | 30 min |
| CNN | `edition.cnn.com/sitemap/news.xml` | 30 min |
| ABC | `abcnews.go.com/abcnews/internationalheadlines` | 30 min |
| CBS | `cbsnews.com/latest/rss/world` | 30 min |
| Fox News | `moxie.foxnews.com/google-publisher/world.xml`, `/politics.xml` | 30 min |
| SPA | Google News, `site:spa.gov.sa` alone, Arabic edition, last hour | 5 min |
| Sheba Intelligence | its section pages: news, reports, investigations, politics, daily brief (no feed; its sitemap re-dates old articles) | hourly |
| Yemen Future (يمن فيوتشر), non-governmental | its front page, the newest of every section (no feed) | 10 min |
| France 24 (EN Middle East, AR) | `france24.com/en/middle-east/rss`, `/ar/rss` | 15 min |
| BBC (EN Middle East, BBC Arabic) | `feeds.bbci.co.uk/news/world/middle_east/rss.xml`, `/arabic/rss.xml` | 15 min |
| Al-Monitor, Middle East Eye, The New Arab, The Guardian (Middle East) | their RSS feeds | 15 min |
| Sky News Arabia, Independent Arabia | their RSS feeds | 10 min |
| Asharq Al-Awsat (English), Alhurra (English) | `english.aawsat.com/feed`, `alhurra.com/en/rss` | 10–15 min |
| Financial Times (Middle East), Bloomberg (politics), Politico (defense), NBC News (world) | their RSS feeds; paywalled pages give only what they publish openly | 30 min |
| AP, Intelligence Online, The Telegraph | Google News `site:` alone: AP and Intelligence Online refuse readers (Cloudflare), the Telegraph answers a paywall | 15 min–hourly |
| CENTCOM, Pentagon, White House | their own release feeds | 10–15 min |
| State Department | Google News `site:state.gov` (its feed refuses readers) | 15 min |
| Clearwater Dynamics (maritime alerts, non-aligned) | its public alerts page | 10 min |
| Crater Sky, Al-Ayyam (Aden) | their front pages | 10 min |
| Yemen Monitor, Khabar Agency, Saba (government, sabanew.net) | their RSS feeds | 10 min |
| YouTube: Fox News, White House | each channel's free feed: titles and descriptions only, not the speech | 30 min |

Not read, and why (5b, 8 Oct): **AFP** has no free site of its own (France 24 carries its copy); **Truth Social** answers automated readers with an empty app page and its API refuses them, so Trump's posts come through the White House, Rapid Response and the wires; **Clash Report** has no YouTube channel the feed can find (its X and Telegram are read); **saba.ye** (Houthi Saba) and **liveuamap** are behind Cloudflare.

Any site whose own listing fails on a read is listed through Google News (a day wide; what was judged before is skipped)
(`site:` alone) for that read. Nothing behind Cloudflare or a paywall is
bypassed: a walled article is read through a syndicated copy, an existing
Wayback capture, or other outlets' accounts of it (see `origin.ts`).

**Safety nets**, hourly: one keyword search across the Arabic sites and one
across the English ones, for an article a listing dropped.

`/api/status` → `sites` gives each listing's last read: articles listed, new to
the desk, picked, and `rolled` when every article in the window was new (a
possible gap).

## The sea and energy (30 Sep)

- **UKMTO** (X @UK_MTO, every 5 minutes). Each warning and JMIC advisory is
  posted as a picture; a vision model (Gemini flash-lite, Gemma as backup)
  copies its words out. Only this war's waters go on: the Red Sea, Bab
  al-Mandab, the Gulf of Aden, Yemeni and Saudi waters. A Hormuz or Gulf
  warning stays out unless it names the Houthis. A picture left unread is
  read again next tick.
- **Saudi Energy Ministry** (X @MoEnergy_Saudi, every 10 minutes; its X
  articles read by title and opening).
- **Kpler, TankerTrackers, MarineTraffic, Vortexa, Javier Blas, OSINT
  Hexagone, Egypt OSINT** (X, every 15 minutes): only posts about this war's
  waters, Suez traffic, or Saudi exports moving between the Gulf and the Red Sea.
- **OilPrice.com** (RSS, read whole every 10 minutes; triage keeps this war's
  energy and shipping).
- Reuters energy is already read through Reuters' news sitemap.
- **Shipping press and Kpler** (RSS, read whole; triage keeps this war's
  waters and Saudi energy): The Maritime Executive and The National every 10
  minutes; gCaptain, Splash247, Seatrade Maritime and Hellenic Shipping News
  every 15 minutes; Kpler's own analysis every 30 minutes. Added 30 Sep, from
  the Maritime and Energy research.
- **Numbers read directly, every 6 hours:** IMF PortWatch daily ship counts
  through Bab al-Mandab and the Suez Canal (free, satellite ship signals, 3
  to 4 days behind); the daily Brent price from the US Energy Information
  Administration through FRED (free, about a week behind). "Before the war"
  is the 30 days to 12 July.
- **Counting starts on 13 July 2026**, the strike on Sanaa airport.
- **Source order for every attack and figure:** the official body first
  (UKMTO's own warnings, the Saudi Energy Ministry, the Saudi press agency,
  the coalition, JODI), then a wire (Reuters, AP, AFP, Bloomberg), then
  anyone else. An attack with neither an official body nor a wire behind it
  is tagged **Claim**. A figure from a tracking firm carries the firm's name
  (Kpler).
- **The history, 13 July to 30 September** (`ledger-baseline.ts`), from
  research on 30 Sep: all 60 UKMTO warnings since 13 July, read from their
  pictures (8 are in this war's waters; the rest are Hormuz or piracy); the
  Saudi Energy Ministry's statements; JODI's Saudi export figures (June,
  July) and Kpler's through Reuters (August, September); Kpler's oil flows
  through Bab al-Mandab. New sources found: JODI (jodidata.org, the
  kingdom's own monthly figures, via Reuters), France 24/AFP.
- The gate raises a UKMTO/JMIC warning for this war's waters, and an energy
  site hit, stopped or back in service, straight to the reader.

## Relays are traced to the original

A post that relays an outlet or an official ("the WSJ reports", "British media:",
"a US official told …") is traced to the original, which is read in full; the
card becomes the original's. An outlet the desk does not know is looked up on
Google News and its site remembered (`outlets` in `/api/status`).

A leader's words are looked for where he said them: his own post, his office,
his country's press and the wires, and any outlet he spoke to himself ("told
CNN", "in an interview with Le Monde"), wherever it is from. Such an outlet is
not added to the sources: it carried one interview. An original found at an
outlet the desk does not read, the cited outlet's own site or a leader's own
country's press, becomes a source (`learned` in `/api/status`).

---

## What enters the **feed**

Operator filter (not a dump of the wire):

1. Launches, attacks, hits, alerts/sirens — in Yemen, Saudi Arabia, or at sea.
2. Statements on the war, official or unofficial, from: the internationally recognised government, Houthis, Saudis, Iranians, Americans, Europeans, Pakistan, Turkey — especially Mecca-agreement context.
3. Exclusive reporting from the sources above.

The live-scan box shows the **raw** scan (closed by default): every item read, kept or dropped, with the reason.

## One card per event

Several outlets telling one event in one scan (a wave of strikes by one side on one area included) become **one** card, written from every account. The lead source is the most fitting one (the speaker's own channel, then an official outlet, the original of a relay, an agency); the others are listed under "Also" as links only. A card that only repeats its headline has no body.

A post with its own picture or video (launches, strikes, ships, battle footage, satellite images, front maps) carries it on the card, played from X or Telegram directly. Portraits, meetings, text cards, graphic content and prisoners are left out.

## Map

Icons, not dots: rocket = launch/strike/alert; swords = ground fighting; ship = maritime incident; energy incident = an oil, gas or port site hit. Statements stay in the feed only. The developments and fronts maps have their own pictures (energy site hit = a burning tank, sirens = a siren).

Control is shaded by district (`control.json`, the hand baseline of 24 Sep). Every 6 hours the desk changes a district only when two outlets from different sides, or a wire, report it taken; a claim by one side makes it contested. The control shares are computed from the shaded area.

Map tiles: OpenStreetMap in the Original look, Esri Canvas (grey) in Day and Night; both need their credit line, shown on the map.

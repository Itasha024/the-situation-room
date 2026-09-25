# Yemen desk — OSINT source pool (operator list only)

The previous 288-endpoint catalog is **parked**. The desk now scans **only** the Telegram channels and websites the operator named.

**No Israeli sources.** Every named source on a card must have a real article/post URL.

**X / Twitter: read through FxTwitter.** An account's latest 20 public posts come from FxTwitter's open API (`api.fxtwitter.com/2/profile/<handle>/statuses`), every 5 minutes, with no login and no key. Reposts and replies to other accounts are left out; an account's own threads are kept. Each post then goes through the same gate and reader as a Telegram post; the reader is told it is an open-source analyst, whose own findings (a frontline mapped from satellite imagery, footage geolocated) are reports and whose questions and teasers are not. Tried on 24 September and not usable: x.com itself (login), the Nitter mirrors (down or behind bot checks, which the desk does not bypass), xcancel (451) and Twitter's syndication endpoint (429). `/api/status` shows each account's last read.

| X account | How often |
|---|---|
| The Cube — `@war_cube` | every 5 minutes |

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
| Reuters, WSJ, Washington Post, NYT, NY Post, Axios, CNN, ABC, CBS, Fox | every 30 minutes |
| Keyword safety nets (Arabic sites, English sites) | every hour |
| Al-Akhbar (via Google News) | every hour |

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
| Al-Araby TV | `alaraby.com/rss.xml` | 30 min |
| Asharq Al-Awsat | Google News, `site:aawsat.com` alone, last hour (Cloudflare 403) | 30 min |
| Erem News | Google News, `site:eremnews.com` alone, 2 h (Cloudflare 403) | 30 min |
| Al-Akhbar | Google News, `site:al-akhbar.com` alone, 1 day (Cloudflare 403); its channel every 15 min | 1 h |
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

Any site whose own listing fails on a read is listed through Google News (a day wide; what was judged before is skipped)
(`site:` alone) for that read. Nothing behind Cloudflare or a paywall is
bypassed: a walled article is read through a syndicated copy, an existing
Wayback capture, or other outlets' accounts of it (see `origin.ts`).

**Safety nets**, hourly: one keyword search across the Arabic sites and one
across the English ones, for an article a listing dropped.

`/api/status` → `sites` gives each listing's last read: articles listed, new to
the desk, picked, and `rolled` when every article in the window was new (a
possible gap).

## Relays are traced to the original

A post that relays an outlet or an official ("the WSJ reports", "British media:",
"a US official told …") is traced to the original, which is read in full; the
card becomes the original's. An outlet the desk does not know is looked up on
Google News and its site remembered (`outlets` in `/api/status`).

---

## What enters the **feed**

Operator filter (not a dump of the wire):

1. Launches, attacks, hits, alerts/sirens — in Yemen, Saudi Arabia, or at sea.
2. Statements on the war, official or unofficial, from: the internationally recognised government, Houthis, Saudis, Iranians, Americans, Europeans, Pakistan, Turkey — especially Mecca-agreement context.
3. Exclusive reporting from the sources above.

The live-scan box shows the **raw** scan (closed by default): every item read, kept or dropped, with the reason.

## Map

Icons, not dots: missile = launch/strike/siren; swords = ground combat; ship = vessel; crane = port. Statements stay in the feed only.

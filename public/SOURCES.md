# Yemen desk — OSINT source pool (operator list only)

The previous 288-endpoint catalog is **parked**. The desk now scans **only** the Telegram channels and websites the operator named.

**No Israeli sources.** Every named source on a card must have a real article/post URL.

**X / Twitter is off.** The public syndication endpoint returns HTTP 429 under bulk scan, and there is no free persistent X API on this desk. When a working free pipe exists it can be reattached; until then X is not scanned.

---

## Cadence (Asia/Jerusalem)

| Source | How often |
|---|---|
| Telegram channels | every 5 minutes |
| Al-Akhbar and Erem News channels | every 15 minutes |
| Almashhad (almashhad.news) | every 5 minutes |
| SPA | every 5 minutes |
| Al-Araby Al-Jadeed (incl. سياسة), Al-Araby TV | every 30 minutes |
| Asharq Al-Awsat (incl. الشرق الأوسط) | every 30 minutes |
| Erem News, Alhurra, Arab News | every 30 minutes |
| Reuters, WSJ, Washington Post, NYT, NY Post, Axios, CNN, ABC, CBS, Fox + US statements (Trump / State Department / White House) | every 30 minutes |
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
- Al-Araby Television — `@AlarabyTelevision`
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

## Websites

- Almashhad — https://www.almashhad.news/ (RSS)
- Al-Araby Al-Jadeed — https://www.alaraby.co.uk/ (+ سياسة)
- Asharq Al-Awsat — https://aawsat.com/ (+ الشرق الأوسط)
- Al-Akhbar — via Google News only. al-akhbar.com answers every automated
  request with a Cloudflare challenge (403), so there is no site read and no PDF
  edition read; the paper's own headlines arrive on its Telegram channel.
- Erem News — https://www.eremnews.com/
- Alhurra — https://alhurra.com/
- Arab News — https://www.arabnews.com/
- Reuters ME — https://www.reuters.com/world/middle-east/
- WSJ, Washington Post, NYT International, NY Post, Axios, CNN, ABC, CBS, Fox News
- SPA — https://www.spa.gov.sa/en

---

## What enters the **feed**

Operator filter (not a dump of the wire):

1. Launches, attacks, hits, alerts/sirens — in Yemen, Saudi Arabia, or at sea.
2. Statements on the war, official or unofficial, from: the internationally recognised government, Houthis, Saudis, Iranians, Americans, Europeans, Pakistan, Turkey — especially Mecca-agreement context.
3. Exclusive reporting from the sources above.

The **סריקה חיה** box under «מצב כללי» shows the **raw** scan (default closed). Mark מעניין / לא so the desk can learn.

## Map

Icons, not dots: missile = launch/strike/siren; swords = ground combat; ship = vessel; crane = port. Statements stay in the feed only.

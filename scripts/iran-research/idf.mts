// The IDF's Arabic and Farsi channels -> hand events: a strike it says it carried out, at a place on the desk's list.
import fs from "node:fs";
import { iranPlacesIn, asProvince } from "../../src/lib/desk/iran-places.ts";
const ilDay = (iso: string, back = 0) => new Date(Date.parse(iso) + 3 * 3600e3 - back * 864e5).toISOString().slice(0, 10);
const out: object[] = [];
for (const [ch, src] of [["IDFSpokespersonArabic", "IDF Arabic"], ["idfinfarsi", "IDF Farsi"]]) {
  const L = fs.readFileSync(`tg/${ch}.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  for (const p of L) {
    const t: string = p.text.replace(/&rlm;|⁧|⁩/g, "").replace(/\s+/g, " ");
    // Done, not announced: "هاجم/أغار/استهدف/دمّر/قضى", "حمله کرد/هدف قرار داد/منهدم"; never a warning or a threat.
    const done = ch === "idfinfarsi" ? /حمله کرد|حملات .*انجام|هدف قرار (?:داد|گرفت)|منهدم کرد|نابود کرد|از بین برد|به هلاکت رساند|حذف کرد/ : /هاجم|أغار|اغار|استهدف|دمّر|دمر|قضى|أنجز|انجز|استكمل/;
    const warn = /إنذار|انذار|تحذير|سيهاجم|سيقوم|هشدار|تخلیه|حمله خواهد کرد|حمله می‌کند|به زودی/;
    if (!done.test(t) || warn.test(t.slice(0, 160))) continue;
    const back = /أمس|امس|دیروز|دی‌روز/.test(t) ? 1 : 0;
    for (const pl of iranPlacesIn(t)) {
      if (pl.kind === "sea" || asProvince(t, pl)) continue;
      if (!["Iran", "Lebanon", "Iraq"].includes(pl.country)) continue;
      const said = [pl.name, ...(pl.alt ?? [])].find((n) => t.includes(n));
      if (!said) continue;
      const verb = pl.country === "Iran" ? "Israeli strike on" : "Israeli strike on";
      out.push({ day: ilDay(p.at, back), actor: "israel", said, country: pl.country, label: `${verb} {place}, ${pl.country} (IDF)`, source: src, url: `https://t.me/${ch}/${p.id}`, text: p.text, en: pl.name });
    }
  }
}
fs.writeFileSync("idf-events.jsonl", out.map((e) => JSON.stringify(e)).join("\n"));
const m: Record<string, number> = {};
for (const e of out as { day: string; country: string }[]) m[e.day.slice(0, 7) + " " + e.country] = (m[e.day.slice(0, 7) + " " + e.country] ?? 0) + 1;
console.log(out.length, m);

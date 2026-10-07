/**
 * Run one article through the desk's reading steps — fetch, the lead, the
 * exclusive check, the relay check, the reader — and print the card it would
 * make. Publishes nothing, writes nothing.
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/exclusive-check.mts "<source>" <url> [<source> <url> ...]
 */
import { amphtmlOf, extractLead, fetchText } from "../src/lib/yemen-scan.server.ts";
import { isExclusive, ownInformation } from "../src/lib/desk/exclusive.ts";
import { findCitation } from "../src/lib/desk/origin.ts";
import { readBatch } from "../src/lib/desk/reader.ts";

const args = process.argv.slice(2);
const key = process.env.GEMINI_API_KEY || "";
for (let i = 0; i + 1 < args.length; i += 2) {
  const [source, url] = [args[i], args[i + 1]];
  console.log(`\n=== ${source}  ${url}`);
  const html = await fetchText(url, 10_000);
  if (!html) {
    console.log("fetch: failed (blocked or paywalled)");
    continue;
  }
  let lead = extractLead(html, 12_000);
  if (lead.length < 700) {
    const amp = amphtmlOf(html, url);
    const ampHtml = amp && amp !== url ? await fetchText(amp, 10_000) : null;
    const a = ampHtml ? extractLead(ampHtml, 12_000) : "";
    if (a.length > lead.length) lead = a;
  }
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]?.trim() ?? "";
  const text = `${title}\n${lead}`;
  console.log(`lead: ${lead.length} chars`);
  console.log(`exclusive: ${isExclusive(text, source)}  own information: ${ownInformation(text, source)}`);
  const cited = findCitation(text, source, url);
  console.log(`relays: ${cited ? cited.name : "no one"}`);
  if (!key || lead.length < 200) continue;
  const { readings, model, error } = await readBatch(
    [{ id: "0", source, alignment: "no declared alignment", postedAt: new Date().toISOString(), text, full: true }],
    key,
  );
  const r = readings.get("0");
  if (!r) {
    console.log(`reader: nothing (${error ?? "no reading"})`);
    continue;
  }
  console.log(`reader (${model}): publish=${r.publish}${r.publish ? "" : ` (${r.reject_reason})`}`);
  console.log(`headline: ${r.headline}`);
  console.log(`body: ${r.body ?? ""}`);
}
process.exit(0);

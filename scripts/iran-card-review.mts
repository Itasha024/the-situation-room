/**
 * The Iran desk's live cards against the rules added since they were
 * published (card review, 9 Oct): one side's outlet retelling another's
 * voice, Israel's attacks told by Iran's outlets, Lebanon's by anyone but
 * Lebanon's own sources, the Yemen desk's war.
 *
 *   node scripts/iran-card-review.mjs [hours=72] [--apply]
 *
 * Lists by default. --apply removes each card as remove-card.mts does, as
 * "desk-error": the desk's fault, never counted against the source.
 */
import { getSql } from "../src/lib/db.ts";
import { getStore } from "../src/lib/desk/store.ts";
import { attackTeller, rivalRelay } from "../src/lib/desk/speaker-press.ts";
import { israelAbroad, yemenOnly } from "../src/lib/desk/iran-reader.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const hours = Number(args.find((a) => /^\d+$/.test(a)) ?? 72);
const store = await getStore();
const { reports } = await store.recentDesk(2000, undefined, { events: false, desk: "iran" });
const since = Date.now() - hours * 3600_000;
type Card = { fp: string; at: string; source: string; summary: string; type: string; lean?: string; flags?: string[]; desks?: string[] };
const cards = (reports as unknown as Card[]).filter((r) => Date.parse(r.at) >= since && (r.desks ?? []).includes("iran"));

const bad: { c: Card; why: string }[] = [];
for (const c of cards) {
  const flags = c.flags ?? [];
  const excl = flags.includes("exclusive");
  const actor = israelAbroad(c.summary) ? "israel" : (flags.find((f) => f.startsWith("actor:"))?.slice(6) ?? "");
  const why =
    rivalRelay(c.summary, c.source, c.lean ?? "", excl) ??
    attackTeller(c.summary, c.source, actor, c.type === "combat" || c.type === "strike", c.lean ?? "") ??
    (yemenOnly(c.summary) && !(c.desks ?? []).includes("yemen") ? "yemen desk: the Houthis' war with Saudi Arabia is the Yemen desk's" : null);
  if (why) bad.push({ c, why });
}
console.log(`${cards.length} Iran cards in ${hours} h; ${bad.length} break the rules`);
for (const { c, why } of bad) console.log(`- ${c.fp} | ${c.source} (${c.lean ?? "?"}) | ${c.type} | ${c.summary}\n    ${why}`);

if (apply && bad.length) {
  const sql = await getSql();
  for (const { c } of bad) {
    await sql`
      insert into desk_state (key, value, updated_at) values ('json:dropped', jsonb_build_object(${c.fp}::text, ${Date.now()}::bigint), now())
      on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;
    await sql`delete from desk_event where fp = ${c.fp}`;
    await sql`delete from desk_report where fp = ${c.fp}`;
  }
  console.log(`removed ${bad.length}`);
}
process.exit(0);

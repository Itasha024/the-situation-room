import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// The researched Iran pins' corrections, run by map-pack.cjs before every build (audit of 17 Oct).
const require = createRequire(import.meta.url);
const { fixBase, seaTwins, skeleton } = require("../../../scripts/iran-research/pin-rules.cjs");

const pin = (o: Record<string, unknown>): any => ({ fp: "x", day: "2026-08-03", actor: "israel", place: "", lat: 0, lng: 0, label: "", source: "", url: "", also: [], ...o });

test("a village two sources spell two ways is one pin", () => {
  assert.equal(skeleton("Al Mansuri"), skeleton("Al-Mansouri"));
  assert.equal(skeleton("Zibqin"), skeleton("Zebqine"));
  const out = fixBase([
    pin({ place: "Al Mansuri", lat: 33.1737, lng: 35.2111, source: "Ali Shoaib's page", url: "https://t.me/alichoeib1970/1" }),
    pin({ place: "Al-Mansouri", lat: 33.19, lng: 35.23, source: "Naharnet", url: "https://naharnet.com/1" }),
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].also.map((a: { source: string }) => a.source), ["Naharnet"]);
});

test("Ali Shoaib's 'explosions heard' in Lebanon are Israeli demolitions; Iran downing a US drone is no US strike", () => {
  const [d] = fixBase([pin({ place: "Khiam", lat: 33.3272, lng: 35.609, actor: "unclear", source: "Ali Shoaib's page", label: "Explosions heard in Khiam" })]);
  assert.equal(d.label, "Israeli forces blow up buildings in Khiam");
  assert.equal(d.actor, "israel");
  const [s] = fixBase([pin({ place: "Isfahan", lat: 32.65, lng: 51.67, actor: "us", label: "IRGC says it shot down a US drone over Isfahan" })]);
  assert.equal(s.actor, "unclear");
});

test("a place named after its city sits in that city, and a day out of its channel's post order follows its neighbours", () => {
  const tehran = Array.from({ length: 12 }, (_, i) => pin({ fp: `t${i}`, place: "Tehran", lat: 35.6944, lng: 51.4215, day: "2026-03-01" }));
  const out = fixBase([...tehran, pin({ fp: "n", place: "Niloufar Square, Tehran", lat: 26.5042, lng: 54.0409, day: "2026-03-01" })]);
  const n = out.find((p: { fp: string }) => p.fp === "n");
  assert.equal(n.lat, 35.6944);
  const ch = (id: number, day: string) => pin({ fp: `c${id}`, place: `V${id}`, url: `https://t.me/alichoeib1970/${id}`, day, lat: 33 + id / 1000, lng: 35.5 });
  const days = fixBase([ch(1, "2026-05-01"), ch(2, "2026-05-01"), ch(3, "2026-05-02"), ch(4, "2026-04-02"), ch(5, "2026-05-02"), ch(6, "2026-05-03"), ch(7, "2026-05-03")]);
  assert.equal(days.find((p: { fp: string }) => p.fp === "c4").day, "2026-05-02");
});

test("a ship attack told twice, timed and untimed, at sea the same day is one pin", () => {
  const base: { also: { source: string }[] }[] = [
    pin({ fp: "u", place: "Strait of Hormuz", lat: 26.57, lng: 56.25, actor: "unclear", source: "Sabereen News", url: "https://t.me/SabrenNewss/227060", label: "Explosions at sea in the Strait of Hormuz" }),
    pin({ fp: "t", place: "Strait of Hormuz", lat: 26.6, lng: 56.3, actor: "iran", at: "2026-09-30T06:33:00Z", source: "UKMTO", url: "https://ukmto.org/145", label: "Inbound tanker struck" }),
  ];
  const drop = seaTwins(base, [true, true]);
  assert.deepEqual([...drop], [0]);
  assert.equal(base[1].also[0].source, "Sabereen News");
});

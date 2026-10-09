// CENTCOM's own posts on X (read through FxTwitter by their ids, which the Wayback Machine's index of x.com
// lists), read by hand: an attack it carried out, or one on its forces, with a place it names and a day.
// Line: post id|day|actor|place said|lat,lng|label. Strikes it dates only by before-and-after pictures (Karaj,
// Khomeinishahr, Qom, the Bushehr boatyard) are left out, and so are "self-defence strikes" with no place.
const fs = require('fs');
const HAND = `
2028115452036022614|2026-02-28|us|Chah Bahar|25.2919,60.643|US forces sink an Iranian Jamaran-class corvette at a pier in Chabahar
2031489675760640370|2026-03-10|us|Strait of Hormuz|26.5667,56.25|US forces destroy Iranian naval vessels near the Strait of Hormuz, including 16 minelayers
2032777791247155482|2026-03-14|us|Kharg Island|29.26,50.33|US strike on Kharg Island destroys mine stores, missile bunkers and over 90 military targets
2045969284690788615|2026-04-19|us|Arabian Sea|22.5,61.5|US destroyer disables the Iranian-flagged cargo ship Touska trying to break the blockade in the Arabian Sea
2051390103629570453|2026-05-04|us|Strait of Hormuz|26.5667,56.25|US helicopters destroy Iranian small boats threatening shipping near the Strait of Hormuz
2052070088233136553|2026-05-06|us|Gulf of Oman|24.8,58.2|US forces disable an Iranian-flagged tanker sailing to Iran in the Gulf of Oman
2052502030778843379|2026-05-07|iran|Strait of Hormuz|26.5667,56.25|Iranian attacks on US destroyers transiting the Strait of Hormuz intercepted
2052751945329242281|2026-05-08|us|Gulf of Oman|24.8,58.2|US forces disable the tankers Sea Star III and Sevda before they reach an Iranian port in the Gulf of Oman
2059950035916218595|2026-05-28|iran|Kuwait|29.3759,47.9774|Iranian ballistic missile fired at Kuwait, intercepted by Kuwaiti forces
2059950035916218595|2026-05-27|iran|Strait of Hormuz|26.5667,56.25|Five Iranian attack drones launched at the Strait of Hormuz, intercepted by US forces
2060782333209575847|2026-05-29|us|Gulf of Oman|24.8,58.2|US forces disable a Gambia-flagged ship sailing to an Iranian port in the Gulf of Oman
2061285916895854963|2026-05-31|us|Qeshm Island|26.958,56.271|US strikes on Iranian radar and drone control sites on Qeshm Island
2061419519705223257|2026-06-01|iran|Kuwait|29.3759,47.9774|Two Iranian ballistic missiles fired at US forces in Kuwait, intercepted
2061954682507911314|2026-06-02|us|Qeshm Island|26.958,56.271|US strikes on Qeshm Island after Iranian missile and drone attacks
2061982709723906359|2026-06-02|iran|Kuwait|29.3759,47.9774|Wave of Iranian drones at US forces in Kuwait shot down
2062247958364791088|2026-06-02|iran|Kuwait International Airport|29.2266,47.9689|Iranian drones strike the passenger terminal at Kuwait International Airport
2063030319490744715|2026-06-05|us|Qeshm Island|26.958,56.271|US strikes on Iranian coastal radar sites on Qeshm Island and at Goruk after four drones are shot down
2063081770422030840|2026-06-05|iran|Strait of Hormuz|26.5667,56.25|Seven Iranian ballistic missiles and drones fired at the Strait of Hormuz and Gulf neighbours, intercepted
2063424127508037983|2026-06-06|iran|Strait of Hormuz|26.5667,56.25|Two Iranian attack drones over the Strait of Hormuz shot down by US forces
2064019704482545753|2026-06-08|us|Gulf of Oman|24.8,58.2|US forces disable an unladen oil tanker sailing to Iran in the Gulf of Oman
2064742227910287722|2026-06-10|us|Gulf of Oman|24.8,58.2|US forces disable a second oil tanker breaking the blockade in the Gulf of Oman
2065032634908987869|2026-06-11|us|Gulf of Oman|24.8,58.2|US forces disable a third oil tanker carrying Iranian oil in the Gulf of Oman
`;
const posts = new Map(fs.readFileSync(process.argv[2] || 'x/CENTCOM.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((p) => [p.id, p]));
const out = [];
for (const l of HAND.trim().split('\n')) {
  const [id, day, actor, said, pos, label] = l.split('|');
  const p = posts.get(id); if (!p) throw new Error('no post ' + id);
  const [lat, lng] = pos.split(',').map(Number);
  const country = /Kuwait/.test(said) ? 'Kuwait' : /Strait|Gulf of Oman|Arabian Sea/.test(said) ? 'sea' : 'Iran';
  out.push({ day, actor, said, country, label: `${label} (CENTCOM)`, source: 'CENTCOM', url: `https://x.com/CENTCOM/status/${id}`, text: p.text, en: said === 'Chah Bahar' ? 'Chabahar' : said, lat, lng });
}
fs.writeFileSync(process.argv[3] || 'centcom-events.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
console.log(out.length, 'CENTCOM events');

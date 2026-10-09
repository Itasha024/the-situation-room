// CENTCOM, round 2 (user, 9 Oct: "only 20 of 470? even 'south Iran' is a pin"): its posts read again, now
// keeping an area it names ("Iran's coastline near the Strait of Hormuz", "eastern Iraq"), and its press
// releases, which its posts only link to, read in full on DVIDS (the US military's media site, which carries
// them; centcom.mil refuses us). Line: x:<post id> or dvids:<news path>, day (CENTCOM's own date), actor,
// place as written, lat,lng, label, country, and for a release the sentence that names the place.
// Still out: strikes with no place ("multiple targets in Iran"), tallies over days, redirected ships.
const fs = require('fs');
const HAND = [
  ['x:2028182813837828251', '2026-02-28', 'iran', 'Burj Al Arab', '25.1412,55.1853', 'Iranian attack on the Burj Al Arab hotel in Dubai', 'UAE'],
  ['x:2028182813837828251', '2026-02-28', 'iran', 'Zayed International Airport', '24.433,54.6511', 'Iranian attack on Zayed International Airport, Abu Dhabi', 'UAE'],
  ['x:2028182813837828251', '2026-02-28', 'iran', 'Kuwait International Airport', '29.2266,47.9689', 'Iranian attack on Kuwait International Airport', 'Kuwait'],
  ['x:2030727586226360485', '2026-03-01', 'iran', 'Saudi Arabia', '24.0627,47.5805', 'Iranian attack on US troops in Saudi Arabia; a US soldier wounded there dies a week later', 'Saudi Arabia'],
  ['x:2028553001644736808', '2026-03-02', 'us', 'Gulf of Oman', '24.8,58.2', 'US forces sink the last of the 11 Iranian ships in the Gulf of Oman', 'sea'],
  ['x:2034040698954031326', '2026-03-17', 'us', 'Strait of Hormuz', '27.08,56.6', "US 5,000-pound bunker busters hit Iranian anti-ship missile sites on Iran's coast near the Strait of Hormuz", 'Iran'],
  ['x:2034580622149026102', '2026-03-19', 'us', 'Strait of Hormuz', '26.5667,56.25', 'US forces destroy Iranian naval targets in and near the Strait of Hormuz', 'sea'],
  ['dvids:566712/centcom-disables-non-compliant-vessel-arabian-gulf', '2026-06-02', 'us', 'Kharg Island', '28.7,50.1', 'US aircraft disables the tanker Lexie with a Hellfire missile in the Gulf, on its way to Kharg Island', 'sea',
    "U.S. Central Command (CENTCOM) enforced blockade measures against Botswana-flagged M/T Lexie as it transited international waters toward Kharg Island. The ship's crew ignored repeated warnings, failing to comply with directions from U.S. forces multiple times over a 24-hour period. A U.S. aircraft ultimately disabled the vessel by firing a Hellfire missile into the ship's engine room, preventing the tanker from reaching Iran."],
  ['dvids:567214/us-army-crew-safely-rescued-after-helicopter-lost-sea', '2026-06-08', 'iran', 'Oman', '24.9,57.0', 'US Army Apache helicopter downed near the coast of Oman, its crew rescued (Iran downed it, CENTCOM says)', 'sea',
    'At 7:33 p.m. ET on June 8, two crew members from a U.S. Army AH-64 Apache were rescued by American forces after their helicopter went down near the coast of Oman while patrolling regional waters.'],
  ['dvids:567293/us-completes-strikes-response-irans-attack-apache', '2026-06-09', 'us', 'Strait of Hormuz', '27.08,56.6', 'US strikes on Iranian air defence, ground control stations and radar sites near the Strait of Hormuz, after the Apache', 'Iran',
    "CENTCOM forces struck Iranian air defense, ground control stations, and surveillance radar sites near the Strait of Hormuz with precision munitions from U.S. Air Force and Navy fighter jets."],
  ['x:2065608055790637301', '2026-06-13', 'iran', 'Strait of Hormuz', '26.5667,56.25', 'Iranian attack drones launched at merchant ships in the Strait of Hormuz, all shot down by US forces', 'sea'],
  ['dvids:568726/us-strikes-iran-response-attack-commercial-vessel', '2026-06-25', 'iran', 'Omani coast', '26.35,56.55', 'Iranian drone hits the cargo ship Ever Lovely leaving the Strait of Hormuz along the Omani coast', 'sea',
    'U.S. aircraft struck Iranian missile and drone storage locations and coastal radar sites after Iran hit M/V Ever Lovely on June 25 with a one-way attack drone. The Singapore-flagged cargo ship was exiting the Strait of Hormuz along the Omani coast at the time of Iran\'s attack.'],
  ['dvids:568859/us-forces-conduct-additional-strikes-after-irans-latest-commercial-ship-attack', '2026-06-27', 'iran', 'Strait of Hormuz', '26.5667,56.25', 'Iranian drone hits the tanker Kiku near the Strait of Hormuz', 'sea',
    'its forces launched a one-way attack drone that hit M/T Kiku this morning at 4:30 a.m. ET. The Panama-flagged tanker was transiting near the Strait of Hormuz with more than two-million barrels of crude oil.'],
  ['x:2071029590932258941', '2026-06-27', 'us', 'Strait of Hormuz', '27.08,56.6', 'US strikes on 10 Iranian military targets in and near the Strait of Hormuz, after the drone attack on the Kiku', 'Iran'],
  ['dvids:569521/us-forces-complete-new-round-retaliatory-strikes-against-iran', '2026-07-07', 'us', 'strait', '27.08,56.6', 'US strikes hit over 80 targets, among them more than 60 IRGC small boats, in and near the Strait of Hormuz', 'Iran',
    'U.S. forces struck Iranian air defense systems, command and control networks, coastal radar sites, anti-ship missile capabilities, and more than 60 Islamic Revolutionary Guard Corps small boats in and near the strait'],
  ['dvids:569596/us-forces-complete-another-round-strikes-against-iran', '2026-07-08', 'us', "Iran's coastline", '27.08,56.6', "US strikes hit about 90 Iranian military targets along Iran's coastline by the Strait of Hormuz", 'Iran',
    "U.S. forces struck approximately 90 Iranian military targets including air defense systems, coastal surveillance assets, missile and drone storage sites, naval capabilities, and military logistics infrastructure along Iran's coastline."],
  ['x:2076089130857951463', '2026-07-11', 'iran', 'Strait of Hormuz', '26.5667,56.25', 'IRGC attack on the container ship GFS Galaxy in the Strait of Hormuz; a crew member missing, fire on board', 'sea'],
  ['x:2076679617440530442', '2026-07-12', 'us', 'Bandar Abbas Naval Base', '27.145,56.205', 'US Corsair sea drones strike the submarine and ship maintenance port at Bandar Abbas Naval Base', 'Iran'],
  ...['Bushehr|28.9684,50.8385', 'Chah Bahar|25.2919,60.643', 'Jask|25.6383,57.7745', 'Konarak|25.3603,60.3994', 'Abu Musa|25.8787,55.033', 'Bandar Abbas|27.1832,56.2666'].map((s) => {
    const [n, ll] = s.split('|');
    return ['dvids:569866/us-forces-complete-new-strikes-iranian-military-targets', '2026-07-13', 'us', n, ll, `US strikes on Iranian coastal defences, missile and drone sites at ${n === 'Chah Bahar' ? 'Chabahar' : n}`, 'Iran',
      'During the five-hour mission, U.S. forces successfully struck military targets across Iran including Bushehr, Chah Bahar, Jask, Konarak, Abu Musa, and Bandar Abbas to further degrade Iran\'s ability to attack commercial shipping.'];
  }),
  ...['Bandar Abbas|27.1832,56.2666', 'Khormuj|28.6543,51.3803', 'Ahvaz|31.3183,48.6706', 'Qeshm|26.958,56.271', 'Tunb|26.258,55.303', 'Bushehr|28.9684,50.8385', 'Kuh-e Stak|26.8,57.03'].map((s) => {
    const [n, ll] = s.split('|');
    return ['x:2077419551705203121', '2026-07-14', 'us', n, ll, `US strikes on Iranian military targets at ${n === 'Tunb' ? 'Greater Tunb' : n}`, 'Iran'];
  }),
  ['dvids:569969/centcom-conducts-morning-round-strikes-against-iran', '2026-07-15', 'us', 'Greater Tunb Island', '26.262,55.31', 'US strikes on coastal defences and cruise missile sites on Greater Tunb Island', 'Iran',
    'CENTCOM launched precision munitions against coastal defense systems and cruise missile storage and launch sites on Greater Tunb Island during the 90-minute wave.'],
  ['dvids:570042/latest-wave-us-strikes-against-iran-completed', '2026-07-15', 'us', 'Bandar Abbas', '27.1832,56.2666', 'US evening strikes on Iranian command centres, air defence and missile sites, Bandar Abbas among them', 'Iran',
    'CENTCOM used precision munitions to hit targets in multiple locations including Bandar Abbas.'],
  ['dvids:570021/us-forces-disable-non-compliant-vessel-arabian-gulf', '2026-07-15', 'us', 'Kharg Island', '28.7,50.1', 'US aircraft disables the tanker Belma with Hellfire missiles in the Gulf, on its way to Kharg Island', 'sea',
    "U.S. Central Command (CENTCOM) forces observed Curacao-flagged M/T Belma transiting international waters toward Kharg Island. The commercial vessel ignored multiple warnings as it attempted to violate the U.S. blockade. A U.S. aircraft disabled the vessel after firing hellfire missiles into the ship's smokestack."],
  ['x:2078125131847594149', '2026-07-16', 'us', 'Chah Bahar', '25.2919,60.643', "US forces destroy the IRGC's surveillance tower at Chabahar's Shahid Kalantari port", 'Iran'],
  ['x:2081130091766325398', '2026-07-24', 'us', 'Gulf of Oman', '25.15,56.85', 'US forces disable the Mozambique-flagged tanker Lavine in the Gulf of Oman', 'sea'],
  ['dvids:570951/us-saudi-forces-strike-iran-backed-terrorist-sites-iraq', '2026-07-28', 'us', 'eastern Iraq', '33.75,45.4', 'US and Saudi jets strike Iran-aligned militia logistics and weapons sites across eastern Iraq', 'Iraq',
    'U.S. and Saudi fighter aircraft struck multiple terrorist logistics and weapons sites across eastern Iraq in a strong response to over 30 IRGC-directed aerial drone attacks in the last 72 hours.'],
  ['x:2087251919555248599', '2026-08-11', 'us', 'Gulf of Oman', '24.8,58.2', 'US helicopter fires two Hellfire missiles into the cargo ship Vela Nova in the Gulf of Oman', 'sea'],
  ['dvids:574030/centcom-destroys-3-irgc-oil-tankers-after-iran-targets-2-us-navy-warships', '2026-09-05', 'us', 'Kharg Island', '29.2,50.25', 'US forces disable the IRGC oil tanker Downy off Kharg Island', 'sea',
    'CENTCOM permanently disabled the IRGC crude oil carriers M/T Downy off the coast of Kharg Island and M/T Stark 1 near Jask.'],
  ['dvids:574030/centcom-destroys-3-irgc-oil-tankers-after-iran-targets-2-us-navy-warships', '2026-09-05', 'us', 'Jask', '25.55,57.85', 'US forces disable the IRGC oil tanker Stark 1 near Jask', 'sea',
    'CENTCOM permanently disabled the IRGC crude oil carriers M/T Downy off the coast of Kharg Island and M/T Stark 1 near Jask.'],
  ['dvids:574030/centcom-destroys-3-irgc-oil-tankers-after-iran-targets-2-us-navy-warships', '2026-09-05', 'us', 'Gulf of Oman', '24.8,58.2', 'US forces destroy the tanker Kylo in the Gulf of Oman; it sinks', 'sea',
    'American forces also completely destroyed the unladen crude oil carrier M/T Kylo (also known as the "Noxen") in the Gulf of Oman'],
  ['dvids:574128/us-destroys-5-irgc-tankers-after-iran-targets-another-american-warship', '2026-09-08', 'us', 'Gulf of Oman', '24.8,58.2', 'US forces destroy four IRGC tankers in the Gulf of Oman: Kaviz, Charminar, Horizon 1 and Riesco', 'sea',
    'CENTCOM destroyed the IRGC crude oil carriers M/T Kaviz, M/T Charminar, M/T Horizon 1, and M/T Riesco in the Gulf of Oman as well as M/T Derya near Kharg Island.'],
  ['dvids:574128/us-destroys-5-irgc-tankers-after-iran-targets-another-american-warship', '2026-09-08', 'us', 'Kharg Island', '29.2,50.25', 'US forces destroy the IRGC tanker Derya near Kharg Island', 'sea',
    'CENTCOM destroyed the IRGC crude oil carriers M/T Kaviz, M/T Charminar, M/T Horizon 1, and M/T Riesco in the Gulf of Oman as well as M/T Derya near Kharg Island.'],
  ['x:2099591186583371830', '2026-09-12', 'iran', 'Oman', '24.3,58.7', 'Iranian drone hits the disabled tanker El Gaia again, off the coast of Oman', 'sea'],
];
// The release of 28 May (centcom.mil, kept by the Wayback Machine): the sixth drone stopped at its launch site.
HAND.push(['web:https://web.archive.org/web/20260528235116/https://www.centcom.mil/MEDIA/PRESS-RELEASES/Press-Release-View/Article/4502431/statement-from-centcom-on-recent-iranian-aggression/', '2026-05-27', 'us', 'Bandar Abbas', '27.1832,56.2666', 'US forces stop a drone launch from an Iranian ground control site in Bandar Abbas', 'Iran',
  'All drones were successfully intercepted by U.S. forces which also prevented a sixth drone launch from an Iranian ground control site in Bandar Abbas.']);
const posts = new Map(fs.readFileSync(process.argv[2] || 'x/CENTCOM.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((p) => [p.id, p]));
const out = [];
for (const [src, day, actor, said, pos, label, country, quote] of HAND) {
  const [kind, ref] = [src.slice(0, src.indexOf(':')), src.slice(src.indexOf(':') + 1)];
  const text = kind === 'x' ? posts.get(ref)?.text : quote;
  if (!text) throw new Error('no text ' + src);
  if (!text.includes(said)) throw new Error(`"${said}" not in ${src}`);
  const url = kind === 'x' ? `https://x.com/CENTCOM/status/${ref}` : kind === 'dvids' ? `https://www.dvidshub.net/news/${ref}` : ref;
  const [lat, lng] = pos.split(',').map(Number);
  const en = { 'Chah Bahar': 'Chabahar', Tunb: 'Greater Tunb', strait: 'Strait of Hormuz', "Iran's coastline": 'Strait of Hormuz', Oman: 'off Oman', 'Omani coast': 'off Oman' }[said] ?? said;
  out.push({ day, actor, said, country, label: `${label} (CENTCOM)`, source: 'CENTCOM', url, text, en, lat, lng });
}
fs.writeFileSync(process.argv[3] || 'centcom2-events.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
console.log(out.length, 'CENTCOM events (round 2)');

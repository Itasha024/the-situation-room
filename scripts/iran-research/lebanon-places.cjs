// Villages OpenStreetMap's place list misses or spells otherwise, by hand from GeoNames (LB.txt, 9 Oct) and OSM itself.
const fs = require('fs');
const osm = JSON.parse(fs.readFileSync('osm-lb.json', 'utf8')).elements.filter((e) => !e.tags.extra);
const at = (ar, en, lat, lon) => ({ lat, lon, tags: { name: ar, 'name:en': en, extra: 'gn' } });
const like = (ar, osmName) => { const o = osm.find((e) => (e.tags.name || '').replace(/‎|‏/g, '') === osmName); if (!o) throw new Error(osmName); return { lat: o.lat, lon: o.lon, tags: { name: ar, 'name:en': o.tags['name:en'] || o.tags.name, extra: 'osm' } }; };
const X = [
  like('عيتا الجبل', 'عيتا الجبل الزط'),
  like('حناويه', 'حناوي'),
  like('رشكانانية', 'رشكنانية'),
  like('عدشيت', 'عدشيت'),
  ...['قلاوية', 'قلاويه', 'قلاوي'].map((n) => at(n, 'Qalaouiyeh', 33.25471, 35.41791)),
  ...['برج قلاوية', 'برج قلاويه', 'برج قلاوي'].map((n) => at(n, 'Borj Qalaouiyeh', 33.26088, 35.41993)),
  at('السماعية', 'Smaiyeh', 33.21986, 35.23636),
  at('عيناثا', 'Ainata', 33.12905, 35.43989),
  at('كوثرية الرز', 'Kawtharit al-Rizz', 33.37214, 35.30994),
  at('صير الغربية', 'Sir al-Gharbiyeh', 33.32044, 35.36323),
  at('العزية', 'Azziyeh', 33.17702, 35.22671),
  at('قليا', 'Qelia', 33.43694, 35.65556),
  at('زلايا', 'Zellaya', 33.45917, 35.66667),
  at('يحمر البقاع', 'Yohmor al-Beqaa', 33.48528, 35.66889),
  at('المالكية', 'Malkiyeh', 33.20996, 35.24676),
  at('قاقعية الجسر', 'Qaqaiyet al-Jisr', 33.3256, 35.42448),
  at('كفرمان', 'Kfar Roummane', 33.38908, 35.50181),
  at('دوحة كفررمان', 'Kfar Roummane', 33.38908, 35.50181),
  at('دوحة كفرمان', 'Kfar Roummane', 33.38908, 35.50181),
  at('جديدة مرجعيون', 'Marjayoun', 33.36028, 35.59111),
  at('مرجعيون', 'Marjayoun', 33.36028, 35.59111),
  at('الراشيدية', 'Rashidieh', 33.24222, 35.21417),
  at('الرشيدية', 'Rashidieh', 33.24222, 35.21417),
  at('العاقبية', 'Mazraat al-Aaqbiyeh', 33.46701, 35.3178),
  at('سهل الخيام', 'Khiam', 33.3333, 35.6167),
  at('القصيبة', 'Qsaibeh', 33.33294, 35.39728),
];
// Khiam from OSM rather than a guess.
const kh = osm.find((e) => e.tags.name === 'الخيام'); if (kh) { const x = X.find((e) => e.tags.name === 'سهل الخيام'); x.lat = kh.lat; x.lon = kh.lon; }
fs.writeFileSync('osm-lb.json', JSON.stringify({ elements: [...osm, ...X] }));
console.log(osm.length, X.length, !!kh);

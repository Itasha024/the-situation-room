import { DeskDoc } from "@/components/desk-doc";
import { Box, ExplainerSection, GUIDE_CSS, Row, ar, catId, type Explainer } from "@/components/guide-kit";
import data from "../../public/yemen-explain.json";

/**
 * The Yemen desk's guide page: who is who, who holds what, the words, then every explainer in full under its
 * category (public/yemen-explain.json), so the desk's Explainers panel can link to a section. The explainers hold
 * the background before the Timeline (1990) and the standing facts; the Timeline tells the war's course.
 */
const AS_OF = "26 October 2026";
const CATS = ["Who's who", "History", "The war at sea", "Economy"];
const ITEMS = (data as { items: Explainer[] }).items;

/* The camps in the map's own colours: Houthi orange, government green, contested yellow. */
const LOCAL_CSS = `
.pg-box.houthi{--tone:#c45c26}.pg-box.gov{--tone:#22c55e}.pg-box.south{--tone:#38bdf8}.pg-box.islah{--tone:#a855f7}
.pg-box.west{--tone:#3b82f6}.pg-box.aqap{--tone:#64748b}.pg-box.saudi{--tone:#15803d}.pg-box.uae{--tone:#ef4444}.pg-box.iran{--tone:#eab308}
.yg-camps{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.yg-camp{padding:8px;border:1px dashed var(--pg-line);border-radius:6px}
.yg-camp>.pg-label,.yg-label{display:block;margin:0 0 8px;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--pg-dim);text-align:center}
.yg-camp .pg-box{max-width:none}
.yg-dot{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px;vertical-align:-1px}
@media (max-width:640px){.yg-camps{grid-template-columns:1fr}}
`;

const SIDE = {
  houthi: { name: "Houthis", color: "#c45c26" },
  gov: { name: "Government", color: "#22c55e" },
  contested: { name: "Contested", color: "#e9c46a" },
  mixed: { name: "Mixed", color: "#e9c46a" },
} as const;

/** Who holds which part of the country, as on the desk's map on the date above. */
const HOLD: { area: string; side: keyof typeof SIDE; note: string }[] = [
  { area: "Sanaa city and Sanaa governorate", side: "houthi", note: "The Houthis' capital and the seat of their institutions" },
  { area: "Saada", side: "houthi", note: "The movement's home ground, on the Saudi border" },
  { area: "Amran, Hajjah, Al-Mahwit, Raymah", side: "houthi", note: "The north-western highlands and part of the Saudi border" },
  { area: "Dhamar, Ibb", side: "houthi", note: "The central highlands; Ibb is among the most crowded governorates" },
  { area: "Hodeidah", side: "houthi", note: "The north's main Red Sea port, with Ras Isa and Salif" },
  { area: "Mocha coast, Mayun (Perim), the Hanish islands, Kamaran", side: "houthi", note: "Taken on the west coast and at Bab al-Mandab in September 2026" },
  { area: "Taiz", side: "contested", note: "The city is government-held; the west of the governorate is a front" },
  { area: "Marib", side: "contested", note: "The government's oil and gas stronghold, under Houthi pressure" },
  { area: "Al-Jawf, Al-Bayda", side: "contested", note: "Active fronts in the north-east and the centre" },
  { area: "Lahj, Al-Dhale", side: "mixed", note: "The southern fronts north of Aden and towards Bab al-Mandab" },
  { area: "Aden", side: "gov", note: "Seat of the Presidential Leadership Council and the government" },
  { area: "Abyan, Shabwa", side: "gov", note: "The south coast and an oil and gas region; AQAP is active here" },
  { area: "Hadramawt, Al-Mahra", side: "gov", note: "The largest governorate and the main oil region; the east, on the Omani and Saudi borders" },
  { area: "Socotra", side: "gov", note: "The island in the Arabian Sea" },
];

const TERMS: [string, string, string][] = [
  ["Ansar Allah (“Supporters of God”)", "أنصار الله", "The Houthi movement's own name"],
  ["The Houthis", "الحوثيون", "After the al-Houthi family that leads the movement"],
  ["Zaydi, Zaydism", "الزيدية", "The branch of Shia Islam of northern Yemen"],
  ["The Scream", "الصرخة", "The Houthi motto: “death to America, death to Israel…”"],
  ["Supreme Political Council", "المجلس السياسي الأعلى", "The Houthis' ruling council in Sanaa"],
  ["Presidential Leadership Council (PLC)", "مجلس القيادة الرئاسي", "The eight men who hold the recognised president's powers"],
  ["Southern Transitional Council (STC)", "المجلس الانتقالي الجنوبي", "The southern separatists; its dissolution is disputed"],
  ["Southern Movement (al-Hirak)", "الحراك الجنوبي", "The wider southern protest movement the STC came from"],
  ["Islah (“Reform”)", "التجمع اليمني للإصلاح", "The Sunni Islamist party"],
  ["General People's Congress", "المؤتمر الشعبي العام", "Ali Abdullah Saleh's party, now split between the camps"],
  ["Giants Brigades", "ألوية العمالقة", "Southern, largely Salafi units"],
  ["National Resistance", "المقاومة الوطنية", "Tareq Saleh's forces on the west coast"],
  ["AQAP", "تنظيم القاعدة في جزيرة العرب", "Al-Qaeda in the Arabian Peninsula"],
  ["Bab al-Mandab (“Gate of Tears”)", "باب المندب", "The strait at the Red Sea's southern end"],
];

export function YemenGuide() {
  return (
    <DeskDoc
      title="Who is who in Yemen's war"
      lede={<>The two camps and their leaders, who holds which part of the country, the words you will meet, and the background: Yemen's history before 1990, the war at sea and the economy. Correct as of {AS_OF}; the desk's Timeline tells the war's course and its reports carry what changes.</>}
      back={{ href: "/yemen-conflict-desk", label: "Back to the Yemen desk" }}
    >
      <style>{GUIDE_CSS + LOCAL_CSS}</style>
      <div className="pg">
        <ul className="pg-toc">
          {CATS.map((c) => (
            <li key={c}>
              <a href={`#${catId(c)}`}>{c}</a>
            </li>
          ))}
        </ul>

        <h3 id={catId("Who's who")}>Who's who</h3>
        <ul>
          <li><b>Two governments.</b> The Houthis rule Sanaa and the north-west, where most Yemenis live. The internationally recognised government rules the south and east from Aden.</li>
          <li><b>Two sets of backers.</b> Iran arms the Houthis. Saudi Arabia backs and pays for the government; the UAE backed the southern forces until its troops left in January 2026.</li>
          <li><b>The government's camp is a coalition.</b> Each member of its eight-man council brings his own force or region.</li>
        </ul>

        <h4>The two camps</h4>
        <div className="pg-chart" role="img" aria-label="The Houthi camp and the recognised government's camp, their leaders and backers">
          <div className="yg-camps">
            <div className="yg-camp">
              <span className="pg-label">The Houthis (Ansar Allah) · Sanaa</span>
              <Row><Box tone="houthi wide" name="Abdul-Malik al-Houthi" sub="Leader of the movement since 2004; holds no state post" /></Row>
              <Row><Box tone="houthi wide" name="Supreme Political Council" sub="Head: Mahdi al-Mashat. Acts as the head of state in Sanaa" /></Row>
              <Row down={false}>
                <Box tone="houthi" name="Government in Sanaa" sub="Acting prime minister Muhammad Miftah, since August 2025" />
                <Box tone="houthi" name="Armed forces" sub="Chief of staff Yusuf al-Madani, since October 2025" />
                <Box tone="houthi" name="Military spokesman" sub="Yahya Saree" />
                <Box tone="houthi" name="Chief negotiator" sub="Mohammed Abdulsalam, in Muscat" />
              </Row>
              <span className="yg-label" style={{ marginTop: 10 }}>Backed by</span>
              <Row down={false}><Box tone="iran wide" name="Iran" sub="Missile and drone designs, parts, training; with Hezbollah" /></Row>
            </div>
            <div className="yg-camp">
              <span className="pg-label">The recognised government · Aden</span>
              <Row><Box tone="gov wide" name="Rashad al-Alimi" sub="Chairman of the Presidential Leadership Council (PLC)" /></Row>
              <Row>
                <Box tone="west" name="Tareq Saleh" sub="National Resistance; the west coast" />
                <Box tone="islah" name="Sultan al-Arada" sub="Governor of Marib; close to Islah" />
                <Box tone="islah" name="Abdullah al-Alimi Bawazeer" sub="Close to Islah; from Shabwa" />
                <Box tone="south" name="Abu Zaraa al-Mahrami" sub="Giants Brigades; the south" />
                <Box tone="gov" name="Othman Mujalli" sub="Tribal leader from Saada; Saleh's old party" />
                <Box tone="south" name="Mahmoud al-Subaihi" sub="Former defence minister; member since January 2026" />
                <Box tone="gov" name="Salem al-Khanbashi" sub="From Hadramawt; member since January 2026" />
              </Row>
              <Row down={false}><Box tone="gov wide" name="Prime minister Shaya al-Zindani" sub="Since January 2026; the government sits in Aden, its leaders often in Riyadh" /></Row>
              <span className="yg-label" style={{ marginTop: 10 }}>Backed by</span>
              <Row down={false}><Box tone="saudi wide" name="Saudi Arabia" sub="Leads the coalition; the government's main backer and paymaster" /></Row>
            </div>
          </div>
          <div className="pg-group" style={{ marginTop: 12 }}>
            <span className="pg-label">The other forces</span>
            <Box tone="south" name="STC" sub="Southern Transitional Council; wants a southern state. Dissolution announced in Riyadh in January 2026, rejected by its Abu Dhabi spokesman; Aidarous al-Zubaidi is in the UAE" />
            <Box tone="islah" name="Islah" sub="Sunni Islamist party, Muslim Brotherhood roots; strong in Marib and Taiz; inside the government camp" />
            <Box tone="west" name="National Resistance" sub="Tareq Saleh's forces; lost Mocha to the Houthis in September 2026" />
            <Box tone="south" name="Giants Brigades" sub="Southern, largely Salafi; formed with UAE support in 2015; Abu Zaraa al-Mahrami" />
            <Box tone="aqap" name="AQAP" sub="Al-Qaeda in the Arabian Peninsula; Saad bin Atef al-Awlaki; fights both camps in Abyan, Shabwa, Al-Bayda" />
          </div>
          <div className="pg-group" style={{ marginTop: 12 }}>
            <span className="pg-label">Outside powers</span>
            <Box tone="saudi" name="Saudi Arabia" sub="Backs the government; its air force strikes the north" />
            <Box tone="uae" name="UAE" sub="Armed the southern forces and the Giants; says its last troops left on 2 January 2026" />
            <Box tone="iran" name="Iran" sub="Arms and trains the Houthis" />
            <Box tone="" name="Oman" sub="Hosts the Houthi negotiators; go-between" />
          </div>
        </div>

        <h4>Who holds which part of the country</h4>
        <div className="pg-wrap">
          <table className="pg-table">
            <thead><tr><th>Governorate or area</th><th>Held by</th><th>Note</th></tr></thead>
            <tbody>
              {HOLD.map((h) => (
                <tr key={h.area}>
                  <td>{h.area}</td>
                  <td><span className="yg-dot" style={{ background: SIDE[h.side].color }} />{SIDE[h.side].name}</td>
                  <td>{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pg-note">As on the desk's map on {AS_OF}. By area the government holds more than half of Yemen; the Houthis hold about a third, with most of the people.</p>

        <h4>Words you will meet</h4>
        <div className="pg-wrap">
          <table className="pg-table">
            <thead><tr><th>English</th><th>Arabic</th><th>What it is</th></tr></thead>
            <tbody>
              {TERMS.map(([en, a, what]) => (
                <tr key={en}><td>{en}</td><td>{ar(a)}</td><td>{what}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {ITEMS.filter((e) => e.cat === "Who's who").map((e) => <ExplainerSection key={e.title} e={e} />)}

        {CATS.slice(1).map((c) => (
          <div key={c}>
            <h3 id={catId(c)}>{c}</h3>
            {ITEMS.filter((e) => e.cat === c).map((e) => <ExplainerSection key={e.title} e={e} />)}
          </div>
        ))}
      </div>
    </DeskDoc>
  );
}

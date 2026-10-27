import { DeskDoc } from "@/components/desk-doc";
import { Box, Callout, Chart, ExplainerSection, GUIDE_CSS, GuideBody, GuideHero, H3, Row, ar, catId, exToc, type Explainer, useLiveExplain, type Photo, type TocGroup } from "@/components/guide-kit";
import data from "../../public/yemen-explain.json";

const DESK = "/yemen-conflict-desk";
/* Photos from Wikimedia Commons, hot-linked, with their credit and licence (user, 26 Oct: "even photos"). */
const HERO: Photo = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Old_City_Market%2C_Sanaa_%2810035332343%29.jpg/1280px-Old_City_Market%2C_Sanaa_%2810035332343%29.jpg",
  alt: "The tower houses of Sanaa's Old City over its market",
  caption: "The Old City of Sanaa, a UNESCO World Heritage site, held by the Houthis since 2014.",
  credit: "Rod Waddington",
  licence: "CC BY-SA 2.0",
  page: "https://commons.wikimedia.org/wiki/File:Old_City_Market,_Sanaa_(10035332343).jpg",
};
const PHOTOS: Record<string, Photo> = {
  "Bab el-Mandeb and the sea lanes": {
    src: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Bab-el-Mandeb%2C_outer_space.jpg",
    alt: "The Bab el-Mandeb strait seen from the International Space Station, Yemen's coast on one side and Djibouti and Eritrea on the other",
    caption: "The Bab el-Mandeb from the International Space Station: the strait between the Red Sea and the Gulf of Aden, Yemen on one shore, Djibouti and Eritrea on the other.",
    credit: "NASA Johnson Space Center",
    licence: "Public domain",
    page: "https://commons.wikimedia.org/wiki/File:Bab-el-Mandeb,_outer_space.jpg",
    ratio: "4 / 3",
  },
};

/**
 * The Yemen desk's guide page: who is who, who holds what, the words, then every explainer in full under its
 * category (public/yemen-explain.json), so the desk's Explainers panel can link to a section. The explainers hold
 * the background before the Timeline (1990) and the standing facts; the Timeline tells the war's course.
 */
/** The map's note is as of the day the guide was written. */
const MAP_AS_OF = "26 October 2026";
const CATS = ["Who's who", "History", "The war at sea", "Economy"];
const ITEMS = (data as { items: Explainer[] }).items;

/* The camps in the map's own colours: Houthi orange, government green, contested yellow. */
const LOCAL_CSS = `
.pg .houthi{--tone:#e8761f}.pg .gov{--tone:#22c55e}.pg .south{--tone:#38bdf8}.pg .islah{--tone:#a855f7}
.pg .west{--tone:#3b82f6}.pg .aqap{--tone:#64748b}.pg .saudi{--tone:#15803d}.pg .uae{--tone:#ef4444}.pg .iran{--tone:#eab308}.pg .oman{--tone:#94a3b8}
.yg-camps{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.yg-camp{padding:12px;border:1px solid color-mix(in srgb,var(--tone) 35%,var(--pg-line));border-top:3px solid var(--tone);border-radius:6px;background:color-mix(in srgb,var(--tone) 5%,var(--pg-panel))}
.yg-camp>.pg-label,.yg-label{display:block;margin:0 0 10px;font:700 12px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:var(--pg-dim);text-align:center}
.yg-camp>.pg-label{color:color-mix(in srgb,var(--tone) 70%,var(--pg-strong));font-size:13px}
.yg-camp .pg-box{max-width:none}
.yg-dot{display:inline-block;width:10px;height:10px;margin-right:7px;border-radius:2px;vertical-align:-1px}@media (max-width:640px){.yg-camps{grid-template-columns:1fr}}
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

const TOC: TocGroup[] = [
  ...CATS.map((c) => ({
    title: c,
    cat: c,
    items: [
      ...(c === "Who's who" ? [{ id: "pg-camps", label: "The two camps" }, { id: "pg-hold", label: "Who holds what" }] : []),
      ...exToc(ITEMS.filter((e) => e.cat === c)),
    ],
  })),
  { title: "Reference", items: [{ id: "pg-words", label: "Words you will meet" }] },
];

export function YemenGuide() {
  const live = useLiveExplain("yemen", data as { asOf: string; items: Explainer[] });
  return (
    <DeskDoc guide back={{ href: DESK, label: "Back to the Yemen desk" }}>
      <style>{GUIDE_CSS + LOCAL_CSS}</style>
      <div className="pg">
        <GuideHero
          kicker="Yemen desk · The guide"
          title="Who is who in Yemen's war"
          standfirst="The two camps and their leaders, who holds which part of the country, and the background to the war."
          asOf={live.asOf}
          accent="#ce1126"
          photo={HERO}
        />
        <GuideBody toc={TOC}>
        <H3 id={catId("Who's who")} cat="Who's who">Who's who</H3>
        <Callout label="The short version">
        <ul>
          <li><b>Two governments.</b> The Houthis rule Sanaa and the north-west, where most Yemenis live. The internationally recognised government rules the south and east from Aden.</li>
          <li><b>Two sets of backers.</b> Iran arms the Houthis. Saudi Arabia backs and pays for the government; the UAE backed the southern forces until its troops left in January 2026.</li>
          <li><b>The government's camp is a coalition.</b> Each member of its eight-man council brings his own force or region.</li>
        </ul>
        </Callout>

        <h4 id="pg-camps">The two camps</h4>
        <Chart
          label="The Houthi camp and the recognised government's camp, their leaders and backers"
          title="The two camps, their leaders and their backers"
          legend={[["houthi", "Houthis"], ["gov", "Government"], ["islah", "Close to Islah"], ["south", "The south"], ["west", "West coast"], ["aqap", "AQAP"], ["iran", "Iran"], ["saudi", "Saudi Arabia"], ["uae", "UAE"]]}
        >
          <div className="yg-camps">
            <div className="yg-camp houthi">
              <span className="pg-label">The Houthis (Ansar Allah) · Sanaa</span>
              <Row><Box tone="houthi wide" person name="Abdul-Malik al-Houthi" sub="Leader of the movement since 2004; holds no state post" /></Row>
              <Row><Box tone="houthi wide" ic="body" name="Supreme Political Council" sub="Head: Mahdi al-Mashat. Acts as the head of state in Sanaa" /></Row>
              <Row down={false}>
                <Box tone="houthi" person="Muhammad Miftah" name="Government in Sanaa" sub="Acting prime minister Muhammad Miftah, since August 2025" />
                <Box tone="houthi" person="Yusuf al-Madani" name="Armed forces" sub="Chief of staff Yusuf al-Madani, since October 2025" />
                <Box tone="houthi" person="Yahya Saree" name="Military spokesman" sub="Yahya Saree" />
                <Box tone="houthi" person="Mohammed Abdulsalam" name="Chief negotiator" sub="Mohammed Abdulsalam, in Muscat" />
              </Row>
              <span className="yg-label" style={{ marginTop: 10 }}>Backed by</span>
              <Row down={false}><Box tone="iran wide" name="Iran" sub="Missile and drone designs, parts, training; with Hezbollah" /></Row>
            </div>
            <div className="yg-camp gov">
              <span className="pg-label">The recognised government · Aden</span>
              <Row><Box tone="gov wide" person name="Rashad al-Alimi" sub="Chairman of the Presidential Leadership Council (PLC)" /></Row>
              <Row>
                <Box tone="west" person name="Tareq Saleh" sub="National Resistance; the west coast" />
                <Box tone="islah" person name="Sultan al-Arada" sub="Governor of Marib; close to Islah" />
                <Box tone="islah" person name="Abdullah al-Alimi Bawazeer" sub="Close to Islah; from Shabwa" />
                <Box tone="south" person name="Abu Zaraa al-Mahrami" sub="Giants Brigades; the south" />
                <Box tone="gov" person name="Othman Mujalli" sub="Tribal leader from Saada; Saleh's old party" />
                <Box tone="south" person name="Mahmoud al-Subaihi" sub="Former defence minister; member since January 2026" />
                <Box tone="gov" person name="Salem al-Khanbashi" sub="From Hadramawt; member since January 2026" />
              </Row>
              <Row down={false}><Box tone="gov wide" person="Shaya al-Zindani" name="Prime minister Shaya al-Zindani" sub="Since January 2026; the government sits in Aden, its leaders often in Riyadh" /></Row>
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
            <Box tone="oman" name="Oman" sub="Hosts the Houthi negotiators; go-between" />
          </div>
        </Chart>

        <h4 id="pg-hold">Who holds which part of the country</h4>
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
        <p className="pg-note">As on the desk's map on {MAP_AS_OF}. By area the government holds more than half of Yemen; the Houthis hold about a third, with most of the people.</p>

        {live.items.filter((e) => e.cat === "Who's who").map((e) => <ExplainerSection key={e.title} e={e} desk={DESK} photo={PHOTOS[e.title]} />)}

        {CATS.slice(1).map((c) => (
          <div key={c}>
            <H3 id={catId(c)} cat={c}>{c}</H3>
            {live.items.filter((e) => e.cat === c).map((e) => <ExplainerSection key={e.title} e={e} desk={DESK} photo={PHOTOS[e.title]} />)}
          </div>
        ))}

        <H3 id="pg-words" cat="Reference" kicker="Reference">Words you will meet</H3>
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
        </GuideBody>
      </div>
    </DeskDoc>
  );
}

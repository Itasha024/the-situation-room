import { DeskDoc } from "@/components/desk-doc";
import { Box, Callout, Chart, GUIDE_CSS as CSS, GuideBody, GuideHero, H3, Row, ar, he, catId, exToc, ExplainerSection, type Explainer, type Photo, type TocGroup } from "@/components/guide-kit";
import data from "../../public/gaza-explain.json";

const items = (data as { items: Explainer[] }).items;
const cats = [...new Set(items.map((e) => e.cat || "Background"))];
const DESK = "/gaza-judea-samaria-desk";

/* Photos from Wikimedia Commons, hot-linked, with their credit and licence (user, 26 Oct: "even photos"). */
const HERO: Photo = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Ramallah_Muqata%27a_2013.jpg/1280px-Ramallah_Muqata%27a_2013.jpg",
  alt: "The walled Muqataa compound in Ramallah, its buildings and flagpoles seen from above the street",
  caption: "The Muqataa in Ramallah, the PA president's compound and the seat of the Palestinian leadership in Judea and Samaria, in January 2013.",
  credit: "PalestinianLiberator",
  licence: "CC BY-SA 3.0",
  page: "https://commons.wikimedia.org/wiki/File:Ramallah_Muqata%27a_2013.jpg",
};
const PHOTOS: Record<string, Photo> = {
  "Jerusalem and the Temple Mount status quo": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Jerusalem-2013-Aerial-Temple_Mount_01.jpg/960px-Jerusalem-2013-Aerial-Temple_Mount_01.jpg",
    alt: "Aerial view of the Temple Mount compound in Jerusalem's Old City at sunset, with the Dome of the Rock",
    caption: "The Temple Mount (al-Haram al-Sharif) in Jerusalem's Old City, from the air: the Dome of the Rock at its centre, the al-Aqsa mosque to the south.",
    credit: "Godot13",
    licence: "CC BY-SA 4.0",
    page: "https://commons.wikimedia.org/wiki/File:Jerusalem-2013-Aerial-Temple_Mount_01.jpg",
  },
  "The disengagement from Gaza": {
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Gaza_Strip_NASA.PNG",
    alt: "Satellite image of the Gaza Strip on the Mediterranean coast, between Israel and Egypt's Sinai",
    caption: "The Gaza Strip from space: some 41 km long and 6 to 12 km wide, between Israel and Egypt's Sinai.",
    credit: "NASA",
    licence: "Public domain",
    page: "https://commons.wikimedia.org/wiki/File:Gaza_Strip_NASA.PNG",
    ratio: "5 / 4",
  },
};

const TOC: TocGroup[] = [
  { title: "The structure", items: [["short", "In short"], ["map", "Who sits where"], ["plo", "The PLO"], ["pa", "The PA"], ["security", "Security services"], ["fatah", "Fatah and the Tanzim"], ["hamas", "Hamas"], ["pij", "Islamic Jihad"], ["others", "Other factions"]].map(([id, label]) => ({ id: `pg-${id}`, label })) },
  { title: "Politics and money", items: [["elections", "Elections"], ["split", "The split"], ["money", "Money"], ["areas", "Areas A, B, C"]].map(([id, label]) => ({ id: `pg-${id}`, label })) },
  ...cats.map((c) => ({ title: c, cat: c, items: [...exToc(items.filter((e) => (e.cat || "Background") === c))] })),
  { title: "Reference", items: [{ id: "pg-words", label: "Words you will meet" }] },
];

/**
 * The guide to the Palestinian side (user, 26 Oct: "the pa mechanisms, tanzim etc, literally everything to
 * reflect the full picture clearly"). Static: facts as of the date in the lede; the desk's reports carry
 * what changes. The desk's words apply here too (Judea and Samaria, Israeli citizens).
 */
const AS_OF = "26 October 2026";

export function PaGuide() {
  return (
    <DeskDoc guide back={{ href: DESK, label: "Back to the Gaza – Judea & Samaria desk" }}>
      <style>{CSS}</style>
      <div className="pg">
        <GuideHero
          kicker="Gaza – Judea & Samaria desk · The guide"
          title="How the Palestinian side is built"
          standfirst="The PLO, the Palestinian Authority and its security services, Fatah and the Tanzim, Hamas, Islamic Jihad and the other factions, the elections and the money, and the background from Oslo to 2023. The desk's reports carry what changes."
          asOf={AS_OF}
          accent="#3b82f6"
          photo={HERO}
          desk={{ href: DESK, name: "Gaza – Judea & Samaria" }}
          facts={[
            { v: "3 posts", l: "Abbas heads the PLO, the PA and Fatah" },
            { v: "2006", l: "Last national election" },
            { v: "11 Sep 2027", l: "Next presidential and legislative vote" },
            { v: "18 · 22 · 60%", l: "Areas A · B · C of Judea and Samaria" },
          ]}
        />
        <GuideBody toc={TOC}>

        <H3 id="pg-short" cat="The structure" kicker="The structure">In short</H3>
        <Callout label="The short version" icon="info">
        <ul>
          <li><b>Three layers, one man at the top.</b> Mahmoud Abbas (Abu Mazen) heads the PLO, the Palestinian Authority and Fatah at once.</li>
          <li><b>The PLO</b> speaks for all Palestinians abroad and signed the Oslo Accords. <b>The PA</b> is the body Oslo set up to run the cities of Judea and Samaria (and, until 2007, Gaza). <b>Fatah</b> is the largest party in both.</li>
          <li><b>Hamas and Islamic Jihad are outside the PLO.</b> Hamas won the 2006 election and took Gaza by force in 2007. Since then Fatah has run the PA in Judea and Samaria and Hamas has run Gaza.</li>
          <li><b>Nobody has been elected nationally since 2006.</b> Presidential and legislative elections are now set for 11 September 2027.</li>
        </ul>
        </Callout>

        <H3 id="pg-map" cat="The structure" kicker="The structure">Who sits where</H3>
        <Chart
          label="The PLO and its factions, the PA, and the factions outside the PLO"
          title="The Palestinian factions, inside and outside the PLO"
          legend={[["plo", "PLO and PA"], ["fatah", "Fatah"], ["left", "The left"], ["hamas", "Hamas"], ["pij", "Islamic Jihad"], ["arm", "Armed groups"], ["clan", "Clans and militias"]]}
        >
          <Row>
            <Box tone="plo wide" person name="Mahmoud Abbas" sub="Chairman of the PLO · President of the PA (State of Palestine) · Head of Fatah" />
          </Row>
          <Row down={false}>
            <div className="pg-group">
              <span className="pg-label">Inside the PLO</span>
              <Box tone="fatah" name="Fatah" sub="“Conquest”, its initials reversed; the largest; runs the PA" />
              <Box tone="left" name="PFLP" sub="Popular Front; left; often boycotts PLO meetings" />
              <Box tone="left" name="DFLP" sub="Democratic Front; left" />
              <Box tone="left" name="Smaller groups" sub="People's Party, FIDA, the PLF, the Arab Liberation Front, As-Sa'iqa and others" />
            </div>
            <div className="pg-group">
              <span className="pg-label">Outside the PLO</span>
              <Box tone="hamas" name="Hamas" sub="“Zeal”, the initials of the Islamic Resistance Movement; runs Gaza since 2007; Qassam Brigades" />
              <Box tone="pij" name="Islamic Jihad" sub="Closest to Iran; Saraya al-Quds (“the Jerusalem Brigades”); boycotts PA elections, as it rejects the Oslo accords" />
              <Box tone="arm" name="Armed groups" sub="Popular Resistance Committees, Mujahideen Brigades, local battalions in Judea and Samaria" />
              <Box tone="clan" name="Gaza clans and militias" sub="Armed families and anti-Hamas groups such as the Popular Forces" />
            </div>
          </Row>
        </Chart>

        <H3 id="pg-plo" cat="The structure" kicker="The structure">The PLO (Palestine Liberation Organization)</H3>
        <p>Founded in 1964; recognised by Israel in 1993 as the Palestinians' representative. Its bodies, from the widest to the one that decides:</p>
        <Chart label="The PLO's bodies" title="The PLO, from the widest body to the one that decides">
          <Row><Box tone="plo wide" ic="people" name="Palestinian National Council (PNC)" sub={<>The PLO's parliament, some 700+ members, appointed by faction quotas. {ar("المجلس الوطني الفلسطيني")}</>} /></Row>
          <Row><Box tone="plo wide" name="Central Council" sub={<>Acts for the PNC between its rare sessions. {ar("المجلس المركزي")}</>} /></Row>
          <Row down={false}><Box tone="plo wide" name="Executive Committee" sub={<>The PLO's government. Chairman: Mahmoud Abbas. Deputy chairman and secretary: Hussein al-Sheikh. {ar("اللجنة التنفيذية")}</>} /></Row>
        </Chart>
        <p>The PNC has never been elected directly. Abbas set its first direct vote, for Palestinians abroad, for 1 November 2026; members of the Legislative Council are to sit in it for those at home.</p>

        <H3 id="pg-pa" cat="The structure" kicker="The structure">The Palestinian Authority (the “State of Palestine”)</H3>
        <p>Set up under the Oslo Accords in 1994 as a five-year interim body. It now calls itself the State of Palestine, which some 150 countries recognise.</p>
        <Chart label="The Palestinian Authority" title="The Palestinian Authority" legend={[["pa", "The PA's civil side"], ["sec", "Security services"]]}>
          <Row><Box tone="pa wide" person="Mahmoud Abbas" name="President: Mahmoud Abbas" sub="Elected January 2005 for four years; no election since. Rules by decree." /></Row>
          <Row>
            <Box tone="pa" person="Hussein al-Sheikh" name="Vice president" sub="Hussein al-Sheikh, named April 2025; Abbas's likely stand-in" />
            <Box tone="pa" person="Mohammad Mustafa" name="Prime minister and government" sub="Mohammad Mustafa, since March 2024; ministries in Ramallah" />
            <Box tone="sec" name="Security services" sub="Answer to the president (below)" />
          </Row>
          <Row down={false}>
            <Box tone="pa" ic="ballot" name="Legislative Council (PLC)" sub="Elected 2006 (Hamas 74 of 132 seats); stopped meeting in 2007; dissolved by Abbas in 2018. Next: 200 seats" />
            <Box tone="pa" ic="scale" name="Courts" sub="Constitutional Court (2016) and the ordinary courts; the PA's Basic Law stands as its constitution" />
            <Box tone="pa" ic="ballot" name="Central Elections Commission" sub={<>Runs every vote; Ramallah. {ar("لجنة الانتخابات المركزية")}</>} />
          </Row>
        </Chart>
        <p>The PA governs the cities and towns of Judea and Samaria (Areas A and B). It has not governed Gaza since 2007; the Trump plan of October 2025 gives Gaza to a Palestinian committee of technocrats under the Board of Peace, with a reformed PA to take over later.</p>

        <H3 id="pg-security" cat="The structure" kicker="The structure">The security services ({he("המנגנונים")} · {ar("الأجهزة الأمنية")})</H3>
        <p>Tens of thousands of men in Judea and Samaria, the PA's largest payroll. The president is their supreme commander. They work only in Area A (and with Israel's consent beyond it), and coordinate with the IDF through liaison offices (“security coordination”, {ar("التنسيق الأمني")}).</p>
        <Chart label="The PA security services and whom they answer to" title="The PA's security services and whom they answer to">
          <Row><Box tone="sec wide" ic="person" name="The president, supreme commander" /></Row>
          <Row down={false}>
            <div className="pg-group">
              <span className="pg-label">Answer to the president</span>
              <Box tone="sec" name="General Intelligence" sub={<>Intelligence at home and abroad; long led by Majed Faraj. {ar("المخابرات العامة")}</>} />
              <Box tone="sec" name="Presidential Guard" sub={<>Guards the president and sites; once Arafat's Force 17. {ar("الحرس الرئاسي")}</>} />
              <Box tone="sec" name="National Security Forces" sub={<>The largest; a gendarmerie in camps and at entrances to cities; the raids on armed groups (Jenin, 2024–25). {ar("الأمن الوطني")}</>} />
              <Box tone="sec" name="Military Intelligence" sub={<>Watches the services' own men; arrests. {ar("الاستخبارات العسكرية")}</>} />
            </div>
            <div className="pg-group">
              <span className="pg-label">Under the Interior Ministry</span>
              <Box tone="sec" name="Preventive Security" sub={<>Internal security; the service that arrests Hamas and Islamic Jihad members. {ar("الأمن الوقائي")}</>} />
              <Box tone="sec" name="Civil Police" sub={<>Crime, traffic, public order. {ar("الشرطة")}</>} />
              <Box tone="sec" name="Civil Defence" sub={<>Fire and rescue. {ar("الدفاع المدني")}</>} />
            </div>
          </Row>
        </Chart>
        <p className="pg-note">In Gaza, Hamas has its own: the Interior Ministry's police and Internal Security, and the Qassam Brigades.</p>

        <H3 id="pg-fatah" cat="The structure" kicker="The structure">Fatah and the Tanzim</H3>
        <p>Founded by Yasser Arafat in 1959; the backbone of the PLO and the PA. Its 8th General Conference (May 2026) kept Abbas as leader and elected its bodies.</p>
        <Chart label="Fatah's bodies" title="Fatah's bodies" legend={[["fatah", "Fatah"], ["arm", "Armed cells"]]}>
          <Row><Box tone="fatah wide" ic="people" name="General Conference" sub={<>Elects the leadership every few years; 8th held 14–18 May 2026, about 2,600 members. {ar("المؤتمر العام")}</>} /></Row>
          <Row><Box tone="fatah" name="Central Committee" sub={<>18 elected; the leadership. May 2026 top vote-getters: Marwan Barghouti (from an Israeli prison), Majed Faraj, Jibril Rajoub, Hussein al-Sheikh. {ar("اللجنة المركزية")} · {he("הוועד המרכזי")}</>} />
            <Box tone="fatah" name="Revolutionary Council" sub={<>80 elected; Fatah's parliament. {ar("المجلس الثوري")} · {he("המועצה המהפכנית")}</>} /></Row>
          <Row down={false}>
            <Box tone="fatah" name="The Tanzim" sub={<>“The Organisation”: Fatah's field organisation in towns and camps; led by Marwan Barghouti in the second intifada. {ar("التنظيم")} · {he("התנזים")}</>} />
            <Box tone="fatah" name="Shabiba" sub={<>“The Youth”: students and youth. {ar("الشبيبة")}</>} />
            <Box tone="arm" name="Al-Aqsa Martyrs' Brigades" sub={<>Armed cells from Fatah's ranks since 2000; disowned by the PA, still active locally. {ar("كتائب شهداء الأقصى")}</>} />
          </Row>
        </Chart>
        <h4>Fatah's rival currents</h4>
        <div className="pg-chart-body pg-people">
          <Box tone="fatah" person name="Mohammed Dahlan" sub="Fatah's former Gaza strongman, expelled in 2011; leads the Democratic Reform Current from Abu Dhabi." />
          <Box tone="fatah" person name="Nasser al-Qudwa" sub="Arafat's nephew, expelled in 2021 after running his own list." />
          <Box tone="fatah" person name="Marwan Barghouti" sub="Serving five life terms in Israel since 2002; the most popular Fatah figure in polls." />
        </div>

        <H3 id="pg-hamas" cat="The structure" kicker="The structure">Hamas</H3>
        <p>The Islamic Resistance Movement, founded in Gaza in 1987 from the Muslim Brotherhood. Listed as a terrorist organisation by Israel, the US, the EU and others.</p>
        <Chart label="Hamas's bodies" title="Hamas's bodies" legend={[["hamas", "Hamas"], ["arm", "Armed wing"]]}>
          <Row><Box tone="hamas wide" ic="people" name="Shura Council" sub={<>“Consultation” council. Elected internally by members in four regions; chooses the leadership. {ar("مجلس الشورى")}</>} /></Row>
          <Row><Box tone="hamas wide" person="Khalil al-Hayya" name="Political Bureau" sub={<>Head: Khalil al-Hayya, elected July 2026 in a run-off against Khaled Meshaal (a five-man council led it after Yahya Sinwar's death in 2024). {ar("المكتب السياسي")}</>} /></Row>
          <Row down={false}>
            <Box tone="hamas" ic="map" name="Gaza" />
            <Box tone="hamas" person="Zaher Jabarin" name="Judea and Samaria" sub="Zaher Jabarin" />
            <Box tone="hamas" person="Khaled Meshaal" name="Abroad" sub="Khaled Meshaal; offices in Doha and Turkey" />
            <Box tone="hamas" ic="people" name="Prisoners" />
            <Box tone="arm wide" name="Qassam Brigades" sub={<>The armed wing; its spokesman “Abu Obeida”. Disarming it is the core of the Trump plan. {ar("كتائب القسام")}</>} />
          </Row>
        </Chart>

        <H3 id="pg-pij" cat="The structure" kicker="The structure">Palestinian Islamic Jihad</H3>
        <p>Founded 1981; smaller than Hamas, armed and funded mostly by Iran. Secretary-general: Ziad al-Nakhalah. Armed wing: Saraya al-Quds (the al-Quds Brigades), strong in Gaza and in the Jenin and Tulkarm camps. Rejects Oslo, the PA and elections.</p>

        <H3 id="pg-others" cat="The structure" kicker="The structure">Other factions and armed groups</H3>
        <div className="pg-wrap">
          <table className="pg-table">
            <thead><tr><th>Group</th><th>What it is</th><th>Armed wing</th></tr></thead>
            <tbody>
              <tr><td>PFLP</td><td>Marxist; second in the PLO; founded by George Habash</td><td>Abu Ali Mustafa Brigades</td></tr>
              <tr><td>DFLP</td><td>Left; Nayef Hawatmeh</td><td>National Resistance Brigades</td></tr>
              <tr><td>Popular Resistance Committees</td><td>Gaza; men from several factions</td><td>Al-Nasser Salah al-Din Brigades</td></tr>
              <tr><td>Mujahideen Movement</td><td>Gaza; Islamist</td><td>Mujahideen Brigades</td></tr>
              <tr><td>Palestinian National Initiative</td><td>Mustafa Barghouti; runs in elections</td><td>None</td></tr>
              <tr><td>Local battalions</td><td>Jenin, Tulkarm, Nur Shams, Nablus (“Lions' Den”): young men of every faction</td><td>Themselves</td></tr>
              <tr><td>Gaza clans and militias</td><td>Large armed families; anti-Hamas groups such as the Popular Forces east of Rafah and Khan Younis</td><td>Themselves</td></tr>
            </tbody>
          </table>
        </div>

        <H3 id="pg-elections" cat="Politics and money" kicker="Politics and money">Elections</H3>
        <div className="pg-wrap">
          <table className="pg-table">
            <thead><tr><th>Vote</th><th>Last held</th><th>Next</th></tr></thead>
            <tbody>
              <tr><td>President of the PA</td><td>January 2005 (Abbas, 62%)</td><td>11 September 2027</td></tr>
              <tr><td>Legislative Council</td><td>January 2006 (Hamas won)</td><td>11 September 2027, moved on 10 October 2026 from 28 November 2026; 200 seats, lists only, 1% threshold</td></tr>
              <tr><td>PNC (the PLO's parliament)</td><td>Never directly elected</td><td>Abroad: 1 November 2026, as announced</td></tr>
              <tr><td>Local councils</td><td>25 April 2026: Judea and Samaria, and Deir al-Balah, the first vote in Gaza since 2007</td><td>—</td></tr>
              <tr><td>Fatah (internal)</td><td>May 2026, 8th General Conference</td><td>—</td></tr>
              <tr><td>Hamas (internal)</td><td>July 2026, al-Hayya chosen</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <p>Elections called in 2021 were cancelled by Abbas, who cited Israel not allowing a vote in Jerusalem; the 2026 legislative vote was moved for the same kind of reason. Lists must accept the PLO's commitments, which Hamas and Islamic Jihad have refused in the past.</p>

        <H3 id="pg-split" cat="Politics and money" kicker="Politics and money">The split, and the attempts to end it</H3>
        <ul className="pg-time">
          <li><b>2006</b> Hamas wins the legislative election; a Hamas government is formed.</li>
          <li><b>June 2007</b> Hamas takes Gaza by force; Abbas dismisses its government. Two governments since.</li>
          <li><b>2011, 2017</b> Cairo agreements between Fatah and Hamas; not carried out.</li>
          <li><b>2014</b> Al-Shati agreement and a short-lived unity government.</li>
          <li><b>2021</b> Elections called, then cancelled.</li>
          <li><b>2022</b> Algiers Declaration. <b>July 2024</b> Beijing Declaration, 14 factions.</li>
          <li><b>October 2025</b> Ceasefire in Gaza under the Trump plan: Board of Peace, a Palestinian committee to run Gaza, a stabilisation force, Hamas to disarm.</li>
          <li><b>2026</b> Local elections (April), Fatah's conference (May), al-Hayya heads Hamas (July), national elections moved to September 2027 (October).</li>
          <li className="now"><b>Now</b> Follow it on the desk's reports, in the “Palestinian politics” section.</li>
        </ul>

        <H3 id="pg-money" cat="Politics and money" kicker="Politics and money">Money</H3>
        <Callout label="Key figure" icon="coins" tone="#3fae7a">
          <p><b>About two thirds</b> of the PA's income is clearance revenue that Israel collects and passes on.</p>
        </Callout>
        <ul>
          <li><b>Clearance revenues</b> ({ar("المقاصة")} · {he("כספי הסליקה")}): under the 1994 Paris Protocol Israel collects customs and VAT on goods bound for the PA and passes them on each month. They are about two thirds of the PA's income.</li>
          <li><b>Deductions:</b> Israel deducts sums matching the PA's payments to prisoners and attackers' families, its share for Gaza, and debts for electricity and water. Part of the money is held in Norway.</li>
          <li><b>Salaries:</b> with the money held back, the PA has paid its employees and security men only part of their wages for long stretches.</li>
        </ul>

        <H3 id="pg-areas" cat="Politics and money" kicker="Politics and money">Areas A, B and C (Oslo II, 1995)</H3>
        {/* The map's own colours for the areas (public/app.js OSLO_STYLE): A purple, B teal, C pink. */}
        <div className="pg-bar" role="img" aria-label="Area A about 18 percent, Area B about 22 percent, Area C about 60 percent of Judea and Samaria">
          <span style={{ width: "18%", background: "#c084fc" }}>A <small>18%</small></span>
          <span style={{ width: "22%", background: "#2dd4bf" }}>B <small>22%</small></span>
          <span style={{ width: "60%", background: "#f472b6" }}>C <small>60%</small></span>
        </div>
        <p className="pg-note">Shares of the land of Judea and Samaria, about; the colours are the desk map's.</p>
        <ul>
          <li><b>Area A</b> (~18%): the cities; PA civil rule and police. The IDF still raids there.</li>
          <li><b>Area B</b> (~22%): towns and villages; PA civil rule, Israeli security control.</li>
          <li><b>Area C</b> (~60%): Israel's full control; the Israeli communities, the Jordan Valley, the roads.</li>
          <li><b>Jerusalem</b>: Israel's; the PA is barred from acting there. <b>Gaza</b>: Hamas since 2007; the IDF holds the part behind the “yellow line” since October 2025.</li>
        </ul>

        {/* The background before 7 October 2023 (the desk's timeline starts there), in the Explainers panel's categories. */}
        {cats.map((c) => (
          <div key={c}>
            <H3 id={catId(c)} cat={c} kicker="Background">{c}</H3>
            {items.filter((e) => (e.cat || "Background") === c).map((e) => <ExplainerSection key={e.title} e={e} desk={DESK} photo={PHOTOS[e.title]} />)}
          </div>
        ))}

        <H3 id="pg-words" cat="Reference" kicker="Reference">Words you will meet</H3>
        <div className="pg-wrap">
          <table className="pg-table">
            <thead><tr><th>English</th><th>Arabic</th><th>Hebrew</th></tr></thead>
            <tbody>
              <tr><td>The security services</td><td>{ar("الأجهزة الأمنية")}</td><td>{he("המנגנונים")}</td></tr>
              <tr><td>The Tanzim (Arabic for “the Organisation”)</td><td>{ar("التنظيم")}</td><td>{he("התנזים")}</td></tr>
              <tr><td>The PLO (Palestine Liberation Organisation)</td><td>{ar("منظمة التحرير")}</td><td>{he("אש\"ף")}</td></tr>
              <tr><td>Security coordination</td><td>{ar("التنسيق الأمني")}</td><td>{he("תיאום ביטחוני")}</td></tr>
              <tr><td>Clearance revenues</td><td>{ar("أموال المقاصة")}</td><td>{he("כספי הסליקה")}</td></tr>
              <tr><td>Reconciliation</td><td>{ar("المصالحة")}</td><td>{he("הפיוס")}</td></tr>
              <tr><td>The split</td><td>{ar("الانقسام")}</td><td>{he("הפילוג")}</td></tr>
              <tr><td>Abbas (“Abu Mazen”, father of Mazen, his eldest son)</td><td>{ar("أبو مازن")}</td><td>{he("אבו מאזן")}</td></tr>
            </tbody>
          </table>
        </div>
        </GuideBody>
      </div>
    </DeskDoc>
  );
}

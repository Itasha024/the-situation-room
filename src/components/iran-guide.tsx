import { DeskDoc } from "@/components/desk-doc";
import { Box, ExplainerSection, GUIDE_CSS, Row, ar, catId, type Explainer } from "@/components/guide-kit";
import data from "../../public/iran-explain.json";

/**
 * The Iran desk's guide (user, 26 Oct): how the Islamic Republic is ruled, its armed forces and allies, with the
 * desk's explainers (public/iran-explain.json) under their categories. The explainers hold the background before
 * July 2015 and the standing facts; the desk's Timeline holds what happened from the 2015 deal on.
 */
const AS_OF = "26 October 2026";
const CATS = ["Who's who", "History", "Military", "Economy and society"];
const items = (data as { items: Explainer[] }).items;

const fa = (t: string) => <span dir="rtl" lang="fa">{t}</span>;

const LOCAL_CSS = `
.pg-box.leader{--tone:#eab308}.pg-box.cleric{--tone:#a16207}.pg-box.elected{--tone:#3b82f6}.pg-box.irgc{--tone:#16a34a}
.pg-box.artesh{--tone:#64748b}.pg-box.judiciary{--tone:#a855f7}.pg-box.snsc{--tone:#ef4444}
.pg-box.iran{--tone:#16a34a}.pg-box.hzb{--tone:#facc15}.pg-box.houthi{--tone:#f97316}.pg-box.iraq{--tone:#0ea5e9}
.pg-box.hamas{--tone:#22c55e}.pg-box.pij{--tone:#0f766e}.pg-box.gone{--tone:#475569;opacity:.7;border-style:dashed}
`;

export function IranGuide() {
  const cats = [...CATS, ...[...new Set(items.map((e) => e.cat || "Other"))].filter((c) => !CATS.includes(c))];
  return (
    <DeskDoc
      title="How Iran is ruled and fights"
      lede={<>The Supreme Leader and the councils, the Revolutionary Guards and the army, the allied groups Iran calls the axis of resistance, the nuclear programme, missiles and oil. Correct as of {AS_OF}; for what happened from the 2015 nuclear deal on, see the desk's Timeline.</>}
      back={{ href: "/iran-conflict-desk", label: "Back to the Iran desk" }}
    >
      <style>{GUIDE_CSS + LOCAL_CSS}</style>
      <div className="pg">
        <ul className="pg-toc">
          {cats.map((c) => (
            <li key={c}>
              <a href={`#${catId(c)}`}>{c}</a>
            </li>
          ))}
          <li><a href="#pg-power">Who holds power</a></li>
          <li><a href="#pg-axis">The axis</a></li>
          <li><a href="#pg-words">Words</a></li>
        </ul>

        {cats.map((c) => (
          <div key={c}>
            <h3 id={catId(c)}>{c}</h3>
            {c === "Who's who" ? <WhoCharts /> : null}
            {items.filter((e) => (e.cat || "Other") === c).map((e) => (
              <ExplainerSection key={e.title} e={e} />
            ))}
          </div>
        ))}
      </div>
    </DeskDoc>
  );
}

function WhoCharts() {
  return (
    <>
      <h4 id="pg-power">Who holds power</h4>
      <p>The unelected side, under the Supreme Leader, holds the guns, the courts and the vetting of candidates. The elected side runs the government and the budget within the limits it sets.</p>
      <div className="pg-chart" role="img" aria-label="The Islamic Republic's power structure, with the Supreme Leader at the top">
        <Row>
          <Box tone="leader wide" name={<>Supreme Leader {fa("رهبر")}</>} sub="Mojtaba Khamenei, since March 2026. For life; commands the armed forces, appoints the judiciary chief, military chiefs, state media and half the Guardian Council" />
        </Row>
        <Row>
          <div className="pg-group">
            <span className="pg-label">Clerical councils</span>
            <Box tone="cleric" name="Assembly of Experts" sub="88 clerics, elected for 8 years; chooses the leader. Chair: Mohammad-Ali Movahedi Kermani" />
            <Box tone="cleric" name="Guardian Council" sub="6 clerics (leader's) + 6 jurists; vets candidates, can veto laws. Head: Ahmad Jannati" />
            <Box tone="cleric" name="Expediency Council" sub="Settles parliament–Guardian Council disputes; advises the leader. Chair: Sadegh Amoli Larijani" />
            <Box tone="judiciary" name="Judiciary" sub="Head named by the leader: Gholam-Hossein Mohseni-Ejei, since 2021; includes the Revolutionary Courts" />
          </div>
        </Row>
        <Row>
          <div className="pg-group">
            <span className="pg-label">Armed forces · General Staff: Ali Abdollahi</span>
            <Box tone="irgc" name="Revolutionary Guards (IRGC)" sub="Commander: Ahmad Vahidi, since 1 March 2026. Answers to the leader">
              <small>Quds Force: operations and allies abroad; Esmail Qaani</small>
              <small>Basij: volunteer militia; Hossein Taeb</small>
              <small>Aerospace Force: most missiles and drones</small>
              <small>IRGC Navy: fast boats in the Gulf and Hormuz</small>
              <small>Ground Forces</small>
            </Box>
            <Box tone="artesh" name="Army (Artesh)" sub="The regular army, navy and air force, older than the revolution. Commander: Amir Hatami" />
          </div>
        </Row>
        <Row down={false}>
          <div className="pg-group">
            <span className="pg-label">The elected side</span>
            <Box tone="elected" name="President and government" sub="Masoud Pezeshkian, since July 2024; elected for 4 years. Foreign minister: Abbas Araghchi" />
            <Box tone="elected" name="Parliament (Majlis)" sub="290 seats, elected for 4 years; candidates vetted by the Guardian Council. Speaker: Mohammad Bagher Ghalibaf" />
            <Box tone="snsc" name="Supreme National Security Council" sub="Chaired by the president; sets defence and nuclear policy, subject to the leader. Secretary: Mohsen Rezaei, since August 2026" />
          </div>
        </Row>
      </div>
      <p className="pg-note">Voters elect the president, the Majlis and the Assembly of Experts, but only from candidates the Guardian Council approves.</p>

      <h4 id="pg-axis">The axis of resistance</h4>
      <div className="pg-chart" role="img" aria-label="Iran and its allied armed groups">
        <Row>
          <Box tone="iran wide" name="Iran: the Quds Force" sub="Weapons, money, training and advisers; each group keeps its own leaders and aims" />
        </Row>
        <Row down={false}>
          <Box tone="hzb" name="Hezbollah · Lebanon" sub="Founded 1982 with IRGC help; the strongest ally, a large rocket and missile arsenal. Leader: Naim Qassem" />
          <Box tone="houthi" name="Houthis (Ansar Allah) · Yemen" sub="Hold Sanaa and the north since 2014; Iranian missile and drone know-how; can hit Red Sea shipping" />
          <Box tone="iraq" name="Iraqi militias" sub="Kata'ib Hezbollah, Asa'ib Ahl al-Haq and others, many inside the state-paid Popular Mobilisation Forces" />
          <Box tone="hamas" name="Hamas · Gaza" sub="Sunni, from the Muslim Brotherhood; Iranian money and arms, but its own course" />
          <Box tone="pij" name="Islamic Jihad · Gaza" sub="The Palestinian group closest to Iran and most dependent on it" />
          <Box tone="gone" name="Assad's Syria (gone)" sub="The land route for arms to Lebanon, until Assad fell in December 2024" />
        </Row>
      </div>

      <h4 id="pg-words">Words you will meet</h4>
      <div className="pg-wrap">
        <table className="pg-table">
          <thead><tr><th>English</th><th>Original</th><th>What it is</th></tr></thead>
          <tbody>
            <tr><td>Supreme Leader (Rahbar)</td><td>{fa("رهبر معظم انقلاب")}</td><td>The top post, for life</td></tr>
            <tr><td>Guardianship of the jurist (velayat-e faqih)</td><td>{fa("ولایت فقیه")}</td><td>Khomeini's doctrine: a senior cleric rules over elected officials</td></tr>
            <tr><td>Assembly of Experts</td><td>{fa("مجلس خبرگان رهبری")}</td><td>Chooses the leader</td></tr>
            <tr><td>Guardian Council</td><td>{fa("شورای نگهبان")}</td><td>Vets candidates and laws</td></tr>
            <tr><td>Expediency Council</td><td>{fa("مجمع تشخیص مصلحت نظام")}</td><td>Settles disputes, advises the leader</td></tr>
            <tr><td>Majlis (parliament)</td><td>{fa("مجلس شورای اسلامی")}</td><td>The 290-seat parliament</td></tr>
            <tr><td>Supreme National Security Council</td><td>{fa("شورای عالی امنیت ملی")}</td><td>Security and nuclear policy</td></tr>
            <tr><td>Revolutionary Guards (Sepah)</td><td>{fa("سپاه پاسداران انقلاب اسلامی")}</td><td>The IRGC</td></tr>
            <tr><td>Quds Force</td><td>{fa("نیروی قدس")}</td><td>The IRGC's arm abroad</td></tr>
            <tr><td>Basij</td><td>{fa("بسیج")}</td><td>The IRGC's volunteer militia</td></tr>
            <tr><td>Artesh</td><td>{fa("ارتش")}</td><td>The regular army</td></tr>
            <tr><td>Khatam al-Anbiya</td><td>{fa("قرارگاه سازندگی خاتم‌الانبیاء")}</td><td>The IRGC's engineering and business arm</td></tr>
            <tr><td>Axis of resistance</td><td>{fa("محور مقاومت")} · {ar("محور المقاومة")}</td><td>Iran and its allied groups</td></tr>
            <tr><td>Hezbollah (“Party of God”)</td><td>{ar("حزب الله")}</td><td>Lebanon</td></tr>
            <tr><td>Ansar Allah (“Supporters of God”)</td><td>{ar("أنصار الله")}</td><td>The Houthis, Yemen</td></tr>
            <tr><td>Popular Mobilisation Forces</td><td>{ar("الحشد الشعبي")}</td><td>Iraq's state-paid militias</td></tr>
            <tr><td>Kata'ib Hezbollah</td><td>{ar("كتائب حزب الله")}</td><td>The Iraqi militia closest to the Quds Force</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

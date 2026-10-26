import type { ReactNode } from "react";
import { DeskDoc } from "@/components/desk-doc";

/**
 * The guide to the Palestinian side (user, 26 Oct: "the pa mechanisms, tanzim etc, literally everything to
 * reflect the full picture clearly"). Static: facts as of the date in the lede; the desk's reports carry
 * what changes. The desk's words apply here too (Judea and Samaria, Israeli citizens).
 */
const AS_OF = "26 October 2026";

function Box({ name, sub, tone = "", children }: { name: ReactNode; sub?: ReactNode; tone?: string; children?: ReactNode }) {
  return (
    <div className={`pg-box ${tone}`}>
      <b>{name}</b>
      {sub ? <small>{sub}</small> : null}
      {children}
    </div>
  );
}

/** One level of a chart: its boxes side by side, a line down to the next. */
function Row({ children, down = true }: { children: ReactNode; down?: boolean }) {
  return <div className={`pg-row${down ? " down" : ""}`}>{children}</div>;
}

const CSS = `
.pg{--pg-line:var(--o-line,#334155);--pg-dim:var(--o-dim,#94a3b8);--pg-strong:var(--o-strong,#f1f5f9);--pg-panel:var(--o-hover,rgba(148,163,184,.08));font:400 15px/1.55 var(--ops-ui,system-ui,sans-serif)}
.pg h3{margin:30px 0 8px;font:700 18px/1.2 var(--ops-cond,inherit);letter-spacing:.1em;text-transform:uppercase;color:var(--pg-strong)}
.pg h4{margin:18px 0 6px;font-size:15px;color:var(--pg-strong)}
.pg p,.pg li{margin:0 0 8px}
.pg ul{padding-left:20px;margin:0 0 10px}
.pg-toc{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px;padding:0;list-style:none}
.pg-toc a{display:inline-block;padding:3px 9px;border:1px solid var(--pg-line);border-radius:4px;font-size:13px;color:inherit;text-decoration:none}
.pg-toc a:hover{background:var(--pg-panel)}
.pg-chart{margin:12px 0 16px;padding:12px;border:1px solid var(--pg-line);border-radius:6px;overflow-x:auto}
.pg-row{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;position:relative}
.pg-row.down{padding-bottom:18px}
.pg-row.down::after{content:"";position:absolute;left:50%;bottom:3px;height:12px;border-left:1px solid var(--pg-dim)}
.pg-box{flex:1 1 120px;max-width:230px;padding:7px 9px;border:1px solid var(--pg-line);border-left:3px solid var(--tone,var(--pg-dim));border-radius:4px;background:var(--pg-panel);font-size:13px;line-height:1.35}
.pg-box b{display:block;color:var(--pg-strong);font-size:13.5px}
.pg-box small{display:block;color:var(--pg-dim);font-size:12px;margin-top:2px}
.pg-box.wide{max-width:none;flex-basis:100%}
.pg-box.plo{--tone:#eab308}.pg-box.pa{--tone:#f59e0b}.pg-box.fatah{--tone:#facc15}.pg-box.hamas{--tone:#16a34a}.pg-box.pij{--tone:#0f766e}.pg-box.left{--tone:#ef4444}.pg-box.sec{--tone:#3b82f6}.pg-box.arm{--tone:#a855f7}.pg-box.clan{--tone:#a16207}
.pg-group{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px dashed var(--pg-line);border-radius:6px}
.pg-group>.pg-label{flex-basis:100%;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--pg-dim)}
.pg-table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13.5px}
.pg-table th,.pg-table td{padding:6px 8px;border-bottom:1px solid var(--pg-line);text-align:left;vertical-align:top}
.pg-table th{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--pg-dim);font-weight:600}
.pg-wrap{overflow-x:auto}
.pg-bar{display:flex;height:30px;margin:8px 0 4px;border-radius:4px;overflow:hidden;font-size:12.5px;font-weight:700;color:#0b1220}
.pg-bar span{display:flex;align-items:center;justify-content:center}
.pg-time{list-style:none;padding:0;margin:8px 0;border-left:2px solid var(--pg-line)}
.pg-time li{position:relative;padding:0 0 10px 14px}
.pg-time li::before{content:"";position:absolute;left:-6px;top:7px;width:10px;height:10px;border-radius:50%;background:var(--pg-dim)}
.pg-time li.now::before{background:#eab308}
.pg-time b{color:var(--pg-strong)}
.pg-note{font-size:13px;color:var(--pg-dim)}
.pg [dir=rtl]{unicode-bidi:isolate}
@media (max-width:520px){.pg-box{flex-basis:100%;max-width:none}.pg-chart{padding:8px}}
`;

const ar = (t: string) => <span dir="rtl" lang="ar">{t}</span>;
const he = (t: string) => <span dir="rtl" lang="he">{t}</span>;

export function PaGuide() {
  return (
    <DeskDoc
      title="How the Palestinian side is built"
      lede={<>The PLO, the Palestinian Authority and its security services, Fatah and the Tanzim, Hamas, Islamic Jihad and the other factions, and the elections. Correct as of {AS_OF}; the desk's reports carry what changes.</>}
      back={{ href: "/gaza-judea-samaria-desk", label: "Back to the Gaza – Judea & Samaria desk" }}
    >
      <style>{CSS}</style>
      <div className="pg">
        <ul className="pg-toc">
          {[
            ["short", "In short"],
            ["map", "Who sits where"],
            ["plo", "The PLO"],
            ["pa", "The PA"],
            ["security", "Security services"],
            ["fatah", "Fatah and the Tanzim"],
            ["hamas", "Hamas"],
            ["pij", "Islamic Jihad"],
            ["others", "Other factions"],
            ["elections", "Elections"],
            ["split", "The split"],
            ["money", "Money"],
            ["areas", "Areas A, B, C"],
            ["words", "Words"],
          ].map(([id, t]) => (
            <li key={id}>
              <a href={`#pg-${id}`}>{t}</a>
            </li>
          ))}
        </ul>

        <h3 id="pg-short">In short</h3>
        <ul>
          <li><b>Three layers, one man at the top.</b> Mahmoud Abbas (Abu Mazen) heads the PLO, the Palestinian Authority and Fatah at once.</li>
          <li><b>The PLO</b> speaks for all Palestinians abroad and signed the Oslo Accords. <b>The PA</b> is the body Oslo set up to run the cities of Judea and Samaria (and, until 2007, Gaza). <b>Fatah</b> is the largest party in both.</li>
          <li><b>Hamas and Islamic Jihad are outside the PLO.</b> Hamas won the 2006 election and took Gaza by force in 2007. Since then Fatah has run the PA in Judea and Samaria and Hamas has run Gaza.</li>
          <li><b>Nobody has been elected nationally since 2006.</b> Presidential and legislative elections are now set for 11 September 2027.</li>
        </ul>

        <h3 id="pg-map">Who sits where</h3>
        <div className="pg-chart" role="img" aria-label="The PLO and its factions, the PA, and the factions outside the PLO">
          <Row>
            <Box tone="plo wide" name="Mahmoud Abbas" sub="Chairman of the PLO · President of the PA (State of Palestine) · Head of Fatah" />
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
        </div>

        <h3 id="pg-plo">The PLO (Palestine Liberation Organization)</h3>
        <p>Founded in 1964; recognised by Israel in 1993 as the Palestinians' representative. Its bodies, from the widest to the one that decides:</p>
        <div className="pg-chart" role="img" aria-label="The PLO's bodies">
          <Row><Box tone="plo wide" name="Palestinian National Council (PNC)" sub={<>The PLO's parliament, some 700+ members, appointed by faction quotas. {ar("المجلس الوطني الفلسطيني")}</>} /></Row>
          <Row><Box tone="plo wide" name="Central Council" sub={<>Acts for the PNC between its rare sessions. {ar("المجلس المركزي")}</>} /></Row>
          <Row down={false}><Box tone="plo wide" name="Executive Committee" sub={<>The PLO's government. Chairman: Mahmoud Abbas. Deputy chairman and secretary: Hussein al-Sheikh. {ar("اللجنة التنفيذية")}</>} /></Row>
        </div>
        <p>The PNC has never been elected directly. Abbas set its first direct vote, for Palestinians abroad, for 1 November 2026; members of the Legislative Council are to sit in it for those at home.</p>

        <h3 id="pg-pa">The Palestinian Authority (the “State of Palestine”)</h3>
        <p>Set up under the Oslo Accords in 1994 as a five-year interim body. It now calls itself the State of Palestine, which some 150 countries recognise.</p>
        <div className="pg-chart" role="img" aria-label="The Palestinian Authority">
          <Row><Box tone="pa wide" name="President: Mahmoud Abbas" sub="Elected January 2005 for four years; no election since. Rules by decree." /></Row>
          <Row>
            <Box tone="pa" name="Vice president" sub="Hussein al-Sheikh, named April 2025; Abbas's likely stand-in" />
            <Box tone="pa" name="Prime minister and government" sub="Mohammad Mustafa, since March 2024; ministries in Ramallah" />
            <Box tone="sec" name="Security services" sub="Answer to the president (below)" />
          </Row>
          <Row down={false}>
            <Box tone="pa" name="Legislative Council (PLC)" sub="Elected 2006 (Hamas 74 of 132 seats); stopped meeting in 2007; dissolved by Abbas in 2018. Next: 200 seats" />
            <Box tone="pa" name="Courts" sub="Constitutional Court (2016) and the ordinary courts; the PA's Basic Law stands as its constitution" />
            <Box tone="pa" name="Central Elections Commission" sub={<>Runs every vote; Ramallah. {ar("لجنة الانتخابات المركزية")}</>} />
          </Row>
        </div>
        <p>The PA governs the cities and towns of Judea and Samaria (Areas A and B). It has not governed Gaza since 2007; the Trump plan of October 2025 gives Gaza to a Palestinian committee of technocrats under the Board of Peace, with a reformed PA to take over later.</p>

        <h3 id="pg-security">The security services ({he("המנגנונים")} · {ar("الأجهزة الأمنية")})</h3>
        <p>Tens of thousands of men in Judea and Samaria, the PA's largest payroll. The president is their supreme commander. They work only in Area A (and with Israel's consent beyond it), and coordinate with the IDF through liaison offices (“security coordination”, {ar("التنسيق الأمني")}).</p>
        <div className="pg-chart" role="img" aria-label="The PA security services and whom they answer to">
          <Row><Box tone="sec wide" name="The president, supreme commander" /></Row>
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
        </div>
        <p className="pg-note">In Gaza, Hamas has its own: the Interior Ministry's police and Internal Security, and the Qassam Brigades.</p>

        <h3 id="pg-fatah">Fatah and the Tanzim</h3>
        <p>Founded by Yasser Arafat in 1959; the backbone of the PLO and the PA. Its 8th General Conference (May 2026) kept Abbas as leader and elected its bodies.</p>
        <div className="pg-chart" role="img" aria-label="Fatah's bodies">
          <Row><Box tone="fatah wide" name="General Conference" sub={<>Elects the leadership every few years; 8th held 14–18 May 2026, about 2,600 members. {ar("المؤتمر العام")}</>} /></Row>
          <Row><Box tone="fatah" name="Central Committee" sub={<>18 elected; the leadership. May 2026 top vote-getters: Marwan Barghouti (from an Israeli prison), Majed Faraj, Jibril Rajoub, Hussein al-Sheikh. {ar("اللجنة المركزية")} · {he("הוועד המרכזי")}</>} />
            <Box tone="fatah" name="Revolutionary Council" sub={<>80 elected; Fatah's parliament. {ar("المجلس الثوري")} · {he("המועצה המהפכנית")}</>} /></Row>
          <Row down={false}>
            <Box tone="fatah" name="The Tanzim" sub={<>“The Organisation”: Fatah's field organisation in towns and camps; led by Marwan Barghouti in the second intifada. {ar("التنظيم")} · {he("התנזים")}</>} />
            <Box tone="fatah" name="Shabiba" sub={<>“The Youth”: students and youth. {ar("الشبيبة")}</>} />
            <Box tone="arm" name="Al-Aqsa Martyrs' Brigades" sub={<>Armed cells from Fatah's ranks since 2000; disowned by the PA, still active locally. {ar("كتائب شهداء الأقصى")}</>} />
          </Row>
        </div>
        <h4>Fatah's rival currents</h4>
        <ul>
          <li><b>Mohammed Dahlan</b>: Fatah's former Gaza strongman, expelled in 2011; leads the Democratic Reform Current from Abu Dhabi.</li>
          <li><b>Nasser al-Qudwa</b>: Arafat's nephew, expelled in 2021 after running his own list.</li>
          <li><b>Marwan Barghouti</b>: serving five life terms in Israel since 2002; the most popular Fatah figure in polls.</li>
        </ul>

        <h3 id="pg-hamas">Hamas</h3>
        <p>The Islamic Resistance Movement, founded in Gaza in 1987 from the Muslim Brotherhood. Listed as a terrorist organisation by Israel, the US, the EU and others.</p>
        <div className="pg-chart" role="img" aria-label="Hamas's bodies">
          <Row><Box tone="hamas wide" name="Shura Council" sub={<>“Consultation” council. Elected internally by members in four regions; chooses the leadership. {ar("مجلس الشورى")}</>} /></Row>
          <Row><Box tone="hamas wide" name="Political Bureau" sub={<>Head: Khalil al-Hayya, elected July 2026 in a run-off against Khaled Meshaal (a five-man council led it after Yahya Sinwar's death in 2024). {ar("المكتب السياسي")}</>} /></Row>
          <Row down={false}>
            <Box tone="hamas" name="Gaza" />
            <Box tone="hamas" name="Judea and Samaria" sub="Zaher Jabarin" />
            <Box tone="hamas" name="Abroad" sub="Khaled Meshaal; offices in Doha and Turkey" />
            <Box tone="hamas" name="Prisoners" />
            <Box tone="arm wide" name="Qassam Brigades" sub={<>The armed wing; its spokesman “Abu Obeida”. Disarming it is the core of the Trump plan. {ar("كتائب القسام")}</>} />
          </Row>
        </div>

        <h3 id="pg-pij">Palestinian Islamic Jihad</h3>
        <p>Founded 1981; smaller than Hamas, armed and funded mostly by Iran. Secretary-general: Ziad al-Nakhalah. Armed wing: Saraya al-Quds (the al-Quds Brigades), strong in Gaza and in the Jenin and Tulkarm camps. Rejects Oslo, the PA and elections.</p>

        <h3 id="pg-others">Other factions and armed groups</h3>
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

        <h3 id="pg-elections">Elections</h3>
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

        <h3 id="pg-split">The split, and the attempts to end it</h3>
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

        <h3 id="pg-money">Money</h3>
        <ul>
          <li><b>Clearance revenues</b> ({ar("المقاصة")} · {he("כספי הסליקה")}): under the 1994 Paris Protocol Israel collects customs and VAT on goods bound for the PA and passes them on each month. They are about two thirds of the PA's income.</li>
          <li><b>Deductions:</b> Israel deducts sums matching the PA's payments to prisoners and attackers' families, its share for Gaza, and debts for electricity and water. Part of the money is held in Norway.</li>
          <li><b>Salaries:</b> with the money held back, the PA has paid its employees and security men only part of their wages for long stretches.</li>
        </ul>

        <h3 id="pg-areas">Areas A, B and C (Oslo II, 1995)</h3>
        <div className="pg-bar" role="img" aria-label="Area A about 18 percent, Area B about 22 percent, Area C about 60 percent of Judea and Samaria">
          <span style={{ width: "18%", background: "#f59e0b" }}>A</span>
          <span style={{ width: "22%", background: "#fcd34d" }}>B</span>
          <span style={{ width: "60%", background: "#93c5fd" }}>C</span>
        </div>
        <ul>
          <li><b>Area A</b> (~18%): the cities; PA civil rule and police. The IDF still raids there.</li>
          <li><b>Area B</b> (~22%): towns and villages; PA civil rule, Israeli security control.</li>
          <li><b>Area C</b> (~60%): Israel's full control; the Israeli communities, the Jordan Valley, the roads.</li>
          <li><b>Jerusalem</b>: Israel's; the PA is barred from acting there. <b>Gaza</b>: Hamas since 2007; the IDF holds the part behind the “yellow line” since October 2025.</li>
        </ul>

        <h3 id="pg-words">Words you will meet</h3>
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
      </div>
    </DeskDoc>
  );
}

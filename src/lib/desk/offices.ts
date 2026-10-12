/**
 * Who holds which office now (user, 12 Oct: "UK Home Secretary Andy Burnham" — he is the Prime Minister). A card
 * that puts another office of the same government before a holder's name is shown with the holder's own office;
 * the row is left as it is. Only offices checked against the press are here: Andy Burnham's cabinet of
 * 20–21 July 2026 (ITV, LabourList, The Week). A change of office is a change here.
 */

/** `also`: the other words cards use for the same office. */
type Office = { name: string; re: RegExp; job: string; also?: string[] };

/** The jobs of one government, as cards write them, longest first. */
const UK_JOBS = ["Deputy Prime Minister", "First Secretary of State", "Prime Minister", "Foreign Secretary", "Home Secretary", "Defence Secretary", "Defense Secretary", "Chancellor of the Exchequer", "Chancellor", "Health Secretary", "Housing Secretary", "Business Secretary", "Education Secretary", "Energy Secretary", "PM"];

const UK: Office[] = [
  { name: "Andy Burnham", re: /(?:Andy\s+)?Burnham/, job: "Prime Minister", also: ["PM"] },
  { name: "Louise Haigh", re: /(?:Louise\s+)?Haigh/, job: "First Secretary of State", also: ["Deputy Prime Minister"] },
  { name: "Ed Miliband", re: /(?:Ed\s+)?Miliband/, job: "Foreign Secretary" },
  { name: "Shabana Mahmood", re: /(?:Shabana\s+)?Mahmood/, job: "Home Secretary" },
  { name: "Wes Streeting", re: /(?:Wes\s+)?Streeting/, job: "Defence Secretary", also: ["Defense Secretary"] },
  { name: "John Healey", re: /(?:John\s+)?Healey/, job: "Chancellor", also: ["Chancellor of the Exchequer"] },
  { name: "Yvette Cooper", re: /Yvette\s+Cooper/, job: "Health Secretary" },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const JOB = `(${UK_JOBS.map(esc).join("|")})`;
const RULES = UK.map((o) => ({ o, re: new RegExp(String.raw`\b${JOB}\s+(${o.re.source})\b`, "g") }));
const ANY = new RegExp(String.raw`\b${JOB}\s+(?:[A-Z]\w+\s+)?[A-Z]`);

/** A UK office before a holder's name is the holder's own office: "Home Secretary Andy Burnham" is "Prime Minister Andy Burnham". */
export function rightOffice(text: string): string {
  let out = String(text || "");
  if (!out || !ANY.test(out)) return out;
  for (const { o, re } of RULES) out = out.replace(re, (m, job: string, name: string) => ([o.job, ...(o.also ?? [])].includes(job) ? m : `${o.job} ${name}`));
  return out;
}

// The source-by-source pass: every post since 28 Feb, in every channel, with any word of war in any language; no
// country or place asked. Copies across channels are one line with their refs. Batches by source, in time order.
const fs=require('fs');
const R='C:/Users/itama/AppData/Local/Temp/rs/';
const WAR=/صاروخ|صواريخ|مسير|مسيّر|انفجار|دوي|اعتراض|اعترض|يعترض|سقوط|شظايا|استهداف|استهدف|هجوم|قصف|غارة|غارات|إسقاط|اسقاط|صافرات|صفارات|إنذار|انذار|يدك|تدك|ضربة|اشتباك|موشک|پهپاد|حمله|آژیر|اصابت|رهگیری|بمباران|شلیک|טיל|יירוט|פיצוץ|תקיפה|אזעק|כטב"ם|חיסול|missile|drone|strike|explosion|intercept|siren|attack/i;
const SKIP=new Set(['muqawama_iraq','royatv','UK_MTO']);
const chOf=(d,f)=>{const b=f.replace(/\.jsonl$/,'');return /^hd\d$/.test(b)?'AlHadath_Brk':/^aj\d$/.test(b)?'ajanews':/^ar\d$/.test(b)?'AlArabiya':b==='petra'?'petranews':b.replace(/-\d+$/,'').replace(/\.nl$/,'')};
const rows=[];const seenId=new Set();
for(const d of ['part','part2','tg','ir','jo','iq','x'])for(const f of fs.readdirSync(R+d).filter(f=>f.endsWith('.jsonl'))){const ch=chOf(d,f);if(SKIP.has(ch)||/\.nl\.jsonl$/.test(f))continue;
 for(const l of fs.readFileSync(R+d+'/'+f,'utf8').split('\n')){if(!l)continue;let r;try{r=JSON.parse(l)}catch{continue}
  const ref=ch+'/'+r.id;if(!r.at||r.at<'2026-02-28'||seenId.has(ref))continue;seenId.add(ref);
  const t=(r.text||'').replace(/https?:\/\/\S+/g,'').replace(/&rlm;|&lrm;|[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();if(!WAR.test(t))continue;
  rows.push({ref,ch,at:new Date(Date.parse(r.at)+3*3600e3).toISOString().slice(0,16).replace('T',' '),t,url:r.url||'https://t.me/'+ch+'/'+r.id})}}
rows.sort((a,b)=>a.at<b.at?-1:1);
const norm=s=>s.replace(/[^\u0600-\u06FF\u0590-\u05FFa-zA-Z0-9]/g,'').slice(0,90);
const by=new Map();for(const r of rows){const k=r.at.slice(0,10)+norm(r.t);if(by.has(k))by.get(k).also.push(r.ref);else by.set(k,{...r,also:[]})}
const U=[...by.values()];
fs.writeFileSync(R+'read/src-cands.jsonl',U.map(x=>JSON.stringify({ref:x.ref,at:x.at,ch:x.ch,text:x.t.slice(0,600),url:x.url,also:x.also})).join('\n')+'\n');
const per={};for(const u of U)per[u.ch]=(per[u.ch]||0)+1;
console.log('posts',rows.length,'unique',U.length);console.log(Object.entries(per).sort((a,b)=>b[1]-a[1]).map(x=>x.join(':')).join(' '));

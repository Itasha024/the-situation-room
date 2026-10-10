// Round 31, the reading method: broad candidates for reading (see read-merge.cjs). Paths are the research dumps.
// Broad candidates for reading: a post that names the country (any form) or one of its places, and any word of war.
// node cands.cjs <country-regex-file-key> out.jsonl files...
const fs=require('fs');
const [KEY,OUT,...FILES]=process.argv.slice(2);
const C0={
 kw:{place:/كويت|كويتي|الأحمدي|الاحمدي|علي السالم|عريفجان|بيورينغ|بوهرينغ|العديري|بوبيان|الشعيبة|الجهراء|الزور|ميناء عبد ?الله|کویت|כווית|Kuwait|Arifjan|Ali Al Salem|Buehring/},
 bh:{place:/بحرين|المنامة|المحرق|الجفير|الأسطول الخامس|الاسطول الخامس|سترة|بابكو|عيسى الجوية|مدينة حمد|الرفاع|بحرین|בחריין|Bahrain|Manama|Juffair|Fifth Fleet/},
 qa:{place:/قطر|الدوحة|العديد|راس لفان|رأس لفان|مسيعيد|الوكرة|العُديد|قطري|دوحه|קטאר|Qatar|Doha|Udeid|Ras Laffan/},
 ae:{place:/[إا]مارات|دبي|[أا]بوظبي|[أا]بو ظبي|الشارقة|الفجيرة|رأس الخيمة|راس الخيمة|عجمان|[أا]م القيوين|العين|الظفرة|جبل علي|خورفكان|خور فكان|الرويس|براكة|مصفح|كلباء|امارات|ابوظبی|دبی|איחוד האמירויות|דובאי|אבו דאבי|UAE|Emirates|Dubai|Abu Dhabi|Dhafra|Fujairah|Sharjah/},
 sa:{place:/سعودي|السعودية|الرياض|الخرج|الأمير سلطان|الامير سلطان|الظهران|الدمام|الجبيل|بقيق|راس تنورة|رأس تنورة|القطيف|الأحساء|الاحساء|ينبع|جدة|تبوك|عرعر|القريات|طريف|حفر الباطن|شيبة|الخفجي|حائل|القصيم|الجوف|سعودی|ریاض|ערב הסעודית|סעודיה|Saudi|Riyadh|Prince Sultan|Dhahran|Ras Tanura|Abqaiq|Yanbu/},
 om:{place:/عمان|عُمان|العماني|مسقط|الدقم|صلالة|صحار|خصب|مسندم|عمان|Oman|Muscat|Duqm|Salalah|Sohar/},
};const C={...C0,
 gulf:{place:new RegExp(["kw","bh","qa","ae","sa","om"].map(k=>C0[k].place.source).join("|"))},
 iq:{place:/العراق|عراقي|بغداد|البصرة|الموصل|نينوى|أربيل|اربيل|كركوك|السليمانية|دهوك|الأنبار|الانبار|الرمادي|الفلوجة|القائم|حديثة|عين الأسد|عين الاسد|الحبانية|صلاح الدين|تكريت|سامراء|بيجي|بلد|ديالى|بعقوبة|خانقين|واسط|الكوت|ميسان|العمارة|ذي قار|الناصرية|المثنى|السماوة|الديوانية|القادسية|بابل|الحلة|جرف الصخر|جرف النصر|كربلاء|النجف|الحشد|فكتوريا|فيكتوريا|مطار بغداد|التاجي|حرير|كويسنجق|كويه|بنجوين|سنجار|تلعفر|القيارة|مخمور|زاخو|سوران|المنطقة الخضراء|السفارة الأمريكية|السفارة الأميركية|عراق|اربیل|بغداد|کرکوک|سلیمانیه|عین الاسد|עיראק|ארביל|בגדאד|Iraq|Erbil|Baghdad|Ain al-Asad|Kirkuk|Basra|Mosul/},
 jo:{place:/[أا]ردن|عمّان|عمان الأردن|المفرق|إربد|اربد|الزرقاء|الرمثا|الأزرق|الازرق|موفق السلطي|الكرك|معان|العقبة|الطفيلة|مادبا|جرش|عجلون|الأغوار|الاغوار|الرويشد|الصفاوي|الأمير حسن|الامير حسن|الزميلة|البلقاء|السلط|الجفر|الملك فيصل|الملك حسين|البرج 22|برج 22|الركبان|طريبيل|اردن|عقبه|ازرق|مفرق|ירדן|עקבה|עמאן|Jordan|Aqaba|Amman|Muwaffaq|Azraq|Mafraq|Irbid|Zarqa|Tower 22/},
};
const WAR=/آژیر|صدای انفجار|אזעקה|אזעקות|פיצוצים|siren|blast|صاروخ|صواريخ|مسير|مسيّر|طائر|انفجار|دوي|اعتراض|اعترض|يعترض|تعترض|سقوط|سقط|شظايا|حطام|استهداف|استهدف|هجوم|هاجم|قصف|يدك|تدك|دك|ضرب|غارة|غارات|إسقاط|اسقاط|أسقط|اسقط|تصد|صافرات|صفارات|إنذار|انذار|دفاع|موشک|پهپاد|حمله|انفجار|رهگیری|اصابت|שיגור|יירוט|נפילה|טיל|כטב"ם|פיצוץ|תקיפה|missile|drone|intercept|strike|attack|explosion|debris/i;
const NOISE=/النيل الأزرق|النيل الازرق|مسيرة (?:الأردن|وطن|التحديث|البناء|الإصلاح|التنمية)|مسيرته|مسيرات حاشدة|مسيرات (?:شعبية|تضامنية|احتجاجية)/;
const chOf=f=>{const b=f.replace(/^.*[\/]/,'').replace(/\.jsonl$/,'');return /^hd\d$/.test(b)?'AlHadath_Brk':/^aj\d$/.test(b)?'ajanews':/^ar\d$/.test(b)?'AlArabiya':b==='petra'?'petranews':b.replace(/-\d+$/,'')};
const out=[];const seen=new Set();
for(const f of FILES){const ch=chOf(f);for(const l of fs.readFileSync(f,'utf8').split('\n')){if(!l)continue;let r;try{r=JSON.parse(l)}catch{continue}
 if(!r.at||r.at<'2026-02-28')continue;const t=(r.text||'').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
 if(!C[KEY].place.test(t)||!WAR.test(t)||NOISE.test(t))continue;
 const id=ch+'/'+r.id;if(seen.has(id))continue;seen.add(id);
 const at=new Date(Date.parse(r.at)+3*3600e3).toISOString().slice(0,16).replace('T',' ');
 out.push({ref:id,at,ch,text:t.slice(0,600),url:r.url||'https://t.me/'+ch+'/'+r.id});}}
out.sort((a,b)=>a.at<b.at?-1:1);
// One text per day: copies across channels are one candidate with their refs.
const by=new Map();for(const o of out){const k=o.at.slice(0,10)+'|'+o.text.slice(0,80);if(by.has(k))by.get(k).also.push(o.ref);else by.set(k,{...o,also:[]})}
const u=[...by.values()];
fs.writeFileSync(OUT,u.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log('posts',out.length,'unique',u.length,'days',new Set(u.map(x=>x.at.slice(0,10))).size);

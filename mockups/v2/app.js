/* The Situation Room — mock v2: one main desk, countries and seas as focus, wars as pages.
   Data: real reports and pins from both live desks (15 Oct 2026, evening). Mock only. */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem('sr2.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('sr2.'+k,JSON.stringify(v))}catch(e){}}};
const H=36e5, DAY=864e5;

/* ---------- data ---------- */
const R=DATA.reports.map(r=>({...r,ms:Date.parse(r.at)}));
const NOW=R[0].ms;
const byId=new Map(R.map(r=>[r.id,r]));
const byHead=new Map(R.map(r=>[r.h.toLowerCase(),r]));
R.forEach(r=>{r.kids=[]});
const rpGroups=new Map(); R.forEach(r=>{if(r.rp){if(!rpGroups.has(r.rp))rpGroups.set(r.rp,[]);rpGroups.get(r.rp).push(r)}});
// a thread = reports sharing the same replyTo; the oldest is the parent
rpGroups.forEach(list=>{list.sort((a,b)=>a.ms-b.ms);const p=list[0];list.slice(1).forEach(k=>{k.parent=p.id;p.kids.push(k.id)})});

// pins: [at,type,lat,lng,country,desk,label,place]  + older Iran pins: [date,side,lat,lng,sea]
const PINS=DATA.pins.map(p=>({ms:Date.parse(p[0]+':00Z'),t:p[1]==='port'?'vessel':p[1],la:p[2],ln:p[3],c:p[4],w:p[5],h:p[6],pl:p[7]}));
const lastHist=Math.max(...DATA.hist.map(p=>Date.parse(p[0])));
const SHIFT=NOW-DAY-lastHist; // older pin file ends 10 Oct; moved so it meets the live pins (mock only)
const HIST=DATA.hist.map(p=>({ms:Date.parse(p[0])+SHIFT+H*12,side:p[1],la:p[2],ln:p[3],sea:p[4]})).filter(p=>p.ms<NOW-DAY*1.2);
const START=Math.min(...HIST.map(p=>p.ms));

/* ---------- vocabulary ---------- */
const CATS=[
 {id:'all',name:'All'},
 {id:'strike',name:'Strikes',col:'#e2694f'},
 {id:'combat',name:'Fighting',col:'#e3b64d'},
 {id:'vessel',name:'Shipping',col:'#5fa8dc'},
 {id:'diplomacy',name:'Diplomacy',col:'#9b7fd1'},
 {id:'statement',name:'Statements',col:'#a99d93'},
 {id:'economy',name:'Economy',col:'#3fb0b3'},
];
const CAT=Object.fromEntries(CATS.map(c=>[c.id,c]));
const ICON={ // shape = event type (APP-6 idea: shape and colour say the same thing twice)
 strike:'<svg viewBox="0 0 12 12"><path d="M6 0l1.4 3.6L11 2.4 8.6 5.6 12 7 8.2 7.6 9 12 6 9 3 12l.8-4.4L0 7l3.4-1.4L1 2.4l3.6 1.2z"/></svg>',
 combat:'<svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
 vessel:'<svg viewBox="0 0 12 12"><path d="M1 7h10l-2 3.5H3zM5 2h2v4H5z"/></svg>',
 diplomacy:'<svg viewBox="0 0 12 12"><circle cx="4" cy="6" r="3"/><circle cx="8" cy="6" r="3" fill-opacity=".6"/></svg>',
 statement:'<svg viewBox="0 0 12 12"><path d="M1 2h10v6H5l-3 3V8H1z"/></svg>',
 economy:'<svg viewBox="0 0 12 12"><path d="M1 11h10M2 10V6h2v4M5 10V3h2v7M8 10V5h2v5"/></svg>',
};
const flag=(id)=>{const F={
 yemen:['#ce1126','#fff','#000'],saudi:['#006c35'],iran:['#239f40','#fff','#da0000'],israel:['#fff','#0038b8','#fff'],lebanon:['#ed1c24','#fff','#ed1c24'],iraq:['#ce1126','#fff','#000'],gulf:['#8d1b3d','#fff'],us:['#b22234','#fff','#3c3b6e'],syria:['#007a3d','#fff','#000']};
 if(id==='redsea'||id==='hormuz')return '<svg class="flag" viewBox="0 0 20 13"><rect width="20" height="13" fill="#20425e"/><path d="M0 5q2.5-2 5 0t5 0 5 0 5 0M0 9q2.5-2 5 0t5 0 5 0 5 0" stroke="#5fa8dc" fill="none" stroke-width="1.3"/></svg>';
 if(id==='region')return '<svg class="flag" viewBox="0 0 20 13"><rect width="20" height="13" fill="#282421"/><circle cx="10" cy="6.5" r="4.5" fill="none" stroke="#f4a58a" stroke-width="1.3"/><path d="M5.5 6.5h9M10 2v9" stroke="#f4a58a" stroke-width=".9"/></svg>';
 const c=F[id]||['#766b62'];const n=c.length;return `<svg class="flag" viewBox="0 0 20 13">${c.map((x,i)=>`<rect y="${i*13/n}" width="20" height="${13/n+.1}" fill="${x}"/>`).join('')}${id==='lebanon'?'<path d="M10 3.6l2 3.4h-4z" fill="#00a651"/>':''}</svg>`};

const T=[ // focus areas: countries and seas (Liveuamap regions / HOI4 theatres / ACLED sea areas)
 {id:'region',name:'Whole region',kind:'all',b:[[12,33],[38.5,61]]},
 {id:'yemen',name:'Yemen',kind:'country',b:[[12.1,41.6],[19.2,53.4]],wars:['yemen'],cap:'Sanaa',ctx:'Houthi forces against Yemen\'s government and the Saudi-led coalition. The war began on 13 July 2026 with the strike on Sanaa airport.'},
 {id:'saudi',name:'Saudi Arabia',kind:'country',b:[[16.2,34.5],[32.2,55.8]],wars:['yemen','iran'],cap:'Riyadh',ctx:'The coalition\'s lead state and the Houthis\' main target on land; also exposed to Iran across the Gulf.'},
 {id:'redsea',name:'Red Sea',kind:'sea',b:[[11.2,32.2],[28.5,46]],wars:['yemen'],lens:'shipping',ctx:'The Red Sea, Bab al-Mandab and the Gulf of Aden: the shipping lane between Suez and the Indian Ocean.'},
 {id:'iran',name:'Iran',kind:'country',b:[[24.6,43.5],[39.8,63.4]],wars:['iran'],cap:'Tehran',ctx:'At war with Israel and the United States since 28 February 2026; its allies fight on several fronts.'},
 {id:'hormuz',name:'Hormuz',kind:'sea',b:[[23.6,53.6],[27.6,59.6]],wars:['iran'],lens:'shipping',ctx:'The Strait of Hormuz and the Gulf of Oman, where about a fifth of the world\'s oil passes.'},
 {id:'israel',name:'Israel',kind:'country',b:[[29.4,33.6],[33.5,36.2]],wars:['iran'],cap:'Jerusalem',ctx:'Israel\'s war beyond its borders: Iran, Lebanon, Gaza and attacks on Israel.'},
 {id:'lebanon',name:'Lebanon',kind:'country',b:[[32.9,34.9],[34.75,36.75]],wars:['iran'],cap:'Beirut',ctx:'Hezbollah and Israel across the southern border, and Beirut\'s diplomacy between Iran and the West.'},
 {id:'iraq',name:'Iraq',kind:'country',b:[[29,38.7],[37.4,48.7]],wars:['iran'],cap:'Baghdad',ctx:'Iran-aligned militias, US forces and the Iraqi state; a launch ground and a banking channel.'},
 {id:'gulf',name:'Gulf states',kind:'country',b:[[22.5,47.5],[30.2,57]],wars:['iran','yemen'],cap:'Doha',ctx:'The UAE, Qatar, Bahrain, Kuwait and Oman: bases, ports, mediation and missile defence.'},
 {id:'us',name:'United States',kind:'actor',b:[[11,32],[39.6,63]],wars:['iran','yemen'],cap:'Washington',ctx:'What the United States itself does and says about the region: strikes, sanctions, talks.'},
];
const TH=Object.fromEntries(T.map(t=>[t.id,t]));
const WARS={
 yemen:{id:'yemen',name:'Yemen war',start:Date.UTC(2026,6,13),b:[[12,36],[30,56]],theatres:['yemen','saudi','redsea','gulf','us'],ctx:'Houthi forces against Yemen\'s government and the Saudi-led coalition, on land, at sea and across the Saudi border. Since 13 July 2026.'},
 iran:{id:'iran',name:'Iran war',start:Date.UTC(2026,1,28),b:[[22,32.5],[40,63.5]],theatres:['iran','israel','lebanon','iraq','hormuz','gulf','saudi','us'],ctx:'Iran against Israel and the United States, with fronts in Lebanon, Iraq, the Gulf and the Strait of Hormuz. Since 28 February 2026.'},
};
const BRIEFMAP={ // which live brief sections belong to which focus
 'Bab al-Mandab':['redsea','yemen'],'Red Sea coast':['yemen','redsea'],'Saudi Arabia':['saudi'],
 'Strait of Hormuz':['hormuz'],'Lebanon':['lebanon'],'Inside Iran':['iran'],'Nuclear file':['iran'],'Talks':['iran','us'],'Sanctions':['iran','us','iraq'],'The U.S.':['us'],'Axis of Resistance':['iraq','lebanon','yemen'],
};
const TERMS={
 'Houthi forces':'The armed movement Ansar Allah, which holds Sanaa and most of Yemen\'s north-west. Fights the government and the Saudi-led coalition.',
 'government forces':'Forces loyal to Yemen\'s internationally recognised government and its Presidential Leadership Council, based in Aden.',
 'Presidential Leadership Council':'The eight-member body that has led Yemen\'s internationally recognised government since 2022.',
 'Saudi-led coalition':'The alliance led by Saudi Arabia that backs Yemen\'s government against Houthi forces.',
 'Bab al-Mandab':'The strait between Yemen and the Horn of Africa that joins the Red Sea to the Gulf of Aden.',
 'Strait of Hormuz':'The narrow passage between Iran and Oman out of the Gulf.',
 'Hezbollah':'The Lebanese armed movement and party allied with Iran.',
 'IRGC':'Iran\'s Islamic Revolutionary Guard Corps, separate from the regular army; runs the missile forces and the navy in the Strait of Hormuz.',
 'UKMTO':'UK Maritime Trade Operations, the Royal Navy office that receives and publishes reports of attacks on ships.',
 'CENTCOM':'US Central Command, the American military command for the Middle East.',
 'NPT':'The Nuclear Non-Proliferation Treaty.',
 'assessed control':'Who holds an area, judged from several independent reports of the same kind; dated, and changed only on new reports.',
 'Hollow pin':'One side\'s account so far. It fills in once an official body or a wire reports it too.',
};

/* ---------- state ---------- */
const S={focus:'region',war:null,lens:'reports',cat:'all',view:'cards',span:DAY,end:NOW,claims:true,arcs:true,names:true,compare:false,cmd:false,q:null};
let lastVisit=LS.get('last',NOW-6*H); if(NOW-lastVisit<5*60e3)lastVisit=NOW-6*H;
let follow=LS.get('follow',['Marib','Strait of Hormuz']);

/* ---------- helpers ---------- */
const tz3=ms=>new Date(ms+3*H);
const hm=ms=>tz3(ms).toISOString().slice(11,16);
const dmy=ms=>tz3(ms).toUTCString().slice(5,11).replace(/^0/,'');
const longDate=ms=>tz3(ms).toUTCString().slice(0,16);
const ago=ms=>{const m=Math.round((NOW-ms)/6e4);return m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`};
const inB=(la,ln,b)=>la>=b[0][0]&&la<=b[1][0]&&ln>=b[0][1]&&ln<=b[1][1];
const focusTheatres=()=>S.war?WARS[S.war].theatres:S.focus==='region'?null:[S.focus];
function inFocus(r){
  if(S.focus==='following')return follow.includes(r.pl);
  if(S.war)return r.w.includes(S.war);
  if(S.focus==='region')return true;
  return r.c.includes(S.focus);
}
const inWin=ms=>ms<=S.end&&ms>S.end-S.span;
const srcType=s=>/Treasury|Ministry|CENTCOM|UKMTO|coalition|Spokes|Civil Defen|SPA|WAM|QNA|Health|UN |IAEA|White House|State Department|Pentagon|Government/i.test(s)?'official':/Reuters|AP|AFP|Bloomberg|Associated Press/i.test(s)?'wire':/Masirah|Saba|Sabereen|Tasnim|Fars|Manar|Mihwar|Naya|Army Media|2 December|Mayadeen|Press TV|Al-Alam|Tehran Fori|IRNA|Mehr|Shajab|Giants/i.test(s)?'party':'media';
const STYPE={official:['Official','#3fb0b3'],wire:['Wire','#5fa8dc'],media:['Media','#e3b64d'],party:['Party outlet','#c45c26']};
const isClaim=r=>r.tier==='claim'&&!r.also.length;
function gloss(txt,seen=new Set()){let out=esc(txt);for(const k of Object.keys(TERMS)){if(seen.has(k))continue;const re=new RegExp('\\b('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b');if(re.test(out)){seen.add(k);out=out.replace(re,`<span class="term" data-t="${esc(k)}">$1</span>`)}}return out}
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)};
function spark(vals,col,w=120,h=20){const mx=Math.max(1,...vals);const st=w/(vals.length-1||1);return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="1.4" points="${vals.map((v,i)=>`${(i*st).toFixed(1)},${(h-1-v/mx*(h-3)).toFixed(1)}`).join(' ')}"/></svg>`}
function bucket(list,n,step){const a=new Array(n).fill(0);list.forEach(r=>{const i=n-1-Math.floor((S.end-r.ms)/step);if(i>=0&&i<n)a[i]++});return a}
function trend(id){ // activity in the last 24 h vs the 24 h before (CrisisWatch arrow; not escalation)
  const L=R.filter(r=>id==='region'||r.c.includes(id));const a=L.filter(r=>r.ms>NOW-DAY).length,b=L.filter(r=>r.ms<=NOW-DAY&&r.ms>NOW-2*DAY).length;
  if(!b)return ['flat','→','about the same as yesterday'];const d=(a-b)/b;return d>.15?['up','▲','busier than yesterday']:d<-.15?['down','▼','calmer than yesterday']:['flat','→','about the same as yesterday']}

/* ---------- map ---------- */
const map=L.map('map',{zoomControl:false,zoomSnap:.25,minZoom:2.5,maxZoom:13,preferCanvas:true}).setView([25,47],4.5);
L.control.zoom({position:'bottomright'}).addTo(map);
map.scrollWheelZoom.disable();map.on('click',()=>map.scrollWheelZoom.enable());
map.getContainer().addEventListener('mouseleave',()=>map.scrollWheelZoom.disable());
const TILE=t=>`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${t}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
let tiles=L.tileLayer(TILE('Dark'),{maxZoom:16,attribution:'Esri, HERE, Garmin, © OpenStreetMap'}).addTo(map);
['shade','fog','cmpA','dots','arcs'].forEach((p,i)=>{map.createPane(p).style.zIndex=340+i*10});
const rDots=L.canvas({pane:'dots'}), rCmp=L.canvas({pane:'cmpA'});
const SIDE={iran:'#e2694f',israel:'#5fa8dc',us:'#5fa8dc',gulf:'#9b7fd1',hezbollah:'#d9aa45',iraqi_militias:'#c9895a',unclear:'#a99d93',other:'#a99d93'};
const ctrlCol=n=>/sanʿaʾ|sa'dah|'amran|hajjah|hudaydah|dhamar|ibb|raymah|mahwit|bayda/i.test(n)?'#c45c26':/ma'rib|ta'izz|dali|jawf/i.test(n)?'#e3b64d':'#3fb0b3';
const L_country=L.geoJSON({type:'FeatureCollection',features:GEO.countries},{pane:'shade',style:()=>({color:'#4a433d',weight:.8,fillOpacity:0})}).addTo(map);
const L_yemen=L.geoJSON({type:'FeatureCollection',features:GEO.yemen},{pane:'shade',style:()=>({color:'#4a433d',weight:.7,fillOpacity:0})}).addTo(map);
const L_dots=L.layerGroup().addTo(map), L_cmp=L.layerGroup().addTo(map), L_pins=L.layerGroup().addTo(map), L_heat=L.layerGroup(), L_fog=L.layerGroup(), L_arcs=L.layerGroup().addTo(map), L_labels=L.layerGroup().addTo(map), L_ship=L.layerGroup(), L_theatre=L.layerGroup().addTo(map);
const LANES=[[[29.9,32.6],[27.5,34],[20,38.5],[15,41.8],[12.6,43.4],[12,45],[12.6,50],[13,54]],[[29.5,48.6],[27.5,50.5],[26.4,53.5],[26.5,56.3],[25.6,57],[24.5,59],[22.5,61]]];

function colorShade(){
  const ctl=S.lens==='control';const yCtl=S.war==='yemen'||['yemen','saudi','redsea'].includes(S.focus);
  const ft=focusTheatres();
  L_country.setStyle(f=>{const id=f.properties.id;const dim=ft&&!ft.includes(id)&&S.focus!=='region';
    return {color:dim?'#35302c':'#5a524b',weight:ft&&ft.includes(id)?1.4:.7,fillColor:ctl?SIDE[f.properties.side]||'#776':'#000',fillOpacity:ctl&&!yCtl?(f.properties.side==='iran'?.33:.18):(dim?.35:0)}});
  L_yemen.setStyle(f=>{const dim=ft&&!ft.includes('yemen')&&S.focus!=='region';return {color:'#5a524b',weight:.7,fillColor:ctl?ctrlCol(f.properties.name):'#000',fillOpacity:ctl?.42:(dim?.35:0)}});
}

function dotList(end,span){
  const b=S.war?WARS[S.war].b:TH[S.focus]?.b||TH.region.b;
  const ft=focusTheatres();
  const out=[];
  PINS.forEach(p=>{if(p.ms<=end&&p.ms>end-span){const inside=!ft||ft.includes(p.c)||S.focus==='region';out.push({la:p.la,ln:p.ln,col:CAT[p.t]?.col||'#a99d93',a:inside?1:.25,t:p.t})}});
  HIST.forEach(p=>{if(p.ms<=end&&p.ms>end-span){const inside=S.focus==='region'||inB(p.la,p.ln,b);out.push({la:p.la,ln:p.ln,col:SIDE[p.side]||'#a99d93',a:inside?.8:.2,t:p.sea?'vessel':'strike'})}});
  return out;
}
function drawDots(){
  L_dots.clearLayers();L_cmp.clearLayers();
  const sh=S.lens==='shipping';
  const pts=dotList(S.end,Math.max(S.span,DAY));
  pts.forEach(p=>{if(sh&&p.t!=='vessel')return;L.circleMarker([p.la,p.ln],{renderer:rDots,radius:map.getZoom()<5?2.4:3.2,weight:0,fillColor:p.col,fillOpacity:.65*p.a,interactive:false}).addTo(L_dots)});
  if(S.compare){const A=S.end-30*DAY;dotList(A,Math.max(S.span,DAY)).forEach(p=>{if(sh&&p.t!=='vessel')return;L.circleMarker([p.la,p.ln],{renderer:rCmp,radius:3.2,weight:0,fillColor:p.col,fillOpacity:.65*p.a,interactive:false}).addTo(L_cmp)});}
  heat(pts);drawMini(pts);
}
function heat(pts){
  L_heat.clearLayers();const z=map.getZoom(),cell=z<5?1:z<7?.4:.15,g={};
  pts.forEach(p=>{if(p.a<.5)return;const k=Math.floor(p.la/cell)+':'+Math.floor(p.ln/cell);g[k]=(g[k]||0)+1});
  const mx=Math.max(1,...Object.values(g));
  Object.entries(g).forEach(([k,n])=>{const [a,b]=k.split(':').map(Number),t=Math.sqrt(n/mx);L.rectangle([[a*cell,b*cell],[(a+1)*cell,(b+1)*cell]],{pane:'shade',weight:0,fillColor:t>.66?'#f4a58a':t>.33?'#e2694f':'#7a3526',fillOpacity:.2+.6*t,interactive:false}).addTo(L_heat)});
}
function pinIcon(r){const c=CAT[r.t]?.col||'#a99d93';const isNew=r.ms>lastVisit;return L.divIcon({className:'plain',iconSize:[22,22],iconAnchor:[11,11],html:`<div class="pinI ${isClaim(r)?'claim':''} ${isNew?'new':''}" style="background:${c};color:${isClaim(r)?c:'#1b1918'}">${ICON[r.t]||''}</div>`})}
function drawPins(){
  L_pins.clearLayers();L_arcs.clearLayers();
  const z=map.getZoom();
  if(S.focus==='region'&&!S.war&&z<5.4){drawTheatres();return}
  L_theatre.clearLayers();
  const sh=S.lens==='shipping';
  const list=R.filter(r=>r.la!=null&&inWin(r.ms)&&inFocus(r)&&(S.cat==='all'||r.t===S.cat)&&(!sh||r.t==='vessel')&&(S.claims||!isClaim(r))).slice(0,160);
  const seenPos=new Set();
  list.forEach(r=>{const k=r.la.toFixed(2)+','+r.ln.toFixed(2);const off=seenPos.has(k);seenPos.add(k);
    const ll=off?[r.la+(Math.random()-.5)*.04,r.ln+(Math.random()-.5)*.04]:[r.la,r.ln];
    L.marker(ll,{icon:pinIcon(r),riseOnHover:true,title:r.h}).on('click',()=>select(r)).addTo(L_pins);
    if(S.arcs)arc(r);
  });
}
function arc(r){ // launch side → target, only for long-range strikes named in the report
  let from=null;
  if(/Houthi|from Yemen/i.test(r.h)&&/missile|drone/i.test(r.h)&&!r.c.includes('yemen'))from=[16.94,43.76];
  else if(/Iran(ian)? (fires|launch|missile|drone)/i.test(r.h)&&!r.c.includes('iran'))from=r.c.includes('hormuz')||r.c.includes('gulf')?[27.18,56.27]:[34.31,47.06];
  if(!from)return;const to=[r.la,r.ln];const mid=[(from[0]+to[0])/2+Math.abs(from[1]-to[1])*.18,(from[1]+to[1])/2];
  const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push([(1-t)*(1-t)*from[0]+2*(1-t)*t*mid[0]+t*t*to[0],(1-t)*(1-t)*from[1]+2*(1-t)*t*mid[1]+t*t*to[1]])}
  L.polyline(pts,{pane:'arcs',color:CAT[r.t]?.col||'#e2694f',weight:1.3,opacity:.7,dashArray:'2 4',interactive:false}).addTo(L_arcs);
}
function drawTheatres(){ // semantic zoom: far out, one label per area instead of pins
  L_theatre.clearLayers();
  T.filter(t=>t.kind!=='all'&&t.kind!=='actor').forEach(t=>{
    const c=[(t.b[0][0]+t.b[1][0])/2,(t.b[0][1]+t.b[1][1])/2];
    const adj={saudi:[22.4,43.6],gulf:[25.6,51.7],redsea:[19,38.6],hormuz:[26.2,57.6],israel:[31.2,34.4],lebanon:[34,35.4],iran:[32.5,54],iraq:[33.6,43.6],yemen:[15.4,47]}[t.id]||c;const left=['israel','lebanon'].includes(t.id);
    const last=R.find(r=>r.c.includes(t.id));const tr=trend(t.id);
    L.marker(adj,{icon:L.divIcon({className:'plain',iconSize:null,iconAnchor:[0,14],html:`<div class="tlabel glass" style="${left?'transform:translateX(-100%)':''}" data-go="${t.id}">${flag(t.id)}<b>${t.name}</b><span class="${tr[0]}" title="${tr[2]}">${tr[1]}</span><small>${last?ago(last.ms):''}</small></div>`})}).addTo(L_theatre);
  });
}
function drawLabels(){
  L_labels.clearLayers();return;
  const ft=focusTheatres();
  GEO.countries.forEach(f=>{const id=f.properties.id;if(id==='other'||(ft&&!ft.includes(id)))return;const b=L.geoJSON(f).getBounds();L.marker(b.getCenter(),{interactive:false,icon:L.divIcon({className:'plain',iconSize:null,html:`<span class="cname">${esc(f.properties.name.replace(', Judea and Samaria',''))}</span>`})}).addTo(L_labels)});
}
function drawFog(){
  L_fog.clearLayers();
  const recent=R.filter(r=>r.la!=null&&inWin(r.ms));
  GEO.yemen.forEach(f=>{const lay=L.geoJSON(f);const b=lay.getBounds();if(!recent.some(r=>b.contains([r.la,r.ln]))){L.geoJSON(f,{pane:'fog',style:{weight:0,fillColor:'#000',fillOpacity:.55}}).addTo(L_fog);L.marker(b.getCenter(),{interactive:false,icon:L.divIcon({className:'plain',iconSize:null,html:'<span class="fogtxt">No reports</span>'})}).addTo(L_fog)}});
  GEO.countries.forEach(f=>{const lay=L.geoJSON(f);const b=lay.getBounds();if(!recent.some(r=>b.contains([r.la,r.ln])&&f.properties.id!=='saudi'))L.geoJSON(f,{pane:'fog',style:{weight:0,fillColor:'#000',fillOpacity:.5}}).addTo(L_fog)});
}
function drawShip(){L_ship.clearLayers();LANES.forEach(l=>L.polyline(l,{pane:'shade',color:'#5fa8dc',weight:2,opacity:.45,dashArray:'6 6',interactive:false}).addTo(L_ship))}
drawShip();

function applyLens(){
  [L_heat,L_fog,L_ship].forEach(l=>map.removeLayer(l));
  if(S.lens==='activity')L_heat.addTo(map);
  if(S.lens==='quiet'){drawFog();L_fog.addTo(map)}
  if(S.lens==='shipping')L_ship.addTo(map);
  map.getPane('dots').style.opacity=S.lens==='activity'?.25:1;
  colorShade();renderModes();renderLegend();drawDots();drawPins();
}

/* minimap */
function drawMini(pts){
  const c=$('#miniC'),x=c.getContext('2d'),W=c.width,Hh=c.height;x.clearRect(0,0,W,Hh);
  const B=TH.region.b,px=(la,ln)=>[(ln-B[0][1])/(B[1][1]-B[0][1])*W,(B[1][0]-la)/(B[1][0]-B[0][0])*Hh];
  x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--line2');x.lineWidth=1;
  [...GEO.countries,...GEO.yemen].forEach(f=>f.geometry.coordinates.forEach(poly=>poly.forEach(ring=>{x.beginPath();ring.forEach((p,i)=>{const [a,b]=px(p[1],p[0]);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()})));
  (pts||[]).forEach(p=>{const [a,b]=px(p.la,p.ln);x.globalAlpha=.75*p.a;x.fillStyle=p.col;x.fillRect(a-1,b-1,2.4,2.4)});x.globalAlpha=1;
  const v=map.getBounds();const [l,t]=px(v.getNorth(),v.getWest()),[r,bm]=px(v.getSouth(),v.getEast());x.strokeStyle='#f4a58a';x.lineWidth=2;x.strokeRect(l,t,r-l,bm-t);
}
$('#mini').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),B=TH.region.b;map.flyTo([B[1][0]-(e.clientY-r.top)/r.height*(B[1][0]-B[0][0]),B[0][1]+(e.clientX-r.left)/r.width*(B[1][1]-B[0][1])],map.getZoom(),{duration:.6})};

let zTimer;map.on('zoomend moveend',()=>{clearTimeout(zTimer);zTimer=setTimeout(()=>{drawPins();drawLabels();drawMini(dotList(S.end,Math.max(S.span,DAY)));if(S.lens==='activity')heat(dotList(S.end,Math.max(S.span,DAY)));clipCompare()},80)});

/* ---------- selection card (command card) ---------- */
function mixBar(r){const all=[r.s,...r.also];const n={official:0,wire:0,media:0,party:0};all.forEach(s=>n[srcType(s)]++);
  return `<div class="mix">${Object.entries(n).map(([k,v])=>v?`<i style="width:${v/all.length*100}%;background:${STYPE[k][1]}"></i>`:'').join('')}</div><div class="mixl">${Object.entries(n).filter(([k,v])=>v).map(([k,v])=>`<span>${STYPE[k][0]} ${v}</span>`).join('')}</div>`}
function knockOn(r){ // follow-on reports (editor-linked in the real build)
  const keys=r.c.includes('hormuz')?/oil|crude|Hormuz|tanker|shipping|insur/i:r.c.includes('redsea')?/Suez|shipping|container|Red Sea|insur/i:r.t==='strike'?/flight|airport|airline|suspen|evacuat|school/i:null;
  if(!keys)return [];return R.filter(x=>x.ms>r.ms&&x.ms<r.ms+2*DAY&&x.t==='economy'&&keys.test(x.h)).slice(-3).reverse();}
function select(r,fly=true){
  if(fly&&r.la!=null)map.flyTo([r.la,r.ln],Math.max(map.getZoom(),7),{duration:1});
  const ko=knockOn(r);const th=r.parent?byId.get(r.parent):null;const kids=r.kids.map(i=>byId.get(i));
  $('#sel').innerHTML=`<button class="x" onclick="this.parentNode.classList.remove('show')" aria-label="Close">✕</button>
   <div class="meta"><span class="tyl" style="background:${CAT[r.t]?.col}">${CAT[r.t]?.name||r.t}</span><span>${dmy(r.ms)} ${hm(r.ms)}</span>${r.pl?`<a href="#" data-place="${esc(r.pl)}">${esc(r.pl)}</a>`:''}<span style="color:var(--accent);font-weight:600">${esc(r.s)}</span></div>
   <h4>${esc(r.h)}</h4>${r.b?`<p class="body">${gloss(r.b.slice(0,280))}${r.b.length>280?'…':''}</p>`:''}
   ${mixBar(r)}
   <div class="acts"><button data-open="${r.id}">Full report</button>${r.pl?`<button data-follow="${esc(r.pl)}">${follow.includes(r.pl)?'★ Following':'☆ Follow '+esc(r.pl)}</button>`:''}<button data-near="${r.id}">Nearby</button><button data-sharer="${r.id}">Link</button></div>
   ${th||kids.length?`<div class="chain"><div class="kicker">Thread</div>${[th,...kids].filter(Boolean).slice(0,4).map(k=>`<div class="step" data-sel="${k.id}">${hm(k.ms)} · ${esc(k.h)}</div>`).join('')}</div>`:''}
   ${ko.length?`<div class="chain"><div class="kicker">Knock-on</div>${ko.map(k=>`<div class="step" data-sel="${k.id}">${hm(k.ms)} · ${esc(k.h)}</div>`).join('')}</div>`:''}`;
  $('#sel').classList.add('show');
}

/* ---------- focus bar ---------- */
function renderFocusBar(){
  const newIn=id=>R.some(r=>r.ms>lastVisit&&(id==='region'||r.c.includes(id)));
  const fb=T.map((t,i)=>`<button class="fbtn ${S.focus===t.id&&!S.war?'on':''}" data-focus="${t.id}" title="${esc(t.ctx||'Everything, one map')}">${flag(t.id)}${t.name}${i<10&&i>0?`<span class="n">${i}</span>`:''}${t.id!=='region'&&newIn(t.id)&&S.focus!==t.id?'<span class="hot" title="New since your last visit"></span>':''}</button>`);
  $('#focusbar').innerHTML=`<div class="fb-group">${fb[0]}</div><span class="fb-sep"></span><span class="fb-label">Countries &amp; seas</span><div class="fb-group">${fb.slice(1).join('')}</div><span class="fb-sep"></span><span class="fb-label">Wars</span><div class="fb-group">${Object.values(WARS).map(w=>`<button class="fbtn ${S.war===w.id?'on':''}" data-war="${w.id}">${w.name}<span class="n">day ${Math.floor((NOW-w.start)/DAY)+1}</span></button>`).join('')}</div><span class="fb-sep"></span><div class="fb-group"><button class="fbtn ${S.focus==='following'?'on':''}" data-focus="following"><span class="star">★</span>Following<span class="n">${follow.length}</span></button></div>`;
}

/* ---------- key event (tier-1 alert) ---------- */
const KEY=(()=>{const base=R.find(r=>/Houthi missiles strike Al-Maasheeq/i.test(r.h))||R.find(r=>r.t==='strike');return {...base,h:BRIEF.yemen.lines[0]||base.h,la:base.la??12.79,ln:base.ln??45.03,pl:base.pl||'Aden'}})();
function renderKey(){
  if(LS.get('keyx',0)===KEY.id){$('#keyEvent').innerHTML='';return}
  $('#keyEvent').innerHTML=`<div class="keyev"><span class="kicker" style="color:var(--accent2)">Key event</span><a href="#" data-open="${KEY.id}" style="font-family:var(--serif);font-size:16px;text-decoration:none;color:var(--head)">${esc(KEY.h)}</a><span class="kmeta">${hm(KEY.ms)} · ${esc(KEY.s)}</span><button class="pill" data-tp="1" style="margin-left:auto">Full view</button><button class="pill" data-keyx="1" aria-label="Dismiss">✕</button></div>`;
}

/* ---------- lead (front page top) ---------- */
function leadPick(){const L=R.filter(r=>inFocus(r)&&r.ms<=S.end);const hard=L.filter(r=>['strike','combat','vessel'].includes(r.t));
  const sc=r=>r.also.length*3+(r.tier==='agency'?2:0)+(r.ex?1:0)+(r.pl?1:0)-(S.end-r.ms)/(3*H);const lead=[...hard].slice(0,60).sort((a,b)=>sc(b)-sc(a))[0]||L[0];const side=[];const used=new Set([lead?.t]);
  for(const r of L){if(side.length>=3)break;if(r===lead)continue;if(!used.has(r.t)||side.length>=2){side.push(r);used.add(r.t)}}return {lead,side}}
function briefFor(){
  if(S.war){const B=BRIEF[S.war];return {lines:B.lines,secs:B.sections}}
  if(S.focus==='region')return {lines:[BRIEF.yemen.lines[0],BRIEF.iran.lines[0]],secs:[]};
  const secs=[...BRIEF.yemen.sections,...BRIEF.iran.sections].filter(s=>(BRIEFMAP[s.name]||(S.focus==='yemen'&&BRIEF.yemen.sections.includes(s)?['yemen']:[])).includes(S.focus));
  return {lines:secs.flatMap(s=>s.points).slice(0,1).map(p=>p.replace(/\[\[\d+\]\]/g,'')),secs};
}
function renderLead(){
  const {lead,side}=leadPick();
  const t=S.war?WARS[S.war]:TH[S.focus]||{name:'Following',ctx:'The places you follow.'};
  const kick=S.war?`War · day ${Math.floor((NOW-WARS[S.war].start)/DAY)+1}`:S.focus==='region'?'The whole region':t.kind==='sea'?'Sea':t.kind==='actor'?'Actor':S.focus==='following'?'Your list':'Country';
  const b=briefFor();
  const daily=(S.focus==='region'&&!S.war)?`Iran war: ${b.lines[1]||''}<sup data-brief="iran">1</sup> Yemen war: ${b.lines[0]||''}<sup data-brief="yemen">2</sup>`:b.lines[0]?gloss(b.lines[0])+'<sup data-brief="1">1</sup>':'';
  renderLead.daily=daily?`<div class="daily" style="margin:0 0 12px"><span class="kicker">Today in brief · ${hm(Date.parse(BRIEF.iran.at))}</span>${daily}</div>`:'';
  $('#lead').innerHTML=lead?`<div>
    <div class="kicker">${flag(S.war?'region':S.focus)} ${esc(kick)} · <b>●</b> updated ${hm(NOW)} Sanaa${S.end<NOW-H?` · <span style="color:var(--gold)">viewing ${dmy(S.end)}</span>`:''}</div>
    <h2 data-open="${lead.id}">${esc(lead.h)}</h2>
    <p class="dek">${t.ctx&&S.focus!=='region'?gloss(t.ctx):''}</p>
    <div class="meta"><span class="src">${esc(lead.s)}</span><span>${dmy(lead.ms)} ${hm(lead.ms)}</span>${lead.pl?`<a href="#" data-place="${esc(lead.pl)}">${esc(lead.pl)}</a>`:''}${lead.c.map(c=>TH[c]?`<span class="ctag">${TH[c].name}</span>`:'').join('')}</div>
  </div>
  <div class="side">${side.map(r=>`<div class="it" data-open="${r.id}"><div class="kicker" style="font-size:9.5px">${CAT[r.t]?.name} · ${hm(r.ms)} · ${esc(r.s)}</div><h3>${esc(r.h)}</h3></div>`).join('')}</div>`:'<div><h2>No reports in this period</h2></div>';
}

/* ---------- HUD ---------- */
function renderModes(){
  const M=[['reports','Reports','Q'],['activity','Activity','W'],['control',S.war==='yemen'||['yemen','saudi','redsea'].includes(S.focus)?'Control':'Sides','E'],['shipping','Shipping','R'],['quiet','Quiet areas','T']];
  $('#modes').innerHTML=`<div class="ttl">Map mode</div>${M.map(m=>`<button data-lens="${m[0]}" class="${S.lens===m[0]?'on':''}">${m[1]}<span class="k">${m[2]}</span></button>`).join('')}<hr>
   <label><input type="checkbox" data-tg="claims" ${S.claims?'checked':''}>Hollow pins (claims)</label>
   <label><input type="checkbox" data-tg="arcs" ${S.arcs?'checked':''}>Launch → target</label>
   <label><input type="checkbox" data-tg="compare" ${S.compare?'checked':''}>Compare with 30 days earlier</label>`;
}
function renderLegend(){
  let h='';
  if(S.lens==='control'&&(S.war==='yemen'||['yemen','saudi','redsea'].includes(S.focus)))h=`<span><i style="background:#c45c26"></i>Houthi forces</span><span><i style="background:#3fb0b3"></i>Government</span><span><i style="background:#e3b64d"></i>Contested</span><span style="color:var(--faint)">${gloss('assessed control')}, as of 12 Oct</span>`;
  else if(S.lens==='control')h=`<span><i style="background:#e2694f"></i>Iran</span><span><i style="background:#5fa8dc"></i>Israel, US</span><span><i style="background:#d9aa45"></i>Hezbollah</span><span><i style="background:#c9895a"></i>Iraqi militias</span><span><i style="background:#9b7fd1"></i>Gulf states, others hit</span>`;
  else if(S.lens==='activity')h=`<span><i style="background:#7a3526"></i>Few</span><span><i style="background:#e2694f"></i>More</span><span><i style="background:#f4a58a"></i>Most reports</span>`;
  else if(S.lens==='quiet')h=`<span><i style="background:#000;border:1px solid var(--line2)"></i>No reports in this period: no news, not calm</span>`;
  else h=CATS.slice(1,4).map(c=>`<span><i style="background:${c.col}"></i>${c.name}</span>`).join('')+`<span><i style="border:1.5px dashed var(--muted)"></i>${gloss('Hollow pin')}</span>`;
  $('#legend').innerHTML=h;
}
function renderFigs(){
  if(S.focus==='region'&&!S.war){$('#figs').classList.add('hide');return}$('#figs').classList.remove('hide');
  const L=R.filter(inFocus),a=L.filter(r=>r.ms>S.end-DAY&&r.ms<=S.end),b=L.filter(r=>r.ms>S.end-2*DAY&&r.ms<=S.end-DAY);
  const d=(x,y)=>{const v=x-y;return v?`${v>0?'+':''}${v}`:''};
  const n=t=>a.filter(r=>r.t===t).length,m=t=>b.filter(r=>r.t===t).length;
  const wars=(S.war?[S.war]:TH[S.focus]?.wars||[]);
  const f=[['Reports 24 h',a.length,d(a.length,b.length)],['Strikes',n('strike'),d(n('strike'),m('strike'))],['Fighting',n('combat'),d(n('combat'),m('combat'))],['Shipping',n('vessel'),d(n('vessel'),m('vessel'))],...wars.map(w=>[WARS[w].name,'day '+(Math.floor((NOW-WARS[w].start)/DAY)+1),''])];
  $('#figs').innerHTML=f.map(x=>`<div title="From the desk's own reports, change vs the 24 h before"><small>${x[0]}</small><b>${x[1]}</b>${x[2]?`<i>${x[2]}</i>`:''}</div>`).join('');
}
function renderSince(){
  const n=R.filter(r=>r.ms>lastVisit&&inFocus(r)).length;
  $('#since').innerHTML=`Since your last visit (${Math.round((NOW-lastVisit)/H)} h): <b>${n} new</b>`;
  // tier-2: bursts grouped by area (never one chip per pin)
  const g={};R.filter(r=>r.ms>NOW-2*H&&inFocus(r)).forEach(r=>{const k=r.pl||(S.focus!=='region'&&TH[S.focus]?TH[S.focus].name:TH[r.c[0]]?.name);if(k)g[k]=(g[k]||0)+1});
  $('#chips').innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`<span class="chip" data-place="${esc(k)}">${v} new · ${esc(k)} · 2 h</span>`).join('');
}

/* ---------- replay strip ---------- */
const rng=$('#range');
function drawTrack(){
  const c=$('#trackC'),w=c.clientWidth*2;if(!w)return;c.width=w;const x=c.getContext('2d');
  const days=Math.ceil((NOW-START)/DAY),bars=new Array(days).fill(0);const b=S.war?WARS[S.war].b:TH[S.focus]?.b||TH.region.b;
  [...PINS,...HIST].forEach(p=>{if(inB(p.la,p.ln,b)){const i=Math.floor((NOW-p.ms)/DAY);if(i>=0&&i<days)bars[i]++}});
  const mx=Math.max(...bars),bw=w/days;
  bars.forEach((v,i)=>{const bx=w-(i+1)*bw,h=Math.sqrt(v/mx)*46;const inw=NOW-i*DAY<=S.end&&NOW-i*DAY>S.end-Math.max(S.span,DAY);x.fillStyle=inw?'#e2694f':'#4a433d';x.fillRect(bx+.5,56-h,Math.max(1,bw-1),h)});
  x.fillStyle='#766b62';x.font='18px JetBrains Mono';x.fillText(dmy(START),4,18);
  const wy=Math.floor((NOW-WARS.yemen.start)/DAY);if(wy<days){x.fillStyle='#c45c26';x.fillRect(w-wy*bw,0,2,60);x.fillText('Yemen war',w-wy*bw+6,18)}
}
function setEnd(ms,fromSlider){S.end=Math.min(NOW,Math.max(START+DAY,ms));if(!fromSlider)rng.value=Math.round((S.end-START)/(NOW-START)*1000);
  $('#thumb').style.left=`calc(${rng.value/10}% - 1px)`;$('#thumbLbl').textContent=S.end>=NOW-30*60e3?'Now':dmy(S.end);
  const sp=S.span===DAY?'24 h':S.span===7*DAY?'7 days':'30 days';$('#when').innerHTML=`<button class="pill" id="spanBtn" title="Period">${sp}</button>`;
  drawTrack();drawDots();drawPins();renderFeed();renderLead();renderFigs();if(S.compare)labelsCompare()}
rng.oninput=()=>setEnd(START+rng.value/1000*(NOW-START),true);
let playT=null,speed=1;
$('#play').onclick=()=>{if(playT){clearInterval(playT);playT=null;$('#play').textContent='▶';return}
  if(S.end>=NOW-H)setEnd(Math.max(START+DAY,NOW-45*DAY));$('#play').textContent='❚❚';
  playT=setInterval(()=>{if(S.end>=NOW){clearInterval(playT);playT=null;$('#play').textContent='▶';return}setEnd(S.end+DAY*speed/4)},250)};
$('#speed').onclick=()=>{speed=speed===1?4:speed===4?16:1;$('#speed').textContent=`${speed} day${speed>1?'s':''}/s`};
document.addEventListener('click',e=>{if(e.target.id==='spanBtn'){S.span=S.span===DAY?7*DAY:S.span===7*DAY?30*DAY:DAY;setEnd(S.end)}});

/* ---------- compare (two dates side by side) ---------- */
let swX=.5;
function clipCompare(){
  const pa=map.getPane('cmpA'),pb=map.getPane('dots'),sw=$('#swipe');
  if(!S.compare){pa.style.clip='';pb.style.clip='';sw.classList.remove('show');return}
  sw.classList.add('show');const sz=map.getSize(),x=sz.x*swX;sw.style.left=x+'px';
  const nw=map.containerPointToLayerPoint([0,0]),se=map.containerPointToLayerPoint(sz),cx=map.containerPointToLayerPoint([x,0]).x;
  pa.style.clip=`rect(${nw.y}px,${cx}px,${se.y}px,${nw.x}px)`;pb.style.clip=`rect(${nw.y}px,${se.x}px,${se.y}px,${cx}px)`;
}
function labelsCompare(){$('#swA').textContent=dmy(S.end-30*DAY);$('#swB').textContent=S.end>=NOW-H?'Now':dmy(S.end)}
(()=>{const h=$('#swH');let drag=false;h.addEventListener('pointerdown',e=>{drag=true;h.setPointerCapture(e.pointerId);map.dragging.disable()});
  h.addEventListener('pointermove',e=>{if(!drag)return;const r=$('#stage').getBoundingClientRect();swX=Math.min(.95,Math.max(.05,(e.clientX-r.left)/r.width));clipCompare()});
  h.addEventListener('pointerup',()=>{drag=false;map.dragging.enable()})})();
map.on('move',clipCompare);

function toggleCompare(on){S.compare=on;if(on&&S.span<7*DAY)S.span=7*DAY;renderModes();setEnd(S.end);labelsCompare();clipCompare();if(on)toast('Left: 30 days earlier · right: now. Drag the handle.')}
/* stories: many cards about one event fold into one block (keyed on a rare proper name) */
const STOP=new Set('Houthi Houthis Yemen Yemeni Saudi Arabia Iran Iranian Israel Israeli Lebanon Lebanese Iraq Iraqi Trump United States Strait Hormuz Red Sea Coalition Government Forces Minister President Official Council Ministry Sanaa Aden Taiz Marib Riyadh Tehran Beirut Washington Gulf Treasury Security Prime Foreign Defence Defense Army Military Southern Northern Western Eastern Brigade Brigades Footage Reports Report Hezbollah IRGC Arabia Senior Former Hodeidah Saada Lahj Abyan Shabwa'.split(' '));
const STORY=new Map();(()=>{const tok={};R.forEach(r=>{const ws=new Set((r.h.match(/\b(Al-|al-)?[A-Z][a-z]{4,}(\s[A-Z][a-z]{3,})?/g)||[]).filter(w=>!STOP.has(w.replace(/^(Al-|al-)/,''))&&!STOP.has(w.split(' ')[0])));ws.forEach(w=>{(tok[w]=tok[w]||[]).push(r)})});
  Object.entries(tok).filter(([w,l])=>l.length>=6&&(l[0].ms-l[l.length-1].ms)<14*H).sort((a,b)=>b[1].length-a[1].length).forEach(([w,l])=>{l.forEach(r=>{if(!STORY.has(r.id))STORY.set(r.id,w)})})})();
const openStories=new Set();
/* ---------- feed ---------- */
const PAGE=40;let shown=PAGE;
function feedList(){return R.filter(r=>inFocus(r)&&r.ms<=S.end&&(S.cat==='all'||r.t===S.cat)&&(!S.q||S.q.test(r.h)))}
function card(r,small){const c=CAT[r.t]?.col||'#766b62';const nw=r.ms>lastVisit;
  return `<div class="card ${nw?'new':''} ${isClaim(r)?'claimc':''}" data-sel="${r.id}"><span class="edge" style="background:${c}"></span><div>
   <div class="m"><span>${dmy(r.ms)===dmy(NOW)?'':dmy(r.ms)+' '}${hm(r.ms)}</span><span class="src">${esc(r.s)}</span>${small?'':r.c.slice(0,3).map(x=>TH[x]&&x!==S.focus?`<span class="ctag" data-focus="${x}">${TH[x].name}</span>`:'').join('')}</div>
   <h3>${esc(r.h)}</h3>
   <div class="sub">${r.pl?`<a href="#" data-place="${esc(r.pl)}">◉ ${esc(r.pl)}</a>`:''}${r.also.length?`<span>Also: <b>${r.also.slice(0,3).map(esc).join(', ')}</b></span>`:''}${r.kids.length&&!small?`<a href="#" data-thread="${r.id}">Thread · ${r.kids.length} more</a>`:''}</div>
   </div>${r.pl?`<button class="star ${follow.includes(r.pl)?'on':''}" data-follow="${esc(r.pl)}" title="Follow ${esc(r.pl)}">${follow.includes(r.pl)?'★':'☆'}</button>`:'<span></span>'}</div>
   ${openThreads.has(r.id)?`<div class="thread">${r.kids.map(i=>card(byId.get(i),true)).join('')}</div>`:''}`}
const openThreads=new Set();
function renderFeed(){
  const all=feedList();const top=all.filter(r=>!r.parent||!all.some(x=>x.id===r.parent));
  const counts={};R.filter(r=>inFocus(r)&&r.ms<=S.end).forEach(r=>counts[r.t]=(counts[r.t]||0)+1);
  const title=S.war?WARS[S.war].name:S.focus==='region'?'Latest reports':`${TH[S.focus]?.name||'Following'}: latest`;
  let body='';
  if(S.view==='cards'){const seenS=new Set();const dev={};all.forEach(r=>{const st=STORY.get(r.id);if(st&&S.end-r.ms<12*H)(dev[st]=dev[st]||[]).push(r)});const devS=Object.entries(dev).filter(([k,l])=>l.length>=6);devS.forEach(([k])=>seenS.add(k));body=devS.map(([st,L])=>{const open=openStories.has(st);return `<div class="story"><button class="storyh" data-story="${esc(st)}"><span class="kicker" style="color:var(--accent2)">Developing story</span><b>${esc(st)}</b><span>${L.length} reports · ${hm(L[L.length-1].ms)}–${hm(L[0].ms)}</span><span class="tg">${open?'Fold':'All '+L.length}</span></button>${(open?L:L.slice(0,3)).map(x=>card(x,true)).join('')}</div>`}).join('')+top.filter(r=>!seenS.has(STORY.get(r.id))).slice(0,shown).map(r=>{const st=STORY.get(r.id);if(!st)return card(r);if(seenS.has(st))return '';seenS.add(st);const L=top.filter(x=>STORY.get(x.id)===st);if(L.length<3)return card(r);const open=openStories.has(st);return `<div class="story"><button class="storyh" data-story="${esc(st)}"><span class="kicker" style="color:var(--accent)">Story</span><b>${esc(st)}</b><span>${L.length} reports · ${hm(L[L.length-1].ms)}–${hm(L[0].ms)}</span><span class="tg">${open?'Fold':'All '+L.length}</span></button>${(open?L:L.slice(0,2)).map(x=>card(x)).join('')}</div>`}).join('')+(top.length>shown?`<button class="more" id="moreBtn">More reports (${top.length-shown})</button>`:'');}
  else if(S.view==='log')body=`<div class="log">${all.slice(0,200).map(r=>`<div data-sel="${r.id}"><span class="t">${hm(r.ms)}</span><span style="color:${CAT[r.t]?.col}">${(CAT[r.t]?.name||r.t).toUpperCase()}</span><span class="t">${esc((r.pl||TH[r.c[0]]?.name||'').slice(0,13))}</span><span>${esc(r.h)}</span></div>`).join('')}</div>`;
  else body=ledger(all);
  $('#feedCol').innerHTML=`${renderLead.daily||''}<div class="sech"><h2>${esc(title)}<small>${S.end<NOW-H?'to '+dmy(S.end)+' '+hm(S.end):'live'}${S.q?` · actor filter <a href="#" id="clearQ">clear</a>`:''}</small></h2>
    <span class="views" id="viewSeg"><button data-v="cards" class="${S.view==='cards'?'on':''}">Cards</button><button data-v="log" class="${S.view==='log'?'on':''}">Log</button><button data-v="table" class="${S.view==='table'?'on':''}">Table</button></span></div>
    <div class="cats">${CATS.map(c=>`<button data-cat="${c.id}" class="${S.cat===c.id?'on':''}">${c.col?`<i style="background:${c.col}"></i>`:''}${c.name}${c.id!=='all'?`<span class="c">${counts[c.id]||0}</span>`:''}</button>`).join('')}</div>${body}`;
  if(S.cmd)renderRail();
}

/* ---------- ledger (EU4) ---------- */
let ledgerTab='places',ledgerSort={k:'n',d:-1};
function ledger(list){
  let rows=[],cols=[];
  if(ledgerTab==='places'){const g={};list.forEach(r=>{if(!r.pl)return;const k=r.pl;g[k]=g[k]||{name:k,area:TH[r.c[0]]?.name||'',n:0,strike:0,combat:0,vessel:0,last:0};g[k].n++;if(g[k][r.t]!=null)g[k][r.t]++;g[k].last=Math.max(g[k].last,r.ms)});rows=Object.values(g);cols=[['name','Place'],['area','Area'],['n','Reports',1],['strike','Strikes',1],['combat','Fighting',1],['vessel','Shipping',1],['last','Latest']]}
  else if(ledgerTab==='sources'){const g={};list.forEach(r=>{g[r.s]=g[r.s]||{name:r.s,type:STYPE[srcType(r.s)][0],n:0,lead:0};g[r.s].n++});rows=Object.values(g);cols=[['name','Source'],['type','Type'],['n','Reports',1]]}
  else {const g={};list.forEach(r=>{const k=tz3(r.ms).toISOString().slice(0,10);g[k]=g[k]||{name:k,n:0,strike:0,combat:0,vessel:0,diplomacy:0,economy:0,statement:0};g[k].n++;g[k][r.t]++});rows=Object.values(g);cols=[['name','Day'],['n','Reports',1],['strike','Strikes',1],['combat','Fighting',1],['vessel','Shipping',1],['diplomacy','Diplomacy',1],['statement','Statements',1],['economy','Economy',1]]}
  rows.sort((a,b)=>(a[ledgerSort.k]>b[ledgerSort.k]?1:-1)*ledgerSort.d);const mx=Math.max(1,...rows.map(r=>r.n||0));
  ledger.rows=rows;ledger.cols=cols;
  return `<div class="cats" style="align-items:center">${[['places','Places'],['sources','Sources'],['days','Days']].map(([k,n])=>`<button data-ltab="${k}" class="${ledgerTab===k?'on':''}">${n}</button>`).join('')}<button class="pill" id="csvBtn" style="margin-left:auto">Download CSV</button></div>
   <div style="overflow-x:auto"><table class="tbl"><tr>${cols.map(c=>`<th data-sort="${c[0]}">${c[1]}${ledgerSort.k===c[0]?(ledgerSort.d<0?' ↓':' ↑'):''}</th>`).join('')}</tr>
   ${rows.slice(0,60).map(r=>`<tr>${cols.map(c=>c[0]==='last'?`<td>${ago(r.last)}</td>`:c[0]==='name'&&ledgerTab==='places'?`<td><a href="#" data-place="${esc(r.name)}">${esc(r.name)}</a></td>`:c[2]?`<td class="num">${c[0]==='n'?`<span class="bar" style="width:${r.n/mx*50}px;margin-right:6px"></span>`:''}${r[c[0]]||''}</td>`:`<td>${esc(r[c[0]])}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

/* ---------- side column: dossier / region ---------- */
function actors(list){
  const A=[['Houthi forces',/Houthi|Ansar Allah/i,'#c45c26'],['Government forces',/government forces|Giants|Southern forces|Yemeni (army|military)/i,'#3fb0b3'],['Saudi-led coalition',/coalition|Saudi (forces|artillery|air)/i,'#2f8f62'],['Iran / IRGC',/Iran|IRGC/i,'#e2694f'],['Israel',/Israel|IDF/i,'#5fa8dc'],['United States',/\bUS\b|U\.S\.|Trump|Treasury|CENTCOM|Pentagon/i,'#8fa9c8'],['Hezbollah',/Hezbollah/i,'#d9aa45'],['Iraqi militias',/Iraqi (militia|faction)|Kataib|PMF/i,'#c9895a']];
  return A.map(([n,re,c])=>{const L=list.filter(r=>re.test(r.h));return {n,re,c,count:L.length,last:L[0]}}).filter(a=>a.count).sort((a,b)=>b.count-a.count).slice(0,6);
}
function clock24(list){ // hour of day (Sanaa time) of strikes and fighting
  const h=new Array(24).fill(0);list.filter(r=>r.t==='strike'||r.t==='combat').forEach(r=>h[tz3(r.ms).getUTCHours()]++);const mx=Math.max(1,...h);
  const seg=h.map((v,i)=>{const a0=(i/24)*Math.PI*2-Math.PI/2,a1=((i+1)/24)*Math.PI*2-Math.PI/2,r0=18,r1=18+v/mx*28;
    const p=(r,a)=>`${50+r*Math.cos(a)},${50+r*Math.sin(a)}`;return `<path d="M${p(r0,a0)}L${p(r1,a0)}A${r1} ${r1} 0 0 1 ${p(r1,a1)}L${p(r0,a1)}A${r0} ${r0} 0 0 0 ${p(r0,a0)}z" fill="#e2694f" fill-opacity="${.3+.7*v/mx}"><title>${i}:00 · ${v}</title></path>`}).join('');
  const peak=h.indexOf(Math.max(...h));
  return `<div class="clock24"><svg viewBox="0 0 100 100" width="110" height="110">${seg}<circle cx="50" cy="50" r="17" fill="none" stroke="var(--line2)"/><text x="50" y="12" font-size="7" text-anchor="middle" fill="var(--muted)">00</text><text x="50" y="96" font-size="7" text-anchor="middle" fill="var(--muted)">12</text><text x="93" y="52" font-size="7" text-anchor="middle" fill="var(--muted)">06</text><text x="7" y="52" font-size="7" text-anchor="middle" fill="var(--muted)">18</text></svg><p>Most strikes and fighting reported around <b style="color:var(--head)">${String(peak).padStart(2,'0')}:00</b> Sanaa time in this period.</p></div>`;
}
function briefBox(){
  const b=briefFor();if(!b.secs.length)return '';
  let n=0;const refs=[];
  const pts=b.secs.slice(0,S.war?6:3).map(s=>`<li><b style="font-family:var(--sans);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${esc(s.name)}</b><br>${s.points.slice(0,2).map(p=>gloss(p).replace(/\[\[(\d+)\]\]/g,(m,i)=>{const r=s.refs[i-1];if(!r)return '';refs.push(r);n++;return `<sup data-ref="${refs.length-1}">${n}</sup>`})).join(' ')}</li>`).join('');
  briefBox.refs=refs;
  return `<div class="box"><h4>Latest developments</h4><div class="kicker" style="margin-bottom:6px">From the latest reports · ${hm(Date.parse((S.war==='yemen'||(!S.war&&['yemen','saudi','redsea'].includes(S.focus))?BRIEF.yemen:BRIEF.iran).at))}</div><ol>${pts}</ol></div>`;
}
function renderSide(){
  const list=R.filter(r=>inFocus(r)&&r.ms<=S.end);
  const tools=`<div class="box"><h4>Tools</h4><div class="tools">
    <button data-tool="tour">Guided tour<small>The story in a few stops</small></button>
    <button data-tool="card">Daily map card<small>Image for X and Telegram</small></button>
    <button data-tool="embed">Embed<small>This map on another site</small></button>
    <button data-tool="compare">Compare dates<small>Now vs 30 days earlier</small></button>
    <button data-tool="intro">Last 24 hours<small>Replay the opening</small></button>
    <button data-tool="brief">Dated brief<small>Today's page, citable</small></button></div></div>`;
  if(S.focus==='region'&&!S.war){
    $('#sideCol').innerHTML=`<div class="sech"><h2>Across the region</h2></div>
     ${T.slice(1).map(t=>{const last=R.find(r=>r.c.includes(t.id));const tr=trend(t.id);return last?`<div class="warc" data-focus="${t.id}"><div class="t">${flag(t.id)}${t.name}<span class="tr ${tr[0]}" title="${tr[2]}">${tr[1]} ${tr[2]}</span></div><p>${esc(last.h)}</p><div class="meta">${ago(last.ms)} · ${esc(last.s)}</div></div>`:''}).join('')}
     <div class="sech" style="margin-top:18px"><h2>The wars</h2></div>
     ${Object.values(WARS).map(w=>`<div class="warc" data-war="${w.id}"><div class="t">${w.name}<span class="tr flat">day ${Math.floor((NOW-w.start)/DAY)+1}</span></div><p>${gloss(w.ctx)}</p><div class="meta">Control map, fronts, numbers, timeline →</div></div>`).join('')}
     ${tools}
     <div class="box"><h4>How we work</h4><p style="font-family:var(--serif);margin:0">Every report is traced to the place it first appeared and written as plain wire copy. A pin marks one event; control changes only on several independent reports. <a href="#">Methodology →</a></p></div>`;
    return;
  }
  const t=S.war?WARS[S.war]:TH[S.focus]||{name:'Following'};
  const cats=CATS.slice(1).map(c=>{const L=list.filter(r=>r.t===c.id);return `<div class="catc" data-cat="${c.id}"><small><i style="background:${c.col}"></i>${c.name}</small><b>${L.length}</b>${spark(bucket(L,24,2*H),c.col)}</div>`}).join('');
  const ac=actors(list);
  const places={};list.forEach(r=>{if(r.pl)places[r.pl]=(places[r.pl]||0)+1});
  const others=S.focus!=='region'&&!S.war&&S.focus!=='following'?R.filter(r=>r.c.includes(S.focus)&&r.la!=null&&!r.c.every(c=>c===S.focus)).slice(0,4):[];
  $('#sideCol').innerHTML=`<div class="box">${flag(S.war?'region':S.focus)}<h4 style="display:inline;margin-left:6px">${esc(t.name)}</h4>
     <p style="font-family:var(--serif);margin:6px 0">${gloss(t.ctx||'')}</p>
     <div class="places">${(S.war?WARS[S.war].theatres.map(x=>`<button class="pill" data-focus="${x}">${TH[x].name}</button>`):(TH[S.focus]?.wars||[]).map(w=>`<button class="pill" data-war="${w}">${WARS[w].name} →</button>`)).join('')}<button class="pill" data-tool="brief">Dated brief</button></div></div>
   ${briefBox()}
   <div class="box"><h4>By category</h4><div class="kicker" style="margin-bottom:6px">Reports to ${S.end<NOW-H?dmy(S.end):'now'}, every 2 hours</div><div class="catgrid">${cats}</div></div>
   ${ac.length?`<div class="box"><h4>Who is active</h4><div class="actors">${ac.map(a=>`<div class="actor" data-actor="${esc(a.n)}"><span class="em" style="background:${a.c}">${a.n.split(/[ /]+/).map(w=>w[0]).join('').slice(0,2)}</span><div><b>${gloss(a.n)}</b><small>${esc(a.last.h.slice(0,70))}…</small></div><span class="n">${a.count}</span></div>`).join('')}</div></div>`:''}
   <div class="box"><h4>Places</h4><div class="places">${Object.entries(places).sort((a,b)=>b[1]-a[1]).slice(0,14).map(([p,n])=>`<button class="pill" data-place="${esc(p)}">${follow.includes(p)?'★ ':''}${esc(p)} <span style="color:var(--faint)">${n}</span></button>`).join('')}</div></div>
   ${others.length?`<div class="box"><h4>Also involving ${esc(t.name)}</h4>${others.map(r=>card(r,true)).join('')}</div>`:''}
   <div class="box"><h4>When it happens</h4>${clock24(list)}</div>
   ${tools}`;
}

/* ---------- rail (command layout) ---------- */
let railTab='reports';
function renderRail(){
  const list=feedList();let h='';
  if(railTab==='reports')h=list.slice(0,50).map(r=>card(r,true)).join('');
  else if(railTab==='log')h=`<div class="log">${list.slice(0,200).map(r=>`<div data-sel="${r.id}"><span class="t">${hm(r.ms)}</span><span style="color:${CAT[r.t]?.col}">${(CAT[r.t]?.name||'').toUpperCase()}</span><span class="t">${esc((r.pl||'').slice(0,12))}</span><span>${esc(r.h)}</span></div>`).join('')}</div>`;
  else if(railTab==='dossier'){renderSide();h=$('#sideCol').innerHTML}
  else h=`<div class="kicker" style="margin:10px 0">Places you follow</div>${follow.map(p=>{const L=R.filter(r=>r.pl===p);return `<div class="warc" data-place="${esc(p)}"><div class="t">★ ${esc(p)}<span class="tr flat">${L[0]?ago(L[0].ms):'no reports'}</span></div>${L[0]?`<p>${esc(L[0].h)}</p>`:''}</div>`}).join('')}`;
  $('#railBody').innerHTML=h;$$('#railTabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===railTab));
}
$('#railTabs').onclick=e=>{const b=e.target.closest('button');if(b){railTab=b.dataset.t;renderRail()}};

/* ---------- sheets: report, place, brief, embed, card, turning point ---------- */
function sheet(html,cls=''){$('#sheet').className='sheet '+cls;$('#sheetIn').innerHTML=html;$('#ov').classList.add('show')}
function closeSheet(){$('#ov').classList.remove('show');if(/^#\/(r|place|brief)\//.test(location.hash))history.replaceState(null,'',hashFor())}
$('#ovX').onclick=closeSheet;$('#ov').onclick=e=>{if(e.target.id==='ov')closeSheet()};
function openReport(r){
  history.replaceState(null,'','#/r/'+r.id);
  const wars=r.w.map(w=>WARS[w]).filter(Boolean);const ko=knockOn(r);const thread=[r.parent?byId.get(r.parent):null,...r.kids.map(i=>byId.get(i))].filter(Boolean);
  sheet(`<div class="in"><div class="kicker">${CAT[r.t]?.name} · ${longDate(r.ms)} · ${hm(r.ms)} Sanaa</div>
   <h2>${esc(r.h)}</h2>
   ${r.b?`<p style="font-family:var(--serif);font-size:16px">${gloss(r.b)}</p>`:''}
   <p style="font-size:13px;color:var(--muted)"><b style="color:var(--accent)">${esc(r.s)}</b> · <a href="${esc(r.u)}" target="_blank" rel="noopener">original ↗</a>${r.also.length?` · Also: ${r.also.map(esc).join(', ')}`:''}</p>
   ${mixBar(r)}
   <table class="tbl" style="margin-top:12px"><tr><td style="width:110px;color:var(--muted)">Countries</td><td>${r.c.map(c=>TH[c]?`<button class="pill" data-focus="${c}">${flag(c)} ${TH[c].name}</button>`:'').join(' ')}</td></tr>
   <tr><td style="color:var(--muted)">Wars</td><td>${wars.map(w=>`<button class="pill" data-war="${w.id}">${w.name}</button>`).join(' ')||'—'}</td></tr>
   <tr><td style="color:var(--muted)">Place</td><td>${r.pl?`<button class="pill" data-place="${esc(r.pl)}">◉ ${esc(r.pl)}</button>${r.g?` <span style="color:var(--faint)">${esc(r.g)}</span>`:''}`:'—'}</td></tr>
   <tr><td style="color:var(--muted)">Link</td><td style="font-family:var(--mono);font-size:11.5px">thesituationroom.live/r/${r.id}</td></tr></table>
   ${thread.length?`<div class="chain"><div class="kicker">Thread</div>${thread.map(k=>`<div class="step" data-open="${k.id}">${hm(k.ms)} · ${esc(k.h)}</div>`).join('')}</div>`:''}
   ${ko.length?`<div class="chain"><div class="kicker">Knock-on</div>${ko.map(k=>`<div class="step" data-open="${k.id}">${hm(k.ms)} · ${esc(k.h)}</div>`).join('')}</div>`:''}
   <div class="acts">${r.la!=null?`<button data-showmap="${r.id}">Show on map</button>`:''}<button data-sharer="${r.id}">Copy link</button></div></div>`);
}
function openPlace(p){
  history.replaceState(null,'','#/place/'+encodeURIComponent(p));
  const L=R.filter(r=>r.pl===p);const pins=PINS.filter(x=>x.pl===p);const f=L.find(r=>r.la!=null)||pins[0];
  const days=bucket([...L,...pins.map(x=>({ms:x.ms}))],14,DAY/4);
  const types={};L.forEach(r=>types[r.t]=(types[r.t]||0)+1);
  sheet(`<div class="in"><div class="kicker">Place${f?` · ${(f.la).toFixed(2)}, ${(f.ln||f.ln).toFixed?f.ln.toFixed(2):''}`:''}${L[0]?.g?' · '+esc(L[0].g):''}</div>
   <h2>${esc(p)}</h2>
   <div class="acts" style="margin:0 0 10px"><button data-follow="${esc(p)}">${follow.includes(p)?'★ Following':'☆ Follow'}</button>${f?`<button data-flyplace="${esc(p)}">Show on map</button>`:''}</div>
   <div class="kicker">Reports here, every 6 hours</div><div style="height:40px">${spark(days,'#e2694f',600,40)}</div>
   <div class="cats" style="margin:8px 0">${Object.entries(types).map(([t,n])=>`<span class="pill"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${CAT[t]?.col}"></i> ${CAT[t]?.name} ${n}</span>`).join('')}</div>
   ${L.slice(0,25).map(r=>card(r,true)).join('')||'<p>No reports in this mock\'s data.</p>'}
   <p class="kicker" style="margin-top:10px">Every pin and report here since the war began, on one page: thesituationroom.live/place/${encodeURIComponent(p.toLowerCase())}</p></div>`);
}
function openBrief(){
  const key=S.war||(['yemen','saudi','redsea'].includes(S.focus)?'yemen':'iran');const B=BRIEF[key];const d=tz3(Date.parse(B.at)).toISOString().slice(0,10);
  history.replaceState(null,'','#/brief/'+key+'/'+d);
  let n=0;const refs=[];
  sheet(`<div class="in"><div class="kicker">${WARS[key].name} · brief · ${longDate(Date.parse(B.at))} · ${hm(Date.parse(B.at))}</div><h2>${WARS[key].name}: ${dmy(Date.parse(B.at))}</h2>
   <p style="font-family:var(--serif);font-size:16px">${B.lines.slice(0,3).map(gloss).join(' ')}</p>
   ${B.sections.slice(0,8).map(s=>`<h4 style="font-family:var(--serif);font-weight:500;font-size:19px;margin:14px 0 4px;color:var(--head)">${esc(s.name)}</h4><p style="font-family:var(--serif);margin:0">${s.points.map(p=>gloss(p).replace(/\[\[(\d+)\]\]/g,(m,i)=>{const r=s.refs[i-1];if(!r)return '';refs.push(r);return `<sup style="color:var(--accent)">${refs.length}</sup>`})).join(' ')}</p>`).join('')}
   <h4 style="font-family:var(--serif);font-weight:500;font-size:17px;margin:18px 0 4px;color:var(--head)">References</h4>
   <ol style="font-size:12.5px;color:var(--muted);padding-left:20px">${refs.map(r=>`<li><a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.s)}</a>, ${dmy(Date.parse(r.at))} ${hm(Date.parse(r.at))}: ${esc(r.h)}</li>`).join('')}</ol>
   <p class="kicker">One page per war per day: thesituationroom.live/${key}/${d}</p></div>`);
}
function openRef(r){sheet(`<div class="in"><div class="kicker">Reference · ${esc(r.s)} · ${dmy(Date.parse(r.at))} ${hm(Date.parse(r.at))}</div><h2>${esc(r.h)}</h2><p><a href="${esc(r.u)}" target="_blank" rel="noopener">Open the original ↗</a></p></div>`)}
function openEmbed(){const f=S.war?'war/'+S.war:S.focus;sheet(`<div class="in"><div class="kicker">Embed</div><h2>Put this map on your site</h2><p style="font-family:var(--serif)">A live map of the last 24 hours and the latest three reports, credited and linked back.</p>
  <div class="code">&lt;iframe src="https://thesituationroom.live/embed/${f}?lens=${S.lens}&amp;period=24h" width="100%" height="480" style="border:0" loading="lazy" title="The Situation Room: ${esc(TH[S.focus]?.name||WARS[S.war]?.name)}"&gt;&lt;/iframe&gt;</div>
  <div class="acts"><button onclick="navigator.clipboard&&navigator.clipboard.writeText(this.closest('.in').querySelector('.code').textContent);toast('Code copied')">Copy code</button></div></div>`)}
function mapCanvas(W,Hh,b,dots,{grid=true}={}){
  const c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d');
  x.fillStyle='#141211';x.fillRect(0,0,W,Hh);
  const sx=W/(b[1][1]-b[0][1]),sy=Hh/(b[1][0]-b[0][0]),s=Math.min(sx,sy),ox=(W-(b[1][1]-b[0][1])*s)/2,oy=(Hh-(b[1][0]-b[0][0])*s)/2;
  const px=(la,ln)=>[ox+(ln-b[0][1])*s,oy+(b[1][0]-la)*s];
  x.strokeStyle='#4a433d';x.lineWidth=1.4;x.fillStyle='#211e1c';
  [...GEO.countries,...GEO.yemen].forEach(f=>f.geometry.coordinates.forEach(poly=>poly.forEach(ring=>{x.beginPath();ring.forEach((p,i)=>{const [a,bb]=px(p[1],p[0]);i?x.lineTo(a,bb):x.moveTo(a,bb)});x.closePath();x.fill();x.stroke()})));
  dots.forEach(p=>{const [a,bb]=px(p.la,p.ln);x.fillStyle=p.col;x.globalAlpha=.85;x.beginPath();x.arc(a,bb,Math.max(3,W/140),0,7);x.fill()});x.globalAlpha=1;return c;
}
function openCard(){
  const b=S.war?WARS[S.war].b:TH[S.focus]?.b||TH.region.b;const W=1080;
  const c=mapCanvas(W,W,b,[...dotList(NOW,DAY),...R.filter(r=>r.la!=null&&r.ms>NOW-DAY&&inFocus(r)).map(r=>({la:r.la,ln:r.ln,col:CAT[r.t]?.col||'#a99d93'}))]);const x=c.getContext('2d');
  const g=x.createLinearGradient(0,W*.55,0,W);g.addColorStop(0,'rgba(20,18,17,0)');g.addColorStop(.35,'rgba(20,18,17,.92)');g.addColorStop(1,'#141211');x.fillStyle=g;x.fillRect(0,W*.5,W,W*.5);
  x.fillStyle='#f4a58a';x.font='600 26px "Libre Franklin"';x.fillText('THE SITUATION ROOM · '+(S.war?WARS[S.war].name:TH[S.focus]?.name||'').toUpperCase(),56,W*.68);
  x.fillStyle='#fff8f1';x.font='500 58px Newsreader';x.fillText(longDate(NOW).slice(5)+' · last 24 hours',56,W*.68+70);
  x.font='32px Newsreader';x.fillStyle='#efe6dd';
  const L=R.filter(r=>inFocus(r)&&['strike','combat','vessel'].includes(r.t)).slice(0,3);let y=W*.68+130;
  L.forEach(r=>{let line='• '+r.h;while(x.measureText(line).width>W-112)line=line.slice(0,-2);x.fillText(line+(line.length<r.h.length+2?'…':''),56,y);y+=48});
  x.fillStyle='#a99d93';x.font='22px "Libre Franklin"';x.fillText('thesituationroom.live',56,W-40);
  const url=c.toDataURL('image/png');
  sheet(`<div class="in"><div class="kicker">Daily map card · made at 00:00 and 12:00</div><h2>Ready to post</h2><img src="${url}" style="width:100%;border-radius:8px;border:1px solid var(--line)" alt="Map card"><div class="acts"><a class="pill" href="${url}" download="situation-room-${S.war||S.focus}.png">Download image</a></div></div>`);
}
function openTurning(r=KEY){
  const la=r.la??12.79,ln=r.ln??45.03;const c=mapCanvas(860,260,[[la-3,ln-9],[la+3,ln+9]],dotList(r.ms+H,DAY));const x=c.getContext('2d');
  const [a,b]=[430,130];x.strokeStyle='#f4a58a';x.lineWidth=2;x.beginPath();x.arc(a,b,14,0,7);x.stroke();
  sheet(`<div class="img"></div><div class="in"><div class="kicker" style="color:var(--accent2)">Key event · ${longDate(r.ms)} · ${hm(r.ms)}</div><h2>${esc(r.h)}</h2><p>${r.b?gloss(r.b.slice(0,300)):gloss(TH[r.c[0]]?.ctx||'')}</p>
   <div class="acts"><button data-open="${r.id}">Read the report</button><button data-showmap="${r.id}">Show on map</button></div></div>`,'tp');
  $('#sheet .img').appendChild(c);
}

/* ---------- guided tour (Google Earth Voyager) ---------- */
let tourStops=[],tourI=0;
function startTour(){
  const ids=S.war?WARS[S.war].theatres.filter(x=>x!=='us'):S.focus==='region'?['yemen','redsea','saudi','iran','hormuz','lebanon','israel']:[S.focus];
  tourStops=[{b:S.war?WARS[S.war].b:TH[S.focus]?.b||TH.region.b,t:S.war?WARS[S.war].name:TH[S.focus]?.name||'The region',p:S.war?WARS[S.war].ctx:TH[S.focus]?.ctx||'Two wars on one map: Yemen since July, Iran since February, joined at sea and in the Gulf.'}];
  ids.forEach(id=>{const last=R.find(r=>r.c.includes(id)&&['strike','combat','vessel'].includes(r.t))||R.find(r=>r.c.includes(id));if(!last)return;
    tourStops.push({b:last.la!=null?null:TH[id].b,ll:last.la!=null?[last.la,last.ln]:null,t:TH[id].name,p:`${TH[id].ctx} Latest: ${last.h} (${ago(last.ms)}).`,id:last.id})});
  tourI=0;tourGo();
}
function tourGo(){const s=tourStops[tourI];if(!s)return endTour();
  if(s.ll)map.flyTo(s.ll,7,{duration:1.4});else map.flyToBounds(s.b,{duration:1.4,...pad()});
  if(s.id)select(byId.get(s.id),false);
  $('#tour').innerHTML=`<div class="kicker">Guided tour · ${tourI+1} of ${tourStops.length}</div><h4>${esc(s.t)}</h4><p>${gloss(s.p)}</p><div class="nav"><button id="tPrev" ${tourI?'':'disabled style="opacity:.3"'}>← Back</button><button id="tEnd" style="color:var(--muted)">End tour</button><button id="tNext">${tourI<tourStops.length-1?'Next →':'Finish'}</button></div>`;
  $('#tour').classList.add('show')}
function endTour(){$('#tour').classList.remove('show');$('#sel').classList.remove('show');go(S.focus,S.war)}
$('#tour').onclick=e=>{if(e.target.id==='tNext'){tourI++;tourGo()}if(e.target.id==='tPrev'){tourI--;tourGo()}if(e.target.id==='tEnd')endTour()};

/* ---------- opening: zoom in from far, then the last 24 hours appear in order ---------- */
let introT=null;
function intro(){
  const lay=R.filter(r=>r.la!=null&&r.ms>NOW-DAY).sort((a,b)=>a.ms-b.ms);
  $('#intro').classList.add('show');$('#introTxt').textContent='The region, last 24 hours';
  map.setView([26,47],3,{animate:false});L_pins.clearLayers();L_theatre.clearLayers();
  setTimeout(()=>map.flyToBounds(TH.region.b,{duration:2.2}),200);
  let i=0;const tmp=L.layerGroup().addTo(map);
  introT=setTimeout(function step(){const r=lay[i++];if(!r){finishIntro(tmp);return}
    L.circleMarker([r.la,r.ln],{radius:4,weight:1,color:'#fff8f1',fillColor:CAT[r.t]?.col,fillOpacity:1}).addTo(tmp);$('#introTxt').textContent=`${dmy(r.ms)} ${hm(r.ms)} · ${r.pl||TH[r.c[0]]?.name||''}`;introT=setTimeout(step,Math.max(18,4200/lay.length))},2500);
  $('#skipIntro').onclick=()=>finishIntro(tmp);
}
function finishIntro(tmp){clearTimeout(introT);map.removeLayer(tmp);$('#intro').classList.remove('show');LS.set('intro',1);go(S.focus,S.war,true)}

/* ---------- glossary tooltips, nested (CK3 / Victoria 3) ---------- */
const tips=[];let tipHide;
function showTip(el,depth){
  while(tips.length>depth)tips.pop().remove();
  const k=el.dataset.t;const d=document.createElement('div');d.className='tip glass';d.innerHTML=`<b>${esc(k)}</b>${gloss(TERMS[k],new Set([k]))}`;
  document.body.appendChild(d);const r=el.getBoundingClientRect();const w=Math.min(300,innerWidth-20);d.style.width=w+'px';
  d.style.left=Math.min(innerWidth-w-10,Math.max(10,r.left))+'px';d.style.top=(r.bottom+6+scrollY)+'px';d.dataset.depth=depth;tips.push(d);
}
document.addEventListener('mouseover',e=>{const t=e.target.closest('.term');const tip=e.target.closest('.tip');
  if(t){clearTimeout(tipHide);const depth=tip?+tip.dataset.depth+1:0;if(tips[depth]?.querySelector('b')?.textContent!==t.dataset.t)showTip(t,depth);return}
  if(tip){clearTimeout(tipHide);return}
  if(tips.length){clearTimeout(tipHide);tipHide=setTimeout(()=>{while(tips.length)tips.pop().remove()},350)}});
document.addEventListener('click',e=>{const t=e.target.closest('.term');if(t&&!('ontouchstart' in window))return;if(t){e.preventDefault();showTip(t,e.target.closest('.tip')?+e.target.closest('.tip').dataset.depth+1:0)}else if(!e.target.closest('.tip'))while(tips.length)tips.pop().remove()},true);

/* ---------- routing, share links ---------- */
const pad=()=>innerWidth<=860?{padding:[10,10]}:{paddingTopLeft:[190,70],paddingBottomRight:[S.cmd?390:60,60]};
function hashFor(){const base=S.war?'#/war/'+S.war:S.focus==='region'?'#/':'#/'+S.focus;const q=[];if(S.lens!=='reports')q.push('lens='+S.lens);if(S.cat!=='all')q.push('cat='+S.cat);if(S.end<NOW-H)q.push('to='+tz3(S.end).toISOString().slice(0,13));if(S.span!==DAY)q.push('days='+Math.round(S.span/DAY));return base+(q.length?'?'+q.join('&'):'')}
function shareURL(){const c=map.getCenter();return 'https://thesituationroom.live/'+hashFor().slice(2).replace(/^\?/,'?')+(hashFor().includes('?')?'&':'?')+`map=${map.getZoom()}/${c.lat.toFixed(2)}/${c.lng.toFixed(2)}`}
let firstGo=true;
function go(focus,war=null,instant=false){
  S.focus=focus||'region';S.war=war;shown=PAGE;S.q=null;
  const t=war?WARS[war]:TH[S.focus];
  if(!war&&t?.lens)S.lens=t.lens;else if(war==='yemen'&&S.lens==='reports'){}
  const b=war?WARS[war].b:S.focus==='following'?TH.region.b:t.b;
  if(firstGo||instant){map.fitBounds(b,{animate:false,...pad()});firstGo=false}else map.flyToBounds(b,{duration:1.5,easeLinearity:.25,...pad()});
  document.body.classList.toggle('home',S.focus==='region'&&!war);
  if(!/^#\/(r|place|brief)\//.test(location.hash)||!instant)history.replaceState(null,'',hashFor());
  $('#sel').classList.remove('show');
  renderAll();
}
function renderAll(){renderFocusBar();renderKey();renderLead();renderModes();renderLegend();renderFigs();renderSince();colorShade();drawDots();drawPins();drawLabels();drawTrack();setEnd(S.end);renderFeed();renderSide();if(S.lens!=='reports')applyLens();clipCompare()}
function route(){
  const [path,qs]=location.hash.replace(/^#\/?/,'').split('?');const p=path.split('/');const q=new URLSearchParams(qs||'');
  if(q.get('lens'))S.lens=q.get('lens');if(q.get('cat'))S.cat=q.get('cat');if(q.get('days'))S.span=+q.get('days')*DAY;if(q.get('to'))S.end=Date.parse(q.get('to')+':00:00Z')-3*H;
  if(p[0]==='war'&&WARS[p[1]])go(null,p[1],true);
  else if(p[0]==='r'&&byId.get(+p[1])){go('region',null,true);openReport(byId.get(+p[1]))}
  else if(p[0]==='place'){go('region',null,true);openPlace(decodeURIComponent(p[1]))}
  else if(p[0]==='brief'){go(null,p[1],true);openBrief()}
  else go(TH[p[0]]||p[0]==='following'?p[0]:'region',null,true);
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-focus],[data-war],[data-place],[data-open],[data-sel],[data-follow],[data-cat],[data-lens],[data-v],[data-ltab],[data-sort],[data-thread],[data-tool],[data-actor],[data-showmap],[data-flyplace],[data-sharer],[data-near],[data-ref],[data-brief],[data-tp],[data-keyx],[data-go],[data-story]');
  if(!a)return;const d=a.dataset;
  if(a.tagName==='A'||a.tagName==='BUTTON'||d.place||d.open)e.preventDefault();
  if(d.follow!=null){e.stopPropagation();const p=d.follow;follow=follow.includes(p)?follow.filter(x=>x!==p):[...follow,p];LS.set('follow',follow);toast(follow.includes(p)?`Following ${p}`:`Stopped following ${p}`);renderFocusBar();renderFeed();if(S.focus!=='region'||S.war)renderSide();if($('#ov').classList.contains('show')&&location.hash.startsWith('#/place'))openPlace(p);return}
  if(d.go){go(d.go);return}
  if(d.focus!=null){closeSheet();go(d.focus);return}
  if(d.war){closeSheet();go(null,d.war);return}
  if(d.place){openPlace(d.place);return}
  if(d.open){openReport(byId.get(+d.open));return}
  if(d.showmap){closeSheet();select(byId.get(+d.showmap));$('#stage').scrollIntoView({behavior:'smooth',block:'center'});return}
  if(d.flyplace){closeSheet();const r=R.find(x=>x.pl===d.flyplace&&x.la!=null)||PINS.find(x=>x.pl===d.flyplace);if(r){map.flyTo([r.la,r.ln],9);$('#stage').scrollIntoView({behavior:'smooth',block:'center'})}return}
  if(d.story){openStories.has(d.story)?openStories.delete(d.story):openStories.add(d.story);renderFeed();return}
  if(d.thread){const id=+d.thread;openThreads.has(id)?openThreads.delete(id):openThreads.add(id);renderFeed();return}
  if(d.sel){select(byId.get(+d.sel));if(innerWidth<860||window.scrollY>$('#stage').offsetTop+200)$('#stage').scrollIntoView({behavior:'smooth',block:'center'});return}
  if(d.cat){S.cat=d.cat;shown=PAGE;renderFeed();drawPins();history.replaceState(null,'',hashFor());return}
  if(d.lens){S.lens=d.lens;applyLens();history.replaceState(null,'',hashFor());return}
  if(d.v){S.view=d.v;renderFeed();return}
  if(d.ltab){ledgerTab=d.ltab;ledgerSort={k:'n',d:-1};renderFeed();return}
  if(d.sort){ledgerSort={k:d.sort,d:ledgerSort.k===d.sort?-ledgerSort.d:-1};renderFeed();return}
  if(d.actor){const A=actors(R).find(x=>x.n===d.actor)||actors(R.filter(inFocus)).find(x=>x.n===d.actor);S.q=A?.re||null;renderFeed();$('#feedCol').scrollIntoView({behavior:'smooth'});return}
  if(d.sharer){navigator.clipboard?.writeText('https://thesituationroom.live/r/'+d.sharer);toast('Link copied');return}
  if(d.near){const r=byId.get(+d.near);map.flyTo([r.la,r.ln],9);S.span=7*DAY;setEnd(S.end);toast('Nearby, last 7 days');return}
  if(d.ref!=null){openRef(briefBox.refs[+d.ref]);return}
  if(d.brief){openBrief();return}
  if(d.tp){openTurning();return}
  if(d.keyx){LS.set('keyx',KEY.id);renderKey();return}
  if(d.tool){({tour:startTour,card:openCard,embed:openEmbed,compare:()=>{toggleCompare(!S.compare);if(S.compare)$('#stage').scrollIntoView({behavior:'smooth',block:'center'})},intro:()=>{$('#stage').scrollIntoView({behavior:'smooth',block:'center'});intro()},brief:openBrief})[d.tool]?.();return}
});
document.addEventListener('change',e=>{const t=e.target.dataset.tg;if(!t)return;S[t]=e.target.checked;if(t==='compare')toggleCompare(S.compare);else if(t==='names')drawLabels();else drawPins()});
document.addEventListener('click',e=>{if(e.target.id==='moreBtn'){shown+=PAGE;renderFeed()}if(e.target.id==='clearQ'){e.preventDefault();S.q=null;renderFeed()}if(e.target.id==='csvBtn'){const rows=ledger.rows,cols=ledger.cols;const csv=[cols.map(c=>c[1]).join(','),...rows.map(r=>cols.map(c=>JSON.stringify(c[0]==='last'?new Date(r.last).toISOString():r[c[0]]??'')).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='situation-room-'+ledgerTab+'.csv';a.click()}});
$('#homeLink').onclick=()=>go('region');
let alertI=0;
function jump(){const L=R.filter(r=>r.la!=null&&inFocus(r)&&r.ms<=S.end);const r=L[alertI%L.length];alertI++;if(r)select(r)}
$('#jumpBtn').onclick=jump;
$('#shareBtn').onclick=()=>{const u=shareURL();navigator.clipboard?.writeText(u);toast('Link to this exact view copied')};
$('#layoutSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;$$('#layoutSeg button').forEach(x=>x.classList.toggle('on',x===b));S.cmd=b.dataset.l==='cmd';document.body.classList.toggle('cmd',S.cmd);setTimeout(()=>{map.invalidateSize();map.fitBounds(S.war?WARS[S.war].b:TH[S.focus]?.b||TH.region.b,pad());drawTrack();renderRail()},60)};
$('#themeBtn').onclick=()=>{const day=document.documentElement.dataset.theme!=='day';document.documentElement.dataset.theme=day?'day':'';map.removeLayer(tiles);tiles=L.tileLayer(TILE(day?'Light':'Dark'),{maxZoom:16,attribution:'Esri, HERE, Garmin, © OpenStreetMap'}).addTo(map);drawMini(dotList(S.end,DAY));LS.set('theme',day?'day':'')};
$('#helpBtn').onclick=()=>sheet(`<div class="in"><div class="kicker">Keys</div><h2>Moving around</h2><table class="tbl">${[['0','Whole region'],['1 – 9','A country or sea'],['Q W E R T','Map modes'],['Space','Fly to the newest report, again for the one before'],['← →','A day back or forward'],['C','Compare with 30 days earlier'],['Esc','Close']].map(r=>`<tr><td><span class="k">${r[0]}</span></td><td>${r[1]}</td></tr>`).join('')}</table></div>`);
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='escape'){closeSheet();$('#sel').classList.remove('show');return}
  if(k===' '){e.preventDefault();jump();return}
  if(/^[0-9]$/.test(k)){const t=T[+k];if(t)go(t.id);return}
  const L={q:'reports',w:'activity',e:'control',r:'shipping',t:'quiet'}[k];if(L){S.lens=L;applyLens();return}
  if(k==='arrowleft')setEnd(S.end-DAY);if(k==='arrowright')setEnd(S.end+DAY);
  if(k==='c')toggleCompare(!S.compare);
  if(k==='?')$('#helpBtn').click()});
window.addEventListener('resize',()=>{drawTrack();clipCompare()});

/* clocks and dateline */
function tick(){const t=Date.now();const f=o=>new Date(t+o*H).toISOString().slice(11,16);
  $('#clocks').innerHTML=`Sanaa <b>${f(3)}</b> · Tehran <b>${f(3.5)}</b><br>Beirut <b>${f(3)}</b> · Washington <b>${f(-4)}</b>`}
setInterval(tick,30000);tick();
$('#dateline').innerHTML=`<b>${longDate(NOW)}</b><br>Yemen war, day ${Math.floor((NOW-WARS.yemen.start)/DAY)+1} · Iran war, day ${Math.floor((NOW-WARS.iran.start)/DAY)+1}`;

/* start */
if(LS.get('theme','')==='day')$('#themeBtn').click();
route();
window.addEventListener('hashchange',()=>{if(!/^#\/(r|place|brief)\//.test(location.hash))route()});
setTimeout(()=>{LS.set('last',NOW)},4000);
if(!LS.get('intro',0)&&!location.hash.match(/^#\/(r|place|brief)/))setTimeout(intro,600);

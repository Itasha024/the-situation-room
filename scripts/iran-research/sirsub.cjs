// From a candidates file: the posts that tell sirens or explosions, for the second reading pass.
const fs=require('fs');const [IN,OUT,N]=process.argv.slice(2);
const SB=/صافرات|صفارات|إنذار|انذار|دوي|انفجار|تهز|يهز|هزت|أصوات|اصوات|آژیر|صدای|انفجار|אזעק|פיצוץ|פיצוצים|siren|explosion|blast/i;
const L=fs.readFileSync(IN,'utf8').trim().split('\n').map(JSON.parse).filter(x=>SB.test(x.text));
const lines=L.map(x=>'['+x.ref+(x.also.length?' +'+x.also.slice(0,6).join(' +'):'')+'] '+x.at+' | '+x.text.slice(0,300));
let b=[],sz=0,n=0;const flush=()=>{fs.writeFileSync(OUT+'-s'+n+'.txt',b.join('\n')+'\n');n++;b=[];sz=0};
for(const l of lines){b.push(l);sz+=Buffer.byteLength(l)+1;if(sz>165000)flush()}if(b.length)flush();console.log(L.length,'posts',n,'batches');

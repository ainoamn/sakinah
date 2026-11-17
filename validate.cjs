const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const q=JSON.parse(fs.readFileSync('public/site/quran-source.json','utf8')).data.surahs;
assert.equal(q.length,114);assert.equal(q.flatMap(s=>s.ayahs).length,6236);
let globalNumber=0;
q.forEach((s,i)=>{assert.equal(s.number,i+1);s.ayahs.forEach((a,j)=>{assert.equal(a.numberInSurah,j+1);assert.equal(a.number,++globalNumber);assert.ok(a.text.trim().length);assert.ok(a.juz>=1&&a.juz<=30)})});
let c={};vm.createContext(c);vm.runInContext(fs.readFileSync('public/site/data.js','utf8')+';globalThis.entries=LIBRARY;globalThis.names=NAMES',c);
assert.equal(new Set(c.entries.map(x=>x.id)).size,c.entries.length);assert.equal(c.names.length,99);
c.entries.forEach(d=>{assert.ok(d.reference);assert.ok(d.repeat>=1);if(d.qref){const [s,a,b]=d.qref;assert.ok(q[s-1]);assert.ok(a>=1&&b>=a&&b<=q[s-1].ayahs.length)}else assert.ok(d.text)});
for(const f of ['index.html','style.css','app.js','data.js','icon.svg','QURAN-LICENSE.txt'])assert.ok(fs.statSync('public/site/'+f).size>0);
console.log(`PASS: ${q.length} surahs, ${globalNumber} ordered verses, ${c.entries.length} referenced entries, ${c.names.length} names, all ranges and assets valid.`);

assert.deepEqual([...new Set(q.flatMap(s=>s.ayahs.map(a=>a.page)))],Array.from({length:604},(_,i)=>i+1));
for(const f of ['qaboos.jpg','ameen.jpg','nizwa.jpg','sakinah-emblem.png','CREDITS.txt'])assert.ok(fs.statSync('public/site/assets/'+f).size>100);
console.log('PASS: all 604 page ranges present and identity assets available.');

const books=JSON.parse(fs.readFileSync('public/site/books.json','utf8'));for(const b of books){assert.ok(fs.existsSync('public/site/'+b.pdf));for(const slide of b.slides)if(slide.image)assert.ok(fs.existsSync('public/site/'+slide.image))}const exportFiles=JSON.parse(fs.readFileSync('public/site/exports.json','utf8'));for(const target of Object.values(exportFiles))assert.ok(fs.existsSync('public/site/'+target));console.log('PASS: five source books, all slides and export links.');


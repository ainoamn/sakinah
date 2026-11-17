const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../public/site');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){assert(fs.existsSync(path.join(root,icon.src)));assert(icon.purpose.includes('maskable'))}
const handlers={},stored=[];
let failNetwork=false,failCache=false;
const sandbox={URL,Response,Request,console,self:{location:{href:'https://example.test/site/sw.js',origin:'https://example.test'},addEventListener:(event,fn)=>handlers[event]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:async()=>{if(failNetwork)throw Error('offline');return new Response('online')},caches:{keys:async()=>[],delete:async()=>true,match:async()=>new Response('cached public shell'),open:async()=>({addAll:async files=>{for(const file of files){const name=typeof file==='string'?file:new URL(file.url).pathname.replace('/site/','');assert(fs.existsSync(path.join(root,!name||name==='./'?'index.html':name)),name)}},put:async(key)=>{if(failCache)throw Error('quota');stored.push(String(key.url||key))},match:async()=>null,keys:async()=>[],delete:async()=>true})}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),sandbox);
async function request(url,{method='GET',mode='cors'}={}){let promise;handlers.fetch({request:{url,method,mode},respondWith:p=>promise=p});return promise?await promise:null}
(async()=>{
 let install;handlers.install({waitUntil:p=>install=p});await install;
 assert.equal(await request('https://example.test/api/account'),null);
 assert.equal(await request('https://example.test/site/data.js',{method:'POST'}),null);
 assert.equal(await request('https://example.test/__sites/auth'),null);
 assert.equal(await request('https://unrelated.test/user.json'),null);
 failNetwork=true;assert.equal(await(await request('https://example.test/site/',{mode:'navigate'})).text(),'cached public shell');
 failNetwork=false;failCache=true;assert.equal(await(await request('https://example.test/site/data.js')).text(),'online');
 assert(!stored.some(key=>key.includes('/api/')));
 console.log('PASS: manifest, icons and complete offline shell; private APIs excluded; offline navigation works; quota failure preserves online reading.');
})().catch(error=>{console.error(error);process.exitCode=1});

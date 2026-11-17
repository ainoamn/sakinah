/* Public reading resources only. Account APIs and user activity are never cached. */
const VERSION='sakinah-v7-20261117',SHELL=VERSION+'-shell',MEDIA=VERSION+'-media';
const SHELL_FILES=['./','index.html','style.css','reader-fit.css','experience.css','data.js','app.js','features.js','i18n.js','reader.js','reader-fit.js','experience.js','pwa.js','manifest.webmanifest','quran-source.json','quran-layout.json','books.json','exports.json','assets/sakinah-emblem.png','assets/bhd-logo.svg','assets/app-icon-192.png','assets/app-icon-512.png','assets/qaboos.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL).then(c=>c.addAll(SHELL_FILES.map(file=>new Request(new URL(file,self.location.href),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sakinah-v')&&!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function trim(cache,max){const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(k=>cache.delete(k)))}
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.pathname.startsWith('/api/')||u.pathname.includes('/auth/')||u.pathname.includes('/__sites'))return;
 const own=u.origin===self.location.origin&&u.pathname.startsWith(new URL('./',self.location.href).pathname);
 const font=['verses.quran.foundation','verses.quran.com','fonts.gstatic.com','fonts.googleapis.com'].includes(u.hostname);
 if(!own&&!font)return;
 if(r.mode==='navigate'){e.respondWith(fetch(r,{cache:'no-cache'}).then(async response=>{if(response.ok){const c=await caches.open(SHELL);await c.put('index.html',response.clone()).catch(()=>{})}return response}).catch(async()=>await caches.match('index.html')||Response.error()));return}
 if(font){e.respondWith(caches.open(MEDIA).then(async c=>{const old=await c.match(r);if(old)return old;const response=await fetch(r);if(response.ok||response.type==='opaque'){try{await c.put(r,response.clone());await trim(c,32)}catch{}}return response}));return}
 if(/\.(pdf|jpg|jpeg|webp)$/i.test(u.pathname)&&!u.pathname.endsWith('/qaboos.jpg'))return;
 e.respondWith(fetch(r,{cache:'no-cache'}).then(async response=>{if(response.ok){const c=await caches.open(SHELL);await c.put(r,response.clone()).catch(()=>{})}return response}).catch(()=>caches.match(r,{ignoreSearch:true}).then(hit=>hit||Response.error())));
});

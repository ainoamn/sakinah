const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/site/state.js','utf8');
function store(map,blocked=false){return {get length(){if(blocked)throw Error('blocked');return map.size},key:i=>[...map.keys()][i],getItem:key=>{if(blocked)throw Error('blocked');return map.get(key)??null},setItem:(key,value)=>{if(blocked)throw Error('blocked');map.set(key,value)}}}
function fakeIDB(values){return {open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore:()=>({put:(value,key)=>values.set(key,value),openCursor:()=>{const cursor={};let i=0;const rows=[...values];const next=()=>queueMicrotask(()=>{cursor.result=i<rows.length?{key:rows[i][0],value:rows[i][1],continue(){i++;next()}}:null;cursor.onsuccess?.();if(!cursor.result)queueMicrotask(()=>tx.oncomplete?.())});next();return cursor}})};return tx}};request.onsuccess?.()});return request}}}
function boot(local,{backup,blocked=false,android=false,ios=false,launch=false}={}){
 const location=new URL('https://example.test/site/'+(launch?'?launch=app':'')+'#home'),events={};
 const context={URL,URLSearchParams,Map,Set,Promise,JSON,Event,queueMicrotask,setTimeout,clearTimeout,console,location,localStorage:store(local,blocked),navigator:{standalone:ios,storage:{persist:async()=>true}},matchMedia:()=>({matches:android}),history:{replaceState:(_a,_b,url)=>{location.href=url}},document:{documentElement:{dataset:{}},visibilityState:'visible',addEventListener:(name,fn)=>events[name]=fn},addEventListener:(name,fn)=>events[name]=fn,dispatchEvent:()=>{}};context.window=context;if(backup)context.indexedDB=fakeIDB(backup);vm.createContext(context);vm.runInContext(source,context);return {state:context.SakinahState,context,events,location}
}
(async()=>{
 const disk=new Map(),backup=new Map();const first=boot(disk,{backup});await first.state.ready;
 first.state.write('lastPage',35);first.state.write('savedPage',35);first.state.write('counts',{a1:2,a2:4});first.state.write('tasbih',127);first.state.write('tasbihGoal',1000);first.state.write('lastRoute','#quran/page/35');
 for(const platform of [{android:true},{ios:true},{launch:true}]){const reopened=boot(disk,platform);await reopened.state.ready;assert.equal(reopened.location.hash,'#quran/page/35');assert.equal(reopened.state.read('savedPage'),35);assert.equal(reopened.state.read('counts').a2,4);assert.equal(reopened.state.read('tasbih'),127);assert.equal(reopened.state.read('tasbihGoal'),1000)}
 assert.equal(boot(disk).location.hash,'#home');
 const recovered=boot(new Map(),{backup,blocked:true,launch:true});await recovered.state.ready;assert.equal(recovered.state.read('tasbih'),127);assert.equal(recovered.location.hash,'#quran/page/35');assert.equal(recovered.state.recovered,true);
 const automatic=boot(new Map(),{backup});automatic.state.write('tasbih',0,{initial:true});automatic.state.write('tasbih',0,{initial:true});await automatic.state.ready;assert.equal(automatic.state.read('tasbih'),127,'boot-time default rendering must not overwrite a saved counter');
 const reset=boot(new Map(),{backup});reset.state.write('counts',{});await reset.state.ready;assert.equal(Object.keys(reset.state.read('counts')).length,0,'late backup must not overwrite a fresh reset');
 first.location.hash='#quran-scroll/3';first.state.write('lastPage',12);assert.equal(first.state.read('lastRoute'),'#quran-scroll/12');
 const older=boot(disk);older.location.hash='#home';older.state.rememberRoute(true);first.location.hash='#quran/page/36';first.state.write('lastPage',36);older.events.pagehide();assert.equal(first.state.read('lastRoute'),'#quran/page/36','an inactive window must not overwrite the newer reading place');
 assert(!first.state.entries().some(([key])=>key.startsWith('other-site')));
 console.log('PASS: Android/iOS standalone launch paths, browser relaunch, Quran bookmark and counters, tasbih goal, IndexedDB recovery, fresh-write conflict protection and continuous-reading resume.');
})().catch(e=>{console.error(e);process.exitCode=1});

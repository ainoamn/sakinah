/* Tilawa library: Golden-Mushaf style player, settings, and on-page ayah highlight. */
const TILAWAT_RECITERS=[
 {id:'ar.alafasy',ar:'مشاري العفاسي',en:'Mishary Alafasy'},
 {id:'ar.husary',ar:'محمود خليل الحصري',en:'Mahmoud Khalil Al-Husary'},
 {id:'ar.husarymujawwad',ar:'الحصري (مجوّد)',en:'Al-Husary (Mujawwad)'},
 {id:'ar.mahermuaiqly',ar:'ماهر المعيقلي',en:'Maher Al-Muaiqly'},
 {id:'ar.abdurrahmaansudais',ar:'عبدالرحمن السديس',en:'Abdul Rahman Al-Sudais'},
 {id:'ar.saoodshuraym',ar:'سعود الشريم',en:'Saud Al-Shuraim'},
 {id:'ar.hudhaify',ar:'علي الحذيفي',en:'Ali Al-Hudhaify'},
 {id:'ar.abdulsamad',ar:'عبدالباسط عبدالصمد',en:'Abdul Basit Abdus Samad'},
 {id:'ar.muhammadayyoub',ar:'محمد أيوب',en:'Muhammad Ayyoub'},
 {id:'ar.muhammadjibreel',ar:'محمد جبريل',en:'Muhammad Jibreel'},
 {id:'ar.ahmedajamy',ar:'أحمد العجمي',en:'Ahmed Al-Ajamy'},
 {id:'ar.shaatree',ar:'أبو بكر الشاطري',en:'Abu Bakr Ash-Shaatree'},
 {id:'ar.abdullahbasfar',ar:'عبدالله بصفر',en:'Abdullah Basfar'},
 {id:'ar.hanirifai',ar:'هاني الرفاعي',en:'Hani Rifai'}
];
const TILAWAT_SPEEDS=[1,1.5,2];
const TILAWAT_REPEAT_COUNTS=[1,2,3,5,10,0];

const tilawa={
 a:null,b:null,using:'a',
 queue:[],index:0,playing:false,mode:'page',abort:0,sheet:'',
 progressTimer:null,repeatLeft:0,fabTimer:null
};

function tilawaSettings(){
 return {
  speed:Number(read('tilawaSpeed',1))||1,
  repeatMode:read('tilawaRepeatMode',read('tilawaRepeatAyah',false)?'ayah':(read('tilawaRepeatRange',false)?'range':'off')),
  repeatCount:Number(read('tilawaRepeatCount',1))||1,
  follow:read('tilawaFollow',true)!==false,
  continueOnEnd:read('tilawaContinueOnEnd',true)!==false,
  range:read('tilawaRange',null),
  rangeMode:read('tilawaRangeMode','ayah')
 };
}
function tilawaSaveSettings(patch){
 const next={...tilawaSettings(),...patch};
 write('tilawaSpeed',next.speed);
 write('tilawaRepeatMode',next.repeatMode);
 write('tilawaRepeatCount',next.repeatCount);
 write('tilawaFollow',next.follow);
 write('tilawaContinueOnEnd',next.continueOnEnd);
 write('tilawaRangeMode',next.rangeMode);
 if(patch.range!==undefined)write('tilawaRange',patch.range);
 return next;
}
function tilawaPrimary(){return tilawa.using==='a'?tilawa.a:tilawa.b}
function tilawaSecondary(){return tilawa.using==='a'?tilawa.b:tilawa.a}
function tilawaReciter(){
 const id=read('tilawaReciter','ar.alafasy');
 return TILAWAT_RECITERS.find(r=>r.id===id)||TILAWAT_RECITERS[0];
}
function tilawaReciterLabel(r=tilawaReciter()){
 return lang()==='en'?r.en:r.ar;
}
function tilawaAyahUrl(globalNumber,reciter=tilawaReciter().id){
 return 'https://cdn.islamic.network/quran/audio/128/'+reciter+'/'+globalNumber+'.mp3';
}
function tilawaFmtTime(sec){
 if(!Number.isFinite(sec)||sec<0)return '0:00';
 const m=Math.floor(sec/60),s=Math.floor(sec%60);
 return m+':'+String(s).padStart(2,'0');
}
function tilawaShortName(name=''){
 return String(name).replace(/^سُورَةُ\s*/,'').replace(/^سورة\s*/,'');
}
function tilawaMakeAudio(slot){
 const el=new Audio();
 el.preload='auto';
 el.dataset.slot=slot;
 el.addEventListener('ended',()=>{if(tilawaPrimary()===el)tilawaOnEnded()});
 el.addEventListener('error',()=>{
  if(tilawaPrimary()!==el)return;
  tilawa.playing=false;syncTilawaUi();
  toast(t('تعذر تشغيل التلاوة. تحقق من الاتصال.','Could not play the recitation. Check your connection.'));
 });
 el.addEventListener('play',()=>{if(tilawaPrimary()===el){tilawa.playing=true;tilawaStartProgress();syncTilawaUi();tilawaPreloadNext()}});
 el.addEventListener('pause',()=>{if(tilawaPrimary()===el&&!el.ended){tilawa.playing=false;tilawaStopProgress();syncTilawaUi()}});
 el.addEventListener('timeupdate',()=>{
  if(tilawaPrimary()!==el)return;
  tilawaPaintProgress();
  if(el.duration&&el.currentTime>el.duration-5)tilawaPreloadNext();
 });
 el.addEventListener('loadedmetadata',()=>{if(tilawaPrimary()===el)tilawaPaintProgress()});
 el.playbackRate=tilawaSettings().speed;
 return el;
}
function tilawaEnsureAudio(){
 if(!tilawa.a)tilawa.a=tilawaMakeAudio('a');
 if(!tilawa.b)tilawa.b=tilawaMakeAudio('b');
 return tilawaPrimary();
}
function tilawaStartProgress(){
 tilawaStopProgress();
 tilawa.progressTimer=setInterval(tilawaPaintProgress,200);
}
function tilawaStopProgress(){
 if(tilawa.progressTimer){clearInterval(tilawa.progressTimer);tilawa.progressTimer=null}
}
function tilawaPaintProgress(){
 const el=tilawaPrimary();
 const cur=tilawaCurrent();
 const seek=$('#tilawa-seek');
 const now=$('#tilawa-time-now');
 const dur=$('#tilawa-time-dur');
 if(!el)return;
 const duration=Number.isFinite(el.duration)?el.duration:0;
 const current=Number.isFinite(el.currentTime)?el.currentTime:0;
 if(seek&&document.activeElement!==seek){
  seek.max=String(duration||0);
  seek.value=String(current||0);
 }
 if(now)now.textContent=tilawaFmtTime(current);
 if(dur)dur.textContent=tilawaFmtTime(duration);
}
function tilawaPreloadNext(){
 const next=tilawa.queue[tilawa.index+1];
 const el=tilawaSecondary();
 if(!next||!el)return;
 const url=tilawaAyahUrl(next.g);
 if(el.dataset.url===url&&el.readyState>=2)return;
 el.dataset.url=url;
 el.preload='auto';
 el.src=url;
 el.playbackRate=tilawaSettings().speed;
 try{el.load()}catch{}
}
async function tilawaArm(item,el){
 const url=tilawaAyahUrl(item.g);
 if(el.dataset.url===url&&el.readyState>=2){
  el.playbackRate=tilawaSettings().speed;
  try{el.currentTime=0}catch{}
  return true;
 }
 el.dataset.url=url;
 el.playbackRate=tilawaSettings().speed;
 el.src=url;
 await new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;el.removeEventListener('canplaythrough',finish);el.removeEventListener('loadeddata',finish);el.removeEventListener('error',finish);resolve()};
  el.addEventListener('canplaythrough',finish,{once:true});
  el.addEventListener('loadeddata',finish,{once:true});
  el.addEventListener('error',finish,{once:true});
  try{el.load()}catch{finish()}
  setTimeout(finish,2200);
 });
 try{el.currentTime=0}catch{}
 return el.readyState>=2;
}
async function tilawaAdvanceSeamless(){
 const next=tilawa.queue[tilawa.index+1];
 if(!next)return false;
 const ready=tilawaSecondary();
 const url=tilawaAyahUrl(next.g);
 if(ready.dataset.url!==url||ready.readyState<2)await tilawaArm(next,ready);
 tilawa.index++;
 tilawa.using=tilawa.using==='a'?'b':'a';
 const el=tilawaPrimary();
 el.playbackRate=tilawaSettings().speed;
 try{el.currentTime=0}catch{}
 try{await el.play();tilawa.playing=true}catch{tilawa.playing=false;return false}
 tilawaPreloadNext();
 syncTilawaUi();
 tilawaFollowPage(tilawaCurrent());
 return true;
}
function tilawaCurrent(){
 return tilawa.queue[tilawa.index]||null;
}
function tilawaQueueFromPage(page){
 if(!QURAN)return [];
 return pageEntries(page).map(({s,a})=>({
  s:s.number,a:a.numberInSurah,g:a.number,page:a.page,name:s.name,text:a.text
 }));
}
function tilawaQueueFromSurah(snum,from=1,to=null){
 if(!QURAN)return [];
 const s=QURAN[snum-1];
 if(!s)return [];
 const end=to||s.ayahs.length;
 return s.ayahs.filter(a=>a.numberInSurah>=from&&a.numberInSurah<=end).map(a=>({
  s:s.number,a:a.numberInSurah,g:a.number,page:a.page,name:s.name,text:a.text
 }));
}
function tilawaQueueFromCross(range){
 if(!range||!QURAN)return [];
 const s1=range.s1||range.s,a1=range.a1||range.from,s2=range.s2||range.s,a2=range.a2||range.to;
 const out=[];
 for(let s=s1;s<=s2;s++){
  const surah=QURAN[s-1];if(!surah)continue;
  const from=s===s1?a1:1,to=s===s2?a2:surah.ayahs.length;
  out.push(...tilawaQueueFromSurah(s,from,to));
 }
 return out;
}
function tilawaQueueFromRange(range){return tilawaQueueFromCross(range)}
function tilawaDefaultRange(){
 const cur=tilawaCurrent();
 if(cur){
  const to=Math.min(cur.a+4,QURAN?.[cur.s-1]?.ayahs.length||cur.a);
  return {s1:cur.s,a1:cur.a,s2:cur.s,a2:to,s:cur.s,from:cur.a,to};
 }
 const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
 const entries=pageEntries(page);
 if(!entries.length)return {s1:1,a1:1,s2:1,a2:7,s:1,from:1,to:7};
 const first=entries[0],last=entries[entries.length-1];
 return {s1:first.s.number,a1:first.a.numberInSurah,s2:last.s.number,a2:last.a.numberInSurah,s:first.s.number,from:first.a.numberInSurah,to:last.a.numberInSurah};
}
function tilawaRangeLabel(range=tilawaSettings().range||tilawaDefaultRange()){
 if(!range||!QURAN)return t('حدد المقطع','Choose a range');
 const s1=range.s1||range.s,a1=range.a1||range.from,s2=range.s2||range.s,a2=range.a2||range.to;
 const n1=tilawaShortName(QURAN[s1-1]?.name||''),n2=tilawaShortName(QURAN[s2-1]?.name||'');
 if(s1===s2)return n1+' '+ar(a1)+'–'+ar(a2);
 return n1+' '+ar(a1)+' ← '+n2+' '+ar(a2);
}

let ayahHighlightMap=null;
const ayahHighlightPromise=fetch('ayah-highlight.json').then(r=>{if(!r.ok)throw Error('ayah-highlight');return r.json()}).then(d=>{ayahHighlightMap=d;return d}).catch(()=>null);

function clearTilawaHighlights(){
 document.querySelectorAll('.qpc-ayah-hl').forEach(el=>el.remove());
 document.querySelectorAll('.ayah.is-playing,.qpc-ink.is-playing,.flow-ayah.is-playing,.tilawa-leaf.is-playing,.vertical-page.is-playing,.paper-leaf.is-playing').forEach(el=>el.classList.remove('is-playing'));
 $('#tilawa-marks')?.remove();
 $('#tilawa-spotlight')?.remove();
}
function paintMushafAyah(cur){
 if(!cur?.page||!tilawaSettings().follow)return;
 const key=cur.s+':'+cur.a;
 const ranges=ayahHighlightMap?.v2?.[cur.page-1]?.[key];
 if(!ranges){
  if(!ayahHighlightMap)ayahHighlightPromise.then(()=>{if(tilawaCurrent()===cur)paintMushafAyah(cur)});
  return;
 }
 const ns='http://www.w3.org/2000/svg';
 document.querySelectorAll(`[data-vector-page="${cur.page}"]`).forEach(host=>{
  const svg=host.querySelector('svg.qpc-svg');
  if(!svg)return;
  let layer=svg.querySelector('.qpc-hl-layer');
  if(!layer){
   layer=document.createElementNS(ns,'g');
   layer.setAttribute('class','qpc-hl-layer');
   const firstInk=svg.querySelector('.qpc-ink');
   if(firstInk)svg.insertBefore(layer,firstInk);
   else svg.append(layer);
  }
  layer.replaceChildren();
  for(const [lineIdx,start,end] of ranges){
   const line=svg.querySelector(`.qpc-ink[data-line="${lineIdx}"]`);
   if(!line||!line.textContent)continue;
   const chars=line.getNumberOfChars?.()||0;
   if(!chars)continue;
   let minX=Infinity,maxX=-Infinity;
   const y=Number(line.getAttribute('y'))||0;
   const size=Number(line.getAttribute('font-size'))||64;
   for(let i=start;i<end&&i<chars;i++){
    if(line.textContent[i]===' ')continue;
    try{
     const p=line.getStartPositionOfChar(i);
     const endP=line.getEndPositionOfChar(i);
     minX=Math.min(minX,p.x,endP.x);
     maxX=Math.max(maxX,p.x,endP.x);
    }catch{}
   }
   if(!Number.isFinite(minX)||maxX<=minX)continue;
   const pad=6;
   const rect=document.createElementNS(ns,'rect');
   rect.setAttribute('class','qpc-ayah-hl');
   rect.setAttribute('x',String(minX-pad));
   rect.setAttribute('y',String(y-size*0.88));
   rect.setAttribute('width',String(maxX-minX+pad*2));
   rect.setAttribute('height',String(size*1.2));
   rect.setAttribute('rx','8');
   layer.append(rect);
   line.classList.add('is-playing');
  }
 });
}
function highlightTilawaAyah(cur){
 clearTilawaHighlights();
 if(!cur||!tilawaSettings().follow)return;
 const textHit=document.getElementById('ayah-'+cur.a);
 if(textHit&&Number(document.querySelector('#ayahs')?.dataset?.surah||cur.s)===cur.s){
  textHit.classList.add('is-playing');
  if(tilawa.playing)textHit.scrollIntoView({block:'center',behavior:'smooth'});
 }
 paintMushafAyah(cur);
 document.querySelector(`.vertical-page[data-vertical-page="${cur.page}"]`)?.classList.add('tilawa-leaf','is-playing');
 document.querySelector(`.paper-leaf[data-page="${cur.page}"]`)?.classList.add('is-playing');
}
function tilawaFollowPage(cur){
 if(!cur?.page||!tilawaSettings().follow)return;
 if(currentRoute==='quran'&&$('#book')){
  const page=Number($('#book').dataset.page);
  if(page&&page!==cur.page)location.hash='quran/page/'+cur.page;
 }else if(currentRoute==='quran-scroll'){
  document.querySelector(`.vertical-page[data-vertical-page="${cur.page}"]`)?.scrollIntoView({block:'center',behavior:'smooth'});
 }
}

function syncTilawaUi(){
 const cur=tilawaCurrent();
 const conf=tilawaSettings();
 const fab=$('#tilawa-fab');
 if(fab){
  fab.textContent=tilawa.playing?'❚❚':'▶';
  fab.classList.toggle('is-playing',tilawa.playing);
  fab.setAttribute('aria-label',tilawa.playing?t('مشغّل التلاوة','Recitation player'):t('فتح مشغّل التلاوة','Open recitation player'));
 }
 const sheetTitle=$('#tilawa-sheet-surah');
 const sheetRec=$('#tilawa-sheet-reciter');
 const mainPlay=$('#tilawa-main-play');
 if(sheetTitle)sheetTitle.textContent=cur?tilawaShortName(cur.name):t('التلاوة','Recitation');
 if(sheetRec)sheetRec.textContent=tilawaReciterLabel();
 if(mainPlay){
  mainPlay.textContent=tilawa.playing?'❚❚':'▶';
  mainPlay.setAttribute('aria-label',tilawa.playing?t('إيقاف','Pause'):t('تشغيل','Play'));
 }
 const speedBtn=$('#tilawa-feat-speed');
 if(speedBtn)speedBtn.innerHTML=`<span>⏱</span>${conf.speed}x ${t('السرعة','Speed')}`;
 $('#tilawa-feat-repeat')?.classList.toggle('is-on',conf.repeatMode!=='off');
 $('#tilawa-feat-follow')?.classList.toggle('is-on',conf.follow);
 $('#tilawa-feat-range')?.classList.toggle('is-on',!!conf.range);
 const rate=tilawaEnsureAudio();
 rate.playbackRate=conf.speed;
 if(tilawa.a)tilawa.a.playbackRate=conf.speed;
 if(tilawa.b)tilawa.b.playbackRate=conf.speed;
 tilawaPaintProgress();
 if(tilawa.sheet==='settings')fillTilawaSettings();
 if(['player','settings','reciters','range'].includes(tilawa.sheet))$('#tilawa-sheet-root')?.classList.add('is-open');
 highlightTilawaAyah(cur);
 if(navigator.mediaSession&&cur){
  navigator.mediaSession.metadata=new MediaMetadata({
   title:(lang()==='en'?'Ayah ':'آية ')+cur.a,
   artist:tilawaReciterLabel(),
   album:cur.name
  });
 }
}

async function tilawaLoadCurrent(){
 const cur=tilawaCurrent();
 const el=tilawaEnsureAudio();
 if(!cur){el.pause();tilawa.playing=false;syncTilawaUi();return}
 const token=++tilawa.abort;
 await tilawaArm(cur,el);
 if(token!==tilawa.abort)return;
 el.playbackRate=tilawaSettings().speed;
 syncTilawaUi();
 tilawaFollowPage(cur);
 tilawaPreloadNext();
}
async function tilawaPlay(){
 if(!tilawa.queue.length){
  const conf=tilawaSettings();
  if(conf.range){tilawa.mode='range';tilawa.queue=tilawaQueueFromRange(conf.range);tilawa.index=0}
  else{
   const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
   tilawa.queue=tilawaQueueFromPage(page);tilawa.index=0;tilawa.mode='page';
  }
 }
 if(!tilawa.queue.length){toast(t('لا تتوفر آيات للتشغيل.','No verses available to play.'));return}
 const conf=tilawaSettings();
 tilawa.repeatLeft=conf.repeatCount===0?Infinity:Math.max(1,conf.repeatCount);
 const el=tilawaEnsureAudio();
 await tilawaLoadCurrent();
 try{await el.play();tilawa.playing=true;tilawaPreloadNext()}catch{
  tilawa.playing=false;
  toast(t('اضغط التشغيل مرة أخرى بعد اختيار القارئ.','Tap play again after choosing a reciter.'));
 }
 syncTilawaUi();
 // Keep reading immersive: hide controls after playback starts.
 closeTilawaSheets();
 hideTilawaFab();
}
function tilawaPause(){
 tilawaPrimary()?.pause();
 tilawa.playing=false;
 syncTilawaUi();
}
function tilawaToggle(){tilawa.playing?tilawaPause():tilawaPlay()}
function tilawaStop(){
 tilawaPause();
 const el=tilawaPrimary();
 try{if(el)el.currentTime=0}catch{}
 tilawa.queue=[];tilawa.index=0;
 clearTilawaHighlights();
 syncTilawaUi();
 closeTilawaSheets();
}
async function tilawaOnEnded(){
 const conf=tilawaSettings();
 if(conf.repeatMode==='ayah'){
  if(tilawa.repeatLeft===Infinity||tilawa.repeatLeft>1){
   if(tilawa.repeatLeft!==Infinity)tilawa.repeatLeft--;
   const el=tilawaPrimary();
   try{el.currentTime=0;await el.play();tilawa.playing=true}catch{tilawa.playing=false}
   syncTilawaUi();return;
  }
 }
 if(tilawa.index>=tilawa.queue.length-1){
  const loop=['range','page','surah'].includes(conf.repeatMode)||(conf.repeatMode==='ayah'&&tilawa.queue.length===1);
  if(loop&&tilawa.queue.length&&(tilawa.repeatLeft===Infinity||tilawa.repeatLeft>1)){
   if(tilawa.repeatLeft!==Infinity)tilawa.repeatLeft--;
   tilawa.index=0;
   await tilawaLoadCurrent();
   try{await tilawaPrimary().play();tilawa.playing=true;tilawaPreloadNext()}catch{tilawa.playing=false}
   syncTilawaUi();return;
  }
  if(conf.continueOnEnd&&tilawa.mode!=='range'){
   const cur=tilawaCurrent();
   if(cur){
    const nextPage=cur.page+1;
    if(nextPage<=604){
     tilawa.mode='page';
     tilawa.queue=tilawaQueueFromPage(nextPage);
     tilawa.index=0;
     if(tilawa.queue.length){
      await tilawaLoadCurrent();
      try{await tilawaPrimary().play();tilawa.playing=true;tilawaPreloadNext()}catch{tilawa.playing=false}
      syncTilawaUi();
      return;
     }
    }
   }
  }
  tilawa.playing=false;
  syncTilawaUi();
  toast(t('انتهت التلاوة.','Recitation finished.'));
  return;
 }
 const ok=await tilawaAdvanceSeamless();
 if(!ok){
  tilawa.index++;
  await tilawaLoadCurrent();
  try{await tilawaPrimary().play();tilawa.playing=true}catch{tilawa.playing=false}
  syncTilawaUi();
 }
}
async function tilawaNext(){
 if(!tilawa.queue.length)return;
 if(tilawa.index>=tilawa.queue.length-1){tilawa.playing=false;syncTilawaUi();return}
 const ok=await tilawaAdvanceSeamless();
 if(!ok){
  tilawa.index++;
  await tilawaLoadCurrent();
  if(tilawa.playing){try{await tilawaPrimary().play()}catch{tilawa.playing=false}}
  syncTilawaUi();
 }
}
async function tilawaPrev(){
 if(!tilawa.queue.length)return;
 const el=tilawaPrimary();
 if(el&&el.currentTime>1.2){el.currentTime=0;tilawaPaintProgress();return}
 tilawa.index=Math.max(0,tilawa.index-1);
 await tilawaLoadCurrent();
 if(tilawa.playing){try{await tilawaPrimary().play();tilawaPreloadNext()}catch{tilawa.playing=false}}
 syncTilawaUi();
}
function tilawaSeekBy(delta){
 const el=tilawaEnsureAudio();
 if(!Number.isFinite(el.duration))return;
 el.currentTime=Math.max(0,Math.min(el.duration||0,el.currentTime+delta));
 tilawaPaintProgress();
}
function tilawaSetReciter(id){
 if(!TILAWAT_RECITERS.some(r=>r.id===id))return;
 write('tilawaReciter',id);
 const was=tilawa.playing;
 tilawaPause();
 if(tilawa.a){tilawa.a.dataset.url='';tilawa.a.removeAttribute('src')}
 if(tilawa.b){tilawa.b.dataset.url='';tilawa.b.removeAttribute('src')}
 tilawaLoadCurrent().then(()=>{if(was)tilawaPlay()});
 syncTilawaUi();
}
function tilawaSetSpeed(speed){
 const s=TILAWAT_SPEEDS.includes(Number(speed))?Number(speed):1;
 tilawaSaveSettings({speed:s});
 if(tilawa.a)tilawa.a.playbackRate=s;
 if(tilawa.b)tilawa.b.playbackRate=s;
 syncTilawaUi();
}
function tilawaStartPage(page,ayahInSurah=null){
 tilawa.mode='page';
 tilawa.queue=tilawaQueueFromPage(page);
 if(!tilawa.queue.length)return;
 tilawa.index=ayahInSurah?Math.max(0,tilawa.queue.findIndex(x=>x.a===ayahInSurah)):0;
 if(tilawa.index<0)tilawa.index=0;
 tilawaPlay();
}
function tilawaStartSurah(snum,ayah=1){
 tilawa.mode='surah';
 tilawa.queue=tilawaQueueFromSurah(snum);
 tilawa.index=Math.max(0,tilawa.queue.findIndex(x=>x.a===ayah));
 if(tilawa.index<0)tilawa.index=0;
 tilawaPlay();
}
function tilawaStartRange(range){
 const q=tilawaQueueFromRange(range);
 if(!q.length){toast(t('المقطع غير متاح.','Range unavailable.'));return}
 tilawaSaveSettings({range});
 tilawa.mode='range';
 tilawa.queue=q;
 tilawa.index=0;
 tilawaPlay();
}

function tilawaSheetRoot(){
 let root=$('#tilawa-sheet-root');
 if(root)return root;
 document.body.insertAdjacentHTML('beforeend',`<div id="tilawa-sheet-root" class="tilawa-sheet-root" hidden>
  <div class="tilawa-sheet" role="dialog" aria-modal="true" aria-label="${t('مشغّل التلاوة','Recitation player')}">
   <div class="tilawa-sheet-handle" aria-hidden="true"></div>
   <div id="tilawa-sheet-body"></div>
  </div>
 </div>`);
 root=$('#tilawa-sheet-root');
 root.addEventListener('click',e=>{if(e.target===root)closeTilawaSheets()});
 return root;
}
function closeTilawaSheets(){
 tilawa.sheet='';
 const root=$('#tilawa-sheet-root');
 if(!root)return;
 root.classList.remove('is-open');
 root.hidden=true;
 hideTilawaFab();
}
function openTilawaSheet(kind){
 hideTilawaFab();
 const root=tilawaSheetRoot();
 tilawa.sheet=kind;
 root.hidden=false;
 root.classList.add('is-open');
 if(kind==='player')renderTilawaPlayerSheet();
 else if(kind==='settings')renderTilawaSettingsSheet();
 else if(kind==='reciters')renderTilawaRecitersSheet();
 else if(kind==='range')renderTilawaRangeSheet();
 syncTilawaUi();
}
function openTilawaPlayer(){openTilawaSheet('player')}
function openTilawaSettings(){openTilawaSheet('settings')}
function openTilawaReciters(){openTilawaSheet('reciters')}

function renderTilawaPlayerSheet(){
 const conf=tilawaSettings();
 const cur=tilawaCurrent();
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn stop" id="tilawa-stop" aria-label="${t('إيقاف تام','Stop')}">■</button>
   <div class="tilawa-sheet-title">
    <h2 id="tilawa-sheet-surah">${esc(cur?tilawaShortName(cur.name):t('التلاوة','Recitation'))}</h2>
    <p id="tilawa-sheet-reciter">${esc(tilawaReciterLabel())}</p>
   </div>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <div class="tilawa-progress">
   <input id="tilawa-seek" type="range" min="0" max="0" value="0" step="0.1" aria-label="${t('التقدّم','Progress')}">
   <div class="tilawa-progress-times"><span id="tilawa-time-now">0:00</span><span id="tilawa-time-dur">0:00</span></div>
  </div>
  <div class="tilawa-transport">
   <button type="button" id="tilawa-back10" aria-label="${t('رجوع ١٠ ثوان','Back 10 seconds')}">⟲10</button>
   <button type="button" id="tilawa-prev" aria-label="${t('الآية السابقة','Previous ayah')}">⏮</button>
   <button type="button" id="tilawa-rew" aria-label="${t('ترجيع','Rewind')}">⏪</button>
   <button type="button" class="tilawa-main-play" id="tilawa-main-play" aria-label="${t('تشغيل','Play')}">${tilawa.playing?'❚❚':'▶'}</button>
   <button type="button" id="tilawa-ff" aria-label="${t('تقديم','Forward')}">⏩</button>
   <button type="button" id="tilawa-next" aria-label="${t('الآية التالية','Next ayah')}">⏭</button>
   <button type="button" id="tilawa-fwd10" aria-label="${t('تقديم ١٠ ثوان','Forward 10 seconds')}">10⟳</button>
  </div>
  <div class="tilawa-grid">
   <button type="button" id="tilawa-feat-repeat" class="${conf.repeatMode!=='off'?'is-on':''}"><span>🔁</span>${t('تكرار','Repeat')}</button>
   <button type="button" id="tilawa-feat-range" class="${conf.range?'is-on':''}"><span>⌖</span>${t('النطاق','Range')}</button>
   <button type="button" id="tilawa-feat-speed"><span>⏱</span>${conf.speed}x ${t('السرعة','Speed')}</button>
   <button type="button" id="tilawa-feat-reciter"><span>🎙</span>${t('القارئ','Reciter')}</button>
   <button type="button" id="tilawa-feat-follow" class="${conf.follow?'is-on':''}"><span>◎</span>${t('متابعة','Follow')}</button>
   <button type="button" id="tilawa-feat-page"><span>▣</span>${t('الصفحة','Page')}</button>
  </div>
  <button type="button" class="tilawa-settings-launch" id="tilawa-open-settings"><b>⚙</b><span>${t('إعدادات الصوت','Audio settings')}</span><span>‹</span></button>`;
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-stop').onclick=()=>tilawaStop();
 $('#tilawa-main-play').onclick=()=>tilawaToggle();
 $('#tilawa-prev').onclick=()=>tilawaPrev();
 $('#tilawa-next').onclick=()=>tilawaNext();
 $('#tilawa-back10').onclick=()=>tilawaSeekBy(-10);
 $('#tilawa-fwd10').onclick=()=>tilawaSeekBy(10);
 $('#tilawa-rew').onclick=()=>tilawaSeekBy(-5);
 $('#tilawa-ff').onclick=()=>tilawaSeekBy(5);
 $('#tilawa-seek').oninput=e=>{const el=tilawaEnsureAudio();el.currentTime=Number(e.target.value)||0;tilawaPaintProgress()};
 $('#tilawa-feat-repeat').onclick=()=>openTilawaSettings();
 $('#tilawa-feat-range').onclick=()=>openTilawaSheet('range');
 $('#tilawa-feat-speed').onclick=()=>{
  const conf=tilawaSettings();
  const i=TILAWAT_SPEEDS.indexOf(conf.speed);
  tilawaSetSpeed(TILAWAT_SPEEDS[(i+1)%TILAWAT_SPEEDS.length]);
 };
 $('#tilawa-feat-reciter').onclick=()=>openTilawaReciters();
 $('#tilawa-feat-follow').onclick=()=>{tilawaSaveSettings({follow:!tilawaSettings().follow});syncTilawaUi()};
 $('#tilawa-feat-page').onclick=()=>{
  const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
  tilawaStartPage(page);
 };
 $('#tilawa-open-settings').onclick=()=>openTilawaSettings();
}
function fillTilawaSettings(){
 const conf=tilawaSettings();
 const range=conf.range||tilawaDefaultRange();
 const recPick=$('#tilawa-settings-reciter');
 if(recPick){
  recPick.querySelector('strong').textContent=tilawaReciterLabel();
  recPick.querySelector('small').textContent=lang()==='en'?tilawaReciter().ar:tilawaReciter().en;
  const av=recPick.querySelector('.avatar');
  if(av)av.textContent=tilawaReciterLabel().replace(/^ال/,'').charAt(0);
 }
 const rangeStrong=$('#tilawa-settings-range strong');
 if(rangeStrong)rangeStrong.textContent=tilawaRangeLabel(range);
 const follow=$('#tilawa-follow');
 const cont=$('#tilawa-continue');
 if(follow)follow.checked=conf.follow;
 if(cont)cont.checked=conf.continueOnEnd;
 document.querySelectorAll('[data-repeat-mode]').forEach(btn=>btn.classList.toggle('is-on',btn.dataset.repeatMode===conf.repeatMode));
 document.querySelectorAll('[data-repeat-count]').forEach(btn=>btn.classList.toggle('is-on',Number(btn.dataset.repeatCount)===conf.repeatCount));
 document.querySelectorAll('[data-tilawa-speed]').forEach(btn=>btn.classList.toggle('is-on',Number(btn.dataset.tilawaSpeed)===conf.speed));
}
function renderTilawaSettingsSheet(){
 const counts=TILAWAT_REPEAT_COUNTS.map(n=>`<button type="button" data-repeat-count="${n}">${n===0?'∞':ar(n)}</button>`).join('');
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-player" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--gold)">${t('إعدادات الصوت','Audio settings')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <div class="tilawa-settings">
   <label class="tilawa-block-label">${t('اختر القارئ','Choose reciter')}</label>
   <button type="button" class="tilawa-reciter-pick" id="tilawa-settings-reciter">
    <span class="avatar">م</span>
    <span style="flex:1;min-width:0"><strong></strong><small></small></span>
    <span>‹</span>
   </button>
   <div class="tilawa-block" style="margin-top:12px">
    <label class="tilawa-block-label">${t('حدد المقطع','Choose range')}</label>
    <div class="tilawa-range-pick" id="tilawa-settings-range">
     <strong></strong>
     <button type="button" class="tilawa-edit" id="tilawa-edit-range">${t('تعديل','Edit')}</button>
    </div>
   </div>
   <div class="tilawa-block">
    <label class="tilawa-block-label">${t('التكرار','Repeat')}</label>
    <div class="tilawa-seg">
     <button type="button" data-repeat-mode="off">${t('إيقاف','Off')}</button>
     <button type="button" data-repeat-mode="ayah">${t('آية','Ayah')}</button>
     <button type="button" data-repeat-mode="page">${t('صفحة','Page')}</button>
     <button type="button" data-repeat-mode="surah">${t('سورة','Surah')}</button>
     <button type="button" data-repeat-mode="range">${t('مقطع','Range')}</button>
    </div>
    <label class="tilawa-block-label">${t('عدد التكرار','Repeat count')}</label>
    <div class="tilawa-repeat-count">${counts}</div>
   </div>
   <div class="tilawa-block">
    <label class="tilawa-block-label">${t('سرعة التلاوة','Recitation speed')}</label>
    <div class="tilawa-speed">${TILAWAT_SPEEDS.map(s=>`<button type="button" data-tilawa-speed="${s}">${s}x</button>`).join('')}</div>
   </div>
   <div class="tilawa-block">
    <div class="tilawa-toggle-row"><span>${t('عند الانتهاء، أكمل التلاوة','When finished, continue recitation')}</span><label class="tilawa-switch"><input type="checkbox" id="tilawa-continue"><span></span></label></div>
    <div class="tilawa-toggle-row"><span>${t('الذهاب للصفحة وتظليل الآية تلقائيًا','Go to page and highlight the ayah automatically')}</span><label class="tilawa-switch"><input type="checkbox" id="tilawa-follow"><span></span></label></div>
   </div>
   <button type="button" class="tilawa-play-wide" id="tilawa-settings-play">▶ ${t('تشغيل','Play')}</button>
  </div>`;
 fillTilawaSettings();
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-back-player').onclick=()=>openTilawaPlayer();
 $('#tilawa-settings-reciter').onclick=()=>openTilawaReciters();
 $('#tilawa-edit-range').onclick=()=>openTilawaSheet('range');
 document.querySelectorAll('[data-repeat-mode]').forEach(btn=>btn.onclick=()=>{tilawaSaveSettings({repeatMode:btn.dataset.repeatMode});syncTilawaUi()});
 document.querySelectorAll('[data-repeat-count]').forEach(btn=>btn.onclick=()=>{tilawaSaveSettings({repeatCount:Number(btn.dataset.repeatCount)});syncTilawaUi()});
 $('#tilawa-follow').onchange=e=>{tilawaSaveSettings({follow:e.target.checked});syncTilawaUi()};
 $('#tilawa-continue').onchange=e=>{tilawaSaveSettings({continueOnEnd:e.target.checked});syncTilawaUi()};
 document.querySelectorAll('[data-tilawa-speed]').forEach(btn=>btn.onclick=()=>tilawaSetSpeed(btn.dataset.tilawaSpeed));
 $('#tilawa-settings-play').onclick=()=>{
  const conf=tilawaSettings();
  if(conf.range)tilawaStartRange(conf.range);
  else tilawaPlay();
 };
}
function renderTilawaRecitersSheet(){
 const current=tilawaReciter().id;
 const paint=(q='')=>{
  const query=q.trim().toLowerCase();
  const items=TILAWAT_RECITERS.filter(r=>!query||r.ar.includes(q)||r.en.toLowerCase().includes(query));
  return items.map(r=>`<button type="button" class="tilawa-reciter-card ${r.id===current?'active':''}" data-reciter="${r.id}" role="option" aria-selected="${r.id===current}"><span class="avatar">${esc((lang()==='en'?r.en:r.ar).replace(/^ال/,'').charAt(0))}</span><span><strong>${esc(lang()==='en'?r.en:r.ar)}</strong><small>${esc(lang()==='en'?r.ar:r.en)}</small></span><span class="check">✓</span></button>`).join('');
 };
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-settings" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--gold)">${t('اختر القارئ','Choose reciter')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <input class="tilawa-search" id="tilawa-reciter-search" type="search" placeholder="${t('بحث','Search')}" dir="rtl">
  <div class="tilawa-reciters" id="tilawa-reciter-list" role="listbox">${paint()}</div>`;
 const bind=()=>document.querySelectorAll('[data-reciter]').forEach(btn=>btn.onclick=()=>{tilawaSetReciter(btn.dataset.reciter);openTilawaSettings()});
 bind();
 $('#tilawa-reciter-search').oninput=e=>{$('#tilawa-reciter-list').innerHTML=paint(e.target.value);bind()};
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-back-settings').onclick=()=>openTilawaSettings();
}
function renderTilawaRangeSheet(){
 const range=tilawaSettings().range||tilawaDefaultRange();
 const mode=tilawaSettings().rangeMode||'ayah';
 const surahOpts=QURAN.map(s=>`<option value="${s.number}">${ar(s.number)} — ${esc(s.name)}</option>`).join('');
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-settings" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--gold)">${t('حدد المقطع','Choose range')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <div class="tilawa-seg" id="tilawa-range-mode">
   <button type="button" data-mode="surah">${t('سورة','Surah')}</button>
   <button type="button" data-mode="page">${t('الصفحة','Page')}</button>
   <button type="button" data-mode="ayah">${t('الآية','Ayah')}</button>
  </div>
  <form class="tilawa-fromto" id="tilawa-range-form">
   <div class="tilawa-fromto-row">
    <label class="tilawa-field"><span>${t('من سورة','From surah')}</span><select id="tilawa-r-s1">${surahOpts}</select></label>
    <label class="tilawa-field"><span>${t('من آية','From ayah')}</span><input id="tilawa-r-a1" type="number" min="1" value="${range.a1||range.from}"></label>
   </div>
   <div class="tilawa-fromto-row">
    <label class="tilawa-field"><span>${t('إلى سورة','To surah')}</span><select id="tilawa-r-s2">${surahOpts}</select></label>
    <label class="tilawa-field"><span>${t('إلى آية','To ayah')}</span><input id="tilawa-r-a2" type="number" min="1" value="${range.a2||range.to}"></label>
   </div>
   <button type="submit" class="tilawa-play-wide">▶ ${t('تشغيل','Play')}</button>
  </form>`;
 $('#tilawa-r-s1').value=String(range.s1||range.s||1);
 $('#tilawa-r-s2').value=String(range.s2||range.s||1);
 document.querySelectorAll('#tilawa-range-mode [data-mode]').forEach(btn=>{
  btn.classList.toggle('is-on',btn.dataset.mode===mode);
  btn.onclick=()=>{
   tilawaSaveSettings({rangeMode:btn.dataset.mode});
   document.querySelectorAll('#tilawa-range-mode [data-mode]').forEach(b=>b.classList.toggle('is-on',b===btn));
   if(btn.dataset.mode==='page'){
    const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
    const entries=pageEntries(page);
    if(entries.length){
     $('#tilawa-r-s1').value=String(entries[0].s.number);
     $('#tilawa-r-a1').value=String(entries[0].a.numberInSurah);
     $('#tilawa-r-s2').value=String(entries[entries.length-1].s.number);
     $('#tilawa-r-a2').value=String(entries[entries.length-1].a.numberInSurah);
    }
   }
   if(btn.dataset.mode==='surah'){
    const s=Number($('#tilawa-r-s1').value)||1;
    $('#tilawa-r-s2').value=String(s);
    $('#tilawa-r-a1').value='1';
    $('#tilawa-r-a2').value=String(QURAN[s-1]?.ayahs.length||1);
   }
  };
 });
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-back-settings').onclick=()=>openTilawaSettings();
 $('#tilawa-range-form').onsubmit=e=>{
  e.preventDefault();
  let s1=Number($('#tilawa-r-s1').value)||1,s2=Number($('#tilawa-r-s2').value)||s1;
  let a1=Number($('#tilawa-r-a1').value)||1,a2=Number($('#tilawa-r-a2').value)||1;
  if(s2<s1||(s2===s1&&a2<a1)){[s1,s2]=[s2,s1];[a1,a2]=[a2,a1]}
  a1=Math.max(1,Math.min(QURAN[s1-1].ayahs.length,a1));
  a2=Math.max(1,Math.min(QURAN[s2-1].ayahs.length,a2));
  tilawaStartRange({s1,a1,s2,a2,s:s1,from:a1,to:s1===s2?a2:QURAN[s1-1].ayahs.length});
  openTilawaPlayer();
 };
}

function showTilawaFab(){
 const fab=mountTilawaBar();
 if(!fab)return;
 fab.classList.add('is-on');
 clearTimeout(tilawa.fabTimer);
 tilawa.fabTimer=setTimeout(()=>{if(!tilawa.sheet)hideTilawaFab()},6000);
}
function hideTilawaFab(){
 clearTimeout(tilawa.fabTimer);
 $('#tilawa-fab')?.classList.remove('is-on');
}
function bindTilawaFab(){
 const fab=$('#tilawa-fab');
 if(!fab||fab.dataset.bound==='1')return;
 fab.dataset.bound='1';
 fab.onclick=e=>{
  e.stopPropagation();
  hideTilawaFab();
  openTilawaPlayer();
 };
 if(navigator.mediaSession){
  navigator.mediaSession.setActionHandler('play',()=>tilawaPlay());
  navigator.mediaSession.setActionHandler('pause',()=>tilawaPause());
  navigator.mediaSession.setActionHandler('previoustrack',()=>tilawaPrev());
  navigator.mediaSession.setActionHandler('nexttrack',()=>tilawaNext());
 }
 syncTilawaUi();
}
function bindTilawaPageReveal(){
 if(document.documentElement.dataset.tilawaReveal==='1')return;
 document.documentElement.dataset.tilawaReveal='1';
 document.addEventListener('pointerup',e=>{
  if(!['quran','quran-scroll'].includes(currentRoute))return;
  if(tilawa.sheet)return;
  if($('#tilawa-ayah-menu'))return;
  const tEl=e.target;
  if(!(tEl instanceof Element))return;
  if(tEl.closest('#tilawa-fab,#tilawa-sheet-root,#tilawa-ayah-menu,.tilawa-inline,.qpc-ayah-hit,button,a,input,select,textarea,label,.chip,.btn,.book-toolbar,.scroll-reader-bar,.book-navigation,.reader-editions,.focus-bar,#sidebar,header,footer'))return;
  if(!tEl.closest('#main,.book-stage,#book,.vertical-page,.vector-page,.paper-leaf,.qpc-svg,.mushaf,.quran-layout'))return;
  showTilawaFab();
 },{passive:true});
}
function measureLineRange(line,start,end){
 const chars=line.getNumberOfChars?.()||0;if(!chars)return null;
 let minX=Infinity,maxX=-Infinity;const y=Number(line.getAttribute('y'))||0;const size=Number(line.getAttribute('font-size'))||64;
 for(let i=start;i<end&&i<chars;i++){if(line.textContent[i]===' ')continue;try{const p=line.getStartPositionOfChar(i),e=line.getEndPositionOfChar(i);minX=Math.min(minX,p.x,e.x);maxX=Math.max(maxX,p.x,e.x)}catch{}}
 if(!Number.isFinite(minX)||maxX<=minX)return null;return {minX,maxX,y,size};
}
function closeTilawaAyahMenu(){$('#tilawa-ayah-menu')?.remove()}
function openTilawaAyahMenu(s,a,page,evt){
 closeTilawaAyahMenu();
 const menu=document.createElement('div');
 menu.id='tilawa-ayah-menu';menu.className='tilawa-ayah-menu';menu.setAttribute('role','menu');
 menu.innerHTML=`<button type="button" data-act="from">▶ ${t('ابدأ من هذه الآية','Start from this ayah')}</button>
  <button type="button" data-act="page">▣ ${t('اقرأ الصفحة','Play page')}</button>
  <button type="button" data-act="surah">☰ ${t('اقرأ السورة','Play surah')}</button>
  <button type="button" data-act="range">⌖ ${t('مقطع من هنا…','Range from here…')}</button>
  <button type="button" data-act="repeat">🔁 ${t('كرر هذه الآية','Repeat this ayah')}</button>`;
 document.body.append(menu);
 const x=Math.min(window.innerWidth-240,Math.max(8,(evt?.clientX||40)-20));
 const y=Math.min(window.innerHeight-220,Math.max(8,(evt?.clientY||80)+8));
 menu.style.left=x+'px';menu.style.top=y+'px';
 menu.querySelector('[data-act="from"]').onclick=()=>{closeTilawaAyahMenu();tilawaStartSurah(s,a)};
 menu.querySelector('[data-act="page"]').onclick=()=>{closeTilawaAyahMenu();tilawaStartPage(page)};
 menu.querySelector('[data-act="surah"]').onclick=()=>{closeTilawaAyahMenu();tilawaStartSurah(s,1)};
 menu.querySelector('[data-act="range"]').onclick=()=>{
  const max=QURAN[s-1]?.ayahs.length||a;
  tilawaSaveSettings({range:{s1:s,a1:a,s2:s,a2:Math.min(max,a+4),s,from:a,to:Math.min(max,a+4)},rangeMode:'ayah'});
  closeTilawaAyahMenu();openTilawaSheet('range');
 };
 menu.querySelector('[data-act="repeat"]').onclick=()=>{
  tilawaSaveSettings({repeatMode:'ayah',repeatCount:tilawaSettings().repeatCount||3});
  closeTilawaAyahMenu();tilawaStartSurah(s,a);
 };
 setTimeout(()=>document.addEventListener('click',closeTilawaAyahMenu,{once:true}),0);
}
function bindPageAyahHits(page){
 if(!ayahHighlightMap){ayahHighlightPromise.then(()=>bindPageAyahHits(page));return}
 const map=ayahHighlightMap.v2?.[page-1];if(!map)return;
 const ns='http://www.w3.org/2000/svg';
 document.querySelectorAll(`[data-vector-page="${page}"]`).forEach(host=>{
  const svg=host.querySelector('svg.qpc-svg');if(!svg||svg.dataset.hits==='1')return;
  let hits=svg.querySelector('.qpc-hit-layer');
  if(!hits){hits=document.createElementNS(ns,'g');hits.setAttribute('class','qpc-hit-layer');svg.append(hits)}
  hits.replaceChildren();
  for(const [key,ranges] of Object.entries(map)){
   const [s,a]=key.split(':').map(Number);
   for(const [lineIdx,start,end] of ranges){
    const line=svg.querySelector(`.qpc-ink[data-line="${lineIdx}"]`);if(!line)continue;
    const box=measureLineRange(line,start,end);if(!box)continue;
    const rect=document.createElementNS(ns,'rect');
    rect.setAttribute('class','qpc-ayah-hit');
    rect.setAttribute('x',String(box.minX-4));
    rect.setAttribute('y',String(box.y-box.size*0.88));
    rect.setAttribute('width',String(box.maxX-box.minX+8));
    rect.setAttribute('height',String(box.size*1.2));
    rect.addEventListener('click',e=>{e.stopPropagation();openTilawaAyahMenu(s,a,page,e)});
    hits.append(rect);
   }
  }
  svg.dataset.hits='1';
 });
}
function mountTilawaBar(){
 $('#tilawa-bar')?.remove();
 $('#tilawa-dock')?.remove();
 if($('#tilawa-fab')){bindTilawaFab();bindTilawaPageReveal();syncTilawaUi();return $('#tilawa-fab')}
 document.body.insertAdjacentHTML('beforeend',`<button type="button" id="tilawa-fab" class="tilawa-fab" aria-label="${t('فتح مشغّل التلاوة','Open recitation player')}">▶</button>`);
 bindTilawaFab();
 bindTilawaPageReveal();
 return $('#tilawa-fab');
}
function enhanceQuranTextAudio(){
 const details=document.querySelector('.surah-title + details, .quran-layout details');
 const surah=Number($('#quran-mobile-select')?.value)||Number(location.hash.split('/')[1])||1;
 const box=document.querySelector('#ayahs');
 if(box)box.dataset.surah=String(surah);
 const host=document.querySelector('.surah-title')||document.querySelector('.quran-layout .toolbar');
 if(host&&!$('#tilawa-surah-launch')){
  host.insertAdjacentHTML('afterend',`<div class="tilawa-inline" id="tilawa-surah-launch"><button type="button" class="btn" id="tilawa-start-surah">▶ ${t('استمع للسورة','Listen to the surah')}</button><button type="button" class="chip" id="tilawa-open-reciters">♫ ${t('القرّاء','Reciters')}</button></div>`);
  $('#tilawa-start-surah').onclick=()=>tilawaStartSurah(surah,1);
  $('#tilawa-open-reciters').onclick=()=>openTilawaReciters();
 }
 if(details)details.remove();
 document.querySelectorAll('.ayah').forEach(el=>{
  if(el.querySelector('[data-tilawa-ayah]'))return;
  const n=Number(el.id.replace('ayah-',''));
  const tools=el.querySelector('.ayah-tools');
  if(!tools||!n)return;
  tools.insertAdjacentHTML('afterbegin',`<button type="button" data-tilawa-ayah="${n}" aria-label="${t('استمع للآية','Listen to ayah')} ${ar(n)}">▶</button>`);
  tools.querySelector('[data-tilawa-ayah]').onclick=e=>{e.stopPropagation();tilawaStartSurah(surah,n)};
  el.addEventListener('click',e=>{if(e.target.closest('button,a'))return;openTilawaAyahMenu(surah,n,QURAN[surah-1]?.ayahs[n-1]?.page||1,e)});
 });
 mountTilawaBar();
}
function enhanceMushafAudio(){
 mountTilawaBar();
 $('#tilawa-marks')?.remove();
 $('#tilawa-spotlight')?.remove();
 const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
 requestAnimationFrame(()=>{bindPageAyahHits(page);if(tilawaCurrent())highlightTilawaAyah(tilawaCurrent())});
 if($('.book-navigation')&&!$('#tilawa-book-play')){
  $('.book-navigation').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-book-play" type="button" aria-label="${t('تشغيل صفحة المصحف','Play mushaf page')}">▶ ${t('تلاوة','Tilawa')}</button>`);
  $('#tilawa-book-play').onclick=()=>openTilawaPlayer();
 }
 if($('.scroll-reader-bar')&&!$('#tilawa-scroll-play')){
  $('.scroll-reader-bar').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-scroll-play" type="button">▶ ${t('تلاوة','Tilawa')}</button><button class="chip" id="tilawa-scroll-settings" type="button">⚙</button>`);
  $('#tilawa-scroll-play').onclick=()=>openTilawaPlayer();
  $('#tilawa-scroll-settings').onclick=()=>openTilawaSettings();
 }
}

window.onQpcPageReady=function(page){
 requestAnimationFrame(()=>{
  bindPageAyahHits(page);
  const cur=tilawaCurrent();
  if(cur&&cur.page===page&&tilawaSettings().follow)paintMushafAyah(cur);
 });
};
window.SakinahTilawa={TILAWAT_RECITERS,tilawaStartPage,tilawaStartSurah,tilawaStartRange,tilawaSetReciter,tilawaSetSpeed,openTilawaReciters,openTilawaPlayer,openTilawaSettings,mountTilawaBar,enhanceQuranTextAudio,enhanceMushafAudio,syncTilawaUi};

(function wireTilawa(){
 const wrap=()=>{
  if(typeof renderBook==='function'&&!renderBook._tilawa){
   const base=renderBook;renderBook=function(value){base(value);enhanceMushafAudio()};renderBook._tilawa=true;
  }
  if(typeof scrollQuran==='function'&&!scrollQuran._tilawa){
   const base=scrollQuran;scrollQuran=function(start){base(start);enhanceMushafAudio();const vis=$('#visible-page');if(vis&&!vis.dataset.page){const n=Number((vis.textContent||'').match(/\d+/)?.[0]);if(n)vis.dataset.page=String(n)}};scrollQuran._tilawa=true;
  }
  if(typeof renderQuran==='function'&&!renderQuran._tilawa){
   const base=renderQuran;renderQuran=function(snum,anum){base(snum,anum);enhanceQuranTextAudio()};renderQuran._tilawa=true;
  }
 };
 wrap();
 queueMicrotask(wrap);
 setTimeout(wrap,0);
 window.addEventListener('hashchange',()=>{
  queueMicrotask(()=>{
   if(currentRoute==='quran'&&$('#book'))enhanceMushafAudio();
   else if(currentRoute==='quran-scroll')enhanceMushafAudio();
   else if(currentRoute==='quran')enhanceQuranTextAudio();
   else if(!['quran','quran-scroll'].includes(currentRoute)){
    $('#tilawa-dock')?.remove();
    $('#tilawa-fab')?.remove();
    closeTilawaSheets();
    closeTilawaAyahMenu();
    if(tilawa.playing)tilawaPause();
   }
  });
 });
})();

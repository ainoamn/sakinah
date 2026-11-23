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

const tilawa={
 audio:null,
 queue:[],
 index:0,
 playing:false,
 mode:'page',
 abort:0,
 sheet:'', // '', 'player', 'settings', 'reciters', 'range'
 progressTimer:null
};

function tilawaSettings(){
 return {
  speed:Number(read('tilawaSpeed',1))||1,
  repeatAyah:!!read('tilawaRepeatAyah',false),
  repeatRange:!!read('tilawaRepeatRange',false),
  follow:read('tilawaFollow',true)!==false,
  continueOnEnd:read('tilawaContinueOnEnd',true)!==false,
  range:read('tilawaRange',null)
 };
}
function tilawaSaveSettings(patch){
 const next={...tilawaSettings(),...patch};
 write('tilawaSpeed',next.speed);
 write('tilawaRepeatAyah',next.repeatAyah);
 write('tilawaRepeatRange',next.repeatRange);
 write('tilawaFollow',next.follow);
 write('tilawaContinueOnEnd',next.continueOnEnd);
 if(patch.range!==undefined)write('tilawaRange',patch.range);
 return next;
}
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
function tilawaEnsureAudio(){
 if(tilawa.audio)return tilawa.audio;
 const el=new Audio();
 el.preload='auto';
 el.addEventListener('ended',()=>tilawaOnEnded());
 el.addEventListener('error',()=>{
  tilawa.playing=false;
  syncTilawaUi();
  toast(t('تعذر تشغيل التلاوة. تحقق من الاتصال.','Could not play the recitation. Check your connection.'));
 });
 el.addEventListener('play',()=>{tilawa.playing=true;tilawaStartProgress();syncTilawaUi();});
 el.addEventListener('pause',()=>{if(!el.ended){tilawa.playing=false;tilawaStopProgress();syncTilawaUi();}});
 el.addEventListener('timeupdate',()=>tilawaPaintProgress());
 el.addEventListener('loadedmetadata',()=>tilawaPaintProgress());
 tilawa.audio=el;
 el.playbackRate=tilawaSettings().speed;
 return el;
}
function tilawaStartProgress(){
 tilawaStopProgress();
 tilawa.progressTimer=setInterval(tilawaPaintProgress,250);
}
function tilawaStopProgress(){
 if(tilawa.progressTimer){clearInterval(tilawa.progressTimer);tilawa.progressTimer=null}
}
function tilawaPaintProgress(){
 const el=tilawa.audio;
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
 const dock=$('#tilawa-dock-sub');
 if(dock&&cur)dock.textContent=tilawaReciterLabel()+' · '+t('آية','Ayah')+' '+ar(cur.a);
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
function tilawaQueueFromRange(range){
 if(!range)return [];
 return tilawaQueueFromSurah(range.s,range.from,range.to);
}
function tilawaDefaultRange(){
 const cur=tilawaCurrent();
 if(cur)return {s:cur.s,from:cur.a,to:Math.min(cur.a+4,QURAN?.[cur.s-1]?.ayahs.length||cur.a)};
 const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
 const entries=pageEntries(page);
 if(!entries.length)return {s:1,from:1,to:7};
 return {s:entries[0].s.number,from:entries[0].a.numberInSurah,to:entries[entries.length-1].a.numberInSurah};
}
function tilawaRangeLabel(range=tilawaSettings().range||tilawaDefaultRange()){
 if(!range||!QURAN)return t('حدد المقطع','Choose a range');
 const name=tilawaShortName(QURAN[range.s-1]?.name||'');
 return name+' '+ar(range.from)+'–'+ar(range.to);
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
 const dock=$('#tilawa-dock');
 if(dock){
  const play=$('#tilawa-dock-play');
  const title=$('#tilawa-dock-title');
  const sub=$('#tilawa-dock-sub');
  if(play){
   play.textContent=tilawa.playing?'❚❚':'▶';
   play.setAttribute('aria-label',tilawa.playing?t('إيقاف','Pause'):t('تشغيل','Play'));
  }
  if(title)title.textContent=cur?tilawaShortName(cur.name):t('التلاوة','Recitation');
  if(sub)sub.textContent=cur?(tilawaReciterLabel()+' · '+t('آية','Ayah')+' '+ar(cur.a)):tilawaReciterLabel();
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
 $('#tilawa-feat-repeat')?.classList.toggle('is-on',conf.repeatAyah||conf.repeatRange);
 $('#tilawa-feat-follow')?.classList.toggle('is-on',conf.follow);
 $('#tilawa-feat-range')?.classList.toggle('is-on',!!conf.range);
 const rate=tilawaEnsureAudio();
 rate.playbackRate=conf.speed;
 tilawaPaintProgress();
 if(tilawa.sheet==='settings')fillTilawaSettings();
 if(tilawa.sheet==='player'||tilawa.sheet==='settings')$('#tilawa-sheet-root')?.classList.add('is-open');
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
 el.src=tilawaAyahUrl(cur.g);
 el.playbackRate=tilawaSettings().speed;
 try{el.load()}catch{}
 syncTilawaUi();
 if(token!==tilawa.abort)return;
 tilawaFollowPage(cur);
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
 const el=tilawaEnsureAudio();
 await tilawaLoadCurrent();
 try{await el.play();tilawa.playing=true}catch{
  tilawa.playing=false;
  toast(t('اضغط التشغيل مرة أخرى بعد اختيار القارئ.','Tap play again after choosing a reciter.'));
 }
 syncTilawaUi();
 openTilawaPlayer();
}
function tilawaPause(){
 tilawaEnsureAudio().pause();
 tilawa.playing=false;
 syncTilawaUi();
}
function tilawaToggle(){tilawa.playing?tilawaPause():tilawaPlay()}
function tilawaStop(){
 tilawaPause();
 const el=tilawaEnsureAudio();
 try{el.currentTime=0}catch{}
 tilawa.queue=[];tilawa.index=0;
 clearTilawaHighlights();
 syncTilawaUi();
 closeTilawaSheets();
}
async function tilawaOnEnded(){
 const conf=tilawaSettings();
 if(conf.repeatAyah){
  const el=tilawaEnsureAudio();
  try{el.currentTime=0;await el.play();tilawa.playing=true}catch{tilawa.playing=false}
  syncTilawaUi();
  return;
 }
 if(tilawa.index>=tilawa.queue.length-1){
  if(conf.repeatRange&&tilawa.queue.length){
   tilawa.index=0;
   await tilawaLoadCurrent();
   try{await tilawaEnsureAudio().play();tilawa.playing=true}catch{tilawa.playing=false}
   syncTilawaUi();
   return;
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
      try{await tilawaEnsureAudio().play();tilawa.playing=true}catch{tilawa.playing=false}
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
 tilawa.index++;
 await tilawaLoadCurrent();
 try{await tilawaEnsureAudio().play();tilawa.playing=true}catch{tilawa.playing=false}
 syncTilawaUi();
}
async function tilawaNext(auto=false){
 if(!tilawa.queue.length)return;
 if(tilawa.index>=tilawa.queue.length-1){
  if(auto)return tilawaOnEnded();
  tilawa.playing=false;syncTilawaUi();return;
 }
 tilawa.index++;
 await tilawaLoadCurrent();
 if(auto||tilawa.playing){
  try{await tilawaEnsureAudio().play();tilawa.playing=true}catch{tilawa.playing=false}
 }
 syncTilawaUi();
}
async function tilawaPrev(){
 if(!tilawa.queue.length)return;
 const el=tilawaEnsureAudio();
 if(el.currentTime>2){el.currentTime=0;tilawaPaintProgress();return}
 tilawa.index=Math.max(0,tilawa.index-1);
 await tilawaLoadCurrent();
 if(tilawa.playing){try{await el.play()}catch{tilawa.playing=false}}
 syncTilawaUi();
}
function tilawaSeekBy(delta){
 const el=tilawaEnsureAudio();
 if(!Number.isFinite(el.duration))return;
 el.currentTime=Math.max(0,Math.min(el.duration,el.currentTime+delta));
 tilawaPaintProgress();
}
function tilawaSetReciter(id){
 if(!TILAWAT_RECITERS.some(r=>r.id===id))return;
 write('tilawaReciter',id);
 const was=tilawa.playing;
 tilawaPause();
 tilawaLoadCurrent().then(()=>{if(was)tilawaPlay()});
 syncTilawaUi();
}
function tilawaSetSpeed(speed){
 const s=TILAWAT_SPEEDS.includes(Number(speed))?Number(speed):1;
 tilawaSaveSettings({speed:s});
 tilawaEnsureAudio().playbackRate=s;
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
}
function openTilawaSheet(kind){
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
   <button type="button" id="tilawa-feat-repeat" class="${conf.repeatAyah||conf.repeatRange?'is-on':''}"><span>🔁</span>${t('تكرار','Repeat')}</button>
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
 $('#tilawa-next').onclick=()=>tilawaNext(false);
 $('#tilawa-back10').onclick=()=>tilawaSeekBy(-10);
 $('#tilawa-fwd10').onclick=()=>tilawaSeekBy(10);
 $('#tilawa-rew').onclick=()=>tilawaSeekBy(-5);
 $('#tilawa-ff').onclick=()=>tilawaSeekBy(5);
 $('#tilawa-seek').oninput=e=>{const el=tilawaEnsureAudio();el.currentTime=Number(e.target.value)||0;tilawaPaintProgress()};
 $('#tilawa-feat-repeat').onclick=()=>{
  const conf=tilawaSettings();
  if(conf.repeatAyah||conf.repeatRange)tilawaSaveSettings({repeatAyah:false,repeatRange:false});
  else tilawaSaveSettings({repeatAyah:true,repeatRange:false});
  syncTilawaUi();
 };
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
 }
 const rangeStrong=$('#tilawa-settings-range strong');
 if(rangeStrong)rangeStrong.textContent=tilawaRangeLabel(range);
 const repAyah=$('#tilawa-repeat-ayah');
 const repRange=$('#tilawa-repeat-range');
 const follow=$('#tilawa-follow');
 const cont=$('#tilawa-continue');
 if(repAyah)repAyah.checked=conf.repeatAyah;
 if(repRange)repRange.checked=conf.repeatRange;
 if(follow)follow.checked=conf.follow;
 if(cont)cont.checked=conf.continueOnEnd;
 document.querySelectorAll('[data-tilawa-speed]').forEach(btn=>{
  btn.classList.toggle('is-on',Number(btn.dataset.tilawaSpeed)===conf.speed);
 });
}
function renderTilawaSettingsSheet(){
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-player" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--tilawa-gold)">${t('إعدادات الصوت','Audio settings')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <div class="tilawa-settings">
   <label class="tilawa-block-label">${t('اختر القارئ','Choose reciter')}</label>
   <button type="button" class="tilawa-reciter-pick" id="tilawa-settings-reciter">
    <span class="avatar">🎙</span>
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
    <div class="tilawa-toggle-row"><span>${t('تكرار الآية','Repeat ayah')}</span><label class="tilawa-switch"><input type="checkbox" id="tilawa-repeat-ayah"><span></span></label></div>
    <div class="tilawa-toggle-row"><span>${t('تكرار المقطع','Repeat range')}</span><label class="tilawa-switch"><input type="checkbox" id="tilawa-repeat-range"><span></span></label></div>
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
 $('#tilawa-repeat-ayah').onchange=e=>{
  tilawaSaveSettings({repeatAyah:e.target.checked,repeatRange:e.target.checked?false:tilawaSettings().repeatRange});
  syncTilawaUi();
 };
 $('#tilawa-repeat-range').onchange=e=>{
  tilawaSaveSettings({repeatRange:e.target.checked,repeatAyah:e.target.checked?false:tilawaSettings().repeatAyah});
  syncTilawaUi();
 };
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
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-settings" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--tilawa-gold)">${t('اختر القارئ','Choose reciter')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <div class="tilawa-reciters" role="listbox">${TILAWAT_RECITERS.map(r=>`<button type="button" class="tilawa-reciter-card ${r.id===current?'active':''}" data-reciter="${r.id}" role="option" aria-selected="${r.id===current}"><span class="avatar">🎙</span><span><strong>${esc(lang()==='en'?r.en:r.ar)}</strong><small>${esc(lang()==='en'?r.ar:r.en)}</small></span></button>`).join('')}</div>
  <p class="hint" style="color:var(--tilawa-muted);font-size:12px;margin:10px 4px 0">${t('التلاوات عبر شبكة Islamic Network، وتحتاج اتصالًا بالإنترنت.','Recitations via Islamic Network; an internet connection is required.')}</p>`;
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-back-settings').onclick=()=>openTilawaSettings();
 document.querySelectorAll('[data-reciter]').forEach(btn=>btn.onclick=()=>{tilawaSetReciter(btn.dataset.reciter);openTilawaSettings()});
}
function renderTilawaRangeSheet(){
 const range=tilawaSettings().range||tilawaDefaultRange();
 const surahOpts=QURAN.map(s=>`<option value="${s.number}" ${s.number===range.s?'selected':''}>${ar(s.number)} — ${esc(s.name)}</option>`).join('');
 $('#tilawa-sheet-body').innerHTML=`
  <div class="tilawa-sheet-top">
   <button type="button" class="tilawa-icon-btn" id="tilawa-back-settings" aria-label="${t('رجوع','Back')}">›</button>
   <h3 style="flex:1;margin:0;text-align:center;color:var(--tilawa-gold)">${t('حدد المقطع','Choose range')}</h3>
   <button type="button" class="tilawa-icon-btn" id="tilawa-close-sheet" aria-label="${t('إغلاق','Close')}">×</button>
  </div>
  <form class="tilawa-range-form" id="tilawa-range-form">
   <label>${t('السورة','Surah')}<select id="tilawa-range-surah">${surahOpts}</select></label>
   <label>${t('من آية','From ayah')}<input id="tilawa-range-from" type="number" min="1" value="${range.from}"></label>
   <label>${t('إلى آية','To ayah')}<input id="tilawa-range-to" type="number" min="1" value="${range.to}"></label>
   <button type="submit" class="tilawa-play-wide">▶ ${t('تشغيل المقطع','Play range')}</button>
  </form>`;
 const syncMax=()=>{
  const s=Number($('#tilawa-range-surah').value)||1;
  const max=QURAN[s-1]?.ayahs.length||1;
  $('#tilawa-range-from').max=String(max);
  $('#tilawa-range-to').max=String(max);
 };
 syncMax();
 $('#tilawa-range-surah').onchange=syncMax;
 $('#tilawa-close-sheet').onclick=()=>closeTilawaSheets();
 $('#tilawa-back-settings').onclick=()=>openTilawaSettings();
 $('#tilawa-range-form').onsubmit=e=>{
  e.preventDefault();
  const s=Number($('#tilawa-range-surah').value)||1;
  const max=QURAN[s-1]?.ayahs.length||1;
  let from=Math.max(1,Math.min(max,Number($('#tilawa-range-from').value)||1));
  let to=Math.max(1,Math.min(max,Number($('#tilawa-range-to').value)||from));
  if(to<from)[from,to]=[to,from];
  tilawaStartRange({s,from,to});
  openTilawaPlayer();
 };
}

function tilawaDockHtml(){
 return `<aside id="tilawa-dock" class="tilawa-dock" aria-label="${t('مشغّل التلاوة','Recitation player')}">
  <button type="button" class="tilawa-dock-btn" id="tilawa-dock-play" aria-label="${t('تشغيل','Play')}">▶</button>
  <div class="tilawa-dock-meta" id="tilawa-dock-open">
   <strong id="tilawa-dock-title">${t('التلاوة','Recitation')}</strong>
   <small id="tilawa-dock-sub">${esc(tilawaReciterLabel())}</small>
  </div>
  <button type="button" class="tilawa-dock-gear" id="tilawa-dock-settings" aria-label="${t('إعدادات الصوت','Audio settings')}">⚙</button>
 </aside>`;
}
function bindTilawaDock(){
 const dock=$('#tilawa-dock');
 if(!dock||dock.dataset.bound==='1')return;
 dock.dataset.bound='1';
 $('#tilawa-dock-play').onclick=e=>{e.stopPropagation();tilawaToggle();if(tilawa.playing)openTilawaPlayer()};
 $('#tilawa-dock-settings').onclick=e=>{e.stopPropagation();openTilawaSettings()};
 $('#tilawa-dock-open').onclick=()=>openTilawaPlayer();
 dock.addEventListener('click',e=>{if(e.target===dock)openTilawaPlayer()});
 if(navigator.mediaSession){
  navigator.mediaSession.setActionHandler('play',()=>tilawaPlay());
  navigator.mediaSession.setActionHandler('pause',()=>tilawaPause());
  navigator.mediaSession.setActionHandler('previoustrack',()=>tilawaPrev());
  navigator.mediaSession.setActionHandler('nexttrack',()=>tilawaNext(false));
 }
 syncTilawaUi();
}
function mountTilawaBar(){
 $('#tilawa-bar')?.remove();
 if($('#tilawa-dock')){bindTilawaDock();syncTilawaUi();return $('#tilawa-dock')}
 document.body.insertAdjacentHTML('beforeend',tilawaDockHtml());
 bindTilawaDock();
 return $('#tilawa-dock');
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
  tools.querySelector('[data-tilawa-ayah]').onclick=()=>tilawaStartSurah(surah,n);
 });
 mountTilawaBar();
}
function enhanceMushafAudio(){
 mountTilawaBar();
 $('#tilawa-marks')?.remove();
 $('#tilawa-spotlight')?.remove();
 if(tilawaCurrent())requestAnimationFrame(()=>highlightTilawaAyah(tilawaCurrent()));
 if($('.book-navigation')&&!$('#tilawa-book-play')){
  $('.book-navigation').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-book-play" type="button" aria-label="${t('تشغيل صفحة المصحف','Play mushaf page')}">▶ ${t('تلاوة','Tilawa')}</button>`);
  $('#tilawa-book-play').onclick=()=>{tilawaStartPage(Number($('#book')?.dataset.page)||read('lastPage',1));openTilawaPlayer()};
 }
 if($('.scroll-reader-bar')&&!$('#tilawa-scroll-play')){
  $('.scroll-reader-bar').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-scroll-play" type="button">▶ ${t('تلاوة','Tilawa')}</button><button class="chip" id="tilawa-scroll-settings" type="button">⚙</button>`);
  $('#tilawa-scroll-play').onclick=()=>{
   const page=Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
   tilawaStartPage(page);openTilawaPlayer();
  };
  $('#tilawa-scroll-settings').onclick=()=>openTilawaSettings();
 }
}

window.onQpcPageReady=function(page){
 const cur=tilawaCurrent();
 if(cur&&cur.page===page&&tilawaSettings().follow)requestAnimationFrame(()=>paintMushafAyah(cur));
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
    closeTilawaSheets();
    if(tilawa.playing)tilawaPause();
   }
  });
 });
})();

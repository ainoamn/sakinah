/* Tilawa library: multi-reciter ayah playback in a Golden-Mushaf style mini player. */
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

const tilawa={
 audio:null,
 queue:[],
 index:0,
 playing:false,
 mode:'page',
 abort:0
};

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
function tilawaEnsureAudio(){
 if(tilawa.audio)return tilawa.audio;
 const el=new Audio();
 el.preload='auto';
 el.addEventListener('ended',()=>tilawaNext(true));
 el.addEventListener('error',()=>{
  tilawa.playing=false;
  syncTilawaUi();
  toast(t('تعذر تشغيل التلاوة. تحقق من الاتصال.','Could not play the recitation. Check your connection.'));
 });
 el.addEventListener('play',()=>{tilawa.playing=true;syncTilawaUi();});
 el.addEventListener('pause',()=>{if(!el.ended){tilawa.playing=false;syncTilawaUi();}});
 tilawa.audio=el;
 return el;
}
function tilawaCurrent(){
 return tilawa.queue[tilawa.index]||null;
}
function tilawaQueueFromPage(page){
 if(!QURAN)return [];
 return pageEntries(page).map(({s,a})=>({
  s:s.number,
  a:a.numberInSurah,
  g:a.number,
  page:a.page,
  name:s.name,
  text:a.text
 }));
}
function tilawaQueueFromSurah(snum){
 if(!QURAN)return [];
 const s=QURAN[snum-1];
 if(!s)return [];
 return s.ayahs.map(a=>({
  s:s.number,
  a:a.numberInSurah,
  g:a.number,
  page:a.page,
  name:s.name,
  text:a.text
 }));
}
function clearTilawaHighlights(){
 document.querySelectorAll('.ayah.is-playing,.tilawa-mark.is-playing,.flow-ayah.is-playing,.tilawa-leaf.is-playing').forEach(el=>el.classList.remove('is-playing'));
 const spot=$('#tilawa-spotlight');
 if(spot)spot.classList.remove('is-on');
}
function ensureTilawaSpotlight(){
 let spot=$('#tilawa-spotlight');
 if(spot)return spot;
 const host=$('.book-stage')||$('#scroll-pages')||$('#main')||document.body;
 host.insertAdjacentHTML('beforeend',`<aside id="tilawa-spotlight" class="tilawa-spotlight" aria-live="polite"><small id="tilawa-spot-label"></small><p id="tilawa-spot-text" lang="ar" dir="rtl"></p></aside>`);
 return $('#tilawa-spotlight');
}
function ensureTilawaMarks(page){
 if(!page||!QURAN)return null;
 let rail=$('#tilawa-marks');
 const entries=pageEntries(page);
 if(!entries.length)return null;
 if(!rail){
  const host=$('.book-navigation')||$('.scroll-reader-bar')||$('#tilawa-bar')||$('#main');
  host.insertAdjacentHTML(host.id==='tilawa-bar'?'beforebegin':'beforeend',`<div id="tilawa-marks" class="tilawa-marks" role="list" aria-label="${t('آيات الصفحة','Page verses')}"></div>`);
  rail=$('#tilawa-marks');
 }
 const key=entries.map(e=>e.s.number+':'+e.a.numberInSurah).join(',');
 if(rail.dataset.key===key)return rail;
 rail.dataset.key=key;
 rail.dataset.page=String(page);
 rail.innerHTML=entries.map(({s,a})=>`<button type="button" class="tilawa-mark" role="listitem" data-tilawa-mark="${s.number}:${a.numberInSurah}" data-page="${a.page}" aria-label="${t('آية','Ayah')} ${ar(a.numberInSurah)}">${ar(a.numberInSurah)}</button>`).join('');
 rail.querySelectorAll('[data-tilawa-mark]').forEach(btn=>btn.onclick=()=>{
  const [s,a]=btn.dataset.tilawaMark.split(':').map(Number);
  const pageNo=Number(btn.dataset.page)||page;
  if(tilawa.mode==='surah')tilawaStartSurah(s,a);
  else tilawaStartPage(pageNo,a);
 });
 return rail;
}
function highlightTilawaAyah(cur){
 clearTilawaHighlights();
 if(!cur)return;
 // Text mushaf view
 const textHit=document.getElementById('ayah-'+cur.a);
 if(textHit&&Number(document.querySelector('#ayahs')?.dataset?.surah||cur.s)===cur.s){
  textHit.classList.add('is-playing');
  if(tilawa.playing)textHit.scrollIntoView({block:'center',behavior:'smooth'});
 }
 // Page verse chips
 const page=cur.page||Number($('#book')?.dataset.page)||read('lastPage',1);
 const rail=ensureTilawaMarks(page);
 rail?.querySelectorAll('.tilawa-mark').forEach(btn=>{
  const on=btn.dataset.tilawaMark===cur.s+':'+cur.a;
  btn.classList.toggle('is-playing',on);
  if(on&&tilawa.playing)btn.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
 });
 // Spotlight card over mushaf
 const spot=ensureTilawaSpotlight();
 $('#tilawa-spot-label').textContent=cur.name+' · '+t('الآية','Verse')+' '+ar(cur.a);
 $('#tilawa-spot-text').textContent=cur.text+' ﴿'+ar(cur.a)+'﴾';
 spot.classList.add('is-on');
 spot.dataset.ayah=cur.s+':'+cur.a;
 // Mark current leaf in continuous view
 document.querySelector(`.vertical-page[data-vertical-page="${cur.page}"]`)?.classList.add('tilawa-leaf','is-playing');
 document.querySelector(`.paper-leaf[data-page="${cur.page}"], .paper-leaf[data-page='${cur.page}']`)?.classList.add('is-playing');
}
function syncTilawaUi(){
 const bar=$('#tilawa-bar');
 const cur=tilawaCurrent();
 if(bar){
  const play=$('#tilawa-play');
  const meta=$('#tilawa-meta');
  const ayah=$('#tilawa-ayah');
  const rec=$('#tilawa-reciter');
  if(play){
   play.textContent=tilawa.playing?'❚❚':'▶';
   play.setAttribute('aria-label',tilawa.playing?t('إيقاف','Pause'):t('تشغيل','Play'));
   play.setAttribute('aria-pressed',String(tilawa.playing));
  }
  if(rec)rec.textContent='♫ '+tilawaReciterLabel();
  if(meta&&cur)meta.textContent=cur.name+' · '+t('آية','Ayah')+' '+ar(cur.a);
  else if(meta)meta.textContent=t('اختر صفحة أو سورة للاستماع','Choose a page or surah to listen');
  if(ayah&&cur)ayah.textContent=cur.text;
  else if(ayah)ayah.textContent='';
 }
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
 try{el.load()}catch{}
 syncTilawaUi();
 if(token!==tilawa.abort)return;
 // Follow the mushaf page of the recited ayah
 if(cur.page){
  if(currentRoute==='quran'&&$('#book')){
   const page=Number($('#book').dataset.page);
   if(page&&page!==cur.page)location.hash='quran/page/'+cur.page;
  }else if(currentRoute==='quran-scroll'){
   const leaf=document.querySelector(`.vertical-page[data-vertical-page="${cur.page}"]`);
   leaf?.scrollIntoView({block:'center',behavior:'smooth'});
  }
  ensureTilawaMarks(cur.page);
 }
}
async function tilawaPlay(){
 if(!tilawa.queue.length){
  const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
  tilawa.queue=tilawaQueueFromPage(page);
  tilawa.index=0;
  tilawa.mode='page';
 }
 if(!tilawa.queue.length){toast(t('لا تتوفر آيات للتشغيل.','No verses available to play.'));return}
 const el=tilawaEnsureAudio();
 await tilawaLoadCurrent();
 try{
  await el.play();
  tilawa.playing=true;
 }catch{
  tilawa.playing=false;
  toast(t('اضغط التشغيل مرة أخرى بعد اختيار القارئ.','Tap play again after choosing a reciter.'));
 }
 syncTilawaUi();
}
function tilawaPause(){
 tilawaEnsureAudio().pause();
 tilawa.playing=false;
 syncTilawaUi();
}
function tilawaToggle(){
 if(tilawa.playing)tilawaPause();
 else tilawaPlay();
}
async function tilawaNext(auto=false){
 if(!tilawa.queue.length)return;
 if(tilawa.index>=tilawa.queue.length-1){
  tilawa.playing=false;
  syncTilawaUi();
  if(auto)toast(t('انتهت التلاوة.','Recitation finished.'));
  return;
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
 tilawa.index=Math.max(0,tilawa.index-1);
 await tilawaLoadCurrent();
 if(tilawa.playing){
  try{await tilawaEnsureAudio().play()}catch{tilawa.playing=false}
 }
 syncTilawaUi();
}
function tilawaSetReciter(id){
 if(!TILAWAT_RECITERS.some(r=>r.id===id))return;
 write('tilawaReciter',id);
 const was=tilawa.playing;
 tilawaPause();
 tilawaLoadCurrent().then(()=>{if(was)tilawaPlay()});
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
function openTilawaReciters(){
 if(typeof openReaderDialog!=='function'){
  const pick=prompt(TILAWAT_RECITERS.map((r,i)=>`${i+1}. ${r.ar}`).join('\n'),'1');
  const n=Number(pick)-1;
  if(TILAWAT_RECITERS[n])tilawaSetReciter(TILAWAT_RECITERS[n].id);
  return;
 }
 const current=tilawaReciter().id;
 const body=`<div class="tilawa-reciters" role="listbox" aria-label="${t('اختيار القارئ','Choose a reciter')}">${TILAWAT_RECITERS.map(r=>`<button type="button" class="tilawa-reciter-card ${r.id===current?'active':''}" data-reciter="${r.id}" role="option" aria-selected="${r.id===current}"><strong>${esc(lang()==='en'?r.en:r.ar)}</strong><small>${esc(lang()==='en'?r.ar:r.en)}</small></button>`).join('')}</div><p class="hint">${t('التلاوات عبر شبكة Islamic Network / EveryAyah، وتحتاج اتصالًا بالإنترنت.','Recitations via Islamic Network / EveryAyah; an internet connection is required.')}</p>`;
 const d=openReaderDialog(t('مكتبة القرّاء','Reciter library'),body);
 d.querySelectorAll('[data-reciter]').forEach(btn=>btn.onclick=()=>{tilawaSetReciter(btn.dataset.reciter);d.close()});
}
function tilawaBarHtml(){
 return `<aside id="tilawa-bar" class="tilawa-bar" aria-label="${t('مشغّل التلاوة','Recitation player')}">
  <button type="button" class="chip" id="tilawa-reciter" aria-label="${t('اختيار القارئ','Choose reciter')}">♫ ${esc(tilawaReciterLabel())}</button>
  <div class="tilawa-now">
   <strong id="tilawa-meta">${t('التلاوة جاهزة','Recitation ready')}</strong>
   <span id="tilawa-ayah" class="tilawa-ayah-line" lang="ar" dir="rtl"></span>
  </div>
  <div class="tilawa-controls">
   <button type="button" class="chip" id="tilawa-prev" aria-label="${t('الآية السابقة','Previous ayah')}">→</button>
   <button type="button" class="chip tilawa-play" id="tilawa-play" aria-label="${t('تشغيل','Play')}">▶</button>
   <button type="button" class="chip" id="tilawa-next" aria-label="${t('الآية التالية','Next ayah')}">←</button>
   <button type="button" class="chip" id="tilawa-page" aria-label="${t('تشغيل الصفحة','Play page')}">▣ ${t('الصفحة','Page')}</button>
  </div>
 </aside>`;
}
function bindTilawaBar(){
 const bar=$('#tilawa-bar');
 if(!bar||bar.dataset.bound==='1')return;
 bar.dataset.bound='1';
 $('#tilawa-play').onclick=()=>tilawaToggle();
 $('#tilawa-prev').onclick=()=>tilawaPrev();
 $('#tilawa-next').onclick=()=>tilawaNext(false);
 $('#tilawa-reciter').onclick=()=>openTilawaReciters();
 $('#tilawa-page').onclick=()=>{
  const page=Number($('#book')?.dataset.page)||Number(document.querySelector('.vertical-page.is-visible')?.dataset.verticalPage)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
  tilawaStartPage(page);
 };
 syncTilawaUi();
 if(navigator.mediaSession){
  navigator.mediaSession.setActionHandler('play',()=>tilawaPlay());
  navigator.mediaSession.setActionHandler('pause',()=>tilawaPause());
  navigator.mediaSession.setActionHandler('previoustrack',()=>tilawaPrev());
  navigator.mediaSession.setActionHandler('nexttrack',()=>tilawaNext(false));
 }
}
function mountTilawaBar(where='main'){
 if($('#tilawa-bar')){bindTilawaBar();syncTilawaUi();return $('#tilawa-bar')}
 const host=where==='body'?document.body:($('#main')||document.body);
 host.insertAdjacentHTML(where==='body'?'beforeend':'beforeend',tilawaBarHtml());
 bindTilawaBar();
 return $('#tilawa-bar');
}
function enhanceQuranTextAudio(){
 const details=document.querySelector('.surah-title + details, .quran-layout details');
 const surah=Number($('#quran-mobile-select')?.value)||Number(location.hash.split('/')[1])||1;
 const box=document.querySelector('#ayahs');
 if(box)box.dataset.surah=String(surah);
 // Replace single-reciter surah audio with library controls
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
 const page=Number($('#book')?.dataset.page)||Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
 ensureTilawaMarks(page);
 if(tilawaCurrent())highlightTilawaAyah(tilawaCurrent());
 // page play chip near navigation if present
 if($('.book-navigation')&&!$('#tilawa-book-play')){
  $('.book-navigation').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-book-play" type="button" aria-label="${t('تشغيل صفحة المصحف','Play mushaf page')}">▶ ${t('تلاوة','Tilawa')}</button>`);
  $('#tilawa-book-play').onclick=()=>tilawaStartPage(Number($('#book')?.dataset.page)||read('lastPage',1));
 }
 if($('.scroll-reader-bar')&&!$('#tilawa-scroll-play')){
  $('.scroll-reader-bar').insertAdjacentHTML('beforeend',`<button class="chip" id="tilawa-scroll-play" type="button">▶ ${t('تلاوة','Tilawa')}</button><button class="chip" id="tilawa-scroll-reciters" type="button">♫</button>`);
  $('#tilawa-scroll-play').onclick=()=>{
   const page=Number($('#visible-page')?.dataset?.page)||read('lastPage',1);
   tilawaStartPage(page);
  };
  $('#tilawa-scroll-reciters').onclick=()=>openTilawaReciters();
 }
}

window.SakinahTilawa={TILAWAT_RECITERS,tilawaStartPage,tilawaStartSurah,tilawaSetReciter,openTilawaReciters,mountTilawaBar,enhanceQuranTextAudio,enhanceMushafAudio,syncTilawaUi};

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
 // Re-wrap after other modules finish patching
 queueMicrotask(wrap);
 setTimeout(wrap,0);
 window.addEventListener('hashchange',()=>{
  queueMicrotask(()=>{
   if(currentRoute==='quran'&&$('#book'))enhanceMushafAudio();
   else if(currentRoute==='quran-scroll')enhanceMushafAudio();
   else if(currentRoute==='quran')enhanceQuranTextAudio();
   else if(!['quran','quran-scroll'].includes(currentRoute)){
    $('#tilawa-bar')?.remove();
    if(tilawa.playing)tilawaPause();
   }
  });
 });
})();

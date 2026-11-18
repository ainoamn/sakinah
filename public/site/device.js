/* Shared browser / standalone-app lifecycle. Reading remains public and local. */
function restoreDeviceMemory(force=false){
 counts=read('counts',{});favorites=read('favorites',[]);bookmark=read('bookmark',null);tasbihCount=read('tasbih',0);tasbihDhikr=read('tasbihDhikr','سبحان الله');fontSize=read('font',matchMedia('(max-width:760px)').matches?26:32);flowFont=read('quranFlowFont',0);document.documentElement.style.setProperty('--reading',fontSize+'px');
 const resumed=SakinahState.resume();
 if(force||resumed){route();return}
 if($('#library-grid')&&['athkar','duas','ruqyah','salawat','praise','humility','favorites'].includes(currentRoute)){
  document.querySelectorAll('[data-count]').forEach(b=>{const d=LIBRARY.find(x=>x.id===b.dataset.count);if(!d)return;const n=counts[d.id]||0,goal=dhikrGoal(d);b.style.setProperty('--progress',Math.min(100,n/goal*100)+'%');const strong=b.querySelector('strong'),small=b.querySelector('small');if(strong)strong.textContent=ar(n);if(small)small.textContent=n>=goal?'اكتمل الورد ✓':'اضغط مع كل ذكر';b.classList.toggle('complete',n>=goal)});
  activeDeck?.show();return
 }
 route()
}
SakinahState.ready.then(()=>{document.documentElement.dataset.persistenceReady='true';if(SakinahState.recovered)restoreDeviceMemory();SakinahState.rememberRoute(true,true)});
function updateDeviceViewport(){const view=window.visualViewport;const height=view&&Math.abs(view.scale-1)<.01?view.height:innerHeight;document.documentElement.style.setProperty('--screen-vh',height+'px');document.documentElement.dataset.standalone=isStandalone()?'true':'false'}
window.addEventListener('resize',updateDeviceViewport);window.addEventListener('pageshow',updateDeviceViewport);window.visualViewport?.addEventListener('resize',updateDeviceViewport);updateDeviceViewport();
if(isStandalone())SakinahState.protect();window.addEventListener('appinstalled',()=>SakinahState.protect());
const progressKey=/^(?:counts|tasbih|tasbihDhikr|tasbihGoal|savedPage|lastPage|bookmark|lastRoute|autoAdvance|font|quranFlowFont|quranSelectedSurahs|mushafEdition|language|favorites|session-.{1,150}|deckPosition-.{1,150}|flowPart-\d{1,3}|bookPosition-[a-z-]+|bookPart-[a-z-]+|libraryMode|libraryFont)$/;
function progressSnapshot(){const values=Object.fromEntries(SakinahState.entries().filter(([key])=>progressKey.test(key)));return {schema:'sakinah-progress',version:1,savedAt:new Date().toISOString(),values}}
function validateProgress(data){
 if(data?.schema!=='sakinah-progress'||data.version!==1||!data.values||Array.isArray(data.values)||typeof data.values!=='object'||Object.keys(data.values).length>300)throw Error('format');
 const values={};for(const [key,value]of Object.entries(data.values)){if(!progressKey.test(key))continue;const size=JSON.stringify(value).length;if(size>150000)throw Error('size');
  if(['lastPage','savedPage'].includes(key)&&(!Number.isInteger(value)||value<1||value>604))throw Error('page');
  if((key==='tasbih'||/^(flowPart-|bookPosition-|bookPart-|deckPosition-)/.test(key))&&(!Number.isInteger(value)||value<0||value>1e9))throw Error('count');
  if(key==='tasbihGoal'&&![33,100,1000].includes(value))throw Error('goal');
  if(key==='counts'||key.startsWith('session-')){if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([id,n])=>!/^[a-zA-Z0-9_-]{1,50}$/.test(id)||!Number.isInteger(n)||n<0||n>1e9))throw Error('counts')}
  if(key==='lastRoute'&&(typeof value!=='string'||!/^#[a-z][^\u0000-\u001f]{0,250}$/.test(value)))throw Error('route');
  if(key==='font'&&(!Number.isInteger(value)||value<22||value>46))throw Error('font');if(key==='quranFlowFont'&&(value!==0&&(!Number.isInteger(value)||value<26||value>64)))throw Error('font');
  if(key==='libraryMode'&&!['spread','scroll'].includes(value))throw Error('mode');if(key==='libraryFont'&&(!Number.isInteger(value)||value<22||value>44))throw Error('font');
  if(key==='language'&&!['ar','en'].includes(value))throw Error('language');if(key==='mushafEdition'&&!['hafs','tajweed','tafsir'].includes(value))throw Error('edition');
  if(key==='tasbihDhikr'&&(typeof value!=='string'||value.length>150))throw Error('text');if(key==='autoAdvance'&&typeof value!=='boolean')throw Error('boolean');
  if(key==='favorites'&&(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,50}$/.test(id))))throw Error('favorites');
  if(key==='bookmark'&&value!==null&&(!Number.isInteger(value?.s)||value.s<1||value.s>114||!Number.isInteger(value?.a)||value.a<1||value.a>286))throw Error('bookmark');
  values[key]=value
 }return values
}
function addProgressTools(dialog){if(!dialog||dialog.querySelector('.device-state-tools'))return;const tools=document.createElement('div');tools.className='device-state-tools';tools.innerHTML=`<button class="chip" id="progress-export">↓ ${t('حفظ نسخة من موضعي وعداداتي','Back up reading & counters')}</button><button class="chip" id="progress-import">↑ ${t('استعادة نسخة','Restore backup')}</button><input id="progress-file" type="file" accept="application/json,.json"><p class="hint">${t('يمكن نقل النسخة إلى التطبيق المثبّت إذا استخدم مساحة حفظ مستقلة عن المتصفح. لا تتضمن بيانات الدخول.','Use a backup to transfer progress if the installed app has separate browser storage. Sign-in data is excluded.')}</p><a class="chip" href="#account">${t('حسابي لمزامنة التقدم بين الأجهزة','Sign in to sync progress across devices')} ←</a>`;dialog.append(tools);tools.querySelector('#progress-export').onclick=()=>{SakinahState.rememberRoute();downloadBlob(new Blob([JSON.stringify(progressSnapshot(),null,2)],{type:'application/json'}),'sakinah-progress-'+new Date().toISOString().slice(0,10)+'.json')};tools.querySelector('#progress-import').onclick=()=>tools.querySelector('input').click();tools.querySelector('input').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('size');const values=validateProgress(JSON.parse(await file.text()));for(const [key,value]of Object.entries(values))write(key,value);dialog.close();restoreDeviceMemory(true);toast(t('استُعيد الموضع والعدادات.','Reading position and counters restored.'))}catch{toast(t('تعذرت استعادة الملف. اختر نسخة تقدم سكينة سليمة.','Could not restore this file. Choose a valid Sakinah progress backup.'))}}}
function openDeviceProgress(){const page=read('lastPage',1),saved=read('savedPage',null),d=openReaderDialog(t('موضعي وعداداتي','Reading & counters'),`<p class="save-status">${t('تُحفظ التغييرات على هذا الجهاز مع كل ضغطة، وتستعاد عند إعادة الفتح.','Changes are saved on this device at every tap and restored on reopening.')}</p><p>${t('آخر صفحة','Last page')}: <b>${ar(page)}</b>${saved?' · '+t('العلامة','Bookmark')+': '+ar(saved):''}</p><p>${t('عداد السبحة','Tasbih count')}: <b>${ar(read('tasbih',0))}</b></p><p>${t('مجموع عدادات الأذكار','Dhikr counters total')}: <b>${ar(Object.values(read('counts',{})).reduce((sum,n)=>sum+Number(n||0),0))}</b></p><a class="btn secondary" href="#quran/page/${page}">${t('متابعة القراءة','Continue reading')} ←</a>`);addProgressTools(d)}
const deviceInstaller=installSakinah;installSakinah=async function(){write('installOfferSeen',true);SakinahState.rememberRoute();if(isStandalone()){openDeviceProgress();return}await deviceInstaller()};

function deviceAppControl(){if(!isStandalone())return;const button=$('#install-app');if(button){button.hidden=false;button.innerHTML='◆ <span>'+t('موضعي وعداداتي','Reading & counters')+'</span>';button.setAttribute('aria-label',t('موضعي وعداداتي والتنزيل دون اتصال','Reading, counters and offline downloads'))}}
deviceAppControl();matchMedia('(display-mode: standalone)').addEventListener?.('change',deviceAppControl);$('#language-switch').addEventListener('click',deviceAppControl);

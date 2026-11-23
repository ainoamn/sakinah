/* Adhan alerts: local muadhin MP3s (incl. Oman) + short iqamah beep + countdown. */
const ADHAN_PRAYERS=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
const ADHAN_ASSET=u=>new URL('assets/adhan/'+u,document.baseURI||location.href).href;
const ADHAN_VOICES=[
 {id:'oman',ar:'أذان مسقط — سلطنة عُمان',en:'Muscat Adhan — Oman',url:ADHAN_ASSET('oman-muscat.mp3'),takbir:ADHAN_ASSET('oman-takbir.mp3')},
 {id:'alafasy',ar:'مشاري راشد العفاسي',en:'Mishary Rashid Alafasy',url:ADHAN_ASSET('alafasy.mp3'),takbir:ADHAN_ASSET('takbir-alafasy.mp3')},
 {id:'alafasy2',ar:'العفاسي (أذان آخر)',en:'Alafasy (another Adhan)',url:ADHAN_ASSET('alafasy2.mp3'),takbir:ADHAN_ASSET('takbir-alafasy2.mp3')},
 {id:'dubai',ar:'العفاسي — دبي One TV',en:'Alafasy — Dubai One TV',url:ADHAN_ASSET('alafasy-dubai.mp3'),takbir:ADHAN_ASSET('takbir-dubai.mp3')},
 {id:'nafees',ar:'أحمد النفيس',en:'Ahmad Al-Nafees',url:ADHAN_ASSET('nafees.mp3'),takbir:ADHAN_ASSET('takbir-nafees.mp3')},
 {id:'ozcan',ar:'حافظ مصطفى أوزجان',en:'Hafiz Mustafa Özcan',url:ADHAN_ASSET('ozcan.mp3'),takbir:ADHAN_ASSET('takbir-ozcan.mp3')},
 {id:'zahrani',ar:'منصور الزهراني',en:'Mansour Al-Zahrani',url:ADHAN_ASSET('zahrani.mp3'),takbir:ADHAN_ASSET('takbir-zahrani.mp3')}
];
const ADHAN_DHIKR=[
 'سبحان الله','الحمد لله','الله أكبر','لا إله إلا الله',
 'أستغفر الله','سبحان الله وبحمده','اللهم صلِّ على محمد',
 'لا حول ولا قوة إلا بالله','حسبي الله ونعم الوكيل'
];
const DEFAULT_IQAMAH={Fajr:20,Dhuhr:15,Asr:15,Maghrib:10,Isha:15};

const adhanState={
 timer:null,audioCtx:null,player:null,unlocked:false,playing:false,stopTone:null,
 overlay:null,iqamahTimer:null,wakeLock:null,dhikrTimer:null,playToken:0
};

function adhanSettings(){
 const defaults={
  enabled:false,sound:true,notify:true,
  advanceMin:10,advanceTakbir:true,
  adhanMode:'full', // full | takbir
  voice:'oman',
  iqamah:true,
  iqamahMin:{...DEFAULT_IQAMAH},
  prayers:ADHAN_PRAYERS.slice()
 };
 const saved=read('adhanSettings',null);
 if(!saved||typeof saved!=='object')return {...defaults,iqamahMin:{...DEFAULT_IQAMAH}};
 const iqamahMin={...DEFAULT_IQAMAH,...(saved.iqamahMin||{})};
 for(const k of ADHAN_PRAYERS)iqamahMin[k]=Math.max(3,Math.min(45,Number(iqamahMin[k])||DEFAULT_IQAMAH[k]));
 // Migrate removed synthetic/CDN-only voice ids
 const voice=ADHAN_VOICES.some(v=>v.id===saved.voice)?saved.voice:'oman';
 return {
  enabled:Boolean(saved.enabled),
  sound:saved.sound!==false,
  notify:saved.notify!==false,
  advanceMin:Math.max(0,Math.min(60,Number(saved.advanceMin)||10)),
  advanceTakbir:saved.advanceTakbir!==false,
  adhanMode:saved.adhanMode==='takbir'?'takbir':'full',
  voice,
  iqamah:saved.iqamah!==false,
  iqamahMin,
  prayers:Array.isArray(saved.prayers)&&saved.prayers.length?saved.prayers.filter(p=>ADHAN_PRAYERS.includes(p)):defaults.prayers
 };
}
function saveAdhanSettings(next){
 const cur=adhanSettings();
 const merged={...cur,...next};
 if(next?.iqamahMin)merged.iqamahMin={...cur.iqamahMin,...next.iqamahMin};
 write('adhanSettings',merged);
}

async function adhanRequestPermission(){
 if(!('Notification'in window))return 'unsupported';
 if(Notification.permission==='granted')return 'granted';
 if(Notification.permission==='denied')return 'denied';
 return Notification.requestPermission();
}

function adhanUnlockAudio(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(Ctx){
   if(!adhanState.audioCtx)adhanState.audioCtx=new Ctx();
   if(adhanState.audioCtx.state==='suspended')adhanState.audioCtx.resume();
  }
  if(!adhanState.player){
   const player=new Audio();
   player.preload='auto';
   player.playsInline=true;
   player.setAttribute('playsinline','');
   player.setAttribute('webkit-playsinline','');
   adhanState.player=player;
  }
  adhanState.unlocked=true;
  return true;
 }catch{return false}
}

function adhanVoice(){
 return ADHAN_VOICES.find(v=>v.id===adhanSettings().voice)||ADHAN_VOICES[0];
}

function adhanStopTone(){
 adhanState.playToken=(adhanState.playToken||0)+1;
 if(typeof adhanState.stopTone==='function'){try{adhanState.stopTone()}catch{}}
 adhanState.stopTone=null;
 adhanState.playing=false;
 if(adhanState.player){
  try{adhanState.player.oncanplay=null;adhanState.player.onerror=null;adhanState.player.onended=null;adhanState.player.pause()}catch{}
 }
}

/** Play a local Adhan/takbir MP3 reliably (wait until buffered, then play). */
function adhanPlayMp3(opts={}){
 if(!adhanUnlockAudio()||!adhanState.player)return 0;
 const voice=adhanVoice();
 const url=opts.url||voice.url;
 if(!url){toast?.(t('لا يوجد ملف صوت لهذا المؤذن.','No audio file for this muadhin.'));return 0}

 adhanStopTone();
 const token=++adhanState.playToken;
 const player=adhanState.player;
 let ended=false,fadeTimer=null;
 const finish=()=>{
  if(ended)return;ended=true;
  if(fadeTimer)clearInterval(fadeTimer);
  adhanState.playing=false;
  if(adhanState.playToken===token)adhanState.stopTone=null;
 };
 const safeStop=()=>{try{player.pause();player.removeAttribute('src');player.load()}catch{}};

 player.loop=false;
 player.volume=1;
 player.onended=()=>finish();
 player.onerror=()=>{
  if(adhanState.playToken!==token)return;
  finish();
  toast?.(t('تعذر تشغيل ملف الأذان.','Could not play the Adhan file.'));
 };

 adhanState.playing=true;
 adhanState.stopTone=()=>{if(fadeTimer)clearInterval(fadeTimer);safeStop();finish()};

 const startPlayback=()=>{
  if(adhanState.playToken!==token)return;
  const start=player.play();
  if(start&&typeof start.then==='function'){
   start.catch(err=>{
    if(adhanState.playToken!==token)return;
    finish();
    // Autoplay / gesture issues
    toast?.(t('اسمح بتشغيل الصوت من المتصفح ثم أعد التجربة.','Allow audio playback in the browser, then try again.'));
    console?.warn?.('adhan play failed',err);
   });
  }
  // Optional soft fade-out near the end of a clipped takbir
  if(opts.fadeMs>0){
   const total=Math.max(1000,opts.fadeMs);
   const fadeStart=Math.max(500,total-2500);
   fadeTimer=setInterval(()=>{
    if(adhanState.playToken!==token||!adhanState.playing){clearInterval(fadeTimer);return}
    const t=player.currentTime*1000;
    if(t>=total){safeStop();finish();return}
    if(t>=fadeStart){
     const left=(total-t)/2500;
     player.volume=Math.max(0,Math.min(1,left));
    }
   },120);
  }
 };

 // Setting src + load then waiting for canplay fixes “only first voice works”
 try{
  player.pause();
  player.src=url;
  player.load();
 }catch{
  finish();
  toast?.(t('تعذر تحميل ملف الأذان.','Could not load the Adhan file.'));
  return 0;
 }

 if(player.readyState>=2)startPlayback();
 else{
  const onReady=()=>{
   player.removeEventListener('canplay',onReady);
   player.removeEventListener('loadeddata',onReady);
   startPlayback();
  };
  player.addEventListener('canplay',onReady,{once:true});
  player.addEventListener('loadeddata',onReady,{once:true});
  // Safety timeout if events never fire
  setTimeout(()=>{if(adhanState.playToken===token&&adhanState.playing&&player.paused)startPlayback()},2500);
 }
 return 1;
}

function adhanPlayFull(){return adhanPlayMp3({url:adhanVoice().url})}
/** Dedicated short takbir clip (complete Allahu Akbar, not a hard cut). */
function adhanPlayTakbir(){
 const voice=adhanVoice();
 return adhanPlayMp3({url:voice.takbir||voice.url,fadeMs:voice.takbir?22000:28000});
}

/** Soft toot / beep for iqamah only — not Adhan melody. */
function adhanPlayBeep(){
 if(!adhanUnlockAudio()||!adhanState.audioCtx)return 0;
 adhanStopTone();
 const ctx=adhanState.audioCtx;
 const notes=[880,660];
 const pace=.18,gainMax=.12;
 const now=ctx.currentTime+0.02;
 const nodes=[];
 notes.forEach((freq,i)=>{
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type='sine';
  osc.frequency.value=freq;
  const t0=now+i*pace;
  gain.gain.setValueAtTime(0.0001,t0);
  gain.gain.exponentialRampToValueAtTime(gainMax,t0+0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+pace*0.85);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(t0);osc.stop(t0+pace);
  nodes.push(osc);
 });
 adhanState.playing=true;
 const ms=notes.length*pace*1000+120;
 const timer=setTimeout(()=>{adhanState.playing=false;adhanState.stopTone=null},ms);
 adhanState.stopTone=()=>{clearTimeout(timer);nodes.forEach(n=>{try{n.stop()}catch{}});adhanState.playing=false};
 return ms;
}

function adhanPlayCue(kind){
 const s=adhanSettings();
 if(!s.sound)return 0;
 adhanUnlockAudio();
 if(kind==='beep')return adhanPlayBeep();
 if(kind==='takbir')return adhanPlayTakbir();
 if(kind==='full')return adhanPlayFull();
 return s.adhanMode==='takbir'?adhanPlayTakbir():adhanPlayFull();
}

function adhanNotify(title,body,tag){
 if(!adhanSettings().notify||!('Notification'in window)||Notification.permission!=='granted')return;
 try{
  const n=new Notification(title,{
   body,
   icon:new URL('assets/app-icon-192.png',location.href).href,
   badge:new URL('assets/sakinah-emblem.png',location.href).href,
   tag:tag||'sakinah-adhan',
   renotify:true,
   requireInteraction:true
  });
  n.onclick=()=>{window.focus();location.hash='calendar';n.close()};
 }catch{}
}

function adhanMark(id){
 const map=read('adhanFired',{});
 if(map[id])return false;
 map[id]=Date.now();
 const keys=Object.keys(map);
 if(keys.length>100){
  keys.sort((a,b)=>map[a]-map[b]).slice(0,keys.length-70).forEach(k=>delete map[k]);
 }
 write('adhanFired',map);
 return true;
}

async function adhanRequestWakeLock(){
 try{
  if('wakeLock'in navigator){
   adhanState.wakeLock=await navigator.wakeLock.request('screen');
   adhanState.wakeLock.addEventListener('release',()=>{adhanState.wakeLock=null});
  }
 }catch{}
}
function adhanReleaseWakeLock(){
 try{adhanState.wakeLock?.release?.()}catch{}
 adhanState.wakeLock=null;
}

function adhanCloseIqamah(){
 if(adhanState.iqamahTimer){clearInterval(adhanState.iqamahTimer);adhanState.iqamahTimer=null}
 if(adhanState.dhikrTimer){clearInterval(adhanState.dhikrTimer);adhanState.dhikrTimer=null}
 adhanReleaseWakeLock();
 adhanState.overlay?.remove();
 adhanState.overlay=null;
 document.body.classList.remove('adhan-iqamah-open');
}

function adhanOpenIqamah(prayerKey,minutes){
 adhanCloseIqamah();
 const name=typeof prayerLabel==='function'?prayerLabel(prayerKey):prayerKey;
 const end=Date.now()+Math.max(1,minutes)*60000;
 let dhikrIndex=0;
 const overlay=document.createElement('section');
 overlay.className='adhan-iqamah';
 overlay.id='adhan-iqamah';
 overlay.innerHTML=`
  <div class="adhan-iqamah-card">
   <button type="button" class="adhan-iqamah-close" id="adhan-iqamah-close" aria-label="${t('إغلاق','Close')}">✕</button>
   <p class="adhan-iqamah-label">${t('متبقٍ للإقامة','Until Iqamah')} · ${esc(name)}</p>
   <strong class="adhan-iqamah-clock" id="adhan-iqamah-clock" dir="ltr">--:--</strong>
   <p class="adhan-iqamah-dhikr" id="adhan-iqamah-dhikr">${ADHAN_DHIKR[0]}</p>
   <p class="adhan-iqamah-hint">${t('سبّح واذكر حتى الإقامة. أبقِ الشاشة مضيئة إن سمحت للجهاز.','Keep remembering Allah until Iqamah. Keep the screen awake if permitted.')}</p>
   <div class="adhan-iqamah-actions">
    <button type="button" class="btn" id="adhan-iqamah-done">${t('أقيمت الصلاة','Iqamah done')}</button>
    <button type="button" class="chip" id="adhan-iqamah-mute">${t('كتم الصوت','Mute')}</button>
   </div>
  </div>`;
 document.body.append(overlay);
 document.body.classList.add('adhan-iqamah-open');
 adhanState.overlay=overlay;
 adhanRequestWakeLock();

 const clock=$('#adhan-iqamah-clock');
 const dhikrEl=$('#adhan-iqamah-dhikr');
 const tick=()=>{
  const left=Math.max(0,end-Date.now());
  const m=Math.floor(left/60000),s=Math.floor((left%60000)/1000);
  if(clock)clock.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  if(left<=0){
   adhanPlayCue('beep');
   adhanNotify(t('حان وقت الإقامة — ','Iqamah time — ')+name,t('حي على الصلاة','Come to prayer'),'iqamah-'+prayerKey);
   toast?.(t('حان وقت الإقامة','Iqamah time'));
   if(navigator.vibrate)try{navigator.vibrate([120,60,120,60,240])}catch{}
   adhanCloseIqamah();
  }
 };
 tick();
 adhanState.iqamahTimer=setInterval(tick,250);
 adhanState.dhikrTimer=setInterval(()=>{
  dhikrIndex=(dhikrIndex+1)%ADHAN_DHIKR.length;
  if(dhikrEl)dhikrEl.textContent=ADHAN_DHIKR[dhikrIndex];
 },4500);

 $('#adhan-iqamah-close').onclick=()=>adhanCloseIqamah();
 $('#adhan-iqamah-done').onclick=()=>{adhanCloseIqamah();toast?.(t('تقبّل الله','May Allah accept it'))};
 $('#adhan-iqamah-mute').onclick=()=>{adhanStopTone();saveAdhanSettings({sound:false});toast?.(t('كُتم الصوت لهذه الجلسة في الإعدادات.','Sound muted in settings for now.'))};
}

function adhanTick(){
 const settings=adhanSettings();
 if(!settings.enabled)return;
 if(typeof prayerStatus!=='function'||typeof prayerLabel!=='function')return;
 const status=prayerStatus();
 if(!status)return;

 // At Adhan (within 2 minutes after prayer time)
 if(status.prev&&status.sincePrev!=null&&status.sincePrev<=120000&&settings.prayers.includes(status.prev.key)){
  const id=status.prev.key+'-'+status.prev.at.toISOString().slice(0,16)+'-now';
  if(adhanMark(id)){
   const name=prayerLabel(status.prev.key);
   adhanNotify(t('حان وقت الأذان — ','Adhan time — ')+name,t('تقبّل الله منك.','May Allah accept it.'),id);
   toast?.(t('حان وقت صلاة ','It is time for ')+name);
   adhanPlayCue('full');
   if(navigator.vibrate)try{navigator.vibrate([200,80,200,80,400])}catch{}
   if(settings.iqamah){
    const mins=settings.iqamahMin[status.prev.key]||15;
    // Open countdown after a short delay so the adhan cue starts first
    setTimeout(()=>adhanOpenIqamah(status.prev.key,mins),1200);
   }
  }
 }

 // Pre-Adhan takbir reminder
 const advanceMs=(settings.advanceMin||10)*60000;
 if(settings.advanceMin>0&&status.next&&status.untilNext!=null&&status.untilNext<=advanceMs&&status.untilNext>60000&&settings.prayers.includes(status.next.key)){
  const id=status.next.key+'-'+status.next.at.toISOString().slice(0,16)+'-soon';
  if(adhanMark(id)){
   const name=prayerLabel(status.next.key);
   const mins=Math.max(1,Math.round(status.untilNext/60000));
   adhanNotify(
    t('تكبير قبل الأذان — ','Takbir before Adhan — ')+name,
    t('تبقى','About')+' '+mins+' '+t('دقيقة','min'),
    id
   );
   toast?.(t('اقترب الأذان — تكبير','Adhan approaching — Takbir')+' · '+name);
   if(settings.advanceTakbir)adhanPlayCue('takbir');
   else if(settings.sound)adhanPlayCue('beep');
  }
 }
}

function adhanEnsureWatch(){
 if(adhanState.timer)return;
 adhanState.timer=setInterval(()=>{
  if(!adhanSettings().enabled)return;
  if(typeof tickPrayerWatch==='function')tickPrayerWatch();
  else adhanTick();
  if(typeof prayerIntel!=='undefined'&&!prayerIntel.schedule?.length&&typeof loadPrayerMonth==='function'){
   loadPrayerMonth().then(()=>adhanTick()).catch(()=>{});
  }else adhanTick();
 },15000);
 document.addEventListener('visibilitychange',async()=>{
  if(!document.hidden&&adhanSettings().enabled){
   adhanTick();
   if(adhanState.overlay)adhanRequestWakeLock();
  }
 });
}

async function adhanEnable(){
 adhanUnlockAudio();
 const perm=await adhanRequestPermission();
 saveAdhanSettings({enabled:true});
 adhanEnsureWatch();
 if(typeof ensurePrayerWatch==='function')ensurePrayerWatch();
 if(typeof loadPrayerMonth==='function'){
  try{await loadPrayerMonth()}catch{}
 }
 adhanTick();
 if(perm==='denied')toast?.(t('فُعّل الأذان داخل التطبيق، لكن التنبيهات النظامية مرفوضة.','Adhan is on inside the app, but system notifications were denied.'));
 else toast?.(t('فُعّل الأذان والإقامة. أبقِ التطبيق قريبًا ليصلك التنبيه.','Adhan and Iqamah enabled. Keep the app nearby for alerts.'));
 return true;
}

function adhanDisable(){
 saveAdhanSettings({enabled:false});
 adhanCloseIqamah();
 adhanStopTone();
 toast?.(t('أُوقف الأذان.','Adhan stopped.'));
}

/* ——— ICS calendar export ——— */
function icsEscape(text){return String(text||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function icsStamp(date){
 const pad=n=>String(n).padStart(2,'0');
 return date.getUTCFullYear()+pad(date.getUTCMonth()+1)+pad(date.getUTCDate())+'T'+pad(date.getUTCHours())+pad(date.getUTCMinutes())+pad(date.getUTCSeconds())+'Z';
}
function icsLocal(y,m,d,hhmm){
 const [H,M]=String(hhmm||'00:00').split(':').map(Number);
 const pad=n=>String(n).padStart(2,'0');
 return `${y}${pad(m)}${pad(d)}T${pad(H||0)}${pad(M||0)}00`;
}
function prayerDayTimings(day){
 const t=day?.timings||day;
 if(!t)return null;
 const pick=k=>(t[k]||'').toString().split(' ')[0];
 return {
  Fajr:pick('Fajr'),Dhuhr:pick('Dhuhr'),Asr:pick('Asr'),Maghrib:pick('Maghrib'),Isha:pick('Isha'),
  date:day.date?.gregorian?.date||day.date||null
 };
}
function buildPrayerICS(monthData,city,year,month){
 const settings=adhanSettings();
 const cityLabel=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES.find(([en])=>en===city):null)?.[1]||city;
 const alarmMin=Math.max(0,settings.advanceMin||10);
 const now=icsStamp(new Date());
 const lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sakinah//Prayer Times//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:سكينة — مواقيت الصلاة ('+cityLabel+')','X-WR-TIMEZONE:Asia/Muscat'
 ];
 (monthData||[]).forEach((day,idx)=>{
  const times=prayerDayTimings(day);
  if(!times)return;
  let y=year,m=month,d=idx+1;
  if(times.date&&/^\d{2}-\d{2}-\d{4}$/.test(times.date)){
   const [dd,mm,yy]=times.date.split('-').map(Number);
   d=dd;m=mm;y=yy;
  }else if(day.date?.gregorian){
   d=Number(day.date.gregorian.day)||d;
   m=Number(day.date.gregorian.month?.number||day.date.gregorian.month)||m;
   y=Number(day.date.gregorian.year)||y;
  }
  for(const key of ADHAN_PRAYERS){
   const hhmm=times[key];
   if(!hhmm||hhmm==='—')continue;
   const stamp=icsLocal(y,m,d,hhmm);
   const uid=`sakinah-${city}-${y}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}-${key}@sakinah`;
   const title=`أذان ${typeof prayerLabel==='function'?prayerLabel(key):key} — ${cityLabel}`;
   lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+now,'DTSTART;TZID=Asia/Muscat:'+stamp,'DURATION:PT15M','SUMMARY:'+icsEscape(title),'DESCRIPTION:'+icsEscape('مواقيت سكينة'),'CATEGORIES:PRAYER,ADHAN','BEGIN:VALARM','TRIGGER:-PT'+alarmMin+'M','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(title),'END:VALARM','END:VEVENT');
  }
 });
 lines.push('END:VCALENDAR');
 return lines.join('\r\n');
}

async function exportPrayerCalendarICS(){
 const city=read('prayerCity','Muscat');
 const parts=typeof muscatParts==='function'?muscatParts():{y:new Date().getFullYear(),m:new Date().getMonth()+1};
 let data;
 try{
  const loaded=typeof loadMonthPrayers==='function'?await loadMonthPrayers(city,parts.y,parts.m):null;
  data=loaded?.data;
 }catch{}
 if(!data?.length)throw Error('no-prayers');
 const ics=buildPrayerICS(data,city,parts.y,parts.m);
 const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
 const name=`sakinah-prayers-${city}-${parts.y}-${String(parts.m).padStart(2,'0')}.ics`;
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=name;a.rel='noopener';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
 return name;
}

function adhanPanelHTML(){
 const s=adhanSettings();
 const checks=ADHAN_PRAYERS.map(key=>{
  const label=typeof prayerLabel==='function'?prayerLabel(key):key;
  return `<label class="adhan-check"><input type="checkbox" data-adhan-prayer="${key}" ${s.prayers.includes(key)?'checked':''}> ${label}</label>`;
 }).join('');
 const voices=ADHAN_VOICES.map(v=>`<option value="${v.id}" ${s.voice===v.id?'selected':''}>${lang()==='en'?v.en:v.ar}</option>`).join('');
 const iqamahRows=ADHAN_PRAYERS.map(key=>{
  const label=typeof prayerLabel==='function'?prayerLabel(key):key;
  return `<label class="adhan-iqamah-row"><span>${label}</span><input type="number" min="3" max="45" data-iqamah="${key}" value="${s.iqamahMin[key]}"><small>${t('دقيقة','min')}</small></label>`;
 }).join('');
 return `<section class="adhan-panel" id="adhan-panel">
  <div class="adhan-panel-head">
   <strong>${t('الأذان والإقامة والتقويم','Adhan, Iqamah & calendar')}</strong>
   <span>${s.enabled?t('مفعّل','On'):t('متوقف','Off')}</span>
  </div>
  <p class="hint">${t('أصوات محفوظة داخل التطبيق، ومنها أذان مسقط. قبل الأذان: مقطع تكبير كامل. عند الأذان: التسجيل كاملًا أو التكبير فقط. عند الإقامة: نغمة قصيرة مع عدّ تنازلي وذكر.','Voices are stored in the app, including Muscat Adhan. Before Adhan: a complete takbir clip. At Adhan: full recording or takbir only. At Iqamah: a short beep with countdown and dhikr.')}</p>
  <div class="adhan-actions">
   <button class="btn" type="button" id="adhan-toggle">${s.enabled?t('إيقاف الأذان','Stop Adhan'):t('تفعيل الأذان','Enable Adhan')}</button>
   <button class="chip" type="button" id="adhan-test-full">${t('تجربة الأذان','Test Adhan')}</button>
   <button class="chip" type="button" id="adhan-test-takbir">${t('تجربة التكبير','Test Takbir')}</button>
   <button class="chip" type="button" id="adhan-test-beep">${t('تجربة الإقامة','Test Iqamah tone')}</button>
   <button class="chip" type="button" id="adhan-stop">${t('إيقاف الصوت','Stop sound')}</button>
   <button class="chip" type="button" id="adhan-test-screen">${t('تجربة شاشة الإقامة','Test Iqamah screen')}</button>
   <button class="chip" type="button" id="adhan-export-ics">↓ ${t('إضافة للتقويم (.ics)','Add to calendar (.ics)')}</button>
  </div>
  <div class="adhan-options">
   <label class="adhan-check"><input type="checkbox" id="adhan-sound" ${s.sound?'checked':''}> ${t('تشغيل الصوت','Play sound')}</label>
   <label class="adhan-check"><input type="checkbox" id="adhan-notify" ${s.notify?'checked':''}> ${t('تنبيه النظام','System notification')}</label>
   <label class="adhan-check"><input type="checkbox" id="adhan-advance-takbir" ${s.advanceTakbir?'checked':''}> ${t('تكبير قبل الأذان','Takbir before Adhan')}</label>
   <label class="adhan-check"><input type="checkbox" id="adhan-iqamah" ${s.iqamah?'checked':''}> ${t('تنبيه الإقامة + الشاشة','Iqamah alert + screen')}</label>
  </div>
  <div class="adhan-options">
   <label class="adhan-advance">${t('التذكير قبل الأذان','Remind before Adhan')}
    <select id="adhan-advance">${[0,5,10,15,20,30].map(n=>`<option value="${n}" ${s.advanceMin===n?'selected':''}>${n?ar(n)+' '+t('دقيقة','min'):t('بدون تذكير مسبق','No advance')}</option>`).join('')}</select>
   </label>
   <label class="adhan-advance">${t('صوت الأذان','Adhan sound')}
    <select id="adhan-mode">
     <option value="full" ${s.adhanMode==='full'?'selected':''}>${t('أذان كامل','Full Adhan')}</option>
     <option value="takbir" ${s.adhanMode==='takbir'?'selected':''}>${t('تكبيرة الإحرام فقط','Takbir only')}</option>
    </select>
   </label>
   <label class="adhan-advance">${t('المؤذن','Muadhin')}
    <select id="adhan-voice">${voices}</select>
   </label>
  </div>
  <div class="adhan-iqamah-times">
   <strong>${t('انتظار الإقامة بعد الأذان','Iqamah wait after Adhan')}</strong>
   <div class="adhan-iqamah-grid">${iqamahRows}</div>
  </div>
  <div class="adhan-prayers" aria-label="${t('الصلوات','Prayers')}">${checks}</div>
 </section>`;
}

function bindAdhanPanel(root=document){
 const panel=root.querySelector?.('#adhan-panel')||$('#adhan-panel');
 if(!panel||panel.dataset.bound==='1')return;
 panel.dataset.bound='1';
 $('#adhan-toggle',panel).onclick=async()=>{
  const s=adhanSettings();
  if(s.enabled){adhanDisable();panel.querySelector('.adhan-panel-head span').textContent=t('متوقف','Off');$('#adhan-toggle',panel).textContent=t('تفعيل الأذان','Enable Adhan');return}
  await adhanEnable();
  panel.querySelector('.adhan-panel-head span').textContent=t('مفعّل','On');
  $('#adhan-toggle',panel).textContent=t('إيقاف الأذان','Stop Adhan');
 };
 $('#adhan-test-full',panel).onclick=()=>{
  adhanUnlockAudio();adhanPlayCue('full');
  const name=lang()==='en'?adhanVoice().en:adhanVoice().ar;
  toast?.(t('تشغيل الأذان','Playing Adhan')+' · '+name);
 };
 $('#adhan-test-takbir',panel).onclick=()=>{adhanUnlockAudio();adhanPlayCue('takbir');toast?.(t('تشغيل التكبير من بداية الأذان','Playing takbir from the Adhan opening'))};
 $('#adhan-test-beep',panel).onclick=()=>{adhanUnlockAudio();adhanPlayCue('beep');toast?.(t('نغمة الإقامة القصيرة','Short Iqamah tone'))};
 $('#adhan-stop',panel).onclick=()=>{adhanStopTone();toast?.(t('توقف الصوت','Sound stopped'))};
 $('#adhan-test-screen',panel).onclick=()=>{
  const key=ADHAN_PRAYERS.find(k=>adhanSettings().prayers.includes(k))||'Dhuhr';
  adhanOpenIqamah(key,adhanSettings().iqamahMin[key]||10);
 };
 $('#adhan-export-ics',panel).onclick=async()=>{
  try{
   const name=await exportPrayerCalendarICS();
   toast?.(t('تم تنزيل ملف التقويم. افتحه لإضافته لتقويم الهاتف.','Calendar file downloaded. Open it to add it to your phone calendar.')+' · '+name);
  }catch{toast?.(t('تعذر تجهيز ملف التقويم. تأكد من تحميل المواقيت أولًا.','Could not build the calendar file. Load prayer times first.'))}
 };
 const persistPrayers=()=>{
  const prayers=[...panel.querySelectorAll('[data-adhan-prayer]:checked')].map(el=>el.dataset.adhanPrayer);
  saveAdhanSettings({prayers:prayers.length?prayers:ADHAN_PRAYERS.slice()});
 };
 panel.querySelectorAll('[data-adhan-prayer]').forEach(el=>el.onchange=persistPrayers);
 panel.querySelectorAll('[data-iqamah]').forEach(el=>el.onchange=e=>{
  const key=e.target.dataset.iqamah;
  const val=Math.max(3,Math.min(45,Number(e.target.value)||15));
  e.target.value=val;
  saveAdhanSettings({iqamahMin:{[key]:val}});
 });
 $('#adhan-sound',panel).onchange=e=>saveAdhanSettings({sound:e.target.checked});
 $('#adhan-notify',panel).onchange=e=>saveAdhanSettings({notify:e.target.checked});
 $('#adhan-advance-takbir',panel).onchange=e=>saveAdhanSettings({advanceTakbir:e.target.checked});
 $('#adhan-iqamah',panel).onchange=e=>saveAdhanSettings({iqamah:e.target.checked});
 $('#adhan-advance',panel).onchange=e=>saveAdhanSettings({advanceMin:Number(e.target.value)||0});
 $('#adhan-mode',panel).onchange=e=>saveAdhanSettings({adhanMode:e.target.value});
 $('#adhan-voice',panel).onchange=e=>saveAdhanSettings({voice:e.target.value});
}

function hookAdhanIntoPrayerWatch(){
 if(typeof alertPrayerWatch!=='function'||alertPrayerWatch.__adhanHooked)return;
 const previous=alertPrayerWatch;
 alertPrayerWatch=function(status){
  previous(status);
  if(adhanSettings().enabled)adhanTick();
 };
 alertPrayerWatch.__adhanHooked=true;
}

hookAdhanIntoPrayerWatch();
queueMicrotask(hookAdhanIntoPrayerWatch);
document.addEventListener('DOMContentLoaded',()=>{
 hookAdhanIntoPrayerWatch();
 if(adhanSettings().enabled){adhanEnsureWatch();adhanUnlockAudio()}
});
if(adhanSettings().enabled)queueMicrotask(()=>adhanEnsureWatch());

window.SakinahAdhan={
 adhanSettings,saveAdhanSettings,adhanEnable,adhanDisable,adhanPlayCue,
 exportPrayerCalendarICS,adhanPanelHTML,bindAdhanPanel,adhanEnsureWatch,
 hookAdhanIntoPrayerWatch,adhanOpenIqamah,adhanCloseIqamah,ADHAN_VOICES
};

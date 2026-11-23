/* Adhan alerts + phone calendar (ICS) sync for Sakinah prayer times. */
const ADHAN_PRAYERS=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
const adhanState={timer:null,audioCtx:null,unlocked:false,playing:false};

function adhanSettings(){
 const defaults={enabled:false,sound:true,notify:true,advanceMin:10,prayers:ADHAN_PRAYERS.slice()};
 const saved=read('adhanSettings',null);
 if(!saved||typeof saved!=='object')return {...defaults};
 return {
  enabled:Boolean(saved.enabled),
  sound:saved.sound!==false,
  notify:saved.notify!==false,
  advanceMin:Math.max(0,Math.min(60,Number(saved.advanceMin)||10)),
  prayers:Array.isArray(saved.prayers)&&saved.prayers.length?saved.prayers.filter(p=>ADHAN_PRAYERS.includes(p)):defaults.prayers
 };
}
function saveAdhanSettings(next){write('adhanSettings',{...adhanSettings(),...next})}

async function adhanRequestPermission(){
 if(!('Notification'in window))return 'unsupported';
 if(Notification.permission==='granted')return 'granted';
 if(Notification.permission==='denied')return 'denied';
 return Notification.requestPermission();
}

function adhanUnlockAudio(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return false;
  if(!adhanState.audioCtx)adhanState.audioCtx=new Ctx();
  if(adhanState.audioCtx.state==='suspended')adhanState.audioCtx.resume();
  adhanState.unlocked=true;
  return true;
 }catch{return false}
}

/** Short melodic adhan cue (no external file required). */
function adhanPlayCue(){
 if(adhanState.playing||!adhanSettings().sound)return;
 if(!adhanUnlockAudio()||!adhanState.audioCtx)return;
 const ctx=adhanState.audioCtx;
 adhanState.playing=true;
 const now=ctx.currentTime+0.05;
 // Approximate adhan-like ascending phrases (Hz)
 const phrase=[392,440,494,523,587,523,494,440,392,330];
 phrase.forEach((freq,i)=>{
  const osc=ctx.createOscillator();
  const gain=ctx.createGain();
  osc.type=i%2?'triangle':'sine';
  osc.frequency.value=freq;
  const t0=now+i*0.42;
  gain.gain.setValueAtTime(0.0001,t0);
  gain.gain.exponentialRampToValueAtTime(0.18,t0+0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001,t0+0.38);
  osc.connect(gain);gain.connect(ctx.destination);
  osc.start(t0);osc.stop(t0+0.4);
 });
 setTimeout(()=>{adhanState.playing=false},phrase.length*420+200);
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
 // Keep map small
 const keys=Object.keys(map);
 if(keys.length>80){
  keys.sort((a,b)=>map[a]-map[b]).slice(0,keys.length-60).forEach(k=>delete map[k]);
 }
 write('adhanFired',map);
 return true;
}

function adhanTick(){
 const settings=adhanSettings();
 if(!settings.enabled)return;
 if(typeof prayerStatus!=='function'||typeof prayerLabel!=='function')return;
 const status=prayerStatus();
 if(!status)return;

 // At prayer time (within 2 minutes after)
 if(status.prev&&status.sincePrev!=null&&status.sincePrev<=120000&&settings.prayers.includes(status.prev.key)){
  const id=status.prev.key+'-'+status.prev.at.toISOString().slice(0,16)+'-now';
  if(adhanMark(id)){
   const name=prayerLabel(status.prev.key);
   adhanNotify(t('حان وقت الأذان — ','Adhan time — ')+name,t('تقبّل الله منك.','May Allah accept it.'),id);
   toast?.(t('حان وقت صلاة ','It is time for ')+name);
   adhanPlayCue();
   if(navigator.vibrate)try{navigator.vibrate([200,80,200,80,400])}catch{}
  }
 }

 // Advance reminder
 const advanceMs=(settings.advanceMin||10)*60000;
 if(status.next&&status.untilNext!=null&&status.untilNext<=advanceMs&&status.untilNext>60000&&settings.prayers.includes(status.next.key)){
  const id=status.next.key+'-'+status.next.at.toISOString().slice(0,16)+'-soon';
  if(adhanMark(id)){
   const name=prayerLabel(status.next.key);
   adhanNotify(
    t('اقترب الأذان — ','Adhan approaching — ')+name,
    t('تبقى','About')+' '+Math.max(1,Math.round(status.untilNext/60000))+' '+t('دقيقة','min'),
    id
   );
   toast?.(t('اقترب وقت صلاة ','Approaching ')+name);
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
 },20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&adhanSettings().enabled)adhanTick()});
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
 else toast?.(t('فُعّل الأذان. أبقِ التطبيق مفتوحًا أو في الخلفية القريبة ليصلك التنبيه.','Adhan enabled. Keep the app open or nearby in the background for alerts.'));
 return true;
}

function adhanDisable(){
 saveAdhanSettings({enabled:false});
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
 // Supports MARA and AlAdhan shapes
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
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Sakinah//Prayer Times//AR',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:سكينة — مواقيت الصلاة ('+cityLabel+')',
  'X-WR-TIMEZONE:Asia/Muscat'
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
   lines.push(
    'BEGIN:VEVENT',
    'UID:'+uid,
    'DTSTAMP:'+now,
    'DTSTART;TZID=Asia/Muscat:'+stamp,
    'DURATION:PT15M',
    'SUMMARY:'+icsEscape(title),
    'DESCRIPTION:'+icsEscape('مواقيت سكينة / Sakinah prayer times'),
    'CATEGORIES:PRAYER,ADHAN',
    'BEGIN:VALARM',
    'TRIGGER:-PT'+alarmMin+'M',
    'ACTION:DISPLAY',
    'DESCRIPTION:'+icsEscape(title),
    'END:VALARM',
    'END:VEVENT'
   );
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
  const loaded=typeof loadMonthPrayers==='function'
   ?await loadMonthPrayers(city,parts.y,parts.m)
   :null;
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
 return `<section class="adhan-panel" id="adhan-panel">
  <div class="adhan-panel-head">
   <strong>${t('الأذان وتقويم الهاتف','Adhan & phone calendar')}</strong>
   <span>${s.enabled?t('مفعّل','On'):t('متوقف','Off')}</span>
  </div>
  <p class="hint">${t('فعّل الأذان لتصلك تنبيهات عند دخول الوقت. ولربط تقويم هاتفك حمّل ملف المواقيت (.ics) ثم افتحه واختر إضافة الأحداث إلى التقويم.','Enable Adhan for prayer-time alerts. To link your phone calendar, download the .ics file and open it to add the events.')}</p>
  <div class="adhan-actions">
   <button class="btn" type="button" id="adhan-toggle">${s.enabled?t('إيقاف الأذان','Stop Adhan'):t('تفعيل الأذان','Enable Adhan')}</button>
   <button class="chip" type="button" id="adhan-test">${t('تجربة الصوت','Test sound')}</button>
   <button class="chip" type="button" id="adhan-export-ics">↓ ${t('إضافة للتقويم (.ics)','Add to calendar (.ics)')}</button>
  </div>
  <div class="adhan-options">
   <label class="adhan-check"><input type="checkbox" id="adhan-sound" ${s.sound?'checked':''}> ${t('تشغيل صوت الأذان','Play Adhan sound')}</label>
   <label class="adhan-check"><input type="checkbox" id="adhan-notify" ${s.notify?'checked':''}> ${t('تنبيه النظام','System notification')}</label>
   <label class="adhan-advance">${t('تذكير قبل الأذان','Remind before Adhan')}
    <select id="adhan-advance">${[0,5,10,15,20,30].map(n=>`<option value="${n}" ${s.advanceMin===n?'selected':''}>${n?ar(n)+' '+t('دقيقة','min'):t('عند الأذان فقط','At Adhan only')}</option>`).join('')}</select>
   </label>
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
 $('#adhan-test',panel).onclick=()=>{adhanUnlockAudio();adhanPlayCue();toast?.(t('تشغيل تجربة الأذان','Playing Adhan test'))};
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
 $('#adhan-sound',panel).onchange=e=>saveAdhanSettings({sound:e.target.checked});
 $('#adhan-notify',panel).onchange=e=>saveAdhanSettings({notify:e.target.checked});
 $('#adhan-advance',panel).onchange=e=>saveAdhanSettings({advanceMin:Number(e.target.value)||0});
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
 exportPrayerCalendarICS,adhanPanelHTML,bindAdhanPanel,adhanEnsureWatch,hookAdhanIntoPrayerWatch
};

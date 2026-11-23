/* Qibla finder: calibrated compass + Kaaba reveal when aligned. */
const KAABA={lat:21.422487,lon:39.826206};
const QIBLA_CITY_COORDS={
 Muscat:[23.5880,58.3829],
 Nizwa:[22.9333,57.5333],
 Salalah:[17.0151,54.0924],
 Sohar:[24.3643,56.7468],
 Sur:[22.5667,59.5289],
 Ibri:[23.2257,56.5157],
 Rustaq:[23.3908,57.4244]
};
const qibla={
 mode:'compass',
 lat:null,lon:null,source:'city',
 heading:null,rawHeading:null,qibla:null,
 watchId:null,orientHandler:null,stream:null,raf:null,
 aligned:false,samples:[]
};

function qiblaBearing(lat,lon){
 const φ1=lat*Math.PI/180,φ2=KAABA.lat*Math.PI/180,Δλ=(KAABA.lon-lon)*Math.PI/180;
 const y=Math.sin(Δλ)*Math.cos(φ2);
 const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function qiblaNorm(deg){return ((deg%360)+360)%360}
function qiblaDelta(from,to){return ((to-from+540)%360)-180}
function qiblaFmt(deg){return Number.isFinite(deg)?Math.round(deg)+'°':'—'}
function qiblaScreenAngle(){
 const o=screen.orientation?.angle;
 if(typeof o==='number')return o;
 if(typeof window.orientation==='number')return window.orientation;
 return 0;
}
function qiblaSmooth(heading){
 qibla.samples.push(heading);
 if(qibla.samples.length>8)qibla.samples.shift();
 // Circular mean
 let sx=0,sy=0;
 for(const h of qibla.samples){const r=h*Math.PI/180;sx+=Math.cos(r);sy+=Math.sin(r)}
 return qiblaNorm(Math.atan2(sy,sx)*180/Math.PI);
}

function qiblaStopSensors(){
 if(qibla.watchId!=null&&navigator.geolocation){try{navigator.geolocation.clearWatch(qibla.watchId)}catch{}}
 qibla.watchId=null;
 if(qibla.orientHandler){
  window.removeEventListener('deviceorientationabsolute',qibla.orientHandler);
  window.removeEventListener('deviceorientation',qibla.orientHandler);
  qibla.orientHandler=null;
 }
 if(qibla.raf){cancelAnimationFrame(qibla.raf);qibla.raf=null}
 if(qibla.stream){qibla.stream.getTracks().forEach(t=>t.stop());qibla.stream=null}
 const video=$('#qibla-video');if(video)video.srcObject=null;
 qibla.samples=[];
}

function qiblaApplyCityFallback(){
 const city=read('prayerCity','Muscat');
 const coords=QIBLA_CITY_COORDS[city]||QIBLA_CITY_COORDS.Muscat;
 qibla.lat=coords[0];qibla.lon=coords[1];qibla.source='city';
 qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
 write('qiblaLat',qibla.lat);write('qiblaLon',qibla.lon);
}

async function qiblaLocate(){
 qiblaApplyCityFallback();
 if(!navigator.geolocation){qiblaPaintMeta();return}
 try{
  const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}));
  qibla.lat=pos.coords.latitude;qibla.lon=pos.coords.longitude;qibla.source='gps';
  qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
  write('qiblaLat',qibla.lat);write('qiblaLon',qibla.lon);
  qiblaPaintMeta();
  if(qibla.watchId==null){
   qibla.watchId=navigator.geolocation.watchPosition(p=>{
    qibla.lat=p.coords.latitude;qibla.lon=p.coords.longitude;qibla.source='gps';
    qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
    qiblaPaintMeta();qiblaPaintDial();
   },()=>{},{enableHighAccuracy:true,maximumAge:15000});
  }
 }catch{
  qiblaPaintMeta();
  toast?.(t('تعذر تحديد موقعك؛ استُخدمت إحداثيات المدينة المختارة.','Location unavailable; using the selected city coordinates.'));
 }
}

function qiblaDeviceHeading(e){
 // iOS Safari: true heading relative to magnetic north, already screen-aware.
 if(typeof e.webkitCompassHeading==='number'&&!Number.isNaN(e.webkitCompassHeading)){
  return qiblaNorm(e.webkitCompassHeading);
 }
 if(typeof e.alpha!=='number'||Number.isNaN(e.alpha))return null;
 // Android / Chrome: alpha is device Z rotation. Convert to compass heading and
 // compensate for screen orientation so "phone top" is the facing direction.
 const screenAngle=qiblaScreenAngle();
 let heading=qiblaNorm(360-e.alpha-screenAngle);
 // When the phone is nearly flat, alpha alone is more reliable; upright use is default.
 return heading;
}

async function qiblaStartCompass(){
 const start=()=>{
  if(qibla.orientHandler)return;
  qibla.orientHandler=e=>{
   const h=qiblaDeviceHeading(e);
   if(h==null)return;
   qibla.rawHeading=h;
   qibla.heading=qiblaSmooth(h);
   qiblaPaintDial();
  };
  // Prefer absolute events when available (true north on Android).
  if('ondeviceorientationabsolute'in window){
   window.addEventListener('deviceorientationabsolute',qibla.orientHandler,true);
  }
  window.addEventListener('deviceorientation',qibla.orientHandler,true);
 };
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   const state=await DeviceOrientationEvent.requestPermission();
   if(state!=='granted'){toast?.(t('يلزم إذن البوصلة لتحديد الاتجاه.','Compass permission is required.'));return false}
  }
  start();
  return true;
 }catch{
  toast?.(t('تعذر تفعيل بوصلة الجهاز.','Could not enable the device compass.'));
  return false;
 }
}

async function qiblaStartCamera(){
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
  qibla.stream=stream;
  const video=$('#qibla-video');
  if(video){video.srcObject=stream;await video.play().catch(()=>{})}
  document.body.classList.add('qibla-camera-on');
  return true;
 }catch{
  toast?.(t('تعذر فتح الكاميرا. يمكنك استخدام وضع البوصلة.','Camera unavailable. You can use compass mode.'));
  return false;
 }
}

function qiblaPaintMeta(){
 const meta=$('#qibla-meta');if(!meta)return;
 const city=read('prayerCity','Muscat');
 const cityLabel=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES.find(([en])=>en===city):null)?.[lang()==='en'?0:1]||city;
 const src=qibla.source==='gps'?t('موقع الجهاز','Device location'):t('مدينة التقويم','Calendar city')+' · '+cityLabel;
 meta.innerHTML=`<span>${t('اتجاه القبلة','Qibla bearing')} <b dir="ltr">${qiblaFmt(qibla.qibla)}</b></span><span>${t('من','from')} ${esc(src)}</span><span dir="ltr">${qibla.lat!=null?qibla.lat.toFixed(4)+', '+qibla.lon.toFixed(4):'—'}</span>`;
}

function qiblaPaintDial(){
 const rotator=$('#qibla-rotator'),needle=$('#qibla-needle'),kaaba=$('#qibla-kaaba-mark');
 const status=$('#qibla-status'),headingEl=$('#qibla-heading'),board=$('#qibla-stage');
 const reveal=$('#qibla-aligned');
 if(!Number.isFinite(qibla.qibla))return;
 const heading=Number.isFinite(qibla.heading)?qibla.heading:0;
 const turn=qiblaNorm(qibla.qibla-heading);
 // Ring rotates so geographic north tracks the device; Kaaba mark sits at absolute bearing.
 if(rotator)rotator.style.transform=`rotate(${-heading}deg)`;
 if(needle)needle.style.transform=`rotate(${qibla.qibla}deg)`;
 if(kaaba)kaaba.style.transform=`rotate(${qibla.qibla}deg)`;
 // Fixed forward marker stays at top of phone = direction you face.
 const dial=$('#qibla-dial');if(dial)dial.style.setProperty('--qibla-turn',turn+'deg');
 if(headingEl)headingEl.textContent=Number.isFinite(qibla.heading)
  ?t('اتجاه الجهاز','Device heading')+' · '+qiblaFmt(qibla.heading)
  :t('حرّك الجهاز بشكل رقم 8 لمعايرة البوصلة','Move the phone in a figure-8 to calibrate');
 const off=Number.isFinite(qibla.heading)?Math.abs(qiblaDelta(heading,qibla.qibla)):null;
 const aligned=off!=null&&off<=6;
 qibla.aligned=aligned;
 if(board)board.dataset.aligned=aligned?'1':'0';
 if(reveal)reveal.hidden=!aligned;
 if(status){
  if(off==null){status.textContent=t('فعّل البوصلة ثم وجّه أعلى الهاتف نحو السهم.','Enable the compass, then point the top of the phone toward the arrow.');status.dataset.state='idle'}
  else if(aligned){status.textContent=t('أنت تواجه القبلة — الله أكبر','You are facing the Qibla');status.dataset.state='aligned'}
  else{
   const side=qiblaDelta(heading,qibla.qibla)>0?t('يمينًا','right'):t('يسارًا','left');
   status.textContent=t('أدِر أعلى الهاتف','Turn the phone top')+' '+side+' · '+qiblaFmt(off);
   status.dataset.state='seek';
  }
 }
}

function qiblaSetMode(mode){
 qibla.mode=mode==='camera'?'camera':'compass';
 document.querySelectorAll('[data-qibla-mode]').forEach(btn=>{
  const on=btn.dataset.qiblaMode===qibla.mode;
  btn.classList.toggle('active',on);
  btn.setAttribute('aria-pressed',String(on));
 });
 document.body.classList.toggle('qibla-camera-on',qibla.mode==='camera'&&Boolean(qibla.stream));
 const stage=$('#qibla-stage');if(stage)stage.dataset.mode=qibla.mode;
}

async function qiblaPage(){
 qiblaStopSensors();
 document.body.classList.remove('qibla-camera-on');
 const savedLat=read('qiblaLat',null),savedLon=read('qiblaLon',null);
 if(Number.isFinite(savedLat)&&Number.isFinite(savedLon)){qibla.lat=savedLat;qibla.lon=savedLon;qibla.source='gps';qibla.qibla=qiblaBearing(qibla.lat,qibla.lon)}
 else qiblaApplyCityFallback();
 const city=read('prayerCity','Muscat');
 const cityOpts=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES:[['Muscat','مسقط']]).map(([en,arName])=>`<option value="${en}" ${city===en?'selected':''}>${lang()==='en'?en:arName}</option>`).join('');
 $('#main').innerHTML=heading(t('اتجاه القبلة','Qibla direction'),t('وجّه أعلى الهاتف مع السهم الذهبي. عند الاصطفاف تظهر صورة القبلة.','Point the top of the phone with the gold arrow. When aligned, the Qibla image appears.'),t('صلاة','Prayer'))+`
 <div class="qibla-toolbar">
  <button class="chip active" type="button" data-qibla-mode="compass" aria-pressed="true">◎ ${t('بوصلة','Compass')}</button>
  <button class="chip" type="button" data-qibla-mode="camera" aria-pressed="false">▣ ${t('كاميرا','Camera')}</button>
  <button class="chip" type="button" id="qibla-enable">${t('تفعيل البوصلة','Enable compass')}</button>
  <button class="chip" type="button" id="qibla-locate">${t('تحديث الموقع','Update location')}</button>
  <label class="qibla-city"><span>${t('المدينة','City')}</span><select id="qibla-city">${cityOpts}</select></label>
  <a class="chip" href="#calendar">${t('التقويم','Calendar')} ←</a>
 </div>
 <section class="qibla-board" id="qibla-stage" data-mode="compass" data-aligned="0">
  <div class="qibla-camera-layer" aria-hidden="true"><video id="qibla-video" playsinline muted autoplay></video></div>
  <div class="qibla-forward" aria-hidden="true" title="${t('اتجاه أعلى الهاتف','Phone-top direction')}"></div>
  <div class="qibla-dial" id="qibla-dial">
   <div class="qibla-rotator" id="qibla-rotator">
    <div class="qibla-ring" aria-hidden="true">
     <span class="qibla-cardinal n">${t('ش','N')}</span>
     <span class="qibla-cardinal e">${t('ق','E')}</span>
     <span class="qibla-cardinal s">${t('ج','S')}</span>
     <span class="qibla-cardinal w">${t('غ','W')}</span>
    </div>
    <div class="qibla-kaaba" id="qibla-kaaba-mark" aria-hidden="true"><span>🕋</span></div>
    <div class="qibla-needle" id="qibla-needle" aria-hidden="true"></div>
   </div>
   <div class="qibla-center"><strong>${t('القبلة','Qibla')}</strong><small id="qibla-heading">${t('فعّل البوصلة للبدء','Enable the compass to begin')}</small></div>
  </div>
  <div class="qibla-aligned" id="qibla-aligned" hidden>
   <img src="assets/sakinah-emblem.png" alt="${t('القبلة','Qibla')}">
   <strong>${t('القبلة أمامك','The Qibla is ahead')}</strong>
   <span>الله أكبر</span>
  </div>
  <p class="qibla-status" id="qibla-status" data-state="idle">${t('فعّل البوصلة ثم وجّه أعلى الهاتف نحو السهم.','Enable the compass, then point the top of the phone toward the arrow.')}</p>
  <div class="qibla-meta" id="qibla-meta"></div>
 </section>
 <p class="hint">${t('أبقِ الهاتف رأسيًا بعيدًا عن الحديد والسماعات، وحرّكه بشكل رقم 8 إن اضطرب المؤشر. الحساب تقريبي بحسب الموقع وبوصلة الجهاز.','Hold the phone upright, away from metal and headphones, and move it in a figure-8 if the needle jitters. Bearing is approximate from location and device compass.')}</p>`;
 qiblaPaintMeta();qiblaPaintDial();
 $('#qibla-enable').onclick=async()=>{const ok=await qiblaStartCompass();if(ok)toast?.(t('البوصلة جاهزة. حرّك الهاتف قليلًا للمعايرة.','Compass ready. Move the phone slightly to calibrate.'))};
 $('#qibla-locate').onclick=()=>qiblaLocate();
 $('#qibla-city').onchange=e=>{write('prayerCity',e.target.value);if(qibla.source!=='gps'){qiblaApplyCityFallback();qiblaPaintMeta();qiblaPaintDial()}};
 document.querySelectorAll('[data-qibla-mode]').forEach(btn=>btn.onclick=async()=>{
  const mode=btn.dataset.qiblaMode;
  if(mode==='camera'){
   const cam=await qiblaStartCamera();
   if(!cam)return;
   await qiblaStartCompass();
   qiblaSetMode('camera');
  }else{
   if(qibla.stream){qibla.stream.getTracks().forEach(t=>t.stop());qibla.stream=null}
   const video=$('#qibla-video');if(video)video.srcObject=null;
   document.body.classList.remove('qibla-camera-on');
   qiblaSetMode('compass');
  }
 });
 qiblaLocate();
 qiblaStartCompass().catch(()=>{});
}

window.addEventListener('hashchange',()=>{
 if(currentRoute!=='qibla'){qiblaStopSensors();document.body.classList.remove('qibla-camera-on')}
});
window.SakinahQibla={qiblaPage,qiblaStopSensors};

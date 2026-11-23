/* Qibla finder: compass dial + optional camera overlay. */
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
 heading:null,qibla:null,
 watchId:null,orientHandler:null,stream:null,raf:null
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
 if(typeof e.webkitCompassHeading==='number'&&!Number.isNaN(e.webkitCompassHeading))return e.webkitCompassHeading;
 if(e.absolute===true&&typeof e.alpha==='number')return (360-e.alpha)%360;
 if(typeof e.alpha==='number')return (360-e.alpha)%360;
 return null;
}

async function qiblaStartCompass(){
 const start=()=>{
  if(qibla.orientHandler)return;
  qibla.orientHandler=e=>{
   const h=qiblaDeviceHeading(e);
   if(h==null)return;
   qibla.heading=h;
   qiblaPaintDial();
  };
  const abs='ondeviceorientationabsolute'in window;
  window.addEventListener(abs?'deviceorientationabsolute':'deviceorientation',qibla.orientHandler,true);
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
 const rotator=$('#qibla-rotator'),needle=$('#qibla-needle'),kaaba=$('#qibla-kaaba-mark'),status=$('#qibla-status'),headingEl=$('#qibla-heading');
 if(!Number.isFinite(qibla.qibla))return;
 const heading=Number.isFinite(qibla.heading)?qibla.heading:0;
 const turn=qiblaNorm(qibla.qibla-heading);
 if(rotator)rotator.style.transform=`rotate(${-heading}deg)`;
 if(needle)needle.style.transform=`rotate(${qibla.qibla}deg)`;
 if(kaaba)kaaba.style.transform=`rotate(${qibla.qibla}deg)`;
 const dial=$('#qibla-dial');if(dial)dial.style.setProperty('--qibla-turn',turn+'deg');
 if(headingEl)headingEl.textContent=Number.isFinite(qibla.heading)?t('اتجاه الجهاز','Device heading')+' · '+qiblaFmt(qibla.heading):t('حرّك الجهاز لمعايرة البوصلة','Move the device to calibrate the compass');
 const off=Number.isFinite(qibla.heading)?Math.abs(qiblaDelta(heading,qibla.qibla)):null;
 if(status){
  if(off==null)status.textContent=t('فعّل البوصلة ثم وجّه الجهاز.','Enable the compass, then face the device.');
  else if(off<=8){status.textContent=t('أنت تواجه القبلة — الله أكبر','You are facing the Qibla');status.dataset.state='aligned'}
  else{status.textContent=t('أدِر الجهاز نحو السهم الذهبي','Turn toward the gold arrow')+' · '+qiblaFmt(off);status.dataset.state='seek'}
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
 $('#main').innerHTML=heading(t('اتجاه القبلة','Qibla direction'),t('بوصلة حية، ومعاينة اختيارية بالكاميرا. أبقِ الجهاز مستويًا بعيدًا عن المعادن.','Live compass with an optional camera view. Keep the device level and away from metal.'),t('صلاة','Prayer'))+`
 <div class="qibla-toolbar">
  <button class="chip active" type="button" data-qibla-mode="compass" aria-pressed="true">◎ ${t('بوصلة','Compass')}</button>
  <button class="chip" type="button" data-qibla-mode="camera" aria-pressed="false">▣ ${t('كاميرا','Camera')}</button>
  <button class="chip" type="button" id="qibla-enable">${t('تفعيل البوصلة','Enable compass')}</button>
  <button class="chip" type="button" id="qibla-locate">${t('تحديث الموقع','Update location')}</button>
  <label class="qibla-city"><span>${t('المدينة','City')}</span><select id="qibla-city">${cityOpts}</select></label>
  <a class="chip" href="#calendar">${t('التقويم','Calendar')} ←</a>
 </div>
 <section class="qibla-board" id="qibla-stage" data-mode="compass">
  <div class="qibla-camera-layer" aria-hidden="true"><video id="qibla-video" playsinline muted autoplay></video></div>
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
  <p class="qibla-status" id="qibla-status" data-state="idle">${t('فعّل البوصلة ثم وجّه الجهاز.','Enable the compass, then face the device.')}</p>
  <div class="qibla-meta" id="qibla-meta"></div>
 </section>
 <p class="hint">${t('الحساب تقريبي بحسب موقعك وبوصلة الجهاز. للضبط الأدق راعِ الانحراف المغناطيسي المحلي وابتعد عن الحديد والسماعات.','Bearing is approximate from your location and device compass. For finer accuracy, account for local magnetic declination and keep clear of metal and headphones.')}</p>`;
 qiblaPaintMeta();qiblaPaintDial();
 $('#qibla-enable').onclick=async()=>{const ok=await qiblaStartCompass();if(ok)toast?.(t('البوصلة جاهزة.','Compass ready.'))};
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

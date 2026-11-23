/* Qibla compass — great-circle bearing + true-north heading (Pillars/Google method).
   Bearing: shortest path on Earth to the Kaaba (true north).
   Heading: device magnetometer → magnetic heading → + WMM declination → true heading.
   Dial: north-up geographic frame; Kaaba on the rim; fixed phone-top aim. */
const KAABA={lat:21.4224779,lon:39.8251832}; // Google Qibla Finder coordinates
const QIBLA_CITY_COORDS={
 Muscat:[23.5880,58.3829],
 Nizwa:[22.9333,57.5333],
 Salalah:[17.0151,54.0924],
 Sohar:[24.3643,56.7468],
 Sur:[22.5667,59.5289],
 Ibri:[23.2257,56.5157],
 Rustaq:[23.3908,57.4244]
};
/** Approximate magnetic declination (° East positive) ~WMM2025 samples for IDW. */
const QIBLA_DECL_SAMPLES=[
 [23.59,58.38,-1.7],[17.02,54.09,-1.2],[24.45,54.37,-1.5],[25.20,55.27,-1.6],
 [25.29,51.53,-1.8],[29.38,47.99,-2.5],[24.71,46.68,-2.8],[21.42,39.83,3.6],
 [24.71,46.68,-2.8],[30.04,31.24,4.6],[33.51,36.29,5.0],[41.01,28.98,5.8],
 [51.51,-0.13,0.5],[40.71,-74.01,-12.8],[3.14,101.69,0.2],[-6.21,106.85,0.5],
 [28.61,77.21,1.2],[24.86,67.00,1.0],[-33.87,151.21,12.5],[35.68,139.69,-7.8],
 [55.76,37.62,11.5],[19.43,-99.13,4.5],[-23.55,-46.63,-21.5],[0,0,-2]
];

const qibla={
 mode:'compass',
 lat:null,lon:null,source:'city',
 heading:null,rawMagnetic:null,declination:0,qibla:null,
 watchId:null,orientHandler:null,stream:null,
 aligned:false,wasAligned:false,samples:[],
 accuracy:null,usingAbsolute:false,
 offset:0
};

function qiblaBearing(lat,lon){
 const φ1=lat*Math.PI/180,φ2=KAABA.lat*Math.PI/180,Δλ=(KAABA.lon-lon)*Math.PI/180;
 const y=Math.sin(Δλ)*Math.cos(φ2);
 const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function qiblaNorm(deg){return ((Number(deg)%360)+360)%360}
function qiblaDelta(from,to){return ((to-from+540)%360)-180}
function qiblaFmt(deg){return Number.isFinite(deg)?Math.round(deg)+'°':'—'}
function qiblaDistanceKm(lat,lon){
 const R=6371,φ1=lat*Math.PI/180,φ2=KAABA.lat*Math.PI/180,Δφ=(KAABA.lat-lat)*Math.PI/180,Δλ=(KAABA.lon-lon)*Math.PI/180;
 const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}
function qiblaScreenAngle(){
 const o=screen.orientation?.angle;
 if(typeof o==='number'&&Number.isFinite(o))return o;
 if(typeof window.orientation==='number'&&Number.isFinite(window.orientation))return window.orientation;
 return 0;
}

/** Inverse-distance declination (° East of true north). Matches Pillars/WMM usage. */
function qiblaDeclination(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return 0;
 let wSum=0,dSum=0;
 for(const [plat,plon,decl] of QIBLA_DECL_SAMPLES){
  const dlat=lat-plat,dlon=(lon-plon)*Math.cos(lat*Math.PI/180);
  const dist=Math.hypot(dlat,dlon);
  if(dist<0.05)return decl;
  const w=1/(dist*dist);
  wSum+=w;dSum+=w*decl;
 }
 return wSum?dSum/wSum:0;
}

function qiblaSmooth(heading){
 qibla.samples.push(heading);
 if(qibla.samples.length>10)qibla.samples.shift();
 let sx=0,sy=0;
 for(const h of qibla.samples){const r=h*Math.PI/180;sx+=Math.cos(r);sy+=Math.sin(r)}
 return qiblaNorm(Math.atan2(sy,sx)*180/Math.PI);
}

function qiblaStopSensors(){
 if(qibla.watchId!=null&&navigator.geolocation){try{navigator.geolocation.clearWatch(qibla.watchId)}catch{}}
 qibla.watchId=null;
 if(qibla.orientHandler){
  window.removeEventListener('deviceorientationabsolute',qibla.orientHandler,true);
  window.removeEventListener('deviceorientation',qibla.orientHandler,true);
  qibla.orientHandler=null;
 }
 if(qibla.stream){qibla.stream.getTracks().forEach(t=>t.stop());qibla.stream=null}
 const video=$('#qibla-video');if(video)video.srcObject=null;
 qibla.samples=[];qibla.wasAligned=false;qibla.heading=null;qibla.rawMagnetic=null;
}

function qiblaApplyCityFallback(){
 const city=read('prayerCity','Muscat');
 const coords=QIBLA_CITY_COORDS[city]||QIBLA_CITY_COORDS.Muscat;
 qibla.lat=coords[0];qibla.lon=coords[1];qibla.source='city';
 qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
 qibla.declination=qiblaDeclination(qibla.lat,qibla.lon);
 write('qiblaLat',qibla.lat);write('qiblaLon',qibla.lon);
}

function qiblaRefreshGeoMath(){
 if(qibla.lat==null||qibla.lon==null)return;
 qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
 qibla.declination=qiblaDeclination(qibla.lat,qibla.lon);
 if(Number.isFinite(qibla.rawMagnetic)){
  qibla.heading=qiblaSmooth(qiblaNorm(qibla.rawMagnetic+qibla.declination+(Number(qibla.offset)||0)));
 }
}

async function qiblaLocate(){
 qiblaApplyCityFallback();
 if(!navigator.geolocation){qiblaPaintMeta();qiblaPaintDial();return}
 try{
  const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}));
  qibla.lat=pos.coords.latitude;qibla.lon=pos.coords.longitude;qibla.source='gps';
  qiblaRefreshGeoMath();
  write('qiblaLat',qibla.lat);write('qiblaLon',qibla.lon);
  qiblaPaintMeta();qiblaPaintDial();
  if(qibla.watchId==null){
   qibla.watchId=navigator.geolocation.watchPosition(p=>{
    qibla.lat=p.coords.latitude;qibla.lon=p.coords.longitude;qibla.source='gps';
    qiblaRefreshGeoMath();
    qiblaPaintMeta();qiblaPaintDial();
   },()=>{},{enableHighAccuracy:true,maximumAge:15000});
  }
 }catch{
  qiblaPaintMeta();qiblaPaintDial();
  toast?.(t('تعذر تحديد موقعك؛ استُخدمت إحداثيات المدينة المختارة.','Location unavailable; using the selected city coordinates.'));
 }
}

/**
 * Magnetic heading of the top of the UI: 0=N, 90=E, clockwise.
 * Prefer iOS webkitCompassHeading; else absolute alpha only (never relative).
 * Screen-angle correction matches measured iOS/Android practice: +orientation.
 */
function qiblaMagneticHeading(e){
 const screenAngle=qiblaScreenAngle();

 if(typeof e.webkitCompassHeading==='number'&&!Number.isNaN(e.webkitCompassHeading)){
  if(typeof e.webkitCompassAccuracy==='number'){
   qibla.accuracy=e.webkitCompassAccuracy;
   if(e.webkitCompassAccuracy<0)return null; // uncalibrated — keep last good
  }
  return qiblaNorm(e.webkitCompassHeading+screenAngle);
 }

 if(typeof e.alpha!=='number'||Number.isNaN(e.alpha))return null;

 const absolute=e.absolute===true||e.type==='deviceorientationabsolute';
 if(!absolute)return null; // relative alpha is arbitrary — ignore

 qibla.usingAbsolute=true;
 // W3C: alpha increases CCW from north; compass heading = 360 - alpha
 return qiblaNorm(360-e.alpha+screenAngle);
}

function qiblaOnMagnetic(magnetic){
 if(!Number.isFinite(magnetic))return;
 qibla.rawMagnetic=magnetic;
 // true heading = magnetic + declination (East positive), then user fine offset
 const trueHeading=qiblaNorm(magnetic+(Number(qibla.declination)||0)+(Number(qibla.offset)||0));
 qibla.heading=qiblaSmooth(trueHeading);
 qiblaPaintDial();
 qiblaPaintMeta();
}

async function qiblaStartCompass(){
 if(qibla.orientHandler)return true;
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   const state=await DeviceOrientationEvent.requestPermission();
   if(state!=='granted'){toast?.(t('يلزم إذن البوصلة لتحديد الاتجاه.','Compass permission is required.'));return false}
  }
 }catch{
  toast?.(t('تعذر تفعيل بوصلة الجهاز.','Could not enable the device compass.'));
  return false;
 }

 qibla.orientHandler=e=>{
  const magnetic=qiblaMagneticHeading(e);
  if(magnetic==null)return;
  qiblaOnMagnetic(magnetic);
 };

 const hasAbsolute='ondeviceorientationabsolute'in window;
 const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

 // Absolute Earth frame on Android/Chrome; iOS needs deviceorientation for webkitCompassHeading
 if(hasAbsolute)window.addEventListener('deviceorientationabsolute',qibla.orientHandler,true);
 window.addEventListener('deviceorientation',qibla.orientHandler,true);

 if(!hasAbsolute&&!isIOS){
  toast?.(t('هذا المتصفح قد لا يوفّر بوصلة مطلقة؛ عاير بالشكل ٨ وقارن ببوصلة موثوقة.','This browser may lack an absolute compass; figure-8 calibrate and cross-check.'));
 }
 return true;
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

function qiblaSetOffset(delta){
 qibla.offset=Math.max(-45,Math.min(45,(Number(qibla.offset)||0)+delta));
 write('qiblaOffset',qibla.offset);
 qibla.samples=[];
 if(Number.isFinite(qibla.rawMagnetic))qiblaOnMagnetic(qibla.rawMagnetic);
 else{qiblaPaintMeta();qiblaPaintDial()}
 const label=$('#qibla-offset-label');
 if(label)label.textContent=(qibla.offset>0?'+':'')+Math.round(qibla.offset)+'°';
}

function qiblaPaintMeta(){
 const meta=$('#qibla-meta');if(!meta)return;
 const city=read('prayerCity','Muscat');
 const cityLabel=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES.find(([en])=>en===city):null)?.[lang()==='en'?0:1]||city;
 const src=qibla.source==='gps'?t('موقع الجهاز','Device location'):t('مدينة التقويم','Calendar city')+' · '+cityLabel;
 const off=Number(qibla.offset)||0;
 const decl=Number(qibla.declination)||0;
 const dist=qibla.lat!=null?Math.round(qiblaDistanceKm(qibla.lat,qibla.lon)):'—';
 const acc=typeof qibla.accuracy==='number'&&qibla.accuracy>=0
  ?`<span>${t('دقة البوصلة','Compass accuracy')} <b dir="ltr">±${Math.round(qibla.accuracy)}°</b></span>`
  :(qibla.accuracy!=null&&qibla.accuracy<0?`<span>${t('البوصلة تحتاج معايرة (شكل ٨)','Compass needs figure-8 calibration')}</span>`:'');
 meta.innerHTML=`
  <span>${t('اتجاه القبلة','Qibla bearing')} <b dir="ltr">${qiblaFmt(qibla.qibla)}</b> ${t('من الشمال الحقيقي','from true north')}</span>
  <span>${t('المسافة','Distance')} <b dir="ltr">${dist}</b> ${t('كم','km')}</span>
  <span>${t('من','from')} ${esc(src)}</span>
  <span dir="ltr">${qibla.lat!=null?qibla.lat.toFixed(4)+', '+qibla.lon.toFixed(4):'—'}</span>
  <span>${t('الانحراف المغناطيسي','Magnetic declination')} <b dir="ltr">${decl>=0?'+':''}${decl.toFixed(1)}°</b></span>
  ${off?`<span>${t('معايرة','Calibration')} <b dir="ltr">${off>0?'+':''}${Math.round(off)}°</b></span>`:''}
  ${acc}`;
}

function qiblaPaintDial(){
 const rotator=$('#qibla-rotator'),kaaba=$('#qibla-kaaba-mark');
 const status=$('#qibla-status'),headingEl=$('#qibla-heading'),board=$('#qibla-stage'),dial=$('#qibla-dial');
 if(!Number.isFinite(qibla.qibla))return;
 const heading=Number.isFinite(qibla.heading)?qibla.heading:0;
 const turn=qiblaNorm(qibla.qibla-heading);
 // Geographic dial: rotate so true north stays correct relative to phone top.
 if(rotator)rotator.style.transform=`rotate(${-heading}deg)`;
 if(kaaba){
  kaaba.style.transform=`rotate(${qibla.qibla}deg)`;
  kaaba.style.setProperty('--qibla-bearing',qibla.qibla+'deg');
 }
 if(dial){
  dial.style.setProperty('--qibla-turn',turn+'deg');
  dial.style.setProperty('--qibla-bearing',qibla.qibla+'deg');
 }
 if(headingEl)headingEl.textContent=Number.isFinite(qibla.heading)
  ?t('اتجاهك','Facing')+' · '+qiblaFmt(qibla.heading)
  :t('فعّل البوصلة وحرّك الهاتف','Enable compass and move the phone');
 const off=Number.isFinite(qibla.heading)?Math.abs(qiblaDelta(heading,qibla.qibla)):null;
 const aligned=off!=null&&off<=8;
 qibla.aligned=aligned;
 if(board)board.dataset.aligned=aligned?'1':'0';
 if(status){
  if(off==null){status.textContent=t('فعّل البوصلة، أمسك الهاتف مسطحًا، وحرّكه بشكل ٨ ثم استدر حتى تصل الكعبة للسهم.','Enable the compass, hold the phone flat, figure-8 calibrate, then turn until the Kaaba meets the arrow.');status.dataset.state='idle'}
  else if(aligned){status.textContent=t('القبلة أمامك — الله أكبر','The Qibla is ahead');status.dataset.state='aligned'}
  else{
   const side=qiblaDelta(heading,qibla.qibla)>0?t('يمينًا','right'):t('يسارًا','left');
   status.textContent=t('أدِر الهاتف','Turn')+' '+side+' · '+qiblaFmt(off)+' '+t('حتى تصل للكعبة','to the Kaaba');
   status.dataset.state='seek';
  }
 }
 if(aligned&&!qibla.wasAligned){
  if(navigator.vibrate)try{navigator.vibrate([40,40,80])}catch{}
 }
 qibla.wasAligned=aligned;
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
 qibla.offset=Number(read('qiblaOffset',0))||0;
 // Drop legacy invert flag — true/magnetic correction replaces 180° flips from older builds
 if(read('qiblaInvert',false)){write('qiblaInvert',false)}
 const savedLat=read('qiblaLat',null),savedLon=read('qiblaLon',null);
 if(Number.isFinite(savedLat)&&Number.isFinite(savedLon)){
  qibla.lat=savedLat;qibla.lon=savedLon;qibla.source='gps';
  qiblaRefreshGeoMath();
 }else qiblaApplyCityFallback();

 const city=read('prayerCity','Muscat');
 const cityOpts=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES:[['Muscat','مسقط']]).map(([en,arName])=>`<option value="${en}" ${city===en?'selected':''}>${lang()==='en'?en:arName}</option>`).join('');
 $('#main').innerHTML=heading(t('اتجاه القبلة','Qibla direction'),t('كغوغل وPillars: اتجاه الدائرة العظمى من الشمال الحقيقي، مع تصحيح الانحراف المغناطيسي لبوصلة الهاتف.','Like Google & Pillars: great-circle from true north, with magnetic-declination correction for the phone compass.'),t('صلاة','Prayer'))+`
 <div class="qibla-toolbar">
  <button class="chip active" type="button" data-qibla-mode="compass" aria-pressed="true">◎ ${t('بوصلة','Compass')}</button>
  <button class="chip" type="button" data-qibla-mode="camera" aria-pressed="false">▣ ${t('كاميرا','Camera')}</button>
  <button class="chip" type="button" id="qibla-enable">${t('تفعيل البوصلة','Enable compass')}</button>
  <button class="chip" type="button" id="qibla-locate">${t('تحديث الموقع','Update location')}</button>
  <label class="qibla-city"><span>${t('المدينة','City')}</span><select id="qibla-city">${cityOpts}</select></label>
 </div>
 <div class="qibla-calibrate" role="group" aria-label="${t('معايرة دقيقة','Fine calibration')}">
  <button class="chip" type="button" id="qibla-off-left">↺ −5°</button>
  <span id="qibla-offset-label">${(qibla.offset>0?'+':'')+Math.round(qibla.offset)}°</span>
  <button class="chip" type="button" id="qibla-off-right">+5° ↻</button>
  <button class="chip" type="button" id="qibla-off-reset">${t('تصفير','Reset')}</button>
 </div>
 <section class="qibla-board" id="qibla-stage" data-mode="compass" data-aligned="0">
  <div class="qibla-camera-layer" aria-hidden="true"><video id="qibla-video" playsinline muted autoplay></video></div>
  <div class="qibla-aim" aria-hidden="true">
   <span class="qibla-aim-arrow"></span>
   <span class="qibla-aim-label">${t('اتجاه أعلى الهاتف','Phone top')}</span>
  </div>
  <div class="qibla-dial" id="qibla-dial" dir="ltr">
   <div class="qibla-rotator" id="qibla-rotator">
    <div class="qibla-ring" aria-hidden="true">
     <span class="qibla-cardinal n">${t('ش','N')}</span>
     <span class="qibla-cardinal e">${t('ق','E')}</span>
     <span class="qibla-cardinal s">${t('ج','S')}</span>
     <span class="qibla-cardinal w">${t('غ','W')}</span>
    </div>
    <div class="qibla-kaaba" id="qibla-kaaba-mark" aria-hidden="true">
     <span class="qibla-kaaba-icon" title="${t('القبلة','Qibla')}">🕋</span>
    </div>
   </div>
   <div class="qibla-hub"><strong>${t('القبلة','Qibla')}</strong><small id="qibla-heading">${t('فعّل البوصلة للبدء','Enable the compass to begin')}</small></div>
  </div>
  <p class="qibla-status" id="qibla-status" data-state="idle">${t('فعّل البوصلة، أمسك الهاتف مسطحًا، وحرّكه بشكل ٨ ثم استدر حتى تصل الكعبة للسهم.','Enable the compass, hold flat, figure-8, then turn until the Kaaba meets the arrow.')}</p>
  <p class="qibla-guide">${t('من مسقط نحو ~٢٦٦° غربًا (شمال حقيقي). أبعد المعادن والأغطية المغناطيسية. إن انحرف قليلًا استخدم المعايرة ±٥°.','From Muscat ~266° west (true north). Keep away from metal and magnetic cases. Use ±5° fine calibration if slightly off.')}</p>
  <div class="qibla-meta" id="qibla-meta"></div>
 </section>`;
 qiblaPaintMeta();qiblaPaintDial();
 $('#qibla-enable').onclick=async()=>{
  const ok=await qiblaStartCompass();
  if(ok)toast?.(t('البوصلة جاهزة. حرّك الهاتف بشكل ٨ ثم استدر نحو الكعبة.','Compass ready. Figure-8 calibrate, then turn toward the Kaaba.'));
 };
 $('#qibla-locate').onclick=()=>qiblaLocate();
 $('#qibla-city').onchange=e=>{
  write('prayerCity',e.target.value);
  if(qibla.source!=='gps'){qiblaApplyCityFallback();qiblaPaintMeta();qiblaPaintDial()}
 };
 $('#qibla-off-left').onclick=()=>qiblaSetOffset(-5);
 $('#qibla-off-right').onclick=()=>qiblaSetOffset(5);
 $('#qibla-off-reset').onclick=()=>{qibla.offset=0;write('qiblaOffset',0);qiblaSetOffset(0)};
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
 // Permission often needs a tap on iOS — still try; button remains available
 qiblaStartCompass().catch(()=>{});
}

window.addEventListener('hashchange',()=>{
 if(currentRoute!=='qibla'){qiblaStopSensors();document.body.classList.remove('qibla-camera-on')}
});
window.SakinahQibla={qiblaPage,qiblaStopSensors,qiblaBearing,qiblaDeclination};

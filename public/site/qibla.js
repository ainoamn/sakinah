/* Qibla compass — great-circle bearing + live phone heading.
   Model (Pillars / common web Qibla apps):
   - Compute true Qibla bearing from GPS → Kaaba
   - Convert to magnetic Qibla (bearing − declination) to match phone magnetometer
   - Needle angle = magneticQibla − magneticHeading; 0° = Kaaba under the top aim */
const KAABA={lat:21.4224779,lon:39.8251832};
const QIBLA_CITY_COORDS={
 Muscat:[23.5880,58.3829],Nizwa:[22.9333,57.5333],Salalah:[17.0151,54.0924],
 Sohar:[24.3643,56.7468],Sur:[22.5667,59.5289],Ibri:[23.2257,56.5157],Rustaq:[23.3908,57.4244]
};
/* Declination ° East-positive (~WMM2025 samples) */
const QIBLA_DECL_SAMPLES=[
 [23.59,58.38,-1.7],[17.02,54.09,-1.2],[24.45,54.37,-1.5],[25.20,55.27,-1.6],
 [25.29,51.53,-1.8],[29.38,47.99,-2.5],[24.71,46.68,-2.8],[21.42,39.83,3.6],
 [30.04,31.24,4.6],[33.51,36.29,5.0],[41.01,28.98,5.8],[51.51,-0.13,0.5],
 [40.71,-74.01,-12.8],[28.61,77.21,1.2],[24.86,67.00,1.0],[3.14,101.69,0.2],
 [-6.21,106.85,0.5],[-33.87,151.21,12.5],[35.68,139.69,-7.8],[55.76,37.62,11.5]
];

const qibla={
 mode:'compass',lat:null,lon:null,source:'city',
 heading:null,rawHeading:null,declination:0,qibla:null,magneticQibla:null,
 watchId:null,orientHandler:null,stream:null,
 aligned:false,wasAligned:false,samples:[],
 accuracy:null,sensor:'—',invert:false,offset:0,
 raf:0
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
 const R=6371,φ1=lat*Math.PI/180,φ2=KAABA.lat*Math.PI/180;
 const Δφ=(KAABA.lat-lat)*Math.PI/180,Δλ=(KAABA.lon-lon)*Math.PI/180;
 const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}
function qiblaIsIOS(){
 return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
function qiblaScreenAngle(){
 const o=screen.orientation?.angle;
 if(typeof o==='number'&&Number.isFinite(o))return o;
 if(typeof window.orientation==='number'&&Number.isFinite(window.orientation))return window.orientation;
 return 0;
}
function qiblaDeclination(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return 0;
 let wSum=0,dSum=0;
 for(const [plat,plon,decl] of QIBLA_DECL_SAMPLES){
  const dlat=lat-plat,dlon=(lon-plon)*Math.cos(lat*Math.PI/180);
  const dist=Math.hypot(dlat,dlon);
  if(dist<0.08)return decl;
  const w=1/(dist*dist);wSum+=w;dSum+=w*decl;
 }
 return wSum?dSum/wSum:0;
}
function qiblaSmooth(heading){
 qibla.samples.push(heading);
 if(qibla.samples.length>8)qibla.samples.shift();
 let sx=0,sy=0;
 for(const h of qibla.samples){const r=h*Math.PI/180;sx+=Math.cos(r);sy+=Math.sin(r)}
 return qiblaNorm(Math.atan2(sy,sx)*180/Math.PI);
}

/** W3C compass heading from absolute alpha/beta/gamma (works when phone is tilted). */
function qiblaHeadingFromAngles(alpha,beta,gamma){
 const degtorad=Math.PI/180;
 const _x=(beta||0)*degtorad,_y=(gamma||0)*degtorad,_z=(alpha||0)*degtorad;
 const cX=Math.cos(_x),cY=Math.cos(_y),cZ=Math.cos(_z);
 const sX=Math.sin(_x),sY=Math.sin(_y),sZ=Math.sin(_z);
 const Vx=-cZ*sY-sZ*sX*cY;
 const Vy=-sZ*sY+cZ*sX*cY;
 let heading=Math.atan(Vx/Vy);
 if(Vy<0)heading+=Math.PI;
 else if(Vx<0)heading+=2*Math.PI;
 return qiblaNorm(heading*(180/Math.PI));
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
 if(qibla.raf){cancelAnimationFrame(qibla.raf);qibla.raf=0}
 qibla.samples=[];qibla.wasAligned=false;qibla.heading=null;qibla.rawHeading=null;qibla.sensor='—';
}

function qiblaRefreshGeoMath(){
 if(qibla.lat==null||qibla.lon==null)return;
 qibla.qibla=qiblaBearing(qibla.lat,qibla.lon);
 qibla.declination=qiblaDeclination(qibla.lat,qibla.lon);
 // Magnetic Qibla matches phone magnetometers (true − declination; East-positive decl)
 qibla.magneticQibla=qiblaNorm(qibla.qibla-(Number(qibla.declination)||0));
}

function qiblaApplyCityFallback(){
 const city=read('prayerCity','Muscat');
 const coords=QIBLA_CITY_COORDS[city]||QIBLA_CITY_COORDS.Muscat;
 qibla.lat=coords[0];qibla.lon=coords[1];qibla.source='city';
 qiblaRefreshGeoMath();
 write('qiblaLat',qibla.lat);write('qiblaLon',qibla.lon);
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
    qiblaRefreshGeoMath();qiblaPaintMeta();qiblaPaintDial();
   },()=>{},{enableHighAccuracy:true,maximumAge:15000});
  }
 }catch{
  qiblaPaintMeta();qiblaPaintDial();
  toast?.(t('تعذر تحديد موقعك؛ استُخدمت إحداثيات المدينة.','Location unavailable; using city coordinates.'));
 }
}

/**
 * Magnetic heading of the top of the phone UI (0=N … 90=E), clockwise.
 * iOS: webkitCompassHeading only. Android: absolute orientation only.
 */
function qiblaReadMagneticHeading(e){
 const screen=qiblaScreenAngle();

 if(typeof e.webkitCompassHeading==='number'&&!Number.isNaN(e.webkitCompassHeading)){
  if(typeof e.webkitCompassAccuracy==='number'){
   qibla.accuracy=e.webkitCompassAccuracy;
   if(e.webkitCompassAccuracy<0)return null;
  }
  qibla.sensor='iOS';
  // webkitCompassHeading is already clockwise from magnetic north for the device top
  return qiblaNorm(e.webkitCompassHeading+screen);
 }

 if(typeof e.alpha!=='number'||Number.isNaN(e.alpha))return null;
 const absolute=e.absolute===true||e.type==='deviceorientationabsolute';
 if(!absolute)return null;

 qibla.sensor='Android';
 // Prefer full tilt-compensated heading; fall back to flat-device formula
 let heading;
 if(typeof e.beta==='number'&&typeof e.gamma==='number'){
  heading=qiblaHeadingFromAngles(e.alpha,e.beta,e.gamma);
 }else{
  heading=qiblaNorm(360-e.alpha);
 }
 return qiblaNorm(heading+screen);
}

function qiblaOnHeading(magnetic){
 if(!Number.isFinite(magnetic))return;
 let h=magnetic;
 if(qibla.invert)h=qiblaNorm(h+180);
 h=qiblaNorm(h+(Number(qibla.offset)||0));
 qibla.rawHeading=magnetic;
 qibla.heading=qiblaSmooth(h);
 if(!qibla.raf){
  qibla.raf=requestAnimationFrame(()=>{
   qibla.raf=0;
   qiblaPaintDial();
   qiblaPaintMeta();
  });
 }
}

async function qiblaStartCompass(){
 if(qibla.orientHandler)return true;
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   const state=await DeviceOrientationEvent.requestPermission();
   if(state!=='granted'){toast?.(t('يلزم إذن البوصلة.','Compass permission is required.'));return false}
  }
 }catch{
  toast?.(t('تعذر تفعيل بوصلة الجهاز.','Could not enable the device compass.'));
  return false;
 }

 qibla.orientHandler=e=>{
  const h=qiblaReadMagneticHeading(e);
  if(h==null)return;
  qiblaOnHeading(h);
 };

 // One listener only — mixing absolute + relative causes wrong headings on Chrome
 if(qiblaIsIOS()){
  window.addEventListener('deviceorientation',qibla.orientHandler,true);
 }else if('ondeviceorientationabsolute'in window){
  window.addEventListener('deviceorientationabsolute',qibla.orientHandler,true);
 }else{
  window.addEventListener('deviceorientation',qibla.orientHandler,true);
  toast?.(t('المتصفح قد لا يدعم بوصلة مطلقة؛ عاير بالشكل ٨.','Browser may lack absolute compass; figure-8 calibrate.'));
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
  toast?.(t('تعذر فتح الكاميرا. استخدم وضع البوصلة.','Camera unavailable. Use compass mode.'));
  return false;
 }
}

function qiblaSetOffset(delta){
 qibla.offset=Math.max(-90,Math.min(90,(Number(qibla.offset)||0)+delta));
 write('qiblaOffset',qibla.offset);
 qibla.samples=[];
 if(Number.isFinite(qibla.rawHeading))qiblaOnHeading(qibla.rawHeading);
 else{qiblaPaintMeta();qiblaPaintDial()}
 const label=$('#qibla-offset-label');
 if(label)label.textContent=(qibla.offset>0?'+':'')+Math.round(qibla.offset)+'°';
}
function qiblaToggleInvert(){
 qibla.invert=!qibla.invert;
 write('qiblaInvert',qibla.invert);
 qibla.samples=[];
 if(Number.isFinite(qibla.rawHeading))qiblaOnHeading(qibla.rawHeading);
 const btn=$('#qibla-invert');
 if(btn){btn.classList.toggle('active',qibla.invert);btn.setAttribute('aria-pressed',String(qibla.invert))}
 toast?.(qibla.invert?t('عُكس اتجاه المستشعر ١٨٠°.','Sensor direction flipped 180°.'):t('اتجاه المستشعر كما هو.','Sensor direction restored.'));
}

function qiblaPaintMeta(){
 const meta=$('#qibla-meta');if(!meta)return;
 const city=read('prayerCity','Muscat');
 const cityLabel=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES.find(([en])=>en===city):null)?.[lang()==='en'?0:1]||city;
 const src=qibla.source==='gps'?t('موقع الجهاز','Device location'):t('مدينة','City')+' · '+cityLabel;
 const off=Number(qibla.offset)||0;
 const decl=Number(qibla.declination)||0;
 const dist=qibla.lat!=null?Math.round(qiblaDistanceKm(qibla.lat,qibla.lon)):'—';
 const acc=typeof qibla.accuracy==='number'&&qibla.accuracy>=0
  ?`<span>${t('دقة','Accuracy')} <b dir="ltr">±${Math.round(qibla.accuracy)}°</b></span>`
  :(qibla.accuracy!=null&&qibla.accuracy<0?`<span>${t('معايرة الشكل ٨ مطلوبة','Figure-8 calibration needed')}</span>`:'');
 meta.innerHTML=`
  <span>${t('القبلة','Qibla')} <b dir="ltr">${qiblaFmt(qibla.qibla)}</b> ${t('حقيقي','true')}</span>
  <span>${t('الهدف المغناطيسي','Magnetic target')} <b dir="ltr">${qiblaFmt(qibla.magneticQibla)}</b></span>
  <span>${t('اتجاهك','Facing')} <b dir="ltr">${qiblaFmt(qibla.heading)}</b></span>
  <span>${t('المسافة','Distance')} <b dir="ltr">${dist}</b> ${t('كم','km')}</span>
  <span>${t('من','from')} ${esc(src)}</span>
  <span dir="ltr">${qibla.lat!=null?qibla.lat.toFixed(4)+', '+qibla.lon.toFixed(4):'—'}</span>
  <span>${t('الانحراف','Decl.')} <b dir="ltr">${decl>=0?'+':''}${decl.toFixed(1)}°</b></span>
  <span>${t('المستشعر','Sensor')} <b>${esc(qibla.sensor)}</b></span>
  ${off?`<span>${t('معايرة','Cal.')} <b dir="ltr">${off>0?'+':''}${Math.round(off)}°</b></span>`:''}
  ${qibla.invert?`<span>${t('معكوس','Flipped')}</span>`:''}
  ${acc}`;
}

function qiblaPaintDial(){
 const needle=$('#qibla-needle'),status=$('#qibla-status'),headingEl=$('#qibla-heading'),board=$('#qibla-stage');
 const dial=$('#qibla-dial'),rose=$('#qibla-rose');
 if(!Number.isFinite(qibla.qibla))return;

 const target=Number.isFinite(qibla.magneticQibla)?qibla.magneticQibla:qibla.qibla;
 const heading=Number.isFinite(qibla.heading)?qibla.heading:0;
 // Needle points to Kaaba relative to phone top. 0 = aligned.
 const needleAngle=qiblaNorm(target-heading);

 if(needle)needle.style.transform=`rotate(${needleAngle}deg)`;
 // Optional rose: keep geographic north under phone heading
 if(rose)rose.style.transform=`rotate(${-heading}deg)`;
 if(dial)dial.style.setProperty('--qibla-turn',needleAngle+'deg');

 if(headingEl)headingEl.textContent=Number.isFinite(qibla.heading)
  ?t('أدِر حتى يصل السهم للأعلى','Turn until the arrow points up')+' · '+qiblaFmt(needleAngle)
  :t('فعّل البوصلة وحرّك الهاتف','Enable compass and move the phone');

 const err=Number.isFinite(qibla.heading)?Math.abs(qiblaDelta(heading,target)):null;
 const aligned=err!=null&&err<=8;
 qibla.aligned=aligned;
 if(board)board.dataset.aligned=aligned?'1':'0';
 if(status){
  if(err==null){
   status.textContent=t('فعّل البوصلة، أمسك الهاتف مسطحًا، وحرّكه بشكل ٨، ثم استدر حتى يشير السهم للأعلى.','Enable compass, hold flat, figure-8, then turn until the arrow points up.');
   status.dataset.state='idle';
  }else if(aligned){
   status.textContent=t('القبلة أمامك — الله أكبر','The Qibla is ahead');
   status.dataset.state='aligned';
  }else{
   const side=qiblaDelta(heading,target)>0?t('يمينًا','right'):t('يسارًا','left');
   status.textContent=t('أدِر','Turn')+' '+side+' · '+qiblaFmt(err);
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
  btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));
 });
 document.body.classList.toggle('qibla-camera-on',qibla.mode==='camera'&&Boolean(qibla.stream));
 const stage=$('#qibla-stage');if(stage)stage.dataset.mode=qibla.mode;
}

async function qiblaPage(){
 qiblaStopSensors();
 document.body.classList.remove('qibla-camera-on');
 qibla.offset=Number(read('qiblaOffset',0))||0;
 qibla.invert=Boolean(read('qiblaInvert',false));
 const savedLat=read('qiblaLat',null),savedLon=read('qiblaLon',null);
 if(Number.isFinite(savedLat)&&Number.isFinite(savedLon)){
  qibla.lat=savedLat;qibla.lon=savedLon;qibla.source='gps';qiblaRefreshGeoMath();
 }else qiblaApplyCityFallback();

 const city=read('prayerCity','Muscat');
 const cityOpts=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES:[['Muscat','مسقط']]).map(([en,arName])=>`<option value="${en}" ${city===en?'selected':''}>${lang()==='en'?en:arName}</option>`).join('');
 $('#main').innerHTML=heading(
  t('اتجاه القبلة','Qibla direction'),
  t('استدر حتى يشير سهم الكعبة للأعلى (اتجاه أعلى هاتفك). من مسقط نحو ٢٦٦° غربًا.','Turn until the Kaaba arrow points up (phone top). From Muscat ~266° west.'),
  t('صلاة','Prayer')
 )+`
 <div class="qibla-toolbar">
  <button class="chip active" type="button" data-qibla-mode="compass" aria-pressed="true">◎ ${t('بوصلة','Compass')}</button>
  <button class="chip" type="button" data-qibla-mode="camera" aria-pressed="false">▣ ${t('كاميرا','Camera')}</button>
  <button class="chip" type="button" id="qibla-enable">${t('تفعيل البوصلة','Enable compass')}</button>
  <button class="chip" type="button" id="qibla-locate">${t('تحديث الموقع','Update location')}</button>
  <label class="qibla-city"><span>${t('المدينة','City')}</span><select id="qibla-city">${cityOpts}</select></label>
 </div>
 <div class="qibla-calibrate" role="group" aria-label="${t('معايرة','Calibration')}">
  <button class="chip" type="button" id="qibla-off-left">↺ −5°</button>
  <span id="qibla-offset-label">${(qibla.offset>0?'+':'')+Math.round(qibla.offset)}°</span>
  <button class="chip" type="button" id="qibla-off-right">+5° ↻</button>
  <button class="chip ${qibla.invert?'active':''}" type="button" id="qibla-invert" aria-pressed="${qibla.invert}">⇄ ${t('عكس ١٨٠°','Flip 180°')}</button>
  <button class="chip" type="button" id="qibla-off-reset">${t('تصفير','Reset')}</button>
 </div>
 <section class="qibla-board" id="qibla-stage" data-mode="compass" data-aligned="0">
  <div class="qibla-camera-layer" aria-hidden="true"><video id="qibla-video" playsinline muted autoplay></video></div>
  <div class="qibla-aim" aria-hidden="true">
   <span class="qibla-aim-arrow"></span>
   <span class="qibla-aim-label">${t('أمامك','Ahead')}</span>
  </div>
  <div class="qibla-dial" id="qibla-dial" dir="ltr">
   <div class="qibla-rose" id="qibla-rose" aria-hidden="true">
    <span class="qibla-cardinal n">${t('ش','N')}</span>
    <span class="qibla-cardinal e">${t('ق','E')}</span>
    <span class="qibla-cardinal s">${t('ج','S')}</span>
    <span class="qibla-cardinal w">${t('غ','W')}</span>
   </div>
   <div class="qibla-needle" id="qibla-needle">
    <span class="qibla-kaaba-icon" title="${t('القبلة','Qibla')}">🕋</span>
    <span class="qibla-needle-shaft" aria-hidden="true"></span>
   </div>
   <div class="qibla-hub"><strong>${t('القبلة','Qibla')}</strong><small id="qibla-heading">${t('فعّل البوصلة للبدء','Enable the compass to begin')}</small></div>
  </div>
  <p class="qibla-status" id="qibla-status" data-state="idle">${t('فعّل البوصلة، ثم استدر حتى يشير سهم الكعبة للأعلى.','Enable the compass, then turn until the Kaaba arrow points up.')}</p>
  <p class="qibla-guide">${t('إذا كان الاتجاه مقلوبًا اضغط «عكس ١٨٠°». أبعد الأغطية المغناطيسية وحرّك الهاتف بشكل ٨. يمكنك مطابقة زاوية القبلة ببوصلة عادية.','If inverted, tap “Flip 180°”. Keep magnetic cases away and figure-8 calibrate. You can also match the bearing with a normal compass.')}</p>
  <div class="qibla-meta" id="qibla-meta"></div>
 </section>`;

 qiblaPaintMeta();qiblaPaintDial();
 $('#qibla-enable').onclick=async()=>{
  const ok=await qiblaStartCompass();
  if(ok)toast?.(t('البوصلة جاهزة. استدر حتى يصعد سهم الكعبة للأعلى.','Compass ready. Turn until the Kaaba arrow points up.'));
 };
 $('#qibla-locate').onclick=()=>qiblaLocate();
 $('#qibla-city').onchange=e=>{
  write('prayerCity',e.target.value);
  if(qibla.source!=='gps'){qiblaApplyCityFallback();qiblaPaintMeta();qiblaPaintDial()}
 };
 $('#qibla-off-left').onclick=()=>qiblaSetOffset(-5);
 $('#qibla-off-right').onclick=()=>qiblaSetOffset(5);
 $('#qibla-invert').onclick=()=>qiblaToggleInvert();
 $('#qibla-off-reset').onclick=()=>{
  qibla.offset=0;write('qiblaOffset',0);
  qibla.invert=false;write('qiblaInvert',false);
  const btn=$('#qibla-invert');if(btn){btn.classList.remove('active');btn.setAttribute('aria-pressed','false')}
  qiblaSetOffset(0);
 };
 document.querySelectorAll('[data-qibla-mode]').forEach(btn=>btn.onclick=async()=>{
  const mode=btn.dataset.qiblaMode;
  if(mode==='camera'){
   const cam=await qiblaStartCamera();if(!cam)return;
   await qiblaStartCompass();qiblaSetMode('camera');
  }else{
   if(qibla.stream){qibla.stream.getTracks().forEach(t=>t.stop());qibla.stream=null}
   const video=$('#qibla-video');if(video)video.srcObject=null;
   document.body.classList.remove('qibla-camera-on');qiblaSetMode('compass');
  }
 });
 qiblaLocate();
 qiblaStartCompass().catch(()=>{});
}

window.addEventListener('hashchange',()=>{
 if(currentRoute!=='qibla'){qiblaStopSensors();document.body.classList.remove('qibla-camera-on')}
});
window.SakinahQibla={qiblaPage,qiblaStopSensors,qiblaBearing,qiblaDeclination};

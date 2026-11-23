/* Qibla finder: Kaaba on dial + fixed phone-top aim; green when aligned. */
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
 watchId:null,orientHandler:null,stream:null,
 aligned:false,wasAligned:false,samples:[],
 absoluteOnly:false,
 offset:0,
 invert:false
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
 if(typeof o==='number'&&Number.isFinite(o))return o;
 if(typeof window.orientation==='number'&&Number.isFinite(window.orientation))return window.orientation;
 return 0;
}
function qiblaSmooth(heading){
 qibla.samples.push(heading);
 if(qibla.samples.length>12)qibla.samples.shift();
 let sx=0,sy=0;
 for(const h of qibla.samples){const r=h*Math.PI/180;sx+=Math.cos(r);sy+=Math.sin(r)}
 return qiblaNorm(Math.atan2(sy,sx)*180/Math.PI);
}
function qiblaApplyCorrection(heading){
 let h=qiblaNorm(heading+(Number(qibla.offset)||0));
 if(qibla.invert)h=qiblaNorm(h+180);
 return h;
}

function qiblaStopSensors(){
 if(qibla.watchId!=null&&navigator.geolocation){try{navigator.geolocation.clearWatch(qibla.watchId)}catch{}}
 qibla.watchId=null;
 if(qibla.orientHandler){
  window.removeEventListener('deviceorientationabsolute',qibla.orientHandler);
  window.removeEventListener('deviceorientation',qibla.orientHandler);
  qibla.orientHandler=null;
 }
 if(qibla.stream){qibla.stream.getTracks().forEach(t=>t.stop());qibla.stream=null}
 const video=$('#qibla-video');if(video)video.srcObject=null;
 qibla.samples=[];qibla.wasAligned=false;
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

/**
 * Compass heading of the top of the screen: 0=N, 90=E, clockwise.
 */
function qiblaDeviceHeading(e){
 const screenAngle=qiblaScreenAngle();

 if(typeof e.webkitCompassHeading==='number'&&!Number.isNaN(e.webkitCompassHeading)){
  // iOS true/magnetic heading toward the top of the device.
  return qiblaNorm(e.webkitCompassHeading+screenAngle);
 }

 if(typeof e.alpha!=='number'||Number.isNaN(e.alpha))return null;

 // Absolute world frame: alpha rises counter-clockwise from north.
 // Screen-top facing heading = 360 - alpha - screenOrientation.
 return qiblaNorm(360-e.alpha-screenAngle);
}

function qiblaOnHeading(raw){
 if(!Number.isFinite(raw))return;
 qibla.rawHeading=raw;
 qibla.heading=qiblaSmooth(qiblaApplyCorrection(raw));
 qiblaPaintDial();
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
  const h=qiblaDeviceHeading(e);
  if(h==null)return;
  qiblaOnHeading(h);
 };

 // Prefer absolute-only when available (avoids relative alpha wiping true north).
 const hasAbsolute='ondeviceorientationabsolute'in window;
 qibla.absoluteOnly=hasAbsolute;
 if(hasAbsolute){
  window.addEventListener('deviceorientationabsolute',qibla.orientHandler,true);
 }else{
  window.addEventListener('deviceorientation',qibla.orientHandler,true);
 }
 // iOS uses deviceorientation + webkitCompassHeading
 if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){
  window.addEventListener('deviceorientation',qibla.orientHandler,true);
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
 qibla.offset=Math.max(-60,Math.min(60,(Number(qibla.offset)||0)+delta));
 write('qiblaOffset',qibla.offset);
 qibla.samples=[];
 if(Number.isFinite(qibla.rawHeading))qibla.heading=qiblaSmooth(qiblaApplyCorrection(qibla.rawHeading));
 qiblaPaintMeta();qiblaPaintDial();
 const label=$('#qibla-offset-label');
 if(label)label.textContent=(qibla.offset>0?'+':'')+Math.round(qibla.offset)+'°';
}
function qiblaToggleInvert(){
 qibla.invert=!qibla.invert;
 write('qiblaInvert',qibla.invert);
 qibla.samples=[];
 if(Number.isFinite(qibla.rawHeading))qibla.heading=qiblaSmooth(qiblaApplyCorrection(qibla.rawHeading));
 qiblaPaintMeta();qiblaPaintDial();
 const btn=$('#qibla-invert');
 if(btn){btn.classList.toggle('active',qibla.invert);btn.setAttribute('aria-pressed',String(qibla.invert))}
 toast?.(qibla.invert?t('عُكس اتجاه البوصلة ١٨٠°.','Compass direction flipped 180°.'):t('اتجاه البوصلة كما هو.','Compass direction restored.'));
}

function qiblaPaintMeta(){
 const meta=$('#qibla-meta');if(!meta)return;
 const city=read('prayerCity','Muscat');
 const cityLabel=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES.find(([en])=>en===city):null)?.[lang()==='en'?0:1]||city;
 const src=qibla.source==='gps'?t('موقع الجهاز','Device location'):t('مدينة التقويم','Calendar city')+' · '+cityLabel;
 const off=Number(qibla.offset)||0;
 meta.innerHTML=`<span>${t('اتجاه القبلة','Qibla bearing')} <b dir="ltr">${qiblaFmt(qibla.qibla)}</b></span><span>${t('من','from')} ${esc(src)}</span><span dir="ltr">${qibla.lat!=null?qibla.lat.toFixed(4)+', '+qibla.lon.toFixed(4):'—'}</span>${off?`<span>${t('معايرة','Calibration')} <b dir="ltr">${off>0?'+':''}${Math.round(off)}°</b></span>`:''}${qibla.invert?`<span>${t('معكوس','Flipped')}</span>`:''}`;
}

function qiblaPaintDial(){
 const rotator=$('#qibla-rotator'),kaaba=$('#qibla-kaaba-mark');
 const status=$('#qibla-status'),headingEl=$('#qibla-heading'),board=$('#qibla-stage');
 if(!Number.isFinite(qibla.qibla))return;
 const heading=Number.isFinite(qibla.heading)?qibla.heading:0;
 const turn=qiblaNorm(qibla.qibla-heading);
 // Dial keeps geographic north fixed; Kaaba sits at absolute qibla bearing.
 // Fixed top aim = phone facing. Align Kaaba under the aim arrow.
 if(rotator)rotator.style.transform=`rotate(${-heading}deg)`;
 if(kaaba)kaaba.style.transform=`rotate(${qibla.qibla}deg)`;
 const dial=$('#qibla-dial');if(dial)dial.style.setProperty('--qibla-turn',turn+'deg');
 if(headingEl)headingEl.textContent=Number.isFinite(qibla.heading)
  ?t('اتجاهك','Facing')+' · '+qiblaFmt(qibla.heading)
  :t('فعّل البوصلة وحرّك الهاتف','Enable compass and move the phone');
 const off=Number.isFinite(qibla.heading)?Math.abs(qiblaDelta(heading,qibla.qibla)):null;
 const aligned=off!=null&&off<=8;
 qibla.aligned=aligned;
 if(board)board.dataset.aligned=aligned?'1':'0';
 if(status){
  if(off==null){status.textContent=t('فعّل البوصلة، ثم أدِر الهاتف حتى تصل الكعبة إلى السهم أعلاه.','Enable the compass, then turn until the Kaaba reaches the arrow above.');status.dataset.state='idle'}
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
 qibla.invert=Boolean(read('qiblaInvert',false));
 const savedLat=read('qiblaLat',null),savedLon=read('qiblaLon',null);
 if(Number.isFinite(savedLat)&&Number.isFinite(savedLon)){qibla.lat=savedLat;qibla.lon=savedLon;qibla.source='gps';qibla.qibla=qiblaBearing(qibla.lat,qibla.lon)}
 else qiblaApplyCityFallback();
 const city=read('prayerCity','Muscat');
 const cityOpts=(typeof PRAYER_CITIES!=='undefined'?PRAYER_CITIES:[['Muscat','مسقط']]).map(([en,arName])=>`<option value="${en}" ${city===en?'selected':''}>${lang()==='en'?en:arName}</option>`).join('');
 $('#main').innerHTML=heading(t('اتجاه القبلة','Qibla direction'),t('حرّك الهاتف حتى تصل أيقونة الكعبة إلى السهم أعلاه. عند الاصطفاف تتحول البوصلة للأخضر.','Turn the phone until the Kaaba icon reaches the arrow above. When aligned, the compass turns green.'),t('صلاة','Prayer'))+`
 <div class="qibla-toolbar">
  <button class="chip active" type="button" data-qibla-mode="compass" aria-pressed="true">◎ ${t('بوصلة','Compass')}</button>
  <button class="chip" type="button" data-qibla-mode="camera" aria-pressed="false">▣ ${t('كاميرا','Camera')}</button>
  <button class="chip" type="button" id="qibla-enable">${t('تفعيل البوصلة','Enable compass')}</button>
  <button class="chip" type="button" id="qibla-locate">${t('تحديث الموقع','Update location')}</button>
  <label class="qibla-city"><span>${t('المدينة','City')}</span><select id="qibla-city">${cityOpts}</select></label>
 </div>
 <div class="qibla-calibrate" role="group" aria-label="${t('معايرة البوصلة','Compass calibration')}">
  <button class="chip" type="button" id="qibla-off-left">↺ −5°</button>
  <span id="qibla-offset-label">${(qibla.offset>0?'+':'')+Math.round(qibla.offset)}°</span>
  <button class="chip" type="button" id="qibla-off-right">+5° ↻</button>
  <button class="chip ${qibla.invert?'active':''}" type="button" id="qibla-invert" aria-pressed="${qibla.invert}">⇄ ${t('عكس الاتجاه','Flip direction')}</button>
  <button class="chip" type="button" id="qibla-off-reset">${t('تصفير','Reset')}</button>
 </div>
 <section class="qibla-board" id="qibla-stage" data-mode="compass" data-aligned="0">
  <div class="qibla-camera-layer" aria-hidden="true"><video id="qibla-video" playsinline muted autoplay></video></div>
  <div class="qibla-aim" aria-hidden="true">
   <span class="qibla-aim-arrow"></span>
   <span class="qibla-aim-label">${t('اتجاه أعلى الهاتف','Phone top')}</span>
  </div>
  <div class="qibla-dial" id="qibla-dial">
   <div class="qibla-rotator" id="qibla-rotator">
    <div class="qibla-ring" aria-hidden="true">
     <span class="qibla-cardinal n">${t('ش','N')}</span>
     <span class="qibla-cardinal e">${t('ق','E')}</span>
     <span class="qibla-cardinal s">${t('ج','S')}</span>
     <span class="qibla-cardinal w">${t('غ','W')}</span>
    </div>
    <div class="qibla-kaaba" id="qibla-kaaba-mark" aria-hidden="true"><span class="qibla-kaaba-icon" title="${t('القبلة','Qibla')}">🕋</span></div>
   </div>
   <div class="qibla-hub"><strong>${t('القبلة','Qibla')}</strong><small id="qibla-heading">${t('فعّل البوصلة للبدء','Enable the compass to begin')}</small></div>
  </div>
  <p class="qibla-status" id="qibla-status" data-state="idle">${t('فعّل البوصلة، ثم أدِر الهاتف حتى تصل الكعبة إلى السهم أعلاه.','Enable the compass, then turn until the Kaaba reaches the arrow above.')}</p>
  <p class="qibla-guide">${t('من مسقط نحو الغرب تقريبًا (~٢٦٦°). أبعد الهاتف عن الحديد، وحرّكه بشكل ٨. إن كان الاتجاه مقلوبًا استخدم «عكس الاتجاه».','From Muscat roughly west (~266°). Keep away from metal and move in a figure-8. If inverted, use “Flip direction”.')}</p>
  <div class="qibla-meta" id="qibla-meta"></div>
 </section>`;
 qiblaPaintMeta();qiblaPaintDial();
 $('#qibla-enable').onclick=async()=>{const ok=await qiblaStartCompass();if(ok)toast?.(t('البوصلة جاهزة. أدِر الهاتف حتى تصل للكعبة.','Compass ready. Turn until you reach the Kaaba.'))};
 $('#qibla-locate').onclick=()=>qiblaLocate();
 $('#qibla-city').onchange=e=>{write('prayerCity',e.target.value);if(qibla.source!=='gps'){qiblaApplyCityFallback();qiblaPaintMeta();qiblaPaintDial()}};
 $('#qibla-off-left').onclick=()=>qiblaSetOffset(-5);
 $('#qibla-off-right').onclick=()=>qiblaSetOffset(5);
 $('#qibla-off-reset').onclick=()=>{qibla.offset=0;write('qiblaOffset',0);qibla.invert=false;write('qiblaInvert',false);qiblaSetOffset(0);const btn=$('#qibla-invert');if(btn){btn.classList.remove('active');btn.setAttribute('aria-pressed','false')}};
 $('#qibla-invert').onclick=()=>qiblaToggleInvert();
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

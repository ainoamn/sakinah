let installPrompt=null,offlineReady=false,installBusy=false;
function isStandalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function isIos(){return /iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function isAndroid(){return /Android/i.test(navigator.userAgent)}
function isEmbeddedBrowser(){const ua=navigator.userAgent||'';return /; wv\)/i.test(ua)||/FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|Snapchat|TikTok|BytedanceWebview|GSA\//i.test(ua)}
function markInstallReady(){document.querySelectorAll('[data-install]').forEach(b=>{b.dataset.available='true';b.removeAttribute('aria-disabled')})}
function chromeInstallUrl(){const url=location.href.split('#')[0]+(location.hash||'#home');return 'intent://'+location.host+location.pathname+location.search+location.hash+'#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(url)+';end'}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;markInstallReady()});
window.addEventListener('appinstalled',()=>{write('installOfferSeen',true);write('installed',true);installPrompt=null;toast(t('تم تثبيت سكينة.','Sakinah is installed.'));document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true)});
async function waitForInstallPrompt(ms=2500){if(installPrompt)return installPrompt;const start=Date.now();while(!installPrompt&&Date.now()-start<ms){await new Promise(r=>setTimeout(r,120));if('serviceWorker'in navigator)try{await navigator.serviceWorker.ready}catch{}}return installPrompt}
async function promptNativeInstall(){if(typeof navigator.install==='function'){try{await navigator.install();return true}catch(error){if(error.name==='AbortError')return true}}if(!installPrompt)return false;const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome!=='accepted'){/* event is spent; wait for a later beforeinstallprompt */}else write('installed',true);return true}catch{return false}}
function showInstallFallback(){
 const ios=isIos(),embedded=isEmbeddedBrowser(),android=isAndroid();
 const openChrome=android?`<a class="btn" id="install-open-chrome" href="${chromeInstallUrl()}">${t('افتح في Chrome وثبّت مباشرة','Open in Chrome and install now')} ←</a>`:'';
 const retry=`<button class="btn ${android?'secondary':''}" id="install-try-native" type="button">${t('حاول التثبيت الآن','Try installing now')}</button>`;
 openReaderDialog(t('ثبّت سكينة على جهازك','Install Sakinah'),`<div class="install-guide"><img src="assets/app-icon-192.png" alt="${t('شعار سكينة','Sakinah icon')}"><p>${t('نفس التصميم، وقراءة هادئة في نافذة مستقلة.','The same design, in a focused app window.')}</p>${embedded&&android?`<p class="hint">${t('المتصفح الحالي داخل تطبيق آخر لا يسمح بالتثبيت المباشر. افتح سكينة في Chrome ثم اضغط التثبيت.','This in-app browser cannot install apps directly. Open Sakinah in Chrome, then tap Install.')}</p>${openChrome}`:android?`<p class="hint">${t('إن لم تظهر نافذة التثبيت فورًا، افتح الموقع في Chrome واضغط زر التثبيت مرة أخرى.','If the install sheet does not appear, open the site in Chrome and tap Install again.')}</p>${retry}${openChrome}`:ios?`<ol><li>${t('افتح الموقع في Safari.','Open this site in Safari.')}</li><li>${t('اضغط زر المشاركة ⬆.','Tap Share ⬆.')}</li><li>${t('اختر «إضافة إلى الشاشة الرئيسية»، وفعّل «فتح كتطبيق ويب» إن ظهر، ثم اضغط «إضافة».','Choose “Add to Home Screen”, enable “Open as Web App” if shown, then tap “Add”.')}</li></ol>`:`<ol><li>${t('افتح الموقع في Chrome أو Edge.','Open the site in Chrome or Edge.')}</li><li>${t('من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».','In the browser menu ⋮ choose “Install app” or “Add to Home Screen”.')}</li><li>${t('أكد التثبيت عند ظهور نافذة المتصفح.','Confirm in the browser’s installation dialog.')}</li></ol>${retry}`}<p class="hint" id="offline-ready-status">${offlineReady?t('واجهة التطبيق جاهزة دون اتصال. اختر المحتوى من إعدادات التنزيل بعد التثبيت.','The app interface is ready offline. Select content in download settings after installing.'):t('يجهّز التطبيق النصوص للقراءة دون اتصال عند دعم المتصفح لذلك.','The app prepares offline text reading when supported by your browser.')}</p><p class="hint">${t('بعد التثبيت افتح التطبيق واختر حزم الأوف لاين وحجمها. تجد هذه الخيارات لاحقًا في الإعدادات ⚙.','After installing, open the app to choose offline packs and see their sizes. Find these options later in Settings ⚙.')}</p></div>`);
 $('#install-try-native')?.addEventListener('click',async()=>{const dialog=document.querySelector('dialog.reader-dialog,[open]');if(await promptNativeInstall()){dialog?.close?.();return}toast(t('لم تتح نافذة التثبيت بعد. جرّب Chrome أو أعد المحاولة بعد ثوانٍ.','Install is not available yet. Try Chrome, or retry in a moment.'))});
}
async function installSakinah(){
 if(installBusy)return;installBusy=true;
 try{
  if(isStandalone()){toast(t('تستخدم سكينة الآن كتطبيق مثبت.','You are using the installed Sakinah app.'));return}
  if(typeof SakinahState!=='undefined')SakinahState.protect();
  write('installOfferSeen',true);
  if(await promptNativeInstall())return;
  await waitForInstallPrompt(isEmbeddedBrowser()?600:2800);
  if(await promptNativeInstall())return;
  /* Embedded browsers (WhatsApp, Instagram, etc.) cannot show a native install sheet. */
  if(isAndroid()&&isEmbeddedBrowser()){location.href=chromeInstallUrl();toast(t('جارٍ فتح Chrome لإتمام التثبيت…','Opening Chrome to finish installation…'));return}
  showInstallFallback()
 }finally{installBusy=false}
}
document.addEventListener('click',e=>{if(e.target.closest('[data-install]'))installSakinah()});
if('serviceWorker'in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(async reg=>{await reg.update();await navigator.serviceWorker.ready;offlineReady=true;document.body.dataset.offlineReady='true';const status=document.querySelector('#offline-ready-status');if(status)status.textContent=t('واجهة التطبيق جاهزة دون اتصال. اختر المحتوى من إعدادات التنزيل بعد التثبيت.','The app interface is ready offline. Select content in download settings after installing.')}).catch(()=>{document.body.dataset.offlineReady='unavailable'});
}
function connectionStatus(){document.body.classList.toggle('is-offline',!navigator.onLine)}
window.addEventListener('online',connectionStatus);window.addEventListener('offline',connectionStatus);connectionStatus();

let hadWorker=!!navigator.serviceWorker?.controller,updatingApp=false;navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(!hadWorker){hadWorker=true;return}if(updatingApp)return;updatingApp=true;SakinahState.rememberRoute();const focused=document.activeElement?.matches('input,textarea,select')||performance.now()<2500;if(focused){document.documentElement.dataset.updateReady='true';toast(t('تحديث جديد جاهز؛ سيظهر عند إعادة فتح الصفحة.','An update is ready and will appear when you reload the page.'))}else location.reload()});

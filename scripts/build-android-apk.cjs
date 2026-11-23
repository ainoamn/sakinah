/**
 * Non-interactive Trusted Web Activity (TWA) APK builder for Sakinah.
 * Requires JDK 17 + Android SDK (bubblewrap doctor must pass).
 */
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const core=require(path.join(
 process.env.APPDATA||'',
 'npm/node_modules/@bubblewrap/cli/node_modules/@bubblewrap/core'
));

const ROOT=path.join(__dirname,'..');
// Android Gradle rejects non-ASCII project paths on Windows (Arabic folder names).
const OUT_DIR=process.env.SAKINAH_TWA_DIR||path.join(process.env.LOCALAPPDATA||ROOT,'sakinah-android-twa');
const HOST=process.env.SAKINAH_TWA_HOST||'s.bhd-om.com';
const MANIFEST_URL=`https://${HOST}/manifest.webmanifest`;
const PACKAGE_ID='om.bhd.sakinah';
const APP_VERSION_NAME=process.env.SAKINAH_APK_VERSION||'1.1.0';
const APP_VERSION_CODE=Number(process.env.SAKINAH_APK_CODE||2);
const KEYSTORE=path.join(OUT_DIR,'android.keystore');
const KEY_ALIAS='sakinah';
const KEYSTORE_PASSWORD=process.env.BUBBLEWRAP_KEYSTORE_PASSWORD||'SakinahBhd2026!';
const KEY_PASSWORD=process.env.BUBBLEWRAP_KEY_PASSWORD||KEYSTORE_PASSWORD;
const DOWNLOADS=path.join(ROOT,'public','site','downloads');
const CONFIG_PATH=path.join(process.env.USERPROFILE||process.env.HOME,'.bubblewrap','config.json');
const META_DIR=path.join(ROOT,'android-twa');

function ensureConfig(){
 const cfg={
  jdkPath:'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot',
  androidSdkPath:path.join(process.env.LOCALAPPDATA,'Android','Sdk')
 };
 fs.mkdirSync(path.dirname(CONFIG_PATH),{recursive:true});
 if(!fs.existsSync(CONFIG_PATH))fs.writeFileSync(CONFIG_PATH,JSON.stringify(cfg,null,2));
 const parsed=JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'));
 if(!parsed.jdkPath||!parsed.androidSdkPath){
  fs.writeFileSync(CONFIG_PATH,JSON.stringify(cfg,null,2));
  return cfg;
 }
 return parsed;
}

function ensureSdkBin(sdkPath){
 const bin=path.join(sdkPath,'bin');
 const src=path.join(sdkPath,'cmdline-tools','latest','bin');
 if(!fs.existsSync(bin)&&fs.existsSync(src)){
  spawnSync('cmd',['/c','mklink','/J',bin,src],{stdio:'inherit'});
 }
}

async function main(){
 const cfg=ensureConfig();
 ensureSdkBin(cfg.androidSdkPath);
 fs.mkdirSync(OUT_DIR,{recursive:true});

 console.log('Fetching web manifest…',MANIFEST_URL);
 let twa=await core.TwaManifest.fromWebManifest(MANIFEST_URL);
 twa.packageId=PACKAGE_ID;
 twa.name='سكينة';
 twa.launcherName='سكينة';
 twa.host=HOST;
 twa.startUrl='/?launch=app';
 twa.appVersionName=APP_VERSION_NAME;
 twa.appVersionCode=APP_VERSION_CODE;
 twa.appVersion=APP_VERSION_NAME;
 twa.signingKey={path:KEYSTORE,alias:KEY_ALIAS};
 twa.generatorApp='bubblewrap-cli';
 twa.features={locationDelegation:{enabled:true}};
 twa.fallbackType='customtabs';
 twa.enableNotifications=false;
 twa.isChromeOSOnly=false;
 twa.minSdkVersion=24;
 // Keep Vercel origin trusted if the primary host is the custom domain.
 if(HOST==='s.bhd-om.com')twa.additionalTrustedOrigins=['sakinah-swart.vercel.app'];
 await twa.saveToFile(path.join(OUT_DIR,'twa-manifest.json'));
 twa=await core.TwaManifest.fromFile(path.join(OUT_DIR,'twa-manifest.json'));
 twa.packageId=PACKAGE_ID;
 twa.name='سكينة';
 twa.launcherName='سكينة';
 twa.host=HOST;
 twa.signingKey={path:KEYSTORE,alias:KEY_ALIAS};
 twa.features={locationDelegation:{enabled:true}};
 twa.appVersionName=APP_VERSION_NAME;
 twa.appVersionCode=APP_VERSION_CODE;
 twa.appVersion=APP_VERSION_NAME;
 if(HOST==='s.bhd-om.com')twa.additionalTrustedOrigins=['sakinah-swart.vercel.app'];
 // Shortcut icons may be Git LFS pointers on the CDN; use the main icon for generation.
 const safeIcon=twa.iconUrl;
 if(Array.isArray(twa.shortcuts)){
  twa.shortcuts=twa.shortcuts.map(s=>({...s,chosenIconUrl:safeIcon,iconUrl:safeIcon}));
 }
 await twa.saveToFile(path.join(OUT_DIR,'twa-manifest.json'));
 twa=await core.TwaManifest.fromFile(path.join(OUT_DIR,'twa-manifest.json'));

 const config=new core.Config(cfg.jdkPath,cfg.androidSdkPath);
 const jdkHelper=new core.JdkHelper(process,config);
 const keyTool=new core.KeyTool(jdkHelper);

 if(!fs.existsSync(KEYSTORE)){
  console.log('Creating signing keystore…');
  await keyTool.createSigningKey({
   fullName:'Bin Hamood Development',
   organizationalUnit:'Sakinah',
   organization:'BHD',
   country:'OM',
   password:KEYSTORE_PASSWORD,
   keypassword:KEY_PASSWORD,
   alias:KEY_ALIAS,
   path:KEYSTORE
  });
 }

 console.log('Generating Android project in',OUT_DIR);
 const generator=new core.TwaGenerator();
 const log=new core.ConsoleLog('sakinah-apk');
 await generator.createTwaProject(OUT_DIR,twa,log);

 const checksum=crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT_DIR,'twa-manifest.json'))).digest('hex');
 fs.writeFileSync(path.join(OUT_DIR,'manifest-checksum.txt'),checksum);
 const gradleProps=path.join(OUT_DIR,'gradle.properties');
 if(fs.existsSync(gradleProps)){
  let props=fs.readFileSync(gradleProps,'utf8');
  if(!props.includes('android.overridePathCheck')){
   fs.appendFileSync(gradleProps,'\nandroid.overridePathCheck=true\n');
  }
 }

 const androidSdkTools=await core.AndroidSdkTools.create(process,config,jdkHelper,log);
 if(!(await androidSdkTools.checkBuildTools())){
  console.log('Installing Android build-tools (this may take a few minutes)…');
  await androidSdkTools.installBuildTools();
 }

 process.env.BUBBLEWRAP_KEYSTORE_PASSWORD=KEYSTORE_PASSWORD;
 process.env.BUBBLEWRAP_KEY_PASSWORD=KEY_PASSWORD;

 console.log('Building release APK…');
 process.chdir(OUT_DIR);
 const gradle=new core.GradleWrapper(process,androidSdkTools,OUT_DIR);
 await gradle.assembleRelease();

 const unsigned=path.join(OUT_DIR,'app','build','outputs','apk','release','app-release-unsigned.apk');
 const aligned=path.join(OUT_DIR,'app-release-unsigned-aligned.apk');
 const signed=path.join(OUT_DIR,'app-release-signed.apk');
 if(!fs.existsSync(unsigned))throw new Error('Unsigned APK missing at '+unsigned);

 await androidSdkTools.zipalignOnlyVerification(unsigned);
 fs.copyFileSync(unsigned,aligned);
 // Bubblewrap's apksigner helper breaks when JAVA_HOME has spaces; call apksigner.jar via java
 // (apksigner.bat + passwords containing "!" fail under cmd delayed expansion).
 const apksignerJar=path.join(cfg.androidSdkPath,'build-tools','36.1.0','lib','apksigner.jar');
 const javaBin=path.join(cfg.jdkPath,'bin','java.exe');
 const sign=spawnSync(javaBin,[
  '-jar',apksignerJar,
  'sign',
  '--ks',KEYSTORE,
  '--ks-key-alias',KEY_ALIAS,
  '--ks-pass','pass:'+KEYSTORE_PASSWORD,
  '--key-pass','pass:'+KEY_PASSWORD,
  '--out',signed,
  aligned
 ],{stdio:'inherit',env:{...process.env,ANDROID_HOME:cfg.androidSdkPath,JAVA_HOME:cfg.jdkPath}});
 if(sign.status!==0)throw new Error('apksigner failed');

 fs.mkdirSync(DOWNLOADS,{recursive:true});
 const dest=path.join(DOWNLOADS,'sakinah.apk');
 fs.copyFileSync(signed,dest);
 console.log('APK ready:',dest);

 // Digital Asset Links fingerprint
 const fp=spawnSync(path.join(cfg.jdkPath,'bin','keytool.exe'),[
  '-list','-v','-keystore',KEYSTORE,'-alias',KEY_ALIAS,'-storepass',KEYSTORE_PASSWORD
 ],{encoding:'utf8'});
 const match=(fp.stdout||'').match(/SHA256:\s*([0-9A-F:]+)/i);
 if(!match)throw new Error('Could not read keystore SHA256 fingerprint');
 const sha256=match[1].replace(/:/g,'').toUpperCase();
 const assetlinks=[{
  relation:['delegate_permission/common.handle_all_urls'],
  target:{
   namespace:'android_app',
   package_name:PACKAGE_ID,
   sha256_cert_fingerprints:[match[1].toUpperCase()]
  }
 }];
 const wellKnown=path.join(ROOT,'public','site','.well-known');
 fs.mkdirSync(wellKnown,{recursive:true});
 fs.writeFileSync(path.join(wellKnown,'assetlinks.json'),JSON.stringify(assetlinks,null,2));
 fs.mkdirSync(META_DIR,{recursive:true});
 fs.copyFileSync(path.join(OUT_DIR,'twa-manifest.json'),path.join(META_DIR,'twa-manifest.json'));
 fs.writeFileSync(path.join(META_DIR,'signing-fingerprint.txt'),match[1].toUpperCase()+'\n');
 fs.writeFileSync(path.join(OUT_DIR,'signing-fingerprint.txt'),match[1].toUpperCase()+'\n');
 // Keep a project-local copy of the keystore for rebuilds (gitignored).
 fs.copyFileSync(KEYSTORE,path.join(META_DIR,'android.keystore'));
 console.log('assetlinks.json written. SHA256:',match[1].toUpperCase());
 console.log('Done.');
}

main().catch(err=>{console.error(err);process.exit(1)});

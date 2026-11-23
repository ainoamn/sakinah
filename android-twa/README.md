# سكينة — حزمة أندرويد (TWA)

تطبيق أندرويد مبني كـ Trusted Web Activity يفتح موقع سكينة بملء الشاشة.

## إعادة بناء الـ APK

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:BUBBLEWRAP_KEYSTORE_PASSWORD="…"
$env:BUBBLEWRAP_KEY_PASSWORD="…"
$env:SAKINAH_TWA_HOST="s.bhd-om.com"
$env:SAKINAH_APK_VERSION="1.1.0"
$env:SAKINAH_APK_CODE="2"
node scripts/build-android-apk.cjs
```

الناتج يُنسخ إلى `public/site/downloads/sakinah.apk`.

## ملاحظات

- المضيف الافتراضي: `s.bhd-om.com` (مع الإبقاء على `sakinah-swart.vercel.app` كأصل موثوق إضافي).
- مسار البناء الفعلي: `%LOCALAPPDATA%\sakinah-android-twa` (لتجنب مسارات عربية تكسر Gradle).
- بصمة التوقيع موجودة في `signing-fingerprint.txt` ويجب أن تطابق `public/site/.well-known/assetlinks.json`.
- ملف `android.keystore` محلي ومُستثنى من Git.

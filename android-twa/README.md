# سكينة — حزمة أندرويد (TWA)

تطبيق أندرويد مبني كـ Trusted Web Activity يفتح موقع سكينة بملء الشاشة.

## إعادة بناء الـ APK

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:BUBBLEWRAP_KEYSTORE_PASSWORD="…"
$env:BUBBLEWRAP_KEY_PASSWORD="…"
node scripts/build-android-apk.cjs
```

الناتج يُنسخ إلى `public/site/downloads/sakinah.apk`.

## ملاحظات

- مسار البناء الفعلي: `%LOCALAPPDATA%\sakinah-android-twa` (لتجنب مسارات عربية تكسر Gradle).
- بصمة التوقيع موجودة في `signing-fingerprint.txt` ويجب أن تطابق `public/site/.well-known/assetlinks.json`.
- ملف `android.keystore` محلي ومُستثنى من Git.

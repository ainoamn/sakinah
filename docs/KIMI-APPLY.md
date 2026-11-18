# طريقة تطبيق حزمة إصلاحات سكينة (V12)

> ملاحظة أمان: لا تشارك كلمة مرور GitHub أو أي Token مع أي طرف.
> هذه الحزمة تُطبق محليًا بأوامر git عادية.

## الطريقة 1: ترقيع مباشر (الأسرع)

افتح الطرفية داخل مجلد المستودع (`sakinah`) ثم:

```bash
git fetch origin
git checkout main && git pull origin main
git apply --check /path/to/sakinah-fixes.patch   # فحص مسبق بدون تعديل
git apply /path/to/sakinah-fixes.patch
```

الملفات الجديدة غير المشمولة في الترقيع (LICENSE, SECURITY.md, CONTRIBUTING.md,
robots.txt, sitemap.xml, .gitattributes, .github/workflows/ci.yml, README.md)
تأخذ نسخًا كاملة من مجلد `repo/` داخل هذه الحزمة:

```bash
cp -r /path/to/sakinah-fixes/repo/. .   # Linux/macOS
# أو انسخ محتوى مجلد repo يدويًا من مستكشف الملفات على Windows
```

## الطريقة 2: استبدال يدوي

انسخ محتويات مجلد `repo/` كاملة فوق المستودع (تحل محل الملفات المعدلة وتضيف الجديدة).

## بعد التطبيق

```bash
node validate.cjs
node scripts/test-device-state.cjs
node scripts/test-pwa.cjs
git add -A
git commit -m "V12: security, SEO/PWA fixes, CI (canonical, CSP, rate limiting, sw cache key)"
git push origin main
vercel deploy --prod --yes
```

## خطوات لا يمكن تنفيذها عن بُعد (نفّذها أنت)

1. **الدومين الرسمي**: عند تثبيت دومين (مثل sakinah.om) حدّث `SITE_URL` في:
   `public/site/index.html` (canonical, og:url, JSON-LD), `robots.txt`, `sitemap.xml`.
2. **Git LFS للأصول الموجودة**: `git lfs migrate import --include="*.webp,*.pdf,*.jpg,*.jpeg,*.png,*.woff2"` ثم ادفع مرة واحدة.
3. **نشر واجهة الحساب**: تعديلات `app/api/account/*` تحتاج إعادة نشر بنية Sites/Cloudflare (Vercel ينشر الواجهة الثابتة فقط).
4. **رقم إصدار sw.js مستقبلًا**: أي تعديل على sw.js يتطلب رفع ثابت VERSION (أضيف فحص تلقائي في CI).

## ملخص التغييرات

| الملف | التغيير |
|---|---|
| public/site/index.html | canonical صحيح + og:image + Twitter + دمج الخطوط + ?v=12 |
| public/site/sw.js | إصلاح مفتاح cache النسبي + إصدار v12 |
| public/site/state.js | مرايا IndexedDB مجمعة 300ms |
| public/site/manifest.webmanifest | اختصارات موحدة ?launch=app |
| public/site/robots.txt + sitemap.xml | جديدان |
| vercel.json | CSP + X-Frame-Options + Permissions-Policy + cache طويل لـ assets |
| app/api/account/route.ts | rate limit 90/دقيقة + سقف 200 مفتاح + تنظيف النشاط القديم |
| app/api/account/progress.ts | حد طول المفتاح + علامة صفحة حسب عدد آيات السورة |
| README.md | إزالة المسارات الشخصية وتحديث الإصدار |
| LICENSE / SECURITY.md / CONTRIBUTING.md | جديدة |
| .github/workflows/ci.yml | CI مع فحص رفع إصدار sw.js |
| .gitattributes | تجهيز Git LFS |

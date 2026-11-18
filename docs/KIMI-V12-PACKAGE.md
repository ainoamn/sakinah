# حزمة كي مي V12 — تطبيق ومراجعة

المصدر المحلي للمستخدم: `C:\Users\ahami\Downloads\02100`

## الحالة

طُبّقت ملفات `sakinah-fixes/repo/` على المستودع ونُشرت على GitHub/Vercel في الالتزامين:

- `c138fa8` Apply Kimi V12 security, SEO, PWA, and account hardening package.
- `d763297` Fix V12 IndexedDB durability for progress keys after Kimi batching.

الملف `sakinah-fixes.patch` كان تالفًا عند التطبيق المباشر؛ نُسخت الملفات النهائية من مجلد `repo/`.

## ما دخل المستودع

| الملف | الغرض |
|---|---|
| `public/site/index.html` | canonical + og/twitter + خطوط موحّدة + `?v=12` |
| `public/site/sw.js` | إصلاح مفتاح الكاش + إصدار v12 |
| `public/site/state.js` | تجميع مرايا mtime + حفظ فوري لمفاتيح التقدم |
| `public/site/manifest.webmanifest` | اختصارات `?launch=app` |
| `public/site/robots.txt` / `sitemap.xml` | فهرسة |
| `vercel.json` | CSP + Frame + Permissions + cache للأصول |
| `app/api/account/*` | rate limit + سقف مفاتيح + تنظيف نشاط |
| `LICENSE` / `SECURITY.md` / `CONTRIBUTING.md` | حوكمة |
| `.github/workflows/ci.yml` | CI |
| `.gitattributes` | تجهيز Git LFS |

دليل التطبيق الأصلي محفوظ هنا: [KIMI-APPLY.md](KIMI-APPLY.md).

## ما يبقى يدويًا

1. دومين رسمي وتحديث canonical/robots/sitemap.
2. `git lfs migrate` للأصول الثقيلة عند الرغبة.
3. إعادة نشر Sites/Cloudflare لتفعيل تعديلات واجهة الحساب.

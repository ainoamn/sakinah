# سكينة | Sakinah

موقع قراءة عام، بهوية عمانية وإباضية، مع حساب اختياري ومكتبة PDF.

## مصدر الموقع

- `public/site/`: الواجهة العربية والإنجليزية والمصحف والأصول والكتب؛ هذا هو مصدر الواجهة الذي يُعدل.
- `app/api/account/route.ts`: واجهة الحساب المحمية بهوية Sites؛ لا يُؤخذ معرف المستخدم من الطلب.
- `db/schema.ts` و`drizzle/`: مخطط الحساب والنشاط وترحيله.
- `.openai/hosting.json`: هوية الموقع وربط D1 باسم DB. الجمهور عام.
- `dist/`: ناتج بناء مولد؛ لا تعدله.

## التشغيل والتحقق

    npm run dev -- --port 5173 --hostname 127.0.0.1
    node validate.cjs
    python scripts/test-account.py

اختبار الحساب يستخدم محاكاة الدخول المحلية Seedy فقط. التشغيل المحلي يحتاج تطبيق ترحيل D1 قبل اختبارات الحساب؛ راجع README الخاص ببنية Sites عند تعديل المخطط.

البناء المعتمد:

    node C:/Users/ahami/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/build-site.mjs

## السلوك

القراءة متاحة دون حساب. تسجيل الدخول الاختياري باستخدام ChatGPT يحفظ خطة الورد وزيارات الحساب والأذكار المكتملة والصفحات التي يعلّمها المستخدم كمنتهية وعلامة الصفحة. البيانات مفصولة على الخادم بمعرف هوية المستخدم. طلبات الكتابة تتحقق من المصدر والمدخلات، وتستخدم معرف حدث لمنع التكرار.

المصحف يدعم العرض الأفقي والتمرير الطولي مع تحميل الصفحات عند الحاجة. الصور تأتي من آيات بجامعة الملك سعود؛ النص المحلي بديل. الكتب الخمسة محفوظة في 135 بطاقة مصورة مع نسبة المصدر. 33 ملف PDF للأذكار والأدعية وفئاتها، إضافة إلى ملفات الكتب الخمسة. أزرار المشاركة تستخدم مشاركة النظام عند الدعم، والتنزيل عند عدم توفر مشاركة الملفات.

الواجهة باللغتين؛ النصوص الدينية الأصلية والكتب المرفوعة بالعربية. مواقيت الصلاة من AlAdhan مع اختيار المدينة والطريقة، وهي حسابية وليست الجدول الرسمي العماني. الحكمة اليومية محتوى تحريري موسوم بوضوح وليست حديثا منسوبا.

تنبيه المتصفح يعمل أثناء فتح الموقع وبإذن المستخدم. لعمل التذكير بعد الإغلاق، ينزل المستخدم ملف ICS ويستورده في تقويمه مع تفعيل التنبيهات. لا توجد خدمة إرسال بريد أو إشعارات Push في الخلفية.

## الكتب والحقوق

الحقوق والمصادر في `public/site/assets/CREDITS.txt` و`QURAN-LICENSE.txt`. كتب المستخدم تحفظ نصوصها وصفحاتها الأصلية، مع غلاف سكينة دون ادعاء تأليفها. استخراج بعض خرائط PDF غير موثوق لذا عُرضت الصفحات صورا ويمكن تكبيرها. `scripts/build_books.py` يعيد إنتاج الأصول من الملفات المحلية الأصلية، ويدعم `--exports-only`.

المحتوى لا يمثل مراجعة علمية إباضية أو تخريجا مستقلا، ولا تدعي المبادرة اعتماد جهة رسمية.

## الإصدار الرابع: القراءة والتجاوب

تحسين الخطوط وأحجام اللمس والقوائم للهواتف واللوحيات والمكاتب. قارئ مصحف المدينة ومصحف التجويد الملوّن من آيات، مع التفسير الميسر بجانب الصفحة أو تحت صفحات التمرير الطولي. لم تتغير نصوص القرآن أو علامات القراءة. راجع ترقيم بيانات آيات وتطابق 604 صفحة قبل اعتماد خرائط مصحف التجويد.

وضع التركيز يشغل كامل مساحة العرض بأزرار مختصرة، ويطلب Fullscreen API من إجراء المستخدم مباشرة حين يدعمه المتصفح. عند عدم دعم ملء الشاشة الأصلي يعمل ملء مساحة المتصفح. عرض الورقة يحافظ على نسبتها ولا يمدد الحروف. مصدر التفسير Al Quran Cloud، إصدار ar.muyassar، عند الطلب مع معالجة تعذر الاتصال.


### Quran reader v5
- Replaces low-resolution raster scans with resolution-independent QPC V2 and COLRv1 V4 Tajweed page fonts from the documented Quran Foundation CDN. Fonts load before the SVG text appears; glyph shapes are never stretched.
- Local `quran-layout.json` contains QUL line/glyph ordering for both 604-page editions, including all 114 surah headings and all 6,236 verse references. QUL asset snapshot obtained via the NedaaDevs asset release. Rejected an incomplete third-party API export during preparation.
- Normal book view and focus view both fit the visual viewport. Continuous scroll remains an explicit option in reading settings. Bookmarks, reading completion, text fallback, and page navigation remain available.
- Commentary uses complete verse/commentary text, paginated to the available panel height. Phones switch between the page and commentary rather than stacking tall panels.
- Browser QA: 1280×720, 1440×900, 768×1024, 390×844, 320×740, and 844×390; ordinary book view document height matched viewport height. Tested color Tajweed, final page 604, long verse 2:282, bookmarks, options, focus, and English direction. Native fullscreen is unavailable in the in-app preview; its CSS fallback was verified.
- Page fonts and commentary need internet access. A font failure offers retry and the bundled Unicode Quran text.

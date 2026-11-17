# سكينة | Sakinah

موقع قراءة عام، بهوية عمانية وإباضية، مع حساب اختياري ومكتبة PDF.

## النشر والروابط

- GitHub: https://github.com/ainoamn/sakinah
- Vercel (إنتاج): https://sakinah-swart.vercel.app
- لوحة Vercel: https://vercel.com/bhdom89-8158s-projects/sakinah

الواجهة العامة المنشورة على Vercel هي الملفات في `public/site/` عبر `vercel.json` (مخرجات ثابتة بلا بناء Next). أي دفع إلى الفرع `main` يُعاد نشره تلقائيًا بعد ربط المستودع.

رفع ونشر يدوي من مجلد المشروع:

    git add -A
    git commit -m "Update Site source"
    git push origin main
    vercel deploy --prod --yes

## مصدر الموقع

- `public/site/`: الواجهة العربية والإنجليزية والمصحف والأصول والكتب؛ هذا هو مصدر الواجهة الذي يُعدل.
- `public/site/state.js`: حفظ فوري محلي مع نسخة IndexedDB للاستعادة؛ لا يُرسل إلى خادم.
- `public/site/device.js`: استئناف التطبيق المثبّت وتصدير/استيراد نسخة التقدم.
- `public/site/mobile.css`: تنسيقات الشاشات الضيقة وأدوات نسخة التقدم.
- `app/api/account/route.ts`: واجهة الحساب المحمية بهوية Sites؛ لا يُؤخذ معرف المستخدم من الطلب.
- `db/schema.ts` و`drizzle/`: مخطط الحساب والنشاط وترحيله.
- `.openai/hosting.json`: هوية الموقع وربط D1 باسم DB. الجمهور عام.
- `dist/`: ناتج بناء مولد؛ لا تعدله.

## التشغيل والتحقق

    npm run dev -- --port 5173 --hostname 127.0.0.1
    node validate.cjs
    node scripts/test-device-state.cjs
    python scripts/test-account.py

اختبار الحساب يستخدم محاكاة الدخول المحلية Seedy فقط. التشغيل المحلي يحتاج تطبيق ترحيل D1 قبل اختبارات الحساب؛ راجع README الخاص ببنية Sites عند تعديل المخطط.

البناء المعتمد لـ Sites:

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


### Sakinah v6 — BHD identity and installable app
- Brand endorsement: developed and operated by Bin Hamood Development (BHD), https://www.bhd-om.com/company. The original BHD SVG, palette and UI typography follow its published visual identity guide. Sakinah keeps its own devotional identity. Publisher JSON-LD, sidebar, mobile footer and sources page name the operator. This is branding and operator attribution; account authentication remains the existing Sites integration.
- Full-page Quran surface enlarged by combining desktop controls, removing duplicate page headings and reducing outer framing. At 1280×720 the open book grew from about 494px to 622px high while keeping navigation and saving visible.
- A+ and two-touch pinch recognition enter a QPC glyph reflow mode with 26–64px font controls. Glyphs retain their page font and order. Oversized content is paginated by measured screen space; Full page restores the printed layout. A persistent bookmark button is available in both modes. Button-driven reflow was browser-tested; physical touch pinch was not device-tested.
- Main collections, home panels, Names, deeds, books and landmarks use screen-sized decks; long devotional text is paginated without dropping words. Search, categories, sharing, counters and automatic next-dhikr remain functional. Calendar has a compact six-column prayer strip and a fitted month grid. Explicit continuous Quran scrolling and informational dialogs remain available.
- Installable PWA: relative-scope manifest, maskable 192/512 icons and 180px Apple icon, standalone launch, Android install prompt handling and iOS Safari Add to Home Screen instructions. This is installation from the web, not an App Store/Play Store binary. No physical Android/iOS installation was performed in this environment.
- Public offline shell includes Unicode Quran text, dhikr, page layout and UI. Page fonts are cached on use, bounded to 32 runtime resources. Large PDFs, audio, commentary and account operations are not promised offline. Account APIs, auth requests and non-GET traffic are never cached. Network-first updates; cache write failures do not block online reading.
- Validation: `node scripts/test-pwa.cjs`, `node validate.cjs`, JS syntax checks, production build. UI checks covered 320×740, 390×844, 844×390 and 1280×720, Arabic/English, 15 requested sections, card search, automatic advance, font reflow, bookmarks and book slides. Offline-ready state confirmed in the browser; actual offline navigation/privacy/cache-quota behavior tested with a service-worker harness.
- Reference reviewed: Golden Quran’s App Store listing, https://apps.apple.com/jo/app/golden-quran-المصحف-الذهبي/id852497554 (font enlargement through two-finger zoom). No app artwork or code was copied.

V7 cache correction: versioned frontend script/style URLs, public shell fetched with reload during service-worker installation, network revalidation and ignore-search offline matching. Cleared detached placeholder-image callbacks and percent-encoded the SVG placeholder to prevent late image errors.

V8 continuous reader: all initial and lazily appended pages use one QPC page component and matching paper surface. Placeholder image callbacks are detached before replacement; an automatic image failure cannot open the Unicode text fallback alongside a rendered page. Page text remains an explicit expandable option. Final source is synchronized to the user-requested GitHub repository after publishing.

### Sakinah v9 — device persistence and install resume
- `state.js` writes every change immediately to `localStorage` and mirrors an IndexedDB backup (`sakinah-device-state`). Recovery restores missing local keys without overwriting a newer in-session write. Storage mode is exposed on `document.documentElement.dataset.stateStorage`.
- Standalone / `?launch=app` relaunches resume the last supported route (including Quran page or continuous scroll). Browser tabs that stay on `#home` are not forced to resume.
- Progress keys cover counters, favorites, bookmark, last/saved page, tasbih goal, deck position, flow parts, language, edition and font settings. Export/import uses `sakinah-progress` JSON validated in `device.js`; sign-in data is excluded.
- Home Quran CTA continues from `lastPage`. Deck pagers and flow-reader parts remember their place. Mobile default reading size starts at 26px under 760px width.
- PWA shell cache bumped to `sakinah-v9-20261117` and includes `state.js`, `device.js`, `mobile.css`. Install flow asks for persistent storage when available and clarifies iOS “Open as Web App”.
- Validation: `node scripts/test-device-state.cjs` covers Android/iOS/app-launch resume, IndexedDB recovery, fresh-write conflict protection and continuous-reading route updates. Published to GitHub `ainoamn/sakinah` and Vercel production.


### V9 — mobile browser sizing, durable progress, offline reading and reconnect sync
- Mobile fields are at least 16px and text-size-adjust is fixed at 100%, avoiding Safari input-focus zoom/text inflation while preserving user pinch zoom. Width containment and safe-area padding apply to browser and standalone modes. Default devotional text is 26px on phones; intentional user font choices remain saved.
- Existing `sakinah-*` storage keys are preserved. Writes are synchronous to localStorage and mirrored into IndexedDB. Boot-time defaults cannot overwrite a recovered backup; an inactive tab cannot replace a newer reading route. The app start URL restores the last route, while the home Quran link continues the last page. Tasbih goal, counts, bookmarks, session position and enlarged-page parts are retained. Backup export/import is available for separate browser/app containers.
- Phone browsers show one custom install offer, persisted across visits. Actual OS installation always requires browser consent. Chrome native install API is feature-detected with beforeinstallprompt fallback; iPhone guidance includes Safari Add to Home Screen / Open as Web App. No physical Android/iPhone was connected; actual native installation and Safari automatic zoom cannot be certified from the available desktop browser.
- Core offline shell now contains the complete Quran text, local Uthmanic font, all 6,236 Al-Muyassar commentary entries, dhikr, UI and mosque images. Missing page fonts offer an explicit offline text page. Optional resumable cache packs download all 604 fonts for either printed edition, or the PDF books/cards. Audio remains online. Previously visited prayer calendars are cached as public data.
- On reconnect, public content updates through the service worker. Optional signed-in account progress sync uses validated per-key timestamps and atomic JSON updates; older offline writes cannot replace newer progress. Guest progress remains local. Account API responses are never service-worker cached.
- Tests: device-state/IndexedDB recovery and launch paths; one-time Android/iPhone offer logic and resumable offline packs; manifest/cache behavior; authenticated HTTP progress privacy, CSRF, stale-write rejection and atomic settings preservation. Real browser tabs were closed and reopened: Quran page 35, dhikr counter, tasbih counter and goal 1000 were restored, including after sync. Mobile 320px layout audit covered every listed collection plus account/sources; no horizontal overflow and no undersized visible form fields. Physical-device installation remains an explicit test limit.

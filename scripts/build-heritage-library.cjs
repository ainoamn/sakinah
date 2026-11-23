/* Build heritage-library.json from OpenITI Ibadi texts + remote hadith catalog.
   Do not commit the tmp-openiti downloads; only the generated JSON under public/site. */
const fs = require('fs');
const path = require('path');

function cleanOpeniti(raw) {
  let body = raw.includes('#META#Header#End#')
    ? raw.split('#META#Header#End#').slice(1).join('\n')
    : raw;
  body = body.replace(/\r/g, '');
  body = body.replace(/^######OpenITI#.*$/m, '');
  body = body.replace(/~~\s*\n/g, '\n');
  body = body.replace(/~~/g, '');
  const parts = body.split(/(PageV\d+P\d+)/);
  const pages = [];
  let buf = '';
  let pageLabel = '';
  const flush = () => {
    let text = buf
      .replace(/^#+\s*/gm, '')
      .replace(/\|+/g, ' ')
      .replace(/@[^@\n]+@/g, '')
      .replace(/ms\d+/gi, '')
      .replace(/\(_\([^)]*\)_\)/g, '')
      .replace(/\(_\(\s*\)_?\)?/g, '')
      .replace(/¬\s*\d+/g, '')
      .replace(/###\s*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    text = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    if (text.length > 40) {
      const printed = String(pageLabel || '').match(/^ص\s*(\d+)/);
      pages.push({
        title: '',
        text,
        reference: pageLabel || '',
        printedPage: printed ? Number(printed[1]) : null,
      });
    }
    buf = '';
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^PageV\d+P\d+$/.test(p)) {
      flush();
      const m = p.match(/PageV(\d+)P(\d+)/);
      pageLabel =
        'ص ' + Number(m[2]) + (m[1] !== '01' ? ' · ج ' + Number(m[1]) : '');
    } else {
      buf += p;
    }
  }
  flush();
  if (pages.length <= 1) {
    const text = body
      .replace(/PageV\d+P\d+/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/~~/g, '')
      .trim();
    const chunks = [];
    let cur = [];
    let len = 0;
    for (const line of text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      cur.push(line);
      len += line.length;
      if (len > 500) {
        chunks.push(cur.join('\n'));
        cur = [];
        len = 0;
      }
    }
    if (cur.length) chunks.push(cur.join('\n'));
    return chunks.map((t, i) => ({
      title: 'مقطع ' + (i + 1),
      text: t,
      reference: '',
    }));
  }
  return pages.map((p, i) => ({
    ...p,
    title: p.title || 'صفحة ' + (i + 1),
    reference: p.reference || '',
  }));
}

const catalogMeta = {
  'bahjat-anwar': {
    id: 'aqidah-bahjat-anwar',
    title: 'بهجة الأنوار',
    titleEn: 'Bahjat al-Anwar',
    author: 'نور الدين عبد الله بن حميد السالمي',
    section: 'aqidah',
    sourceLabel:
      'بهجة الأنوار شرح أنوار العقول — نور الدين السالمي. النص من الشاملة الإباضية عبر OpenITI. يبدأ نص الشاملة من حوالي ص ٣٠ من ترقيم بعض المطبوعات (مقدمة الناشر والفهارس غير مضمنة)، ثم يتتابع نص المؤلف حتى آخر الكتاب.',
    sourceURL:
      'https://github.com/OpenITI/1350AH/tree/master/data/1332NurDinSalimi/1332NurDinSalimi.BahjatAnwar',
  },
  'mashariq-anwar': {
    id: 'aqidah-mashariq',
    title: 'مشارق أنوار العقول',
    titleEn: 'Mashariq Anwar al-Uqul',
    author: 'نور الدين عبد الله بن حميد السالمي',
    section: 'aqidah',
    sourceLabel:
      'مشارق أنوار العقول — نور الدين السالمي. النص من الشاملة الإباضية عبر OpenITI. إصدار قراءة في مكتبة سكينة.',
    sourceURL:
      'https://github.com/OpenITI/1350AH/tree/master/data/1332NurDinSalimi/1332NurDinSalimi.Mashariq',
  },
  'ghayat-murad': {
    id: 'aqidah-ghayat-murad',
    title: 'غاية المراد في الاعتقاد',
    titleEn: 'Ghayat al-Murad',
    author: 'نور الدين عبد الله بن حميد السالمي',
    section: 'aqidah',
    sourceLabel:
      'غاية المراد في علم الاعتقاد — منظومة لنور الدين السالمي. النص من الشاملة الإباضية عبر OpenITI.',
    sourceURL:
      'https://github.com/OpenITI/1350AH/tree/master/data/1332NurDinSalimi/1332NurDinSalimi.GhayatMuradFiIctiqad',
  },
  'lamca-murdiyya': {
    id: 'aqidah-lamca',
    title: 'اللمعة المرضية من أشعة الإباضية',
    titleEn: 'al-Lamʿa al-Mardiyya',
    author: 'نور الدين عبد الله بن حميد السالمي',
    section: 'aqidah',
    sourceLabel:
      'اللمعة المرضية من أشعة الإباضية — نور الدين السالمي. النص من الشاملة الإباضية عبر OpenITI.',
    sourceURL:
      'https://github.com/OpenITI/1350AH/tree/master/data/1332NurDinSalimi/1332NurDinSalimi.LamcaMurdiyya',
  },
  'talqin-subyan': {
    id: 'aqidah-talqin',
    title: 'تلقين الصبيان',
    titleEn: 'Talqin al-Subyan',
    author: 'نور الدين عبد الله بن حميد السالمي',
    section: 'aqidah',
    sourceLabel:
      'تلقين الصبيان — نور الدين السالمي. رسالة في تعليم أصول الدين. النص من الشاملة الإباضية عبر OpenITI.',
    sourceURL:
      'https://github.com/OpenITI/1350AH/tree/master/data/1332NurDinSalimi/1332NurDinSalimi.TalqinSubyan',
  },
  'usul-din': {
    id: 'aqidah-usul-din',
    title: 'أصول الدين (الأصول العشرة)',
    titleEn: 'Usul al-Din (The Ten Principles)',
    author: 'تبغورين بن عيسى الملشوطي',
    section: 'aqidah',
    sourceLabel:
      'أصول الدين أو الأصول العشرة عند الإباضية — تبغورين بن عيسى الملشوطي. النص من الشاملة الإباضية عبر OpenITI.',
    sourceURL:
      'https://github.com/OpenITI/0450AH/tree/master/data/0450TabghurinMalshuti/0450TabghurinMalshuti.UsulDin',
  },
  'jami-sahih-rabi': {
    id: 'hadith-jami-rabi',
    title: 'الجامع الصحيح — مسند الربيع بن حبيب',
    titleEn: 'al-Jami al-Sahih (Musnad al-Rabi)',
    author: 'الربيع بن حبيب · ترتيب الوارجلاني',
    section: 'hadith',
    sourceLabel:
      'الجامع الصحيح مسند الإمام الربيع بن حبيب، بترتيب أبي يعقوب الوارجلاني. النص من الشاملة الإباضية عبر OpenITI. عمدة الحديث عند الإباضية؛ سكينة تقدمه للقراءة مع نسبة المصدر دون ادعاء تخريج معاصر.',
    sourceURL:
      'https://github.com/OpenITI/0175AH/tree/master/data/0170RabicIbnHabibAzdi/0170RabicIbnHabibAzdi.JamicSahih',
  },
};

const root = path.join(__dirname, '..');
const localBooks = [];
for (const [key, meta] of Object.entries(catalogMeta)) {
  const raw = fs.readFileSync(path.join(root, 'tmp-openiti', key + '.txt'), 'utf8');
  const slides = cleanOpeniti(raw).map((s, i) => ({
    title: s.title || '',
    text: s.text,
    printedPage: s.printedPage || null,
    reference:
      (meta.author ? meta.author + ' · ' : '') +
      (s.reference || meta.title) +
      ' · ' +
      (i + 1),
  }));
  console.log(key, 'slides', slides.length, 'chars', slides.reduce((a, s) => a + s.text.length, 0));
  localBooks.push({
    id: meta.id,
    title: meta.title,
    titleEn: meta.titleEn,
    author: meta.author,
    section: meta.section,
    textEdition: true,
    sourceLabel: meta.sourceLabel,
    sourceURL: meta.sourceURL,
    slides,
  });
}

const hadithRemote = [
  { id: 'hadith-nawawi', title: 'الأربعون النووية', titleEn: 'Nawawi Forty', edition: 'ara-nawawi', section: 'sunnah', count: 42 },
  { id: 'hadith-qudsi', title: 'الأربعون القدسية', titleEn: 'Forty Hadith Qudsi', edition: 'ara-qudsi', section: 'sunnah', count: 40 },
  { id: 'hadith-bukhari', title: 'صحيح البخاري', titleEn: 'Sahih al-Bukhari', edition: 'ara-bukhari', section: 'hadith', count: 7589 },
  { id: 'hadith-muslim', title: 'صحيح مسلم', titleEn: 'Sahih Muslim', edition: 'ara-muslim', section: 'hadith', count: 7563 },
  { id: 'hadith-abudawud', title: 'سنن أبي داود', titleEn: 'Sunan Abu Dawud', edition: 'ara-abudawud', section: 'hadith', count: 5274 },
  { id: 'hadith-tirmidhi', title: 'جامع الترمذي', titleEn: 'Jami al-Tirmidhi', edition: 'ara-tirmidhi', section: 'hadith', count: 4344 },
  { id: 'hadith-nasai', title: 'سنن النسائي', titleEn: 'Sunan al-Nasai', edition: 'ara-nasai', section: 'hadith', count: 5765 },
  { id: 'hadith-ibnmajah', title: 'سنن ابن ماجه', titleEn: 'Sunan Ibn Majah', edition: 'ara-ibnmajah', section: 'hadith', count: 4341 },
  { id: 'hadith-malik', title: 'موطأ مالك', titleEn: 'Muwatta Malik', edition: 'ara-malik', section: 'hadith', count: 1903 },
].map((h) => ({
  id: h.id,
  title: h.title,
  titleEn: h.titleEn,
  section: h.section,
  textEdition: true,
  remoteHadith:
    'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/' +
    h.edition +
    '.min.json',
  hadithCount: h.count,
  slides: [
    {
      title: 'تحميل الكتاب',
      text: 'يُحمَّل نص الكتاب من مصدر الحديث المفتوح عند فتحه للقراءة.',
      reference: h.title,
    },
  ],
  sourceLabel:
    h.title +
    ' — نص عربي من مشروع hadith-api (fawazahmed0) عبر jsDelivr. تقدَّم المرويات بمصدرها دون ادعاء مراجعة فقهية إباضية.',
  sourceURL: 'https://github.com/fawazahmed0/hadith-api',
}));

const all = [...localBooks, ...hadithRemote];
const out = path.join(root, 'public', 'site', 'heritage-library.json');
fs.writeFileSync(out, JSON.stringify(all));
console.log('wrote', out, 'books', all.length, 'bytes', fs.statSync(out).size);

/* Separate OpenITI "ص N" markers from display titles in heritage-library.json */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'public', 'site', 'heritage-library.json');
const books = JSON.parse(fs.readFileSync(file, 'utf8'));

function parseTitle(title) {
  const raw = String(title || '').trim();
  const m = raw.match(/^ص\s*(\d+)(?:\s*·\s*ج\s*(\d+))?$/);
  if (m) {
    return {
      printedPage: Number(m[1]),
      volume: m[2] ? Number(m[2]) : null,
      title: '',
    };
  }
  // "ص 30 · something" rare form
  const m2 = raw.match(/^ص\s*(\d+)\s*·\s*(.+)$/);
  if (m2) {
    return {
      printedPage: Number(m2[1]),
      volume: null,
      title: m2[2].trim(),
    };
  }
  return { printedPage: null, volume: null, title: raw };
}

let changed = 0;
for (const book of books) {
  if (!Array.isArray(book.slides)) continue;
  for (const slide of book.slides) {
    const parsed = parseTitle(slide.title);
    if (parsed.printedPage != null) {
      slide.printedPage = parsed.printedPage;
      if (parsed.volume) slide.volume = parsed.volume;
      slide.title = parsed.title;
      changed++;
    }
  }
  if (book.id === 'aqidah-bahjat-anwar') {
    book.sourceLabel =
      'بهجة الأنوار شرح أنوار العقول — نور الدين السالمي. النص من الشاملة الإباضية عبر OpenITI. يبدأ نص الشاملة من حوالي ص ٣٠ من ترقيم بعض المطبوعات (مقدمة الناشر والفهارس غير مضمنة في هذا المصدر الرقمي)، ثم يتتابع نص المؤلف كاملاً حتى آخر الكتاب.';
    book.editionNote =
      'ترقيم «المطبوع» في أسفل الصفحة يشير إلى رقم نسخة الشاملة/المطبوع عند توفره، وهو قد لا يبدأ من ١.';
  }
}

fs.writeFileSync(file, JSON.stringify(books));
console.log('updated slides with printedPage:', changed, 'bytes', fs.statSync(file).size);
const bahjat = books.find((b) => b.id === 'aqidah-bahjat-anwar');
console.log(
  'bahjat first',
  bahjat.slides.slice(0, 3).map((s) => ({ title: s.title, printedPage: s.printedPage, text: s.text.slice(0, 40) }))
);

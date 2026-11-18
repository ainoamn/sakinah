import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "site"
retreat = json.loads((ROOT / "transcriptions" / "retreat.json").read_text(encoding="utf-8"))
overlay = json.loads((ROOT / "transcriptions" / "retreat-overlay-2-18.json").read_text(encoding="utf-8"))
by_page = {s["sourcePage"]: s for s in retreat["slides"]}
for s in overlay.get("slides", []):
    old = by_page.get(s["sourcePage"])
    if not old or len((s.get("text") or "")) >= len((old.get("text") or "")) * 0.8:
        by_page[s["sourcePage"]] = s


def clean(text: str) -> str:
    text = text or ""
    text = re.sub(r"حصال[ةه]?\s*غدير[ةه]?", "", text)
    text = re.sub(r"صلاة\s*عذبة", "", text)
    text = text.replace("\u06dd", "\n").replace("\u06de", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


slides = []
for page in sorted(by_page):
    s = by_page[page]
    slides.append(
        {
            "title": s.get("title") or f"خلوة مع الله — الصفحة {page}",
            "text": clean(s.get("text", "")),
            "reference": "",
            "sourcePage": page,
            "review": {
                "status": "site-native-text",
                "publishReady": True,
                "method": "transcription compiled into Sakinah text edition; brand marks removed",
                "sourceImage": f"books/retreat/page-{page:03d}.webp",
            },
        }
    )

book = {
    "id": "retreat",
    "title": "خلوة مع الله",
    "titleEn": "A Quiet Retreat with Allah",
    "textEdition": True,
    "sourceLabel": "إصدار نصي تابع لسكينة، مفرَّغ من الأصل مع زخارف المكتبة. أُزيلت علامة «حصالة غديرة».",
    "vocalizationNote": "نُقلت الألفاظ كما وردت في التفريغ؛ يُراجع التشكيل تدريجيًا. القراءة بهيئة صفحات قابلة للتقليب.",
    "slides": slides,
}

path = ROOT / "original-text-books.json"
data = json.loads(path.read_text(encoding="utf-8"))
data = [b for b in data if b.get("id") != "retreat"]
for b in data:
    if b.get("id") == "qadr":
        b["sourceLabel"] = "إصدار نصي تابع لسكينة لأدعية ليلة القدر، مفرَّغ ومقابل بالأصل."
    if b.get("id") == "comprehensive":
        b["sourceLabel"] = "إصدار نصي تابع لسكينة لدعاء شامل، مفرَّغ ومقابل بالأصل."
    if b.get("id") == "ruqyah":
        b["sourceLabel"] = "إصدار نصي تابع لسكينة للرقية الشرعية، مفرَّغ ومقابل بالأصل."
data.append(book)
path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

books = json.loads((ROOT / "books.json").read_text(encoding="utf-8"))
for b in books:
    if b["id"] == "supplications":
        b["sourceLabel"] = "كتيب الأدعية — صفحات أصلية مصوّرة داخل مكتبة سكينة (التفريغ النصي قيد الإكمال)."
    if b["id"] == "retreat":
        b["sourceLabel"] = "خلوة مع الله — يُعرض الإصدار النصي في المكتبة؛ الأصل محفوظ للمقارنة."
(ROOT / "books.json").write_text(json.dumps(books, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok", [b["id"] for b in data], "retreat", len(slides))

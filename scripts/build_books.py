"""Build Sakinah reading editions without altering original Arabic page content.
The user-supplied source pages retain their visible credits. No authorship transfer.
Run with system Python (PyMuPDF + pypdf); ReportLab is loaded from the bundled runtime.
"""
from pathlib import Path
import json,sys,io,re,math,unicodedata
import fitz
from PIL import Image,ImageDraw,ImageFont
from pypdf import PdfReader,PdfWriter,Transformation
import html,subprocess
BUNDLED=Path('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/python/Lib/site-packages')
if str(BUNDLED) not in sys.path: sys.path.append(str(BUNDLED))
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'public/site' if (ROOT/'public/site').exists() else ROOT/'dist'
OUT=SITE/'books'; OUT.mkdir(exist_ok=True)
QA=OUT/'_qa';QA.mkdir(exist_ok=True)
LOGO=SITE/'assets/sakinah-emblem.png'
SMALL_LOGO=QA/'logo-small.png'
logo_image=Image.open(LOGO);logo_image.thumbnail((96,96));logo_image.save(SMALL_LOGO,optimize=True)
FAMILY=Path('C:/Users/ahami/OneDrive/كل الملفات/01 عبد الحميد/01 العائلة/عائلة عبد الحميد/01- عبد الحميد')
SOURCES=[
 dict(id='comprehensive',title='دعاء شامل',titleEn='Comprehensive Supplications',file=Path('C:/Users/ahami/SFG International Dropbox/ABDULHAMID ALRAWAHI/الادعية/دعاء شامل.pdf'),desc='دعاء جامع في الحمد والتوبة والهداية والرزق والأهل والوالدين.',publisher='المصدر: ملف دعاء شامل الذي أضافه صاحب الموقع.'),
 dict(id='ruqyah',title='الرقية الشرعية',titleEn='Ruqyah Reading Collection',file=Path('C:/Users/ahami/SFG International Dropbox/ABDULHAMID ALRAWAHI/الرقية_الشرعية_بعد_تعديل_التكرار.pdf'),desc='آيات وأدعية للرقية، مع إيضاح المصدر أن بعض التكرارات اختيارات تنظيمية وليست أعدادًا ثابتة.',publisher='المصدر: ملف الرقية الشرعية بعد تعديل التكرار الذي أضافه صاحب الموقع.'),
 dict(id='qadr',title='أدعية ليلة القدر',titleEn='Laylat al-Qadr Supplications',file=FAMILY/'أدعية لـ ليلة القدر.  (1).pdf',desc='مجموعة أدعية من الملف المرفوع لليلة القدر؛ تعرض الصفحات الأصلية كما وردت.',publisher='المصدر: ملف أدعية ليلة القدر الذي أضافه صاحب الموقع؛ لم يذكر غلافه مؤلفًا.'),
 dict(id='supplications',title='كتيب الأدعية',titleEn='Supplications Booklet',file=FAMILY/'كتيب الأدعية.pdf',desc='كتيب مصوّر يضم أبوابًا متنوعة من الدعاء في تسع وسبعين صفحة أصلية.',publisher='المصدر: ملف كتيب الأدعية الذي أضافه صاحب الموقع. حُفظت نسبته وعلاماته الظاهرة.'),
 dict(id='retreat',title='خلوة مع الله',titleEn='A Quiet Retreat with Allah',file=FAMILY/'__خلوة مع الله_.pdf',desc='صفحات في الدعاء والذكر والخلوة، مع إبقاء علامة المصدر الظاهرة في الأصل.',publisher='المصدر: ملف خلوة مع الله الذي أضافه صاحب الموقع؛ يحمل علامة «صلاة عذبة».')
]
BOOKS=[]
GREEN='#173f35';GOLD='#ad925c';CREAM='#faf7ed'
A4=(595.2756,841.8898)

def cover_pdf(book,source_count):
 doc=fitz.open();p=doc.new_page(width=A4[0],height=A4[1]);p.draw_rect(p.rect,color=None,fill=fitz.sRGB_to_pdf(int('faf7ed',16)))
 # A restrained mihrab outline and Omani palette.
 p.draw_rect(fitz.Rect(30,30,A4[0]-30,A4[1]-30),color=fitz.sRGB_to_pdf(int('ad925c',16)),width=.8)
 p.draw_rect(fitz.Rect(38,38,A4[0]-38,A4[1]-38),color=fitz.sRGB_to_pdf(int('ded6c3',16)),width=.4)
 p.insert_image(fitz.Rect(239,95,356,207),filename=str(LOGO),keep_proportion=True)
 preserve_note='النصوص من المراجع الموضحة مع كل مادة؛ ليست ترجمة لمعاني القرآن ولا ادعاء بحصر الأدعية.' if book.get('compiled') else 'حُفظت الصفحات الأصلية دون إعادة صياغة النصوص.'
 html=f'''<div style="text-align:center;color:{GREEN};font-family:book;direction:rtl"><div style="font-size:46px">سكينة</div><div style="font-size:15px;color:{GOLD};letter-spacing:2px">مكتبة القراءة والدعاء</div><div style="margin-top:50px;font-size:39px;font-weight:bold">{book['title']}</div><div style="font-size:15px;color:#758176;margin-top:10px">{book['titleEn']}</div><div style="font-size:18px;margin-top:45px">إصدار قراءة بهوية سكينة</div><div style="font-size:15px;line-height:1.9;color:#687466;margin:17px 20px">{book['publisher']}<br>{preserve_note}<br>الترتيب والغلاف والهوامش من سكينة، ولا تعني نسبَ التأليف للموقع أو اعتماد المحتوى شرعيًا.</div></div>'''
 css="@font-face{font-family:book;src:url(trado.ttf)}body{margin:0;padding:0}"
 p.insert_htmlbox(fitz.Rect(60,212,A4[0]-60,725),html,css=css,archive=fitz.Archive('C:/Windows/Fonts'))
 p.insert_textbox(fitz.Rect(70,760,A4[0]-70,783),'SAKINAH  /  READING LIBRARY  /  2026',fontsize=9,fontname='helv',align=1,color=fitz.sRGB_to_pdf(int('ad925c',16)))
 p.insert_textbox(fitz.Rect(70,785,A4[0]-70,803),'sakinah-oman.workspace-061987.chatgpt.site',fontsize=7.5,fontname='helv',align=1,color=(.4,.45,.4))
 raw=doc.tobytes(garbage=4,deflate=True);doc.close();return raw

def branded_frame(n,total):
 mem=io.BytesIO();c=canvas.Canvas(mem,pagesize=A4)
 c.setFillColorRGB(.98,.97,.94);c.rect(0,0,*A4,stroke=0,fill=1)
 c.setStrokeColorRGB(.68,.57,.36);c.setLineWidth(.5);c.line(29,A4[1]-43,A4[0]-29,A4[1]-43);c.line(29,39,A4[0]-29,39)
 c.drawImage(ImageReader(str(SMALL_LOGO)),A4[0]-48,A4[1]-35,width=20,height=23,mask='auto',preserveAspectRatio=True)
 c.setFillColorRGB(.09,.24,.20);c.setFont('Helvetica',9);c.drawString(30,A4[1]-28,'SAKINAH  |  Reading library')
 c.setFillColorRGB(.43,.47,.42);c.setFont('Helvetica',7.5);c.drawString(30,24,'Original source page preserved - credits remain with their owners')
 c.setFillColorRGB(.60,.49,.29);c.drawRightString(A4[0]-30,24,f'{n} / {total}')
 c.showPage();c.save();return PdfReader(io.BytesIO(mem.getvalue())).pages[0]

for book in ([] if '--exports-only' in sys.argv else SOURCES):
 source=fitz.open(book['file']);reader=PdfReader(str(book['file']));writer=PdfWriter();cover=cover_pdf(book,len(source));writer.add_page(PdfReader(io.BytesIO(cover)).pages[0])
 slides=[];folder=OUT/book['id'];folder.mkdir(exist_ok=True);coverdoc=fitz.open(stream=cover,filetype='pdf');coverdoc[0].get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(str(QA/(book['id']+'-cover.png')))
 # Original-page images avoid corrupted legacy PDF text maps and preserve Quran spelling.
 for i,page in enumerate(source):
  imagepath=folder/(f'page-{i+1:03}.webp')
  if not imagepath.exists():
   pix=page.get_pixmap(matrix=fitz.Matrix(1.4,1.4),alpha=False)
   im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
   im.save(imagepath,'WEBP',quality=89,method=4)
  generic='صفحة أصلية مصوّرة من '+book['title']+'؛ يُقرأ نصها من الصورة، ويمكن مشاركة الملف أو الصفحة.'
  slides.append({'title':book['title']+' - الصفحة '+str(i+1),'text':generic,'image':'books/'+book['id']+'/'+imagepath.name,'sourcePage':i+1,'imageOnly':True})
  # Place vector original on a new framed page, preserving source credits and artwork.
  original=reader.pages[i];w=float(original.mediabox.width);h=float(original.mediabox.height);scale=min((A4[0]-48)/w,(A4[1]-105)/h);x=(A4[0]-w*scale)/2;y=51+(A4[1]-105-h*scale)/2
  frame=branded_frame(i+1,len(source));frame.merge_transformed_page(original,Transformation().scale(scale).translate(x,y),over=True);writer.add_page(frame)
 writer.add_metadata({'/Title':book['title']+' | Sakinah reading edition','/Author':'','/Subject':'User-supplied source preserved; Sakinah cover and reading frame only','/Creator':'Sakinah reading library'})
 outfile=OUT/(book['id']+'.pdf');writer.write(str(outfile));check=fitz.open(outfile)
 assert len(check)==len(source)+1
 # Representative visual QA, including every source-page thumbnail for content inspection.
 for index in {0,1,max(1,len(check)//2),len(check)-1}:
  check[index].get_pixmap(matrix=fitz.Matrix(1,1)).save(str(QA/(book['id']+'-output-'+str(index)+'.png')))
 # Contact sheets of all source pages; these are not distributed.
 thumbw=150;thumbh=220;cols=5;rows=6
 for start in range(0,len(source),cols*rows):
  sheet=Image.new('RGB',(cols*(thumbw+12),rows*(thumbh+28)),(238,236,229));draw=ImageDraw.Draw(sheet)
  for j,idx in enumerate(range(start,min(start+cols*rows,len(source)))):
   im=Image.open(folder/(f'page-{idx+1:03}.webp'));im.thumbnail((thumbw,thumbh));x=(j%cols)*(thumbw+12)+(thumbw-im.width)//2;y=(j//cols)*(thumbh+28);sheet.paste(im,(x,y));draw.text((x+3,y+thumbh+4),str(idx+1),fill=(20,50,40))
  sheet.save(QA/(book['id']+'-sheet-'+str(start//30+1)+'.jpg'),quality=85)
 BOOKS.append({'id':book['id'],'title':book['title'],'titleEn':book['titleEn'],'description':book['desc'],'sourceLabel':book['publisher'],'pdf':'books/'+book['id']+'.pdf','pageCount':len(source),'slides':slides,'note':'المادة من ملف مرفوع؛ تتضمن صيغ دعاء عامة ونصوصًا منقولة. لم يُجرَ تخريج مستقل. الأعداد الاختيارية في الرقية ليست حكمًا بأن لها فضلًا ثابتًا.','noteEn':'Arabic original supplied by the site owner. Original pages and visible credits are preserved; Sakinah does not claim authorship or independent religious authentication.'})
 print(book['id'],len(source),'slides',outfile.stat().st_size,'bytes')
if BOOKS: (SITE/'books.json').write_text(json.dumps(BOOKS,ensure_ascii=False,indent=2),encoding='utf8')
print('TOTAL',sum(len(x['slides']) for x in BOOKS),'slides')
# Additional ready-to-download editions from the site's own referenced library.
node_code="const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('data.js','utf8')+';globalThis.exported=LIBRARY;',c);process.stdout.write(JSON.stringify(c.exported));"
entries=json.loads(subprocess.check_output(['node','-e',node_code],cwd=SITE).decode('utf8'))
quran=json.loads((SITE/'quran-source.json').read_text(encoding='utf-8-sig'))['data']['surahs']
for entry in entries:
 if entry.get('qref'):
  surah,first,last=entry['qref'];entry['text']=' '.join(a['text']+' ﴿'+str(a['numberInSurah'])+'﴾' for a in quran[surah-1]['ayahs'] if first<=a['numberInSurah']<=last)
section_titles={'athkar':'الأذكار اليومية','duas':'الأدعية','ruqyah':'آيات وأدعية الرقية','salawat':'الصلاة على النبي','praise':'التسبيح والحمد والشكر','humility':'الرجاء والتذلل لله'}
category_slugs={'الصباح':'morning','المساء':'evening','النوم':'sleep','الاستيقاظ':'waking','بعد الصلاة':'after-prayer','أذكار اليوم':'daily'}
exports={}
for section,title in section_titles.items():
 selected=[e for e in entries if e['section']==section]
 if section=='humility': selected=[e for e in entries if e['id'] in ['d2','d3','d4','d5','d14','d17','d20','d23','d27','d28','d29','d34','d38']]
 categories=['الكل']+list(dict.fromkeys(e['category'] for e in selected))
 for cindex,category in enumerate(categories):
  chosen=[e for e in selected if category=='الكل' or e['category']==category]
  if not chosen: continue
  key=section+'|'+category;name=section+'-'+('all' if category=='الكل' else category_slugs.get(category,str(cindex)))
  export_title=title if category=='الكل' else (('أذكار '+category) if section=='athkar' else category)
  export_book={'id':name,'title':export_title,'titleEn':'Sakinah - Arabic reading edition','publisher':'مجموعة للقراءة من القرآن والأذكار والأدعية، مع المرجع المبين بجوار كل نص. لا يمثل هذا الجمع تخريجًا مستقلًا أو اعتمادًا فقهيًا.','compiled':True}
  document=fitz.open(stream=cover_pdf(export_book,len(chosen)),filetype='pdf')
  for index,entry in enumerate(chosen):
   frame_doc=fitz.open(stream=PdfWriter()._header if False else b'',filetype='pdf') if False else None
   frame=branded_frame(index+1,len(chosen));temp=PdfWriter();temp.add_page(frame);mem=io.BytesIO();temp.write(mem);fd=fitz.open(stream=mem.getvalue(),filetype='pdf');document.insert_pdf(fd);page=document[-1]
   goal=entry.get('repeat',1)
   repeat_note=('العدد الوارد في المرجع: '+str(goal)) if goal>1 else 'القراءة مرة واحدة للمتابعة؛ لا يفهم منها تخصيص عدد تعبدي.'
   reference_display=entry['reference']
   if entry.get('qref'):
    rs,ra,rb=entry['qref'];reference_display='القرآن الكريم، '+quran[rs-1]['name']+'، '+('الآية '+str(ra) if ra==rb else 'الآيات من '+str(ra)+' إلى '+str(rb))
    if 'عدد التكرار' in entry['reference']: reference_display+='؛ '+entry['reference'].split('•')[-1].strip()
   reference_html=html.escape(reference_display)
   content=f'''<div style="direction:rtl;text-align:right;font-family:book;color:#173f35"><div style="font-size:13px;color:#ad925c">{html.escape(export_title)} · النص {index+1} من {len(chosen)}</div><h1 style="font-size:27px;font-weight:normal;margin:18px 0 28px">{html.escape(entry['title'])}</h1><div style="font-size:24px;line-height:1.9">{html.escape(entry['text'])}</div><div style="margin-top:25px;padding-top:13px;border-top:1px solid #ded6c3;font-size:14px;color:#78806f">{reference_html}<br>{html.escape(repeat_note)}</div></div>'''
   css="@font-face{font-family:book;src:url(trado.ttf)}body{margin:0;padding:0}"
   spare,scale=page.insert_htmlbox(fitz.Rect(54,70,A4[0]-54,A4[1]-75),content,css=css,archive=fitz.Archive('C:/Windows/Fonts'))
   if scale<.55: print('WARN SMALL TEXT',name,entry['id'],scale)
  if any(e.get('qref') for e in chosen):
   page=document.new_page(width=A4[0],height=A4[1]);license_text=(SITE/'QURAN-LICENSE.txt').read_text(encoding='utf-8-sig')
   content='<h2>Quran text attribution and license</h2><pre style="white-space:pre-wrap;font-size:10px;line-height:1.6">'+html.escape(license_text)+'</pre>'
   page.insert_htmlbox(fitz.Rect(45,55,A4[0]-45,A4[1]-55),content)
  document.set_metadata({'title':export_title+' | Sakinah','author':'','subject':'Referenced Arabic texts for reading; no independent religious authentication','creator':'Sakinah reading library'})
  document.subset_fonts();path=OUT/(name+'.pdf');document.save(path,garbage=4,deflate=True,use_objstms=1);exports[key]='books/'+path.name
  if section in ['athkar','ruqyah','duas','salawat','praise'] and category=='الكل':
   document[1].get_pixmap(matrix=fitz.Matrix(1,1)).save(str(QA/(name+'-sample.png')))
  print('EXPORT',key,len(document),path.stat().st_size)
(SITE/'exports.json').write_text(json.dumps(exports,ensure_ascii=False,indent=2),encoding='utf8')
print('EXPORT FILES',len(exports))

# Remove render intermediates from the public site after inspection/build by default.
if '--keep-qa' not in sys.argv:
 import shutil
 assert OUT.resolve() in QA.resolve().parents
 if QA.exists(): shutil.rmtree(QA)

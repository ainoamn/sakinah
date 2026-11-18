"""Typeset the requested public-domain reading editions in the same local Hafs Unicode font."""
from pathlib import Path
import json,html,io,sys,hashlib
import fitz
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'public/site';TMP=ROOT/'tmp/book-editions';TMP.mkdir(parents=True,exist_ok=True)
font=TTFont(SITE/'assets/uthmanic-hafs.woff2');font.flavor=None;font.save(TMP/'hafs.ttf')
(TMP/'logo.png').write_bytes((SITE/'assets/sakinah-emblem.png').read_bytes())
A4=fitz.Rect(0,0,595.276,841.89)
CSS="@font-face{font-family:hafs;src:url(hafs.ttf)} body{font-family:hafs;direction:rtl;text-align:right;margin:0;color:#173f35} p{font-size:21px;line-height:1.95;margin:0 0 16px} h1{font-size:30px;line-height:1.6;color:#846e3d;font-weight:normal;margin:0 0 24px} h2{font-size:24px;line-height:1.7;font-weight:normal;margin:15px 0 18px;color:#846e3d} .note{font-size:13px;line-height:1.8;color:#687466}"
def typeset(markup,rect=fitz.Rect(48,96,547,768)):
 story=fitz.Story(markup,user_css=CSS,archive=fitz.Archive(str(TMP)))
 def rectangle(n,filled):return A4,rect,None
 return story.write_with_links(rectangle)
def decorate(doc,title,offset=0):
 for i,p in enumerate(doc):
  p.draw_rect(A4,color=None,fill=(.997,.992,.968),overlay=False)
  for inset in [16,22]:p.draw_rect(A4+(-inset,-inset,inset,inset) if False else fitz.Rect(inset,inset,A4.width-inset,A4.height-inset),color=(.68,.57,.35),width=.6)
  p.draw_line((37,78),(558,78),color=(.68,.57,.35),width=.5);p.draw_line((37,783),(558,783),color=(.68,.57,.35),width=.5)
  p.insert_image(fitz.Rect(518,29,550,67),filename=str(TMP/'logo.png'),keep_proportion=True)
  p.insert_htmlbox(fitz.Rect(45,34,498,75),'<div style="font-family:hafs;font-size:16px;direction:rtl;color:#846e3d">'+html.escape(title)+'</div>',css=CSS,archive=fitz.Archive(str(TMP)))
  p.insert_text((285,807),str(i+1+offset),fontname='helv',fontsize=11,color=(.52,.44,.24))
  p.insert_text((39,807),'SAKINAH  |  s.bhd-om.com',fontname='helv',fontsize=7,color=(.45,.49,.43))
def cover(book):
 markup='<div style="text-align:center"><img src="logo.png" width="105" height="120"><p style="color:#ad925c;font-size:17px">مَكْتَبَةُ سَكِينَة</p><h1 style="font-size:38px;margin:35px 0">'+html.escape(book['title'])+'</h1><p>إِصْدَارُ قِرَاءَةٍ بِخَطِّ حَفْصٍ</p><p class="note">'+html.escape(book['sourceLabel'])+'</p><p class="note">التنسيق والغلاف من سكينة. النصوص لأصحابها ومصادرها، ولا تعني هوية الإصدار نسبة التأليف إلى الموقع أو اعتمادًا شرعيًا مستقلًا.</p>'
 if book.get('sourceURL'):markup+='<p class="note"><a href="'+html.escape(book['sourceURL'],quote=True)+'">المصدر الأصلي — قناة الدعاء</a></p>'
 markup+='</div>'
 d=typeset(markup,fitz.Rect(55,95,540,763));assert len(d)==1,(book['id'],len(d));decorate(d,book['title']);return d
def create(book):
 content=''.join('<h2>'+html.escape(s['title'])+'</h2>'+''.join('<p>'+html.escape(p)+'</p>' for p in s['text'].split('\n') if p.strip()) for s in book['slides'])
 body=typeset(content);decorate(body,book['title']);doc=cover(book);doc.insert_pdf(body);
 if any(s.get('review',{}).get('quranReferences') for s in book['slides']):
  license_doc=typeset('<h2>Quran text attribution and license</h2><p style="font-family:serif;font-size:11px;direction:ltr;line-height:1.5">'+html.escape((SITE/'QURAN-LICENSE.txt').read_text(encoding='utf-8-sig')).replace('\n','<br>')+'</p>');decorate(license_doc,book['title']);doc.insert_pdf(license_doc)
 doc.set_metadata({'title':book['title']+' | سكينة','author':book.get('author',''),'subject':'Arabic reading edition; source wording and attribution retained','creator':'Sakinah reading library'})
 doc.subset_fonts();path=SITE/book['pdf'];path.parent.mkdir(parents=True,exist_ok=True);doc.save(path,garbage=4,deflate=True,use_objstms=1);return len(doc)
if __name__=='__main__':
 books=json.loads((SITE/'prayer-library.json').read_text(encoding='utf-8'))
 if '--originals' in sys.argv:
  books=json.loads((SITE/'original-text-books.json').read_text(encoding='utf-8'))
 for i,b in enumerate(books):
  pages=create(b)
  if (i+1)%10==0 or i==len(books)-1:print('PDF',i+1,'/',len(books),b['id'],pages,flush=True)
 if '--originals' not in sys.argv:
  for category,title in [('duas','الصحيفة السجادية — الأدعية'),('munajat','المناجيات')]:
   group={'id':'collection-'+category,'title':title,'sourceLabel':'مجموعة نصوص مأثورة من المصادر المبينة مع كل دعاء، نُقلت بألفاظها وضبطها كما وردت؛ هوية الإخراج من سكينة دون نسبة التأليف إليها.','sourceURL':'https://duachannel.com/'+('الصحیفة-السجادیة/' if category=='duas' else 'المناجات/'),'pdf':'books/devotional/'+category+'-complete.pdf'}
   combined=cover(group)
   for b in books:
    if b['category']==category:
     doc=fitz.open(SITE/b['pdf']);combined.insert_pdf(doc,from_page=1)
   combined.set_metadata({'title':title+' | سكينة','creator':'Sakinah reading library'});combined.subset_fonts();combined.save(SITE/group['pdf'],garbage=4,deflate=True,use_objstms=1);print('COLLECTION',category,len(combined),flush=True)

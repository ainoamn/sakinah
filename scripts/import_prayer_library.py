"""Import public-domain devotional texts requested by the owner. Keep source wording and vocalization; omit modern page introductions, audio and site chrome."""
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,quote
import urllib.request,concurrent.futures,json,re,hashlib,time
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/'public/site';CACHE=ROOT.parent/'source-cache-duachannel';CACHE.mkdir(exist_ok=True)
HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml','Accept-Language':'ar,en;q=0.8'}
def fetch(url,key):
 file=CACHE/(key+'.html')
 if file.exists():return file.read_text(encoding='utf-8')
 u=urlsplit(url);encoded=urlunsplit((u.scheme,u.netloc,quote(u.path,safe='/%'),u.query,''))
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(encoded,headers=HEADERS),timeout=50) as r:raw=r.read().decode('utf-8')
   file.write_text(raw,encoding='utf-8');return raw
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def clean(el):
 # These remove embedded media only, never devotional text.
 for node in el.select('script,style,audio,video,iframe,.mejs-container'):node.decompose()
 for a in el.select('a'):
  if '.mp3' in a.get('href','') or '.mp3' in a.get_text():a.decompose()
 text=el.get_text('\n',strip=True).replace('\xa0',' ')
 text='\n'.join(re.sub(r'[ \t]+',' ',line).strip() for line in text.splitlines())
 return re.sub(r'\n{3,}','\n\n',text).strip()
index='https://duachannel.com/الصحیفة-السجادیة/'
soup=BeautifulSoup(fetch(index,'sahifa-index'),'html.parser');links=[(i+1,a.get_text(' ',strip=True),a['href']) for i,a in enumerate(soup.select('.elementor-post__title a'))];assert len(links)==54,len(links)
def prayer(item):
 n,title,url=item;soup=BeautifulSoup(fetch(url,'sahifa-'+str(n)),'html.parser');main=soup.select_one('[data-elementor-type="wp-post"]') or soup;editors=main.select('.elementor-widget-text-editor');assert editors,(n,url)
 text='\n\n'.join(clean(e) for e in editors if not any(c in e.get('class',[]) for c in []));assert len(text)>80,(n,len(text));assert 'تردد قناة' not in text
 return {'id':'sahifa-'+str(n),'title':title,'titleEn':'Al-Sahifa al-Sajjadiyya · '+str(n),'category':'duas','textEdition':True,'author':'منسوب إلى علي بن الحسين زين العابدين','sourceURL':url,'sourceLabel':'من نصوص الصحيفة السجادية المنسوبة إلى علي بن الحسين؛ نُقل النص والتشكيل كما وردا لدى قناة الدعاء، دون ادعاء اعتماد فقهي أو تغيير نسبته.','pdf':'books/devotional/sahifa-'+str(n)+'.pdf','slides':[{'title':title,'text':text,'reference':'الصحيفة السجادية · الدعاء '+str(n),'sourceURL':url,'sourceHash':hashlib.sha256(text.encode()).hexdigest()}]}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:books=list(pool.map(prayer,links))
url='https://duachannel.com/المناجات/';soup=BeautifulSoup(fetch(url,'munajat'),'html.parser');titles=soup.select('.elementor-tab-title');texts=soup.select('.elementor-tab-content');assert len(titles)==len(texts)==15
for n,(title,content) in enumerate(zip(titles,texts),1):
 anchor=title.get('id');title=title.get_text(' ',strip=True);text=clean(content);assert len(text)>300;books.append({'id':'munajat-'+str(n),'title':title,'titleEn':'Intimate prayer · '+str(n),'category':'munajat','textEdition':True,'sourceURL':url+('#'+anchor if anchor else ''),'sourceLabel':'من المناجيات المأثورة المنسوبة إلى علي بن الحسين، كما أوردتها قناة الدعاء؛ حُفظت الألفاظ والتشكيل ونسبة المصدر.','pdf':'books/devotional/munajat-'+str(n)+'.pdf','slides':[{'title':title,'text':text,'reference':'المناجيات · '+title,'sourceURL':url,'sourceHash':hashlib.sha256(text.encode()).hexdigest()}]})
assert len(books)==69
(SITE/'prayer-library.json').write_text(json.dumps(books,ensure_ascii=False,indent=2),encoding='utf-8')
print('Imported',len(books),'books;',sum(len(b['slides'][0]['text']) for b in books),'characters; source wording and diacritics preserved.')

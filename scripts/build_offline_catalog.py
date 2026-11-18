import json,urllib.request,concurrent.futures,time
from pathlib import Path
site=Path('public/site')
groups={
 'quran': ['quran-source.json','quran-layout.json','assets/uthmanic-hafs.woff2'],
 'dhikr': ['data.js','books-text.json'],
 'tafsir': ['tafsir-source.json'],
 'books': []}
books=json.loads((site/'books.json').read_text(encoding='utf-8'))
paths=set()
for b in books:
 paths.add(b['pdf'])
 for s in b['slides']:
  if s.get('image'):paths.add(s['image'])
def walk(v):
 if isinstance(v,str) and v.endswith('.pdf'):paths.add(v)
 elif isinstance(v,dict):
  for x in v.values():walk(x)
 elif isinstance(v,list):
  for x in v:walk(x)
walk(json.loads((site/'exports.json').read_text(encoding='utf-8')))
groups['books']=sorted(paths)
remote=[(k,f'https://verses.quran.foundation/fonts/quran/hafs/{v}/woff2/p{p}.woff2') for k,v in [('hafs','v2'),('tajweed','v4/colrv1')] for p in range(1,605)]
def size(item):
 k,u=item
 for retry in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(u,method='HEAD'),timeout=40) as r:
    n=int(r.headers.get('Content-Length','0'))
   if not n:
    with urllib.request.urlopen(u,timeout=40) as r:n=len(r.read())
   return k,{'url':u,'bytes':n}
  except Exception:
   if retry==2:raise
out={k:[{'url':p,'bytes':(site/p).stat().st_size if (site/p).exists() else 0} for p in ps] for k,ps in groups.items()}
out.update(hafs=[],tajweed=[])
with concurrent.futures.ThreadPoolExecutor(max_workers=18) as pool:
 for i,(k,v) in enumerate(pool.map(size,remote)):
  out[k].append(v)
  if (i+1)%200==0: print('Measured',i+1,flush=True)
(site/'offline-catalog.json').write_text(json.dumps({'version':1,'groups':out},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print({k:sum(x['bytes'] for x in v) for k,v in out.items()},flush=True)

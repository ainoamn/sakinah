import urllib.request,urllib.error,http.cookiejar,json
base='http://127.0.0.1:5173'
def req(path,body=None,opener=None,origin=base):
 data=json.dumps(body).encode() if body is not None else None
 r=urllib.request.Request(base+path,data=data,headers={'Content-Type':'application/json','Origin':origin})
 try:
  with (opener.open(r) if opener else urllib.request.urlopen(r)) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as e:
  raw=e.read()
  try: parsed=json.loads(raw)
  except: parsed={}
  return e.code,parsed
assert req('/api/account')[1]['user'] is None
assert req('/api/account',{'kind':'page','eventId':'testanonymous','payload':{'page':1}})[0]==401
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.open(base+'/signin-with-chatgpt?return_to=%2Fsite%2Findex.html').read()
status,state=req('/api/account',opener=opener);assert status==200 and state['user']['id']=='local_seedy'
assert req('/api/account',{'kind':'settings','settings':{'pages':605}},opener)[0]==400
assert req('/api/account',{'kind':'settings','settings':{'pages':3}},opener,origin='https://example.net')[0]==403
body={'kind':'page','eventId':'test-idempotency-20261117','payload':{'page':603}}
assert req('/api/account',body,opener)[0]==200
assert req('/api/account',body,opener)[0]==200
_,state=req('/api/account',opener=opener);assert len([e for e in state['events'] if e['kind']=='page' and e['payload'].get('page')==603])==1
assert req('/api/account',{'kind':'dhikr','eventId':'invalid-count-case','payload':{'count':-1}},opener)[0]==400
print('PASS: anonymous access boundary, authenticated persistence, invalid-input rejection, cross-origin rejection, event idempotency.')


# Reading progress sync is private and rejects stale offline writes.
import time
stamp=int(time.time()*1000)
entry={'key':'tasbih','value':51,'updatedAt':stamp}
assert req('/api/account',{'kind':'progress','entry':entry})[0]==401
assert req('/api/account',{'kind':'progress','entry':entry},opener,origin='https://example.net')[0]==403
assert req('/api/account',{'kind':'progress','entry':{'key':'unknown','value':1,'updatedAt':stamp}},opener)[0]==400
status,data=req('/api/account',{'kind':'progress','entry':entry},opener)
assert status==200,(status,data)
assert data['entry']['value']==51
assert req('/api/account',{'kind':'progress','entry':{'key':'tasbih','value':3,'updatedAt':stamp-1000}},opener)[1]['entry']['value']==51
assert req('/api/account',{'kind':'settings','settings':{'pages':4}},opener)[0]==200
assert req('/api/account',opener=opener)[1]['settings']['progress']['tasbih']['value']==51
assert req('/api/account',{'kind':'progress','entry':{'key':'counts','value':{'a1':2,'a2':9},'updatedAt':stamp}},opener)[0]==200
assert req('/api/account',opener=opener)[1]['settings']['pages']==4
assert req('/api/account',{'kind':'progress','entry':{'key':'counts','value':{'a1':-1},'updatedAt':stamp}},opener)[0]==400
print('PASS: account-only progress sync, CSRF, key/value validation, stale-update rejection and atomic settings preservation.')

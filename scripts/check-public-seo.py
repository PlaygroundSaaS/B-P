"""Check rendered public metadata and private noindex without submitting forms."""
import sys,json,urllib.request,urllib.error,concurrent.futures
from html.parser import HTMLParser
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:3106'
CANON='https://www.bramblesandpetals.co.uk'
paths=['/','/weddings','/funerals','/corporate','/flowers','/our-studio','/client-studio','/contact','/privacy']
class Page(HTMLParser):
 def __init__(self):super().__init__();self.meta={};self.links=[];self.h1=0;self.title='';self.in_title=False;self.in_json=False;self.json='';self.schemas=[];self.images=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if tag=='link':self.links.append(a)
  if tag=='h1':self.h1+=1
  if tag=='title':self.in_title=True
  if tag=='img':self.images.append(a)
  if tag=='script' and a.get('type')=='application/ld+json':self.in_json=True;self.json=''
 def handle_data(self,data):
  if self.in_title:self.title+=data
  if self.in_json:self.json+=data
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag=='script' and self.in_json:self.schemas.append(json.loads(self.json));self.in_json=False

def check(path):
 r=urllib.request.urlopen(urllib.request.Request(BASE+path,headers={'User-Agent':'Googlebot'}));p=Page();p.feed(r.read().decode());assert r.status==200
 assert p.title and p.meta.get('description'),path
 assert p.h1==1,(path,p.h1)
 assert 'noindex' not in p.meta.get('robots',''),path
 assert [l['href'].rstrip('/') for l in p.links if l.get('rel')=='canonical']==[(CANON+path).rstrip('/')],path
 assert p.meta.get('og:title')==p.title,path
 assert p.meta.get('og:url','').rstrip('/')==(CANON+path).rstrip('/'),path
 assert p.meta.get('twitter:card')=='summary_large_image',path
 assert all('alt' in image for image in p.images),path
 assert any('@graph' in s for s in p.schemas),path
 if path in ['/weddings','/funerals','/corporate','/flowers']:
  assert any(s.get('@type')=='Service' for s in p.schemas),path
  assert any(s.get('@type')=='BreadcrumbList' for s in p.schemas),path
 return {'path':path,'title':p.title,'description':p.meta['description'],'schemaBlocks':len(p.schemas)}
results=list(concurrent.futures.ThreadPoolExecutor(5).map(check,paths))
assert len({r['title'] for r in results})==len(paths)
assert len({r['description'] for r in results})==len(paths)
for path in ['/studio','/client','/review']:
 p=Page();p.feed(urllib.request.urlopen(BASE+path).read().decode());assert 'noindex' in p.meta.get('robots',''),path
try:urllib.request.urlopen(BASE+'/not-a-real-seo-page');raise AssertionError('Missing page did not return 404')
except urllib.error.HTTPError as error:assert error.code==404
print(json.dumps({'passed':True,'publicPages':results,'privateNoindex':['/studio','/client','/review'],'notFound':404},indent=2))

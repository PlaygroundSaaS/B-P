"""Import public catalogue names and image references; never prices or account data."""
import json, re, html, urllib.request, urllib.parse
from pathlib import Path
from datetime import date
BASE = 'https://shop.flowervisionsouthampton.co.uk'
def fetch(path, pairs):
    url = BASE + path + '?' + urllib.parse.urlencode(pairs)
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)
params = [('itemCount', 12), ('Voorcod', '1'), ('Partijnr', 'ALL___')]
section = fetch('/Voorraad/Section/items', params)
count = section['FragmentCount']
if not 0 < count < 500: raise RuntimeError('Unexpected catalogue size')
items = {}
listings = 0
for start in range(0, count, 6):
    fragments = fetch('/Voorraad/Section/items/Fragments', [('ids', i) for i in range(start, min(start+6,count))] + params)
    for fragment in fragments:
        for card in re.findall(r'<li\b[^>]*id="P\d+"[^>]*>(.*?)</li>', fragment['View'], re.S):
            title = re.search(r'<a\b[^>]*class="title\s*"[^>]*>(.*?)</a>', card, re.S)
            if not title: raise RuntimeError('Missing product name')
            name = html.unescape(re.sub('<[^>]+>', '', title[1])).strip()
            image = re.search(r'<img\b[^>]*class="foto[^\"]*"[^>]*src="([^\"]+)"', card)
            colour = re.search(r'>Colour</td>\s*<td[^>]*>(.*?)</td>', card, re.S)
            colour = html.unescape(re.sub('<[^>]+>', '', colour[1])).strip() if colour else ''
            url = html.unescape(image[1]) if image else ''
            if url and not url.startswith(BASE + '/pictures/'): url = ''
            if colour == '-': colour = ''
            listings += 1
            items.setdefault(name.casefold(), {'name': name, 'colour': colour, 'imageUrl': url})
if listings < 100: raise RuntimeError('Incomplete catalogue')
result={'source':BASE+'/Voorraad/1/ALL___','importedAt':str(date.today()),'listings':listings,'flowers':sorted(items.values(),key=lambda x:x['name'].casefold())}
Path('lib/flowervision-catalogue.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'{listings} listings, {len(items)} unique names, {sum(bool(x["imageUrl"]) for x in items.values())} image references')

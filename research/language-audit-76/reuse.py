from prepare import *
translations={}
def text(n):
 if n.get('type')=='StringLiteral':return n['value']
 if n.get('type')=='TemplateLiteral':return ''.join(q['value'].get('cooked',q['value']['raw'])+(f'{{{i}}}' if i<len(n['expressions']) else '') for i,q in enumerate(n['quasis']))
 return None
def props(n):return {p.get('key',{}).get('name',p.get('key',{}).get('value')):p.get('value',{}) for p in n.get('properties',[]) if p.get('type')=='ObjectProperty'}
def pair(z,e,j):
 if z.get('type')==e.get('type')==j.get('type')=='ObjectExpression':
  a,b,c=props(z),props(e),props(j)
  for k in a.keys()&b.keys()&c.keys():pair(a[k],b[k],c[k])
 elif z.get('type')==e.get('type')==j.get('type')=='ArrayExpression':
  for a,b,c in zip(z['elements'],e['elements'],j['elements']):pair(a,b,c)
 else:
  a,b,c=text(z),text(e),text(j)
  if all(v is not None for v in [a,b,c]) and CJK.search(a):translations[a.strip()]=[b.strip(),c.strip()]
for p in work.glob('*.ast.json'):
 ast=json.loads(p.read_text())
 for n,path in walk(ast):
  if n.get('type')=='ObjectExpression':
   p=props(n)
   if {'zh','en','ja'}<=p.keys():pair(p['zh'],p['en'],p['ja'])
  if n.get('type')=='CallExpression' and n.get('callee',{}).get('name')=='calendarUi' and len(n.get('arguments',[]))>=3:
   a,b,c=n['arguments'][:3];pair(a,b,c)
class Reuse(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.stack=[]
 def handle_starttag(self,t,a):
  if t not in void:self.stack.append((t,dict(a)))
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==t:self.stack=self.stack[:i];return
 def handle_data(self,d):
  if self.stack:
   a=self.stack[-1][1]
   if d.strip() and 'data-ui-en' in a and 'data-ui-ja' in a:translations[d.strip()]=[a['data-ui-en'],a['data-ui-ja']]
for p in base.glob('*.html'):Reuse().feed(p.read_text())
# Canonical source keys, reuse existing reviewed locale pairs.
canonical={}
for key,files in keys.items():canonical.setdefault(key.strip(),set()).update(files)
(work/'canonical.json').write_text(json.dumps({k:sorted(v) for k,v in canonical.items()},ensure_ascii=False,indent=2)+'\n')
(work/'reused.json').write_text(json.dumps(translations,ensure_ascii=False,indent=2)+'\n')
missing=[k for k in canonical if k not in translations]
(work/'missing.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2)+'\n')
print('Canonical:',len(canonical),'Reused:',sum(k in translations for k in canonical),'Remaining:',len(missing))

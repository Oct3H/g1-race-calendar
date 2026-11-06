from prepare import *
import html
catalog=json.loads((work/'reused.json').read_text())
# Collect UI-owned text units, including dynamic placeholders, but not data-name bodies.
def candidate(key,file):return bool((CJK.search(key) or re.search(r'\{\d+\}',key)) and key.strip() not in protected_values)
import prepare
prepare.add=candidate
protected_ids.discard('horse-current-odds')
prepare.protected_ids.discard('horse-current-odds')
# Attribute explanations on a horse-name button are UI; only its actual name text is data.
original_start=Units.handle_starttag
def start(self,tag,attrs):
 a=dict(attrs);blocked=any(t in {'script','style'} or {'grade-badge','surface-badge','header-caption'}.intersection(x.get('class','').split()) for t,x in self.stack)
 if not blocked:
  raw=self.get_starttag_text();off=self.position()
  for m in re.finditer(r'\b(aria-label|title|placeholder|alt)=("|\')(.*?)\2',raw,re.S):
   if candidate(m[3],self.file):self.units.append((off+m.start(3),off+m.end(3),m[3],'attr'))
 if tag not in void:self.stack.append((tag,a))
Units.handle_starttag=start
q=lambda x:json.dumps(x,ensure_ascii=False)
slot=re.compile(r'\{(\d+)\}')
def children(n):
 for k,v in n.items():
  if k in {'loc','extra','leadingComments','trailingComments','innerComments'}:continue
  if isinstance(v,dict) and 'type'in v and 'start'in v:yield v
  elif isinstance(v,list):
   for x in v:
    if isinstance(x,dict) and 'type'in x and 'start'in x:yield x

def compile_js(name):
 source=(base/name).read_text()
 if name in {'settings.js','welcome.js'}:
  (design/name).write_text(source);return 0
 ast=json.loads((work/(name+'.ast.json')).read_text());changes=[]
 def raw(n):return source[n['start']:n['end']]
 def text_data(n):
  v=raw(n)
  return bool(re.fullmatch(r'[\w.$\[\]\'"-]*(?:\.name|\.horseName|\.course)',v) or any(x in v for x in ['sampleHorseNames[','samplePastRaces[']))
 def get_id(n):
  v=raw(n);m=re.search(r"getElementById\(['\"]([^'\"]+)",v);return m[1] if m else None
 def code_with(n,edits):
  value=raw(n)
  for a,b,c in sorted(edits,reverse=True):value=value[:a-n['start']]+c+value[b-n['start']:]
  return value
 def markup(n,expressions):
  if n['type']=='StringLiteral':pattern=n['value'];exprs={}
  else:
   pattern=''.join(t['value'].get('cooked',t['value']['raw'])+(f'{{{i}}}'if i<len(expressions)else'') for i,t in enumerate(n['quasis']));exprs=dict(enumerate(expressions))
  parser=Units(pattern,name);parser.feed(pattern)
  segments=[];pos=0
  def plain(s):
   prev=0
   for m in slot.finditer(s):
    if m.start()>prev:segments.append(q(s[prev:m.start()]))
    segments.append('String('+exprs[int(m[1])]+')');prev=m.end()
   if prev<len(s):segments.append(q(s[prev:]))
  for unit in sorted(parser.units):
   a,b,key,*kind=unit
   if a<pos:continue
   plain(pattern[pos:a])
   refs=slot.findall(key)
   if re.fullmatch(r'\{\d+\}',key.strip()):
    i=int(refs[0]);match=slot.search(key);plain(key[:match.start()]);segments.append('uiText('+exprs[i]+')');plain(key[match.end():])
   else:
    vals='{'+', '.join(str(i)+': '+exprs[int(i)] for i in dict.fromkeys(refs))+'}' if refs else 'null'
    segments.append(('uiAttr'if kind else'uiText')+'('+q(key)+', '+vals+')')
   pos=b
  plain(pattern[pos:])
  return '['+', '.join(segments)+"].join('')" if parser.units else None
 def rec(n):
  childedits=[];childvalues={}
  for child in children(n):
   v=rec(child);childvalues[(child['start'],child['end'])]=v
   if v!=raw(child):childedits.append((child['start'],child['end'],v))
  value=code_with(n,childedits);typ=n['type']
  if typ in {'StringLiteral','TemplateLiteral'}:
   pattern=n['value'] if typ=='StringLiteral' else ''.join(t['value'].get('cooked',t['value']['raw']) for t in n['quasis'])
   if re.search(r'<[a-zA-Z][\s\w:-]*[\s>]',pattern) or (pattern.startswith('<') and '>'in pattern):
    exprs=[childvalues.get((x['start'],x['end']),raw(x)) for x in n.get('expressions',[])]
    changed=markup(n,exprs)
    if changed is not None:changes.append((n['start'],'html-template'));return changed
  if typ=='AssignmentExpression' and n.get('operator') in {'=','+='}:
   left=n['left'];prop=left.get('property',{}).get('name',left.get('property',{}).get('value'))
   if left.get('type') in {'MemberExpression','OptionalMemberExpression'} and prop in {'textContent','title','alt','placeholder'} and get_id(left)not in protected_ids and not text_data(n['right']):
    right=n['right'];rv=childvalues.get((right['start'],right['end']),raw(right))
    if right['type']=='TemplateLiteral' and '<'not in ''.join(t['value']['raw']for t in right['quasis']):
     key=''.join(t['value'].get('cooked',t['value']['raw'])+(f'{{{i}}}'if i<len(right['expressions'])else'')for i,t in enumerate(right['quasis']))
     vals='{'+', '.join(str(i)+': '+rec(e)for i,e in enumerate(right['expressions']))+'}'
     replacement='uiText('+q(key)+', '+vals+')'
    else:replacement='uiText('+rv+')'
    value=code_with(n,[x for x in childedits if x[:2]!=(right['start'],right['end'])]+[(right['start'],right['end'],replacement)]);changes.append((n['start'],'text-sink'))
  if typ=='CallExpression':
   callee=n['callee'];args=n.get('arguments',[]);index=None
   if callee.get('type')=='MemberExpression' and callee.get('property',{}).get('name') in {'setAttribute','setCustomValidity'}:
    if callee['property']['name']=='setCustomValidity':index=0
    elif len(args)>1 and args[0].get('value') in {'aria-label','title','placeholder','alt'}:index=1
   if callee.get('name') in {'announce','feedback','sourceLink'} and args:index=0
   if callee.get('name')=='element' and len(args)>2:index=2
   if index is not None and len(args)>index:
    target=args[index];tv=childvalues.get((target['start'],target['end']),raw(target))
    if target['type']=='TemplateLiteral':
     key=''.join(t['value'].get('cooked',t['value']['raw'])+(f'{{{i}}}'if i<len(target['expressions'])else'')for i,t in enumerate(target['quasis']))
     vals='{'+', '.join(str(i)+': '+rec(e)for i,e in enumerate(target['expressions']))+'}'
     replacement='uiText('+q(key)+', '+vals+')'
    else:replacement='uiText('+tv+')'
    value=code_with(n,[x for x in childedits if x[:2]!=(target['start'],target['end'])]+[(target['start'],target['end'],replacement)]);changes.append((n['start'],'ui-attribute-or-notice'))
  return value
 output=rec(ast)
 if name=='design.js':output=output.replace('const gradeLabels =',"registerUiNames([...races.flatMap(race => [race.name, race.course]), ...samplePastRaceDetails.map(race => race.course), ...importanceSamples.map(race => race.name), ...Object.values(sampleHorseNames).flat(), ...Object.values(samplePastRaces).flat()]);\nconst gradeLabels =",1)
 if name=='game-design.js':output=output.replace("  const refundPreview =", "  registerUiNames([...races.map(race => race.name), ...Object.values(horseNames).flat()]);\n  const refundPreview =",1)
 output=re.sub(r"(from ['\"]\./[^'\"]+\.(?:js|mjs))\?v=\d+",r'\1?v=76',output)
 if name=='design.js':output=output.replace("missing.join('、')","uiList(missing, '、')").replace("missing.join('；')","uiList(missing, '；')")
 if name=='game-design.js':output=output.replace("missing.join(' · ')","uiList(missing, ' · ')")
 if name=='first-collection-preview.mjs':output=output.replace("const loadingSummary = '赛程尚未取得 · 本月场数待确认';","const loadingSummary = uiText('赛程尚未取得 · 本月场数待确认');")
 if name=='density-2025.js':output=output.replace("dataset = await response.json();","dataset = await response.json();\n  registerUiNames(dataset.races.flatMap(race => [race.name, race.canonical_name]));")
 if name=='cache-design.js':output=output.replace("detail += offline ? ' · 等待联网' : ' · 正在补齐';", "detail = uiList([detail, offline ? ' · 等待联网' : ' · 正在补齐'], '');")
 if name=='preview-navigation.mjs':output=output.replace("v: '74'","v: '76'")
 if changes:
  symbols=[x for x in ['uiText','uiAttr','uiList','registerUiNames'] if re.search(r'\b'+x+r'\(',output)]
  output="import { "+', '.join(symbols)+" } from './ui-language.mjs?v=76';\n"+output
 (design/name).write_text(output)
 return len(changes)

class Static(HTMLParser):
 def __init__(self,source,name):
  super().__init__(convert_charrefs=True);self.source=source;self.name=name;self.stack=[];self.nodes=[];self.lines=[0]
  for m in re.finditer('\n',source):self.lines.append(m.end())
 def pos(self):a,b=self.getpos();return self.lines[a-1]+b
 def blocked(self):return any(n['tag']in{'script','style'} or n['attrs'].get('id')in protected_ids or protected_classes.intersection(n['attrs'].get('class','').split()) or 'data-i18n'in n['attrs'] or 'data-i18n-aria'in n['attrs'] for n in self.stack)
 def handle_starttag(self,t,a):
  attrs=dict(a);node={'tag':t,'attrs':attrs,'pos':self.pos(),'raw':self.get_starttag_text(),'count':0,'texts':{},'attributes':{}}
  if not self.blocked():
   for k in ['aria-label','title','placeholder','alt']:
    if k in attrs and candidate(attrs[k],self.name):node['attributes'][k]=attrs[k]
  self.nodes.append(node)
  if t not in void:self.stack.append(node)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i]['tag']==t:self.stack=self.stack[:i];return
 def handle_data(self,d):
  if not self.stack:return
  n=self.stack[-1];idx=n['count'];n['count']+=1
  if not self.blocked() and candidate(d,self.name):n['texts'][idx]=d
 def output(self):
  s=self.source
  for n in reversed(self.nodes):
   attrs=''
   if n['texts']:attrs+=' data-ui-text="'+html.escape(q(n['texts']),quote=True)+'"'
   if n['attributes']:attrs+=' data-ui-attrs="'+html.escape(q(n['attributes']),quote=True)+'"'
   if attrs:
    at=n['pos']+len(n['raw'])-(2 if n['raw'].endswith('/>')else 1);s=s[:at]+attrs+s[at:]
  s=s.replace('</body>', '<script type="module" src="ui-language.mjs?v=76"></script>\n</body>')
  # Cache-bust all local module references together; financial fixtures remain unchanged.
  s=re.sub(r'(src="[^"?]+\.(?:js|mjs))\?v=\d+',r'\1?v=76',s)
  return s
results={}
for p in sorted(base.iterdir()):
 if p.suffix in {'.js','.mjs'} and (work/(p.name+'.ast.json')).exists():results[p.name]=compile_js(p.name)
 elif p.suffix=='.html':
  src=p.read_text();parser=Static(src,p.name);parser.feed(src);(design/p.name).write_text(parser.output());results[p.name]=sum(bool(n['texts']or n['attributes'])for n in parser.nodes)
(work/'compile-report.json').write_text(json.dumps(results,indent=2)+'\n')
print('Explicit localization boundaries:',sum(results.values()),'across',len(results),'files')

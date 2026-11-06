"""Plan explicit source-level UI localization using Babel AST + stdlib HTMLParser.
No runtime DOM text replacement, observers, browser or third-party installs.
"""
from pathlib import Path
from html.parser import HTMLParser
import json,re,shutil
root=Path(__file__).resolve().parents[2];work=Path(__file__).parent;design=root/'design'
base=work/'baseline';base.mkdir(exist_ok=True)
for p in design.iterdir():
 if p.suffix in ['.js','.mjs','.html'] and not (base/p.name).exists():shutil.copyfile(p,base/p.name)
CJK=re.compile('[\u3040-\u30ff\u4e00-\u9fff]')
keys={};exempt=[]
protected_classes={'race-name','horse-name-cell','grade-badge','surface-badge','settings-emblem','season-art','brand-emblem','header-caption','language-code'}
protected_ids={'race-title','horse-title','history-title','history-horse-name','horse-race-name','race-course','history-course','race-surface','history-surface','horse-current-odds'}
protected_values={'芝','ダート','AW','GⅠ','GⅡ','GⅢ','JpnⅠ','中文','日本語','English','香港賽事示例'}
void={'img','input','link','meta','br','hr','source','wbr','area','base','embed','param','track','col'}
def add(key,file):
 if not key.strip() or not CJK.search(key) or key.strip() in protected_values:return False
 keys.setdefault(key,[])
 if file not in keys[key]:keys[key].append(file)
 return True
class Units(HTMLParser):
 def __init__(self,text,file):
  super().__init__(convert_charrefs=False);self.text=text;self.file=file;self.units=[];self.stack=[];self.lines=[0]
  for m in re.finditer('\n',text):self.lines.append(m.end())
 def position(self):line,col=self.getpos();return self.lines[line-1]+col
 def blocked(self):
  return any(tag in {'script','style'} or a.get('id') in protected_ids or protected_classes.intersection(a.get('class','').split()) or 'data-i18n' in a or 'data-i18n-aria' in a for tag,a in self.stack)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);blocked=self.blocked() or a.get('id') in protected_ids or protected_classes.intersection(a.get('class','').split())
  if not blocked:
   raw=self.get_starttag_text();off=self.position()
   for m in re.finditer(r'\b(aria-label|title|placeholder|alt)=("|\')(.*?)\2',raw,re.S):
    if add(m[3],self.file):self.units.append((off+m.start(3),off+m.end(3),m[3]))
  if tag not in void:self.stack.append((tag,a))
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==tag:self.stack=self.stack[:i];return
 def handle_data(self,data):
  if not self.blocked() and add(data,self.file):self.units.append((self.position(),self.position()+len(data),data))
def units(text,file):
 p=Units(text,file);p.feed(text);return p.units
# Chinese/Japanese data identifiers keep source names, surfaces and courses.
def is_data(path,node):
 for n in path:
  if n.get('type')=='ObjectProperty' and n.get('key',{}).get('name') in {'ja','en'}:return True
  if n.get('type')=='CallExpression' and n.get('callee',{}).get('name')=='calendarUi' and node is not n.get('arguments',[None])[0]:return True
 for n in path:
  if n.get('type')=='VariableDeclarator' and n.get('id',{}).get('name') in {'sampleHorseNames','samplePastRaces','surfaceLabels','gradeLabels','englishMonths','importanceSamples'}:return True
  if n.get('type')=='ObjectProperty' and n.get('key',{}).get('name') in {'name','course','place'}:return True
 return False
def walk(n,path=[]):
 if not isinstance(n,dict):return
 yield n,path
 for k,v in n.items():
  if k in {'loc','extra','leadingComments','trailingComments','innerComments'}:continue
  if isinstance(v,dict):yield from walk(v,path+[n])
  elif isinstance(v,list):
   for child in v:
    if isinstance(child,dict):yield from walk(child,path+[n])
for p in sorted(base.iterdir()):
 if p.suffix=='.html':units(p.read_text(),p.name)
 elif p.suffix in ['.js','.mjs'] and (work/(p.name+'.ast.json')).exists():
  ast=json.loads((work/(p.name+'.ast.json')).read_text())
  for n,path in walk(ast):
   if is_data(path,n):continue
   if n.get('type')=='StringLiteral':
    text=n['value']
    if '<' in text and '>' in text:units(text,p.name)
    else:add(text,p.name)
   if n.get('type')=='TemplateLiteral':
    text=''.join(q['value'].get('cooked',q['value']['raw'])+(f'{{{i}}}' if i<len(n['expressions']) else '') for i,q in enumerate(n['quasis']))
    if '<' in text and '>' in text:units(text,p.name)
    else:add(text,p.name)
(work/'keys.json').write_text(json.dumps(keys,ensure_ascii=False,indent=2)+'\n')
print('Unique UI/source candidates:',len(keys))

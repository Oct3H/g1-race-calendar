"""Conservative source inventory, not a claim of rendered UI or translation correctness."""
import re,json
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[2]
cjk=re.compile('[\u4e00-\u9fff]')
rows=[]
class Scan(HTMLParser):
 def __init__(self,file):super().__init__(convert_charrefs=True);self.file=file;self.stack=[]
 def handle_starttag(self,tag,attrs):
  if tag not in ['img','input','link','meta','br','hr','source','wbr']:self.stack.append((tag,dict(attrs)))
  a=dict(attrs)
  for key in ['aria-label','title','placeholder','alt']:
   if cjk.search(a.get(key,'')):rows.append(dict(file=self.file,line=self.getpos()[0],kind=key,text=a[key],coverage='needs-review',langs=['en','ja']))
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):
  text=data.strip()
  if not cjk.search(text) or not self.stack:return
  attrs=self.stack[-1][1]
  named=any(any(v in a.get('class','').split() for v in ['race-name','horse-name-cell','past-race-name']) for _,a in self.stack)
  if named:coverage='name-policy-preserved'
  elif 'data-ui-en' in attrs and 'data-ui-ja' in attrs:coverage='explicit-three-language-markup'
  elif 'data-i18n' in attrs:coverage='settings-dictionary-needs-key-review'
  else:coverage='needs-review'
  rows.append(dict(file=self.file,line=self.getpos()[0],kind='static-text',text=text,coverage=coverage,langs=['en','ja']))
for p in sorted((root/'design').glob('*')):
 if p.suffix=='.html':Scan(p.name).feed(p.read_text())
 elif p.suffix in ['.js','.mjs']:
  for number,line in enumerate(p.read_text().splitlines(),1):
   if cjk.search(line) and not line.lstrip().startswith(('//','*')):
    rows.append(dict(file=p.name,line=number,kind='dynamic-source-candidate',text=line.strip()[:500],coverage='needs-semantic-review',langs=['en','ja']))
report={'round':75,'status':'INCOMPLETE_TRANSLATION_AUDIT','scope':'all top-level design HTML/JS/MJS; static text, attributes, dynamic source candidates','limits':'Source inventory only; candidates include source data and existing translations. No browser rendering, hidden-state or semantic-completeness claim.','items':rows}
(root/'research/language-audit-75/inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
summary={}
for r in rows:summary[r['file']]=summary.get(r['file'],0)+1
print(json.dumps({'status':report['status'],'files':len(summary),'candidate_counts':summary},ensure_ascii=False))

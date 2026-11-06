"""Bounded fresh checks using only existing fixed roots and observed hrefs."""
from datetime import date
import importlib.util,json,sys
from pathlib import Path
from urllib.parse import urljoin
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'2026-10-26-discovery'))
import discover as d
d.CAPTURE_ROOT=ROOT/'live';d.capture.ROOT=d.CAPTURE_ROOT
spec=importlib.util.spec_from_file_location('prior_fields',ROOT.parent/'2026-10-27-japan/check_japan.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)

def main():
 if any(d.CAPTURE_ROOT.glob('*.response')) and '--resume' not in sys.argv:raise SystemExit('Existing evidence: use --resume to continue without refetching')
 runner=d.Runner(date(2026,10,31))
 if '--resume' in sys.argv:
  saved=json.loads((ROOT/'publication.json').read_text())
  runner.records=saved['requests']
  for record in runner.records:
   if record['status']!=200:continue
   raw=(ROOT/record['evidence']).read_bytes()
   if d.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Saved response hash mismatch')
   page=d.Page(raw.decode('utf-8')) if 'text/html' in record.get('headers',{}).get('content-type','') else d.Page('')
   page.url,page.evidence=record['url'],Path(record['evidence']).stem
   runner.pages[page.url]=page
 report={'as_of':'2026-10-31','nar':{},'central':{}}
 try:
  try:
   home,annual,events=runner.discover_nar();report['nar']['annual']=events
   future=sorted([r for r in events if r.get('detail_url') and r['date']>runner.today.isoformat()],key=lambda r:(r['date'],r['name']))
   event=future[0];page=runner.fetch(event['detail_url'],event['parent_url'],event['href'])
   report['nar'].update(selected_event=event,detail={'url':page.url,'text':page.text,'links':page.anchors})
   if event['name'] not in page.text[0]:raise ValueError('Wrong detail identity')
   link=next((a for a in page.anchors if '/DebaTable?' in a['href']),None)
   if link:
    entries=runner.fetch(urljoin(page.url,link['href']),page.url,link['href'])
    raw=(d.CAPTURE_ROOT/f'{entries.evidence}.response').read_text()
    report['nar']['entries']={'url':entries.url,'text':entries.text,'horses':f.entry_horses(raw),'links':entries.anchors}
    odds=next((a for a in entries.anchors if '/OddsTanFuku?' in a['href']),None)
    if odds:
     q=runner.fetch(urljoin(entries.url,odds['href']),entries.url,odds['href'])
     report['nar']['odds']={'url':q.url,'text':q.text,'rows':q.rows}
  except Exception as error:report['nar']['error']=str(error)
  print('NAR',json.dumps({'annual':len(report['nar'].get('annual',[])),'entry_horses':len(report['nar'].get('entries',{}).get('horses',[])),'error':report['nar'].get('error')},ensure_ascii=False),flush=True)
  try:
   home,calendars=runner.discover_japan();events=[e for _,values in calendars for e in values]
   report['central']['annual']=events
   future=sorted([e for e in events if e['date']>runner.today.isoformat()],key=lambda e:e['date'])
   if future:
    event=future[0];page=runner.fetch(event['detail_url'],event['parent_url'],event['href'])
    report['central'].update(selected_event=event,detail={'url':page.url,'text':page.text,'links':page.anchors})
    report['central']['news_documents']=runner.news_documents(home,event)
  except Exception as error:report['central']['error']=str(error)
 finally:
  report['requests']=runner.records
  (ROOT/'publication.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print('CENTRAL',json.dumps({'annual':len(report['central'].get('annual',[])),'error':report['central'].get('error'),'requests':len(runner.records)},ensure_ascii=False),flush=True)
if __name__=='__main__':main()

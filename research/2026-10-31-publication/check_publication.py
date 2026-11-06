"""Offline source identity, true publication delta, missing-odds and join checks."""
from datetime import datetime
from hashlib import sha256
import json,re,sys,time,unicodedata
from pathlib import Path
from urllib.parse import urljoin,urlparse,parse_qs
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'2026-10-26-discovery'))
from discover import Page,merge
sys.path.insert(0,str(ROOT.parent/'2026-10-27-japan'))
from check_japan import entry_horses
r=json.loads((ROOT/'publication.json').read_text());by_url={x['url']:x for x in r['requests']}
assert len(by_url)==len(r['requests'])==13
for q in r['requests']:
 assert q['status']==200
 assert sha256((ROOT/q['evidence']).read_bytes()).hexdigest()==q['sha256']
 if q['discovered_from']:
  parent=by_url[q['discovered_from']];page=Page((ROOT/parent['evidence']).read_text())
  if q.get('redirect_rule'):
   rule=q['redirect_rule'];assert urljoin(parent['url'],f"{rule['year']}.html")==q['url'];assert rule['script_url'] in by_url
  else:
   assert q['observed_href'] in [a['href'] for a in page.anchors+page.options]+page.scripts
   assert urljoin(parent['url'],q['observed_href'])==q['url']
assert len(r['nar']['annual'])==13 and len(r['central']['annual'])==24
old=json.loads((ROOT.parent/'2026-10-27-japan/japan-audit.json').read_text())
event=r['nar']['selected_event'];before=next(x for x in old['selected_nar_details'] if x['event']['key']==event['key'])
assert before['event']['detail_url']==r['nar']['detail']['url']
assert not any('/DebaTable?' in a['href'] for a in before['relevant_links'])
assert any('/DebaTable?' in a['href'] for a in r['nar']['detail']['links'])
entries=r['nar']['entries'];q=by_url[entries['url']];raw=(ROOT/q['evidence']).read_text()
start=time.monotonic();horses=entry_horses(raw);seconds=time.monotonic()-start
assert horses==entries['horses'] and len(horses)==12
assert [h['number'] for h in horses]==list(range(1,13))
assert all(h['name'] and h['jockey'] and h['win_raw'] is None for h in horses)
assert 'OddsTanFuku' not in raw and 'odds' not in r['nar']
params=parse_qs(urlparse(entries['url']).query)
assert params['k_raceDate']==[event['date'].replace('-','/')]
header=unicodedata.normalize('NFKC',' '.join(entries['text']))
assert f"第{params['k_raceNo'][0]}競走" in header and '2100' in header
assert 'JBCクラシック' in header and '金' in header and '沢' in header
catalog,_=merge({},old['nar_current']);updated,first=merge(catalog,r['nar']['annual']);again,repeat=merge(updated,r['nar']['annual'])
assert first['added']==0 and repeat['added']==repeat['changed']==0 and len(again)==13
rows=json.loads((ROOT/'draw-rows.json').read_text());tables=json.loads((ROOT/'odds-tables.json').read_text())
quotes=[row for table in tables for row in table if len(row)==5 and (row[1] or '').isdigit()]
assert len(rows)==len(quotes)==17
assert len({row[1] for row in rows})==len({row[1] for row in quotes})==17
assert {row[1]:row[2] for row in rows}=={row[1]:row[2] for row in quotes}
assert all(float(row[3])>=1 for row in quotes)
text=(ROOT/'odds-text.txt').read_text();assert 'JRA pari-mutuel pool odds' in text and '17:30 on Saturday' in text and 'TOKYO 11R' in text
central=r['central']['selected_event'];draw=next(x for x in r['central']['news_documents'] if x['kind']=='declarations')
p=Page((ROOT/by_url[draw['url']]['evidence']).read_text());visible=' '.join(p.text)
when=re.search(r'(November \d+, 2026), (\d[\d,]*)m, Turf, Post time (\d\d:\d\d)',visible);assert when
race_date=datetime.strptime(when[1],'%B %d, %Y').date().isoformat();assert race_date==central['date'] and when[2]=='2000'
quote_doc=next(x for x in r['central']['news_documents'] if x['kind']=='actual_win_snapshot')
quote_date=re.search(r'\d{4}\.\d{2}\.\d{2}',quote_doc['anchor_label'])[0].replace('.','-')
normalized={'race':{'id':central['key'],'startAt':f"{race_date}T{when[3]}:00+09:00",'sampleEntriesConfirmed':True,'sampleOfficialOdds':True,'sampleOddsSource':quote_doc['url'],'sampleOddsAt':f'{quote_date}T17:30:00+09:00'},'fetchedAt':by_url[quote_doc['url']]['requested_at'],'horses':[{'number':int(row[1]),'name':row[2],'odds':row[3]} for row in quotes],'limitation':'English source names; Japanese display mapping not validated here'}
(ROOT/'normalized-sample.json').write_text(json.dumps(normalized,ensure_ascii=False,indent=2)+'\n')
result={'status':'PASSED','requests':13,'all_http_200':True,'nar':{'before':'2026-10-27 intended entries, no draw link','after':'2026-10-31 actual draw link and 12 unique runners','raceKey':event['key'],'winAvailable':False,'parseSeconds':round(seconds,5),'repeatMerge':repeat},'central':{'annualGI':24,'declaredRunners':17,'matchedWinRows':17,'market':'JRA pari-mutuel Win','quoteAtJST':quote_date+' 17:30','raceAtJST':race_date+' '+when[3]},'limitations':['One real publication delta, not a global update guarantee','One current official quote snapshot, not an API uptime contract','No future result/settlement or official correction verified','No Japanese-name mapping or app backend integration']}
(ROOT/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))

"""Resume the recorded failed probe via a different source-published link.

Reuse the successful fixed-root response; retain the failed request in trace.
No repeating request loop and no cached ranking substituted for a live read.
"""
import json
from discover import Page
from discover_overseas import ROOT, Runner

previous = ROOT / 'overseas-discovery-report.json'
if not previous.exists(): previous = ROOT / 'overseas-resume-failed.json'
prior = json.loads((previous if previous.exists() else ROOT / 'overseas-failed-run.json').read_text())
runner = Runner()
runner.records = prior['requests']
for record in runner.records:
    if record['status'] != 200: continue
    raw = (ROOT / record['evidence']).read_bytes().decode('cp1252' if 'ifhaonline.org' in record['url'] else 'utf-8')
    page = Page(raw); page.url = record['url']
    runner.raw[page.url], runner.pages[page.url] = raw, page
try: result = runner.run()
except Exception as error:
    (ROOT / 'overseas-resume-failed.json').write_text(json.dumps({'error': str(error), 'requests': runner.records}, ensure_ascii=False, indent=2))
    raise
result['resume_note'] = 'IFHA root reused from recorded live read; failed www ranking request retained; alternate absolute ranking link came from the same root'
(ROOT / 'overseas-discovery-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in result.items() if k != 'requests'}, ensure_ascii=False, indent=2))

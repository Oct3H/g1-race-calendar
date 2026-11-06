"""Reuse audited root responses, fetch only newly selected observed news link.

This is explicitly a partial live run with recorded responses for prior steps.
"""
from datetime import date
import json
from discover import ROOT, Page, Runner, merge

report = json.loads((ROOT / 'discovery-report.json').read_text())
runner = Runner(date.fromisoformat(report['as_of']))
runner.records = report['requests']
for record in runner.records:
    path = ROOT / record['evidence']
    page = Page(path.read_text() if 'text/html' in record.get('headers', {}).get('content-type', '') else '')
    page.url, page.evidence = record['url'], path.stem
    runner.pages[page.url] = page
before = len(runner.records)
home = runner.pages[report['seed_urls']['japan']]
documents = runner.news_documents(home, report['automatically_selected_past_event'])
report['automatically_found_news_documents'] = documents
report['news_probe_completion'] = {'reused_recorded_requests': before, 'additional_live_requests': len(runner.records) - before}
report['requests'] = runner.records
report['catalog'], _ = merge(report['catalog'], [{'key': report['automatically_selected_past_event']['key'], 'documents': documents}])
(ROOT / 'discovery-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
(ROOT / 'research-catalog.json').write_text(json.dumps(report['catalog'], ensure_ascii=False, indent=2))
print(json.dumps({'documents': documents, 'completion': report['news_probe_completion']}, ensure_ascii=False, indent=2))

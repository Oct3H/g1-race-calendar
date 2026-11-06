"""Continue independent NAR reads after a recorded Japan source failure.

The failed URL is not retried. Successful earlier root responses are reused.
"""
from datetime import date
import json
from verify_japan import ROOT, discovery, run

previous = ROOT / 'resume-failed-run.json'
prior = json.loads((previous if previous.exists() else ROOT / 'failed-run.json').read_text())
runner = discovery.Runner(date(2026, 10, 27))
runner.records = prior['requests']
for record in runner.records:
    if record['status'] != 200: continue
    p = ROOT / record['evidence']
    page = discovery.Page(p.read_text())
    page.url, page.evidence = record['url'], p.stem
    runner.pages[page.url] = page
initial_failure = json.loads((ROOT / 'failed-run.json').read_text())['error']
try: report = run(runner, japan_failure=initial_failure)
except Exception as error:
    (ROOT / 'resume-failed-run.json').write_text(json.dumps({'error': str(error), 'requests': runner.records}, ensure_ascii=False, indent=2))
    raise
report['resume_note'] = 'Continue independent NAR source; no retry of failed Japan script URL'
(ROOT / 'japan-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'jra_current_failure': report['jra_current_failure'], 'nar_current': len(report['nar_current']),
                  'previous_year': {k: len(v) for k, v in report['previous_year'].items()},
                  'home_cards': len(report['nar_home_cards']), 'requests': len(report['requests']),
                  'detail_links': [{'name': s['event']['name'], 'links': s['relevant_links']} for s in report['selected_nar_details']]}, ensure_ascii=False, indent=2))

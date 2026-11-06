"""Use prior successful entry pages after this round's homepage transport error.

No retry of that failed URL. No cached annual schedule substituted for a fresh
read: only entry navigation and its generic year rule are reused.
"""
from datetime import date
from hashlib import sha256
import json
from central_probe import ROOT, discover, run, preload_year_rule

failure = json.loads((ROOT / 'failed-run.json').read_text())
resumed_failure = ROOT / 'resume-failed-run.json'
if resumed_failure.exists() and len(json.loads(resumed_failure.read_text())['requests']) > len(failure['requests']):
    raise SystemExit('A live continuation already ran; preserve its evidence and use a new audit directory for fresh reads')
runner = discover.Runner(date(2026, 10, 27))
runner.records = failure['requests']
reference = preload_year_rule(runner)
previous_root = ROOT.parent / '2026-10-27-japan'
prior = json.loads((previous_root / 'japan-audit.json').read_text())
references = []
for record in prior['requests']:
    if record['status'] != 200 or 'japanracing.jp' not in record['url']: continue
    raw = (previous_root / record['evidence']).read_bytes()
    assert sha256(raw).hexdigest() == record['sha256']
    name = f"reference-entry-{record['sha256'][:12]}"
    (discover.CAPTURE_ROOT / f'{name}.response').write_bytes(raw)
    page = discover.Page(raw.decode()); page.url, page.evidence = record['url'], name
    runner.pages[page.url] = page
    references.append({'url': record['url'], 'source_requested_at': record['requested_at'], 'sha256': record['sha256'],
                       'original_evidence': f"../2026-10-27-japan/{record['evidence']}", 'local_evidence': f'live/{name}.response',
                       'discovered_from': record['discovered_from'], 'observed_href': record['observed_href'],
                       'type': 'cached entry HTML; not a new HTTP read'})
try: report = run(runner, reference)
except Exception as error:
    (ROOT / 'resume-failed-run.json').write_text(json.dumps({'error': str(error), 'navigation_reference': reference,
                                                           'entry_references': references, 'requests': runner.records}, ensure_ascii=False, indent=2))
    raise
report['entry_references'] = references
report['resume_note'] = 'Failed homepage not retried; known entry pages reused; annual/race/detail-navigation reads attempted independently'
(ROOT / 'central-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'jra_g1': len(report['jra_current']), 'graded_rows': report['graded_directory_rows'],
                  'history_matches': report['history_matches'], 'matched_details': len(report['matched_detail_pages']),
                  'requests': len(runner.records), 'detail_failure': report['matched_detail_failure'],
                  'result_navigation_failure': report['result_navigation_failure']}, ensure_ascii=False, indent=2))

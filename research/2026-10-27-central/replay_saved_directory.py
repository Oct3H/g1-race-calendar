"""Reference-only replay after both live entry reads failed.

No network is allowed in this replay. Candidates are not called verified detail
pages unless a corresponding saved detail response is actually available.
"""
from datetime import date
from hashlib import sha256
import json
from central_probe import ROOT, PREVIOUS, discover, run, preload_year_rule


class ReferenceOnlyRunner(discover.Runner):
    def fetch(self, url, *args, **kwargs):
        if url not in self.pages: raise ValueError('Not attempted in reference-only replay: no saved response')
        return super().fetch(url, *args, **kwargs)


runner = ReferenceOnlyRunner(date(2026, 10, 27))
failed = json.loads((ROOT / 'resume-failed-run.json').read_text())
runner.records = failed['requests']
reference = preload_year_rule(runner)
prior = json.loads((PREVIOUS / 'discovery-report.json').read_text())
references = []
for record in prior['requests']:
    if record['status'] != 200 or 'japanracing.jp' not in record['url']: continue
    if '/list/2026.html' not in record['url'] and record['url'] not in [prior['seed_urls']['japan'],
            'https://japanracing.jp/en/racing/schedule/graded/', 'https://japanracing.jp/en/racing/schedule/graded/list/']: continue
    raw = (PREVIOUS / record['evidence']).read_bytes()
    assert sha256(raw).hexdigest() == record['sha256']
    name = f"reference-directory-{record['sha256'][:12]}"
    (discover.CAPTURE_ROOT / f'{name}.response').write_bytes(raw)
    page = discover.Page(raw.decode()); page.url, page.evidence = record['url'], name
    runner.pages[page.url] = page
    references.append({'url': record['url'], 'source_requested_at': record['requested_at'], 'sha256': record['sha256'],
                       'original_evidence': f"../2026-10-26-discovery/{record['evidence']}",
                       'local_evidence': f'live/{name}.response', 'type': 'saved 2026-10-26 directory; not fresh data'})
report = run(runner, reference)
report['directory_references'] = references
report['mode'] = 'offline reference-only replay; no fresh central schedule or history detail verified'
report['limits'].append('Live homepage and annual requests failed at the request tunnel; origin status is unknown')
(ROOT / 'central-replay.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'g1_in_saved_directory': len(report['jra_current']),
                  'graded_rows_in_saved_directory': report['graded_directory_rows'],
                  'history_match_counts': [len(m['candidates']) for m in report['history_matches']],
                  'verified_detail_pages': len(report['matched_detail_pages']),
                  'new_network_reads_in_replay': 0}, ensure_ascii=False, indent=2))

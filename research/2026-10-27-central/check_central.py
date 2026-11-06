"""Offline warm-cache navigation and conservative history identity checks."""
from copy import deepcopy
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from central_probe import PREVIOUS, discover, graded_events, match_history


def check():
    replay = json.loads((ROOT / 'central-replay.json').read_text())
    runner = discover.Runner(date(2026, 10, 27))
    references = replay['directory_references'] + [replay['navigation_reference']]
    for record in references:
        raw = (ROOT / record['local_evidence']).read_bytes()
        assert sha256(raw).hexdigest() == record['sha256']
        page = discover.Page(raw.decode() if '/redirect.js' not in record['url'] else '')
        page.url, page.evidence = record['url'], Path(record['local_evidence']).stem
        runner.pages[page.url] = page
    _, calendars = runner.discover_japan()
    assert len(calendars[0][1]) == 24 and not runner.records
    annual = runner.pages[calendars[0][0]]
    events = graded_events(annual)
    assert len(events) == 129
    matches = replay['history_matches']
    assert [len(item['candidates']) for item in matches] == [1, 0, 0, 0, 0]
    target, candidate = matches[0]['target'], matches[0]['candidates'][0]
    assert target['date'] == candidate['date'] and target['race_no'] == candidate['race_no']
    assert candidate['href'] in [a['href'] for a in annual.anchors]
    for key in ['date', 'course', 'race_no', 'grade', 'distance_m']:
        wrong = deepcopy(candidate)
        wrong[key] = 'different'
        assert match_history(target, [wrong]) == []
    assert len(match_history(target, [candidate, candidate])) == 2  # Caller must refuse ambiguity.
    assert not replay['matched_detail_pages']
    for request in replay['requests']:
        assert sha256((ROOT / request['evidence']).read_bytes()).hexdigest() == request['sha256']
        assert request['status'] is None and 'Tunnel connection failed' in request['error']
    assert len(replay['requests']) == 2  # Neither failed URL was retried.
    return {'warm_cache_navigation': {'saved_g1_rows': 24, 'new_network_reads': 0},
            'saved_graded_rows': 129, 'prior_five_unique_candidates': 1,
            'verified_history_detail_pages': 0, 'wrong_identity_fields_rejected': 5,
            'two_distinct_live_request_failures': True,
            'limitation': 'Both live attempts failed at the request tunnel; origin status unknown. Replay and candidate links are not fresh detail verification.'}


if __name__ == '__main__':
    result = check()
    (ROOT / 'offline-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))

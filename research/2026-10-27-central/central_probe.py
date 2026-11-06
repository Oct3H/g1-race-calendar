"""Verify fresh central schedules using an explicitly cached navigation rule.

Only the previously observed generic year redirect script is reused. Schedule
and race pages must be fetched and checked anew; no target race name or URL.
Downloaded JS is inspected as text, never executed.
"""
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin
import unicodedata

ROOT = Path(__file__).resolve().parent
PREVIOUS = ROOT.parent / '2026-10-26-discovery'
sys.path.insert(0, str(PREVIOUS))
import discover

discover.ROOT = ROOT
discover.CAPTURE_ROOT = ROOT / 'live'
discover.CAPTURE_ROOT.mkdir(exist_ok=True)
discover.capture.ROOT = discover.CAPTURE_ROOT

# Venue names, not race-name translations or target event paths.
COURSES = {'札幌': 'SAPPORO', '函館': 'HAKODATE', '福島': 'FUKUSHIMA', '新潟': 'NIIGATA',
           '東京': 'TOKYO', '中山': 'NAKAYAMA', '中京': 'CHUKYO', '京都': 'KYOTO',
           '阪神': 'HANSHIN', '小倉': 'KOKURA'}


def preload_year_rule(runner):
    prior = json.loads((PREVIOUS / 'discovery-report.json').read_text())
    record = next(r for r in prior['requests'] if r['url'].endswith('/redirect.js'))
    assert record['status'] == 200
    raw = (PREVIOUS / record['evidence']).read_bytes()
    assert sha256(raw).hexdigest() == record['sha256']
    content = raw.decode()
    assert 'Number(new Date().getFullYear())' in content
    assert "url: redirect_dir + viewYEAR + '.html'" in content
    assert 'location.href = redirect_url' in content
    name = f"reference-year-rule-{record['sha256'][:12]}"
    (discover.CAPTURE_ROOT / f'{name}.response').write_bytes(raw)
    page = discover.Page(''); page.url, page.evidence = record['url'], name
    runner.pages[page.url] = page
    return {'url': record['url'], 'source_requested_at': record['requested_at'], 'sha256': record['sha256'],
            'original_evidence': f"../2026-10-26-discovery/{record['evidence']}",
            'local_evidence': f'live/{name}.response', 'type': 'cached generic navigation rule, not fresh race data'}


def graded_events(page):
    years = [int(t) for t in page.headings if re.fullmatch(r'20\d\d', t)]
    if len(years) != 1: raise ValueError('Unrecognized annual year')
    year = years[0]
    events = []
    for index, row in enumerate(page.rows):
        if row[0] not in ['G1', 'G2', 'G3']: continue
        heading = page.rows[index - 1][0]
        stamp = re.match(r'([A-Z][a-z]{2})\.?\s*(\d+)', heading)
        if not stamp: raise ValueError('Unknown graded race date')
        links = [a for a in page.row_links[index - 1] if a['href'] and not a['href'].startswith(('javascript:', '#'))]
        if len(links) != 1: raise ValueError('No unique published graded detail URL')
        link = links[0]
        result = [a for a in page.row_links[index] if a['href'].startswith('javascript:doSubmit(')]
        params = re.findall(r"'([^']*)'", result[0]['href']) if result else []
        distance, surface = row[2].split('/')
        events.append({'year': year, 'date': date(year, discover.MONTHS[stamp[1]], int(stamp[2])).isoformat(),
                       'name': link['label'], 'grade': row[0], 'course': row[1],
                       'distance_m': int(distance.replace(',', '')), 'surface_raw': surface,
                       'race_no': int(params[5]) if len(params) == 7 else None,
                       'published_result_call': result[0]['href'] if result else None,
                       'detail_url': urljoin(page.url, link['href']), 'href': link['href'], 'parent_url': page.url})
    return events


def history_target(row):
    # NAR history has a different width than its colspan header; use the
    # already-inspected row layout, keeping the full source row for review.
    if len(row) != 23: raise ValueError('History shape changed; do not map columns blindly')
    name = unicodedata.normalize('NFKC', row[3])
    suffix = re.search(r'G(III|II|I|[123])$', name)
    grade = {'I': 'G1', 'II': 'G2', 'III': 'G3', '1': 'G1', '2': 'G2', '3': 'G3'}.get(suffix[1]) if suffix else None
    course = COURSES.get(row[1].removeprefix('Ｊ'))
    return {'date': row[0].replace('/', '-'), 'name_raw': row[3], 'course_raw': row[1],
            'course': course, 'race_no': int(row[2]), 'grade': grade, 'distance_m': int(row[5])}


def match_history(target, events):
    if target['grade'] is None: return []
    return [event for event in events if all(target[k] == event[k] for k in ['date', 'course', 'race_no', 'grade', 'distance_m'])]


def run(runner, reference):
    _, calendars = runner.discover_japan()
    annual = runner.pages[calendars[0][0]]
    events = graded_events(annual)
    g1 = [e for e in events if e['grade'] == 'G1']
    if len(g1) != 24: raise ValueError('Central flat G1 annual count requires review')
    old = json.loads((ROOT.parent / '2026-10-27-japan/japan-audit.json').read_text())
    history = old['winner_horse_profile']['rows']
    cutoff = old['selected_nar_details'][0]['event']['date']
    rows = sorted([r for r in history if re.fullmatch(r'\d{4}/\d{2}/\d{2}', r[0])
                   and r[0].replace('/', '-') < cutoff], key=lambda row: row[0], reverse=True)[:5]
    targets = [history_target(row) for row in rows]
    matches = []
    for target in targets:
        candidates = match_history(target, events)
        matches.append({'target': target, 'candidates': candidates,
                        'status': 'unique published graded instance' if len(candidates) == 1
                        else 'not covered by graded directory' if not candidates else 'ambiguous; unresolved'})
    unique = [item for item in matches if len(item['candidates']) == 1]
    details = []
    detail_failure = None
    if unique:
        candidate = unique[0]['candidates'][0]
        try:
            page = runner.fetch(candidate['detail_url'], candidate['parent_url'], candidate['href'])
            if not any(candidate['name'].casefold() in t.casefold() for t in page.headings):
                raise ValueError('Wrong matched detail race name')
            details.append({'event': candidate, 'title_verified': True, 'rows': page.rows, 'text': page.text,
                            'links': [a for a in page.anchors if any(word in a['href'].lower() for word in ['result', 'submit', 'news'])]})
        except ValueError as error: detail_failure = str(error)
    common = next(href for href in annual.scripts if href.endswith('/common.js'))
    script_url = urljoin(annual.url, common)
    navigation_failure = None
    try: runner.fetch(script_url, annual.url, common)
    except ValueError as error: navigation_failure = str(error)
    return {'as_of': runner.today.isoformat(), 'navigation_reference': reference,
            'jra_current': g1, 'graded_directory_rows': len(events), 'history_cutoff': cutoff,
            'history_matches': matches, 'matched_detail_pages': details, 'matched_detail_failure': detail_failure,
            'result_navigation_script': script_url, 'result_navigation_failure': navigation_failure,
            'requests': runner.records,
            'limits': ['Cached navigation is not a new script read; annual and matched race pages are new HTTP reads',
                       'Graded directory does not cover ordinary allowance/conditions races',
                       'Matching a conditions page does not prove full historical results or Win odds are available']}


if __name__ == '__main__':
    if any(discover.CAPTURE_ROOT.glob('request-*.response')):
        raise SystemExit('Evidence exists; use offline checks or a new audit directory for fresh requests')
    runner = discover.Runner(date(2026, 10, 27))
    reference = preload_year_rule(runner)
    try: report = run(runner, reference)
    except Exception as error:
        (ROOT / 'failed-run.json').write_text(json.dumps({'error': str(error), 'navigation_reference': reference, 'requests': runner.records}, ensure_ascii=False, indent=2))
        raise
    (ROOT / 'central-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'jra_g1': len(report['jra_current']),
                      'graded_rows': report['graded_directory_rows'], 'history_matches': report['history_matches'],
                      'matched_details': len(report['matched_detail_pages']), 'requests': len(report['requests'])}, ensure_ascii=False, indent=2))

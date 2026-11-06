"""Research audit of Japanese annual discovery and publication stages.

Fixed official roots only. Reuses the existing bounded, ordinary HTTP runner.
No browser, authentication, retry loop, production cache or wallet writes.
"""
from datetime import date
import json
from pathlib import Path
import sys
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / '2026-10-26-discovery'))
import discover as discovery

discovery.ROOT = ROOT
discovery.CAPTURE_ROOT = ROOT / 'live'
discovery.CAPTURE_ROOT.mkdir(exist_ok=True)
discovery.capture.ROOT = discovery.CAPTURE_ROOT


def run(runner, japan_failure=None):
    calendars = []
    if japan_failure is None:
        try: _, calendars = runner.discover_japan()
        except ValueError as error: japan_failure = str(error)
    japan = [r for _, events in calendars for r in events]
    nar_home, nar_page, nar = runner.discover_nar()
    annual = next((runner.pages[url] for url, _ in calendars if '/list/' in url), None)
    # Read the previous year only if actually linked from the current directory.
    prior = {}
    for page, token, parse in [(annual, f'/list/{runner.today.year - 1}.html', discovery.japan_events),
                               (nar_page, f'/{runner.today.year - 1}/racelist/index.html', None)]:
        if page is None: continue
        candidates = [a for a in page.anchors + page.options if urljoin(page.url, a['href']).endswith(token)]
        if not candidates: continue
        link = candidates[0]
        old = runner.fetch(urljoin(page.url, link['href']), page.url, link['href'])
        values = parse(old, old.url) if parse else discovery.nar_annual_events((discovery.CAPTURE_ROOT / f'{old.evidence}.response').read_text(), old.url)
        prior['jra' if parse else 'nar'] = values
    local_home = discovery.nar_events(nar_home, nar_home.url)
    missing_from_annual = sorted({r['key'] for r in local_home} - {r['key'] for r in nar})
    if missing_from_annual: raise ValueError('Current home cards absent from annual list')
    future = sorted([r for r in nar if r.get('detail_url') and r['date'] > runner.today.isoformat()], key=lambda r: (r['date'], r['name']))
    past = sorted([r for r in nar if r.get('detail_url') and r['date'] < runner.today.isoformat()], key=lambda r: r['date'])
    samples = []
    for event in ([past[-1]] if past else []) + ([future[0]] if future else []):
        page = runner.fetch(event['detail_url'], event['parent_url'], event['href'])
        title = page.text[0] if page.text else ''
        if event['name'] not in title: raise ValueError('Wrong race page returned')
        samples.append({'event': event, 'title': title, 'detail_identity_verified': True,
                        'relevant_links': [a for a in page.anchors if any(t in a['href'] for t in ['DebaTable', 'RaceMarkTable', 'Odds', 'racecard', 'result'])],
                        'visible_text': page.text})
    catalog, initial = discovery.merge({}, japan + nar)
    _, repeated = discovery.merge(catalog, japan + nar)
    return {'as_of': runner.today.isoformat(), 'seed_urls': discovery.SEEDS, 'jra_current_failure': japan_failure,
            'jra_current': japan, 'nar_current': nar, 'previous_year': prior,
            'nar_home_cards': local_home, 'home_cards_missing_from_annual': missing_from_annual,
            'initial': initial, 'repeat_same_snapshot': repeated,
            'selected_nar_details': samples, 'requests': runner.records,
            'limits': ['Annual dates are not proof of final entries, official Win availability or all detail fields',
                       'Previous year is read only when the source publishes a link; no guessed history URL',
                       'Repeat snapshot is offline merge, not a second live read or future publication test',
                       'Independent source failures are recorded without clearing previously successful source data']}


if __name__ == '__main__':
    if any(discovery.CAPTURE_ROOT.glob('*.response')):
        raise SystemExit('This audit directory already contains evidence; use the offline checks or create a new dated audit directory for fresh reads.')
    runner = discovery.Runner(date(2026, 10, 27))
    try: report = run(runner)
    except Exception as error:
        (ROOT / 'failed-run.json').write_text(json.dumps({'error': str(error), 'requests': runner.records}, ensure_ascii=False, indent=2))
        raise
    (ROOT / 'japan-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'jra_current': len(report['jra_current']), 'nar_current': len(report['nar_current']),
                      'previous_year': {k: len(v) for k, v in report['previous_year'].items()},
                      'home_cards': len(report['nar_home_cards']),
                      'initial': report['initial'], 'requests': len(report['requests']),
                      'detail_links': [{'name': s['event']['name'], 'links': s['relevant_links']} for s in report['selected_nar_details']]}, ensure_ascii=False, indent=2))

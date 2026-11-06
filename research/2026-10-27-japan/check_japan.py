"""Offline annual-discovery, field-grain and cache-retention checks."""
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256
from html import unescape
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / '2026-10-26-discovery'))
from discover import Page, merge, nar_annual_events


def clean(value):
    return ' '.join(unescape(re.sub(r'<[^>]+>', '', value)).split())


def entry_horses(content):
    # Scope each search to one horse row. Future draw tables may have no odds
    # nodes at all; requiring one across the full document causes backtracking.
    horses = []
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', content, re.S):
        number = re.search(r'<td[^>]*class="horseNum"[^>]*>(.*?)</td>', row, re.S)
        name = re.search(r'<a class="horseName"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', row, re.S)
        if not number or not name:
            continue
        jockey = re.search(r'<a class="jockeyName"[^>]*>(.*?)</a>', row, re.S)
        odds = re.search(r'<span class="[^"]*\bodds_Black\b[^"]*">(.*?)</span>', row, re.S)
        horses.append({'number': int(clean(number[1])), 'name': clean(name[2]),
                       'jockey': clean(jockey[1]) if jockey else None,
                       'win_raw': (clean(odds[1]) or None) if odds else None,
                       'profile_href': unescape(name[1])})
    if len({h['number'] for h in horses}) != len(horses):
        raise ValueError('Duplicate horse numbers in entry table')
    return horses


def check():
    r = json.loads((ROOT / 'japan-audit.json').read_text())
    checks = {}
    for record in r['requests']:
        raw = (ROOT / record['evidence']).read_bytes()
        assert sha256(raw).hexdigest() == record['sha256']
        if record['discovered_from'] is None:
            assert record['url'] in r['seed_urls'].values(); continue
        parent = next(p for p in r['requests'] if p['url'] == record['discovered_from'])
        page = Page((ROOT / parent['evidence']).read_text())
        assert record['observed_href'] in [a['href'] for a in page.anchors + page.options] + page.scripts
        assert urljoin(parent['url'], record['observed_href']) == record['url']
        if record.get('template_target_document'):
            assert urljoin(record['template_target_document'], record['observed_href']) == record['url']
    checks['source_parent_links_and_sha256'] = len(r['requests'])
    years = {str(date.fromisoformat(r['as_of']).year): r['nar_current'], **r['nar_previous_years']}
    for year, events in years.items():
        expected = 10 if year == '2023' else 13
        assert len(events) == expected
        assert Counter(e['grade'] for e in events) == {'JpnI': expected - 1, 'G1': 1}
        assert len({e['key'] for e in events}) == expected
        assert all(e['year'] == int(year) and e['date'].startswith(year + '-') for e in events)
        assert all('www.jra.go.jp' not in (e['detail_url'] or '') for e in events)
        for event in events:
            if event['scheduled_start_at']:
                assert datetime.fromisoformat(event['scheduled_start_at']).date().isoformat() == event['date']
        rec = next(p for p in r['requests'] if p['url'] == events[0]['parent_url'])
        assert nar_annual_events((ROOT / rec['evidence']).read_text(), rec['url']) == events
    checks['nar_annual_instances_by_year'] = {year: len(events) for year, events in sorted(years.items())}
    assert len(r['nar_home_cards']) == 3 and not r['home_cards_missing_from_annual']
    checks['root_cards_in_annual_list'] = True
    introductions = [e for e in r['nar_current'] if e['detail_link_status'] == 'introduction']
    assert len(introductions) == 2 and all(e['scheduled_start_at'] is None for e in introductions)
    checks['future_introduction_links_preserved_without_fabricated_draw_or_time'] = 2
    url = 'https://www.keiba.go.jp/dirtgraderace/2026/racelist/index.html'
    def fixture(name, grade, course, anchor=''):
        inside = f'<p>12月6日(日)</p><h4 class="{grade}">{name}</h4><p>{course} 右1800m</p>'
        return f'<li class="js-item"><a href="{anchor}">{inside}</a></li>' if anchor else f'<li class="js-item">{inside}</li>'
    content = '<title>レース一覧 2026年</title><ul>' + fixture('local-without-link', 'jpn1', '大井') + fixture('central-without-link', 'g1', '中京') + fixture('lower-grade', 'jpn2', '大井') + '</ul>'
    synthetic = nar_annual_events(content, url)
    assert len(synthetic) == 1 and synthetic[0]['detail_url'] is None and synthetic[0]['detail_link_status'] == 'not_published'
    checks['unlinked_local_date_kept_and_central_or_lower_grade_excluded'] = True
    for bad in ['', content.replace('2026年', '2025年')]:
        try: nar_annual_events(bad, url)
        except ValueError: pass
        else: raise AssertionError('Wrong-year or empty document accepted')
    checks['empty_or_wrong_year_document_rejected'] = True
    old = json.loads((ROOT.parent / '2026-10-26-discovery/research-catalog.json').read_text())
    old_copy = json.loads(json.dumps(old))
    combined, changes = merge(old, r['nar_current'])
    assert len(old) == 27 and len(combined) == 37 and changes['added'] == 10
    assert old == old_copy
    for key, event in old.items():
        for field in ['condition_fields', 'documents']:
            if field in event: assert combined[key][field] == event[field]
    assert merge(old, [])[0] == old
    assert merge(combined, r['nar_current'])[1]['added'] == 0
    checks['independent_cache_replay'] = {'prior_records': 27, 'new_nar_records': 10, 'retained_total': 37,
                                         'jra_data_from': '2026-10-26 saved success, not freshly fetched on 2026-10-27'}
    (ROOT / 'research-cache-replay.json').write_text(json.dumps(combined, ensure_ascii=False, indent=2))
    entry_record = next(p for p in r['requests'] if p['url'] == r['past_entry_page']['url'])
    entries = entry_horses((ROOT / entry_record['evidence']).read_text())
    results = [row for row in r['past_official_details']['result']['rows'] if len(row) == 17 and row[0].isdigit()]
    odds = [row for row in r['past_official_details']['win_odds']['rows'] if len(row) >= 12 and row[1].isdigit()]
    assert len(entries) == len(results) == len(odds) == 11
    emap = {h['number']: (h['name'], h['win_raw']) for h in entries}
    rmap = {int(row[2]): (row[3], row[15]) for row in results}
    omap = {int(row[1]): (row[2], row[3]) for row in odds}
    assert emap == rmap == omap and len(emap) == 11
    assert all(Decimal(price) >= 1 for _, price in emap.values())
    event = r['selected_nar_details'][0]['event']
    for item in r['past_official_details'].values():
        text = ' '.join(item['text'])
        assert event['name'] in text and '2026年10月12日' in text
    assert '（最終）' in ' '.join(r['past_official_details']['win_odds']['text'])
    checks['nar_past_runner_identity_name_and_final_win_agreement'] = {'entries': 11, 'finishers': 11, 'win_values': 11,
                                                                      'stage': 'historical final, not pre-race availability'}
    future_text = ' '.join(r['selected_nar_details'][1]['visible_text'])
    assert '出走予定馬' in future_text and '2026年10月29日' in future_text and '10月30日' in future_text
    checks['jbc_future_intended_entries_not_promoted_to_final_draw'] = True
    horse = r['winner_horse_profile']
    history = [row for row in horse['rows'] if re.fullmatch(r'\d{4}/\d{2}/\d{2}', row[0])]
    prior_five = sorted([row for row in history if date.fromisoformat(row[0].replace('/', '-')) < date.fromisoformat(event['date'])], key=lambda row: row[0], reverse=True)[:5]
    assert len(prior_five) == 5 and all(row[1].startswith('Ｊ') for row in prior_five)
    assert len(horse['links']) == 1 and '2026%2F10%2F12' in horse['links'][0]['href']
    checks['horse_history'] = {'profile_rows': len(history), 'prior_five': [{'date': row[0], 'course': row[1], 'name': row[3]} for row in prior_five],
                               'prior_five_detail_links_established': 0, 'prior_five_win_odds_established': False,
                               'limitation': 'Five prior central starts are listed, but this NAR profile links only the current local race; no fabricated history URLs'}
    failures = [p for p in r['requests'] if p['status'] != 200]
    assert len(failures) == 1 and failures[0]['status'] is None and 'redirect.js' in failures[0]['url']
    checks['japan_navigation_failure'] = {'origin_http_status': None, 'error': failures[0]['error'], 'prior_cache_retained': True}
    checks['requests_by_status'] = dict(Counter(str(p['status']) for p in r['requests']))
    return checks


if __name__ == '__main__':
    result = check()
    (ROOT / 'field-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))

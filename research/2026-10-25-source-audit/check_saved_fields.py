"""Offline checks of the saved source samples, not a production scraper.

Grain: one annual ranking row, one race runner, or one horse start. HTTP 200,
complete runner rows and successful discovery are deliberately separate facts.
Only local evidence is read; importing this module never makes a request.
"""
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal
from html import unescape
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_text())


def clean(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', '', value))).strip()


def check():
    http = read('http-probe.json')['sources']
    ranking = read('ifha_rank_2025.rows.json')[1:]
    old_rank = json.loads((ROOT.parent / 'ifha-top100-2025-raw.json').read_text())['rows']
    assert len(ranking) == 100 and all(len(row) == 11 for row in ranking)
    assert len({(row[1], row[6], row[7]) for row in ranking}) == 100
    assert ranking == old_rank
    assert all(Decimal(row[10]) > 0 for row in ranking)

    raw = (ROOT / 'nar_teio_2025_entries.response').read_text()
    pattern = re.compile(
        r'<td[^>]*class="horseNum"[^>]*>(?P<no>.*?)</td>.*?'
        r'<a class="horseName"[^>]*href="(?P<href>[^"]+)"[^>]*>(?P<name>.*?)</a>.*?'
        r'<a class="jockeyName"[^>]*>(?P<jockey>.*?)</a>.*?'
        r'<span class="odds_Black\s*">(?P<odds>.*?)</span>', re.S)
    entries = [{'no': int(clean(m['no'])), 'name': clean(m['name']),
                'source_id': re.search(r'k_lineageLoginCode=(\d+)', m['href'])[1],
                'win_odds_raw': clean(m['odds']) or None} for m in pattern.finditer(raw)]
    nar = [row for row in read('nar_teio_2025_result.rows.json')
           if len(row) == 17 and (row[0].isdigit() or row[0] == '除外')]
    assert len(entries) == len(nar) == 14
    assert len({row['source_id'] for row in entries}) == 14
    assert {row['no']: row['name'] for row in entries} == {int(row[2]): row[3] for row in nar}
    assert sum(row[0].isdigit() for row in nar) == 13
    assert all(row[15] == '' for row in nar) and all(row['win_odds_raw'] is None for row in entries)

    hk = [row for row in read('hkjc_cup_2025_result.rows.json') if len(row) == 12 and row[0].isdigit()]
    assert len(hk) == 7 and sorted(int(row[0]) for row in hk) == list(range(1, 8))
    assert len({row[1] for row in hk}) == 7
    assert all(Decimal(row[11]) >= 1 for row in hk)
    assert hk[0][2] == '浪漫勇士 (E486)' and hk[0][11] == '1.1'

    de = [row for row in read('de_baden_2025.rows.json') if len(row) == 11 and re.fullmatch(r'\d+\.', row[0])]
    de_entries = [row for row in read('de_baden_2025.rows.json') if len(row) == 9 and row[0].isdigit()]
    de_ns = sorted(set(row[0] for row in de_entries) - set(row[2] for row in de))
    assert len(de) == 6 and len(de_entries) == 8 and de_ns == ['5', '7']
    assert de[0][1] == 'Goliath' and de[0][-1] == '2,9'
    assert 'Quoten zu 1 €: Siegwette 2,9' in (ROOT / 'de_baden_2025.text.txt').read_text()
    assert all(Decimal(row[-1].replace(',', '.')) >= 1 for row in de)

    # Do not zip this header to rows: its colspans give different widths.
    horse = [row for row in read('nar_horse_mikki_fight.rows.json') if re.fullmatch(r'\d{4}/\d{2}/\d{2}', row[0])]
    cutoff = date(2025, 7, 2)
    before = sorted([row for row in horse if date.fromisoformat(row[0].replace('/', '-')) < cutoff], key=lambda row: row[0], reverse=True)[:5]
    assert len(before) == 5 and before[0][0] == '2025/04/19'
    assert before[-1][0] == '2024/08/04'
    assert any(row[0].startswith('2026/') for row in horse)

    upcoming = read('hkjc_upcoming.json')['data']['commonMeetings']
    profiles = read('hkjc_discovered_meeting.json')['data']['raceMeetingProfile']
    observed = {(m['date'], m['venueCode']) for m in upcoming}
    assert all((m['date'], m['venueCode']) in observed for m in profiles)
    runners = [runner for m in profiles for race in m['races'] for runner in race['runners']]
    assert len(runners) == 18 and all(r['horse']['id'] for r in runners)
    assert all(Decimal(r['winOdds']) >= 1 for r in runners)
    assert all(m['status'] == 'CLOSED' for m in profiles)
    assert read('hkjc_discovered_horse.json')['data']['simulcastHorse'] == []

    current = read('hkjc_cox_2025_repeat.json')['data']['raceMeetingProfile']
    previous = json.loads((ROOT.parent / '2026-10-22-fetch-check/hkjc-cox-query.decoded.json').read_text())['data']['raceMeetingProfile']
    cox = next(r for m in current for r in m['races'] if r['raceName_en'] == 'Cox Plate')
    old_cox = next(r for m in previous for r in m['races'] if r['raceName_en'] == 'Cox Plate')
    fields = ['id', 'no', 'raceName_en', 'postTime', 'distance', 'raceClass_en', 'runners', 'raceResults']
    assert all(cox[k] == old_cox[k] for k in fields)
    assert cox['id'] == '20251025S109' and cox['no'] == 10

    jbc_text = (ROOT / 'nar_discovered_jbc_2026.text.txt').read_text()
    assert '10月30日(金)' in jbc_text and '出走予定馬' in jbc_text
    discovery = read('discovery-probe.json')['records'][-1]
    assert discovery['discovered_href'] in next(s for s in http if s['name'] == 'nar_directory_root')['links']

    # The US HTML has embedded JSON metadata, although it has no HTML table.
    us_raw = (ROOT / 'us_bcc_2025.response').read_text()
    embedded = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', us_raw)[1])
    blocks = embedded['props']['pageProps']['blocks']
    us_race = blocks[1]['heroBanner']['leftHeroConfigFields']['raceDetails'][0]
    assert us_race['raceDetails']['purse'] == '$7,000,000'
    assert us_race['raceDetails']['grade'] == 1
    us_result_tab = next(t for t in blocks[2]['tabs']['tabs'] if t['title'] == 'Results')
    assert 'contentId' in us_result_tab and 'content' not in us_result_tab

    return {
        'checked_at': datetime.now(timezone.utc).isoformat(),
        'scope': 'Saved representative samples only; no annual coverage percentage or future publication stability established',
        'http': {'requests': len(http), 'status_counts': dict(Counter(str(s['status']) for s in http))},
        'ranking': {'rows': len(ranking), 'columns': 11, 'unique_race_track_country': 100,
                    'country_counts': dict(Counter(row[7] for row in ranking)), 'same_as_previous_snapshot': True},
        'nar_teio': {'entries': len(entries), 'finishers': 13, 'excluded': 1, 'runner_odds_present': 0, 'runner_odds_denominator': 14},
        'hkjc_cup': {'finishers': 7, 'runner_odds_present': 7, 'runner_odds_denominator': 7},
        'germany': {'entries': 8, 'finishers': 6, 'nonstarter_numbers': de_ns, 'runner_odds_present': 6, 'runner_odds_denominator': 6,
                    'winner_quote_raw': '2,9', 'winner_quote_decimal': '2.9', 'margin_meaning': 'Preserve raw Abstand; do not relabel as lengths behind winner'},
        'horse_history': {'source_rows': len(horse), 'cutoff_exclusive': cutoff.isoformat(),
                          'prior_five': [{'date': row[0], 'name_raw': row[3]} for row in before], 'full_prior_start_odds': 'not established'},
        'hkjc_discovery': {'meetings': len(upcoming), 'discovered_runners': len(runners), 'odds_present': 18,
                           'meeting_status': 'CLOSED', 'date': profiles[0]['date'], 'horse_profile_rows': 0,
                           'limitation': 'Same-day completed race; not future annual discovery or pre-race odds proof'},
        'hkjc_historical_repeat': {'race_id': cox['id'], 'display_race_no': cox['no'], 'selected_fields_equal': True,
                                   'limitation': 'Two historical snapshots do not test live publication or corrections'},
        'nar_discovery': {'parent_href_followed': True, 'child_status': discovery['status'],
                          'declarations_state': 'intended runners, not final draw', 'draw_expected_date': '2026-10-30'},
        'us_embedded': {'name': us_race['raceName'], 'date_raw': us_race['raceDetails']['date'],
                        'purse_raw': '$7,000,000', 'grade': 1, 'runner_result_table_in_snapshot': False},
    }


if __name__ == '__main__':
    result = check()
    (ROOT / 'field-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))

"""Offline evidence checks. No requests; no production data or wallet writes."""
from datetime import datetime, timezone
from html import unescape
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent


def load(name):
    return json.loads((ROOT / name).read_text())


def check():
    annual = load('jra_english_2026.rows.json')
    g1 = [{'heading_raw': annual[i - 1][0], 'grade': row[0], 'course': row[1],
           'distance_surface_raw': row[2], 'age_sex_raw': row[3], 'first_prize_jpy': int(row[4].replace(',', ''))}
          for i, row in enumerate(annual) if row[0] == 'G1']
    assert len(g1) == 24 and len({row['heading_raw'] for row in g1}) == 24
    arima = next(row for row in g1 if 'ARIMA KINEN' in row['heading_raw'])
    assert arima['heading_raw'].startswith('Dec. 27') and arima['distance_surface_raw'] == '2,500/Turf'
    assert arima['course'] == 'NAKAYAMA' and arima['first_prize_jpy'] == 500000000
    discovery = load('discovery-probe.json')['records']
    assert len(discovery) == 4 and all(x['status'] == 200 for x in discovery)
    seeds = load('http-probe.json')['sources']
    assert len(seeds) == 2 and all(x['status'] == 200 for x in seeds)
    for name in ['arima_discovered_2026', 'kikuka_discovered_2026']:
        entry = next(x for x in discovery if x['name'] == name)
        assert entry['observed_href'] in (ROOT / 'jra_english_2026.response').read_text()
    arima_rows = load('arima_discovered_2026.rows.json')
    assert next(row[1] for row in arima_rows if row[0] == 'Prize Money for the Winner') == '¥500,000,000'
    # The text contains both a prior-year winner and future-race conditions.
    arima_text = (ROOT / 'arima_discovered_2026.text.txt').read_text()
    assert '2025 Winner : Museum Mile' in arima_text and 'Sunday, 27 December 2026' in arima_text
    assert '/about US$000' in ''.join(''.join(row) for row in arima_rows)

    entries = load('era_discovered_entries.rows.json')
    results = load('era_discovered_results.rows.json')
    assert len(entries) == len(results) == 11
    assert all(len(row) == 11 for row in entries) and all(len(row) == 16 for row in results)
    entry_names = {int(row[0]): row[5] for row in entries}
    result_names = {int(row[3].split()[0]): row[9] for row in results}
    assert len(entry_names) == len(result_names) == 11 and entry_names == result_names
    assert sorted(int(row[0]) for row in results) == list(range(1, 12))
    assert results[0][9] == 'HIT SHOW (USA)' and results[0][-1] == '41'
    assert all(re.fullmatch(r'\d+(?:\.\d+)?(?: Fav)?', row[-1]) for row in results)
    assert all(re.search(r'Jockey: .+ Rating: .+ Time: .+ Trainer: .+ Weight:', row[5]) for row in results)
    original = ROOT.parent / '2026-10-25-source-audit/era_dwc_2025.text.txt'
    assert 'USD 12,000,000' in original.read_text() and '1st 6,960,000' in original.read_text()
    assert all(x['observed_data_src'] in unescape((ROOT.parent / '2026-10-25-source-audit/era_dwc_2025.response').read_text())
               for x in discovery if x['name'].startswith('era_'))
    return {'checked_at': datetime.now(timezone.utc).isoformat(),
            'scope': 'Two seed requests and four observed-link requests; representative evidence only',
            'japan_english': {'publisher': 'JAIRS / Horse Racing in Japan', 'year': 2026, 'flat_g1_count': len(g1),
                              'arima': arima, 'discovered_detail_status': 200,
                              'detail_kind': 'conditions and prior-year winner, not current-race runners or results',
                              'limits': ['No direct JRA Japanese result access established', 'English names need identity mapping; do not replace Japanese display names', 'Total Value purse scope unverified', 'USD 000 is a placeholder, not a zero conversion']},
            'era': {'date': '2025-04-05', 'race_no': 9, 'entries': 11, 'results': 11, 'names_and_numbers_match': True,
                    'raw_sp_populated': 11, 'winner': results[0][9], 'winner_sp_raw': results[0][-1],
                    'purse_usd': 12000000, 'winner_prize_usd': 6960000,
                    'results_summary': [{'position': int(row[0]), 'horse_number_draw_raw': row[3], 'name_raw': row[9], 'margin_raw': row[1], 'starting_price_raw': row[-1]} for row in results],
                    'limits': ['Starting price market/format still unverified; not normalized or used for purchases', 'No pre-race quote refresh or official correction lifecycle proved', 'Mother-sire and full as-of five-start coverage not established', 'One historic race does not establish annual top100 coverage']}}


if __name__ == '__main__':
    value = check()
    (ROOT / 'field-checks.json').write_text(json.dumps(value, ensure_ascii=False, indent=2))
    print('PASS: 24 flat G1 schedule rows, Arima observed-link conditions; prior-year winner/USD placeholders kept distinct; ERA 11 entries match 11 results and 11 raw SP values; raw purse amounts checked.')

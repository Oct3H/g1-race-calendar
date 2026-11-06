"""Offline, sample-level checks of publication stage, identity and results.

No requests or production writes. PDF tables were extracted with bundled
pdfplumber and visually checked; this script does not require that dependency.
"""
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent


def load(name, root=ROOT):
    return json.loads((root / name).read_text())


def canonical(name):
    return re.sub(r'\s+', '', name).replace('’', "'").casefold()


def race_from(document, name):
    return next((meeting, race) for meeting in document['data']['raceMeetingProfile']
                for race in meeting['races'] if race['raceName_en'] == name)


def check():
    # Empty response is observed and valid JSON, not evidence of cancellation.
    assert load('upcoming.http.json')['status'] == 200
    assert load('upcoming.json') == {'data': {'commonMeetings': []}}
    entry_rows = load('hkjc_tenno_entries.rows.json')
    entries = [row for row in entry_rows if len(row) == 2 and row[0].endswith('(JPN)')]
    assert len(entries) == len({row[0] for row in entries}) == 17
    program = (ROOT / 'hkjc_future_program.text.txt').read_text()
    assert 'Announcement of final declarations with barrier draws: 30 October (Fri).' in program
    assert '1 November (Sun)' in program
    bc = load('bcc_preentries.embedded.json')['props']['pageProps']['blocks'][3]['horseCards']['races']
    classic = next(race for race in bc if race['raceName'] == "Breeders' Cup Classic")
    assert classic['raceDetails']['date'] == '2026-10-31T22:16:00.000Z'
    assert classic['raceDetails']['isCompleted'] is False
    assert len(classic['horses']) == len({h['uid'] for h in classic['horses']}) == 10
    assert all(h['year'] == 2026 and h['morningLineOdds'] == [] and h['win'] == '' for h in classic['horses'])
    future = [{'name': 'Tenno Sho (Autumn)', 'stage': 'entries, not final draw', 'entries': 17, 'qualified_win_quotes': 0,
               'start_at': '2026-11-01T14:40:00+08:00', 'start_time_source': 'HKJC public program, subject to change'},
              {'name': "Breeders' Cup Classic", 'stage': 'pre-entries', 'entries': 10, 'qualified_win_quotes': 0,
               'start_at': classic['raceDetails']['date'], 'shanghai_day': '2026-11-01'}]

    # An archived page titled Morning Line explicitly identifies actual JRA pools.
    quotes = load('ja-prerace-odds.tables.json')[0][0][1:]
    assert len(quotes) == 18 and all(len(row) == 5 for row in quotes)
    pdf_text = (ROOT / 'ja-prerace-odds.text.txt').read_text()
    assert 'JRA pari-mutuel pool odds as of 17:30 on Saturday' in pdf_text
    draw = [row for row in load('ja_kikuka_draw.rows.json') if len(row) == 10 and row[1].isdigit()]
    results = [row for row in load('ja_kikuka_result.rows.json') if len(row) == 9 and row[0].isdigit()]
    assert len(draw) == len(results) == 18
    by_no = {int(row[1]): row for row in draw}
    assert set(by_no) == {int(row[1]) for row in quotes} == set(range(1, 19))
    assert all(canonical(row[2]) == canonical(by_no[int(row[1])][2]) and Decimal(row[3]) >= 1 for row in quotes)
    assert sorted(int(row[0]) for row in results) == list(range(1, 19))
    result_names = {int(row[2]): re.match(r'(.+?\([A-Z]{2,3}\))', row[3])[1] for row in results}
    assert all(canonical(name) == canonical(by_no[number][2]) for number, name in result_names.items())
    winner = results[0]
    assert int(winner[2]) == 9 and winner[5] == '12.0 (3)'
    payoff = next(row for row in load('ja_kikuka_result.rows.json') if row[0] == 'Win')
    assert payoff[1:3] == ['No.9', '¥ 1,200']
    assert Decimal('12.0') * 100 == Decimal('1200')

    result_root = ROOT.parent / '2026-10-26-results'
    doc = load('kikuka_results.json', result_root)
    meeting, hk = race_from(doc, 'Kikuka Sho (Japanese St. Leger)')
    assert hk['raceResults'][0]['status'] == 'WCFULLMARGIN'
    assert any(sign['value_en'] == 'WEIGHED IN' for sign in hk['judgeSigns'])
    assert len(hk['runners']) == 18 and all(r['status'] == 'Ran' and r['deadHeat'] is False for r in hk['runners'])
    assert {int(r['no']): r['finalPosition'] for r in hk['runners']} == {int(r[2]): int(r[0]) for r in results}
    hk_winner = next(r for r in hk['runners'] if r['finalPosition'] == 1)
    assert hk_winner['no'] == '9' and hk_winner['winOdds'] == '13'
    odds = load('kikuka_win_time.json', result_root)['data']['raceMeetingProfile'][0]['pmPools'][0]
    assert len(odds['oddsNodes']) == 18
    assert datetime.fromisoformat(odds['lastUpdateTime']) > datetime.fromisoformat(hk['postTime'])
    raw_node = next(x for x in odds['oddsNodes'] if x['combString'] == '09')
    assert raw_node['oddsValue'] == '13'
    locked = next(row[3] for row in quotes if row[1] == '9')
    assert locked == '12.6' and locked != '12.0' and locked != hk_winner['winOdds']
    replay = {'race_id': hk['id'], 'start_at': hk['postTime'], 'horse_number': 9,
              'horse_name': result_names[9], 'locked_quote': locked, 'jra_final_quote': '12.0',
              'hkjc_final_quote': '13', 'winners': [9], 'snapshot_at': '2026-10-24T17:30:00+09:00',
              'source': 'JRA pari-mutuel pool odds published by JAIRS; archived Saturday snapshot',
              'scope': 'Offline historical replay, not a live pre-race observation or production purchase'}

    request = load('kikuka_horse_correct_shape.request.json', result_root)['variables']
    assert request == {'ids': [hk_winner['id']], 'meetingDate': '20261025', 'raceNumber': '1'}
    assert hk_winner['id'] != hk_winner['horse']['id']
    profile = load('kikuka_horse_correct_shape.json', result_root)['data']['simulcastHorse']
    assert len(profile) == 1
    profile = profile[0]
    assert profile['age'] == 3 and profile['gender']['code'] == 'c' and profile['countryOfOrigin']['code'] == 'JPN'
    assert all(profile[k] for k in ['sire', 'dam', 'sireOfDam']) and profile['trainer']['name_en'] == 'Yuki Uehara'
    forms = load('kikuka_prior_forms.json', result_root)['data']['simulcastHorse'][0]['horseFormRecord']
    assert len(forms) == 5 and len({form['date'] for form in forms}) == 5
    assert all(re.fullmatch(r'\d{4}-\d{2}-\d{2}\+08:00', form['date']) and form['date'][:10] < '2026-10-25' for form in forms)
    assert all(form['raceName']['english'] and form['className']['code'] and form['placeNo'] and form['winOdds'] for form in forms)
    # These are contextual parent IDs, not identities of the five prior races.
    assert {form['raceId'] for form in forms} == {hk['id']}
    assert len({form['id'] for form in forms}) == 1
    horse_summary = {'sample_count': 1, 'source_runner_id': hk_winner['id'], 'six_basic_fields_present': True,
                     'prior_five': [{'source_date': form['date'], 'name': form['raceName']['english'],
                                     'grade_raw': form['className']['code'], 'placing_raw': form['placeNo'], 'odds_raw': form['winOdds']} for form in forms],
                     'detail_link_status': 'Unresolved: returned raceId/id/raceNo are parent context; do not open the current race as a prior-race detail'}

    region_root = ROOT.parent / '2026-10-26-regions'
    cases = [('fr_arc', "Prix de l'Arc de Triomphe", 18, 17, 'Daryz (FR)'),
             ('gb_champions', 'Champion Stakes', 11, 11, 'Calandagan (IRE)'),
             ('ire_champions', 'Irish Champion Stakes', 8, 8, 'Delacroix (IRE)'),
             ('us_bc', "Breeders' Cup Classic", 10, 9, 'Forever Young (JPN)'),
             ('ksa_saudi', 'Saudi Cup', 15, 14, 'Forever Young (JPN)')]
    region_summary = []
    for file, name, total, count, champion in cases:
        value = load(file + '.json', region_root)
        assert not value.get('errors')
        source_meeting, race = race_from(value, name)
        ran = [r for r in race['runners'] if r['status'] == 'Ran']
        not_ran = [r for r in race['runners'] if r['status'] in ['Scratched', 'ScratchedReserved']]
        assert len(race['runners']) == total and len(ran) == count and len(not_ran) == total - count
        assert len({r['id'] for r in race['runners']}) == total
        assert sorted(r['finalPosition'] for r in ran) == list(range(1, count + 1))
        assert all(r['winOdds'] and Decimal(r['winOdds']) >= 1 and r['deadHeat'] is False for r in ran)
        assert all(r['finalPosition'] == 0 for r in not_ran)
        assert next(r['horse']['name_en'] for r in ran if r['finalPosition'] == 1) == champion
        assert race['raceResults'][0]['status'] == 'WCFULLMARGIN'
        assert any(s['value_en'] == 'WEIGHED IN' for s in race['judgeSigns'])
        local_day = datetime.fromisoformat(race['postTime']).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
        region_summary.append({'country': race['country_en'], 'race': name, 'id': race['id'], 'display_no': race['no'],
                               'source_meeting_date': source_meeting['date'], 'shanghai_day': local_day,
                               'runners': total, 'finishers': count, 'not_ran': [{'name': r['horse']['name_en'], 'status': r['status']} for r in not_ran], 'raw_win_values': count,
                               'winner': champion, 'market_semantics': 'HKJC-published WIN; per-market normalization not inferred from country'})
    ireland = next(x for x in region_summary if x['country'] == 'Ireland')
    assert ireland['source_meeting_date'] == '2025-09-13' and ireland['shanghai_day'] == '2025-09-14'
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'client_date': '2026-10-26',
              'future_samples': future, 'japan_archive': {'draw_rows': 18, 'pre_race_quotes': 18, 'result_rows': 18,
              'snapshot_at': replay['snapshot_at'], 'jra_winner_quote': '12.0', 'hkjc_winner_quote': '13',
              'hkjc_quote_source_time': odds['lastUpdateTime'], 'champion_cross_source_agrees': True},
              'historical_replay': replay, 'horse_sample': horse_summary, 'regional_fallback_samples': region_summary,
              'limits': ['All quotations fetched after the sampled historical races; no live future-release lifecycle observed',
                         'No bulk annual coverage rate, automatic correction discovery or SLA established',
                         'Do not overwrite one market with a different market quote or interpret an empty feed as cancellation']}
    return report


if __name__ == '__main__':
    report = check()
    (ROOT / 'sequence-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('PASS: current future entries stay unconfirmed/unpriced; 18-row JRA draw/actual Saturday quote/result identity; independent HKJC champion and source-time checks; five regional result samples, IDs and cross-day source date.')

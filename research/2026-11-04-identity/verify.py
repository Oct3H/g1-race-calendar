"""Reconcile saved source responses with facts checked in public JRA pages."""
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / '2026-10-26-discovery'))
from discover import Page

# Transcribed factual fields from the JRA result, viewed through the web tool.
# This is a comparison fixture. Ordinary HTTP access is measured separately.
JRA_RESULT = 'https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde1005202604111120261101%2F41'
JRA_ROWS = [
    (17, 'ダノンデサイル'), (10, 'ネブラディスク'), (3, 'レガレイラ'),
    (14, 'タガノデュード'), (1, 'クロワデュノール'), (11, 'シェイクユアハート'),
    (8, 'ジュンブロッサム'), (15, 'サクラファレル'), (12, 'コスモキュランダ'),
    (6, 'セイウンハーデス'), (7, 'マスカレードボール'), (16, 'ジョバンニ'),
    (5, 'シャンパンカラー'), (9, 'ホウオウビスケッツ'), (13, 'リアライズシリウス'),
    (2, 'エルトンバローズ'), (4, 'レディネス'),
]
JRA_HORSE = 'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud102022103264%2F18'
# Literal links followed from JRA_HORSE, with fields checked on each result page.
HISTORY = [
    ('2026/07/26', '中京', 7, 1400, 11, 2, '1:22.9', '東海ステークス', 'pw01sde1007202602020720260726%2FF1'),
    ('2026/05/31', '東京', 9, 1600, 14, 1, '1:35.3', 'ARF杯薫風ステークス', 'pw01sde1005202602120920260531%2F8A'),
    ('2026/04/25', '東京', 10, 1400, 4, 2, '1:23.7', '鎌倉ステークス', 'pw01sde1005202602011020260425%2F1B'),
    ('2026/02/14', '東京', 10, 1400, 5, 2, '1:23.8', '銀蹄ステークス', 'pw01sde1005202601051020260214%2FA9'),
    ('2025/11/16', '東京', 7, 1400, 7, 1, '1:24.2', '3歳以上2勝クラス', 'pw01sde1005202505040720251116%2FAB'),
]


def normalize_name(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split()).casefold()


def main():
    captures = {}
    for path in sorted((ROOT / 'live').glob('*.http.json')):
        record = json.loads(path.read_text())
        data = (path.parent / f"{record['name']}.response").read_bytes()
        assert sha256(data).hexdigest() == record['sha256']
        captures[record['name']] = {'url': record['url'], 'status': record['status'], 'error': record.get('error')}
    assert captures['jairs_tenno']['status'] == 200
    page = Page((ROOT / 'live/jairs_tenno.response').read_text())
    header = ' '.join(page.text)
    assert all(field in header for field in ['November 1, 2026', 'Tokyo Racecourse', '11th Race', '15:40', '2,000'])
    english = [row for row in page.rows if len(row) == 9 and row[0].isdigit() and re.fullmatch(r'\d+(?: B)?', row[2])]
    assert len(english) == len(JRA_ROWS) == 17
    earlier = ROOT.parent / '2026-10-31-publication'
    draw = json.loads((earlier / 'draw-rows.json').read_text())
    draw_names = {int(row[1]): normalize_name(row[2].split('(JPN)')[0]) for row in draw}
    assert len(draw_names) == 17
    names = []
    for rank, (row, (number, japanese)) in enumerate(zip(english, JRA_ROWS, strict=True), 1):
        assert int(row[0]) == rank and int(row[2].split()[0]) == number
        name = row[3].split('(JPN)')[0].strip()
        assert normalize_name(name) == draw_names[number]
        names.append({'number': number, 'rank': rank, 'post_position_raw': row[2], 'ja': japanese, 'en': name, 'final_win': row[5].split()[0]})
    assert len({row['number'] for row in names}) == len({row['ja'] for row in names}) == 17
    assert names[0]['en'] == 'Danon Decile' and names[0]['ja'] == 'ダノンデサイル'

    old = json.loads((ROOT.parent / '2026-10-27-japan/japan-audit.json').read_text())
    profile = old['winner_horse_profile']
    assert profile['selected_from_official_result'] == 'メイショウハチロー'
    previous = sorted(
        (row for row in profile['rows'] if len(row) >= 15 and re.fullmatch(r'\d{4}/\d{2}/\d{2}', row[0]) and row[0] < '2026/10/12'),
        key=lambda row: row[0], reverse=True,
    )[:5]
    assert len(previous) == 5
    links = []
    for saved, observed in zip(previous, HISTORY, strict=True):
        date, track, race, metres, number, rank, seconds, title, query = observed
        assert (saved[0], saved[1].removeprefix('Ｊ'), int(saved[2]), int(saved[5]), int(saved[11]), int(saved[13]), saved[14]) == observed[:7]
        links.append({'date': date, 'track': track, 'race': race, 'distance_m': metres, 'horse_number': number,
                      'rank': rank, 'time': seconds, 'title': title,
                      'url': 'https://www.jra.go.jp/JRADB/accessS.html?CNAME=' + query})
    assert len({item['url'] for item in links}) == 5
    report = {
        'date': '2026-11-04',
        'status': 'verified_sample_with_access_gaps',
        'ordinary_http': captures,
        'tenno': {'race': ['2026-11-01', 'Tokyo', 11, 'Turf', 2000],
                  'jra_web_result': JRA_RESULT, 'jairs_http_result': captures['jairs_tenno']['url'], 'matched': names,
                  'identity_sample': {'ja': 'ダノンデサイル', 'en': 'Danon Decile', 'date_of_birth': '2021-04-06',
                                      'profile': 'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud102021105143%2FA6'}},
        'history': {'horse': profile['selected_from_official_result'], 'nar_profile': profile['url'],
                    'jra_web_profile': JRA_HORSE, 'web_checked_links': links},
    }
    (ROOT / 'verified.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('PASS: 17 horse-number/rank and prior-draw joins, 5 historical identities, captured response hashes.')


if __name__ == '__main__':
    main()

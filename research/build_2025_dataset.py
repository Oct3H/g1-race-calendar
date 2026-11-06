"""Build the static date-comparison dataset from the reviewed local source files.

No network requests. Raw snapshots remain unchanged. The explicit ranking crosswalk
is reviewed separately; similarity scores never decide production membership.
"""
import collections
import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / 'research'
SOURCE_FILES = [
    'europe-north-america-g1-2025.json',
    'japan-asia-g1-2025.json',
    'southern-g1-2025.json',
    'south-america-g1-2025.json',
]
GERMAN_NAMES = {
    'Baden': 'Grosser Preis von Baden',
    'Diana': 'Preis der Diana (German Oaks)',
    'Deutsches Derby': 'Deutsches Derby',
    'Berlin': 'Grosser Preis von Berlin',
    'Europa': 'Preis von Europa',
    'Dallmayr': 'Grosser Dallmayr-Preis',
    'Bayern': 'Grosser Preis von Bayern',
}
PRIORITY_NAMES = {
    '皐月賞', '東京優駿（日本ダービー）', '菊花賞', '桜花賞',
    '優駿牝馬（オークス）', '秋華賞', '宝塚記念', '有馬記念',
}


def read_json(path):
    return json.loads(path.read_text())


def prepare_race(record):
    race = dict(record)
    race.setdefault('grade', 'g1')
    race['grade'] = race['grade'].lower()
    race.setdefault('canonical_name', race['name'])
    if 'id' not in race:
        suffix = hashlib.sha256(race['name'].encode()).hexdigest()[:8]
        race['id'] = f"{race['country'].lower()}-{race['date']}-{suffix}"
    race['date_precision'] = 'day'
    if race['country'] == 'GER':
        race['name'] = next(name for key, name in GERMAN_NAMES.items() if key in race['name'])
        race['canonical_name'] = race['name']
    race['name'] = race['name'].replace('St Jamess', "St James's").replace('Prince Of Waless', "Prince of Wales's")
    # Unknown status means only the published date was checked, not a full result.
    race['verification_status'] = race.get('verification_status', race.get('date_status', 'published_source'))
    if race['country'] == 'JPN':
        race['verification_summary'] = '已对照 JRA／NAR 的 2025 年官方目录；保留赛场当地日期。'
    elif race['country'] == 'HK':
        race['verification_summary'] = '已对照香港 2024/25 与 2025/26 两马季官方资料，取 2025 自然年日期。'
    elif race['country'] == 'UAE':
        race['verification_summary'] = '已对照阿联酋 2025 年官方赛程与等级目录，排除纯血阿拉伯马赛。'
    elif race['verification_status'] in ('actual_result', 'actual_result_verified', 'official_programme_and_result_report'):
        race['verification_summary'] = '日期已对照赛果或赛后记录；保留赛场当地日期。'
    else:
        race['verification_summary'] = '日期依据公开的官方赛程或比赛资料；尚未逐场核对完整赛果。'
    for field in ['name', 'canonical_name', 'track', 'verification_note']:
        race[field] = ''.join(c for c in str(race[field]) if ord(c) >= 32).strip()
    return race


def build():
    races = [prepare_race(race) for file in SOURCE_FILES for race in read_json(RESEARCH / file)['races']]
    crosswalk = read_json(RESEARCH / 'ranking-crosswalk-2025.json')
    rankings = read_json(RESEARCH / 'ifha-top100-2025-raw.json')
    by_id = {race['id']: race for race in races}
    assert len(by_id) == len(races), 'Duplicate instance IDs'
    assert len(rankings['rows']) == len(crosswalk['matches']) == 100
    assert len({match['race_id'] for match in crosswalk['matches']}) == 100
    rank_by_name = {row[1]: row for row in rankings['rows']}
    for match in crosswalk['matches']:
        rank = rank_by_name[match['ranking_name']]
        race = by_id[match['race_id']]
        assert race['country'] == ('ENG' if rank[7] == 'GB' else rank[7]), match
        race['rank'] = int(rank[0])
        race['ranking_name_2025'] = rank[1]
        if race['country'] not in ('JPN', 'HK'):
            race['name'] = rank[1]
    for race in races:
        race['priority'] = race['name'] in PRIORITY_NAMES or race.get('ranking_name_2025') in (
            "LONGINES Breeders' Cup Classic", "Qatar Prix de l'Arc de Triomphe"
        )
        parsed = datetime.date.fromisoformat(race['date'])
        assert parsed.year == 2025, race
        assert race['grade'] in ('g1', 'jpn1'), race
        assert race['surface'] in ('turf', 'dirt', 'synthetic'), race
        assert race['source_url'].startswith(('https://', 'http://')), race
        assert 'startAt' not in race, 'Do not invent precise instants from dates'
    signatures = [(race['country'], race['date'], race['name']) for race in races]
    assert len(set(signatures)) == len(races), 'Duplicate country/date/name'
    assert sum(race['priority'] for race in races) == 10
    assert sum(race['country'] == 'JPN' for race in races) == 37
    assert sum(race['grade'] == 'jpn1' for race in races) == 12
    assert sum(race.get('rank') is not None for race in races) == 100
    top = [race for race in races if race['country'] == 'JPN' or race.get('rank') is not None]
    assert len(top) == 122
    coverage = dict(sorted(collections.Counter(race['country'] for race in races).items()))
    status_counts = dict(collections.Counter(race['verification_status'] for race in races))
    dataset = {
        'year': 2025,
        'checked_on': '2026-10-21',
        'description': f"本次整理 {len(races)} 个举办实例，覆盖 {len(coverage)} 个国家／地区；B 版共 {len(top)} 场，含日本 37 场与海外前百中的 85 场。保留来源当地日期，仅用于本次密度比较。",
        'ranking_source': {'year': 2025, 'url': rankings['source']},
        'coverage': coverage,
        'verification_status_counts': status_counts,
        'notes': [
            '集合按 2025 年当地日期与当年等级整理；不含障碍赛、纯血阿拉伯马赛和海外仅国内认可的 GⅠ。日本 JpnⅠ 单独纳入。',
            '部分日期已对照赛果，部分仍以官方年度赛程为依据；赛事详情保留每条验证说明。本次不是所有赛事逐场赛果的完整核验，也不是实时资料服务。',
            '同年两届的澳大利亚 C.F. Orr Stakes 保留为两个举办实例。已采用已知改期后的日期，包括 Tancred、Jaipur／Manhattan、新西兰春季赛事。',
            '美国汇总表误标为 GⅠ 的 Cecil B. DeMille 已按赛场官方 GⅢ 排除；南非 2025 已降为 GⅡ 的 Golden Horse Sprint、Woolavington 2000 及新西兰 Levin Classic 亦不纳入。',
            '海外前百按保存的 2025 完整 100 条榜单逐项匹配；其中日本 15 场与日本全量集合合并，不重复计数。',
            '尚未收集精确发走时间，所以这里按来源当地日期显示；正式应用取得时刻后再按电脑时区换日。出马表、赔率和赏金尚未接入。',
        ],
        'sources': [
            {'label': 'IFHA · 2025 年度前百榜单', 'url': rankings['source']},
            {'label': 'IFHA · 各国主要赛事日期库（已补全缺项）', 'url': 'https://www.ifhaonline.org/default.asp?area=0&section=Racing'},
            {'label': 'JRA · 2025 年 GⅠ 赛果目录', 'url': 'https://www.jra.go.jp/datafile/seiseki/replay/2025/g1.html'},
            {'label': 'NAR · 2025 年泥地等级赛目录', 'url': 'https://www.keiba.go.jp/dirtgraderace/2025/racelist/index.html'},
            {'label': 'TOBA · 2025 美国等级赛赛果', 'url': 'https://toba.org/graded-stakes/2025-races/'},
            {'label': 'BHA · 2025 英国平地等级赛目录', 'url': 'https://media.britishhorseracing.com/bha/Publications/Pattern_Listed_Books/British_Flat_Pattern_Listed_2025.pdf'},
            {'label': 'Racing Australia · 2025/26 等级赛日期', 'url': 'https://racingaustralia.horse/arb/Group_ListedRaceDates/2025-2026.aspx'},
            {'label': 'OSAF · 2025 拉丁美洲等级赛日历', 'url': 'https://www.osafweb.net/wp-content/uploads/Calendario-Clasico-Latinoamericano-2025-orden-cronologico.pdf'},
        ],
        'races': sorted(races, key=lambda race: (race['date'], race['country'], race['name'])),
    }
    target = ROOT / 'design/data/races-2025.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'all': len(races), 'top100_plus_japan': len(top), 'coverage': coverage, 'status_counts': status_counts}, ensure_ascii=False))


if __name__ == '__main__':
    build()

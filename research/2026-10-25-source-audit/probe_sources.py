"""Bounded read-only evidence requests; default urllib, no login/cookies/bypass.

This is an availability/shape audit, not an app adapter or coverage guarantee.
Reuses the inspected local HTML parser. Never executes downloaded source code.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import gzip
import importlib.util
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / '2026-10-22-fetch-check' / 'probe_official_sources.py'
spec = importlib.util.spec_from_file_location('previous_http_probe', OLD)
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)

SOURCES = [
    ('ifha_rank_2025', 'https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=10'),
    ('ifha_rank_index', 'https://www.ifhaonline.org/default.asp?section=Racing&area=1'),
    ('jra_2026_directory', 'https://www.jra.go.jp/datafile/seiseki/replay/2026/g1.html'),
    ('jra_arima_2026', 'https://www.jra.go.jp/keiba/g1/arima.html'),
    ('jra_arima_2025_result', 'https://www.jra.go.jp/datafile/seiseki/g1/arima/result/arima2025.html'),
    ('nar_directory_root', 'https://www.keiba.go.jp/dirtgraderace/'),
    ('nar_directory_2025', 'https://www.keiba.go.jp/dirtgraderace/2025/racelist/index.html'),
    ('nar_teio_2025_entries', 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20'),
    ('nar_teio_2025_result', 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_raceDate=2025%2F07%2F02&k_raceNo=11&k_babaCode=20'),
    ('nar_horse_mikki_fight', 'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=30097400486'),
    ('hkjc_cup_2025_result', 'https://racing.hkjc.com/zh-hk/local/information/archive/localresults?RaceNo=8&racecourse=ST&racedate=2025%2F12%2F14'),
    ('hkjc_cox_2025_shell', 'https://racing.hkjc.com/en-us/overseas/results?RaceDate=20251025&focus=Y&Racecourse=S1&RaceNo=10'),
    ('era_dwc_2025', 'https://emiratesracing.com/racecard/2025-04-05/9/results'),
    ('bha_champion_2025', 'https://www.britishhorseracing.com/racing/results/fixture-results/result/#!/2025/435/5384/0/'),
    ('hri_champion_2025', 'https://www.hri.ie/results/race-result/?meeting=2025-271&race=1730'),
    ('hri_horse_delacroix', 'https://www.hri.ie/statistics/horse/data/?hid=227935'),
    ('de_baden_2025', 'https://www.deutscher-galopp.de/gr/renntage/rennen.php?d=20250907&id=1356402&s=R'),
    ('fr_arc_2025_official_article', 'https://www.france-galop.com/fr/content/qatar-prix-de-larc-de-triomphe-daryz-offre-un-huitieme-succes-la-famille-aga-khan-record-de'),
    ('au_cox_2025', 'https://www.racing.com/form/2025-10-25/the-valley'),
    ('ksa_saudi_2025_official_article', 'https://www.jcsa.sa/en/news/20250222_tsc25_saudicup_recap'),
    ('us_bcc_2025', 'https://www.breederscup.com/races/2025-classic?tab=overview'),
]


def probe(source):
    name, url = source
    result = {'name': name, 'url': url, 'requested_at': datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(url, timeout=25) as response:
            body = response.read()
            result.update(status=response.status, final_url=response.url,
                          content_type=response.headers.get('Content-Type'),
                          headers={k.lower(): v for k, v in response.headers.items() if k.lower() in previous.SAFE_HEADERS})
    except HTTPError as error:
        body = error.read()
        result.update(status=error.code, error=str(error), final_url=error.url,
                      content_type=error.headers.get('Content-Type'),
                      headers={k.lower(): v for k, v in error.headers.items() if k.lower() in previous.SAFE_HEADERS})
    except (URLError, TimeoutError, OSError) as error:
        result.update(status=None, error_type=type(error).__name__, error=str(error))
        return result
    (ROOT / f'{name}.response').write_bytes(body)
    result.update(bytes=len(body), sha256=sha256(body).hexdigest())
    decoded = gzip.decompress(body) if result.get('headers', {}).get('content-encoding') == 'gzip' else body
    if 'text/html' in (result.get('content_type') or ''):
        charset = re.search(rb'charset\s*=\s*[\"\']?([a-zA-Z0-9_-]+)', decoded[:10000])
        header_charset = re.search(r'charset=([^; ]+)', result.get('content_type') or '', re.I)
        encoding = header_charset.group(1).strip('"\'') if header_charset else charset.group(1).decode() if charset else 'utf-8'
        text = decoded.decode(encoding, errors='replace')
        parser = previous.HTMLFields(); parser.feed(text)
        result.update(decoding=encoding, tables=parser.tables, rows=len(parser.rows), links=parser.links, script_sources=parser.scripts)
        (ROOT / f'{name}.rows.json').write_text(json.dumps(parser.rows, ensure_ascii=False, indent=2))
        (ROOT / f'{name}.text.txt').write_text('\n'.join(parser.text))
    return result


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(probe, SOURCES))
    report = {'checked_at': datetime.now(timezone.utc).isoformat(),
              'method': 'One urllib GET per listed source, two workers, no retries/cookies/credentials/browser headers or access bypass',
              'scope': 'Representative page availability/shape only; table counts are not field coverage or stability', 'sources': results}
    (ROOT / 'http-probe.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for item in results:
        print(json.dumps({key: item.get(key) for key in ['name', 'status', 'bytes', 'tables', 'rows', 'error']}, ensure_ascii=False))

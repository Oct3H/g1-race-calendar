"""Follow links observed in saved official HTML/client text. Never execute JS.

The seed requests are recorded in http-probe.json. This bounded second step
does not retry rejected JRA/BHA/HRI/France Galop paths or use credentials.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html import unescape
import importlib.util
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / '2026-10-22-fetch-check/probe_official_sources.py'
spec = importlib.util.spec_from_file_location('previous_source_parser', OLD)
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)


def targets():
    html = (ROOT / 'jra_english_2026.response').read_text()
    base = next(x['url'] for x in json.loads((ROOT / 'http-probe.json').read_text())['sources'] if x['name'] == 'jra_english_2026')
    requests = []
    for name, title in [('arima_discovered_2026', 'ARIMA KINEN'), ('kikuka_discovered_2026', 'KIKUKA SHO')]:
        href = re.search(r'<a href="([^"]+)">' + title, html)[1]
        requests.append({'name': name, 'url': urljoin(base, href), 'discovered_from': base, 'observed_href': href})
    era = (ROOT.parent / '2026-10-25-source-audit/era_dwc_2025.response').read_text()
    bundle = (ROOT / 'era_public_bundle.response').read_text()
    assert 'fetch("/ajax/"+t,{headers:{"X-Requested-With":"XMLHttpRequest"}})' in bundle
    for kind in ['entries', 'results']:
        src = re.search(r'data-src="(racecard-' + kind + r'[^"]+)"', era)[1]
        requests.append({'name': 'era_discovered_' + kind, 'url': 'https://emiratesracing.com/ajax/' + unescape(src),
                         'discovered_from': '2026-10-25-source-audit/era_dwc_2025.response', 'observed_data_src': unescape(src),
                         'route_evidence': 'era_public_bundle.response: fetch /ajax/ + data-src',
                         'headers': {'X-Requested-With': 'XMLHttpRequest'}})
    return requests


def fetch(item):
    record = {**item, 'requested_at': datetime.now(timezone.utc).isoformat()}
    try:
        request = Request(item['url'], headers=item.get('headers', {}))
        with urlopen(request, timeout=25) as response:
            body = response.read()
            record.update(status=response.status, final_url=response.url, content_type=response.headers.get('Content-Type'))
    except HTTPError as error:
        body = error.read(); record.update(status=error.code, error=str(error))
    except (URLError, TimeoutError, OSError) as error:
        record.update(status=None, error=str(error)); return record
    (ROOT / (item['name'] + '.response')).write_bytes(body)
    record.update(bytes=len(body), sha256=sha256(body).hexdigest())
    parser = previous.HTMLFields(); parser.feed(body.decode('utf-8', errors='replace'))
    record.update(tables=parser.tables, rows=len(parser.rows), links=parser.links)
    (ROOT / (item['name'] + '.rows.json')).write_text(json.dumps(parser.rows, ensure_ascii=False, indent=2))
    (ROOT / (item['name'] + '.text.txt')).write_text('\n'.join(parser.text))
    return record


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(fetch, targets()))
    (ROOT / 'discovery-probe.json').write_text(json.dumps({'method': 'One GET per observed link, no retries/cookies/credentials; ERA uses the exact AJAX format header observed in its public client', 'records': records}, ensure_ascii=False, indent=2))
    print(json.dumps([{k: x.get(k) for k in ['name', 'status', 'bytes', 'tables', 'rows', 'error']} for x in records], ensure_ascii=False))

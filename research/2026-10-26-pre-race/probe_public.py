"""Bounded ordinary requests for the pre-race audit; no browser or remote JS.

Only queries already present in the inspected HKJC public client are allowed.
No introspection, authentication, cookies, retries or access-control bypass.
Responses are never cached across audit runs as a substitute for fresh checks.
"""
from datetime import datetime, timezone
from hashlib import sha256
import gzip
import importlib.util
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / '2026-10-22-fetch-check'
spec = importlib.util.spec_from_file_location('saved_html_parser', OLD / 'probe_official_sources.py')
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)


def capture(name, url, payload=None):
    request = Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'Content-Type': 'application/json'} if payload is not None else {})
    record = {'name': name, 'url': url, 'method': request.get_method(), 'requested_at': datetime.now(timezone.utc).isoformat()}
    if payload is not None:
        (ROOT / f'{name}.request.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    try:
        with urlopen(request, timeout=25) as response:
            body = response.read()
            record.update(status=response.status, final_url=response.url,
                          headers={k.lower(): v for k, v in response.headers.items() if k.lower() in previous.SAFE_HEADERS})
    except HTTPError as error:
        body = error.read(); record.update(status=error.code, error=str(error))
    except (URLError, TimeoutError, OSError) as error:
        record.update(status=None, error=str(error)); body = b''
    (ROOT / f'{name}.response').write_bytes(body)
    record.update(bytes=len(body), sha256=sha256(body).hexdigest())
    decoded = gzip.decompress(body) if record.get('headers', {}).get('content-encoding') == 'gzip' else body
    value = None
    if payload is not None and body:
        try:
            value = json.loads(decoded)
            record['graphql_errors'] = value.get('errors')
            (ROOT / f'{name}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2))
        except (ValueError, UnicodeError) as error:
            record['decode_error'] = str(error)
    elif body and 'text/html' in record.get('headers', {}).get('content-type', ''):
        parser = previous.HTMLFields(); parser.feed(decoded.decode('utf-8', errors='replace'))
        record.update(links=parser.links, script_sources=parser.scripts, tables=parser.tables, rows=len(parser.rows))
        (ROOT / f'{name}.rows.json').write_text(json.dumps(parser.rows, ensure_ascii=False, indent=2))
        (ROOT / f'{name}.text.txt').write_text('\n'.join(parser.text))
    (ROOT / f'{name}.http.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    return record, value


def query(name, operation, variables):
    assert operation in ['SIM_getUpcomingRace', 'RaceMeetingProfile', 'RacesWinOdds', 'RaceResultsProfile', 'SimulcastHorseProfile', 'SimulcastRaceInfo']
    client = (OLD / 'public-39-oxo0t1ynu4.js').read_text()
    query_text = re.search(r'`\s*(query ' + operation + r'\b[\s\S]*?)`', client)[1]
    config = (OLD / 'public-globalConfig.js').read_text()
    endpoint = re.search(r'QIDS_URI:\s*"([^"]+)"', config)[1]
    return capture(name, endpoint, {'query': query_text, 'variables': variables})


if __name__ == '__main__':
    record, value = query('upcoming', 'SIM_getUpcomingRace', {'localSim': 'SIM', 'oddsTypes': ['WIN']})
    print(json.dumps({'http_status': record['status'], 'graphql_errors': record.get('graphql_errors'),
                      'meetings': (value or {}).get('data', {}).get('commonMeetings')}, ensure_ascii=False))

"""Bounded public, read-only HKJC queries and NAR links; no schema introspection.

Queries are copied unchanged from the inspected 2026-10-22 public client snapshot.
Only JSON Content-Type is set. No cookies, credentials, browser spoofing or retries.
"""
from datetime import datetime, timezone
from hashlib import sha256
import gzip
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from probe_sources import probe

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / '2026-10-22-fetch-check'
config = (OLD / 'public-globalConfig.js').read_text()
endpoint = re.search(r'QIDS_URI:\s*"([^"]+)"', config).group(1)
client = (OLD / 'public-39-oxo0t1ynu4.js').read_text()
records = []


def query(name, operation, variables):
    text = re.search(r'`\s*(query ' + operation + r'\b[\s\S]*?)`', client).group(1)
    payload = {'query': text, 'variables': variables}
    saved = ROOT / f'{name}.json'
    request_path = ROOT / f'{name}.request.json'
    if saved.exists() and request_path.exists() and json.loads(request_path.read_text()) == payload:
        value = json.loads(saved.read_text())
        records.append({'name': name, 'url': endpoint, 'operation': operation,
                        'variables': variables, 'reused_saved_response': True,
                        'saved_at': datetime.fromtimestamp(saved.stat().st_mtime, timezone.utc).isoformat(),
                        'errors': value.get('errors')})
        return value
    (ROOT / f'{name}.request.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    request = Request(endpoint, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    item = {'name': name, 'url': endpoint, 'operation': operation, 'variables': variables,
            'requested_at': datetime.now(timezone.utc).isoformat(), 'client_evidence': '2026-10-22-fetch-check/public-39-oxo0t1ynu4.js'}
    try:
        with urlopen(request, timeout=25) as response:
            body = response.read()
            item.update(status=response.status, content_type=response.headers.get('Content-Type'), content_encoding=response.headers.get('Content-Encoding'))
    except HTTPError as error:
        body = error.read(); item.update(status=error.code, error=str(error))
    except (URLError, TimeoutError, OSError) as error:
        item.update(status=None, error=str(error)); records.append(item); return None
    (ROOT / f'{name}.response').write_bytes(body)
    item.update(bytes=len(body), sha256=sha256(body).hexdigest())
    try:
        decoded = gzip.decompress(body) if item.get('content_encoding') == 'gzip' else body
        value = json.loads(decoded)
        item['errors'] = value.get('errors')
        (ROOT / f'{name}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2))
    except (ValueError, UnicodeDecodeError, OSError) as error:
        value = None; item['decode_error'] = str(error)
    records.append(item)
    return value


if __name__ == '__main__':
    upcoming = query('hkjc_upcoming', 'SIM_getUpcomingRace', {'localSim': 'SIM', 'oddsTypes': ['WIN']})
    meetings = (upcoming or {}).get('data', {}).get('commonMeetings') or []
    candidates = sorted([item for item in meetings if str(item.get('date', ''))[:10] >= '2026-10-25' and item.get('races')], key=lambda item: item['date'])
    if candidates:
        meeting = candidates[0]
        variables = {'date': meeting['date'][:10], 'venueCode': meeting['venueCode'], 'oddsTypes': ['WIN']}
        profile = query('hkjc_discovered_meeting', 'RaceMeetingProfile', variables)
        profiles = (profile or {}).get('data', {}).get('raceMeetingProfile') or []
        races = [race for item in profiles for race in item.get('races', [])]
        runners = [(race, runner) for race in races for runner in race.get('runners', []) if runner.get('horse', {}).get('id')]
        if runners:
            race, runner = runners[0]
            query('hkjc_discovered_horse', 'SimulcastHorseProfile', {'ids': [runner['horse']['id']], 'meetingDate': variables['date'], 'raceNumber': str(race['no'])})
    query('hkjc_cox_2025_repeat', 'RaceResultsProfile', {'date': '2025-10-25', 'venueCode': 'S1'})

    metadata = json.loads((ROOT / 'http-probe.json').read_text())['sources']
    parent = next(item for item in metadata if item['name'] == 'nar_directory_root')
    link = next((href for href in parent.get('links', []) if '1103_JBCclassic/racecard.html' in href), None)
    if link:
        child = probe(('nar_discovered_jbc_2026', urljoin(parent['url'], link)))
        child['discovered_from'] = parent['url']; child['discovered_href'] = link
        records.append(child)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(),
              'method': 'Only observed public client queries; one request per query, no authentication, introspection or retries; NAR child URL from returned parent href',
              'records': records}
    (ROOT / 'discovery-probe.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for item in records:
        print(json.dumps({key: item.get(key) for key in ['name', 'status', 'bytes', 'errors', 'error']}, ensure_ascii=False))

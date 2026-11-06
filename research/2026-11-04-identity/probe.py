"""Capture a bounded set of public pages found in official source references."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('capture', ROOT.parent / '2026-10-26-pre-race/probe_public.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
capture.ROOT = ROOT / 'live'

SOURCES = {
    'jra_tenno': 'https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde1005202604111120261101%2F41',
    'jra_horse': 'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud102022103264%2F18',
    'jra_tokai': 'https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde0107202602020720260726%2F12',
    'jairs_tenno': 'https://japanracing.jp/_news2026/261101.html',
    'jbis_history': 'https://www.jbis.or.jp/horse/0001358349/record/',
}


def fetch(item):
    name, url = item
    if (capture.ROOT / f'{name}.http.json').exists():
        raise ValueError(f'Existing capture for {name}; use saved response')
    record, _ = capture.capture(name, url)
    return name, record['status'], record.get('error')


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch, SOURCES.items()):
            print(*result, flush=True)

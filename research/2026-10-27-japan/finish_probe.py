"""Follow literal year links in a published JS template, then result/Win links.

Only parse downloaded script as text. Never execute it or guess a race URL.
"""
from datetime import date
import json
import re
from urllib.parse import urljoin
from verify_japan import ROOT, discovery

report = json.loads((ROOT / 'japan-audit.json').read_text())
runner = discovery.Runner(date.fromisoformat(report['as_of']))
runner.records = report['requests']
for record in runner.records:
    if record['status'] != 200: continue
    path = ROOT / record['evidence']
    page = discovery.Page(path.read_text())
    page.url, page.evidence = record['url'], path.stem
    runner.pages[page.url] = page
script = runner.pages[report['published_year_navigation_script']]
raw = (discovery.CAPTURE_ROOT / f'{script.evidence}.response').read_text()
menu = re.search(r'const menuHtml\s*=\s*`(.*?)`', raw, re.S)
if not menu: raise ValueError('Published year menu format changed; do not guess year URLs')
script.anchors = discovery.Page(menu[1]).anchors
annual_url = report['nar_current'][0]['parent_url']
previous = {}
for year in [runner.today.year - 1, runner.today.year - 2, runner.today.year - 3]:
    link = next((a for a in script.anchors if a['label'] == f'{year}年'), None)
    if not link: continue
    url = urljoin(annual_url, link['href'])
    # This site's script and target directory have matching relative bases.
    # Refuse rather than guess if that fact changes.
    assert url == urljoin(script.url, link['href'])
    page = runner.fetch(url, script.url, link['href'])
    record = next(r for r in runner.records if r['url'] == url)
    record['href_context'] = 'Literal anchor in published menuHtml JS template; parsed as text'
    record['template_target_document'] = annual_url
    content = (discovery.CAPTURE_ROOT / f'{page.evidence}.response').read_text()
    previous[str(year)] = discovery.nar_annual_events(content, page.url)
report['nar_previous_years'] = previous
entry_page = runner.pages[report['past_entry_page']['url']]
details = {}
for kind, token in [('result', '/RaceMarkTable?'), ('win_odds', '/OddsTanFuku?')]:
    link = next(a for a in entry_page.anchors if token in a['href'])
    page = runner.fetch(urljoin(entry_page.url, link['href']), entry_page.url, link['href'])
    details[kind] = {'url': page.url, 'rows': page.rows, 'text': page.text}
report['past_official_details'] = details
report['requests'] = runner.records
(ROOT / 'japan-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'prior_years': {k: len(v) for k, v in previous.items()},
                  'detail_rows': {k: len(v['rows']) for k, v in details.items()},
                  'request_records': len(runner.records)}, ensure_ascii=False, indent=2))

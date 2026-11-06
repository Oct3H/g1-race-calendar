"""Continue from saved roots to source-published navigation and entry links."""
from datetime import date
import json
from urllib.parse import urljoin
from verify_japan import ROOT, discovery

report = json.loads((ROOT / 'japan-audit.json').read_text())
runner = discovery.Runner(date.fromisoformat(report['as_of']))
runner.records = report['requests']
for record in runner.records:
    if record['status'] != 200: continue
    path = ROOT / record['evidence']
    page = discovery.Page(path.read_text() if 'text/html' in record.get('headers', {}).get('content-type', '') else '')
    page.url, page.evidence = record['url'], path.stem
    runner.pages[page.url] = page
annual = runner.pages[report['nar_current'][0]['parent_url']]
script_href = next(href for href in annual.scripts if href.endswith('/racelist.js'))
script = runner.fetch(urljoin(annual.url, script_href), annual.url, script_href)
past = report['selected_nar_details'][0]
link = next(a for a in past['relevant_links'] if 'DebaTable' in a['href'])
entries = runner.fetch(urljoin(past['event']['detail_url'], link['href']), past['event']['detail_url'], link['href'])
report['published_year_navigation_script'] = script.url
report['past_entry_page'] = {'url': entries.url, 'rows': entries.rows,
                             'relevant_links': [a for a in entries.anchors if any(word in a['href'] for word in ['Odds', 'RaceMarkTable', 'HorseMarkInfo'])],
                             'text': entries.text}
report['requests'] = runner.records
(ROOT / 'japan-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'script_url': script.url, 'entries_url': entries.url,
                  'entry_rows': len(entries.rows), 'links': report['past_entry_page']['relevant_links'][:9]}, ensure_ascii=False, indent=2))

"""Select the official winner, follow its actual profile link, inspect history."""
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
    page = discovery.Page(path.read_text())
    page.url, page.evidence = record['url'], path.stem
    runner.pages[page.url] = page
winner = next(row for row in report['past_official_details']['result']['rows'] if len(row) == 17 and row[0] == '1')
entry_page = runner.pages[report['past_entry_page']['url']]
link = next(a for a in entry_page.anchors if a['label'] == winner[3] and 'HorseMarkInfo?' in a['href'])
try:
    page = runner.fetch(urljoin(entry_page.url, link['href']), entry_page.url, link['href'])
    report['winner_horse_profile'] = {'selected_from_official_result': winner[3], 'url': page.url,
                                      'rows': page.rows, 'row_links': page.row_links,
                                      'links': [a for a in page.anchors if 'RaceMarkTable?' in a['href']], 'text': page.text}
except ValueError as error:
    report['horse_profile_failure'] = str(error)
finally:
    report['requests'] = runner.records
    (ROOT / 'japan-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'horse': winner[3], 'profile_rows': len(report.get('winner_horse_profile', {}).get('rows', [])),
                  'race_links': report.get('winner_horse_profile', {}).get('links', [])[:4],
                  'failure': report.get('horse_profile_failure')}, ensure_ascii=False, indent=2))

"""Bounded overseas discovery proof using two fixed public roots.

No individual race names, race URLs, annual ranking batch IDs or remote JS.
Unmatched aliases remain unmatched instead of broadening collection silently.
"""
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse

from discover import Page, capture, merge, normalized

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'overseas-live'
OUT.mkdir(exist_ok=True)
SEEDS = {'ranking': 'https://www.ifhaonline.org/default.asp?section=Racing&area=1',
         'organizer': 'https://www.breederscup.com/'}


def embedded(raw):
    match = re.search(r'<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)
    if not match: raise ValueError('Published embedded data unavailable; preserve cache')
    return json.loads(match[1])


def cards(data):
    for block in data['props']['pageProps']['blocks']:
        if isinstance(block.get('horseCards'), dict):
            return block['horseCards']['races']
    raise ValueError('No supported public race cards')


def json_links(value, path=None):
    path = [] if path is None else path
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ['url', 'href', 'redirectUrl'] and isinstance(child, str) and child:
                yield {'href': child, 'path': path + [key]}
            yield from json_links(child, path + [key])
    elif isinstance(value, list):
        for index, child in enumerate(value): yield from json_links(child, path + [index])


def race_identities(value):
    if isinstance(value, dict):
        if value.get('uid') and value.get('raceName'):
            details = value.get('raceDetails') or {}
            yield {'uid': value['uid'], 'name': value['raceName'], 'scheduled_utc': details.get('date'), 'grade': details.get('grade')}
        for child in value.values(): yield from race_identities(child)
    elif isinstance(value, list):
        for child in value: yield from race_identities(child)


def match_ranking(race, ranking):
    names = {normalized(race['raceName'])}
    sponsors = race['raceDetails'].get('sponsor') or []
    for sponsor in sponsors:
        names.add(normalized(sponsor['title'] + ' ' + race['raceName']))
    matches = [r for r in ranking if len(r) == 11 and r[7] == 'USA' and normalized(r[1]) in names]
    return matches[0] if len(matches) == 1 else None


class Runner:
    def __init__(self):
        self.records, self.pages, self.raw = [], {}, {}

    def fetch(self, url, parent=None, href=None, json_path=None):
        if parent is None:
            assert url in SEEDS.values()
        elif json_path:
            value = embedded(self.raw[parent])
            for part in json_path: value = value[part]
            assert urljoin(parent, value) == url, 'URL must occur at the recorded public JSON path'
        else:
            assert any(a['href'] == href for a in self.pages[parent].anchors)
            assert url == urljoin(parent, href)
        assert urlparse(url).hostname in ['www.ifhaonline.org', 'ifhaonline.org', 'www.breederscup.com']
        if url in self.pages: return self.pages[url]
        assert len(self.records) < 7
        capture.ROOT = OUT
        name = f"request-{len(self.records) + 1:02d}-{sha256(url.encode()).hexdigest()[:10]}"
        record, _ = capture.capture(name, url)
        record.update(discovered_from=parent, observed_href=href, json_path=json_path,
                      evidence=f'overseas-live/{name}.response')
        self.records.append(record)
        if record['status'] != 200: raise ValueError(f"HTTP unavailable: {record['status']}")
        body = (OUT / f'{name}.response').read_bytes()
        encoding = 'cp1252' if 'ifhaonline.org' in url else 'utf-8'
        self.raw[url] = body.decode(encoding)
        page = Page(self.raw[url]); page.url = url
        self.pages[url] = page
        return page

    def run(self):
        index = self.fetch(SEEDS['ranking'])
        annual_links = []
        for a in index.anchors:
            year = re.search(r'-\s*(20\d\d)\s*$', a['label'])
            if year and 'LWGRank.asp?' in a['href']:
                annual_links.append((int(year[1]), a))
        if not annual_links: raise ValueError('No published annual ranking link')
        ranking_year, a = max(annual_links, key=lambda item: item[0])
        target = urlparse(urljoin(index.url, a['href']))
        # Prefer an absolute link actually published by the same directory.
        # Do not invent host alternatives or ranking batch numbers.
        equivalents = [link for link in index.anchors if link['href'].startswith('https://')
                       and (urlparse(link['href']).path, urlparse(link['href']).query) == (target.path, target.query)]
        if equivalents: a = equivalents[0]
        ranking_page = self.fetch(urljoin(index.url, a['href']), index.url, a['href'])
        ranking = [r for r in ranking_page.rows if len(r) == 11 and r[0].isdigit()]
        assert len(ranking) >= 100
        home = self.fetch(SEEDS['organizer'])
        links = [a for a in home.anchors if 'pre-entries' in a['href'] and urlparse(urljoin(home.url, a['href'])).hostname == 'www.breederscup.com']
        if not links:
            links = [a for a in json_links(embedded(self.raw[home.url])) if 'pre-entries' in a['href']
                     and urlparse(urljoin(home.url, a['href'])).hostname == 'www.breederscup.com']
        if not links: raise ValueError('No published pre-entry directory link')
        a = links[0]
        directory = self.fetch(urljoin(home.url, a['href']), home.url, a['href'], json_path=a.get('path'))
        data = embedded(self.raw[directory.url])
        races = cards(data)
        matched, unmatched = [], []
        for race in races:
            rank = match_ranking(race, ranking)
            if not rank:
                unmatched.append(race['raceName']); continue
            d = race['raceDetails']
            stamp = datetime.fromisoformat(d['date'].replace('Z', '+00:00'))
            matched.append({'key': f"bc:{stamp.year}:{race['uid']}", 'source': 'bc', 'name': race['raceName'],
                            'year': stamp.year, 'scheduled_utc': d['date'], 'grade': d['grade'],
                            'ranking_year': ranking_year, 'rank': int(rank[0]), 'ranking_name': rank[1],
                            'purse_raw': d['purse'], 'distance_raw': d['distance'],
                            'pre_entry_count': len(race.get('horses') or []),
                            'entry_status': 'pre-entry only; not final declarations',
                            'official_win_odds': None,
                            'detail_links': [s['redirectUrl'] for s in d.get('sponsor', []) if s.get('redirectUrl')]})
        if not matched: raise ValueError('No unambiguous ranking-to-race matches')
        # Choose by published time, not a supplied target race name or URL.
        blocks = data['props']['pageProps']['blocks']
        bi = next(i for i, b in enumerate(blocks) if isinstance(b.get('horseCards'), dict))
        selected, rejected = None, []
        for candidate in sorted([r for r in matched if r['detail_links']], key=lambda r: (r['scheduled_utc'], r['rank'])):
            ri = next(i for i, r in enumerate(races) if f"bc:{candidate['year']}:{r['uid']}" == candidate['key'])
            sponsors = races[ri]['raceDetails']['sponsor']
            si = next(i for i, s in enumerate(sponsors) if s.get('redirectUrl') == candidate['detail_links'][0])
            path = ['props', 'pageProps', 'blocks', bi, 'horseCards', 'races', ri, 'raceDetails', 'sponsor', si, 'redirectUrl']
            detail = self.fetch(candidate['detail_links'][0], directory.url, json_path=path)
            identities = list(race_identities(embedded(self.raw[detail.url])))
            if not any(i['uid'] == races[ri]['uid'] and normalized(i['name']) == normalized(candidate['name'])
                       and i['scheduled_utc'] == candidate['scheduled_utc'] and i['grade'] == candidate['grade'] for i in identities):
                rejected.append({'event': candidate['name'], 'candidate_url': detail.url,
                                 'reason': 'Detail identity differs from directory race', 'actual_identities': identities})
                candidate['detail_status'] = 'identity mismatch; preserve prior details and report failure'
                continue
            candidate['validated_detail_url'] = detail.url
            candidate['detail_identity_verified'] = True
            selected = candidate
            break
        if selected is None: raise ValueError('No candidate detail passed source identity validation')
        catalog, initial = merge({}, matched)
        _, repeated = merge(catalog, matched)
        return {'seed_urls': SEEDS, 'ranking_year': ranking_year, 'ranking_rows': len(ranking),
                'directory_card_count': len(races), 'matched_events': matched, 'unmatched_names': unmatched,
                'automatically_selected_detail': selected, 'initial': initial, 'repeat_snapshot': repeated,
                'rejected_detail_links': rejected,
                'requests': self.records,
                'limits': ['BC subset only, not global overseas annual coverage',
                           'Conservative sponsor-based matching; unmatched names may require maintained aliases',
                           'Pre-entries do not establish final runners or eligible official Win odds']}


if __name__ == '__main__':
    runner = Runner()
    try: result = runner.run()
    except Exception as error:
        (ROOT / 'overseas-failed-run.json').write_text(json.dumps({'error': str(error), 'requests': runner.records}, ensure_ascii=False, indent=2))
        raise
    (ROOT / 'overseas-discovery-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in result.items() if k != 'requests'}, ensure_ascii=False, indent=2))

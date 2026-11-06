"""Research-only discovery runner: fixed roots, observed hrefs, no target races.

No browser, web-search API, LLM, credentials, remote JS or production cache.
Run with the bundled Python (pdfplumber is already available there).
"""
import argparse
from copy import deepcopy
from datetime import date, datetime
from hashlib import sha256
import importlib.util
import io
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('existing_capture', ROOT.parent / '2026-10-26-pre-race/probe_public.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
CAPTURE_ROOT = ROOT / 'live'
CAPTURE_ROOT.mkdir(exist_ok=True)
capture.ROOT = CAPTURE_ROOT

SEEDS = {'japan': 'https://japanracing.jp/en/', 'nar': 'https://www.keiba.go.jp/dirtgraderace/'}
MONTHS = {name: index for index, name in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}


def normalized(value):
    return re.sub(r'[^a-z0-9]', '', value.casefold())


class Page(capture.previous.HTMLFields):
    def __init__(self, content):
        super().__init__()
        self.anchors, self.options, self.headings, self.row_links = [], [], [], []
        self.anchor = self.option = self.heading = None
        self.current_row_links, self.race_alt = [], ''
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        super().handle_starttag(tag, attrs)
        if tag == 'tr': self.current_row_links = []
        if tag == 'a': self.anchor = {'href': values.get('href', ''), 'parts': [], 'race_alt': self.race_alt}
        if tag == 'option': self.option = {'href': values.get('value', ''), 'parts': []}
        if tag in ['h1', 'h2']: self.heading = {'tag': tag, 'parts': []}
        if tag == 'img':
            alt = values.get('alt', '')
            if re.match(r'\d{4}年\d+月\d+日', alt): self.race_alt = alt
            if self.anchor: self.anchor['parts'].append(alt)

    def handle_data(self, data):
        super().handle_data(data)
        for item in [self.anchor, self.option, self.heading]:
            if item is not None: item['parts'].append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.anchor is not None:
            self.anchor['label'] = ' '.join(''.join(self.anchor.pop('parts')).split())
            self.anchors.append(self.anchor)
            self.current_row_links.append(self.anchor)
            self.anchor = None
        if tag == 'option' and self.option is not None:
            self.option['label'] = ' '.join(''.join(self.option.pop('parts')).split())
            self.options.append(self.option); self.option = None
        if self.heading is not None and tag == self.heading['tag']:
            self.headings.append(' '.join(''.join(self.heading['parts']).split())); self.heading = None
        if tag == 'tr' and self.row: self.row_links.append(list(self.current_row_links))
        super().handle_endtag(tag)


def japan_events(page, url):
    years = [int(value) for value in page.headings if re.fullmatch(r'20\d\d', value)]
    if not years: return []
    year = years[0]
    events = []
    for index, row in enumerate(page.rows):
        if row[0] != 'G1': continue
        heading = page.rows[index - 1][0]
        when = re.match(r'([A-Z][a-z]{2})\.?\s*(\d+)', heading)
        links = [a for a in page.row_links[index - 1] if a['href'] and not a['href'].startswith(('javascript:', '#'))]
        if not when or not links: raise ValueError('Unrecognized schedule row; preserve cached records')
        link = links[0]
        key = f"japan:{year}:{normalized(link['label'])}"
        events.append({'key': key, 'source': 'japan', 'year': year, 'name': link['label'], 'grade': 'G1',
                       'date': date(year, MONTHS[when[1]], int(when[2])).isoformat(), 'course': row[1],
                       'distance_surface_raw': row[2], 'winner_prize_raw': row[4],
                       'detail_url': urljoin(url, link['href']), 'parent_url': url, 'href': link['href']})
    return events


def nar_events(page, url):
    events = []
    seen = set()
    for link in page.anchors:
        if not link['href'].endswith('/racecard.html') or not link['race_alt']: continue
        alt = link['race_alt'].replace('Ⅰ', 'I').replace('Ｉ', 'I')
        match = re.fullmatch(r'(\d{4})年(\d+)月(\d+)日(?:\([^)]*\))?\s*(.*?)\s+(JpnI|GI)', alt)
        if not match: continue
        year, month, day, name, grade = match.groups()
        key = f'nar:{year}:{name}'
        if key in seen: continue
        seen.add(key)
        events.append({'key': key, 'source': 'nar', 'year': int(year), 'name': name, 'grade': grade,
                       'date': date(int(year), int(month), int(day)).isoformat(),
                       'detail_url': urljoin(url, link['href']), 'parent_url': url, 'href': link['href']})
    return events


def nar_annual_events(content, url):
    """NAR's annual list includes local races and links to two JRA G1s.

    Keep only source-published local GI/JpnI cards; JRA is collected separately.
    """
    year_match = re.search(r'/(20\d\d)/racelist/', urlparse(url).path)
    if not year_match: raise ValueError('No source year in annual directory URL')
    year = int(year_match[1])
    titles = Page(content).text
    title = titles[0] if titles else ''
    if not re.search(rf'\b{year}年', title): raise ValueError('Annual document year does not match its URL')
    events = []
    central_courses = {'札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'}
    for block in re.findall(r'<li\b[^>]*class="[^"]*\bjs-item\b[^"]*"[^>]*>(.*?)</li>', content, re.S):
        heading = re.search(r'<h4\b[^>]*class="([^"]+)"[^>]*>(.*?)</h4>', block, re.S)
        if not heading: continue
        grades = set(heading[1].split()) & {'g1', 'jpn1'}
        if not grades: continue
        page = Page(block)
        text = ' '.join(page.text)
        name = ' '.join(Page(heading[2]).text)
        day = re.match(r'(\d+)月(\d+)日', text)
        if not name or not day: raise ValueError('Incomplete annual race identity/date')
        course = re.search(r'([^\s]+)\s+[左右]\d+m', text)
        links = [a for a in page.anchors if a['href']]
        if len(links) > 1: raise ValueError('Ambiguous annual race link; preserve cache')
        link = links[0] if links else None
        absolute = urljoin(url, link['href']) if link else None
        # Future central G1 cards can have their anchor commented out.
        # Classify those by the published central venue, not by a race name.
        if absolute and urlparse(absolute).hostname == 'www.jra.go.jp': continue
        if not absolute and 'g1' in grades and course and course[1] in central_courses: continue
        if absolute and (urlparse(absolute).hostname != 'www.keiba.go.jp' or not absolute.endswith(('/racecard.html', '/introduction.html'))):
            raise ValueError('Unexpected annual race path')
        when = date(year, int(day[1]), int(day[2])).isoformat()
        time = re.search(r'(\d{1,2}:\d{2})発走', text)
        distance = re.search(r'([左右])(\d+)m', text)
        events.append({'key': f'nar:{year}:{name}', 'source': 'nar', 'year': year, 'name': name,
                       'grade': 'G1' if 'g1' in grades else 'JpnI', 'date': when,
                       'scheduled_start_at': f'{when}T{time[1].zfill(5)}:00+09:00' if time else None,
                       'start_time_provisional': '発走予定' in text if time else None,
                       'distance_m': int(distance[2]) if distance else None,
                       'schedule_text_raw': text, 'detail_url': absolute,
                       'detail_link_status': ('introduction' if absolute.endswith('/introduction.html') else 'racecard') if absolute else 'not_published',
                       'parent_url': url, 'href': link['href'] if link else None})
    if not events: raise ValueError('No supported local GI/JpnI annual records')
    if len({r['key'] for r in events}) != len(events): raise ValueError('Duplicate annual race identities')
    return events


def merge(catalog, incoming):
    result = deepcopy(catalog)
    added = changed = 0
    for item in incoming:
        key = item['key']
        value = {**result.get(key, {}), **{k: v for k, v in item.items() if v is not None}}
        if key not in result: added += 1
        elif result[key] != value: changed += 1
        result[key] = value
    # Missing/failed pages do not delete previously known dates or details.
    return result, {'added': added, 'changed': changed, 'total': len(result)}


class Runner:
    def __init__(self, today):
        self.today, self.records, self.pages, self.errors = today, [], {}, []

    def fetch(self, url, parent=None, href=None, fresh=False, redirect_rule=None):
        if parent:
            if redirect_rule:
                script = self.pages[redirect_rule['script_url']]
                content = (CAPTURE_ROOT / f'{script.evidence}.response').read_text()
                assert "url: redirect_dir + viewYEAR + '.html'" in content
                assert "location.href = redirect_url" in content
                assert url == urljoin(parent, f"{redirect_rule['year']}.html")
            else:
                links = [a['href'] for a in self.pages[parent].anchors + self.pages[parent].options] + self.pages[parent].scripts
                assert href in links and urljoin(parent, href) == url, 'URL was not returned by its source'
        else: assert url in SEEDS.values(), 'Only fixed roots may be supplied directly'
        assert urlparse(url).hostname in ['japanracing.jp', 'www.keiba.go.jp']
        if url in self.pages and not fresh: return self.pages[url]
        if len(self.records) >= 18: raise ValueError('Bounded research request limit reached')
        name = f"request-{len(self.records) + 1:02d}-{sha256(url.encode()).hexdigest()[:10]}"
        record, _ = capture.capture(name, url)
        record.update(discovered_from=parent, observed_href=href, redirect_rule=redirect_rule,
                      evidence=f'live/{name}.response')
        self.records.append(record)
        if record['status'] != 200: raise ValueError(f"Source unavailable: {record['status']}")
        raw = (CAPTURE_ROOT / f'{name}.response').read_bytes()
        if 'text/html' in record.get('headers', {}).get('content-type', ''):
            page = Page(raw.decode('utf-8')); page.url, page.evidence = url, name
        else:
            page = Page(''); page.url, page.evidence = url, name
        self.pages[url] = page
        return page

    def discover_japan(self):
        home = self.fetch(SEEDS['japan'])
        page = home
        visited = {page.url}
        # Follow observed directory links; no guessed year or event path.
        for _ in range(4):
            if japan_events(page, page.url): break
            candidates = [a for a in page.anchors if 'List of JRA Graded Races' in a['label']
                          and '/graded/' in urljoin(page.url, a['href'])
                          and urljoin(page.url, a['href']) not in visited]
            if not candidates:
                scripts = [href for href in page.scripts if href.endswith('/redirect.js')]
                raw = (CAPTURE_ROOT / f'{page.evidence}.response').read_text()
                if not scripts or not re.search(r'var redirect_dir\s*=\s*""', raw):
                    raise ValueError('No published directory link or supported year redirect')
                script_url = urljoin(page.url, scripts[0])
                script = self.fetch(script_url, page.url, scripts[0])
                content = (CAPTURE_ROOT / f'{script.evidence}.response').read_text()
                if 'Number(new Date().getFullYear())' not in content:
                    raise ValueError('Year redirect rule changed; do not guess a URL')
                page = self.fetch(urljoin(page.url, f'{self.today.year}.html'), page.url,
                                  redirect_rule={'script_url': script_url, 'year': self.today.year})
                visited.add(page.url)
                continue
            link = candidates[0]; page = self.fetch(urljoin(page.url, link['href']), page.url, link['href'])
            visited.add(page.url)
        events = japan_events(page, page.url)
        if not events: raise ValueError('No valid flat G1 schedule rows')
        calendars = [(page.url, events)]
        current = {event['year'] for event in events}
        options = []
        for link in page.anchors + page.options:
            absolute = urljoin(page.url, link['href'])
            match = re.search(r'/list/(20\d\d)\.html$', absolute)
            if match:
                year = int(match[1])
                if self.today.year <= year <= self.today.year + 2 and year not in current:
                    options.append((absolute, link['href']))
        for absolute, href in dict(options).items():
            other = self.fetch(absolute, page.url, href)
            found = japan_events(other, other.url)
            if found: calendars.append((other.url, found)); current.add(found[0]['year'])
        return home, calendars

    def inspect(self, event):
        page = self.fetch(event['detail_url'], event['parent_url'], event['href'])
        identity = ' '.join(page.headings) if event['source'] == 'japan' else page.text[0]
        if event['name'].casefold() not in identity.casefold():
            raise ValueError('Detail race identity mismatch; preserve previous cached details')
        fields = {row[0]: row[1:] for row in page.rows if row[0] in ['Distance', 'Declaration', 'Prize Money for the Winner', 'Total Value']}
        return {'key': event['key'], 'name': event['name'], 'date': event['date'], 'url': page.url,
                'detail_identity_verified': True,
                'fields_raw': fields, 'stage': 'conditions' if fields else 'entries/conditions text',
                'source_text_excerpt': ' '.join(page.text[:22])[:600]}

    def discover_nar(self):
        home = self.fetch(SEEDS['nar'])
        candidates = [a for a in home.anchors if re.search(rf'/{self.today.year}/racelist/index\.html$', urljoin(home.url, a['href']))]
        if not candidates: raise ValueError('No published current NAR annual directory; preserve cache')
        link = candidates[0]
        page = self.fetch(urljoin(home.url, link['href']), home.url, link['href'])
        content = (CAPTURE_ROOT / f'{page.evidence}.response').read_text()
        return home, page, nar_annual_events(content, page.url)

    def news_documents(self, home, event):
        token = normalized(re.sub(r'\([^)]*\)', '', event['name']))
        candidates = {}
        for link in home.anchors:
            if token not in normalized(link['label']) or not link['href']: continue
            absolute = urljoin(home.url, link['href'])
            if '/_news' in absolute and not any(word in link['label'].casefold() for word in ['comments', 'preview', 'data analysis']):
                candidates[absolute] = link
        def priority(item):
            label = item[1]['label'].casefold()
            return 0 if 'barrier draw' in label else 1 if 'morning line' in label or 'win odds' in label else 2
        documents = []
        for absolute, link in sorted(candidates.items(), key=priority)[:3]:
            page = self.fetch(absolute, home.url, link['href'])
            raw = (CAPTURE_ROOT / f'{page.evidence}.response').read_bytes()
            item = {'url': absolute, 'anchor_label': link['label'], 'kind': 'unclassified', 'rows': 0}
            if raw.startswith(b'%PDF-'):
                import pdfplumber
                with pdfplumber.open(io.BytesIO(raw)) as pdf:
                    text = '\n'.join(p.extract_text() or '' for p in pdf.pages)
                    tables = [t for p in pdf.pages for t in p.extract_tables()]
                if 'JRA pari-mutuel pool odds' in text:
                    item.update(kind='actual_win_snapshot', rows=sum(1 for t in tables for row in t if len(row) == 5 and (row[1] or '').isdigit()))
            elif any(row[:3] == ['FP', 'BK', 'PP'] for row in page.rows):
                item.update(kind='results', rows=sum(len(row) == 9 and row[0].isdigit() for row in page.rows))
            elif any(row[:3] == ['Bk', 'Hs', 'Horse'] for row in page.rows):
                item.update(kind='declarations', rows=sum(len(row) == 10 and row[1].isdigit() for row in page.rows))
            documents.append(item)
        return documents

    def run(self):
        home, calendars = self.discover_japan()
        japan = [item for _, records in calendars for item in records]
        _, nar_page, nar = self.discover_nar()
        future = sorted([r for r in japan if r['date'] > self.today.isoformat()], key=lambda r: r['date'])
        selected = list({r['key']: r for r in [future[0], future[-1]]}.values()) if future else []
        details = [self.inspect(r) for r in selected]
        nar_future = sorted([r for r in nar if r['date'] > self.today.isoformat()], key=lambda r: r['date'])
        linked_future = [r for r in nar_future if r.get('detail_url')]
        if linked_future: details.append(self.inspect(linked_future[0]))
        past = sorted([r for r in japan if r['date'] < self.today.isoformat()], key=lambda r: r['date'])
        documents = self.news_documents(home, past[-1]) if past else []
        incoming = japan + nar
        saved = ROOT / 'research-catalog.json'
        previous_catalog = json.loads(saved.read_text()) if saved.exists() else {}
        catalog, initial = merge(previous_catalog, incoming)
        supplements = [{'key': item['key'], 'condition_fields': item['fields_raw'] or None,
                        'detail_stage': item['stage']} for item in details]
        if past and documents:
            supplements.append({'key': past[-1]['key'], 'documents': [d for d in documents if d['kind'] != 'unclassified']})
        catalog, enrichment = merge(catalog, supplements)
        # A second real directory request checks refresh/deduplication, not a
        # future publication that has not occurred during this experiment.
        url, _ = calendars[0]
        provenance = next(r for r in self.records if r['url'] == url)
        again = self.fetch(url, provenance['discovered_from'], provenance['observed_href'], fresh=True,
                           redirect_rule=provenance['redirect_rule'])
        catalog, repeated = merge(catalog, japan_events(again, url))
        restored = None
        if future:
            missing = deepcopy(catalog); del missing[future[0]['key']]
            restored_catalog, restored = merge(missing, japan_events(again, url))
            assert future[0]['key'] in restored_catalog
        return {'as_of': self.today.isoformat(), 'seed_urls': SEEDS, 'initial': initial, 'enrichment': enrichment,
                'repeat_live_refresh': repeated, 'controlled_missing_local_event': restored,
                'published_years': sorted({r['year'] for r in japan}), 'future_events_found': len(future) + len(nar_future),
                'japan_events': japan, 'nar_events': nar, 'automatically_selected_details': details,
                'automatically_selected_past_event': past[-1] if past else None, 'automatically_found_news_documents': documents,
                'requests': self.records, 'catalog': catalog,
                'limits': ['Real discovery from fixed roots and controlled cache restoration; not observation of a newly published upstream race',
                           'Site adapters can require maintenance; this is not global coverage, a production cache or the installed app',
                           'NAR annual directory is followed from its root; unavailable future-year links are not guessed',
                           'Keys are research source/year/name keys; renamed races require production alias handling']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--today', type=date.fromisoformat, default=datetime.now(ZoneInfo('Asia/Shanghai')).date())
    args = parser.parse_args()
    runner = Runner(args.today)
    try:
        result = runner.run()
    except Exception as error:
        (ROOT / 'failed-run.json').write_text(json.dumps({'error': str(error), 'requests': runner.records}, ensure_ascii=False, indent=2))
        raise
    (ROOT / 'discovery-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (ROOT / 'research-catalog.json').write_text(json.dumps(result['catalog'], ensure_ascii=False, indent=2))
    print(json.dumps({key: result[key] for key in ['initial', 'enrichment', 'repeat_live_refresh', 'controlled_missing_local_event', 'published_years', 'future_events_found', 'automatically_selected_details', 'automatically_found_news_documents']}, ensure_ascii=False, indent=2))

"""Offline correctness and provenance checks; no network or production writes."""
from hashlib import sha256
import json
from pathlib import Path
import tempfile
from urllib.parse import urljoin

from discover import ROOT, Page, SEEDS, japan_events, merge
from discover_overseas import SEEDS as OVERSEAS_SEEDS, embedded


def row(name='Synthetic New Race', day='Nov. 20', href='./opaque-new-detail.html', grade='G1'):
    return f'<tr><th>{day}<a href="{href}">{name}</a></th></tr><tr><td>{grade}</td><td>TEST</td><td>2000/Turf</td><td>3+</td><td>100</td></tr>'


def run():
    checks = {}
    report = json.loads((ROOT / 'discovery-report.json').read_text())
    base_url = next(r['url'] for r in report['requests'] if '/list/2026.html' in r['url'])
    record = next(r for r in report['requests'] if r['url'] == base_url)
    raw = (ROOT / record['evidence']).read_text()
    base = japan_events(Page(raw), base_url)
    assert len(base) == 24
    initial, _ = merge({}, base)
    added = japan_events(Page('<h2>2026</h2><table>' + row() + '</table>'), base_url)
    catalog, diff = merge(initial, added)
    assert diff == {'added': 1, 'changed': 0, 'total': 25}
    assert catalog[added[0]['key']]['detail_url'] == urljoin(base_url, './opaque-new-detail.html')
    checks['synthetic_upstream_addition_from_observed_opaque_href'] = diff
    again, diff = merge(catalog, added)
    assert diff['added'] == diff['changed'] == 0
    checks['same_snapshot_no_duplicate'] = True
    enriched, _ = merge(catalog, [{'key': added[0]['key'], 'condition_fields': {'Declaration': ['later']}}])
    moved = japan_events(Page('<h2>2026</h2><table>' + row(day='Nov. 21', href='./new-location.html') + '</table>'), base_url)
    updated, diff = merge(enriched, moved)
    assert diff == {'added': 0, 'changed': 1, 'total': 25}
    assert updated[added[0]['key']]['condition_fields'] == {'Declaration': ['later']}
    assert updated[added[0]['key']]['date'] == '2026-11-21'
    checks['date_and_detail_url_update_preserves_enrichment'] = True
    same, diff = merge(updated, [])
    assert same == updated and diff['changed'] == diff['added'] == 0
    checks['empty_source_does_not_delete_cache'] = True
    assert not japan_events(Page('<h2>2026</h2><table>' + row(grade='G2') + row(grade='J-G1') + '</table>'), base_url)
    may = japan_events(Page('<h2>2026</h2><table>' + row(day='May 20') + '</table>'), base_url)
    assert may[0]['date'] == '2026-05-20'
    checks['non_target_grades_excluded_and_may_format_supported'] = True
    try:
        japan_events(Page('<h2>2026</h2><table><tr><th>broken</th></tr><tr><td>G1</td></tr></table>'), base_url)
    except ValueError: pass
    else: raise AssertionError('Unexpected schedule shape must not pass as a valid update')
    checks['invalid_schedule_row_fails_explicitly'] = True
    with tempfile.TemporaryDirectory() as folder:
        p = Path(folder) / 'catalog.json'
        p.write_text(json.dumps(updated))
        loaded, diff = merge(json.loads(p.read_text()), moved)
        assert loaded == updated and diff['added'] == diff['changed'] == 0
    checks['disk_reload_merge_idempotent'] = True
    for r in report['requests']:
        assert r['status'] == 200
        path = ROOT / r['evidence']
        assert sha256(path.read_bytes()).hexdigest() == r['sha256']
        if r['discovered_from'] is None:
            assert r['url'] in SEEDS.values(); continue
        parent = next(p for p in report['requests'] if p['url'] == r['discovered_from'])
        page = Page((ROOT / parent['evidence']).read_text())
        if r.get('redirect_rule'):
            script = next(p for p in report['requests'] if p['url'] == r['redirect_rule']['script_url'])
            assert script['discovered_from'] == parent['url']
            assert "url: redirect_dir + viewYEAR + '.html'" in (ROOT / script['evidence']).read_text()
            assert r['url'] == urljoin(parent['url'], f"{r['redirect_rule']['year']}.html")
        else:
            links = [a['href'] for a in page.anchors + page.options] + page.scripts
            assert r['observed_href'] in links
            assert urljoin(parent['url'], r['observed_href']) == r['url']
    checks['all_japan_requests_source_rooted_and_sha256_verified'] = len(report['requests'])
    kinds = {d['kind']: d['rows'] for d in report['automatically_found_news_documents']}
    assert kinds == {'declarations': 18, 'actual_win_snapshot': 18, 'results': 18}
    checks['three_document_stages_automatically_discovered'] = kinds
    code = (ROOT / 'discover.py').read_text().casefold()
    assert not any(name in code for name in ['arima', 'kikuka', 'tenno', 'jbcladiesclassic'])
    overseas_code = (ROOT / 'discover_overseas.py').read_text().casefold()
    assert '2026-classic' not in overseas_code and 'batch=10' not in overseas_code
    checks['discovery_implementations_contain_no_target_races_or_annual_batch'] = True
    assert report['repeat_live_refresh'] == {'added': 0, 'changed': 0, 'total': 27}
    assert report['controlled_missing_local_event'] == {'added': 1, 'changed': 0, 'total': 27}
    checks['live_repeated_directory_and_controlled_cache_restoration'] = True
    from discover import Runner
    from datetime import date
    runner = Runner(date.fromisoformat(report['as_of']))
    for item in report['automatically_selected_details']:
        rec = next(r for r in report['requests'] if r['url'] == item['url'])
        page = Page((ROOT / rec['evidence']).read_text()); page.url = rec['url']
        runner.pages[page.url] = page
        # Cached response only; fetch still validates original parent links.
        parent = next(r for r in report['requests'] if r['url'] == rec['discovered_from'])
        runner.pages[parent['url']] = Page((ROOT / parent['evidence']).read_text())
        event = next(r for r in report['japan_events'] + report['nar_events'] if r['key'] == item['key'])
        inspected = runner.inspect(event)
        assert inspected['detail_identity_verified'] and inspected['fields_raw'] == item['fields_raw']
    checks['japan_and_nar_detail_names_verified_against_response'] = 3
    overseas = json.loads((ROOT / 'overseas-discovery-report.json').read_text())
    for r in overseas['requests']:
        assert sha256((ROOT / r['evidence']).read_bytes()).hexdigest() == r['sha256']
        if r['discovered_from'] is None:
            assert r['url'] in OVERSEAS_SEEDS.values(); continue
        parent = next(p for p in overseas['requests'] if p['url'] == r['discovered_from'])
        body = (ROOT / parent['evidence']).read_bytes().decode('cp1252' if 'ifhaonline.org' in parent['url'] else 'utf-8')
        if r.get('json_path'):
            value = embedded(body)
            for part in r['json_path']: value = value[part]
            assert urljoin(parent['url'], value) == r['url']
        else:
            assert r['observed_href'] in [a['href'] for a in Page(body).anchors]
            assert urljoin(parent['url'], r['observed_href']) == r['url']
    assert overseas['ranking_year'] == 2025 and overseas['ranking_rows'] == 100
    assert overseas['directory_card_count'] == 14 and len(overseas['matched_events']) == 2
    assert overseas['automatically_selected_detail']['detail_identity_verified']
    rejected = overseas['rejected_detail_links']
    assert len(rejected) == 1 and rejected[0]['event'] != rejected[0]['actual_identities'][0]['name']
    assert all(r['official_win_odds'] is None for r in overseas['matched_events'])
    checks['overseas_provenance_hashes_and_ranking_filter'] = True
    checks['real_wrong_race_link_rejected_despite_http_200'] = True
    checks['pre_entries_not_promoted_to_final_entries_or_odds'] = True
    checks['all_checked_request_records'] = len(report['requests']) + len(overseas['requests'])
    return checks


if __name__ == '__main__':
    result = run()
    (ROOT / 'offline-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))

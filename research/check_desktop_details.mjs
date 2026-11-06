import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from './language-audit-76/vendor/linkedom-worker.mjs';

const { document, window: dom } = parseHTML('<html></html>');
globalThis.document = document;
for (const [property, getter] of Object.entries({
  cells() { return [...this.children].filter(node => ['TD', 'TH'].includes(node.tagName)); },
  rows() { return [...this.querySelectorAll('tr')].filter(node => node.closest('table') === (this.tagName === 'TABLE' ? this : this.closest('table'))); },
  tHead() { return this.querySelector('thead'); },
  tBodies() { return [...this.children].filter(node => node.tagName === 'TBODY'); }
})) Object.defineProperty(dom.HTMLElement.prototype, property, { get: getter });
const cache = new Map();
let fetches = 0;
globalThis.window = { webkit: { messageHandlers: { calendar: { async postMessage({ command, value }) {
  if (command === 'readDetail') return cache.get(value) || '';
  if (command === 'saveDetail') { cache.set(value.key, value.json); return true; }
  fetches++;
  throw Error('Network unavailable');
} } } } };
const { parseJapanResult, parseHongKongResult, parseOverseasResult, parseNarEntries, parseNarResult, createDetails } = await import('../design/desktop-details.mjs');
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const japan = read('./2026-11-04-identity/live/jairs_tenno.response');
const jpRace = { id: 'jra-2026-tenno-autumn', date: '2026-11-01', sourceEnglish: 'TENNO SHO (Autumn)', scheduleSource: 'jra' };
const jp = parseJapanResult(japan, jpRace, 'https://japanracing.jp/_news2026/261101.html');
assert.equal(jp.runners.length, 17);
assert.equal(jp.runners[0].name, 'Danon Decile');
assert.equal(jp.runners[0].sire, 'Epiphaneia');
assert.throws(() => parseJapanResult(japan, { ...jpRace, date: '2025-11-01' }, jp.url));
const hk = parseHongKongResult(read('./2026-10-25-source-audit/hkjc_cup_2025_result.response'), '香港盃',
  'https://racing.hkjc.com/zh-hk/local/information/archive/localresults?racedate=2025%2F12%2F14&racecourse=ST&RaceNo=8');
assert(hk?.runners.some(row => row.name === '浪漫勇士'));
assert.equal(hk.runners.find(row => row.name === '浪漫勇士').horseId, 'HK_2020_E486');
assert.equal(parseHongKongResult(read('./2026-10-25-source-audit/hkjc_cup_2025_result.response'), '香港瓶', hk.url), null);
assert.throws(() => parseHongKongResult(read('./2026-10-25-source-audit/hkjc_cup_2025_result.response'), '香港盃', hk.url.replace('RaceNo=8', 'RaceNo=7')));
const overseas = JSON.parse(read('./2026-10-25-source-audit/hkjc_cox_2025_repeat.json'));
const coxRace = { id: 'cox-2025', name: 'Ladbrokes Cox Plate', date: '2025-10-25', country: 'AU' };
const cox = parseOverseasResult(overseas, coxRace);
assert(cox?.runners.length >= 8);
assert(cox.runners.some(row => row.rank === 1));
assert.equal(parseOverseasResult(overseas, { ...coxRace, date: '2026-10-25' }), null);
assert.equal(parseOverseasResult(overseas, { ...coxRace, country: 'GB' }), null);
const narRace = { name: 'マイルチャンピオンシップ南部杯', date: '2026-10-12', scheduleSource: 'nar' };
const narBase = 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/';
const params = '?k_raceDate=2026%2F10%2F12&k_raceNo=12&k_babaCode=10';
const entries = parseNarEntries(read('./2026-10-27-japan/live/request-10-52940f7055.response'), narRace, narBase + 'DebaTable' + params);
assert.equal(entries.length, 11);
assert.equal(entries[0].name, 'メイショウハチロー');
assert.equal(entries[0].sire, 'シニスターミニスター');
assert.equal(entries[0].starts[0].jockey, '團野大');
assert.equal(entries[0].starts[0].finishTime, '1:22.9');
assert.equal(entries[0].starts[0].course, 'Ｊ中京');
const nar = parseNarResult(read('./2026-10-27-japan/live/request-13-c0b0049814.response'), narRace, narBase + 'RaceMarkTable' + params, entries);
assert.equal(nar.runners.length, 11);
assert.equal(nar.runners[0].odds, '7.1');
assert.throws(() => parseNarResult(read('./2026-10-27-japan/live/request-13-c0b0049814.response'), { ...narRace, date: '2026-10-11' }, nar.url, entries));
cache.set('race.' + jpRace.id, JSON.stringify(jp));
const cachedRace = { ...jpRace };
await createDetails(true).load(cachedRace, () => {});
assert.equal(cachedRace.realResult.runners.length, 17);
assert.equal(cachedRace.refreshState, 'offline');
assert.equal(fetches, 0);
const service = createDetails(false);
const stableName = { id: 'nar-2026-nambu', name: narRace.name, country: 'JP', scheduleSource: 'nar' };
service.attach(stableName, nar);
assert.equal(stableName.name, narRace.name, 'A detail title must not change the schedule merge key');
const old = { ...jpRace };
const first = service.load(old, () => {});
assert.equal(service.load(old, () => {}), first);
await first;
assert.equal(old.realResult.runners.length, 17);
assert.equal(old.refreshState, 'failed');
assert.equal(fetches, 4);
console.log('PASS official detail parsing, identity guards, NAR pedigree, overseas matching, offline cache and failed-update retention');

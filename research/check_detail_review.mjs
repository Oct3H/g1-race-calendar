import * as uiRuntime from '../design/ui-language.mjs';
// Actual dialog controllers with DOM doubles; no browser rendering or network GET.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createDetailReviewRaces, initDetailReview, renderHistoryResolution } from '../design/detail-review.mjs';
import { createQualityRace, qualityCaseFor } from '../design/data-quality-preview.mjs';
import { dateInZone, raceCalendarDate, clockInZone } from '../design/calendar-rules.js';
const source = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../design/index.html', import.meta.url), 'utf8');
const slice = (from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, from);
  return source.slice(a, b);
};
let activeElement;
class Node {
  constructor() { this.hidden = false; this.dataset = {}; this.parts = new Map(); this.children = []; this.events = new Map(); this.scrollTop = 0; this.attributes = {}; }
  replaceChildren() { this.children = []; }
  append(n) { this.children.push(n); }
  querySelector(s) { if (!this.parts.has(s)) this.parts.set(s, new Node()); return this.parts.get(s); }
  addEventListener(type, fn) { this.events.set(type, fn); }
  setAttribute(k,v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  focus() { activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
const document = { getElementById: get, querySelector: get, createElement: () => new Node() };
const location = new URL('http://127.0.0.1:8765/index.html?preview=calendar&year=2026&month=10&detailReview=preview');
const context = vm.createContext({ desktop: false, desktopData: null, isLiveRace: () => false, ...uiRuntime, document, URL, URLSearchParams, Intl, Date, navigator: { onLine: true },
  createQualityRace, qualityCaseFor, createDetailReviewRaces, renderHistoryResolution, dateInZone, raceCalendarDate, clockInZone,
  window: { location, history: { replaceState(_a,_b,url) { location.href = String(url); } } } });
vm.runInContext(slice('// 本轮只有设计稿交互', 'function sampleOddsLabel('), context);
vm.runInContext(slice('function sampleOddsLabel(', 'function renderEntries('), context);
vm.runInContext(slice('function showHorse(', 'function renderDataQuality('), context);
vm.runInContext(`function renderRaceChange() {} function setOddsPreview() {} function renderCalendar() {}
function setRaceView(view) { raceView = view; }`, context);
vm.runInContext(slice('function showRace(', 'function renderRaceChange('), context);
get('race-dialog').dataset.odds = 'available';
const run = code => vm.runInContext(code, context);
run("showRace(races.find(r=>r.id==='detail-long'), null)");
assert.match(get('race-title').textContent, /Qipco British Champions Fillies/);
assert.equal(get('race-start-time').textContent, '待公布');
assert.match(get('race-date').textContent, /10 月 29 日.*来源日期/);
assert.equal(get('race-venue-time').hidden, true);
assert.equal(get('race-prize').textContent, '暂无数据');
assert.equal(get('race-winner-prize').textContent, '暂无数据');
get('race-dialog').scrollTop = 140;
context.horseButton = new Node();
run('showHorse(0, horseButton)');
assert.equal(get('horse-title').textContent, "My Kid's Said No");
assert.equal(get('horse-damsire').textContent, '暂无资料');
assert.equal(get('horse-form-list').children.length, 5);
get('race-dialog').scrollTop = 240;
const firstPastButton = get('horse-form-list').children[0].querySelector('.past-race-button');
firstPastButton.events.get('click')();
assert.equal(get('history-unresolved').hidden, false);
assert.match(get('history-known-date').textContent, /2026-09-01/);
for (const id of ['history-identifiers','history-facts','history-prizes','history-extra-facts','history-sample-note']) assert.equal(get(id).hidden, true, id);
assert.equal(get('history-horse-name').textContent, "My Kid's Said No");
assert.equal(get('history-position').textContent, run('sampleEntries[0].form[0]'));
assert.match(location.search, /past=1/);
run('backToHorse()');
assert.equal(get('race-dialog').dataset.panel, 'horse');
assert.equal(get('race-dialog').scrollTop, 240);
assert.equal(activeElement, firstPastButton);
assert.doesNotMatch(location.search, /past=/);
// Another known historical fixture must restore the normal layout.
const secondPastButton = get('horse-form-list').children[1].querySelector('.past-race-button');
secondPastButton.events.get('click')();
assert.equal(get('history-unresolved').hidden, true);
assert.equal(get('history-facts').hidden, false);
run('backToHorse(); backToEntries()');
assert.equal(get('race-dialog').dataset.panel, 'race');
assert.equal(get('race-dialog').scrollTop, 140);
assert.equal(activeElement, context.horseButton);
assert.doesNotMatch(location.search, /horse=|past=/);
// The actual showRace date/time fields, not only the pure date helper.
run("displayTimeZone='Asia/Shanghai'; zonePreview=displayTimeZone; showRace(races.find(r=>r.id==='detail-crossday'),null)");
assert.match(get('race-date').textContent, /10 月 31 日/);
assert.match(get('race-start-time').textContent, /11:30/);
assert.match(get('race-venue-time').textContent, /10\/30 23:30/);
run("displayTimeZone='America/New_York'; zonePreview=displayTimeZone; showRace(races.find(r=>r.id==='detail-crossday'),null)");
assert.match(get('race-date').textContent, /10 月 30 日/);
assert.match(get('race-start-time').textContent, /23:30/);
get('detail-review-study').hidden = true;
initDetailReview('?preview=calendar', document);
assert.equal(get('detail-review-study').hidden, true);
initDetailReview('?preview=calendar&detailReview=preview&game=win&quality=conflict&horse=2&past=3', document);
assert.equal(get('detail-review-links').children.length, 5);
for (const link of get('detail-review-links').children) {
  const query = new URL(link.href, location).searchParams;
  assert.equal(query.get('detailReview'), 'preview');
  assert.equal(query.get('entry'), 'compact');
  assert.equal(query.has('game'), false);
  assert.equal(query.has('quality'), false);
}
for (const id of ['history-unresolved', 'history-known-date', 'history-identifiers','history-facts','history-prizes','history-extra-facts','history-sample-note']) assert.ok(html.includes(`id="${id}"`));
const result = { round: 71, status: 'passed', checks: ['opt-in review links', 'unknown time is not midnight', 'missing prizes', 'long horse and pedigree fields', 'unresolved history keeps own performance only', 'return focus and scroll', 'resolved history restores metadata', 'actual dialog cross-day fields'], method: 'actual controllers with DOM doubles; no pixel or live-source validation' };
await writeFile(new URL('./detail-review-check-71.json', import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

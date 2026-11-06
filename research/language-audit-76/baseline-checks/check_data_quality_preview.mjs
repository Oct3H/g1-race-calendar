// Executes actual preview functions with DOM doubles; does not render a browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { dateInZone } from '../design/calendar-rules.js';
import { createState, placeTicket, recordRaceResult, settleRace, unreadForRace, unreadRefundRaceIds, bettingBlockReason, grossReturn, withinBetWindow } from '../design/game-state.mjs';
import { qualityCases, qualityCaseFor, createQualityRace, recordQualityResult, initQualityLinks, initQualityDialog, createAvailabilityRaces, initAvailabilityLinks } from '../design/data-quality-preview.mjs';

const design = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
const game = await readFile(new URL('../design/game-design.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../design/index.html', import.meta.url), 'utf8');
const prizePosition = html.indexOf('<div class="race-prize-strip">');
const expressionPosition = html.indexOf('id="race-quality-entry"');
const raceTabsPosition = html.indexOf('class="entry-view-switch race-content-switch"');
const tablePosition = html.indexOf('<div class="entry-table">');
assert.ok(prizePosition < raceTabsPosition && raceTabsPosition < expressionPosition && expressionPosition < tablePosition, 'expression belongs below race tabs and above the table');
const modalTag = html.match(/<dialog id="race-quality-dialog"([^>]*)>/);
assert.ok(modalTag);
assert.doesNotMatch(modalTag[1], /\bopen\b/, 'exception modal must start closed');
assert.match(html, /<button id="quality-avatar-button"[^>]*aria-haspopup="dialog"[^>]*aria-controls="race-quality-dialog"/);
assert.match(html, /<img id="quality-expression-image" src="assets\/machikane-tannhauser-reference-v1.png"/);
assert.doesNotMatch(html, /machikane-tannhauser-cry|quality-expression-choices|race-quality-details/);
const section = (source, from, until) => {
  const start = source.indexOf(from);
  const end = source.indexOf(until, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
};
class Node {
  constructor() { this.dataset = {}; this.children = []; this.parts = new Map(); this.hidden = false; this.attributes = {}; this.textContent = ''; this.listeners = new Map(); this.open = false; }
  replaceChildren() { this.children = []; }
  append(node) { this.children.push(node); }
  querySelector(selector) { if (!this.parts.has(selector)) this.parts.set(selector, new Node()); return this.parts.get(selector); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  dispatch(type, event = {}) { for (const callback of this.listeners.get(type) || []) callback({ target: this, ...event }); }
  close() { this.open = false; this.dispatch('close'); }
  showModal() { this.open = true; this.showCount = (this.showCount || 0) + 1; }
  focus(options) { this.focusOptions = options; }
  getBoundingClientRect() { return { left: 10, right: 110, top: 20, bottom: 120 }; }
}
const nodes = new Map();
const get = key => { if (!nodes.has(key)) nodes.set(key, new Node()); return nodes.get(key); };
const doc = { getElementById: get, querySelector: selector => get(selector), createElement: () => new Node() };
const fixedNow = '2026-10-24T03:00:00Z';
class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } }
const context = vm.createContext({
  Intl, URLSearchParams, Date: ClockDate, dateInZone, createQualityRace, qualityCaseFor, recordQualityResult,
  createState, placeTicket, recordRaceResult, settleRace, unreadForRace, bettingBlockReason, grossReturn,
  window: { location: { search: '?preview=calendar&year=2026&month=10' } }, document: doc,
  get, state: createState(), ticketFilter: 'all', raceView: 'results', gamePreview: null, refundPreview: true,
  navigator: { onLine: true }, oddsRefreshFailed: false,
  showHorse() {}, updateHeader() {}, schedulePurchaseCutoff() {}, showRace() {}, showOdds() {},
  zone: () => 'Asia/Shanghai', money: amount => `¥${amount.toLocaleString('ja-JP')}`,
  signed: amount => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}¥${Math.abs(amount).toLocaleString('ja-JP')}`,
  escape: value => String(value), feedback: message => { context.message = message; },
  getOddsStatus: race => qualityCaseFor(race)?.failed ? 'failed' : 'success',
  modal: get('game-dialog'), resultStages: [], resultTickets: [], automaticRefundQueue: false,
  notificationCase: null, notificationWaiting: false, deferredAfterRefund: null, unreadRefundRaceIds,
  open(panel, title) { get('game-title').textContent = title; context.view = panel; }
});
vm.runInContext(section(design, '// 本轮只有设计稿交互', 'function setSurfaceBadge('), context);
vm.runInContext('globalThis.entries = sampleEntries; globalThis.horseNames = sampleHorseNames;', context);
vm.runInContext(game.match(/  const horses = [^\n]+/)[0], context);
vm.runInContext(section(design, 'function finishTier(', 'const calendar ='), context);
vm.runInContext(section(design, 'function sampleOddsLabel(', 'function setEntryView('), context);
vm.runInContext(section(design, 'function renderDataQuality(', 'function showRace('), context);
vm.runInContext(section(game, '  function loadQualityExample(', '  function handleAction('), context);
vm.runInContext(section(game, '  function showResult(', '  function finishResult('), context);
vm.runInContext(section(game, '  function openBet(', '  function schedulePurchaseCutoff('), context);

assert.equal(new Set(qualityCases.map(item => item.key)).size, 7);
assert.equal(createQualityRace('unknown'), null);
for (const quality of qualityCases) {
  context.race = createQualityRace(quality.key);
  context.raceView = quality.officialResult ? 'results' : 'entries';
  vm.runInContext('renderEntries(race); renderDataQuality(race); loadQualityExample(race)', context);
  const rows = get('entry-rows').children;
  assert.equal(rows.length, quality.empty ? 0 : 8, quality.key);
  assert.equal(get('race-quality-notice').hidden, false);
  assert.equal(get('race-quality-entry').hidden, false);
  assert.equal(get('#race-panel .entry-table').hidden, Boolean(quality.empty));
  assert.equal(get('quality-empty').hidden, !quality.empty);
  assert.equal(context.state.cash, quality.past ? 490000 : 500000);
  if (quality.past) {
    assert.equal(context.state.tickets.length, 1);
    assert.equal(context.state.tickets[0].status, 'pending');
    assert.equal(unreadForRace(context.state, context.race.id).length, quality.officialResult ? 1 : 0);
  }
  if (quality.officialResult) {
    assert.equal(rows[0].dataset.finish, 'win');
    assert.equal(rows.filter(row => row.dataset.finish === 'unknown').length, 7);
    for (const row of rows.slice(1)) {
      assert.match(row.innerHTML, /result-position-unknown">待确认/);
      assert.doesNotMatch(row.innerHTML, /result-position form-(?:win|placed|other)/);
      assert.match(row.innerHTML, /result-margin[^>]*>暂无/);
    }
    assert.equal(context.state.tickets[0].returned, undefined);
    vm.runInContext('showResult(race, null)', context);
    assert.equal(context.state.cash, 522000, 'partial nonessential fields do not block official champion payout');
    assert.equal(context.state.tickets[0].returned, 32000);
    vm.runInContext('showResult(race, null)', context);
    assert.equal(context.state.cash, 522000, 'repeat viewing does not pay again');
  } else if (quality.past) {
    const before = JSON.stringify(context.state);
    context.race.sampleWinnerNumber = 1;
    assert.equal(recordQualityResult(context.state, context.race), false);
    vm.runInContext('showResult(race, null)', context);
    assert.equal(JSON.stringify(context.state), before, 'pending/conflicting champion cannot pay even if a number is present');
    assert.match(context.message, /正式冠军/);
  }
  if (quality.missingOdds) {
    for (const number of quality.missingOdds) assert.match(rows[number - 1].innerHTML, /odds-value[^>]*>—/);
    vm.runInContext('openBet(race, null)', context);
    const choices = get('game-horses').innerHTML;
    for (const number of quality.missingOdds) assert.match(choices, new RegExp(`value="${number}"[^>]*disabled`));
    assert.doesNotMatch(choices, /null<small>|undefined<small>/);
    assert.match(choices, /暂无倍率/);
    context.selectedHorse = 2;
    vm.runInContext('updateQuote()', context);
    assert.equal(get('game-bet-submit').disabled, true);
    assert.equal(get('game-lock-odds').textContent, '暂无倍率');
    assert.equal(context.state.cash, 500000);
    assert.throws(() => placeTicket(context.state, context.race, { number: 2, name: 'Missing', odds: null }, 10000, new Date(fixedNow), 'Asia/Shanghai'), /倍率/);
    assert.equal(context.state.cash, 500000);
  }
  if (quality.key === 'cached-failed') {
    vm.runInContext('openBet(race, null)', context);
    assert.equal(get('game-bet-submit').disabled, false);
    assert.match(get('game-bet-submit').textContent, /缓存赔率/);
    assert.equal(get('game-cached-odds-note').hidden, false);
  }
  if (quality.empty) assert.match(bettingBlockReason(context.race, new Date(fixedNow), 'Asia/Shanghai'), /名单/);
}
// Ordinary details recover their original controls after a quality scenario.
context.race = { country: 'JP', startAt: '2026-10-29T06:40:00Z' };
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-notice').hidden, true);
assert.equal(get('race-quality-entry').hidden, true);
assert.equal(get('quality-empty').hidden, true);
assert.equal(get('#race-panel .entry-table').hidden, false);
assert.equal(get('#race-panel .odds-preview-control').hidden, false);
// Ordinary missing prize fields also expose the entry, without changing funds.
context.race = { country: 'GB', startAt: '2026-10-29T06:40:00Z' };
const beforeExceptionDetails = JSON.stringify(context.state);
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-entry').hidden, false);
assert.match(get('race-quality-copy').textContent, /冠军赏金/);
assert.match(get('race-quality-ticket').textContent, /不处理资金/);
assert.equal(JSON.stringify(context.state), beforeExceptionDetails);
get('race-quality-dialog').open = true;
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-dialog').open, true, 'refreshing content must not collapse an open explanation');
assert.equal(JSON.stringify(context.state), beforeExceptionDetails);
get('quality-study').hidden = true;
initQualityLinks('unknown', '', doc);
assert.equal(get('quality-study').hidden, true);
initQualityLinks('official-partial', '?preview=calendar&lang=ja&settingsMenu=preview&game=win&horse=1&quality=official-partial', doc);
assert.equal(get('quality-study').hidden, false);
assert.equal(get('quality-study-links').children.length, 7);
for (const link of get('quality-study-links').children) {
  const url = new URL(link.href, 'http://127.0.0.1:8765/');
  assert.equal(url.searchParams.get('lang'), 'ja');
  assert.equal(url.searchParams.get('settingsMenu'), 'preview');
  assert.equal(url.searchParams.has('game'), false);
  assert.equal(url.searchParams.has('horse'), false);
  assert.equal(url.searchParams.has('expression'), false);
}
assert.equal(get('quality-study-links').children.filter(link => link.attributes['aria-current'] === 'page').length, 1);
// Only the avatar opens the modal; text/entry and rendering are passive.
const beforeModal = JSON.stringify(context.state);
const raceModal = get('race-dialog');
const exceptionModal = get('race-quality-dialog');
const avatar = get('quality-avatar-button');
exceptionModal.open = false;
raceModal.open = true;
raceModal.dataset.panel = 'race';
raceModal.dataset.colorRegion = 'jp';
get('race-quality-entry').hidden = false;
initQualityDialog(doc);
get('race-quality-summary').dispatch('click');
get('race-quality-entry').dispatch('click');
assert.equal(exceptionModal.open, false);
avatar.dispatch('click');
assert.equal(exceptionModal.open, true);
assert.equal(exceptionModal.dataset.colorRegion, 'jp');
assert.equal(raceModal.open, true, 'race detail stays open underneath');
assert.equal(exceptionModal.showCount, 1);
avatar.dispatch('click');
assert.equal(exceptionModal.showCount, 1, 'do not reopen an already open modal');
exceptionModal.dispatch('click', { clientX: 50, clientY: 50 });
assert.equal(exceptionModal.open, true, 'inside click does not close');
exceptionModal.dispatch('click', { target: get('race-quality-copy'), clientX: 0, clientY: 0 });
assert.equal(exceptionModal.open, true, 'content click is not a backdrop click');
exceptionModal.dispatch('click', { clientX: 0, clientY: 0 });
assert.equal(exceptionModal.open, false);
assert.deepEqual(avatar.focusOptions, { preventScroll: true });
for (const region of ['au', 'hk', 'other']) {
  raceModal.dataset.colorRegion = region;
  avatar.dispatch('click');
  assert.equal(exceptionModal.dataset.colorRegion, region);
  exceptionModal.close();
}
get('race-quality-entry').hidden = true;
avatar.dispatch('click');
assert.equal(exceptionModal.open, false);
get('race-quality-entry').hidden = false;
raceModal.dataset.panel = 'horse';
avatar.dispatch('click');
assert.equal(exceptionModal.open, false);
raceModal.dataset.panel = 'race';
raceModal.open = false;
avatar.dispatch('click');
assert.equal(exceptionModal.open, false);
raceModal.open = true;
avatar.dispatch('click');
assert.equal(exceptionModal.open, true);
raceModal.close();
assert.equal(exceptionModal.open, false, 'closing the underlying race clears its exception modal');
assert.equal(JSON.stringify(context.state), beforeModal, 'opening/closing the explanation never changes money or result acknowledgements');

// A failed category must not roll successful results back to a partial result.
const availability = createAvailabilityRaces(new Date(fixedNow));
const refreshed = availability.find(race => race.id === 'availability-updated');
context.race = refreshed;
context.raceView = 'results';
const beforeUpdateNotice = JSON.stringify(context.state);
vm.runInContext('renderEntries(race); renderDataQuality(race)', context);
const latestRows = get('entry-rows').children.map(row => row.innerHTML);
assert.equal(latestRows.length, 8);
assert.ok(latestRows.every(row => !row.includes('result-position-unknown')));
assert.equal(get('race-quality-entry').hidden, false);
assert.equal(get('race-quality-summary').textContent, '单胜赔率更新失败');
assert.match(get('race-quality-copy').textContent, /单胜赔率[\s\S]*上次成功[\s\S]*赛果已成功更新/);
assert.equal(get('race-quality-dialog').open, false, 'failure notice stays passive until avatar click');
assert.equal(JSON.stringify(context.state), beforeUpdateNotice);
context.race = { ...refreshed, sampleUpdateFailures: [...refreshed.sampleUpdateFailures, { field: 'horse', label: '马匹资料', reason: '该项请求失败' }] };
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-summary').textContent, '2 项资料更新失败');
assert.match(get('race-quality-copy').textContent, /马匹资料/);
context.race = createAvailabilityRaces(new Date(fixedNow), true).find(race => race.id === refreshed.id);
vm.runInContext('renderEntries(race); renderDataQuality(race)', context);
assert.equal(get('race-quality-entry').hidden, true);
assert.deepEqual(get('entry-rows').children.map(row => row.innerHTML), latestRows, 'recovery does not change result rows or insert layout rows');
context.oddsRefreshFailed = true;
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-summary').textContent, '单胜赔率更新失败', 'existing failure control exposes the same avatar');
context.oddsRefreshFailed = false;
context.navigator.onLine = false;
vm.runInContext('renderDataQuality(race)', context);
assert.match(get('race-quality-copy').textContent, /当前离线/);
context.navigator.onLine = true;
vm.runInContext('renderDataQuality(race)', context);
assert.equal(get('race-quality-entry').hidden, true);

// Render actual shop cards: list all missing prerequisites and never debit.
context.availabilityRaces = [...availability, { ...createAvailabilityRaces(new Date(fixedNow), true)[0], id: 'ready' },
  { ...availability[0], id: 'today', startAt: fixedNow }];
Object.assign(context, { withinBetWindow, countryColors: { JP: 'jp', AU: 'au' }, state: createState(), renderTicketFolder() {} });
vm.runInContext('races.splice(0, races.length, ...availabilityRaces)', context);
vm.runInContext(section(game, '  function openWallet()', '  function renderTicketFolder()'), context);
const beforeCards = JSON.stringify(context.state);
vm.runInContext('openWallet()', context);
const cards = get('game-upcoming').innerHTML;
const entriesCard = cards.match(/<button[^>]*data-race="availability-entries"[\s\S]*?<\/button>/)[0];
const oddsCard = cards.match(/<button[^>]*data-race="availability-odds"[\s\S]*?<\/button>/)[0];
assert.match(entriesCard, /disabled/);
assert.match(entriesCard, /出马表尚未确认 · 官方单胜赔率尚未取得/);
assert.doesNotMatch(entriesCard, /data-game-action="bet"/);
assert.match(oddsCard, /disabled/);
assert.match(oddsCard, /官方单胜赔率尚未取得/);
assert.doesNotMatch(oddsCard, /出马表尚未确认/);
assert.match(cards, /data-game-action="bet"[^>]*data-race="ready"/);
assert.doesNotMatch(cards, /data-race="today"|data-race="availability-updated"/);
assert.equal(JSON.stringify(context.state), beforeCards);
for (const race of availability.slice(0, 2)) {
  assert.throws(() => placeTicket(context.state, race, { number: 1, name: 'Sample', odds: '3.2' }, 10000, new Date(fixedNow), 'Asia/Shanghai'), /名单|赔率/);
}
assert.equal(JSON.stringify(context.state), beforeCards);
initAvailabilityLinks('preview', '?availability=preview&lang=ja&settingsMenu=preview&game=wallet&year=2026&month=10&quality=conflict', doc);
assert.equal(get('quality-study-links').children.length, 3);
for (const link of get('quality-study-links').children) {
  const params = new URL(link.href, 'http://127.0.0.1:8765/').searchParams;
  assert.equal(params.get('lang'), 'ja');
  assert.equal(params.get('settingsMenu'), 'preview');
  assert.equal(params.get('v'), '62');
  assert.ok(!params.has('quality') && !params.has('year') && !params.has('month'));
}
assert.equal(get('quality-study-links').children.filter(link => link.attributes['aria-current'] === 'page').length, 1);
console.log('PASS: unavailable shop cards retain every missing prerequisite; valid cards remain purchasable; same-day exclusion and submit guards; category failures use the passive avatar without replacing results or paying funds; recovery and offline/manual failure entry; review links preserved.');
console.log('PASS: fixed non-crying avatar, avatar-only modal opening, region theme, duplicate guard, backdrop vs content click, focus callback and parent close; seven quality states, missing fields and existing financial checks retained. Browser layout/native interaction not tested.');

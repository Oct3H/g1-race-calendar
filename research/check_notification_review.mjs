// Real preview controllers and financial functions with DOM doubles; no rendered browser.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createGamePreview } from '../design/game-design.js';
import { notificationRaces, notificationState } from '../design/notification-review.mjs';

const names = { ja: ['架空馬 A', '架空馬 B'], en: ['Sample A', 'Sample B'], 'zh-Hant': ['虛構馬 A', '虛構馬 B'] };
const entries = [{ number: 1, odds: '4.0' }, { number: 2, odds: '3.2' }];
const raceFixtures = notificationRaces();
const account = notificationState(raceFixtures, () => entries.map((e, i) => ({ ...e, name: names.en[i] })));
assert.equal(account.cash, 500000);
assert.deepEqual(account.tickets.map(t => t.status), ['won', 'pending', 'pending']);
assert.equal(account.tickets[0].returned, 40000);
assert.equal(account.tickets[0].read, true);
assert.equal(notificationState(raceFixtures, () => entries.map((e, i) => ({ ...e, name: names.en[i] })), true).cash, 10000);

const nodes = new Map();
class Node {
  constructor() { this.listeners = new Map(); this.parts = new Map(); this.dataset = {}; this.children = []; this.attrs = {}; this.open = false; this.hidden = true; this.innerHTML = ''; this.textContent = ''; }
  setAttribute(k,v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] || ''; }
  append(n) { this.children.push(n); if (n.id) nodes.set(n.id, n); }
  prepend(n) { this.children.unshift(n); }
  after() {}
  querySelector(selector) {
    if (selector === '[data-notification-refresh]') return this.parts.get(selector) || null;
    if (!this.parts.has(selector)) this.parts.set(selector, new Node());
    return this.parts.get(selector);
  }
  querySelectorAll() { return []; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  dispatch(type, event) { for (const fn of this.listeners.get(type) || []) fn(event); }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close', {}); }
  focus() {}
}
const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
globalThis.document = { getElementById: get, querySelector: get, createElement: () => new Node(), body: new Node(), addEventListener() {} };
globalThis.window = { location: { search: '?preview=calendar&notifications=preview&refund=preview' }, addEventListener() {} };
globalThis.location = window.location;
const races = notificationRaces();
let refreshRequests = 0, showDetails = 0, returns = 0;
const api = createGamePreview({ races, entries, horseNames: names, countryColors: { JP: 'jp', FR: 'fr', US: 'us', HK: 'hk' },
  showRace() { showDetails++; }, closeRace() { returns++; }, renderCalendar() {}, showOdds() {}, requestRefresh() { refreshRequests++; }, getOddsStatus: () => 'success' });
const event = dataset => ({ preventDefault() {}, target: { dataset, closest(selector) {
  if (selector === '[data-game-action]' && dataset.gameAction) return this;
  if (selector === '[data-notification-case]' && dataset.notificationCase) return this;
  if (selector === '[data-notification-refresh]' && dataset.notificationRefresh) return this;
  if (selector === '[data-correction-close]' && dataset.correctionClose) return this;
  return null;
} } });
const gameAction = action => get('game-dialog').dispatch('click', event({ gameAction: action }));
const changeCase = key => get('notification-study').dispatch('click', event({ notificationCase: key }));
const closeCorrection = () => get('correction-dialog').dispatch('cancel', event({}));
const shop = () => get('.header-actions').children[0].dispatch('click', event({ gameAction: 'wallet' }));
const cash = () => get('game-header-cash').textContent;
const assertSingle = () => assert.ok(Number(get('game-dialog').open) + Number(get('correction-dialog').open) <= 1, 'financial prompts must not stack');
const header = () => ['game-title','game-result-profit','game-result-summary','game-result-details'].map(id => [get(id).textContent, get(id).innerHTML]);
const correctionHeader = () => ['correction-title','correction-delta','correction-balance','correction-rows'].map(id => [get(id).textContent, get(id).innerHTML]);

// One refresh: refunds auto-credit and prompt; all other financial changes wait for viewing.
api.openFromParams();
assert.equal(refreshRequests, 1);
assert.equal(cash(), '¥500,000');
assert.equal(get('game-dialog').open, false);
api.processRefreshedChanges();
assert.equal(cash(), '¥520,000');
assert.match(get('game-title').textContent, /本金已退回/);
assert.equal(get('game-dialog').dataset.colorRegion, 'us');
assert.equal(get('correction-dialog').open, false);
assertSingle();
assert.equal(api.hasUnread('notify-correction'), true);
assert.equal(api.hasUnread('notify-result'), true);
assert.equal(races.find(r => r.id === 'notify-failure').sampleUpdateFailures[0].field, 'odds');
const detailCalls = showDetails;
api.processRefreshedChanges();
assert.equal(cash(), '¥520,000', 'repeat refresh does not refund again');
gameAction('close');
assert.equal(showDetails, detailCalls, 'refund and failures do not auto-open unrelated details');
assert.equal(get('game-dialog').open, false);
assert.equal(api.hasUnread('notify-refund'), false);
shop();
assert.equal(get('correction-dialog').open, true);
assert.equal(cash(), '¥480,000');
assert.equal(get('correction-dialog').dataset.colorRegion, 'fr');
closeCorrection();
assert.equal(get('game-dialog').open, true);
assert.equal(get('game-dialog').dataset.colorRegion, 'jp');
assert.equal(cash(), '¥512,000');
assert.match(get('game-kicker').textContent, /RACE SETTLEMENT/);
assertSingle();
gameAction('close');
assert.equal(get('game-title').textContent, '特别周的小店');
assert.equal(api.hasUnread('notify-correction'), false);
assert.equal(api.hasUnread('notify-result'), false);
gameAction('close'); shop();
assert.equal(cash(), '¥512,000', 'rereading does not repay or readjust');

// A live settlement stays unchanged; newest correction goes first, then the refunded principal.
changeCase('result');
assert.equal(cash(), '¥532,000');
const originalResult = header();
api.processRefreshedChanges();
assert.equal(cash(), '¥552,000', 'refund credits without awaiting its prompt');
assert.deepEqual(header(), originalResult, 'current result snapshot is not rewritten');
assert.equal(get('game-refund-pending').hidden, false);
assert.equal(get('correction-dialog').open, false);
get('game-dialog').dispatch('cancel', event({}));
assert.equal(cash(), '¥520,000');
assert.equal(get('correction-dialog').open, true);
assert.equal(get('game-dialog').open, false);
assert.equal(get('correction-refund-pending').hidden, false);
assert.match(get('correction-continue').innerHTML, /继续查看退款/);
assertSingle();
closeCorrection();
assert.equal(cash(), '¥520,000');
assert.match(get('game-title').textContent, /本金已退回/);
assert.equal(get('game-dialog').dataset.result, 'refund');
assertSingle();
gameAction('close');
assert.equal(get('game-dialog').open, false);
assert.equal(api.hasUnread('notify-result'), false);
assert.equal(api.hasUnread('notify-refund'), false);

// The same order works from an already displayed correction; another race remains unclaimed.
changeCase('correction');
assert.equal(cash(), '¥460,000');
const originalCorrection = correctionHeader();
api.processRefreshedChanges();
assert.equal(cash(), '¥480,000');
assert.deepEqual(correctionHeader(), originalCorrection);
assert.equal(get('correction-refund-pending').hidden, false);
assert.equal(get('game-dialog').open, false);
closeCorrection();
assert.equal(get('correction-dialog').open, true);
assert.equal(cash(), '¥520,000');
closeCorrection();
assert.match(get('game-title').textContent, /本金已退回/);
assertSingle();
gameAction('close');
assert.equal(api.hasUnread('notify-result'), true, 'another race does not settle as a side effect');
assert.equal(cash(), '¥520,000');

// A refund can supersede a not-yet-shown bankruptcy; preserve the original correction receipt.
changeCase('shortfall');
assert.equal(cash(), '¥0');
assert.match(get('correction-waived').textContent, /30,000/);
const frozenShortfall = correctionHeader();
api.processRefreshedChanges();
assert.equal(cash(), '¥20,000');
assert.deepEqual(correctionHeader(), frozenShortfall);
closeCorrection();
assert.match(get('game-title').textContent, /本金已退回/);
gameAction('close');
assert.equal(get('game-dialog').open, false);
assert.notEqual(get('game-title').textContent, '资金用完了…');
assert.equal(cash(), '¥20,000');
shop();
assert.equal(get('game-title').textContent, '特别周的小店');
assert.match(get('game-tickets').innerHTML, /等待赛果/);

// Without the refund publication, correction-specific bankruptcy still follows the receipt.
changeCase('shortfall'); closeCorrection();
assert.equal(get('game-title').textContent, '资金用完了…');
assert.doesNotMatch(get('game-result-caption').textContent, /银行|取款/);
assert.equal(get('game-bankrupt-japanese').hidden, false);
assertSingle();

// Ordinary launch: no fixture funds or publications until the shop is opened.
nodes.clear(); window.location.search = '?preview=calendar';
const normal = createGamePreview({ races: notificationRaces(), entries, horseNames: names, countryColors: {}, showRace() {}, closeRace() {}, renderCalendar() {}, showOdds() {}, requestRefresh() {}, getOddsStatus: () => 'success' });
normal.openFromParams(); normal.processRefreshedChanges();
assert.equal(cash(), '¥0');
assert.equal(get('game-dialog').open, false);
assert.equal(get('notification-study').hidden, true);
const result = { round: 72, status: 'passed', method: 'actual financial functions and controllers with DOM doubles', cases: ['idle combined refresh', 'result -> latest correction -> refund', 'correction -> latest correction -> refund', 'refund supersedes stale bankruptcy', 'bankruptcy without refund', 'chronological shop queue', 'repeat refresh/view idempotence', 'ordinary inactive shop'], browserRendered: false, liveSourceUpdated: false };
await writeFile(new URL('./notification-review-check-72.json', import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

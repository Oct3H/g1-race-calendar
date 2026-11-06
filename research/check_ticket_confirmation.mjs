import { uiText } from '../design/ui-language.mjs';
// Checks the displayed confirmation amounts using the actual preview function.
// No browser, website, network or persistent wallet is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { grossReturn, bettingBlockReason } from '../design/game-state.mjs';

const source = await readFile(new URL('../design/game-design.js', import.meta.url), 'utf8');
const functionSource = source.slice(source.indexOf('  function updateQuote()'), source.indexOf('  function showResult('));
const fields = new Map();
const get = id => {
  if (!fields.has(id)) fields.set(id, { textContent: '', value: '', attributes: {}, setAttribute(key,value) { this.attributes[key] = value; }, querySelectorAll() { return []; } });
  return fields.get(id);
};
const race = { startAt: '2026-10-23T06:00:00Z', sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '官方单胜来源（虚构演示）', sampleOddsAt: '2026-10-20T04:00:00Z' };
const state = { cash: 500000, tickets: [] };
const choices = [{ number: 1, name: 'ハルノスピカ', odds: '3.2' }, { number: 2, name: 'ミントステップ', odds: '4.8' }];
const money = value => `¥${new Intl.NumberFormat('ja-JP').format(value)}`;
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
let mode = 'success';
let scheduledRefresh;
let now = '2026-10-22T15:59:59Z';
class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return new Date(now).getTime(); }
}
const update = new Function('uiText', 'get', 'state', 'selectedRace', 'selectedHorse', 'horses', 'grossReturn', 'money', 'signed', 'zone', 'getOddsStatus', 'bettingBlockReason', 'Date', 'setTimeout', 'clearTimeout', `let cutoffTimer; const refundPreview = false; const view = 'bet'; ${functionSource}\nupdateQuote();`);
function render(horse, amount) {
  get('game-stake').value = String(amount);
  update(uiText, get, state, race, horse, () => choices, grossReturn, money, signed, () => 'Asia/Shanghai', () => mode, bettingBlockReason, ClockDate, callback => { scheduledRefresh = callback; return 1; }, () => {});
}

render(2, 10000);
assert.equal(get('game-selected-horse').textContent, 'ミントステップ');
assert.equal(get('game-selected-number').textContent, 2);
assert.equal(get('game-selected-stake').textContent, '¥10,000');
assert.equal(get('game-lock-odds').textContent, '4.8 倍');
assert.equal(get('game-return').textContent, '¥48,000');
assert.equal(get('game-profit').textContent, '+¥38,000');
assert.equal(get('game-cash-after').textContent, '¥490,000');
assert.match(get('game-purchase-record-note').textContent, /独立成券.*不可主动撤回/);
state.tickets.push({ raceId: 'sample', horseNumber: 2, status: 'pending', amount: 10000, odds: '4.0' });
race.id = 'sample';
render(2, 10000);
assert.match(get('game-purchase-record-note').textContent, /已持有本场该马 1 张.*¥10,000.*旧马券倍率不变/);
assert.equal(state.tickets[0].odds, '4.0');
state.tickets = [];
assert.match(get('game-quote-source').textContent, /赔率来源：官方单胜来源（虚构演示）\n取得时间：2026/);
assert.doesNotMatch(get('game-quote-source').textContent, /确认快照/);
assert.equal(get('game-cached-odds-note').hidden, true);
for (mode of ['failed', 'offline']) {
  render(2, 10000);
  assert.equal(get('game-cached-odds-note').hidden, false);
  assert.match(get('game-cached-odds-note').textContent, /上次缓存的官方赔率.*2026/);
  assert.equal(get('game-bet-submit').disabled, false);
  assert.match(get('game-bet-submit').textContent, /按缓存赔率确认购买/);
  assert.equal(get('game-lock-odds').textContent, '4.8 倍');
}
now = '2026-10-22T16:00:00Z';
scheduledRefresh();
assert.equal(get('game-bet-submit').disabled, true, 'the cutoff timer disables an already-open form without a network refresh');
for (mode of ['success', 'failed', 'offline']) {
  render(2, 10000);
  assert.equal(get('game-bet-submit').disabled, true);
  assert.match(get('game-purchase-reason').textContent, /比赛当日/);
}
now = '2026-10-22T15:59:59Z';
mode = 'success';

render(1, 500000);
assert.equal(get('game-selected-horse').textContent, 'ハルノスピカ');
assert.equal(get('game-return').textContent, '¥1,600,000');
assert.equal(get('game-profit').textContent, '+¥1,100,000');
assert.equal(get('game-cash-after').textContent, '¥0');
for (const amount of [0, '', -1, 500001, 1.5]) {
  render(1, amount);
  for (const id of ['game-selected-stake', 'game-return', 'game-profit', 'game-cash-after']) assert.equal(get(id).textContent, '—');
}
assert.equal(state.cash, 500000, 'a quote must not debit funds');
race.sampleOddsAt = null;
render(1, 10000);
assert.match(get('game-quote-source').textContent, /取得时间：暂无记录/);
const design = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
assert.match(design, /showOdds: \(\) => setOddsPreview\(true\)/, 'opening the purchase form must not clear a failed refresh');
console.log('PASS: selection, stake, gross return, net profit, remaining cash and source time in confirmation; invalid amounts show no estimate; no funds deducted. Browser layout not tested.');

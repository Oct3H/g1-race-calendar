import assert from 'node:assert/strict';
import { createState, placeTicket, settleRace, recordRaceResult, withdraw, addBankDays, markRead } from '../design/game-state.mjs';
import { correctionImpact, hasUnreadCorrection, recordResultCorrection, applyResultCorrection } from '../design/result-correction-preview.mjs';
import { createCorrectionPreview } from '../design/correction-design.mjs';
import { createGamePreview } from '../design/game-design.js';

const fixture = (winners = [1], odds = '4.0', amount = 10000) => {
  const state = createState();
  const race = { id: 'shuka', country: 'JP', startAt: '2026-10-18T06:40:00Z', sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: 'Fictional official quote' };
  placeTicket(state, race, { number: 1, name: 'Horse One', odds }, amount, new Date('2026-10-17T03:00:00Z'), 'Asia/Shanghai');
  settleRace(state, race.id, winners); markRead(state, race.id);
  race.sampleFinished = true; race.sampleWinnerNumbers = [...winners]; race.sampleWinnerNumber = winners[0];
  return { state, race };
};
const update = (winners, id = 'v1', day = 19) => ({ id, at: `2026-10-${day}T04:00:00Z`, winners, source: 'Fictional official revision' });
for (const [old, next, delta] of [[[2], [1], 40000], [[1], [2], -40000], [[1], [1, 2], -20000], [[2], [3], 0]]) {
  const { state, race } = fixture(old);
  const beforeCash = state.cash;
  const beforeTickets = JSON.stringify(state.tickets);
  assert.equal(recordResultCorrection(state, race, update(next)), true);
  assert.equal(state.cash, beforeCash);
  assert.equal(JSON.stringify(state.tickets), beforeTickets, 'recording does not revise settled tickets or money');
  assert.equal(race.sampleChange.read, false);
  assert.equal(correctionImpact(state, race.id).delta, delta);
  assert.equal(hasUnreadCorrection(state, race.id), delta !== 0);
  const receipt = applyResultCorrection(state, race.id, '2026-10-24T04:00:00Z');
  assert.equal(state.cash, beforeCash + delta);
  assert.equal(receipt.actualDelta, delta);
  assert.equal(receipt.waived, 0);
  assert.equal(state.tickets[0].originalSettlement.returned, old.includes(1) ? 40000 : 0);
  assert.equal(state.tickets[0].amount, 10000);
  assert.equal(state.tickets[0].odds, '4.0');
  assert.equal(state.tickets[0].source, 'Fictional official quote');
  const done = JSON.stringify(state);
  assert.equal(applyResultCorrection(state, race.id, 'later'), null);
  assert.equal(recordResultCorrection(state, race, update(next)), false);
  assert.equal(recordResultCorrection(state, race, update(next, 'duplicate-content', 25)), false);
  assert.equal(JSON.stringify(state), done, 'repeat view/fetch does not repeat bookkeeping');
  assert.equal(hasUnreadCorrection(state, race.id), false);
}
// Successive updates compare only against the last processed entitlement, never interim versions.
{
  const { state, race } = fixture();
  recordResultCorrection(state, race, update([2]));
  recordResultCorrection(state, race, update([1], 'v2', 20));
  recordResultCorrection(state, race, update([1, 2], 'v3', 21));
  assert.equal(state.cash, 530000);
  assert.equal(correctionImpact(state, race.id).delta, -20000);
  applyResultCorrection(state, race.id, '2026-10-24T04:00:00Z');
  assert.equal(state.cash, 510000);
  assert.equal(state.resultCorrections.shuka.adjustments.length, 1);
  recordResultCorrection(state, race, update([1], 'v4', 22));
  assert.equal(correctionImpact(state, race.id).delta, 20000);
  applyResultCorrection(state, race.id, '2026-10-24T04:01:00Z');
  assert.equal(state.cash, 530000);
  assert.equal(state.tickets[0].originalSettlement.returned, 40000);
  assert.equal(state.tickets[0].correctionHistory.length, 2);
}
// Shortfall is waived; pending tickets/bank survive and later incoming money is not clawed back.
{
  const { state, race } = fixture();
  const other = { ...race, id: 'tenno', sampleFinished: false, startAt: '2026-11-01T06:40:00Z' };
  placeTicket(state, other, { number: 2, name: 'Pending', odds: '3.2' }, 520000, new Date('2026-10-22T03:00:00Z'), 'Asia/Shanghai');
  addBankDays(state, 3);
  recordResultCorrection(state, race, update([2]));
  const receipt = applyResultCorrection(state, race.id, '2026-10-24T04:00:00Z');
  assert.deepEqual([receipt.expectedDelta, receipt.actualDelta, receipt.waived, state.cash, state.bank], [-40000, -10000, 30000, 0, 30000]);
  assert.equal(receipt.bankrupt, true);
  assert.equal(state.tickets[1].status, 'pending');
  withdraw(state, 30000);
  assert.equal(state.cash, 30000);
  settleRace(state, other.id, 2);
  assert.equal(state.cash, 1694000);
  assert.equal(applyResultCorrection(state, race.id, 'later'), null);
  assert.equal(state.cash, 1694000);
}
// Exact exhaustion also triggers the correction-specific bankruptcy rule.
{
  const { state, race } = fixture(); state.cash = 40000;
  recordResultCorrection(state, race, update([2]));
  const receipt = applyResultCorrection(state, race.id, 'now');
  assert.equal(receipt.bankrupt, true); assert.equal(receipt.waived, 0);
}
// Pending first settlement follows latest winner; refunded tickets are never corrected.
{
  const { state, race } = fixture();
  const ticket = state.tickets[0];
  ticket.status = 'pending'; delete ticket.returned; delete ticket.winnerNumbers;
  recordRaceResult(state, race.id, 1);
  recordResultCorrection(state, race, update([2]));
  assert.deepEqual(ticket.confirmedWinners, [2]);
  assert.equal(hasUnreadCorrection(state, race.id), false);
  const cash = state.cash; settleRace(state, race.id); assert.equal(state.cash, cash);
  ticket.status = 'void'; ticket.returned = ticket.amount;
  recordResultCorrection(state, race, update([1], 'v2', 20));
  applyResultCorrection(state, race.id, 'now');
  assert.equal(ticket.status, 'void'); assert.equal(ticket.returned, ticket.amount);
}
// Decimal/dead-heat rounding reuses exact original locked odds, not market values.
{
  const { state, race } = fixture([1], '2.875', 10002);
  recordResultCorrection(state, race, update([1, 2]));
  applyResultCorrection(state, race.id, 'now');
  assert.equal(state.tickets[0].returned, 14377);
  const snapshot = JSON.stringify([state, race]);
  assert.throws(() => recordResultCorrection(state, race, update([2], 'old', 18)), /较新/);
  assert.throws(() => recordResultCorrection(state, race, update([], 'invalid', 25)), /不完整/);
  assert.equal(JSON.stringify([state, race]), snapshot);
}

// Exercise the real correction controller with DOM doubles; no browser geometry/native UI claims.
class Node {
  constructor() { this.listeners = new Map(); this.parts = new Map(); this.dataset = {}; this.open = false; this.hidden = true; this.textContent = ''; this.innerHTML = ''; }
  setAttribute() {}
  append() {}
  querySelector(selector) { if (!this.parts.has(selector)) this.parts.set(selector, new Node()); return this.parts.get(selector); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
let actualModal;
const doc = { getElementById: get, createElement: () => (actualModal = new Node()), body: new Node() };
const races = [{ id: 'shuka', country: 'JP', name: '秋華賞', startAt: '2026-10-18T06:40:00Z' }, { id: 'tenno', country: 'JP', name: '天皇賞', startAt: '2026-11-01T06:40:00Z' }];
let state, bankrupt = 0, shownRace = 0, wallet = 0, changes = 0;
const ui = createCorrectionPreview({ document: doc, races, horses: () => [{ number: 1, name: 'Horse One', odds: '4.0' }, { number: 2, name: 'Horse Two', odds: '3.2' }],
  getState: () => state, replaceState: value => { state = value; }, resetSamples: () => { for (const race of races) { delete race.sampleChange; delete race.sampleChangeHistory; } },
  closeGame() {}, closeRace() {}, showRace() { shownRace++; }, openWallet() { wallet++; }, onBankrupt() { bankrupt++; }, changed() { changes++; },
  money: value => `¥${value}`, signed: value => `${value > 0 ? '+' : ''}¥${value}`, escape: String, countryColors: { JP: 'jp' }
});
const close = () => actualModal.listeners.get('click')({ target: { closest: selector => selector === '[data-correction-close]' } });
for (const key of ['credit', 'debit', 'shortfall', 'multiple', 'tie', 'neutral']) {
  ui.loadExample(key);
  assert.equal(actualModal.open, false, 'receiving changes does not show a payment dialog');
  const before = state.cash;
  const expected = key === 'credit' ? 40000 : ['tie', 'multiple'].includes(key) ? -20000 : key === 'neutral' ? 0 : -40000;
  assert.equal(correctionImpact(state, 'shuka').delta, expected);
  assert.equal(ui.hasUnread('shuka'), expected !== 0);
  const oldBroke = bankrupt;
  ui.show(races[0], null);
  assert.equal(actualModal.open, true);
  assert.equal(actualModal.dataset.colorRegion, 'jp');
  assert.equal(state.cash, Math.max(0, before + expected));
  assert.equal(bankrupt, oldBroke, 'bankruptcy is not shown simultaneously with the correction');
  assert.match(get('correction-history').innerHTML, /发布版本/);
  assert.equal(ui.hasUnread('shuka'), false);
  close();
  assert.equal(actualModal.open, false);
  assert.equal(bankrupt, oldBroke + (key === 'shortfall' ? 1 : 0));
  const cash = state.cash;
  ui.show(races[0], null);
  assert.equal(state.cash, cash);
  close();
  assert.equal(bankrupt, oldBroke + (key === 'shortfall' ? 1 : 0), 'rereading a receipt does not retrigger bankruptcy');
  assert.match(ui.ticketHistory(state.tickets[0]), /原结算返还/);
}
ui.loadExample('credit');
assert.equal(ui.openFirst(null), true);
const after = state.cash;
actualModal.listeners.get('cancel')({ preventDefault() {} });
assert.equal(wallet, 1);
assert.equal(state.cash, after);
assert.ok(changes > 0 && shownRace > 0);

// Updates arriving while a correction receipt is open never rewrite it or pay early.
ui.loadExample('live');
ui.show(races[0], null);
assert.equal(state.cash, 530000);
const frozenReceipt = ['correction-title', 'correction-delta', 'correction-balance', 'correction-rows', 'correction-history'].map(id => [get(id).textContent, get(id).innerHTML]);
ui.simulateIncoming();
ui.simulateIncoming();
assert.equal(state.cash, 530000);
assert.equal(ui.hasQueued(), true);
assert.equal(get('correction-new-update').hidden, false);
assert.deepEqual(['correction-title', 'correction-delta', 'correction-balance', 'correction-rows', 'correction-history'].map(id => [get(id).textContent, get(id).innerHTML]), frozenReceipt);
assert.equal(state.resultCorrections.shuka.adjustments.length, 1);
close();
assert.equal(actualModal.open, true, 'closing automatically opens the latest revision');
assert.equal(state.resultCorrections.shuka.adjustments.length, 2, 'interim revisions do not each generate an adjustment');
assert.equal(state.cash, 530000, 'latest revision restores the same entitlement: net delta is zero');
assert.equal(ui.hasQueued(), false);
assert.equal(get('correction-new-update').hidden, true);
close();
assert.equal(actualModal.open, false);
const afterLatest = state.cash;
ui.show(races[0], null); close();
assert.equal(state.cash, afterLatest);

// A pending bankruptcy is superseded by a newly viewed correction that restores cash.
ui.loadExample('shortfall');
ui.show(races[0], null);
const brokeBeforeNew = bankrupt;
ui.receive(races[0], update([1], 'restore-winner', 26));
assert.equal(state.cash, 0);
close();
assert.equal(actualModal.open, true);
assert.equal(state.cash, 40000);
assert.equal(bankrupt, brokeBeforeNew);
close();
assert.equal(bankrupt, brokeBeforeNew, 'do not show a stale zero-balance screen after the next correction restores funds');

// Exercise actual game integration: calendar intercept -> correction -> broke -> wallet/bank.
class GameNode extends Node {
  constructor() { super(); this.attrs = {}; this.children = []; }
  append(node) { this.children.push(node); if (node.id) gameNodes.set(node.id, node); }
  prepend(node) { this.append(node); }
  after() {}
  querySelector(selector) { if (!this.parts.has(selector)) this.parts.set(selector, new GameNode()); return this.parts.get(selector); }
  querySelectorAll() { return []; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key] || ''; }
  focus() {}
}
const gameNodes = new Map();
const gameGet = key => { if (!gameNodes.has(key)) gameNodes.set(key, new GameNode()); return gameNodes.get(key); };
globalThis.document = { getElementById: gameGet, querySelector: gameGet, createElement: () => new GameNode(), body: new GameNode(), addEventListener() {} };
globalThis.window = { location: { search: '?correction=shortfall&refund=preview' }, addEventListener() {} };
globalThis.location = window.location;
const gameRaces = [{ id: 'shuka', country: 'JP', name: '秋華賞', nameLang: 'ja', startAt: '2026-10-18T06:40:00Z' }, { id: 'tenno', country: 'JP', name: '天皇賞', nameLang: 'ja', startAt: '2026-11-01T06:40:00Z' }];
const gameApi = createGamePreview({ races: gameRaces, entries: [{ number: 1, odds: '4.0' }, { number: 2, odds: '3.2' }], horseNames: { ja: ['Horse One', 'Horse Two'] }, countryColors: { JP: 'jp' }, showRace() {}, closeRace() {}, renderCalendar() {}, showOdds() {}, requestRefresh() {}, getOddsStatus: () => 'success' });
gameApi.openFromParams();
assert.equal(gameGet('game-header-cash').textContent, '¥10,000');
assert.equal(gameApi.hasUnread('shuka'), true);
const card = new GameNode();
gameApi.decorateCard(card, gameRaces[0]);
assert.equal(card.children[0].textContent, '!');
assert.match(card.children[0].attrs['aria-label'], /更正/);
assert.equal(gameApi.interceptRace(gameRaces[0], card), true);
assert.equal(gameGet('correction-dialog').open, true);
assert.equal(gameGet('game-header-cash').textContent, '¥0');
assert.equal(gameApi.hasUnread('shuka'), false);
assert.notEqual(gameGet('game-title').textContent, '资金用完了…');
gameGet('correction-dialog').listeners.get('cancel')({ preventDefault() {} });
assert.equal(gameGet('game-title').textContent, '资金用完了…');
assert.equal(gameGet('game-kicker').textContent, 'ZERO BALANCE');
assert.equal(gameGet('game-result-summary').textContent, '当前可用资金');
assert.doesNotMatch(gameGet('game-dialog').innerHTML, /game-result-bank|data-game-action="result-bank"/);
assert.match(gameGet('game-result-caption').textContent, /更正扣款.*其他待结算马券保留/);
assert.doesNotMatch(gameGet('game-result-caption').textContent, /所有马券均已结算/);
const actionEvent = gameAction => ({ target: { closest: () => ({ dataset: { gameAction } }) } });
gameGet('game-dialog').listeners.get('click')(actionEvent('close'));
gameGet('game-dialog').listeners.get('click')(actionEvent('wallet'));
assert.match(gameGet('game-cash-note').textContent, /更正扣款后资金归零/);
assert.match(gameGet('game-tickets').innerHTML, /更正后应返还/);
assert.match(gameGet('game-tickets').innerHTML, /查看本场更正记录/);
assert.match(gameGet('game-tickets').innerHTML, /原结算返还/);
gameGet('game-dialog').listeners.get('click')(actionEvent('bank'));
gameGet('game-withdraw').value = '30000';
gameGet('game-withdraw-form').listeners.get('submit')({ preventDefault() {} });
assert.equal(gameGet('game-header-cash').textContent, '¥30,000');
assert.equal(gameGet('game-header-bank').textContent, '¥0');

// Normal launch remains dormant until the shop launcher is used.
gameNodes.clear();
window.location.search = '?preview=calendar';
const normal = createGamePreview({ races: gameRaces, entries: [{ number: 1, odds: '4.0' }, { number: 2, odds: '3.2' }], horseNames: { ja: ['Horse One', 'Horse Two'] }, countryColors: { JP: 'jp' }, showRace() {}, closeRace() {}, renderCalendar() {}, showOdds() {}, requestRefresh() {}, getOddsStatus: () => 'success' });
normal.updateRaceAction(gameRaces[0]);
assert.equal(gameGet('game-header-cash').textContent, '¥0');
assert.equal(gameGet('game-header-bank').textContent, '¥0');
assert.equal(gameGet('game-race-purchase').hidden, true);
assert.equal(gameGet('game-race-action').hidden, true);
const shopLauncher = gameGet('.header-actions').children[0];
shopLauncher.listeners.get('click')(actionEvent('wallet'));
assert.equal(gameGet('game-header-cash').textContent, '¥500,000');
assert.equal(gameGet('game-header-bank').textContent, '¥0');
assert.equal(gameGet('game-toggle-detail-entry').attrs['aria-checked'], 'false');
normal.updateRaceAction(gameRaces[0]);
assert.equal(gameGet('game-race-purchase').hidden, true);
gameGet('game-dialog').listeners.get('click')(actionEvent('toggle-detail-entry'));
assert.equal(gameGet('game-toggle-detail-entry').attrs['aria-checked'], 'true');
normal.updateRaceAction(gameRaces[0]);
assert.equal(gameGet('game-race-purchase').hidden, false);
gameGet('game-dialog').listeners.get('click')(actionEvent('toggle-detail-entry'));
assert.equal(gameGet('game-race-purchase').hidden, true, 'toggle immediately updates an existing race view');
assert.equal(gameGet('game-race-action').hidden, true);
shopLauncher.listeners.get('click')(actionEvent('wallet'));
assert.equal(gameGet('game-header-cash').textContent, '¥500,000');
assert.equal(gameGet('game-toggle-detail-entry').attrs['aria-checked'], 'false');
gameGet('game-dialog').listeners.get('click')(actionEvent('bank'));
assert.match(gameGet('game-bank-timezone').textContent, /换日时区.*首次进入小店时固定/);

// Ordinary settlement receipts also queue later official corrections until closed.
gameNodes.clear();
window.location.search = '?preview=calendar&correction=live-result';
const liveGame = createGamePreview({ races: gameRaces, entries: [{ number: 1, odds: '4.0' }, { number: 2, odds: '3.2' }], horseNames: { ja: ['Horse One', 'Horse Two'] }, countryColors: { JP: 'jp' }, showRace() {}, closeRace() {}, renderCalendar() {}, showOdds() {}, requestRefresh() {}, getOddsStatus: () => 'success' });
liveGame.openFromParams();
assert.equal(gameGet('game-header-cash').textContent, '¥490,000');
assert.equal(liveGame.interceptRace(gameRaces[0], null), true);
assert.equal(gameGet('game-header-cash').textContent, '¥530,000');
const oldSettlement = [gameGet('game-result-profit').textContent, gameGet('game-result-details').innerHTML];
gameGet('game-dialog').listeners.get('click')(actionEvent('incoming-correction'));
assert.equal(gameGet('game-header-cash').textContent, '¥530,000');
assert.equal(gameGet('game-result-new-correction').hidden, false);
assert.deepEqual([gameGet('game-result-profit').textContent, gameGet('game-result-details').innerHTML], oldSettlement);
gameGet('game-dialog').listeners.get('click')(actionEvent('close'));
assert.equal(gameGet('correction-dialog').open, true);
assert.equal(gameGet('game-header-cash').textContent, '¥490,000');
gameGet('correction-dialog').listeners.get('cancel')({ preventDefault() {} });
assert.equal(liveGame.hasUnread('shuka'), false);
delete globalThis.document; delete globalThis.window; delete globalThis.location;
console.log('PASS: latest net correction, locked odds/dead heat, history, waiver/no debt, pending/refunded isolation, idempotence; controller scenes, frozen incoming updates/latest-version continuation, and calendar/game integration through settlement -> queued correction -> bankruptcy/wallet/bank. DOM doubles only; browser not rendered.');

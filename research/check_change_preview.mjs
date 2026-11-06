import * as uiRuntime from '../design/ui-language.mjs';
// Function-level checks against the actual preview source, using small DOM test doubles.
// This does not open a browser or claim to verify layout, focus, or native dialog behavior.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { dateInZone, clockInZone, raceCalendarDate, compareRaceImportance, calendarMonthDays } from '../design/calendar-rules.js';
import { canBet, refundExample, pendingRefundExample, applyRaceChanges, unreadRefundRaceIds, unreadForRace, markRead, settlementExample, settleRace } from '../design/game-state.mjs';
import { applyPreviewRaceUpdate, recordPreviewRaceChange } from '../design/race-change-state.mjs';

const design = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
const game = await readFile(new URL('../design/game-design.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../design/index.html', import.meta.url), 'utf8');
const reviewEntry = html.match(/<nav class="change-review-entry"[^>]*>([\s\S]*?)<\/nav>/);
assert.ok(reviewEntry, 'the review entry must remain outside the hidden comparison links');
assert.doesNotMatch(reviewEntry[0].split('>')[0], /\bhidden\b/);
assert.equal((reviewEntry[1].match(/<a /g) || []).length, 3);
assert.match(reviewEntry[1], /game=refund-cancelled/);
assert.match(reviewEntry[1], /game=refund-withdrawn/);
assert.doesNotMatch(html, /id="race-change-refund"/);
class Node {
  constructor(tag = 'div') {
    this.tag = tag; this.dataset = {}; this.children = []; this.parts = new Map();
    this.textContent = ''; this.hidden = false; this.attributes = {};
    this.classList = { add: value => { this.className = [...new Set([...(this.className || '').split(' ').filter(Boolean), value])].join(' '); }, contains: value => (this.className || '').split(' ').includes(value) };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener() {}
  after(node) { this.afterNode = node; }
  querySelector(selector) {
    if (!this.parts.has(selector)) this.parts.set(selector, new Node());
    return this.parts.get(selector);
  }
  querySelectorAll(selector) {
    assert.equal(selector, '.day-more[open]');
    return descendants(this).filter(node => node.tag === 'details' && node.className === 'day-more' && node.open);
  }
  closest(selector) {
    assert.equal(selector, '.day');
    let node = this;
    while (node && !(node.className || '').split(' ').includes('day')) node = node.parent;
    return node;
  }
  close() { this.open = false; }
  showModal() { this.open = true; }
  focus() {}
}
function descendants(node) { return (node.children || []).flatMap(child => [child, ...descendants(child)]); }
const correction = await readFile(new URL('../design/correction-design.mjs', import.meta.url), 'utf8');
const ids = new Set([...`${html}\n${game}\n${correction}`.replaceAll('\\"','"').matchAll(/id="([\w-]+)"/g)].map(match => match[1]));
for (const match of game.matchAll(/\.id\s*=\s*'([\w-]+)'/g)) ids.add(match[1]);
const nodes = new Map([...ids].map(id => [id, new Node()]));
const get = id => { assert.ok(nodes.has(id), `unknown ID ${id}`); return nodes.get(id); };
let walletOpened = 0;
let opened = 0;
const modal = get('game-dialog');
const context = vm.createContext({ desktop: false, desktopData: null, isLiveRace: () => false, ...uiRuntime,
  window: { location: { search: '?preview=calendar&changes=1&year=2026&month=10' } },
  Intl, URLSearchParams, dateInZone, clockInZone, raceCalendarDate, compareRaceImportance, calendarMonthDays, applyRaceChanges, unreadRefundRaceIds, unreadForRace, markRead,
  document: { getElementById: get, querySelector: selector => get('race-dialog').querySelector(selector), createElement: tag => new Node(tag), createTextNode: text => ({ textContent: text }) },
  gamePreview: {}, correctionPreview: { isOpen: () => false, hasQueued: () => false },
  get, modal, resultDestination: 'wallet', resultStages: [], resultTickets: [], resultOpener: null,
  recordPreviewRaceChange, settleRace,
  automaticRefundQueue: false, notificationCase: null, notificationWaiting: false, deferredAfterRefund: null, refundReturnTo: 'calendar', queuedChanges: [], view: 'wallet',
  money: amount => `¥${amount.toLocaleString('ja-JP')}`,
  signed: amount => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}¥${Math.abs(amount).toLocaleString('ja-JP')}`,
  escape: value => String(value), updateHeader() {}, renderCalendar() {}, showRace() {}, closeRace() {}, openBank() {},
  openWallet() { walletOpened += 1; },
  open(panel, title) { get('game-title').textContent = title; modal.dataset.view = panel; context.view = panel; modal.open = true; opened += 1; }
});
const section = (source, start, end) => {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0, start);
  const until = source.indexOf(end, offset + start.length);
  assert.ok(until > offset, end);
  return source.slice(offset, until);
};
const prefix = design.slice(design.indexOf('// 本轮只有设计稿交互'), design.indexOf('function setSurfaceBadge'));
// The ordinary calendar URL must expose the latest review fixtures without a hidden query switch.
for (const [query, expected] of [['?preview=calendar&v=33', 3], ['?preview=calendar&v=34', 3], ['?preview=calendar&changes=1', 3], ['?preview=calendar&changes=0', 0]]) {
  const entry = vm.createContext({ desktop: false, desktopData: null, isLiveRace: () => false, ...uiRuntime, window: { location: { search: query } }, Intl, URLSearchParams, dateInZone });
  vm.runInContext(prefix + '\nglobalThis.changeCount = races.filter(race => race.id.startsWith("change-")).length;', entry);
  assert.equal(entry.changeCount, expected, `change previews are missing from ${query}`);
}
vm.runInContext(prefix + '\ndisplayTimeZone = "Asia/Shanghai"; globalThis.fixtures = races;', context);
vm.runInContext(section(design, 'function renderRaceChange(', 'function renderCalendar('), context);
const postponed = context.fixtures.find(race => race.id === 'change-postponed');
const cancelled = context.fixtures.find(race => race.id === 'change-cancelled');
const withdrawn = context.fixtures.find(race => race.id === 'change-withdrawn');
assert.equal(context.fixtures.filter(race => race.id.startsWith('change-')).length, 3);
const fixtureNow = new Date('2026-10-22T04:00:00Z');
assert.equal(canBet(context.fixtures.find(race => race.id === 'cox'), fixtureNow, 'Asia/Shanghai'), true);
assert.equal(canBet(context.fixtures.find(race => race.id === 'kikuka'), fixtureNow, 'Asia/Shanghai'), false);
assert.equal(canBet(context.fixtures.find(race => race.id === 'derby'), fixtureNow, 'Asia/Shanghai'), false);
assert.equal(raceCalendarDate(postponed, 'Asia/Shanghai').day, 28);
assert.equal(dateInZone(postponed.sampleChange.previousStartAt, 'Asia/Shanghai').day, 24);
assert.equal(raceCalendarDate(cancelled, 'Asia/Shanghai').day, 24);
for (const race of [postponed, cancelled, withdrawn]) {
  context.race = race;
  vm.runInContext('renderRaceChange(race)', context);
  assert.equal(get('race-change-notice').hidden, false);
  assert.equal(get('race-change-notice').dataset.change, race.sampleChange.kind);
  assert.match(get('race-change-source').textContent, /虚构变更记录/);
  if (race === postponed) {
    assert.equal(get('race-change-dates').children[0].textContent, '2026.10.24 14:00');
    assert.equal(get('race-change-dates').children[2].textContent, '2026.10.28 14:00');
  }
}
context.race = context.fixtures.find(race => race.id === 'arc');
vm.runInContext('renderRaceChange(race)', context);
assert.equal(get('race-change-notice').hidden, true);

// Opening real race details acknowledges only the warning; descriptions and expanded dates survive.
context.dialog = get('race-dialog'); context.calendar = get('calendar'); context.activeFilter = 'all';
context.weekdays = ['一', '二', '三', '四', '五', '六', '日'];
context.updateCalendarControls = () => {};
context.setRaceView = () => {}; context.setOddsPreview = () => {};
context.gamePreview = { updateRaceAction() {}, hasUnread() { return false; }, decorateCard() {} };
vm.runInContext(section(design, 'function setSurfaceBadge(', 'function finishTier('), context);
vm.runInContext(section(design, 'function showRace(', 'function renderRaceChange('), context);
vm.runInContext(section(design, 'function renderCalendar(', 'function goToMonth('), context);
vm.runInContext('renderCalendar()', context);
const raceCard = id => descendants(get('calendar')).find(node => node.dataset?.raceId === id);
assert.ok(raceCard(postponed.id).children.some(node => node.className === 'race-change-flag'));
assert.ok(raceCard(postponed.id).children.some(node => node.className === 'race-change-note' && node.textContent.includes('改期')));
const folded = descendants(get('calendar')).find(node => node.className === 'day-more');
folded.open = true;
const expandedDate = folded.closest('.day').dataset.date;
context.race = postponed;
const record = postponed.sampleChange;
get('race-quality-dialog').open = true;
vm.runInContext('showRace(race, null)', context);
assert.equal(get('race-quality-dialog').open, false, 'entering a race closes a previous exception modal');
assert.equal(get('race-dialog').open, true);
assert.equal(postponed.sampleChange, record);
assert.equal(postponed.sampleChange.read, true);
assert.equal(raceCard(postponed.id).children.some(node => node.className === 'race-change-flag'), false);
assert.ok(raceCard(postponed.id).children.some(node => node.className === 'race-change-note' && node.textContent.includes('改期')));
assert.equal(get('race-change-notice').hidden, false);
assert.match(get('race-change-title').textContent, /改期/);
assert.ok(get('calendar').querySelectorAll('.day-more[open]').some(node => node.closest('.day').dataset.date === expandedDate));
vm.runInContext('renderCalendar()', context);
assert.equal(raceCard(postponed.id).children.some(node => node.className === 'race-change-flag'), false);
assert.ok(raceCard(postponed.id).children.some(node => node.className === 'race-change-note'));
context.renderCalendar = () => {};

// Exercise the actual review buttons and the actual calendar/detail renderer.
context.applyPreviewRaceUpdate = applyPreviewRaceUpdate;
context.structuredClone = structuredClone;
vm.runInContext(section(design, 'function renderCalendar(', 'function goToMonth('), context);
context.goToMonth = () => vm.runInContext('renderCalendar()', context);
const ruleButtons = new Map(['publish', 'changed', 'repeat', 'again', 'ordinary', 'reset'].map(action => {
  const button = new Node('button'); button.dataset.updateRule = action;
  button.addEventListener = (name, handler) => { assert.equal(name, 'click'); button.click = handler; };
  return [action, button];
}));
get('calendar-update-rule-study').querySelectorAll = selector => {
  assert.equal(selector, '[data-update-rule]'); return [...ruleButtons.values()];
};
vm.runInContext(section(design, 'function initUpdateRulePreview(', 'function initDailyCalendar('), context);
vm.runInContext('initUpdateRulePreview()', context);
const revisionRace = context.fixtures.find(race => race.id === 'update-demo');
ruleButtons.get('publish').click();
assert.equal(revisionRace.sampleChange, undefined);
assert.equal(raceCard(revisionRace.id).children.some(node => node.className === 'race-change-flag'), false);
ruleButtons.get('changed').click();
assert.equal(revisionRace.sampleChange.fields.length, 6);
assert.ok(raceCard(revisionRace.id).children.some(node => node.className === 'race-change-flag'));
context.race = revisionRace;
vm.runInContext('showRace(race, null)', context);
assert.equal(revisionRace.sampleChange.read, true);
assert.equal(get('race-change-dates').children.length, 6);
assert.match(get('race-change-title').textContent, /关键信息/);
const readRevision = revisionRace.sampleChange;
ruleButtons.get('repeat').click();
ruleButtons.get('ordinary').click();
assert.equal(revisionRace.sampleChange, readRevision);
assert.equal(revisionRace.sampleChange.read, true);
assert.equal(raceCard(revisionRace.id).children.some(node => node.className === 'race-change-flag'), false);
ruleButtons.get('again').click();
assert.equal(revisionRace.sampleChange.read, false);
assert.equal(revisionRace.sampleChange.fields.length, 1);
assert.ok(raceCard(revisionRace.id).children.some(node => node.className === 'race-change-flag'));
vm.runInContext('showRace(race, null)', context);
assert.equal(get('race-change-history').hidden, false);
assert.equal(get('race-change-history').open, false);
assert.equal(get('race-change-history-summary').textContent, '过往变更（1）');
assert.equal(get('race-change-history-rows').children[0].children[2].children.length, 6, 'the first multi-field revision is archived');
get('race-change-history').open = true;
ruleButtons.get('again').click();
vm.runInContext('showRace(race, null)', context);
assert.equal(get('race-change-history').open, false, 'each entry starts with history collapsed');
assert.equal(get('race-change-history-rows').children.length, 2);
assert.equal(get('race-change-history-rows').children[0].children[2].children.length, 1, 'newest historical revision is first');
assert.equal(get('race-change-history-rows').children[1].children[2].children.length, 6);
ruleButtons.get('repeat').click();
assert.equal(revisionRace.sampleChangeHistory.length, 2);
vm.runInContext('showRace(race, null)', context);
assert.equal(get('race-change-history-rows').children.length, 2);
context.race = context.fixtures.find(race => race.id === 'arc');
vm.runInContext('renderRaceChange(race)', context);
assert.equal(get('race-change-history').hidden, true);
assert.equal(get('race-change-history-rows').children.length, 0, 'another race does not inherit old history rows');
context.race = revisionRace;
ruleButtons.get('reset').click();
assert.equal(revisionRace.sampleChange, undefined);
assert.equal(revisionRace.sampleRunners, undefined);
assert.equal(revisionRace.sampleChangeHistory, undefined);
ruleButtons.get('publish').click();
assert.equal(revisionRace.sampleChange, undefined);
ruleButtons.get('changed').click();
context.renderCalendar = () => {};

// A withdrawn runner keeps its profile button but has no displayed rank or current odds.
vm.runInContext(section(design, 'function finishTier(', 'const calendar ='), context);
vm.runInContext(section(design, 'function sampleOddsLabel(', 'function setEntryView('), context);
context.race = withdrawn;
context.raceView = 'entries';
context.showHorse = () => {};
vm.runInContext('renderEntries(race)', context);
const entryRows = get('entry-rows').children;
assert.equal(entryRows.length, 8);
assert.equal(entryRows.filter(row => row.dataset.finish === 'withdrawn').length, 1);
const withdrawnRow = entryRows.find(row => row.dataset.finish === 'withdrawn');
assert.equal(withdrawnRow.querySelector('.result-position').textContent, '退赛');
assert.equal(withdrawnRow.querySelector('.odds-value').textContent, '—');
assert.equal(withdrawnRow.querySelector('.horse-name-button').afterNode.textContent, '退赛');
context.race = revisionRace;
vm.runInContext('renderEntries(race)', context);
assert.equal(get('entry-rows').children[0].querySelector('.jockey-name').textContent, '騎手 Z');
assert.equal(get('entry-rows').children[0].querySelector('.carried-weight').textContent, '56.0');
context.race = withdrawn;
context.raceView = 'results';
vm.runInContext('renderEntries(race)', context);
assert.equal(get('entry-rows').children.at(-1).dataset.finish, 'withdrawn');

const tiedRace = context.fixtures.find(race => race.id === 'shuka');
tiedRace.sampleWinnerNumbers = [1, 2];
context.race = tiedRace;
vm.runInContext('renderEntries(race)', context);
const tiedRows = get('entry-rows').children;
assert.deepEqual(tiedRows.slice(0, 2).map(row => row.dataset.finish), ['win', 'win']);
for (const row of tiedRows.slice(0, 2)) {
  assert.equal(row.querySelector('.result-position').afterNode.textContent, '同着');
  assert.match(row.innerHTML, /result-position form-win">1<small>着/);
}
assert.match(tiedRows[2].innerHTML, /result-position form-placed">3<small>着/);

// The refund view must have a neutral refund stage, never the losing image or a bankruptcy stage.
vm.runInContext(section(game, '  function showResult(', '  function finishResult('), context);
vm.runInContext(section(game, '  function finishResult(', '  function dismiss('), context);
const horses = [1, 2].map(number => ({ number, name: `Horse ${number}`, odds: '3.2' }));
context.state = settlementExample('dead-heat', tiedRace.id, horses);
context.race = tiedRace;
assert.equal(context.state.cash, 490000);
assert.equal(context.state.tickets[0].status, 'pending');
vm.runInContext('showResult(race, null, "wallet")', context);
assert.equal(context.state.cash, 506000, 'opening results is the credit trigger');
assert.equal(modal.dataset.result, 'win');
assert.equal(get('game-result-profit').textContent, '+¥6,000');
assert.match(get('game-result-details').innerHTML, /3.2 倍 ÷ 2/);
assert.match(get('game-result-details').innerHTML, /总返还.*¥16,000/);
assert.match(get('game-result-details').innerHTML, /同着命中.*2 匹冠军/);
const tiedCash = context.state.cash;
vm.runInContext('finishResult("wallet"); showResult(race, null, "wallet")', context);
assert.equal(context.state.cash, tiedCash, 'historical settlement display does not re-credit money');
for (const [odds, label, visual] of [['1.2', '净亏损', 'lose'], ['2.0', '收支持平', 'even']]) {
  context.state = settlementExample('dead-heat', tiedRace.id, [{ ...horses[0], odds }, horses[1]]);
  vm.runInContext('showResult(race, null, "wallet")', context);
  assert.match(get('game-title').textContent, /命中/);
  assert.ok(get('game-title').textContent.includes(label));
  assert.equal(modal.dataset.result, visual);
  if (visual === 'even') assert.equal(get('game-result-image').hidden, true);
}

const brokeHorses = [1, 2, 3, 4].map(number => ({ number, name: `Horse ${number}`, odds: '3.2' }));
context.state = settlementExample('broke', tiedRace.id, brokeHorses);
assert.equal(context.state.cash, 0);
assert.ok(context.state.tickets.every(ticket => ticket.status === 'pending'));
vm.runInContext('showResult(race, null, "wallet")', context);
assert.equal(JSON.stringify(context.resultStages), '["lose","broke"]');
assert.equal(modal.dataset.result, 'lose');
vm.runInContext(section(game, '  function dismiss(', '  function leaveForCalendar('), context);
vm.runInContext('dismiss()', context);
assert.equal(modal.dataset.result, 'broke', 'after clicking to settle, loss is displayed before bankruptcy');
assert.equal(context.state.cash, 0);
assert.equal(context.state.bank, 30000);
vm.runInContext('dismiss()', context);
assert.equal(unreadForRace(context.state, tiedRace.id).length, 0);

// Click interception settles ready tickets once; automatic refund display does not.
vm.runInContext(`globalThis.raceActions = { ${section(game, '    interceptRace(', '    updateRaceAction(')} };`, context);
context.state = settlementExample('win', tiedRace.id, horses);
assert.equal(context.state.cash, 490000);
assert.equal(vm.runInContext('raceActions.interceptRace(race, null)', context), true);
assert.equal(context.state.cash, 522000);
vm.runInContext('finishResult("wallet")', context);
assert.equal(vm.runInContext('raceActions.interceptRace(race, null)', context), false);
assert.equal(context.state.cash, 522000);

const savedOpenWallet = context.openWallet;
context.tools = new Node();
context.state = settlementExample('win', tiedRace.id, horses);
vm.runInContext(section(game, '  function openWallet(', '  function openBank('), context);
vm.runInContext('openWallet()', context);
assert.equal(context.state.cash, 522000, 'shop entry still displays and settles unread results');
// Queue order follows race timestamps, regardless of source array or purchase order.
const queueRaces = vm.runInContext('races', context);
const originalQueueRaces = [...queueRaces];
const early = { ...tiedRace, id: 'queue-early', name: 'Earlier race', startAt: '2026-10-04T14:00:00Z' };
const late = { ...tiedRace, id: 'queue-late', name: 'Later race', startAt: '2026-10-18T06:00:00Z' };
queueRaces.splice(0, queueRaces.length, late, early);
context.state = settlementExample('win', late.id, horses);
const earlyState = settlementExample('win', early.id, horses);
earlyState.tickets.forEach(ticket => { ticket.id += 10; });
context.state.tickets.push(...earlyState.tickets);
context.state.cash -= 10000;
vm.runInContext('openWallet()', context);
assert.equal(context.resultRace.id, early.id);
assert.equal(context.state.cash, 512000, 'only the displayed early race is paid');
assert.equal(context.state.tickets.find(ticket => ticket.raceId === late.id).status, 'pending');
vm.runInContext('finishResult("wallet")', context);
assert.equal(context.resultRace.id, late.id);
assert.equal(context.state.cash, 544000);
vm.runInContext('showResult(resultRace, null, "wallet")', context);
assert.equal(context.state.cash, 544000, 'reopening a displayed result never pays twice');
queueRaces.splice(0, queueRaces.length, ...originalQueueRaces);
context.openWallet = savedOpenWallet;

context.state = settlementExample('win', tiedRace.id, horses);
vm.runInContext('showResult(race, null, "calendar", true)', context);
assert.equal(context.state.cash, 490000, 'refund-only notifications must not settle ready race winnings');
assert.equal(context.state.tickets[0].status, 'pending');

context.location = { search: '?game=win' };
context.loadExample = kind => { context.state = settlementExample(kind, tiedRace.id, horses); };
const beforePreviewOpen = opened;
vm.runInContext(`globalThis.parameterActions = { ${section(game, '    openFromParams()', '\n  };\n}')} };`, context);
vm.runInContext('parameterActions.openFromParams()', context);
assert.equal(opened, beforePreviewOpen, 'loading the review URL does not open or settle results automatically');
assert.equal(context.state.cash, 490000);

const walletsBeforeRefund = walletOpened;
context.state = refundExample('cancelled', cancelled.id, horses);
context.race = cancelled;
vm.runInContext('showResult(race, null, "wallet")', context);
assert.equal(JSON.stringify(context.resultStages), '["refund"]');
assert.equal(modal.dataset.result, 'refund');
assert.equal(get('game-title').textContent, '马券无效 · 本金已退回');
assert.equal(get('game-result-profit').textContent, '¥30,000');
assert.equal(get('game-result-image').hidden, true);
assert.equal(get('game-image-pending').querySelector('small').hidden, true);
assert.equal(get('game-bankrupt-japanese').hidden, true);
assert.match(get('game-result-details').innerHTML, /赛事取消/);
assert.doesNotMatch(get('game-result-details').innerHTML, /×/);
const balance = context.state.cash;
vm.runInContext('finishResult("wallet")', context);
assert.equal(context.state.cash, balance);
assert.equal(unreadForRace(context.state, cancelled.id).length, 0);
assert.equal(walletOpened, walletsBeforeRefund + 1);
vm.runInContext('showResult(race, null, "wallet")', context);
assert.equal(context.state.cash, balance);
assert.equal(JSON.stringify(context.resultStages), '["refund"]');
context.state = refundExample('withdrawn', withdrawn.id, horses);
context.race = withdrawn;
vm.runInContext('showResult(race, null, "wallet")', context);
assert.equal(get('game-result-profit').textContent, '¥20,000');
assert.equal(context.state.tickets[0].status, 'pending');
assert.match(get('game-result-details').innerHTML, /马匹退赛/);
assert.equal(JSON.stringify(context.resultStages), '["refund"]');

// A refresh processes the ledger and opens the refund automatically, without a race click.
context.state = pendingRefundExample(cancelled.id, horses);
context.queuedChanges = [{ raceId: cancelled.id, reason: 'cancelled', number: 2 }];
context.resultRace = null; modal.open = false; context.view = 'wallet';
vm.runInContext('processRefreshedChanges()', context);
assert.equal(context.state.cash, 500000);
assert.equal(modal.open, true);
assert.equal(modal.dataset.result, 'refund');
assert.equal(context.resultDestination, 'calendar');
const firstOpened = opened;
vm.runInContext('processRefreshedChanges()', context);
assert.equal(opened, firstOpened, 'an already open refund is not duplicated');
vm.runInContext('finishResult()', context);
assert.equal(modal.open, false);
assert.equal(context.automaticRefundQueue, false);
assert.notEqual(cancelled.sampleChange.read, true, 'refund acknowledgement is not a race-detail read');
vm.runInContext('processRefreshedChanges()', context);
assert.equal(opened, firstOpened, 'an acknowledged refund is not shown again');
assert.equal(context.state.cash, 500000);

context.state = pendingRefundExample(cancelled.id, horses);
const secondRace = pendingRefundExample(withdrawn.id, horses);
secondRace.tickets.forEach(ticket => { ticket.id += 2; });
context.state.tickets.push(...secondRace.tickets); context.state.cash -= 30000;
context.queuedChanges = [{ raceId: cancelled.id, reason: 'cancelled', number: 2 }, { raceId: withdrawn.id, reason: 'withdrawn', number: 2 }];
context.resultRace = null; modal.open = false;
vm.runInContext('processRefreshedChanges()', context);
assert.equal(context.resultRace.id, cancelled.id);
vm.runInContext('finishResult()', context);
assert.equal(context.resultRace.id, withdrawn.id);
assert.equal(modal.open, true);
vm.runInContext('finishResult()', context);
assert.equal(modal.open, false);
assert.equal(context.state.cash, 490000);
assert.equal(unreadRefundRaceIds(context.state).length, 0);

// Race details and purchase/receipt dialogs follow their race, then clear on shop/bank entry.
for (const id of ['cox', 'arc', 'champion', 'shuka']) {
  context.race = context.fixtures.find(race => race.id === id);
  vm.runInContext('showRace(race, null)', context);
  const expected = { AU: 'au', FR: 'fr', GB: 'gb', JP: 'jp' }[context.race.country];
  assert.equal(get('race-dialog').dataset.colorRegion, expected);
}
const themePanels = ['wallet', 'bank', 'bet', 'result'].map(value => {
  const node = new Node(); node.dataset.gamePanel = value; return node;
});
const themeModal = new Node();
themeModal.querySelectorAll = () => themePanels;
const themes = vm.createContext({ desktop: false, desktopData: null, isLiveRace: () => false, ...uiRuntime,
  modal: themeModal, get, clearTimeout() {}, cutoffTimer: null, feedback() {},
  selectedRace: null, resultRace: null,
  countryColors: vm.runInContext('countryColors', context)
});
vm.runInContext(section(game, '  function open(', '  function openWallet('), themes);
for (const [country, expected] of Object.entries({ JP: 'jp', US: 'us', HK: 'hk', AE: 'arab', SA: 'arab', GB: 'gb', FR: 'fr', DE: 'de', AU: 'au', IE: 'other' })) {
  themes.selectedRace = { country }; themes.resultRace = { country: 'JP' };
  vm.runInContext('open("bet", "Ticket", "WIN")', themes);
  assert.equal(themeModal.dataset.colorRegion, expected);
  themes.resultRace = { country }; themes.selectedRace = { country: 'JP' };
  vm.runInContext('open("result", "Receipt", "RESULT")', themes);
  assert.equal(themeModal.dataset.colorRegion, expected);
  for (const panel of ['wallet', 'bank']) {
    themes.panel = panel;
    vm.runInContext('open(panel, "Shop", "SHOP")', themes);
    assert.equal('colorRegion' in themeModal.dataset, false, 'shop/bank must not inherit the last race colour');
  }
}

// A later cancellation retains an earlier postponement, and repeat queued data adds no history/refund.
context.state = pendingRefundExample(postponed.id, horses);
context.queuedChanges = [{ raceId: postponed.id, reason: 'cancelled', number: 2 }];
context.resultRace = null; modal.open = false;
vm.runInContext('processRefreshedChanges()', context);
assert.equal(postponed.sampleChange.kind, 'cancelled');
assert.equal(postponed.sampleChangeHistory.length, 1);
assert.equal(postponed.sampleChangeHistory[0].kind, 'postponed');
assert.equal(postponed.sampleChangeHistory[0].raceStartAt, '2026-10-28T06:00:00Z');
assert.equal(context.state.cash, 500000);
vm.runInContext('finishResult()', context);
const finalCancellation = postponed.sampleChange;
context.queuedChanges = [{ raceId: postponed.id, reason: 'cancelled', number: 2 }];
vm.runInContext('processRefreshedChanges()', context);
assert.equal(postponed.sampleChange, finalCancellation);
assert.equal(postponed.sampleChangeHistory.length, 1);
assert.equal(context.state.cash, 500000);
assert.equal(modal.open, false);
assert.notEqual(postponed.sampleChange.read, true, 'refund confirmation does not acknowledge the latest change');

// Only a successful source check dispatches changes; failed/offline checks do not refund.
let timer;
let applied = 0;
context.status = get('calendar-update'); context.refresh = get('calendar-refresh'); context.network = { value: 'offline' };
context.refreshTimer = null;
context.setTimeout = callback => { timer = callback; return 1; };
context.clearTimeout = () => { timer = null; };
context.gamePreview = { processRefreshedChanges() { applied += 1; } };
vm.runInContext(section(design, '  function showUpdateState(', '  refresh.addEventListener('), context);
vm.runInContext('checkUpdates()', context);
assert.equal(timer, null); assert.equal(applied, 0);
context.network.value = 'failed'; vm.runInContext('checkUpdates()', context); timer();
assert.equal(applied, 0);
context.network.value = 'success'; vm.runInContext('checkUpdates()', context); timer();
assert.equal(applied, 1);
console.log('PASS: detail-open clears unread warning and preserves descriptions/expanded dates; refunds do not acknowledge changes; automatic refunds, eligibility fixtures and existing preview flows; browser layout not tested.');

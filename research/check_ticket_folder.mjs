import * as uiRuntime from '../design/ui-language.mjs';
// Actual fixture and render functions; no browser rendering or persistent wallet.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { dateInZone } from '../design/calendar-rules.js';
import { createState, placeTicket, recordRaceResult, settleRace, refundTickets, unreadForRace, markRead, withinBetWindow, bettingBlockReason, grossReturn } from '../design/game-state.mjs';
import { recordPreviewRaceChange } from '../design/race-change-state.mjs';
import { voluntaryRefundBlockReason, refundPreviewTicket } from '../design/voluntary-refund-preview.mjs';

const game = await readFile(new URL('../design/game-design.js', import.meta.url), 'utf8');
const design = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
const fields = new Map();
let scrolled = false;
const get = id => {
  if (!fields.has(id)) fields.set(id, { textContent: '', innerHTML: '', hidden: false, setAttribute(name, value) { this[name] = value; }, scrollIntoView() { scrolled = true; }, focus() { this.focused = true; } });
  return fields.get(id);
};
const section = (source, start, end) => {
  const offset = source.indexOf(start);
  const until = source.indexOf(end, offset + start.length);
  assert.ok(offset >= 0 && until > offset, start);
  return source.slice(offset, until);
};
const context = vm.createContext({ desktop: false, desktopData: null, isLiveRace: () => false, ...uiRuntime,
  Intl, URLSearchParams, structuredClone, dateInZone, createState, placeTicket, recordRaceResult,
  settleRace, refundTickets, unreadForRace, markRead, withinBetWindow, bettingBlockReason, grossReturn, recordPreviewRaceChange,
  window: { location: { search: '?preview=calendar&year=2026&month=10&game=tickets' } },
  document: { getElementById: get }, get,
  ticketFilter: 'all', refundPreview: false, voluntaryRefundBlockReason, refundPreviewTicket, state: createState(), queuedChanges: [], automaticRefundQueue: false, resultRace: null,
  money: value => `¥${value.toLocaleString('ja-JP')}`,
  signed: value => `${value > 0 ? '+' : value < 0 ? '−' : ''}¥${Math.abs(value).toLocaleString('ja-JP')}`,
  escape: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
  zone: () => 'Asia/Shanghai',
  horses: () => [{ number: 1, name: 'Sample One', odds: '3.2' }, { number: 2, name: 'Sample Two', odds: '4.8' }],
  updateHeader() {}, renderCalendar() {}, feedback() {},
  open(panel) { context.view = panel; }
});
vm.runInContext(design.slice(design.indexOf('// 本轮只有设计稿交互'), design.indexOf('const englishMonths')), context);
vm.runInContext(game.match(/  const originalRaceStates = [^\n]+/)[0], context);
vm.runInContext(section(game, '  function resetRaceSamples()', '  function loadExample('), context);
vm.runInContext(section(game, '  function openWallet()', '  function openBank('), context);
vm.runInContext(section(game, '  function loadFolderExample()', '  function handleAction('), context);
vm.runInContext('loadFolderExample()', context);
assert.equal(context.view, 'wallet');
assert.equal(scrolled, true);
assert.equal(get('game-ticket-folder-title').focused, true);
assert.equal(context.state.cash, 502000);
assert.equal(context.state.tickets.length, 7);
assert.equal(context.state.tickets.filter(ticket => ticket.status === 'pending').length, 3);
assert.equal(context.state.tickets.filter(ticket => ticket.status === 'won').length, 2);
assert.equal(context.state.tickets.filter(ticket => ticket.status === 'lost').length, 1);
assert.equal(context.state.tickets.filter(ticket => ticket.status === 'void').length, 1);
assert.equal(context.state.tickets.filter(ticket => ticket.status !== 'pending' && !ticket.read).length, 0);
assert.equal(get('game-ticket-count').textContent, '3 场 · 7 张');
const rendered = get('game-tickets').innerHTML;
assert.equal((rendered.match(/class="game-ticket-group"/g) || []).length, 3);
for (const [, attrs] of rendered.matchAll(/<details class="game-ticket-group"([^>]*)>/g)) assert.doesNotMatch(attrs, /\bopen\b/, 'race groups start collapsed');
assert.equal((rendered.match(/class="game-ticket game-ticket-record"/g) || []).length, 7);
assert.deepEqual([...rendered.matchAll(/data-ticket-race="([^"]+)"/g)].map(match => match[1]), ['cox', 'shuka', 'arc']);
for (const [race, region] of [['cox', 'au'], ['shuka', 'jp'], ['arc', 'fr']]) assert.match(rendered, new RegExp(`data-color-region="${region}" data-ticket-race="${race}"`));
for (const ticket of context.state.tickets) {
  const row = rendered.match(new RegExp(`<article[^>]+data-ticket-id="${ticket.id}"[\\s\\S]*?</article>`))[0];
  assert.ok(row.includes(`<dd>${ticket.odds}<small>`), `ticket ${ticket.id} lost its own locked odds`);
  assert.ok(row.includes(ticket.amount.toLocaleString('ja-JP')));
  if (ticket.status !== 'pending') assert.ok(row.includes(ticket.returned.toLocaleString('ja-JP')));
  const details = row.match(/<details class="game-ticket-record-details"([^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(details, `ticket ${ticket.id} needs an accessible details entry`);
  assert.doesNotMatch(details[1], /\bopen\b/, 'time and source must be collapsed initially');
  assert.match(details[2], /查看详情/);
  assert.ok(details[2].includes(ticket.source));
  assert.match(details[2], /购买时间：.*赔率取得时间：/s);
  assert.doesNotMatch(row.replace(details[0], ''), /购买时间：|赔率来源：|赔率取得时间：/);
}
assert.equal((rendered.match(/class="game-ticket-addition"/g) || []).length, 2);
assert.match(rendered, /累计购买 <b>¥25,000<\/b>/);
assert.match(rendered, /已返还 <b>¥50,000<\/b>/);
assert.match(rendered, /已退本金/);
assert.doesNotMatch(rendered, /data-game-action="(?:cancel|retract|delete-ticket)"/);
assert.doesNotMatch(rendered, /data-game-action="ticket-refund"/, 'ordinary preview retains the no-voluntary-refund rule');
const beforeRender = JSON.stringify(context.state);
vm.runInContext('renderTicketFolder()', context);
assert.equal(JSON.stringify(context.state), beforeRender, 'grouping must not alter or pay the ledger');
vm.runInContext('loadFolderExample()', context);
assert.equal(JSON.stringify(context.state), beforeRender, 'reloading the fixture must not stack credits');

const beforeResult = context.state.cash;
recordRaceResult(context.state, 'cox', 1);
assert.equal(context.state.cash, beforeResult);
settleRace(context.state, 'cox');
assert.deepEqual(context.state.tickets.slice(0, 3).map(ticket => ticket.returned), [32000, 18000, 0]);
assert.equal(context.state.cash, 552000);
settleRace(context.state, 'cox');
assert.equal(context.state.cash, 552000);

// Exercise the opt-in UI and actual confirmation handler against a pinned local date.
let clockNow = '2026-10-23T13:00:00Z';
class ClockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clockNow])); }
  static now() { return new Date(clockNow).getTime(); }
}
context.Date = ClockDate;
context.refundPreview = true;
vm.runInContext('loadFolderExample()', context);
assert.equal(context.state.tickets.length, 9);
assert.equal(context.state.cash, 485000);
assert.equal((get('game-tickets').innerHTML.match(/data-game-action="ticket-refund"/g) || []).length, 2);
assert.match(get('game-tickets').innerHTML, /前 2 个日历日不可主动退款/);
const voluntaryTicket = context.state.tickets.find(ticket => ticket.raceId === 'tenno' && ticket.amount === 5000);
const groups = ['tenno', 'cox', 'shuka', 'arc'].map((ticketRace, index) => ({ dataset: { ticketRace }, open: index === 0 }));
const folder = get('game-tickets');
folder.querySelectorAll = selector => selector.endsWith('[open]') ? groups.filter(group => group.open) : groups;
let receiptFocused = false;
folder.querySelector = () => ({ scrollIntoView() {}, querySelector() { return { focus() { receiptFocused = true; } }; } });
context.ticketId = voluntaryTicket.id;
vm.runInContext('confirmTicketRefund(ticketId)', context);
assert.equal(context.state.cash, 490000);
assert.equal(voluntaryTicket.voidReason, 'voluntary');
assert.match(folder.innerHTML, /主动退款 · 已退本金/);
assert.match(folder.innerHTML, /主动退款时间：/);
assert.equal(receiptFocused, true);
vm.runInContext('confirmTicketRefund(ticketId)', context);
assert.equal(context.state.cash, 490000);
context.refundPreview = false;
assert.throws(() => vm.runInContext('confirmTicketRefund(ticketId)', context), /未启用/);
context.refundPreview = true;
vm.runInContext('loadFolderExample()', context);
vm.runInContext(section(game, '  function handleAction(', '  modal.addEventListener('), context);
let keptFocus = false;
const request = { open: true, querySelector() { return { focus() { keptFocus = true; } }; } };
context.event = { target: { closest() { return { dataset: { gameAction: 'keep-ticket' }, closest() { return request; } }; } } };
vm.runInContext('handleAction(event)', context);
assert.equal(request.open, false);
assert.equal(keptFocus, true);
assert.equal(context.state.cash, 485000);
const inlineError = { hidden: true };
const confirm = { dataset: { gameAction: 'ticket-refund', id: voluntaryTicket.id }, closest() { return { querySelector() { return inlineError; } }; } };
context.event = { target: { closest() { return confirm; } } };
clockNow = '2026-10-29T16:00:00Z'; // Oct 30 in Shanghai: D−2 for Nov 1.
const beforeCutoffClick = JSON.stringify(context.state);
vm.runInContext('handleAction(event)', context);
assert.equal(JSON.stringify(context.state), beforeCutoffClick);
assert.equal(inlineError.hidden, false);
assert.match(inlineError.textContent, /前 2 个日历日/);
assert.equal(confirm.disabled, true);
clockNow = '2026-10-24T03:00:00Z';
vm.runInContext('loadStatusExample()', context);
assert.equal(context.state.cash, 480000);
assert.equal(context.state.tickets.length, 11);
assert.equal(context.ticketFilter, 'all');
assert.match(get('game-ticket-filters').innerHTML, /data-filter="all" aria-pressed="true"/);
const beforeFilters = JSON.stringify(context.state);
const expected = { all: 11, waiting: 5, ready: 2, settled: 3, refunded: 1 };
for (const [filter, count] of Object.entries(expected)) {
  context.ticketFilter = filter;
  vm.runInContext('renderTicketFolder()', context);
  const rows = get('game-tickets').innerHTML;
  assert.equal((rows.match(/class="game-ticket game-ticket-record"/g) || []).length, count, filter);
  assert.match(get('game-ticket-filters').innerHTML, new RegExp(`data-filter="${filter}" aria-pressed="true"`));
  assert.equal(JSON.stringify(context.state), beforeFilters, `${filter} must not settle or modify records`);
  if (filter !== 'all') assert.match(rows, /本筛选购买/);
  if (filter === 'ready') {
    assert.match(rows, /待查看结算 1/);
    assert.match(rows, /查看并结算/);
    assert.doesNotMatch(rows, /game-ticket-status">(?:命中|未命中)/);
    assert.match(rows, /追加购买/, 'addition identity must include hidden historical purchases');
  }
}
let filterFocused = false;
get('game-ticket-filters').querySelector = () => ({ focus() { filterFocused = true; } });
context.event = { target: { closest() { return { dataset: { gameAction: 'ticket-filter', filter: 'ready' } }; } } };
vm.runInContext('handleAction(event)', context);
assert.equal(context.ticketFilter, 'ready');
assert.equal(filterFocused, true);
assert.equal(JSON.stringify(context.state), beforeFilters);
// Refund while filtered to waiting: the row disappears, but the credit and focus remain correct.
vm.runInContext('loadFolderExample(); ticketFilter = "waiting"; renderTicketFolder()', context);
folder.querySelector = () => null;
context.feedback = message => { context.lastFeedback = message; };
context.ticketId = context.state.tickets.find(ticket => ticket.raceId === 'tenno' && ticket.amount === 5000).id;
vm.runInContext('confirmTicketRefund(ticketId)', context);
assert.equal(context.state.cash, 490000);
assert.match(context.lastFeedback, /已退款/);
assert.equal(context.ticketFilter, 'waiting');
context.state = createState();
context.ticketFilter = 'ready';
vm.runInContext('renderTicketFolder()', context);
assert.match(folder.innerHTML, /马券夹还是空的/);
context.state.tickets = [{ id: 1, raceId: 'cox', status: 'pending', placedAt: clockNow }];
vm.runInContext('renderTicketFolder()', context);
assert.match(folder.innerHTML, /暂无「待查看结算」马券/);
assert.match(folder.innerHTML, /data-filter="all">查看全部/);
console.log('PASS: five status filters, mixed-race per-ticket visibility and scoped totals, no settlement on filtering, ready fixture, focus restoration, filtered refund and distinct empty states.');
console.log('PASS: three race groups/seven independent records; per-order odds, totals, source snapshots, addition labels and region colours; grouping never pays; same-horse additions settle separately; fixture reload is idempotent. Browser layout not tested.');

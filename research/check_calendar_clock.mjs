import * as uiRuntime from '../design/ui-language.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { dateInZone } from '../design/calendar-rules.js';
import { bettingBlockReason } from '../design/game-state.mjs';
import { voluntaryRefundBlockReason } from '../design/voluntary-refund-preview.mjs';

const source = await readFile(new URL('../design/design.js', import.meta.url), 'utf8');
const start = source.indexOf('function checkCalendarClock()');
const end = source.indexOf("window.addEventListener('focus', checkCalendarClock)", start);
assert.ok(start > 0 && end > start);
let time = '2026-10-31T15:59:59Z';
let computerZone = 'Asia/Shanghai';
class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [time])); } }
const timers = new Map();
let timerId = 0, renders = 0;
const context = vm.createContext({ ...uiRuntime,
  Date: ClockDate, Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: computerZone }) }) }, dateInZone,
  calendarClockTimer: undefined, calendarClockStamp: null, zonePreview: 'auto', computerTimeZone: computerZone, displayTimeZone: computerZone,
  calendarYear: 2025, calendarMonth: 5, selectedRegions: new Set(['JP']),
  renderCalendar() { renders++; }, setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout(id) { timers.delete(id); }
});
vm.runInContext(source.slice(start, end), context);
const check = () => vm.runInContext('checkCalendarClock()', context);
check(); assert.equal(renders, 0);
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].delay, 1025);
time = '2026-10-31T16:00:01Z';
[...timers.values()][0].callback();
assert.equal(renders, 1, 'a new local month refreshes the today marker');
assert.deepEqual([context.calendarYear, context.calendarMonth, ...context.selectedRegions], [2025, 5, 'JP'], 'browsed month/filter do not jump');
check(); assert.equal(renders, 1, 'same local date does not redraw');
computerZone = 'Asia/Tokyo'; check();
assert.equal(context.displayTimeZone, 'Asia/Tokyo'); assert.equal(renders, 2);
context.zonePreview = 'Europe/Paris'; context.displayTimeZone = 'Europe/Paris'; check();
assert.equal(context.displayTimeZone, 'Europe/Paris');
assert.deepEqual([context.calendarYear, context.calendarMonth], [2025, 5]);
assert.equal(timers.size, 1, 'rechecks replace the previous local timer');
assert.doesNotMatch(source.slice(start, end), /fetch\(|requestRefresh|goToMonth|calendarMonth\s*=|calendarYear\s*=/);

// Chosen policy uses current computer date; permanent race/result states remain authoritative.
const race = { id: 'clock-sample', startAt: '2026-11-01T06:00:00Z', sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: 'Sample official quote' };
const raceDay = new Date('2026-11-01T00:00:00Z');
const priorDay = new Date('2026-10-31T00:00:00Z');
assert.match(bettingBlockReason(race, raceDay, 'Asia/Shanghai'), /比赛当日/);
assert.equal(bettingBlockReason(race, priorDay, 'Asia/Shanghai'), '');
assert.match(bettingBlockReason({ ...race, sampleFinished: true }, priorDay, 'Asia/Shanghai'), /已结束/);
assert.match(bettingBlockReason({ ...race, sampleCancelled: true }, priorDay, 'Asia/Shanghai'), /已取消/);
const ticket = { status: 'pending', horseNumber: 1 };
assert.match(voluntaryRefundBlockReason(ticket, race, new Date('2026-10-30T00:00:00Z'), 'Asia/Shanghai'), /前 2/);
assert.equal(voluntaryRefundBlockReason(ticket, race, new Date('2026-10-29T00:00:00Z'), 'Asia/Shanghai'), '');
assert.match(voluntaryRefundBlockReason({ ...ticket, confirmedWinners: [1] }, race, priorDay, 'Asia/Shanghai'), /赛果已确认/);
console.log('PASS: local day/timezone refresh preserves browsed month/filter, one local-only timer, current-date purchase/refund policy with final/cancelled/result guards. DOM/clock doubles; browser not rendered.');

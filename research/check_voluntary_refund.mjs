import assert from 'node:assert/strict';
import { createState, placeTicket, canBet, refundTickets, recordRaceResult, settleRace, unreadForRace, unreadRefundRaceIds } from '../design/game-state.mjs';
import { voluntaryRefundBlockReason, refundPreviewTicket } from '../design/voluntary-refund-preview.mjs';

const race = { id: 'sample', startAt: '2026-10-26T06:00:00Z', sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '虚构官方单胜', sampleOddsAt: '2026-10-20T03:00:00Z' };
const now = new Date('2026-10-20T04:00:00Z');
function purchased() {
  const state = createState();
  state.bank = 60000;
  for (const [number, amount, odds] of [[1, 10000, '3.2'], [1, 5000, '3.6'], [2, 8000, '4.8']]) placeTicket(state, race, { number, name: `Horse ${number}`, odds }, amount, now, 'Asia/Shanghai');
  return state;
}
const pending = purchased().tickets[0];
assert.equal(voluntaryRefundBlockReason(pending, race, new Date('2026-10-23T15:59:59Z'), 'Asia/Shanghai'), '');
for (const date of ['2026-10-23T16:00:00Z', '2026-10-24T16:00:00Z', '2026-10-25T16:00:00Z', '2026-10-27T04:00:00Z']) {
  const state = purchased(), before = JSON.stringify(state);
  assert.match(voluntaryRefundBlockReason(state.tickets[0], race, new Date(date), 'Asia/Shanghai'), /前 2 个日历日/);
  assert.throws(() => refundPreviewTicket(state, 1, race, new Date(date), 'Asia/Shanghai'), /前 2 个日历日/);
  assert.equal(JSON.stringify(state), before);
}
assert.equal(voluntaryRefundBlockReason(pending, race, new Date('2026-10-23T15:30:00Z'), 'Asia/Shanghai'), '');
assert.match(voluntaryRefundBlockReason(pending, race, new Date('2026-10-23T15:30:00Z'), 'Asia/Tokyo'), /不可主动退款/);
for (const [startAt, allowed, blocked, timeZone] of [
  ['2027-01-02T06:00:00Z', '2026-12-30T15:59:59Z', '2026-12-30T16:00:00Z', 'Asia/Shanghai'],
  ['2028-03-01T06:00:00Z', '2028-02-27T15:59:59Z', '2028-02-27T16:00:00Z', 'Asia/Shanghai'],
  ['2026-03-10T16:00:00Z', '2026-03-08T04:59:59Z', '2026-03-08T05:00:00Z', 'America/New_York']
]) {
  assert.equal(voluntaryRefundBlockReason(pending, { ...race, startAt }, new Date(allowed), timeZone), '');
  assert.match(voluntaryRefundBlockReason(pending, { ...race, startAt }, new Date(blocked), timeZone), /不可主动退款/);
}
assert.equal(canBet(race, new Date('2026-10-25T04:00:00Z'), 'Asia/Shanghai'), true, 'the refund lock must not prohibit purchases on the previous day');
assert.equal(canBet(race, new Date('2026-10-25T16:00:00Z'), 'Asia/Shanghai'), false);
const sameDay = purchased(), beforePurchase = JSON.stringify(sameDay);
assert.throws(() => placeTicket(sameDay, race, { number: 2, name: 'Other', odds: '4.8' }, 1000, new Date('2026-10-25T16:00:00Z'), 'Asia/Shanghai'), /比赛当日/);
assert.equal(JSON.stringify(sameDay), beforePurchase);

const state = purchased(), original = structuredClone(state.tickets[0]);
const before = state.cash;
const refunded = refundPreviewTicket(state, 1, race, new Date('2026-10-22T04:00:00Z'), 'Asia/Shanghai');
assert.equal(state.cash, before + 10000);
assert.equal(state.bank, 60000);
assert.deepEqual(state.tickets.map(ticket => ticket.status), ['void', 'pending', 'pending']);
assert.equal(refunded.voidReason, 'voluntary');
assert.equal(refunded.profit, 0);
for (const key of ['amount', 'odds', 'source', 'oddsAt', 'placedAt', 'horseNumber', 'horseName']) assert.equal(refunded[key], original[key]);
assert.equal(unreadForRace(state, race.id).length, 0);
assert.equal(unreadRefundRaceIds(state).length, 0);
const once = JSON.stringify(state);
refundPreviewTicket(state, 1, race, new Date('2026-10-23T04:00:00Z'), 'Asia/Shanghai');
assert.equal(JSON.stringify(state), once);
recordRaceResult(state, race.id, 1);
assert.match(voluntaryRefundBlockReason(state.tickets[1], race, now, 'Asia/Shanghai'), /赛果已确认/);
settleRace(state, race.id);
assert.equal(state.tickets[0].returned, 10000);
assert.equal(state.tickets[1].returned, 18000);
assert.equal(state.cash, 505000);
assert.throws(() => refundPreviewTicket(state, 2, race, now, 'Asia/Shanghai'), /已结算/);
const official = purchased();
refundTickets(official, race.id, 'cancelled');
assert.equal(official.cash, 500000, 'official refunds remain independent of the voluntary deadline');
assert.equal(official.bank, 60000);
assert.equal(official.tickets.every(ticket => ticket.voidReason === 'cancelled'), true);
console.log('PASS: D−3 allowed, D−2/D−1/D0/past blocked; timezone, year/month/leap/DST calendar dates; D−1 purchase allowed and D0 rejected; one-ticket full refund, snapshots/bank unchanged, idempotence, no re-settlement and official refunds unaffected.');

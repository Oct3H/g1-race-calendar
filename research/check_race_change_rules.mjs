import assert from 'node:assert/strict';
import { applyPreviewRaceUpdate as update } from '../design/race-change-state.mjs';

const at = '2026-10-23T01:00:00Z';
const nextAt = '2026-10-23T02:00:00Z';
const horse = { id: 'horse-1', name: 'Sample Horse', number: 1, jockey: 'A', weight: 55 };
const published = { startAt: '2026-10-29T06:00:00Z', place: 'A', distance: 2000, surface: 'turf', sampleEntriesConfirmed: true, sampleRunners: [horse], sampleExampleOdds: '3.2', sampleExampleResult: '1', sampleExamplePrize: 1000000 };
const race = { id: 'sample' };
assert.deepEqual(update(race, published, at), []);
assert.equal(race.sampleChange, undefined, 'first publication is not a warning');

for (const [key, value] of Object.entries({ startAt: '2026-10-29T06:30:00Z', place: 'B', distance: 2200, surface: 'dirt' })) {
  assert.equal(update(race, { [key]: value }, at).length, 1, key);
  assert.equal(race.sampleChange.read, false);
  race.sampleChange.read = true;
  const record = race.sampleChange;
  assert.deepEqual(update(race, { [key]: value }, nextAt), []);
  assert.equal(race.sampleChange, record, 'repeat fetch preserves the read record and original change time');
}
const last = race.sampleChange;
assert.deepEqual(update(race, { sampleExampleOdds: '4.6', sampleOddsAt: nextAt, sampleExamplePrize: 2000000 }, nextAt), []);
assert.equal(race.sampleChange, last);
assert.equal(last.read, true);
assert.deepEqual(update(race, { distance: null, surface: undefined }, at), []);
assert.equal(race.distance, 2200, 'missing partial response must not replace existing data');
assert.deepEqual(update(race, { startAt: '2026-10-29T15:30:00+09:00' }, at), [], 'equivalent time representations are not a change');

for (const [key, value] of Object.entries({ number: 2, jockey: 'B', weight: 56 })) {
  const runners = structuredClone(race.sampleRunners); runners[0][key] = value;
  assert.equal(update(race, { sampleRunners: runners }, nextAt).length, 1, key);
  assert.equal(race.sampleChange.read, false, 'a new critical revision warns again');
  race.sampleChange.read = true;
}
const runners = [...race.sampleRunners, { ...horse, id: 'horse-2', name: 'New Horse', number: 3 }];
assert.match(update(race, { sampleRunners: runners }, nextAt)[0].label, /名单/);
race.sampleChange.read = true;
assert.deepEqual(update(race, { sampleRunners: [...runners].reverse() }, at), [], 'source list ordering does not create warnings');
assert.equal(race.sampleChange.read, true);
assert.equal(update(race, { sampleWithdrawnNumbers: [2] }, nextAt).length, 1);
assert.equal(race.sampleChange.kind, 'withdrawn');
assert.deepEqual(update(race, { sampleWithdrawnNumbers: [2] }, at), []);
assert.equal(update(race, { sampleCancelled: true }, nextAt).length, 1);
assert.equal(race.sampleChange.kind, 'cancelled');
assert.deepEqual(update(race, { sampleCancelled: true }, at), []);

const missing = { sampleEntriesConfirmed: true, sampleRunners: [{ id: 'horse-1', name: 'Sample Horse', number: 1 }] };
assert.deepEqual(update(missing, { sampleRunners: [horse] }, at), [], 'first available rider/weight values fill gaps without warning');
const unconfirmed = { sampleEntriesConfirmed: false, sampleRunners: [horse] };
assert.deepEqual(update(unconfirmed, { sampleEntriesConfirmed: true, sampleRunners: runners }, at), [], 'confirming the first final list is publication');

const historyRace = { startAt: '2026-10-28T06:00:00Z', distance: 2000, sampleChange: { kind: 'postponed', previousStartAt: '2026-10-24T06:00:00Z', updatedAt: at, read: true } };
update(historyRace, { startAt: '2026-10-29T06:00:00Z' }, nextAt);
assert.equal(historyRace.sampleChangeHistory.length, 1);
assert.equal(historyRace.sampleChangeHistory[0].raceStartAt, '2026-10-28T06:00:00Z', 'legacy history retains the date at that revision');
assert.equal(historyRace.sampleChangeHistory[0].read, true);
historyRace.sampleChange.read = true;
const firstRevision = JSON.stringify(historyRace.sampleChange);
update(historyRace, { distance: 2200 }, '2026-10-23T03:00:00Z');
assert.equal(historyRace.sampleChangeHistory.length, 2);
assert.equal(JSON.stringify(historyRace.sampleChangeHistory[0]), firstRevision);
assert.equal(historyRace.sampleChangeHistory[1].kind, 'postponed', 'history is newest first');
historyRace.sampleChange.read = true;
update(historyRace, { distance: 2200, sampleExampleOdds: '5.0' }, nextAt);
assert.equal(historyRace.sampleChangeHistory.length, 2, 'duplicate and ordinary updates add no history');
assert.equal(historyRace.sampleChange.read, true);
assert.equal(historyRace.sampleChangeHistory[0].fields[0].after, '2026-10-29T06:00:00.000Z');
const withdrawnHistory = { startAt: published.startAt, sampleWithdrawnNumbers: [1], sampleChange: { kind: 'withdrawn', updatedAt: at } };
update(withdrawnHistory, { sampleWithdrawnNumbers: [1, 2] }, nextAt);
assert.deepEqual(withdrawnHistory.sampleChangeHistory[0].withdrawnNumbers, [1], 'old withdrawal record does not adopt the newer numbers');
assert.deepEqual(withdrawnHistory.sampleChange.withdrawnNumbers, [1, 2]);
console.log('PASS: first publication, critical schedule/runner fields, repeat fetches/read state, ordinary updates, missing fields, normalized times, confirmed lists, cancellations and withdrawals.');

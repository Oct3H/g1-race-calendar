// Real published data, independent in-memory replay. No network, browser,
// production wallet, persistent funds, or claim of a live historical request.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createState, placeTicket, recordRaceResult, settleRace, markRead, unreadForRace, grossReturn } from '../../design/game-state.mjs';

const checks = JSON.parse(await readFile(new URL('sequence-checks.json', import.meta.url), 'utf8'));
const archive = checks.historical_replay;
const race = { id: archive.race_id, startAt: archive.start_at,
  sampleEntriesConfirmed: true, sampleOfficialOdds: true,
  sampleOddsSource: archive.source, sampleOddsAt: archive.snapshot_at };
const horse = { number: archive.horse_number, name: archive.horse_name, odds: archive.locked_quote };
const state = createState(); // Review fixture: already activated, independent of the app.
const ticket = placeTicket(state, race, horse, 10000, new Date(archive.snapshot_at), 'Asia/Shanghai');
assert.equal(state.cash, 490000);
assert.equal(ticket.odds, '12.6');
assert.equal(ticket.oddsAt, archive.snapshot_at);
assert.equal(grossReturn(10000, ticket.odds), 126000);
assert.notEqual(ticket.odds, archive.jra_final_quote);
assert.notEqual(ticket.odds, archive.hkjc_final_quote);

recordRaceResult(state, race.id, archive.winners);
assert.equal(state.cash, 490000, 'receiving the confirmed result does not credit funds');
assert.equal(unreadForRace(state, race.id).length, 1);
settleRace(state, race.id);
assert.equal(ticket.returned, 126000, 'view-time settlement uses the original quote, not final quotes');
assert.equal(state.cash, 616000);
markRead(state, race.id);
const afterSettlement = JSON.stringify(state);
recordRaceResult(state, race.id, archive.winners);
settleRace(state, race.id);
assert.equal(JSON.stringify(state), afterSettlement, 'repeat result/view does not pay twice');

const cutoffState = createState();
const beforeCutoffAttempt = JSON.stringify(cutoffState);
assert.throws(() => placeTicket(cutoffState, race, horse, 10000,
  new Date('2026-10-25T00:00:00+08:00'), 'Asia/Shanghai'), /比赛当日/);
assert.equal(JSON.stringify(cutoffState), beforeCutoffAttempt);

for (const [index, sample] of checks.future_samples.entries()) {
  const future = { id: `actual-unpublished-${index}`, startAt: sample.start_at,
    sampleEntriesConfirmed: false, sampleOfficialOdds: false };
  const noFundsChanged = JSON.stringify(cutoffState);
  assert.throws(() => placeTicket(cutoffState, future, horse, 10000,
    new Date('2026-10-26T12:00:00+08:00'), 'Asia/Shanghai'), /名单/);
  assert.equal(JSON.stringify(cutoffState), noFundsChanged);
}

await writeFile(new URL('replay-checks.json', import.meta.url), JSON.stringify({
  checked_at: new Date().toISOString(), scope: 'Offline real-archive replay only; no production wallet or live pre-race proof',
  source_quote: archive.locked_quote, final_jra_quote: archive.jra_final_quote, final_hkjc_quote: archive.hkjc_final_quote,
  stake: 10000, locked_return: ticket.returned, fixture_cash_before: 500000,
  cash_after_purchase: 490000, cash_after_result_received: 490000, cash_after_viewed_settlement: state.cash,
  same_day_blocked: true, repeat_settlement_idempotent: true, current_unpublished_samples_rejected: checks.future_samples.length
}, null, 2));
console.log('PASS: archived official 12.6 quote locked; receipt alone does not pay; viewing returns 126000 once; final JRA 12.0 and HKJC 13 stay separate; race-day and current unpublished purchases rejected without debits.');

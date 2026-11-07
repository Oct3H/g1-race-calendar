import assert from 'node:assert/strict';

const RealDate = Date;
const testTime = RealDate.parse('2026-11-07T12:00:00Z');
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [testTime])); }
  static now() { return testTime; }
};
const currentYear = new Date().getFullYear();
const previousYear = currentYear - 1;
const races = [
  { id: 'current-first', name: 'Current race', date: `${currentYear}-03-02` },
  { id: 'current-next', name: 'Next race', date: `${currentYear}-03-01` },
  { id: 'previous', name: 'Previous race', date: `${previousYear}-03-01` }
];
const revisions = new Map();
const events = [];
let journal = '{}';
globalThis.window = { webkit: { messageHandlers: { calendar: { async postMessage({ command, value }) {
  if (command === 'cacheRevision') return revisions.get(value) || 0;
  if (command === 'clearCacheYear') {
    const revision = (revisions.get(value) || 0) + 1;
    revisions.set(value, revision);
    return revision;
  }
  if (command === 'collection') { journal = value; return true; }
  throw new Error(command);
} } } } };

const { createCollection } = await import('../design/desktop-collection.mjs');
function makeData(load, backgroundCollection = true, launchId) {
  return {
    backgroundCollection, collectionState: JSON.parse(journal), offline: false, launchId,
    race: { id: 'desktop-tenno-2026', name: 'Tenno', date: '2026-11-01', realResult: { runners: [] } },
    async refresh() { return true; },
    schedule: {
      async collect(year, force, change, { localOnly }) {
        if (!localOnly) events.push(['schedule', year, force]);
        change();
      },
      state() { return { providersExpected: ['jra'], providers: { jra: { status: 'success' } } }; },
      races() { return races; }
    },
    details: {
      attach: race => race,
      async readCached() {},
      async load(race, change, options) {
        events.push(['race', race.id, options.reuseFinished]);
        await load?.(race);
        return 'success';
      },
      forgetYear(year) { events.push(['clear', year]); }
    }
  };
}

let collection = createCollection(makeData(async race => {
  if (race.id === 'current-first') await collection.setPaused(true);
}), () => {});
await collection.run();
assert.deepEqual(events.filter(([type]) => type === 'schedule').map(([, year]) => year).sort(),
  [currentYear - 3, currentYear - 2, previousYear, currentYear, currentYear + 1, currentYear + 2]);
assert.deepEqual(events.filter(([type]) => type === 'race'), [['race', 'current-first', true]]);
assert.equal(JSON.parse(journal).paused, true);
collection = createCollection(makeData(), () => {});
const beforeResume = events.length;
await collection.run();
assert.equal(events.length, beforeResume, 'Reload must respect an explicit pause');
await collection.setPaused(false);
await collection.run();
assert.deepEqual(events.slice(beforeResume), [['race', 'current-next', true], ['race', 'previous', true]]);

await collection.clear(previousYear);
collection = createCollection(makeData(), () => {});
await collection.run();
assert.deepEqual(events.slice(beforeResume + 2), [['clear', previousYear]], 'Cleared year must stay excluded on restart');
collection = createCollection(makeData(undefined, false), () => {});
await collection.redownload(previousYear);
await collection.run();
assert.deepEqual(events.slice(-2), [['schedule', previousYear, true], ['race', 'previous', false]]);
assert.equal(JSON.parse(journal).years[previousYear].requested, false);
assert.equal(JSON.parse(journal).years[previousYear].revision, 1);

// SQLite clear is atomic even if the renderer quits before saving the journal.
const interrupted = JSON.parse(journal);
interrupted.years[previousYear].requested = true;
journal = JSON.stringify(interrupted);
revisions.set(previousYear, 2);
const beforeInvalidated = events.length;
await createCollection(makeData(), () => {}).run();
assert(!events.slice(beforeInvalidated).some(([type, id]) => type === 'race' && id === 'previous'));
assert.equal(JSON.parse(journal).years[previousYear], undefined);

journal = '{}';
events.length = 0;
collection = createCollection(makeData(race => {
  if (race.id === 'current-first') race.realResult = { finished: false, runners: [] };
}), () => {});
await collection.run();
await collection.check();
await collection.run();
assert.equal(events.filter(([type, id]) => type === 'race' && id === 'current-first').length, 2);
assert.equal(events.filter(([type, id]) => type === 'race' && id === 'current-next').length, 1);

const pending = race => { if (race.id === 'current-first') race.realResult = { finished: false, runners: [] }; };
events.length = 0;
await createCollection(makeData(pending, true, 'launch-a'), () => {}).run();
const startupSchedules = [currentYear, currentYear + 1, currentYear + 2].map(year => ['schedule', year, true]);
assert.deepEqual(events, [...startupSchedules, ['race', 'current-first', true]]);
events.length = 0;
await createCollection(makeData(pending, true, 'launch-a'), () => {}).run();
assert.deepEqual(events, [], 'Opening the calendar again within the same process must not restart network work');
await createCollection(makeData(pending, true, 'launch-b'), () => {}).run();
assert.deepEqual(events, [...startupSchedules, ['race', 'current-first', true]]);
assert.equal(JSON.parse(journal).scheduleLaunches[currentYear], 'launch-b');
globalThis.Date = RealDate;
console.log('PASS six-year schedules, persisted pause, year isolation, refresh and same-day process relaunch');

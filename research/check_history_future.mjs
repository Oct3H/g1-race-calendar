import './check_desktop_details.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseJapanResult, parseOverseasResult, parseHongKongResult, japanNewsLinks, parseJapanEntries, createDetails } from '../design/desktop-details.mjs';
import { parseSchedule, parseCentralFixtures, restoreCentralMetadata } from '../design/desktop-schedule.mjs';
import { parseIfhaFixtures } from '../design/desktop-ifha.mjs';
import { createCollection } from '../design/desktop-collection.mjs';
const read = name => fs.readFileSync(new URL('./2026-11-05-history-future/' + name, import.meta.url), 'utf8');
const arima = parseJapanResult(read('arima2024.html'), { date: '2024-12-22', sourceEnglish: 'Arima Kinen' }, 'https://japanracing.jp/_news2024/241222.html');
assert.equal(arima.runners.length, 16);
assert.equal(arima.runners[0].name, 'Regaleira');
assert.equal(arima.runners.find(runner => runner.number === 2).status, 'withdrawn');
assert.equal(arima.runners.find(runner => runner.number === 2).odds, undefined);
const upcoming = JSON.parse(read('future-2026-11-07.json'));
const beforeDeclarations = structuredClone(upcoming);
for (const meeting of beforeDeclarations.data.raceMeetingProfile) {
  for (const race of meeting.races) race.runners = [];
}
assert.equal(parseOverseasResult(beforeDeclarations, { name: 'Lexus Champions Mile', country: 'AU', date: '2026-11-07' }), null);
const mile = parseHongKongResult(read('hkmile2025.html'), '香港一哩錦標', 'https://racing.hkjc.com/zh-hk/local/information/archive/localresults?racedate=2025%2F12%2F14&racecourse=ST&RaceNo=7');
assert.equal(mile.runners.length, 14);
assert.equal(mile.withdrawals[0].name, '越駿歡欣');
assert.equal(mile.withdrawals[0].number, undefined);
const dubai = JSON.parse(read('dubai-s2.json'));
assert.equal(parseOverseasResult(dubai, {name:'Dubai Turf Sponsored by DP World',country:'AE',date:'2025-04-05'}).runners.length,11);
const maurice = parseOverseasResult(JSON.parse(read('maurice2025.json')), {name:"ARC Prix Maurice de Gheest - Fonds Europeen de l'Elevage",country:'FR',date:'2025-08-10'});
assert(maurice?.runners.length > 5);
const lockinge = parseOverseasResult(JSON.parse(read('lockinge2025.json')), {sourceEnglish:'Boylesports Lockinge Stakes (Class 1) (Group 1)',country:'GB',date:'2025-05-17'});
assert(lockinge?.runners.length > 5);
const queried = [];
window.webkit.messageHandlers.calendar.postMessage = async ({ command, value }) => {
  if (command === 'cacheRevision') return 0;
  if (command === 'readDetail') return '';
  if (command === 'saveDetail') return true;
  assert.equal(command, 'fetchOverseas');
  queried.push(value);
  if (value.venue === 'S2') return JSON.stringify(dubai);
  return JSON.stringify({data:{raceMeetingProfile: typeof value === 'string' ? [{date:value,venueCode:'S1',races:[]}] : []}});
};
const secondMeeting = {id:'dubai-turf-2025',name:'Dubai Turf',date:'2025-04-05',country:'AE',scheduleSource:'archive'};
await createDetails(false).load(secondMeeting, () => {});
assert.equal(secondMeeting.refreshState, 'success');
assert.equal(secondMeeting.realResult.runners.length, 11);
assert(queried.some(value => value.venue === 'S2'));
window.webkit.messageHandlers.calendar.postMessage = async ({ command }) => {
  if (command === 'cacheRevision') return 0;
  if (command === 'readDetail') return '';
  if (command === 'fetchDetail') throw new Error('The request timed out.');
  if (command === 'fetchOverseas') return JSON.stringify({data:{raceMeetingProfile:[]}});
  throw new Error(command);
};
const slowSource = {id:'slow-jra-2024',date:'2024-12-22',sourceEnglish:'Arima Kinen',scheduleSource:'jra'};
await createDetails(false).load(slowSource, () => {});
assert.equal(slowSource.refreshState,'failed');
assert.equal(slowSource.failureKind,'timeout');

const originalDate = globalThis.Date;
const originalZone = process.env.TZ;
let firstOfficialRequest;
try {
  process.env.TZ = 'America/Los_Angeles';
  globalThis.Date = class extends originalDate {
    constructor(...args) { super(...(args.length ? args : ['2024-12-22T05:00:00Z'])); }
    static now() { return originalDate.parse('2024-12-22T05:00:00Z'); }
  };
  window.webkit.messageHandlers.calendar.postMessage = async ({ command, value }) => {
    if (command === 'cacheRevision') return 0;
    if (command === 'readDetail') return '';
    if (command === 'saveDetail') return true;
    firstOfficialRequest ??= value;
    if (value.endsWith('/241222.html')) return read('arima2024.html');
    throw new Error('Expected venue-local race date');
  };
  const tokyoRace = { ...slowSource, id: 'venue-day-jra-2024' };
  await createDetails(false).load(tokyoRace, () => {});
  assert(firstOfficialRequest.endsWith('/241222.html'), 'JAIRS result should be checked when the date in Japan has arrived');
  assert.equal(tokyoRace.refreshState, 'success');
} finally {
  globalThis.Date = originalDate;
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
}
const links = japanNewsLinks(read('news2025.html'), { date:'2025-12-27',sourceEnglish:'Hopeful Stakes' });
assert(links.some(link => link.url.endsWith('251227-03.html')));
assert(!links.some(link => link.url.endsWith('.pdf')));
const older = parseJapanResult(read('arima2015.html'), { date:'2015-12-27',sourceEnglish:'Arima Kinen' }, 'https://japanracing.jp/_news2015/151227.html');
assert.equal(older.runners.length,16);
assert.equal(older.runners[0].name,'Gold Actor');
const reference = JSON.parse(fs.readFileSync(new URL('./2026-10-27-japan/research-cache-replay.json',import.meta.url),'utf8'));
const fixtureRace = (day, track, text) => `<tr><td><span class="dayNumber">${day}</span><div class="calendarRaceName"><span class="calendarRaceIcon"><img src="../../../common/img/rf_${track}.png"></span><span class="calendarRaceText">${text}</span></div></td></tr>`;
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const december = [
  fixtureRace(25, 'nak', 'Nakayama Daishogai (J-G1)'),
  fixtureRace(26, 'nak', '<!--<a href="../graded/list/2027/1226arima.html">-->Arima Kinen (The Grand Prix) (G1)<!--</a>-->'),
  fixtureRace(28, 'nak', 'Hopeful Stakes (G1)')
].join('');
const fixtures = '<h2 class="title02">2027</h2><ul>' + months.map(month =>
  `<li id="${month}"><table>${month === 'Dec' ? december : month === 'May' ? fixtureRace(30, 'tok', 'Tokyo Yushun<br>(Japanese Derby) (G1)<br>Meguro Kinen (G2)') : ''}</table></li>`).join('') + '</ul>';
const futureCalendar = parseCentralFixtures(fixtures, 2027, reference);
assert.deepEqual(futureCalendar.map(race => [race.id, race.date]), [
  ['jra-2027-derby', '2027-05-30'], ['jra-2027-arima', '2027-12-26'], ['jra-2027-hopeful', '2027-12-28']
]);
assert.equal(futureCalendar[1].place, 'JP · 中山');
assert.equal(futureCalendar[1].startAt, undefined);
assert.throws(() => parseCentralFixtures(fixtures, 2028, reference), /Wrong JRA fixture year/);
const ifhaUrl = 'https://www.ifhaonline.org/default.asp?section=Racing&area=7';
assert.throws(() => parseIfhaFixtures('<table><tr><td colspan="9"><b>Sorry, no records have been found, if you have a filter set, you may need to change your request</b></td></tr></table>',
  2028, ifhaUrl, { entries: [] }), { code: 'NO_FIXTURES' });
assert.throws(() => parseIfhaFixtures('<h1>Temporary error</h1>', 2028, ifhaUrl, { entries: [] }),
  error => error.code !== 'NO_FIXTURES');
const calendar = parseSchedule(read('schedule2015.html'),2015,'jra','https://japanracing.jp/en/racing/schedule/graded/list/2015.html',reference);
assert.equal(calendar.length,22);
assert.equal(calendar.find(row => row.date==='2015-12-27').name,'有馬記念');
assert.equal(calendar.find(row => row.date==='2015-11-01').name,'天皇賞（秋）');
const oldCache = { id:'jra-2024-arima',name:'有馬記念',date:'2024-12-22',scheduleURL:'https://japanracing.jp/en/racing/schedule/graded/list/2024/1222arima.html',winnerPrize:'500,000,000' };
const restored = restoreCentralMetadata(oldCache,reference);
assert.match(restored.sourceEnglish,/ARIMA KINEN/);
assert.equal(restored.date,oldCache.date);
assert.equal(restored.winnerPrize,oldCache.winnerPrize);
assert.equal(oldCache.sourceEnglish,undefined);
const draw = fs.readFileSync(new URL('./2026-10-31-publication/live/request-11-79849aaede.response',import.meta.url),'utf8');
const declared = parseJapanEntries(draw,{date:'2026-11-01',sourceEnglish:'Tenno Sho (Autumn)'},'https://japanracing.jp/_news2026/261030.html');
assert.equal(declared.runners.length,17);
assert.equal(declared.finished,false);
for (const [name, country, count] of [['Lexus Champions Mile', 'AU', 9], ['TAB Champions Stakes', 'AU', 11], ['VRC Champions Sprint', 'AU', 12], ['Grosser Preis von Bayern', 'DE', 10]]) {
  const data = parseOverseasResult(upcoming, { name, country, date: '2026-11-07' });
  assert.equal(data?.runners.length, count, name + ' declarations not found');
  assert.equal(data.finished, false);
  assert.equal(data.runners.filter(row => row.odds).length, 0);
}
const raceWithSavedResult = { id: 'test-stale-declarations', name: 'Lexus Champions Mile', country: 'AU', date: '2026-11-07', scheduleSource: 'archive' };
let overwrite = false;
window.webkit.messageHandlers.calendar.postMessage = async ({ command }) => {
  if (command === 'cacheRevision') return 0;
  if (command === 'readDetail') return JSON.stringify({ finished: true, runners: [{ number: 1, name: 'Saved winner', rank: 1 }] });
  if (command === 'fetchOverseas') return JSON.stringify(upcoming);
  if (command === 'saveDetail') { overwrite = true; return true; }
  throw new Error(command);
};
await createDetails(false).load(raceWithSavedResult, () => {});
assert.equal(overwrite, false, 'An entries-only response must not replace a saved result');
assert.equal(raceWithSavedResult.realResult.runners[0].name, 'Saved winner');

// Replay the same official NAR program URL as captured before and after publication.
const capture = (folder, filename) => fs.readFileSync(new URL(`./${folder}/live/${filename}.response`, import.meta.url), 'utf8');
const narDirectory = 'https://www.keiba.go.jp/dirtgraderace/2026/racelist/index.html';
const jbc = parseSchedule(capture('2026-10-27-japan', 'request-06-a794a870b1'), 2026, 'nar', narDirectory)
  .find(race => race.name === 'ＪＢＣクラシック' || race.name === 'JBCクラシック');
assert(jbc, 'Find the race in the annual directory');
let published = false;
const savedDetails = new Map();
let journal = '{}';
window.webkit.messageHandlers.calendar.postMessage = async ({ command, value }) => {
  if (command === 'cacheRevision') return 0;
  if (command === 'collection') { journal = value; return true; }
  if (command === 'readDetail') return savedDetails.get(value) || '';
  if (command === 'saveDetail') { savedDetails.set(value.key, value.json); return true; }
  assert.equal(command, 'fetchDetail');
  if (value === jbc.scheduleURL) {
    return published ? capture('2026-10-31-publication', 'request-03-ed2e9aadd5') : capture('2026-10-27-japan', 'request-08-ed2e9aadd5');
  }
  assert.equal(value, 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_raceDate=2026/11/03&k_raceNo=9&k_babaCode=22');
  return capture('2026-10-31-publication', 'request-04-eb699457ec');
};
try {
  const sameDay = originalDate.parse('2026-10-31T10:00:00Z');
  globalThis.Date = class extends originalDate {
    constructor(...args) { super(...(args.length ? args : [sameDay])); }
    static now() { return sameDay; }
  };
  const launch = launchId => createCollection({
    launchId, backgroundCollection: true, offline: false, collectionState: JSON.parse(journal),
    details: createDetails(false),
    race: { id: 'desktop-tenno-2026', date: '2026-11-01', realResult: { runners: [] } },
    schedule: {
      async collect() {},
      state() { return { providersExpected: ['nar'], providers: { nar: { status: 'success' } } }; },
      races() { return [jbc]; }
    }
  }, () => {}).run();
  await launch('before-publication');
  assert.equal(savedDetails.size, 0, 'A provisional program is not a declaration');
  assert.equal(JSON.parse(journal).years[2026].races[jbc.id], 'unavailable');
  published = true;
  await launch('after-publication');
  const savedJbc = JSON.parse(savedDetails.get('race.' + jbc.id));
  assert.equal(savedJbc.runners.length, 12);
  assert.equal(savedJbc.finished, false);
  assert(savedJbc.runners.every(runner => runner.odds === undefined));

  const central = { id: 'jra-2026-entries-replay', date: '2026-11-01', sourceEnglish: 'Tenno Sho (Autumn)', scheduleSource: 'jra' };
  window.webkit.messageHandlers.calendar.postMessage = async ({ command, value }) => {
    if (command === 'cacheRevision') return 0;
    if (command === 'readDetail') return '';
    if (command === 'saveDetail') return true;
    assert.equal(command, 'fetchDetail');
    if (value.endsWith('/news/2026.html')) return read('news2026.html');
    assert.equal(value, 'https://japanracing.jp/_news2026/261030.html');
    return draw;
  };
  await createDetails(false).load(central, () => {});
  assert.equal(central.refreshState, 'success');
  assert.equal(central.realResult.runners.length, 17);
  assert.equal(central.realResult.finished, false);
} finally {
  globalThis.Date = originalDate;
}
console.log('PASS official JRA news discovery and automatic NAR before/after publication');

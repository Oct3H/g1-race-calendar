import { devText, native } from './desktop-bridge.mjs';
import { createSchedule } from './desktop-schedule.mjs';
import { createDetails } from './desktop-details.mjs';

export const sourceURL = 'https://japanracing.jp/_news2026/261101.html';
const seedTimestamp = '2026-11-04T09:33:23.671Z';

function parts(cell) {
  const lines = [''];
  for (const node of cell.childNodes) {
    if (node.nodeName === 'BR') lines.push('');
    else lines[lines.length - 1] += node.textContent;
  }
  return lines.map(text => text.trim().replace(/\s+/g, ' '));
}

export function parseResult(html, identity, fetchedAt) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = template.content;
  const heading = [...doc.querySelectorAll('p > strong')].find(element => element.textContent === 'THE 174TH TENNO SHO (AUTUMN) (G1)');
  if (!heading || !/November 1, 2026\s+Tokyo Racecourse\s+11th Race/.test(heading.parentElement.textContent)) {
    throw new Error('Unexpected race identity');
  }
  const table = heading.parentElement.nextElementSibling;
  if (table?.tagName !== 'TABLE' || [...table.rows[0].cells].slice(0, 3).map(cell => cell.textContent.trim()).join(' ') !== 'FP BK PP') {
    throw new Error('Unexpected results table');
  }
  const horses = new Map(identity.matched.map(horse => [horse.number, horse]));
  const runners = [...table.rows].slice(1).map(row => {
    if (row.cells.length !== 9) throw new Error('Unexpected runner row');
    const [rank, bracket, number, horse, age, odds, margin, pedigree, connections] = [...row.cells].map(parts);
    const match = horses.get(Number(number[0].replace(/\s+B$/, '')));
    const name = horse[0].match(/^(.*?) \(([A-Z]{3})\)$/);
    if (!match || match.en !== name?.[1] || !/^\d+$/.test(rank[0]) ||
        !/^\d+(?:\.\d+)?$/.test(odds[0]) || !horse[1]) {
      throw new Error('Unverified runner or result');
    }
    horses.delete(match.number);
    return {
      number: match.number, rank: Number(rank[0]), bracket: bracket[0], name: match.ja, nameLang: 'ja', jockey: horse[1],
      origin: name[2], sexAge: age[0], weight: age[2], odds: odds[0], margin: Number(rank[0]) === 1 ? '—' : margin[0],
      sire: pedigree[0], dam: pedigree[1], damSire: pedigree[2]?.replace(/^\(|\)$/g, ''), trainer: connections[2]
    };
  }).sort((a, b) => a.rank - b.rank);
  if (horses.size || runners[0]?.rank !== 1) throw new Error('Incomplete results');
  return { runners, fetchedAt };
}

export async function loadDesktopData() {
  const snapshot = await native('load');
  const schedule = await createSchedule(snapshot.offline);
  const identity = JSON.parse(snapshot.verified).tenno;
  const stored = snapshot.result ? JSON.parse(snapshot.result) : null;
  let result = stored;
  if (!stored) {
    result = parseResult(snapshot.seed, identity, seedTimestamp);
    if (!await native('result', { revision: snapshot.resultRevision, json: JSON.stringify(result) })) result = { cleared: true };
  }
  const race = {
    id: 'desktop-tenno-2026', name: '天皇賞（秋）', nameLang: 'ja', place: '東京競馬場',
    country: 'JP', region: 'jp', grade: 'g1', surface: 'turf', course: '芝 2,000m',
    date: '2026-11-01', startAt: '2026-11-01T15:40:00+09:00', venueTimeZone: 'Asia/Tokyo', sampleFinished: true,
    realResult: result.cleared ? null : result
  };
  const fixture = {
    id: 'desktop-fixture', name: 'テストレース（架空）', nameLang: 'ja',
    subtitle: devText('马券测试专用 · 虚构赛事与赔率', 'Ticket testing only · Fictional race and odds', '馬券テスト専用 · 架空のレースとオッズ'),
    place: 'テスト競馬場', country: 'JP', region: 'jp', grade: 'g1', surface: 'turf',
    course: '芝 2,000m', startAt: snapshot.testDate, venueTimeZone: 'Asia/Tokyo',
    layoutDemo: true, sampleEntriesConfirmed: true, sampleOfficialOdds: true,
    sampleOddsSource: '开发测试倍率（虚构）', sampleOddsAt: new Date(Date.parse(snapshot.testDate) - 7 * 86400000).toISOString(),
    source: '开发测试 · 虚构赛事'
  };
  return {
    race, fixture, schedule, details: createDetails(snapshot.offline), offline: snapshot.offline, wallet: snapshot.wallet ? JSON.parse(snapshot.wallet) : null,
    collectionState: JSON.parse(snapshot.collection || '{}'), backgroundCollection: snapshot.backgroundCollection, launchId: snapshot.launchId,
    async refresh(expectedRevision) {
      const revision = await native('cacheRevision', 2026);
      if (expectedRevision !== undefined && revision !== expectedRevision) return false;
      const html = await native('refresh');
      const result = parseResult(html, identity, new Date().toISOString());
      if (!await native('result', { revision, json: JSON.stringify(result) })) return false;
      race.realResult = result;
      return true;
    }
  };
}

export function updateTime(iso) {
  return iso ? new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';
}

export function makeSourceLink(url = sourceURL, label = 'Horse Racing in Japan · JAIRS') {
  const link = document.createElement('a');
  link.href = url;
  link.textContent = label + ' ↗';
  link.addEventListener('click', event => {
    event.preventDefault();
    native('openSource', url).catch(console.error);
  });
  return link;
}

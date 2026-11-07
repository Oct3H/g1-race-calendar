import { native } from './desktop-bridge.mjs';
import { parseSchedule } from './desktop-schedule.mjs';

const hkOrigin = 'https://racing.hkjc.com';
const hkNames = [
  [/hong kong cup|香港[盃杯]/i, '香港盃'], [/hong kong mile|香港一哩錦標/i, '香港一哩錦標'],
  [/hong kong sprint|香港短途錦標/i, '香港短途錦標'], [/hong kong vase|香港瓶/i, '香港瓶'],
  [/chairman.s sprint prize|主席短途獎/i, '主席短途獎'], [/champions mile|冠軍一哩賽/i, '冠軍一哩賽'],
  [/queen elizabeth ii cup|女皇盃/i, '女皇盃'], [/champions.*chater cup|冠軍暨遮打盃/i, '冠軍暨遮打盃'],
  [/hong kong gold cup|香港金盃/i, '香港金盃'], [/stewards. cup|董事盃/i, '董事盃'],
  [/queen.s silver jubilee cup|女皇銀禧紀念盃/i, '女皇銀禧紀念盃'], [/centenary sprint cup|百週年紀念短途盃/i, '百週年紀念短途盃']
];
const normalized = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const cells = row => [...row.cells].map(cell => cell.textContent.trim().replace(/\s+/g, ' '));
const odds = value => /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0 ? value : undefined;
// Publication dates on JAIRS and HKJC use the venue's local calendar.
const venueDay = timeZone => new Intl.DateTimeFormat('sv-SE', { timeZone }).format(new Date());

function page(html) {
  const template = document.createElement('template');
  template.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return template.content;
}

async function request(command, value, progress, stage) {
  const startedAt = Date.now();
  progress?.({ stage, state: 'checking', startedAt });
  try {
    const response = await native(command, value);
    progress?.({ stage, state: 'success', startedAt, duration: Date.now() - startedAt });
    return response;
  } catch (error) {
    progress?.({ stage, state: 'failed', startedAt, duration: Date.now() - startedAt });
    throw Object.assign(new Error(error.message || String(error)), { code: error.code, requestFailed: true });
  }
}

export function parseJapanResult(html, race, url) {
  const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(race.date));
  const name = normalized((race.sourceEnglish || '').split('(')[0]);
  const heading = [...page(html).querySelectorAll('p > strong')].find(node =>
    name && normalized(node.textContent).includes(name) && node.parentElement.textContent.includes(day) &&
    [...(node.parentElement.nextElementSibling?.rows?.[0]?.cells || [])].slice(0, 3).map(cell => cell.textContent.trim()).join(' ') === 'FP BK PP');
  if (!heading) throw new Error('JAIRS result identity could not be verified');
  const lines = cell => cell.innerHTML.split(/<br\s*\/?\s*>/i).map(line => [...page(line).childNodes].map(node => node.textContent).join('').trim());
  const runners = [...heading.parentElement.nextElementSibling.rows].slice(1).map(row => {
    const columns = [...row.cells].map(lines);
    if (columns.length === 11) {
      const [rank, bracket, number, horse, age, weight, pedigree, people, owner, margin, price] = columns;
      columns.splice(0, columns.length, rank, bracket, number, [horse.join(' '), people[0]], [age[0], '', weight[0]], price, margin, pedigree, [owner[0], owner[1], people[1]]);
    }
    const withdrawn = row.cells.length === 8 && row.cells[5].getAttribute('colspan') === '2' && columns[5][0] === 'Scratched';
    if (withdrawn) columns.splice(6, 0, []);
    if (columns.length !== 9) throw new Error('Unexpected JAIRS result row');
    const [rank, bracket, number, horse, age, price, margin, pedigree, connections] = columns;
    const [, horseName, origin] = horse[0].match(/^(.*?) \(([A-Z]{2,3})\)$/) || [];
    const horseNumber = number[0].match(/^(\d+)(?:\s*B)?$/)?.[1];
    if (!horseName || !horseNumber) throw new Error('Unexpected JAIRS runner');
    return { number: Number(horseNumber), rank: withdrawn ? 'SCR' : Number(rank[0]) || rank[0], status: withdrawn ? 'withdrawn' : undefined, bracket: bracket[0], name: horseName,
      origin, jockey: horse[1], sexAge: age[0], weight: age[2], odds: odds(price[0]), margin: Number(rank[0]) === 1 ? '—' : margin[0],
      sire: pedigree[0], dam: pedigree[1], damSire: pedigree[2]?.replace(/^\(|\)$/g, ''), trainer: connections[2] };
  });
  const header = heading.parentElement.textContent;
  const time = header.match(/Post time:\s*(\d{2}:\d{2})/i)?.[1];
  return result(runners, url, { purse: header.match(/Total prize money:\s*¥\s*([\d,]+)/i)?.[1], currency: 'JPY',
    startAt: time ? race.date + 'T' + time + ':00+09:00' : undefined });
}

export function japanNewsLinks(html, race) {
  const year = race.date.slice(0, 4);
  const base = `https://japanracing.jp/en/racing/news_media/news/${year}.html`;
  const day = race.date.slice(2).replaceAll('-', '');
  const name = normalized((race.sourceEnglish || '').split('(')[0]);
  const selected = new Map();
  for (const anchor of page(html).querySelectorAll('a[href]')) {
    const url = new URL(anchor.getAttribute('href'), base);
    const stamp = url.pathname.match(new RegExp(`^/_news${year}/(\\d{6})(?:-\\d{2})?\\.html$`))?.[1];
    if (url.origin !== 'https://japanracing.jp' || !stamp || url.hash) continue;
    const label = anchor.textContent.trim();
    if (stamp === day && !/comments|preview|barrier draw|morning line/i.test(label)) selected.set(url.href, { url: url.href, kind: 'results' });
    if (name && normalized(label).includes(name) && /barrier draw/i.test(label)) {
      const date = `20${stamp.slice(0, 2)}-${stamp.slice(2, 4)}-${stamp.slice(4, 6)}`;
      const age = (Date.parse(race.date) - Date.parse(date)) / 86400000;
      if (age >= 0 && age <= 10) selected.set(url.href, { url: url.href, kind: 'entries' });
    }
  }
  return [...selected.values()].sort((a, b) => (a.kind === 'results' ? 0 : 1) - (b.kind === 'results' ? 0 : 1));
}

export function parseJapanEntries(html, race, url) {
  const doc = page(html);
  const name = normalized((race.sourceEnglish || '').split('(')[0]);
  const heading = [...doc.querySelectorAll('h5')].find(node => /barrier draw/i.test(node.textContent) && name && normalized(node.textContent).includes(name));
  const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(race.date));
  const date = [...doc.querySelectorAll('td')].find(cell => cell.textContent.trim().startsWith(day + ','));
  const table = [...doc.querySelectorAll('table')].find(table => [...table.rows[0]?.cells || []].slice(0, 3).map(cell => cell.textContent.trim()).join(' ') === 'Bk Hs Horse');
  if (!heading || !date || !table) throw new Error('JAIRS declarations could not be verified');
  const lines = cell => [...cell.childNodes].reduce((all, node) => {
    if (node.nodeName === 'BR') all.push('');
    else all[all.length - 1] += node.textContent;
    return all;
  }, ['']).map(value => value.trim());
  const runners = [...table.rows].slice(1).map(row => {
    if (row.cells.length !== 10) throw new Error('Unexpected JAIRS declarations table');
    const [bracket, number, horse, , age, weight, parents, ancestors, people] = [...row.cells].map(lines);
    const name = horse[0].match(/^(.*?)\s*\(([A-Z]{2,3})\)$/);
    if (!name || !/^\d+$/.test(number[0])) throw new Error('Invalid JAIRS declared horse');
    return { number: Number(number[0]), bracket: bracket[0], name: name[1], origin: name[2], sexAge: age[0], weight: weight[0],
      sire: parents[0], dam: parents[1], damSire: ancestors[0], jockey: people[0], trainer: people[1] };
  });
  const time = date.textContent.match(/Post time\s*(\d{2}:\d{2})/i)?.[1];
  return result(runners, url, { finished: false, startAt: time ? race.date + 'T' + time + ':00+09:00' : undefined });
}

async function fetchJapanDetails(race, progress) {
  const formatErrors = [];
  const sourceErrors = [];
  const remember = error => {
    if (/Unexpected JAIRS|Invalid JAIRS|Incomplete official/.test(error.message)) formatErrors.push(error);
    else if (error.requestFailed && !/HTTP 404|HTTP 410/.test(error.message)) sourceErrors.push(error);
  };
  const fallback = async () => {
    try { return await fetchOverseasResult(race, progress); }
    catch (error) {
      if (error.code === 'NO_DETAILS') {
        if (formatErrors.length) throw Object.assign(new Error(formatErrors[0].message), { code: 'PARSE_ERROR' });
        if (sourceErrors.length) throw sourceErrors[0];
      }
      throw error;
    }
  };
  const year = race.date.slice(0, 4);
  const direct = 'https://japanracing.jp/_news' + year + '/' + race.date.slice(2).replaceAll('-', '') + '.html';
  const today = venueDay('Asia/Tokyo');
  if (race.date <= today) {
    try { return parseJapanResult(await request('fetchDetail', direct, progress, 'japan-result'), race, direct); }
    catch (error) { remember(error); }
  }
  const index = `https://japanracing.jp/en/racing/news_media/news/${year}.html`;
  let links;
  try { links = japanNewsLinks(await request('fetchDetail', index, progress, 'japan-index'), race); }
  catch (error) { remember(error); return fallback(); }
  for (const link of links.slice(0, 4)) {
    if (link.url === direct && race.date <= today) continue;
    try {
      const html = await request('fetchDetail', link.url, progress, link.kind === 'entries' ? 'japan-entries' : 'japan-result');
      return link.kind === 'entries' ? parseJapanEntries(html, race, link.url) : parseJapanResult(html, race, link.url);
    } catch (error) { remember(error); }
  }
  return fallback();
}

function result(runners, url, extra = {}) {
  if (!runners.length || (extra.finished !== false && !runners.some(row => row.rank === 1)) || new Set(runners.map(row => row.number)).size !== runners.length ||
      runners.some(row => !row.number || !row.name)) throw new Error('Incomplete official results');
  return { runners, url, fetchedAt: new Date().toISOString(), ...extra };
}

export function parseHongKongResult(html, expectedName, url) {
  const doc = page(html);
  const summary = [...doc.querySelectorAll('.race_tab tr')].find(row => cells(row)[1] === '賽道 :');
  if (!summary || (expectedName && !normalized(cells(summary)[0]).endsWith(normalized(expectedName)))) return null;
  const params = new URL(url).searchParams;
  const date = params.get('racedate');
  const number = params.get('RaceNo');
  const identity = doc.querySelector('a[href*="displaysectionaltime"]');
  const identityParams = identity && new URL(identity.getAttribute('href'), hkOrigin).searchParams;
  if (!identityParams || identityParams.get('RaceNo') !== number ||
      identityParams.get('racedate') !== date?.split('/').reverse().join('/')) throw new Error('Unexpected HKJC meeting');
  const table = doc.querySelector('.performance table');
  if (!table || cells(table.tHead.rows[0]).slice(0, 4).join(' ') !== '名次 馬號 馬名 騎師') throw new Error('Unexpected HKJC result table');
  const records = [...table.tBodies[0].rows].map(row => {
    const [rank, number, horse, jockey, trainer, pounds, , draw, margin, , , price] = cells(row);
    const link = row.cells[2]?.querySelector('a[href*="horseid="]');
    const horseId = link && new URL(link.getAttribute('href'), hkOrigin).searchParams.get('horseid');
    return { number: number ? Number(number) : undefined, rank: Number(rank) || rank, status: rank === 'WV' ? 'withdrawn' : undefined, bracket: draw, name: link?.textContent.trim() || horse?.replace(/\s*\([A-Z]\d+\)$/, ''),
      nameLang: 'zh-Hant', jockey, trainer, weight: /^\d+$/.test(pounds) ? (Number(pounds) * 0.45359237).toFixed(1) : undefined,
      margin: Number(rank) === 1 ? '—' : margin, odds: odds(price), horseId: horseId || undefined };
  });
  const withdrawals = records.filter(row => row.status === 'withdrawn' && !row.number);
  const runners = records.filter(row => !withdrawals.includes(row));
  const purse = cells(summary.nextElementSibling)[0]?.match(/HK\$\s*([\d,]+)/)?.[1];
  return result(runners, url, { purse, currency: 'HKD', name: cells(summary)[0], withdrawals });
}

export function detailSupported(race) {
  return ['jra', 'nar', 'nar-history', 'hkjc', 'overseas-history', 'ifha', 'archive'].includes(race.scheduleSource);
}

const countries = { AU: ['Australia'], US: ['United States', 'United States of America', 'USA'], GB: ['Great Britain', 'United Kingdom', 'UK'],
  FR: ['France'], IE: ['Ireland'], DE: ['Germany'], AE: ['United Arab Emirates', 'UAE'], SA: ['Saudi Arabia'],
  ZA: ['South Africa'], NZ: ['New Zealand'], JP: ['Japan'], HK: ['Hong Kong'] };

function countryCode(label) {
  return Object.keys(countries).find(code => countries[code].some(name => normalized(name) === normalized(label || '')));
}

function overseasName(name, country) {
  const key = normalized(name.split('(')[0].trim().replace(/\s+(?:presented|sponsored)\s+by\b.*$/i, '')
    .replace(/\bS\.$/i, 'Stakes').replace(/\s+Stakes$/i, ''));
  if (country === 'AU') {
    if (['lexuschampionsmile', 'vrcchampionsmile'].includes(key)) return 'championsmile';
    if (['tabchampions', 'vrcchampions'].includes(key)) return 'champions';
  }
  if (country === 'FR' && key === 'arcprixmauricedegheestfondseuropeendelelevage') return 'prixmauricedegheest';
  return key;
}

export function parseOverseasResult(payload, race) {
  if (payload.errors?.length) throw new Error('HKJC overseas query unavailable');
  const name = overseasName(race.sourceEnglish || race.name, race.country);
  const matches = (payload.data?.raceMeetingProfile || []).flatMap(meeting => (meeting.races || []).flatMap(item => {
    const days = (Date.parse(meeting.date) - Date.parse(race.date)) / 86400000;
    const other = overseasName(item.raceName_en || '', race.country);
    const hkName = race.country === 'HK' && hkNames.find(([pattern]) => pattern.test(race.name))?.[1];
    const matchesName = hkName
      ? ['ST', 'HV'].includes(meeting.venueCode) && normalized(item.raceName_ch || '').endsWith(normalized(hkName))
      : race.targetHorseName
      ? item.runners?.some(row => row.horse.name_ch === race.targetHorseName || row.horse.name_en === race.targetHorseName) && Number(item.distance) === Number(race.distance)
      : Math.min(name.length, other.length) >= 4 && (name === other || name.endsWith(other) || other.endsWith(name)) && countryCode(item.country_en) === race.country;
    if (![0, 1].includes(days) || !matchesName) return [];
    return [{ item, meeting }];
  }));
  if (matches.length !== 1) return null;
  const { item, meeting } = matches[0];
  const finished = Boolean(item.status === 'RESULT' && item.raceResults?.some(row => row.status === 'WCFULLMARGIN'));
  if (!item.runners?.length || (!finished && item.status !== 'DECLARED')) return null;
  const isHongKong = race.country === 'HK' && ['ST', 'HV'].includes(meeting.venueCode);
  const runners = (item.runners || []).map(runner => ({
    number: Number(runner.no), rank: finished ? runner.finalPosition || runner.status : undefined,
    name: isHongKong ? runner.horse.name_ch : runner.horse.name_en, nameLang: isHongKong ? 'zh-Hant' : 'en',
    horseId: isHongKong ? runner.horse.id : undefined,
    jockey: isHongKong ? runner.jockey?.name_ch : runner.jockey?.name_en, trainer: isHongKong ? runner.trainer?.name_ch : runner.trainer?.name_en,
    bracket: runner.barrierDrawNumber, weight: runner.handicapWeight && (Number(runner.handicapWeight) * 0.45359237).toFixed(1),
    sexAge: [runner.sexNm?.english, runner.age].filter(Boolean).join(''), sire: runner.sire,
    origin: runner.horse.name_en.match(/\(([A-Z]{2,3})\)$/)?.[1],
    odds: runner.status === 'Scratched' ? undefined : odds(runner.winOdds),
    margin: finished && runner.finalPosition === 1 ? '—' : runner.lbwNm?.english
  }));
  const url = isHongKong
    ? hkOrigin + '/zh-hk/local/information/' + (finished ? 'archive/localresults' : 'racecard') + '?racedate=' + encodeURIComponent(meeting.date.replaceAll('-', '/')) + '&racecourse=' + meeting.venueCode + '&RaceNo=' + item.no
    : hkOrigin + '/en-us/overseas/' + (finished ? 'results' : 'racecard') + '?RaceDate=' + meeting.date.replaceAll('-', '') + '&Racecourse=' + meeting.venueCode + '&RaceNo=' + item.no;
  return result(runners, url, { finished, name: isHongKong ? item.raceName_ch : item.raceName_en, country: isHongKong ? 'HK' : countryCode(item.country_en),
    startAt: item.postTime, market: 'HKJC', venue: item.raceCourse?.description_en });
}

async function fetchOverseasResult(race, progress) {
  const failures = [];
  const query = async (date, venue) => {
    const data = JSON.parse(await request('fetchOverseas', venue ? { date, venue } : date, progress, 'hkjc-overseas'));
    const result = parseOverseasResult(data, race);
    if (!result) progress?.({ stage: 'hkjc-overseas', state: 'unmatched', date, venue,
      candidates: (data.data?.raceMeetingProfile || []).flatMap(meeting => (meeting.races || []).map(item => ({ name: item.raceName_en, country: item.country_en, date: meeting.date }))) });
    return { result, meetings: data.data?.raceMeetingProfile || [] };
  };
  for (const date of [race.date, new Date(Date.parse(race.date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)]) {
    try {
      const first = await query(date);
      if (first.result) return first.result;
      // A null venue may return only one of several simultaneous meetings.
      // Reuse the official query with the observed simulcast venue codes.
      if (first.meetings.length) {
        const missing = ['S1', 'S2', 'S3', 'S4', 'S5'].filter(venue => !first.meetings.some(meeting => meeting.venueCode === venue));
        for (let index = 0; index < missing.length; index += 2) {
          const responses = await Promise.allSettled(missing.slice(index, index + 2).map(venue => query(date, venue)));
          const match = responses.find(response => response.status === 'fulfilled' && response.value.result);
          if (match) return match.value.result;
          failures.push(...responses.filter(response => response.status === 'rejected').map(response => response.reason));
        }
      }
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw failures[0];
  throw Object.assign(new Error('No matching published HKJC overseas declarations or results'), { code: 'NO_DETAILS' });
}

function narIdentity(doc, race, url) {
  const query = new URL(url).searchParams;
  const [year, month, day] = race.date.split('-').map(Number);
  const heading = [...doc.querySelectorAll('h4')].find(node => node.textContent.includes(`${year}年${month}月${day}日`) && node.textContent.includes(`第${query.get('k_raceNo')}競走`));
  if (query.get('k_raceDate') !== race.date.replaceAll('-', '/') || !heading ||
      (race.scheduleSource !== 'nar-history' && !normalized(doc.querySelector('.raceTitle h3')?.textContent || '').includes(normalized(race.name)))) {
    throw new Error('Unexpected NAR race identity');
  }
}

export function parseNarEntries(html, race, url) {
  const doc = page(html);
  narIdentity(doc, race, url);
  return [...doc.querySelectorAll('td.horseNum')].filter(cell => /^\d+$/.test(cell.textContent.trim())).map(cell => {
    const row = cell.parentElement;
    const sex = row.nextElementSibling;
    const pedigree = sex?.nextElementSibling;
    const horse = row.querySelector('a.horseName');
    if (!horse || !sex || !pedigree) throw new Error('Unexpected NAR starter');
    const histories = [...row.querySelectorAll('.raceInfo')];
    const past = [...sex.cells].slice(-histories.length);
    const starts = histories.flatMap((info, index) => {
      const when = info.textContent.match(/(\d{2})\.(\d{2})\.(\d{2})/);
      const link = past[index]?.querySelector('a.race');
      const name = past[index]?.textContent.trim();
      if (!when || !name) return [];
      const rank = info.querySelector('.pastRank')?.textContent.trim();
      const venue = info.textContent.match(/([^\s]+)\s+((?:芝)?[左右直])(\d+)\s/);
      const people = [...pedigree.cells].slice(-histories.length)[index]?.textContent.trim().replace(/\s+/g, ' ');
      const times = [...pedigree.nextElementSibling?.cells || []].slice(-histories.length)[index]?.textContent.trim();
      const grade = name.normalize('NFKC').match(/(?:Jpn|G)(?:III|II|I)\b/)?.[0];
      return [{ date: `20${when[1]}-${when[2]}-${when[3]}`, rank: Number(rank) || rank,
        name, grade, course: venue?.[1], distance: venue?.[3], surface: venue?.[2].startsWith('芝') ? 'turf' : undefined,
        jockey: people?.match(/\d+人\s+\d+\s+(.+?)\s+\d+(?:\.\d+)?$/)?.[1],
        finishTime: times?.match(/^\d+:\d{2}\.\d+/)?.[0],
        url: link ? new URL(link.getAttribute('href'), url).href : undefined }];
    });
    return { number: Number(cell.textContent.trim()), name: horse.textContent.trim(), nameLang: 'ja',
      bracket: row.querySelector('.courseNum')?.textContent.trim(), jockey: row.querySelector('a.jockeyName')?.textContent.trim(),
      sexAge: sex.cells[0]?.textContent.trim(), weight: sex.cells[3]?.textContent.trim().match(/^\d+(?:\.\d+)?/)?.[0],
      sire: pedigree.cells[0]?.textContent.trim(), trainer: pedigree.cells[1]?.textContent.trim(),
      dam: pedigree.nextElementSibling?.cells[0]?.textContent.trim(),
      damSire: pedigree.nextElementSibling?.nextElementSibling?.cells[0]?.textContent.trim().replace(/^（|）$/g, ''),
      odds: odds(row.querySelector('.odds_Black')?.textContent.trim()), starts };
  });
}

export function parseNarResult(html, race, url, starters) {
  const doc = page(html);
  narIdentity(doc, race, url);
  const entrants = new Map(starters.map(runner => [runner.number, runner]));
  const runners = [...doc.querySelectorAll('td.horseName')].map(cell => {
    const row = cells(cell.parentElement);
    const number = Number(row[2]);
    if (entrants.size && entrants.get(number)?.name !== row[3]) throw new Error('NAR runner mismatch');
    return { ...entrants.get(number), number, name: row[3], nameLang: 'ja', rank: Number(row[0]) || row[0],
      bracket: row[1], sexAge: row[5], weight: row[6], jockey: row[7], trainer: row[8],
      margin: Number(row[0]) === 1 ? '—' : row[11], odds: odds(row[15]) };
  });
  const winnerPrize = doc.querySelector('.raceTitle .dataArea')?.textContent.match(/1着([\d,]+)円/)?.[1];
  return result(runners, url, { winnerPrize, currency: 'JPY', name: doc.querySelector('.raceTitle h3').textContent.trim() });
}

async function fetchNarResult(race, progress) {
  if (race.scheduleURL.includes('/racelist/') || race.scheduleURL.startsWith('https://www.keiba.go.jp/pdf/uploads/')) {
    const year = Number(race.date.slice(0, 4));
    const directory = await request('fetchSchedule', { year, provider: 'nar' }, progress, 'nar-program');
    if (directory.status !== 200) throw Object.assign(new Error('NAR annual directory unavailable'), { code: 'NO_DETAILS' });
    const matches = parseSchedule(directory.html, year, 'nar', directory.url).filter(item => item.date === race.date && normalized(item.name) === normalized(race.name));
    if (matches.length !== 1 || matches[0].scheduleURL.includes('/racelist/')) throw Object.assign(new Error('NAR race page not found in annual directory'), { code: 'NO_DETAILS' });
    race = { ...race, scheduleURL: matches[0].scheduleURL };
  }
  const program = page(await request('fetchDetail', race.scheduleURL, progress, 'nar-program'));
  const entry = [...program.querySelectorAll('a[href]')].find(link => link.getAttribute('href').includes('/DebaTable?') &&
    new URL(link.getAttribute('href'), race.scheduleURL).searchParams.get('k_raceDate') === race.date.replaceAll('-', '/'));
  if (!entry) throw Object.assign(new Error('NAR declarations have not been published'), { code: 'NO_DETAILS' });
  const entryURL = new URL(entry.getAttribute('href'), race.scheduleURL).href;
  const html = await request('fetchDetail', entryURL, progress, 'nar-entries');
  const starters = parseNarEntries(html, race, entryURL);
  const mark = [...page(html).querySelectorAll('a[href]')].find(link => {
    const url = new URL(link.getAttribute('href'), entryURL);
    const source = new URL(entryURL).searchParams;
    return url.pathname.endsWith('/RaceMarkTable') && ['k_raceDate', 'k_raceNo', 'k_babaCode'].every(key => url.searchParams.get(key) === source.get(key));
  });
  if (mark) {
    const url = new URL(mark.getAttribute('href'), entryURL).href;
    return parseNarResult(await request('fetchDetail', url, progress, 'nar-result'), race, url, starters);
  }
  return result(starters, entryURL, { finished: false });
}

export async function fetchRaceResult(race, progress) {
  if (race.scheduleSource === 'overseas-history') return fetchOverseasResult(race, progress);
  if (race.scheduleSource === 'nar-history') {
    return parseNarResult(await request('fetchDetail', race.scheduleURL, progress, 'nar-result'), race, race.scheduleURL, []);
  }
  if (race.scheduleSource === 'hkjc') {
    return parseHongKongResult(await request('fetchDetail', race.scheduleURL, progress, 'hkjc-result'), null, race.scheduleURL);
  }
  if (race.scheduleSource === 'jra') {
    return fetchJapanDetails(race, progress);
  }
  if (race.scheduleSource === 'nar') return fetchNarResult(race, progress);
  const expected = hkNames.find(([pattern]) => pattern.test(race.name))?.[1];
  if (race.country !== 'HK' || !expected) return fetchOverseasResult(race, progress);
  if (race.date >= venueDay('Asia/Hong_Kong')) {
    const payload = JSON.parse(await request('fetchOverseas', { date: race.date, venue: 'ST' }, progress, 'hkjc-entries'));
    const data = parseOverseasResult(payload, race);
    if (data) return data;
    throw Object.assign(new Error('HKJC declarations have not been retrieved'), { code: 'NO_DETAILS' });
  }
  const meeting = hkOrigin + '/zh-hk/local/information/archive/localresults?racedate=' + encodeURIComponent(race.date.replaceAll('-', '/')) + '&racecourse=ST';
  const html = await request('fetchDetail', meeting, progress, 'hkjc-program');
  const doc = page(html);
  const numbers = new Set([...doc.querySelectorAll('a[href*="/localresults?"]')].flatMap(link => {
    const params = new URL(link.getAttribute('href'), hkOrigin).searchParams;
    const no = params.get('RaceNo');
    return params.get('racedate') === race.date.replaceAll('-', '/') && /^[1-9][0-9]?$/.test(no || '') ? [Number(no)] : [];
  }));
  const preferred = { '香港盃': 8, '香港一哩錦標': 7, '香港短途錦標': 5, '香港瓶': 4 }[expected] || 8;
  const order = [...numbers].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  for (let i = 0; i < order.length; i += 3) {
    const responses = await Promise.allSettled(order.slice(i, i + 3).map(async no => {
      const url = meeting + '&RaceNo=' + no;
      return parseHongKongResult(await request('fetchDetail', url, progress, 'hkjc-result'), expected, url);
    }));
    const match = responses.find(response => response.status === 'fulfilled' && response.value);
    if (match) return match.value;
  }
  throw new Error('No matching HKJC results');
}

export async function loadHorseProfile(id, name, year, offline, onCached, expectedRevision) {
  const key = `horse.${year}-${id}`;
  const revision = await native('cacheRevision', year);
  if (expectedRevision !== undefined && revision !== expectedRevision) throw new Error('Horse cache was cleared');
  const scoped = await native('readDetail', key);
  const saved = JSON.parse(scoped || (revision === 0 ? await native('readDetail', 'horse.' + id) : '') || 'null');
  if (saved) onCached?.(saved);
  if (saved && (offline || saved.schema === 3 && Date.now() - Date.parse(saved.fetchedAt) < 86400000)) return { ...saved, fromCache: true };
  if (offline) throw new Error('Offline');
  const url = hkOrigin + '/zh-hk/local/information/horse?horseid=' + id;
  try {
    const doc = page(await native('fetchDetail', url));
    const profile = doc.querySelector('.horseProfile');
    if (!profile?.querySelector('.title_text')?.textContent.trim().startsWith(name + ' (')) throw new Error('Unexpected horse identity');
    const facts = new Map([...profile.querySelectorAll('tr')].filter(row => row.cells.length === 3 && row.cells[1].textContent.trim() === ':')
      .map(row => { const [label, , value] = cells(row); return [label, value]; }));
    const starts = [...doc.querySelectorAll('tr')].flatMap(row => {
      if (row.cells.length < 17) return [];
      const [raceNo, rank, date, course, distance, , grade, , , , jockey, margin, price, , , finishTime] = cells(row);
      const parts = date.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
      const link = row.cells[0].querySelector('a[href*="/localresults?"]');
      const overseas = raceNo === '海外';
      if (!parts || (!overseas && (!link || !/^\d+$/.test(raceNo)))) return [];
      const [, day, month, year] = parts;
      const source = link && new URL(link.getAttribute('href'), hkOrigin);
      const time = finishTime?.match(/^(\d+)[.:](\d{2})\.(\d+)$/);
      return [{ date: year + '-' + month + '-' + day, rank: Number(rank) || rank, course, distance, grade, jockey,
        odds: odds(price), margin: /^[-—]+$/.test(margin) ? undefined : margin, finishTime: time ? `${time[1]}:${time[2]}.${time[3]}` : undefined,
        overseas, url: source?.href, raceNo: source?.searchParams.get('RaceNo') }];
    }).sort((a, b) => b.date.localeCompare(a.date));
    const unique = new Map(starts.map(start => [start.date + ':' + normalized(start.course) + ':' + start.distance, start]));
    const data = { schema: 3, url, origin: facts.get('出生地'), sex: facts.get('毛色 / 性別'), sire: facts.get('父系'), dam: facts.get('母系'),
      damSire: facts.get('外祖父'), starts: [...unique.values()], fetchedAt: new Date().toISOString() };
    if (await native('saveDetail', { key, revision, json: JSON.stringify(data) }) === false) {
      throw new Error('Horse cache was cleared during retrieval');
    }
    return data;
  } catch (error) {
    if (saved) return { ...saved, stale: true };
    throw error;
  }
}

export async function loadRecentStarts(profile, runner, before, offline, onChange, onNetwork) {
  const starts = (profile.starts || runner.starts || []).filter(start => start.date < before).slice(0, 5).map(start => ({ ...start }));
  const pending = starts.filter(start => !start.name && (start.url || start.overseas));
  let updated = false;
  let failed = false;
  const worker = async () => {
    while (pending.length) {
      const start = pending.shift();
      try {
        const url = start.url && new URL(start.url);
        const venue = url?.searchParams.get('racecourse') || url?.searchParams.get('Racecourse') || 'ST';
        const id = start.overseas ? 'overseas-history-' + start.date + '-' + runner.horseId : 'hkjc-' + start.date + '-' + venue + '-' + start.raceNo;
        const key = 'race.' + id;
        let data = JSON.parse(await native('readDetail', key) || 'null');
        if (!data?.name || data.raceDate !== start.date) {
          if (offline) throw new Error('Offline');
          const revision = await native('cacheRevision', Number(start.date.slice(0, 4)));
          onNetwork?.();
          if (url) {
            url.pathname = '/zh-hk/local/information/archive/localresults';
            url.searchParams.delete('Racecourse');
            url.searchParams.set('racecourse', venue);
          }
          data = { ...await fetchRaceResult({id, date:start.date, name:start.name || start.course || start.date, country:start.overseas ? '' : 'HK', distance:start.distance,
            targetHorseName:runner.name, scheduleSource:start.overseas ? 'overseas-history' : 'hkjc', scheduleURL:url?.href}), raceDate:start.date };
          if (await native('saveDetail', {key, revision, json:JSON.stringify(data)}) === false) {
            throw new Error('Historical cache was cleared during retrieval');
          }
          updated = true;
        }
        const horse = data.runners.find(horse => horse.horseId === runner.horseId || horse.name === runner.name);
        if (!horse) throw new Error('Historical horse identity mismatch');
        Object.assign(start, {name:data.name, course:data.venue || start.course, jockey:horse.jockey || start.jockey,
          margin:horse.margin && horse.margin !== '—' ? horse.margin : start.margin, sourceURL:data.url});
      } catch { start.detailsMissing = true; failed = true; }
      onChange?.(starts);
    }
  };
  await Promise.all([worker(), worker()]);
  return { starts, updated, failed };
}

export function createDetails(offline) {
  const records = new Map();
  const requests = new Map();
  const invalidations = new Map();
  const sameDate = (race, record) => !record?.raceDate || record.raceDate === race.date;

  function attach(race, data) {
    if (data) records.set(race.id, data);
    const result = records.get(race.id);
    if (result && sameDate(race, result)) {
      race.realResult = result;
      race.sampleFinished = result.finished !== false;
      if (result.startAt) race.startAt = result.startAt;
      if (result.country) race.country = result.country;
      if (result.venue) race.place = [race.country, result.venue].filter(Boolean).join(' · ');
      if (result.name && (race.country === 'HK' || ['overseas-history', 'nar-history'].includes(race.scheduleSource))) {
        race.name = result.name;
        race.nameLang = race.country === 'HK' ? 'zh-Hant' : race.nameLang;
      }
    }
    return race;
  }

  function load(race, onChange, { reuseFinished = false, revision: expectedRevision } = {}) {
    const existing = requests.get(race.id);
    if (existing) {
      if (existing.date !== race.date) {
        return existing.promise.then(() => load(race, onChange, { reuseFinished, revision: expectedRevision }));
      }
      existing.watchers.set(race, onChange);
      if (!reuseFinished) existing.reuseFinished = false;
      existing.publish();
      return existing.promise;
    }
    const year = Number(race.date.slice(0, 4));
    const invalidation = invalidations.get(year);
    const watchers = new Map([[race, onChange]]);
    const request = {
      watchers, reuseFinished, date: race.date,
      publish() {
        for (const [target, notify] of watchers) {
          if (target !== race) Object.assign(target, race);
          notify();
        }
      }
    };
    request.promise = (async () => {
      const key = 'race.' + race.id;
      race.refreshState = 'checking';
      race.lookup = { startedAt: Date.now(), attempts: [], misses: [], hadData: Boolean(race.realResult) };
      request.publish();
      try {
        const revision = await native('cacheRevision', year);
        if (expectedRevision !== undefined && revision !== expectedRevision) return;
        const cached = JSON.parse(await native('readDetail', key) || 'null');
        const saved = sameDate(race, cached) ? cached : null;
        if (invalidations.get(year) !== invalidation) return;
        if (saved?.runners?.length) { attach(race, saved); race.lookup.hadData = true; request.publish(); }
        if (request.reuseFinished && saved?.runners?.length && saved.finished !== false) {
          race.refreshState = 'success';
          return;
        }
        if (offline) { race.refreshState = 'offline'; return; }
        if (!detailSupported(race)) { race.refreshState = 'unsupported'; return; }
        const details = await fetchRaceResult(race, step => {
          race.lookup.stage = step.stage;
          if (step.state === 'unmatched') race.lookup.misses.push(step);
          else if (step.state !== 'checking') race.lookup.attempts.push(step);
          request.publish();
        });
        if (!details?.runners?.length) {
          race.refreshState = 'unavailable';
          return;
        }
        const result = { ...details, raceDate: request.date };
        if (sameDate(race, race.realResult) && race.realResult?.runners?.length && race.realResult.finished !== false && result.finished === false) {
          race.refreshState = 'unavailable';
          return;
        }
        if (await native('saveDetail', { key, revision, json: JSON.stringify(result) }) === false) return;
        if (invalidations.get(year) !== invalidation) return;
        attach(race, result);
        race.refreshState = 'success';
      } catch (error) {
        race.refreshState = error.code === 'NO_DETAILS' ? 'unavailable' : 'failed';
        race.detailError = String(error.message || error);
        race.failureKind = error.code === 'PARSE_ERROR' ? 'format' : /timeout|timed out/i.test(race.detailError) ? 'timeout'
          : /SSL|TLS|secure connection|certificate/i.test(race.detailError) ? 'tls' : 'source';
      } finally {
        race.lookup.duration = Date.now() - race.lookup.startedAt;
        if (race.refreshState === 'checking') race.refreshState = 'unavailable';
        request.publish();
      }
    })().then(() => race.refreshState).finally(() => requests.delete(race.id));
    requests.set(race.id, request);
    return request.promise;
  }
  return {
    attach, load,
    async readCached(race) {
      if (!records.has(race.id) || !sameDate(race, records.get(race.id))) {
        const year = Number(race.date.slice(0, 4));
        const invalidation = invalidations.get(year);
        const saved = JSON.parse(await native('readDetail', 'race.' + race.id) || 'null');
        if (saved?.runners?.length && sameDate(race, saved) && invalidations.get(year) === invalidation) attach(race, saved);
      }
      return attach(race);
    },
    forgetYear(year) {
      invalidations.set(year, (invalidations.get(year) || 0) + 1);
      for (const [id, record] of records) {
        if (Number(record.raceDate?.slice(0, 4)) === year) records.delete(id);
      }
    }
  };
}

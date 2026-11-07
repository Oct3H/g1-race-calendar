import { native } from './desktop-bridge.mjs';
import { createIfhaRankings, parseIfhaFixtures } from './desktop-ifha.mjs';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const centralTracks = { SAPPORO: '札幌', HAKODATE: '函館', FUKUSHIMA: '福島', NIIGATA: '新潟', TOKYO: '東京', NAKAYAMA: '中山', CHUKYO: '中京', KYOTO: '京都', HANSHIN: '阪神', KOKURA: '小倉' };
// Japanese names from the verified JRA catalog. The key is the published JAIRS condition link's slug.
const centralNames = {
  february: 'フェブラリーステークス', takamatsunomiya: '高松宮記念', osaka: '大阪杯', oka: '桜花賞',
  satsuki: '皐月賞', 'tenno-spring': '天皇賞（春）', 'nhk-mile': 'NHKマイルカップ', victoria: 'ヴィクトリアマイル',
  oaks: '優駿牝馬', derby: '東京優駿', yasuda: '安田記念', takarazuka: '宝塚記念', sprinters: 'スプリンターズステークス',
  shuka: '秋華賞', kikuka: '菊花賞', 'tenno-autumn': '天皇賞（秋）', qe2: 'エリザベス女王杯', mcs: 'マイルチャンピオンシップ',
  jc: 'ジャパンカップ', champions: 'チャンピオンズカップ', juvenile: '阪神ジュベナイルフィリーズ',
  futurity: '朝日杯フューチュリティステークス', hopeful: 'ホープフルステークス', arima: '有馬記念'
};
const prioritySlugs = new Set(['oka', 'satsuki', 'oaks', 'derby', 'takarazuka', 'shuka', 'kikuka', 'arima']);
const countryCodes = { JPN: 'JP', ENG: 'GB', USA: 'US', GER: 'DE', AUS: 'AU', IRE: 'IE', CAN: 'CA', SAF: 'ZA', ARG: 'AR', BRZ: 'BR', CHI: 'CL', PER: 'PE', URU: 'UY', UAE: 'AE', KSA: 'SA' };
const centralDirectory = year => `https://japanracing.jp/en/racing/schedule/graded/list/${year}.html`;
const centralFixtures = year => `https://japanracing.jp/en/racing/schedule/jra/${year}.html`;
const localDirectory = year => `https://www.keiba.go.jp/dirtgraderace/${year}/racelist/index.html`;
const pad = value => String(value).padStart(2, '0');

function publishedDate(year, month, day) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('Invalid official race date');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function scheduleRace({ id, name, date, country = 'JP', grade = 'g1', surface, track, distance, source, url, ...extra }) {
  return {
    id, name, date, country, grade, surface,
    place: [country, track].filter(Boolean).join(' · '),
    course: distance || '—',
    region: country === 'JP' ? 'jp' : 'world',
    nameLang: country === 'JP' ? 'ja' : country === 'HK' ? 'zh-Hant' : 'en',
    venueTimeZone: country === 'JP' ? 'Asia/Tokyo' : undefined,
    scheduleSource: source, scheduleURL: url, ...extra
  };
}

function centralRace(year, date, sourceName, track, course, sourceURL, winnerPrize) {
  const url = new URL(sourceURL);
  const slug = url.pathname.match(new RegExp(`/list/${year}/[0-9]{4}([a-z][a-z0-9-]*)\\.html$`))?.[1];
  if (url.origin !== 'https://japanracing.jp' || !slug) throw new Error('Unexpected JRA race link');
  const surface = /\/Turf/i.test(course) ? 'turf' : /\/Dirt/i.test(course) ? 'dirt' : undefined;
  return scheduleRace({
    id: `jra-${year}-${slug}`, date, name: centralNames[slug] || sourceName,
    nameLang: centralNames[slug] ? 'ja' : 'en', track: centralTracks[track] || track, surface,
    distance: course, source: 'jra', url: url.href, priority: prioritySlugs.has(slug), winnerPrize, sourceEnglish: sourceName
  });
}

function centralIdentity(name, references) {
  const normalized = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const directory = Object.values(references).filter(row => row.source === 'japan');
  const full = directory.filter(row => normalized(name).includes(normalized(row.name)));
  const matches = full.length ? full : directory.filter(row => normalized(name).includes(normalized(row.name.split('(')[0])));
  const reference = matches.length === 1 ? matches[0] : undefined;
  return { slug: reference?.detail_url.match(/\/\d{4}([a-z][a-z0-9-]*)\.html$/)?.[1], sourceEnglish: reference?.name || name };
}

export function parseCentralFixtures(html, year, references) {
  const template = document.createElement('template');
  template.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const page = template.content;
  if (page.querySelector('h2.title02')?.textContent.trim() !== String(year)) throw new Error('Wrong JRA fixture year');
  const tracks = { sap: 'SAPPORO', hak: 'HAKODATE', fuk: 'FUKUSHIMA', nii: 'NIIGATA', tok: 'TOKYO',
    nak: 'NAKAYAMA', chu: 'CHUKYO', kyo: 'KYOTO', han: 'HANSHIN', kok: 'KOKURA' };
  const races = [];
  for (const [index, month] of months.entries()) {
    const panel = page.querySelector(`li#${month}`);
    if (!panel) throw new Error('Missing month in JRA fixtures');
    for (const fixture of panel.querySelectorAll('.calendarRaceName')) {
      const label = fixture.querySelector('.calendarRaceText')?.textContent.trim() || '';
      const track = fixture.querySelector('.calendarRaceIcon img')?.getAttribute('src')?.match(/\/rf_([a-z]+)\.png$/)?.[1];
      for (const match of label.matchAll(/([\s\S]*?)\s*\((J-)?G([123])\)/g)) {
        if (match[2] || match[3] !== '1') continue;
        const name = match[1].trim().replace(/\s+/g, ' ').replace(/\s*\(/g, ' (');
        const day = fixture.closest('td')?.querySelector('.dayNumber')?.textContent.trim();
        if (!name || !/^\d{1,2}$/.test(day || '')) throw new Error('Unrecognized JRA fixture');
        const date = publishedDate(year, index + 1, Number(day));
        const { slug, sourceEnglish } = centralIdentity(name, references);
        races.push(scheduleRace({ id: `jra-${year}-${slug || encodeURIComponent(name)}`, date,
          name: centralNames[slug] || name, nameLang: centralNames[slug] ? 'ja' : 'en',
          sourceEnglish, track: centralTracks[tracks[track]], source: 'jra', url: centralFixtures(year), priority: prioritySlugs.has(slug) }));
      }
    }
  }
  if (!races.length || new Set(races.map(race => race.id)).size !== races.length) throw new Error('Missing or duplicate JRA fixtures');
  return races;
}

export function parseSchedule(html, year, provider, url, references = {}) {
  const template = document.createElement('template');
  template.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const page = template.content;
  const races = [];
  if (provider === 'jra') {
    if (![...page.querySelectorAll('h2')].some(h => h.textContent.trim() === String(year))) throw new Error('Wrong JRA directory year');
    for (const row of page.querySelectorAll('tr')) {
      const [grade, track, course, , winnerPrize] = [...row.cells].map(cell => cell.textContent.trim());
      if (!/^G(?:1|I|Ⅰ)$/.test(grade)) continue;
      const heading = row.previousElementSibling?.querySelector('.tableScheduleWrap');
      const when = heading?.querySelector('.textBold')?.textContent.trim().match(/^([A-Z][a-z]{2,8})\.?\s*(\d{1,2})$/);
      const link = heading?.querySelector('a[href]');
      if (!when || !months.includes(when[1].slice(0, 3))) throw new Error('Unrecognized JRA schedule row');
      const date = publishedDate(year, months.indexOf(when[1].slice(0, 3)) + 1, Number(when[2]));
      if (link && new URL(link.getAttribute('href'), url).pathname.startsWith(`/en/racing/schedule/graded/list/${year}/`)) {
        races.push(centralRace(year, date, link.textContent.trim(), track, course, new URL(link.getAttribute('href'), url), winnerPrize));
      } else {
        const title = heading.cloneNode(true);
        title.querySelector('.textBold').remove();
        const name = title.textContent.trim();
        const { slug, sourceEnglish } = centralIdentity(name, references);
        races.push(scheduleRace({ id: `jra-${year}-${slug || encodeURIComponent(name)}`, date,
          name: centralNames[slug] || name, sourceEnglish, nameLang: centralNames[slug] ? 'ja' : 'en',
          track: centralTracks[track] || track, surface: /Turf/i.test(course) ? 'turf' : /Dirt/i.test(course) ? 'dirt' : undefined,
          distance: course, source: 'jra', url, winnerPrize, priority: prioritySlugs.has(slug) }));
      }
    }
  } else {
    const title = page.querySelector('title')?.textContent || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    if (!title.includes(`${year}年`)) throw new Error('Wrong NAR directory year');
    for (const card of page.querySelectorAll('li.js-item')) {
      const heading = card.querySelector('h4.g1, h4.jpn1');
      if (!heading) continue;
      const [dateLine, conditions] = [...card.querySelectorAll('p')].map(p => p.textContent.trim());
      const venue = conditions?.match(/^(\S+)\s+[左右](\d+)m/);
      const href = card.querySelector('a[href]')?.getAttribute('href');
      const link = href ? new URL(href, url) : null;
      if (link?.hostname === 'www.jra.go.jp' || (!link && Object.values(centralTracks).includes(venue?.[1]))) continue;
      if (link && (link.origin !== 'https://www.keiba.go.jp' || !link.pathname.startsWith(`/dirtgraderace/${year}/`) ||
        !/\/(racecard|introduction)\.html$/.test(link.pathname))) throw new Error('Unexpected NAR race link');
      const day = dateLine?.match(/^(\d+)月(\d+)日/);
      const name = heading.textContent.trim();
      if (!name || !day) throw new Error('Unrecognized NAR schedule row');
      const date = publishedDate(year, Number(day[1]), Number(day[2]));
      const time = conditions?.match(/(\d{1,2}:\d{2})発走/);
      races.push(scheduleRace({
        id: `nar-${year}-${encodeURIComponent(name)}`, date, name, track: venue?.[1], surface: 'dirt',
        grade: heading.classList.contains('jpn1') ? 'jpn1' : 'g1',
        distance: venue ? `${venue[2]}m` : undefined,
        startAt: time ? `${date}T${time[1].padStart(5, '0')}:00+09:00` : undefined,
        provisional: conditions?.includes('発走予定'), source: 'nar', url: link?.href || url
      }));
    }
  }
  if (!races.length || new Set(races.map(race => race.id)).size !== races.length) throw new Error('Missing or duplicate schedule records');
  return races;
}

async function archive(filename) {
  const response = await fetch(new URL(`./data/${filename}`, import.meta.url));
  if (!response.ok) throw new Error(`Missing bundled archive: ${filename}`);
  return response.json();
}

function archive2026(records) {
  return Object.values(records).map(record => {
    if (record.source === 'japan') {
      return centralRace(2026, record.date, record.name, record.course, record.distance_surface_raw, record.detail_url, record.winner_prize_raw);
    }
    const track = record.schedule_text_raw.match(/(\S+)\s+[左右]\d+m/)?.[1];
    return scheduleRace({
      id: `nar-2026-${encodeURIComponent(record.name)}`, date: record.date, name: record.name, track, surface: 'dirt',
      grade: record.grade === 'JpnI' ? 'jpn1' : 'g1', distance: record.distance_m ? `${record.distance_m}m` : undefined,
      startAt: record.scheduled_start_at, provisional: record.start_time_provisional, source: 'nar',
      url: record.detail_url || record.parent_url
    });
  });
}

function archive2025(records) {
  return records.filter(row => row.country === 'JPN' || row.rank != null).map(row => {
    const country = countryCodes[row.country] || row.country;
    const source = country !== 'JP' ? 'archive' : row.source_url.includes('keiba.go.jp') ? 'nar' : 'jra';
    return scheduleRace({
      id: row.id, date: row.date, name: row.name, track: row.track, country, grade: row.grade, surface: row.surface,
      distance: row.distance_m ? `${row.distance_m}m` : row.distance,
      source, url: row.source_url, priority: row.priority, rank: row.rank, sourceEnglish: row.canonical_name
    });
  });
}

export function restoreCentralMetadata(race, references) {
  if (race.sourceEnglish?.trim()) return race;
  const normalize = name => name.normalize('NFKC').replace(/\s+/g, '');
  const slug = race.scheduleURL?.match(/\/\d{4}([a-z][a-z0-9-]*)\.html$/)?.[1]
    || Object.entries(centralNames).find(([, name]) => normalize(name) === normalize(race.name))?.[0];
  const reference = Object.values(references).find(row => row.source === 'japan'
    && row.detail_url.match(/\/\d{4}([a-z][a-z0-9-]*)\.html$/)?.[1] === slug);
  return reference ? { ...race, sourceEnglish: reference.name } : race;
}

export async function createSchedule(offline) {
  const [research, history, international, local] = await Promise.all([
    archive('japan-schedule-2026.json'), archive('races-2025.json'), archive('ifha-schedule-2026.json'),
    archive('nar-schedule-2027.json')
  ]);
  const rankingsFor = createIfhaRankings(history);
  const years = new Map();
  const currentYear = new Date().getFullYear();
  const inFlight = new Map();
  const providersFor = year => {
    if (year < 2005 || year > currentYear + 2) return [];
    return ['jra', ...(year >= 2023 ? ['nar'] : []), ...(year >= 2010 ? ['ifha'] : [])];
  };
  const forYear = year => {
    if (!years.has(year)) years.set(year, { providers: {}, read: false });
    return years.get(year);
  };
  for (const [year, records] of [[2025, archive2025(history.races)], [2026, archive2026(research)]]) {
    const state = forYear(year);
    for (const provider of ['jra', 'nar']) {
      state.providers[provider] = { status: 'archive', races: records.filter(row => row.scheduleSource === provider) };
    }
    const overseas = records.filter(row => row.scheduleSource === 'archive');
    if (overseas.length) state.providers.ifha = { status: 'archive', races: overseas, rankingYear: 2025, rankingArchived: true };
  }
  forYear(local.year).providers.nar = {
    status: 'archive',
    races: local.races.map(row => scheduleRace({
      ...row, id: `nar-${local.year}-${encodeURIComponent(row.name)}`, surface: 'dirt', source: 'nar', url: local.source
    }))
  };
  const { fixtures, archivedAt, ...archiveStatus } = international;
  forYear(2026).providers.ifha = {
    ...archiveStatus, status: 'archive', archivedAt,
    matchedCount: fixtures.length,
    races: fixtures.map(row => scheduleRace({ ...row, country: countryCodes[row.country] || row.country, source: 'ifha' }))
  };

  function mergeRecords(old, incoming, provider) {
    const keyFor = race => provider === 'ifha' ? race.id : race.name.normalize('NFKC').replace(/\((オークス|日本ダービー)\)$/, '').replace(/\s+/g, '');
    const merged = new Map(old.map(race => [keyFor(race), race]));
    for (const race of incoming) {
      const key = keyFor(race);
      const prior = merged.get(key);
      merged.set(key, { ...prior, ...(prior?.date !== race.date && { startAt: undefined }), ...race, id: prior?.id || race.id });
    }
    return [...merged.values()];
  }

  function needsUpdate(previous, year, force) {
    if (force) return true;
    if (previous?.attemptedAt && Date.now() - previous.attemptedAt < 5 * 60_000) return false;
    const maxAge = year < currentYear ? 7 * 86400_000 : 6 * 3600_000;
    return !previous?.fetchedAt || Date.now() - Date.parse(previous.fetchedAt) >= maxAge;
  }

  async function updateProvider(state, year, provider, force) {
    const key = { year, provider };
    const previous = state.providers[provider];
    const prior = { ...previous, races: previous?.races ?? [], attemptedAt: Date.now() };
    try {
      const readCentral = async () => {
        let primaryError;
        try {
          const response = await native('fetchSchedule', key);
          if (response.status === 200) return parseSchedule(response.html, year, provider, response.url, research);
        } catch (error) {
          if (year < currentYear) throw error;
          primaryError = error;
        }
        if (year < currentYear) return null;
        const alternate = await native('fetchSchedule', { year, provider: 'jra-fixtures' });
        if (alternate.status === 200) return parseCentralFixtures(alternate.html, year, research);
        if (primaryError) throw primaryError;
        return null;
      };
      const [response, ranking] = await Promise.all([
        provider === 'jra' ? readCentral() : native('fetchSchedule', key),
        provider === 'ifha' ? rankingsFor(year, force) : null
      ]);
      if (!response || (!Array.isArray(response) && response.status !== 200)) {
        state.providers[provider] = { ...prior, status: year > currentYear ? 'unpublished' : 'failed' };
        return;
      }
      let parsed;
      let rankingStatus = {};
      if (ranking) {
        const { fixtures, rankingYear, rankingArchived, sourceRows, conflicts } = parseIfhaFixtures(response.html, year, response.url, ranking);
        parsed = fixtures.map(row => scheduleRace({ ...row, country: countryCodes[row.country] || row.country, source: 'ifha' }));
        rankingStatus = { rankingYear, rankingArchived, sourceRows, conflicts, matchedCount: parsed.length };
      } else if (Array.isArray(response)) {
        parsed = response;
      } else {
        parsed = parseSchedule(response.html, year, provider, response.url, research);
      }
      const snapshot = { races: mergeRecords(prior.races, parsed, provider), fetchedAt: new Date().toISOString(), ...rankingStatus };
      await native('saveSchedule', { ...key, json: JSON.stringify(snapshot) });
      state.providers[provider] = { ...snapshot, status: 'success', attemptedAt: prior.attemptedAt };
    } catch (error) {
      if (error.code === 'NO_FIXTURES' && year > currentYear) {
        state.providers[provider] = { ...prior, status: 'unpublished' };
        return;
      }
      state.providers[provider] = { ...prior, status: 'failed', error: String(error.message || error) };
      console.warn(`Schedule ${provider} ${year}:`, error.message);
    }
  }

  function collect(year, force, onChange, { localOnly = false } = {}) {
    const active = inFlight.get(year);
    if (active) {
      return force && !active.force
        ? active.request.then(() => collect(year, force, onChange, { localOnly }))
        : active.request;
    }
    const state = forYear(year);
    const providers = providersFor(year);
    const request = (async () => {
      if (!state.read) {
        await Promise.all(providers.map(async provider => {
          const json = await native('readSchedule', { year, provider });
          if (json) {
            const saved = JSON.parse(json);
            const records = provider === 'jra' ? saved.races.map(race => restoreCentralMetadata(race, research)) : saved.races;
            state.providers[provider] = { ...saved, races: mergeRecords(state.providers[provider]?.races || [], records, provider), status: 'success' };
          }
        }));
        state.read = true;
      }
      if (offline || localOnly || !providers.length) return;
      const due = providers.filter(provider => needsUpdate(state.providers[provider], year, force));
      if (!due.length) return;
      state.checking = true;
      onChange();
      await Promise.all(due.map(provider => updateProvider(state, year, provider, force)));
    })().finally(() => {
      inFlight.delete(year);
      state.checking = false;
      onChange();
    });
    inFlight.set(year, { request, force });
    return request;
  }

  return {
    collect,
    state(year) { return { ...forYear(year), providersExpected: providersFor(year) }; },
    races() {
      return [...years.values()].flatMap(year => Object.values(year.providers).flatMap(provider => provider.races));
    }
  };
}

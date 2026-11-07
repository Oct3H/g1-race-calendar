import { native } from './desktop-bridge.mjs';

const indexURL = 'https://www.ifhaonline.org/default.asp?section=Racing&area=1';
const rankingPath = '/resources/WTGradedRanking/LWGRank.asp';
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const countryAliases = { GB: 'ENG', US: 'USA', IE: 'IRE', AU: 'AUS', DE: 'GER', NZL: 'NZ' };
// These aliases reconcile the published 2025 names with the IFHA 2026 fixture names.
const currentAliases = {
  "Lamaro's Hotel Futurity Stakes": ['Henley Homes Futurity S.'],
  'All Star Mile Stakes': ['Sharp Eit The All-star Mile'],
  'Prix Ganay': ['Prix Ganay World Pool By PMU'],
  'Betfred Coronation Cup': ['Coolmore Coronation Cup'],
  'Prix Jean Prat': ['Haras de Fresnay-Le-Buffard Prix Jean Prat'],
  'Grand Prix de Saint-Cloud': ['Grand Prix de Saint-Cloud - World Pool By Pmu'],
  'Wettstar.de Grosser Preis von Baden': ['WETTSTAR.de - 156. Grosser Preis von Baden - V4/2'],
  "ARC Prix Maurice de Gheest - Fonds Europeen de l'Elevage": ['Arc Prix Maurice de Gheest - Fee - En Memoire de Louis Romanet'],
  'Qipco British Champions Fillies & Mares Stakes': ['Qatar Racing British Champions Fillies & Mares S.'],
  'Qipco British Champions Long Distance Cup': ['Qatar Racing British Champions Long Distance Cup'],
  'Qipco Champion Stakes': ['Qatar Racing Champion S.']
};

function documentFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return template.content;
}

function countryKey(country) {
  return countryAliases[country] || country;
}

function nameKey(name) {
  return name.normalize('NFKD').toLowerCase()
    .replace(/\((?:class|group)\s+\d+\)/g, '')
    .replace(/\bs\.(?=\s|$)/g, 'stakes')
    .replace(/&/g, 'and')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function parseRankingIndex(html) {
  return [...documentFragment(html).querySelectorAll('a[href]')].flatMap(link => {
    const label = link.textContent.trim();
    const year = label.match(/top\s+100\b.*\b(20\d{2})$/i)?.[1];
    if (!year) return [];
    const url = new URL(link.getAttribute('href'), indexURL);
    if (url.hostname !== 'www.ifhaonline.org') return [];
    const batch = Number(url.searchParams.get('batch'));
    if (url.pathname === rankingPath && Number.isInteger(batch) && batch > 0) return [{ year: Number(year), batch }];
    if (url.pathname.endsWith('.pdf')) return [{ year: Number(year), batch: null }];
    return [];
  });
}

function parseRankingTable(html, expectedYear) {
  const page = documentFragment(html);
  const title = [...page.querySelectorAll('strong')].find(node => /top\s+100\b/i.test(node.textContent));
  if (Number(title?.textContent.trim().match(/(20\d{2})$/)?.[1]) !== expectedYear) throw new Error('Wrong IFHA ranking year');
  const rows = [...page.querySelectorAll('#table0 tr')].map(row => [...row.cells].map(cell => cell.textContent.trim()));
  const entries = rows.filter(row => row.length === 11 && /^[0-9]+$/.test(row[0])).map(row => ({
    name: row[1], country: countryKey(row[7]), rank: Number(row[0])
  }));
  if (entries.length < 95 || entries.length > 110 || entries.some(row => !row.name || !/^[A-Z]{2,3}$/.test(row.country))) {
    throw new Error('Unexpected IFHA ranking table');
  }
  return entries;
}

export function createIfhaRankings(history) {
  const archive = history.races.filter(row => row.rank != null).map(row => ({
    name: row.ranking_name_2025 || row.name, rank: row.rank, country: countryKey(row.country), row
  }));
  const verified = new Map(archive.map(entry => [entry.country + ':' + nameKey(entry.name), entry.row]));
  let indexRequest;
  const tables = new Map();

  async function rankings(year, force) {
    try {
      if (!indexRequest || force) indexRequest = native('fetchRankingIndex').then(parseRankingIndex);
      const index = (await indexRequest).filter(item => item.year >= 2010);
      if (!index.length) throw new Error('IFHA ranking index is empty');
      const selected = index.find(item => item.year === year) ?? [...index].sort((a, b) => b.year - a.year)[0];
      if (!selected.batch) throw new Error('This IFHA ranking is only available as a PDF');
      if (!tables.has(selected.batch) || force) {
        const html = await native('fetchRankingTable', selected.batch);
        tables.set(selected.batch, parseRankingTable(html, selected.year));
      }
      const entries = tables.get(selected.batch).map(entry => ({
        ...entry, row: selected.year === 2025 ? verified.get(entry.country + ':' + nameKey(entry.name)) : undefined
      }));
      return { year: selected.year, entries, archived: false };
    } catch (error) {
      indexRequest = undefined;
      if (year < 2025) throw error;
      return { year: 2025, entries: archive, archived: true };
    }
  }
  return rankings;
}

export function parseIfhaFixtures(html, year, url, ranking) {
  const page = documentFragment(html);
  const rankedByAlias = new Map();
  for (const entry of ranking.entries) {
    if (entry.country === 'JPN') continue;
    const aliases = [entry.name, entry.row?.name, entry.row?.canonical_name, ...(entry.row?.aliases || []), ...(currentAliases[entry.name] || [])];
    for (const name of aliases.filter(Boolean)) {
      const alias = entry.country + ':' + nameKey(name);
      const prior = rankedByAlias.get(alias);
      rankedByAlias.set(alias, rankedByAlias.has(alias) && prior !== entry ? null : entry);
    }
  }

  const selected = new Map();
  const conflicts = new Set();
  let sourceRows = 0;
  for (const row of page.querySelectorAll('tr')) {
    if (row.cells.length !== 10 || row.cells[9].textContent.trim() !== 'G1') continue;
    const [, nameCell, , countryCell, trackCell, dateCell, distanceCell] = row.cells;
    const country = countryKey(countryCell.textContent.trim());
    const when = dateCell.textContent.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})$/);
    const link = nameCell.querySelector('a[href]');
    if (Number(when?.[3]) !== year || !link || !months.includes(when[2])) throw new Error('Wrong IFHA fixture year or date');
    sourceRows++;
    const name = link.textContent.trim();
    const match = rankedByAlias.get(country + ':' + nameKey(name));
    if (!match) continue;
    const raceURL = new URL(link.getAttribute('href'), url);
    const raceID = raceURL.searchParams.get('racepid') || '';
    if (raceURL.origin !== 'https://www.ifhaonline.org' || raceURL.pathname.toLowerCase() !== '/default.asp' ||
        raceURL.searchParams.get('area') !== '8' || !/^\d+$/.test(raceID)) throw new Error('Unexpected IFHA fixture link');
    const month = months.indexOf(when[2]) + 1;
    const day = Number(when[1]);
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) throw new Error('Invalid IFHA fixture date');
    const date = `${year}-${String(month).padStart(2, '0')}-${when[1].padStart(2, '0')}`;
    const id = year === 2025 && match.row ? match.row.id : `ifha-${year}-${country.toLowerCase()}-${nameKey(match.name)}`;
    if (conflicts.has(id)) continue;
    const previous = selected.get(id);
    if (previous && previous.url !== raceURL.href) {
      if (previous.date === date && previous.track === trackCell.textContent.trim()) continue;
      selected.delete(id);
      conflicts.add(id);
      continue;
    }
    const distance = distanceCell.textContent.trim();
    selected.set(id, {
      id, name: country === 'HK' && match.row ? match.row.name : name,
      nameLang: country === 'HK' && match.row ? 'zh-Hant' : 'en',
      country, date, distance, track: trackCell.textContent.trim(), url: raceURL.href,
      surface: { T: 'turf', D: 'dirt', A: 'synthetic' }[distance.match(/\(([TDA])\)/)?.[1]],
      rank: match.rank, priority: match.row?.priority ?? /breederscupclassic|prixdelarcdetriomphe/.test(nameKey(match.name))
    });
  }
  if (!sourceRows && [...page.querySelectorAll('tr > td[colspan]')].some(cell =>
    /^Sorry, no records have been found,/.test(cell.textContent.trim()))) {
    throw Object.assign(new Error('IFHA returned an empty fixture directory'), { code: 'NO_FIXTURES' });
  }
  if (!sourceRows || !selected.size) throw new Error('No matching IFHA fixtures');
  return { fixtures: [...selected.values()], sourceRows, conflicts: conflicts.size, rankingYear: ranking.year, rankingArchived: ranking.archived };
}

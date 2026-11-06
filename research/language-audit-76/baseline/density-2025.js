const calendar = document.getElementById('density-calendar');
const dialog = document.getElementById('date-dialog');
const query = new URLSearchParams(location.search);
let scope = query.get('scope') === 'all' ? 'all' : 'top100';
let month = Number(query.get('month'));
if (!Number.isInteger(month) || month < 1 || month > 12) month = 10;
let filter = ['jp', 'world'].includes(query.get('region')) ? query.get('region') : 'all';
let dataset;
let opener;
const englishMonths = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const countryInfo = {
  JPN: ['JP', '日本', 'jp'], USA: ['US', '美国', 'us'], HK: ['HK', '香港', 'hk'],
  UAE: ['UAE', '阿联酋', 'arab'], KSA: ['KSA', '沙特阿拉伯', 'arab'], ENG: ['GB', '英国', 'gb'],
  FR: ['FR', '法国', 'fr'], GER: ['DE', '德国', 'de'], AUS: ['AU', '澳大利亚', 'au'],
  IRE: ['IE', '爱尔兰', 'other'], CAN: ['CA', '加拿大', 'other'], NZ: ['NZ', '新西兰', 'other'],
  SAF: ['ZA', '南非', 'other'], ARG: ['AR', '阿根廷', 'other'], BRZ: ['BR', '巴西', 'other'],
  CHI: ['CL', '智利', 'other'], PER: ['PE', '秘鲁', 'other'], URU: ['UY', '乌拉圭', 'other']
};
const surfaceLabels = { turf: '芝', dirt: 'ダート', synthetic: 'AW' };
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function inScope(race, selectedScope = scope) {
  return selectedScope === 'all' || race.country === 'JPN' || race.rank != null;
}
function inRegion(race) {
  return filter === 'all' || (filter === 'jp' ? race.country === 'JPN' : race.country !== 'JPN');
}
function racesFor(selectedScope, selectedMonth) {
  return dataset.races.filter(race => inScope(race, selectedScope) && inRegion(race) && (!selectedMonth || Number(race.date.slice(5, 7)) === selectedMonth));
}
function compareImportance(a, b) {
  const priorityDifference = Number(Boolean(b.priority)) - Number(Boolean(a.priority));
  if (priorityDifference) return priorityDifference;
  const rankA = a.rank ?? Infinity;
  const rankB = b.rank ?? Infinity;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name, 'ja');
}
function surfaceBadge(surface) {
  const badge = element('span', 'surface-badge', surfaceLabels[surface] || '未确认');
  badge.dataset.surface = surface || 'unknown';
  badge.lang = 'ja';
  badge.setAttribute('aria-label', `场地：${badge.textContent}`);
  return badge;
}
function sourceLink(label, url) {
  const link = element('a', '', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}
function showRace(race, button) {
  opener = button;
  const country = countryInfo[race.country];
  dialog.dataset.colorRegion = country[2];
  document.getElementById('date-race-grade').textContent = race.grade === 'jpn1' ? 'JpnⅠ' : 'GⅠ';
  const badge = document.getElementById('date-race-surface');
  badge.textContent = surfaceLabels[race.surface] || '未确认';
  badge.dataset.surface = race.surface || 'unknown';
  document.getElementById('date-race-region').textContent = `${country[0]} · ${country[1]}`;
  const title = document.getElementById('date-race-title');
  title.textContent = race.name;
  title.lang = race.country === 'JPN' ? 'ja' : race.country === 'HK' ? 'zh-Hant' : 'en';
  document.getElementById('date-race-canonical').textContent = race.canonical_name !== race.name ? race.canonical_name : '';
  document.getElementById('date-race-date').textContent = race.date.replaceAll('-', ' / ');
  document.getElementById('date-race-track').textContent = race.track;
  document.getElementById('date-race-ranking').textContent = race.rank == null ? '未入榜' : `第 ${race.rank} 名`;
  document.getElementById('date-race-verification').textContent = race.verification_summary;
  const sources = document.getElementById('date-race-sources');
  sources.replaceChildren(sourceLink('日期资料来源 ↗', race.source_url));
  if (race.result_url) sources.append(sourceLink('官方比赛记录 ↗', race.result_url));
  if (race.rank != null) sources.append(sourceLink('2025 浪琴赛事榜 ↗', dataset.ranking_source.url));
  dialog.showModal();
  dialog.scrollTop = 0;
}
function raceCard(race) {
  const country = countryInfo[race.country];
  const button = element('button', `race-card ${race.country !== 'JPN' ? 'overseas-race' : ''}`);
  button.type = 'button';
  button.dataset.colorRegion = country[2];
  button.dataset.raceId = race.id;
  button.setAttribute('aria-label', `${race.name}，${country[1]}，查看日期与来源`);
  const top = element('span', 'card-top');
  top.append(element('span', 'grade-badge', race.grade === 'jpn1' ? 'JpnⅠ' : 'GⅠ'));
  const code = element('span', 'region-code', country[0]);
  code.lang = 'en';
  code.title = country[1];
  top.append(code, surfaceBadge(race.surface), element('span', 'card-arrow', '›'));
  const name = element('span', 'race-name', race.name);
  name.lang = race.country === 'JPN' ? 'ja' : race.country === 'HK' ? 'zh-Hant' : 'en';
  button.append(top, name);
  button.addEventListener('click', () => showRace(race, button));
  return button;
}
function renderMonthStrip() {
  const strip = document.getElementById('month-strip');
  strip.replaceChildren();
  const counts = Array.from({ length: 12 }, (_, index) => ({ a: racesFor('all', index + 1).length, b: racesFor('top100', index + 1).length }));
  const maximum = Math.max(1, ...counts.map(count => count.a));
  counts.forEach((count, index) => {
    const button = element('button');
    button.type = 'button';
    button.dataset.month = String(index + 1);
    button.setAttribute('aria-label', `${index + 1}月，A ${count.a}场，B ${count.b}场`);
    if (index + 1 === month) button.setAttribute('aria-current', 'page');
    button.append(element('span', '', `${index + 1} 月`));
    const numbers = element('div', 'month-counts');
    numbers.append(element('b', 'a', `A ${count.a}`), element('b', 'b', `B ${count.b}`));
    button.append(numbers);
    for (const key of ['a', 'b']) {
      const bar = element('span', `month-bar ${key}`);
      const fill = element('i');
      fill.style.width = `${100 * count[key] / maximum}%`;
      bar.append(fill);
      button.append(bar);
    }
    button.addEventListener('click', () => { month = index + 1; render(); });
    strip.append(button);
  });
}
function renderCalendar() {
  const byDate = new Map();
  dataset.races.filter(race => inScope(race) && inRegion(race)).forEach(race => {
    if (!byDate.has(race.date)) byDate.set(race.date, []);
    byDate.get(race.date).push(race);
  });
  calendar.replaceChildren();
  const offset = (new Date(Date.UTC(2025, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(2025, month, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  for (let index = 0; index < cellCount; index++) {
    const date = new Date(Date.UTC(2025, month - 1, 1 - offset + index));
    const key = date.toISOString().slice(0, 10);
    const outside = date.getUTCMonth() !== month - 1;
    const dayRaces = (byDate.get(key) || []).slice().sort(compareImportance);
    const cell = element('div', `day${outside ? ' outside' : ''}${dayRaces.length >= 3 ? ' busy' : ''}`);
    cell.dataset.date = key;
    cell.setAttribute('aria-label', `${date.getUTCMonth() + 1}月${date.getUTCDate()}日，${dayRaces.length}场`);
    cell.append(element('span', 'date', date.getUTCDate()));
    if (outside) cell.append(element('span', 'month-label', `${date.getUTCMonth() + 1}月`));
    if (dayRaces.length >= 3) cell.append(element('span', 'day-count', `${dayRaces.length} 场`));
    let folded;
    dayRaces.forEach((race, raceIndex) => {
      if (dayRaces.length >= 3 && raceIndex === 1) {
        folded = element('details', 'day-more');
        const summary = element('summary');
        summary.append(element('span', 'expand-label', `展开其余 ${dayRaces.length - 1} 场`), element('span', 'collapse-label', `收起其余 ${dayRaces.length - 1} 场`));
        folded.append(summary);
        cell.append(folded);
      }
      (folded || cell).append(raceCard(race));
    });
    calendar.append(cell);
  }
  calendar.setAttribute('aria-label', `2025年${month}月真实日期月历，${scope === 'all' ? '全部GⅠ' : '海外仅浪琴前百'}`);
  calendar.setAttribute('aria-busy', 'false');
}
function render() {
  const a = racesFor('all');
  const b = racesFor('top100');
  document.getElementById('scope-all-count').textContent = a.length;
  document.getElementById('scope-top-count').textContent = b.length;
  document.getElementById('scope-reduction').textContent = `B 比 A 少 ${a.length - b.length} 场 · 减少 ${a.length ? Math.round(100 * (a.length - b.length) / a.length) : 0}%`;
  const current = racesFor(scope, month);
  const dailyCounts = Object.values(current.reduce((counts, race) => { counts[race.date] = (counts[race.date] || 0) + 1; return counts; }, {}));
  document.getElementById('month-stat-label').textContent = `${month}月赛事`;
  document.getElementById('month-stat').textContent = `${current.length} 场`;
  document.getElementById('days-stat').textContent = `${dailyCounts.length} 天`;
  document.getElementById('peak-stat').textContent = `${Math.max(0, ...dailyCounts)} 场`;
  document.getElementById('fold-stat').textContent = `${dailyCounts.filter(count => count >= 3).length} 天`;
  document.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === scope)));
  document.querySelectorAll('[data-filter]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    button.classList.toggle('active', button.dataset.filter === filter);
  });
  document.getElementById('calendar-title').replaceChildren(document.createTextNode(String(month)), element('span', '', '月'));
  document.getElementById('english-month').textContent = englishMonths[month - 1];
  document.getElementById('selected-scope').textContent = scope === 'all' ? 'A · 全部 GⅠ' : 'B · 海外仅浪琴前百';
  document.getElementById('month-comparison').textContent = `本月 A ${racesFor('all', month).length} 场 / B ${racesFor('top100', month).length} 场`;
  document.getElementById('previous-month').disabled = month === 1;
  document.getElementById('next-month').disabled = month === 12;
  renderMonthStrip();
  renderCalendar();
  const url = new URL(location.href);
  url.searchParams.set('scope', scope);
  url.searchParams.set('month', month);
  if (filter !== 'all') url.searchParams.set('region', filter); else url.searchParams.delete('region');
  history.replaceState(null, '', url);
}
function renderCoverage() {
  document.getElementById('dataset-description').textContent = dataset.description;
  const body = document.getElementById('coverage-rows');
  for (const [country, info] of Object.entries(countryInfo)) {
    const all = dataset.races.filter(race => race.country === country);
    if (!all.length) continue;
    const row = element('tr');
    row.append(element('td', '', `${info[0]} · ${info[1]}`), element('td', '', all.length), element('td', '', all.filter(race => inScope(race, 'top100')).length));
    body.append(row);
  }
  dataset.notes.forEach(note => document.getElementById('dataset-notes').append(element('li', '', note)));
  dataset.sources.forEach(source => {
    const item = element('li');
    item.append(sourceLink(`${source.label} ↗`, source.url));
    document.getElementById('dataset-sources').append(item);
  });
}
document.querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => { scope = button.dataset.scope; render(); }));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
document.getElementById('previous-month').addEventListener('click', () => { if (month > 1) { month--; render(); } });
document.getElementById('next-month').addEventListener('click', () => { if (month < 12) { month++; render(); } });
document.getElementById('close-date-dialog').addEventListener('click', () => dialog.close());
document.getElementById('back-to-density').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
try {
  const response = await fetch('data/races-2025.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  dataset = await response.json();
  renderCoverage();
  render();
} catch (error) {
  const message = document.getElementById('density-error');
  message.textContent = '本地赛程资料未能读取，请刷新页面或检查预览服务。';
  message.hidden = false;
  calendar.setAttribute('aria-busy', 'false');
  console.error(error);
}

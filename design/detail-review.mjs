import { uiText } from './ui-language.mjs?v=76';
// Typography uses names from saved IFHA / Breeders’ Cup evidence; all participation,
// dates, odds and performances below remain fictional layout fixtures.
export function createDetailReviewRaces(createQualityRace) {
  const base = createQualityRace('partial-entries');
  return [
    { ...base, id: 'detail-long', country: 'GB', region: 'world', nameLang: 'en',
      name: 'Qipco British Champions Fillies & Mares Stakes',
      place: '英国 · 示例赛场', venueTimeZone: 'Europe/London', day: 29, startAt: null,
      subtitle: '长名称／缺项评审 · 非真实出走名单，日期与战绩均为虚构',
      sampleUnresolvedHistoryIndex: 0 },
    { ...base, id: 'detail-crossday', country: 'US', region: 'world', nameLang: 'en',
      name: 'Longines Breeders’ Cup Classic', place: '美国 · 示例赛场',
      venueTimeZone: 'America/New_York', startAt: '2026-10-31T03:30:00Z',
      subtitle: '跨日评审 · 示例赛场当地 10/30 23:30，并非真实发走时间' }
  ];
}

export function initDetailReview(search, document) {
  const params = new URLSearchParams(search);
  if (params.get('detailReview') !== 'preview') return;
  document.getElementById('detail-review-study').hidden = false;
  const cases = [
    ['长赛事名／缺项', 'detail-long'],
    ['长马名与血统', 'detail-long', '1'],
    ['历史详情尚未定位', 'detail-long', '1', '1'],
    ['跨日 · 北京', 'detail-crossday', null, null, 'Asia/Shanghai'],
    ['跨日 · 纽约', 'detail-crossday', null, null, 'America/New_York']
  ];
  const nav = document.getElementById('detail-review-links');
  nav.replaceChildren();
  for (const [label, race, horse, past, zone] of cases) {
    const query = new URLSearchParams(params);
    for (const key of ['horse', 'past', 'view', 'quality', 'game', 'odds', 'detailZone']) query.delete(key);
    query.set('entry', 'compact'); query.set('race', race); query.set('v', '71');
    if (horse) query.set('horse', horse);
    if (past) query.set('past', past);
    if (zone) query.set('detailZone', zone);
    const link = document.createElement('a');
    link.href = `index.html?${query}`;
    link.textContent = uiText(label);
    nav.append(link);
  }
}

export function renderHistoryResolution(unresolved, date, document) {
  document.getElementById('history-unresolved').hidden = !unresolved;
  document.getElementById('history-known-date').textContent = uiText("{0} · 本马战绩中的来源日期（虚构示例）", {0: date});
  for (const id of ['history-identifiers', 'history-facts', 'history-prizes', 'history-extra-facts', 'history-sample-note']) {
    document.getElementById(id).hidden = unresolved;
  }
}

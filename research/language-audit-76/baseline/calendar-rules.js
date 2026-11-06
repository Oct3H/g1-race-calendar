// 只为网页设计保存本轮核验的榜单子集；不是全部 GⅠ 赛事目录。
export const rankingSource = {
  year: 2025,
  checked: '2026-10-21',
  url: 'https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=10'
};

export const priorityRaceIds = new Set([
  'bcc', 'arc', 'satsuki', 'tokyo-yushun', 'kikuka',
  'oka', 'yushun-himba', 'shuka', 'takarazuka', 'arima'
]);

export const raceRanks = {
  'japan-cup': 1, champion: 1, bcc: 3, arc: 6, tenno: 8,
  arima: 10, satsuki: 10, 'tokyo-yushun': 24,
  cox: 32, takarazuka: 35, sprinters: 71
};

export function compareRaceImportance(a, b) {
  const priorityDifference = Number(priorityRaceIds.has(b.id)) - Number(priorityRaceIds.has(a.id));
  if (priorityDifference) return priorityDifference;
  const rankA = raceRanks[a.id] ?? Infinity;
  const rankB = raceRanks[b.id] ?? Infinity;
  if (rankA !== rankB) return rankA - rankB;
  const timeA = a.startAt ? Date.parse(a.startAt) : Infinity;
  const timeB = b.startAt ? Date.parse(b.startAt) : Infinity;
  if (timeA !== timeB) return timeA - timeB;
  return a.name.localeCompare(b.name, 'ja');
}

export function dateInZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(instant));
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

export function raceCalendarDate(race, timeZone) {
  // 仅有来源日期而没有具体时间时，不能推算跨日。
  return race.startAt ? dateInZone(race.startAt, timeZone) : { year: 2026, month: race.nextMonth ? 11 : 10, day: race.day };
}

export function clockInZone(instant, timeZone) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(instant));
}

// 按周一开始补齐整周；UTC 日期运算避免夏令时导致跨日误差。
export function calendarMonthDays(year, month) {
  const first = new Date(0);
  first.setUTCHours(0, 0, 0, 0);
  first.setUTCFullYear(year, month - 1, 1);
  const offset = (first.getUTCDay() + 6) % 7;
  const next = new Date(first);
  next.setUTCMonth(month);
  const length = Math.ceil((offset + (next - first) / 86400000) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(index - offset + 1);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  });
}

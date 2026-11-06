// Independent in-memory fixtures only; no network requests, persistence or real tickets.
import { createState, placeTicket, settleRace, markRead } from './game-state.mjs?v=58';

export function notificationRaces() {
  const base = { layoutDemo: true, region: 'world', nameLang: 'en', surface: 'turf',
    course: '芝 2,000m（架空）', venueTimeZone: 'Europe/Paris',
    source: '无（组合通知虚构示例）', subtitle: '组合通知评审 · 赛事、马匹与金额均为虚构',
    sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '官方单胜（虚构）' };
  return [
    { ...base, id: 'notify-correction', country: 'FR', name: 'Correction Stakes (Sample)', place: '法国 · 示例赛场', startAt: '2026-10-03T12:00:00Z' },
    { ...base, id: 'notify-result', country: 'JP', region: 'jp', nameLang: 'ja', name: '結果確認レース（架空）', place: '日本 · 示例赛场', venueTimeZone: 'Asia/Tokyo', startAt: '2026-10-11T06:00:00Z' },
    { ...base, id: 'notify-refund', country: 'US', name: 'Refund Stakes (Sample)', place: '美国 · 示例赛场', venueTimeZone: 'America/New_York', startAt: '2026-10-20T18:00:00Z' },
    { ...base, id: 'notify-failure', country: 'HK', nameLang: 'zh-Hant', name: '更新失敗演示（虛構）', place: '香港 · 示例赛场', venueTimeZone: 'Asia/Hong_Kong', startAt: '2026-10-30T07:00:00Z', sampleOddsAt: '2026-10-26T04:00:00Z' }
  ];
}

export function notificationState(races, horses, shortfall = false) {
  const state = createState();
  const add = (id, amount, odds) => {
    const race = races.find(item => item.id === id);
    placeTicket(state, { ...race, sampleFinished: false, sampleCancelled: false, sampleWithdrawnNumbers: [] },
      { ...horses(race)[0], odds }, amount, new Date(Date.parse(race.startAt) - 86400000), 'Asia/Shanghai');
  };
  add('notify-correction', 10000, '4.0');
  settleRace(state, 'notify-correction', 1);
  markRead(state, 'notify-correction');
  add('notify-result', shortfall ? 500000 : 10000, '3.2');
  add('notify-refund', 20000, '3.0');
  return state;
}

export function initNotificationReview(search, document, load) {
  if (new URLSearchParams(search).get('notifications') !== 'preview') return false;
  const section = document.getElementById('notification-study');
  section.hidden = false;
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-notification-case]');
    if (button) load(button.dataset.notificationCase);
  });
  return true;
}

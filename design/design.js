import { desktop, devText, native } from './desktop-bridge.mjs';
import { loadDesktopData, updateTime } from './desktop-data.mjs';
import { createCollection } from './desktop-collection.mjs';
import { configureCollectionStatus, configureLocalCache, renderLiveSource, renderLiveTable, renderLiveHorse } from './desktop-view.mjs';
import { uiText, uiAttr, uiList, registerUiNames } from './ui-language.mjs?v=76';
import { notificationRaces } from './notification-review.mjs?v=76';
import { createDetailReviewRaces, initDetailReview, renderHistoryResolution } from './detail-review.mjs?v=76';
import { rankingSource, priorityRaceIds, raceRanks, compareRaceImportance, dateInZone, raceCalendarDate, clockInZone, calendarMonthDays } from './calendar-rules.js?v=76';
import { createGamePreview } from './game-design.js?v=80';
import { applyPreviewRaceUpdate } from './race-change-state.mjs?v=76';
import { createQualityRace, qualityCaseFor, initQualityLinks, initQualityDialog, createAvailabilityRaces, initAvailabilityLinks } from './data-quality-preview.mjs?v=76';

function startCalendar(desktopData) {
if (desktop) document.body.dataset.desktop = 'dev';

// 本轮只有设计稿交互。以下内容是排版示例，不是已经核验的赛事数据。
const races = [
  { id: 'sprinters', startAt: '2026-10-04T06:40:00Z', venueTimeZone: 'Asia/Tokyo', sampleFinished: true, day: 4, region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 中山', name: 'スプリンターズS', subtitle: '短途马锦标 · Sprinters Stakes', surface: 'turf', course: '芝 1,200m', source: 'JRA / netkeiba' },
  { id: 'arc', startAt: '2026-10-04T15:05:00Z', venueTimeZone: 'Europe/Paris', sampleFinished: true, day: 4, region: 'world', country: 'FR', nameLang: 'en', place: '法国 · 巴黎隆尚', name: 'Prix de l’Arc de Triomphe', subtitle: '凯旋门大赛', surface: 'turf', course: '芝 2,400m', source: 'France Galop' },
  { id: 'dewhurst', startAt: '2026-10-10T14:00:00Z', venueTimeZone: 'Europe/London', sampleFinished: true, day: 10, region: 'world', country: 'GB', nameLang: 'en', place: '英国 · 纽马克特', name: 'Dewhurst Stakes', subtitle: '杜何斯特锦标', surface: 'turf', course: '芝 1,400m', source: '海外官方赛事网站' },
  { id: 'champion', startAt: '2026-10-17T14:30:00Z', venueTimeZone: 'Europe/London', sampleFinished: true, day: 17, region: 'world', country: 'GB', nameLang: 'en', place: '英国 · 雅士谷', name: 'Champion Stakes', subtitle: '英国冠军锦标', surface: 'turf', course: '芝 2,000m', source: '海外官方赛事网站' },
  { id: 'shuka', startAt: '2026-10-18T06:40:00Z', venueTimeZone: 'Asia/Tokyo', sampleFinished: true, day: 18, region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 京都', name: '秋華賞', subtitle: '秋华赏 · Shuka Sho', surface: 'turf', course: '芝 2,000m', source: 'JRA / netkeiba' },
  { id: 'cox', startAt: '2026-10-24T06:00:00Z', venueTimeZone: 'Australia/Melbourne', day: 24, region: 'world', country: 'AU', nameLang: 'en', place: '澳大利亚 · 示例场地', name: 'Cox Plate', subtitle: '觉士盾', surface: 'turf', course: '芝 2,040m', source: '海外官方赛事网站' },
  { id: 'kikuka', startAt: '2026-10-25T06:40:00Z', venueTimeZone: 'Asia/Tokyo', day: 25, region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 京都', name: '菊花賞', subtitle: '菊花赏 · Kikuka Sho', surface: 'turf', course: '芝 3,000m', source: 'JRA / netkeiba' },
  { id: 'derby', startAt: '2026-10-31T06:10:00Z', venueTimeZone: 'Australia/Melbourne', day: 31, region: 'world', country: 'AU', nameLang: 'en', place: '澳大利亚 · 弗莱明顿', name: 'Victoria Derby', subtitle: '维多利亚打吡', surface: 'turf', course: '芝 2,500m', source: '海外官方赛事网站' },
  { id: 'tenno', startAt: '2026-11-01T06:40:00Z', venueTimeZone: 'Asia/Tokyo', day: 1, nextMonth: true, region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 东京', name: '天皇賞（秋）', subtitle: '天皇赏（秋） · Tenno Sho (Autumn)', surface: 'turf', course: '芝 2,000m', source: 'JRA / netkeiba' }
];

// 两条虚构记录只用于展示同日三场的折叠与多语言排版，不代表真实赛事。
races.push(
  { id: 'layout-demo-jp', day: 17, region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 示例赛场', name: 'デザイン用レース', subtitle: '虚构赛事，仅用于折叠交互示例', grade: 'jpn1', surface: 'dirt', course: 'ダート 1,800m（架空）', source: '无（虚构排版示例）', layoutDemo: true },
  { id: 'layout-demo-hk', day: 17, region: 'world', country: 'HK', nameLang: 'zh-Hant', place: '香港 · 示例赛场', name: '香港賽事示例', subtitle: '虚构赛事，仅用于繁体名称与折叠交互示例', surface: 'turf', course: '芝 2,000m（虛構）', source: '无（虚构排版示例）', layoutDemo: true }
);
const countryColors = { JP: 'jp', US: 'us', HK: 'hk', AE: 'arab', SA: 'arab', GB: 'gb', FR: 'fr', DE: 'de', AU: 'au' };
const regionCodes = { AE: 'UAE', SA: 'KSA' };
const importanceSamples = [
  { id: 'champion', name: 'Champion Stakes' },
  { id: 'japan-cup', name: 'ジャパンカップ' },
  { id: 'bcc', name: 'Breeders’ Cup Classic' },
  { id: 'arc', name: 'Prix de l’Arc de Triomphe' },
  { id: 'satsuki', name: '皐月賞' },
  { id: 'tokyo-yushun', name: '東京優駿' },
  { id: 'kikuka', name: '菊花賞' },
  { id: 'oka', name: '桜花賞' },
  { id: 'yushun-himba', name: '優駿牝馬' },
  { id: 'shuka', name: '秋華賞' },
  { id: 'takarazuka', name: '宝塚記念' },
  { id: 'arima', name: '有馬記念' }
];
// 金额为虚构排版样例，不代表各场比赛实际赏金。
const samplePurses = {
  JP: { amount: 300000000, winnerAmount: 180000000, bonusAmount: 3000000, winnerBonus: 2000000, currency: 'JPY' },
  FR: { amount: 5000000, winnerAmount: 2700000, currency: 'EUR' },
  GB: { amount: 1500000, winnerAmount: null, currency: 'GBP' },
  AU: { amount: 5000000, winnerAmount: 3000000, currency: 'AUD' }
};
let computerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let displayTimeZone = computerTimeZone;
let zonePreview = 'auto';
const previewParams = new URLSearchParams(window.location.search);
const detailReview = previewParams.get('detailReview') === 'preview';
if (detailReview) {
  races.push(...createDetailReviewRaces(createQualityRace));
  const zone = previewParams.get('detailZone');
  if (['Asia/Shanghai', 'America/New_York'].includes(zone)) { displayTimeZone = zone; zonePreview = zone; }
}
if (previewParams.get('notifications') === 'preview') races.push(...notificationRaces());
function calendarUi(zh, en, ja = zh) {
  return previewParams.get('lang') === 'en' ? en : previewParams.get('lang') === 'ja' ? ja : zh;
}
const dailyCalendar = previewParams.get('preview') === 'calendar';
// 普通主日历也显示本轮评审样例，避免用户停留在旧链接时看不到新增内容。
const changePreview = dailyCalendar && previewParams.get('changes') !== '0';
if (changePreview) races.push(
  { id: 'change-postponed', startAt: '2026-10-28T06:00:00Z', venueTimeZone: 'Asia/Tokyo', region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 示例赛场', name: '日程変更デモ（架空）', subtitle: '改期排版示例，不代表真实赛事', surface: 'turf', course: '芝 2,000m（架空）', source: '无（虚构变更记录）', layoutDemo: true, sampleChange: { kind: 'postponed', previousStartAt: '2026-10-24T06:00:00Z', updatedAt: '2026-10-22T01:30:00Z' } },
  { id: 'change-cancelled', startAt: '2026-10-24T15:00:00Z', venueTimeZone: 'America/New_York', region: 'world', country: 'US', nameLang: 'en', place: '美国 · 示例赛场', name: 'Cancelled Stakes (Sample)', subtitle: '取消排版示例，不代表真实赛事', surface: 'dirt', course: 'ダート 1,800m（架空）', source: '无（虚构变更记录）', layoutDemo: true, sampleCancelled: true, sampleChange: { kind: 'cancelled', updatedAt: '2026-10-22T01:30:00Z' } },
  { id: 'change-withdrawn', startAt: '2026-10-25T08:00:00Z', venueTimeZone: 'Asia/Hong_Kong', region: 'world', country: 'HK', nameLang: 'zh-Hant', place: '香港 · 示例赛场', name: '退賽演示（虛構）', subtitle: '马匹退赛排版示例，不代表真实赛事', surface: 'turf', course: '芝 2,000m（虛構）', source: '无（虚构变更记录）', layoutDemo: true, sampleWithdrawnNumbers: [2], sampleChange: { kind: 'withdrawn', updatedAt: '2026-10-22T01:30:00Z' } }
);
// 这些仅为界面资格样例，并不表示已经获取到真实名单或官方报价。
for (const race of races.filter(race => ['cox', 'tenno', 'change-postponed', 'change-withdrawn'].includes(race.id))) {
  Object.assign(race, { sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '官方单胜来源（虚构演示）', sampleOddsAt: '2026-10-20T04:00:00Z' });
}
races.find(race => race.id === 'derby').sampleEntriesConfirmed = true;
if (changePreview) races.push({ id: 'update-demo', startAt: '2026-10-29T06:00:00Z', venueTimeZone: 'Asia/Tokyo', region: 'jp', country: 'JP', nameLang: 'ja', place: '日本 · 示例赛场 A', name: '更新ルール確認（架空）', subtitle: '首次公布与再次变更的虚构演示', surface: 'turf', distance: 2000, course: '芝 2,000m（架空）', source: '无（虚构更新演示）', layoutDemo: true });
const qualityPreviewKey = previewParams.get('quality');
const qualityRace = qualityPreviewKey ? createQualityRace(qualityPreviewKey) : null;
if (qualityRace) races.push(qualityRace);
const availabilityPreview = previewParams.get('availability');
if (['preview', 'complete'].includes(availabilityPreview)) races.push(...createAvailabilityRaces(new Date(), availabilityPreview === 'complete'));
if (desktopData) {
  syncDesktopRaces();
  if (previewParams.get('page') === 'cache') {
    document.getElementById('calendar-view').hidden = true;
    document.getElementById('cache-view').hidden = false;
  }
}
const currentDate = dateInZone(new Date(), displayTimeZone);
const queryYear = Number(previewParams.get('year'));
const queryMonth = Number(previewParams.get('month'));
let calendarYear = dailyCalendar ? (Number.isInteger(queryYear) && queryYear >= 1 && queryYear <= 9999 ? queryYear : currentDate.year) : 2026;
let calendarMonth = dailyCalendar ? (Number.isInteger(queryMonth) && queryMonth >= 1 && queryMonth <= 12 ? queryMonth : currentDate.month) : 10;
const regionGroups = [['jp', 'JP', '日本'], ['us', 'US', '美国'], ['hk', 'HK', '香港'], ['arab', 'UAE / KSA', '阿拉伯国家'], ['gb', 'GB', '英国'], ['fr', 'FR', '法国'], ['de', 'DE', '德国'], ['au', 'AU', '澳大利亚'], ['other', 'IE 等', '其他地区']].map(([key, code, label], index) => [key, key === 'other' ? calendarUi(code, 'IE / Other', 'IE その他') : code, calendarUi(label, ['Japan','United States','Hong Kong','Arab countries','Great Britain','France','Germany','Australia','Other regions'][index], ['日本','米国','香港','アラブ諸国','英国','フランス','ドイツ','オーストラリア','その他'][index])]);
let selectedRegions = new Set(regionGroups.map(([key]) => key));
const englishMonths = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

// 两种版式共用同一批虚构数据；姓名并非真实出走名单。
const sampleHorseNames = {
  ja: ['ハルノスピカ', 'ミントステップ', 'アオゾラノユメ', 'トワイライトベル', 'スノーリボン', 'サクラミーティア', 'ルミナスリーフ', 'オータムスター'],
  'zh-Hant': ['青空之夢', '晨曦星光', '銀河之躍', '月下微風', '碧綠之翼', '秋日流星', '星河飛舞', '晴空信號'],
  en: ['Mint Aurora', 'Silver Circuit', 'Moonlight Step', 'Spring Signal', 'Scarlet Echo', 'Amber Horizon', 'Velvet Orbit', 'Autumn Beacon']
};
if (detailReview) sampleHorseNames.en[0] = "My Kid's Said No";
const sampleEntries = [
  { number: 1, draw: 5, form: [1, 2, 1, 3, 6], pastOdds: ["3.8", "4.6", "2.9", null, "8.5"], odds: '3.2' },
  { number: 2, draw: 2, form: [2, 1, 3, 1, 2], pastOdds: ["4.9", "5.7", "4.0", null, "9.6"], odds: '4.8' },
  { number: 3, draw: 8, form: [4, 2, 2, 5, 1], pastOdds: ["6.0", "6.8", "5.1", null, "10.7"], odds: '6.5' },
  { number: 4, draw: 1, form: [3, 5, 1, 4, 2], pastOdds: ["7.1", "7.9", "6.2", null, "11.8"], odds: '8.1' },
  { number: 5, draw: 7, form: [1, 4, 6, 2, 3], pastOdds: ["8.2", "9.0", "7.3", null, "12.9"], odds: '10.4' },
  { number: 6, draw: 4, form: [6, 3, 2, 4, 1], pastOdds: ["9.3", "10.1", "8.4", null, "14.0"], odds: '14.2' },
  { number: 7, draw: 6, form: [2, 2, 4, 1, 5], pastOdds: ["10.4", "11.2", "9.5", null, "15.1"], odds: '19.6' },
  { number: 8, draw: 3, form: [5, 1, 3, 6, 2], pastOdds: ["11.5", "12.3", "10.6", null, "16.2"], odds: '28.0' }
];
// 马号按虚构的本场名次排列；与近五场战绩分开。
const sampleFinishOrder = [2, 1, 4, 6, 3, 5, 8, 7];
// 着差按名次给出虚构样例；冠军不用填写，第七名演示资料缺失。
const sampleFinishMargins = {
  ja: [null, 'クビ', '1/2', '1', 'アタマ', '1 1/4', null, 'ハナ'],
  'zh-Hant': [null, '頸位', '1/2', '1', '短頭', '1 1/4', null, '鼻位'],
  en: [null, 'Neck', '1/2 L', '1 L', 'Head', '1 1/4 L', null, 'Nose']
};
const samplePastRaces = {
  ja: ['オータムトライアル（架空）', 'サマーカップ（架空）', 'グリーンステークス（架空）', 'スプリング賞（架空）', 'スター特別（架空）'],
  'zh-Hant': ['秋日挑戰賽（虛構）', '夏日盃（虛構）', '綠茵錦標（虛構）', '春日錦標（虛構）', '星光特別賽（虛構）'],
  en: ['Autumn Trial (Sample)', 'Summer Cup (Sample)', 'Green Stakes (Sample)', 'Spring Stakes (Sample)', 'Star Trophy (Sample)']
};
const samplePastRaceDetails = [
  { grade: 'g2', date: '2026-09-01', surface: 'turf', course: '芝 2,000m' },
  { grade: 'g1', date: '2026-08-01', surface: 'turf', course: '芝 1,800m' },
  { grade: 'g3', date: '2026-07-01', surface: 'turf', course: '芝 2,000m' },
  { grade: 'g2', date: '2026-06-01', surface: 'turf', course: '芝 1,800m' },
  { grade: 'g3', date: '2026-05-01', surface: 'dirt', course: 'ダート 1,800m' }
];
registerUiNames([...races.flatMap(race => [race.name, race.course]), ...samplePastRaceDetails.map(race => race.course), ...importanceSamples.map(race => race.name), ...Object.values(sampleHorseNames).flat(), ...Object.values(samplePastRaces).flat()]);
const gradeLabels = { g1: 'GⅠ', g2: 'GⅡ', g3: 'GⅢ', jpn1: 'JpnⅠ' };
const surfaceLabels = { turf: '芝', dirt: 'ダート', synthetic: 'AW' };

function setSurfaceBadge(element, surface) {
  element.textContent = uiText(surfaceLabels[surface] || '未确认');
  element.dataset.surface = surface || 'unknown';
  element.lang = 'ja';
  element.setAttribute('aria-label', uiText("场地：{0}", {0: element.textContent}));
}

function finishTier(position) {
  return position === 1 ? 'win' : position <= 5 ? 'placed' : 'other';
}

const calendar = document.getElementById('calendar');
const dialog = document.getElementById('race-dialog');
const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
let activeFilter = 'all';
let opener = null;
let activeRace = null;
let entryView = 'compact';
let raceView = 'entries';
let oddsRefreshFailed = previewParams.get('quote') === 'failed';
let horseOpener = null;
let entryScrollTop = 0;
let historyOpener = null;
let horseScrollTop = 0;
let gamePreview = null;
let refreshCalendarPreview = null;
let loadCalendarMonth = null;
let collection;
let refreshDesktopResult = null;

function sampleOddsLabel(value) {
  return value == null ? '—' : `${value} 倍`;
}

function renderEntries(race) {
  const quality = race.sampleQuality ? qualityCaseFor(race) : null;
  const language = race.country === 'JP' ? 'ja' : race.country === 'HK' ? 'zh-Hant' : 'en';
  const isJapan = race.country === 'JP';
  const rows = document.getElementById('entry-rows');
  rows.replaceChildren();
  if (quality?.empty) return;
  document.getElementById('draw-column').textContent = uiText(isJapan ? '枠' : '档位');
  document.getElementById('draw-explainer').textContent = uiText(isJapan ? '日本示例 · 枠色示意' : '海外示例 · 档位与马号分别展示');
  const winners = race.sampleWinnerNumbers || (race.sampleWinnerNumber ? [race.sampleWinnerNumber] : []);
  const finishOrder = (winners.length
    ? [...winners, ...sampleFinishOrder.filter(number => !winners.includes(number))]
    : sampleFinishOrder).filter(number => !race.sampleWithdrawnNumbers?.includes(number));
  const orderedEntries = quality?.officialResult && raceView === 'results' ? sampleEntries : raceView === 'results'
    ? [...finishOrder.map(number => sampleEntries.find(entry => entry.number === number)), ...sampleEntries.filter(entry => race.sampleWithdrawnNumbers?.includes(entry.number))]
    : sampleEntries;
  orderedEntries.forEach(entry => {
    const index = sampleEntries.indexOf(entry);
    const withdrawn = race.sampleWithdrawnNumbers?.includes(entry.number);
    const position = quality?.officialResult ? entry.number === 1 ? 1 : null : winners.includes(entry.number) ? 1 : finishOrder.indexOf(entry.number) + 1;
    const margin = position === 1 ? '—' : quality?.officialResult ? '暂无' : sampleFinishMargins[language][position - 1] || '暂无';
    const letter = String.fromCharCode(65 + index);
    const jockey = quality?.missingJockeys?.includes(entry.number) ? '暂无资料' : language === 'ja' ? `騎手 ${letter}` : language === 'zh-Hant' ? `騎師 ${letter}` : `Sample Jockey ${letter}`;
    const trainer = language === 'ja' ? `厩舎 ${letter}` : language === 'zh-Hant' ? `練馬師 ${letter}` : `Sample Trainer ${letter}`;
    const sexAge = language === 'ja' ? '牝3' : language === 'zh-Hant' ? '雌3' : 'F3';
    const row = document.createElement('tr');
    row.dataset.finish = position === null ? 'unknown' : finishTier(position);
    const positionLabel = position === null ? ["<span class=\"result-position result-position-unknown\">", uiText("待确认", null), "</span>"].join('') : ["<span class=\"form-position result-position form-", String(finishTier(position)), "\">", uiText(position), "<small>", uiText("着", null), "</small></span>"].join('');
    const odds = quality?.missingOdds?.includes(entry.number) ? null : entry.odds;
    row.innerHTML = ["<td class=\"result-only\">", uiText(positionLabel), "</td><td class=\"draw-cell entry-only\"><span class=\"", String(isJapan ? `frame-number frame-${entry.number}` : 'draw-number'), "\">", uiText(isJapan ? entry.number : entry.draw), "</span></td><td class=\"horse-number\">", uiText(entry.number), "</td><th scope=\"row\" class=\"horse-name-cell\" lang=\"", String(language), "\"><button class=\"horse-name-button\" type=\"button\" data-horse-number=\"", String(entry.number), "\" aria-label=\"", uiAttr("{6}，查看马匹示例资料", {6: sampleHorseNames[language][index]}), "\">", String(sampleHorseNames[language][index]), " <span aria-hidden=\"true\">›</span></button></th><td class=\"sex-age entry-only\">", uiText(sexAge), "</td><td class=\"carried-weight entry-only\">55.0</td><td class=\"jockey-name\" lang=\"", String(language), "\">", uiText(jockey), "</td><td class=\"detail-only trainer-name\" lang=\"", String(language), "\">", uiText(trainer), "</td><td class=\"detail-only recent-form\">", uiText(entry.form.slice(0, 3).map(position => ["<span class=\"form-position form-", String(finishTier(position)), "\">", uiText(position), "</span>"].join('')).join('')), "</td><td class=\"odds-column odds-value entry-only\">", uiText(sampleOddsLabel(odds)), "</td><td class=\"result-only result-margin\" lang=\"", String(language), "\">", uiText(margin), "</td>"].join('');
    const horseButton = row.querySelector('.horse-name-button');
    if (winners.length > 1 && winners.includes(entry.number)) {
      const badge = document.createElement('span'); badge.className = 'dead-heat-label'; badge.textContent = uiText('同着');
      row.querySelector('.result-position').after(badge);
    }
    const revised = race.sampleRunners?.find(runner => runner.id === `horse-${entry.number}`);
    if (revised) {
      row.querySelector('.horse-number').textContent = uiText(revised.number);
      row.querySelector('.jockey-name').textContent = uiText(revised.jockey);
      row.querySelector('.carried-weight').textContent = uiText(Number(revised.weight).toFixed(1));
    }
    if (withdrawn) {
      row.classList.add('runner-withdrawn');
      row.dataset.finish = 'withdrawn';
      row.querySelector('.result-position').textContent = uiText('退赛');
      row.querySelector('.odds-value').textContent = uiText('—');
      row.querySelector('.result-margin').textContent = uiText('—');
      const badge = document.createElement('span');
      badge.className = 'withdrawn-label';
      badge.textContent = uiText('退赛');
      horseButton.after(badge);
    }
    horseButton.addEventListener('click', () => showHorse(index, horseButton));
    rows.append(row);
  });
}

function isLiveRace(race) {
  return Boolean(desktopData && (race === desktopData.race || race?.scheduleSource));
}

function setEntryView(view) {
  entryView = view;
  dialog.dataset.entryView = view;
  document.querySelectorAll('[data-entry-view-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.entryViewOption === view));
  });
  if (isLiveRace(activeRace)) {
    renderLiveTable(activeRace, raceView, finishTier, (runner, button) => {
      horseOpener = button;
      entryScrollTop = dialog.scrollTop;
      renderLiveHorse(activeRace, runner, desktopData.offline, finishTier, showRace);
    });
    return;
  }
  document.getElementById('entry-view-description').textContent = uiText(raceView === 'results'
    ? '已结束赛事默认显示赛果 · 按名次排序，点击马名查看资料。'
    : view === 'compact'
    ? '默认简洁版 · 点击马名查看战绩；稳定取得赔率时，增加单胜赔率一列。'
    : '详细版 · 同一名单补充练马师、近期战绩与示例赔率。');
  const url = new URL(window.location.href);
  url.searchParams.set('entry', view);
  url.searchParams.set('race', activeRace.id);
  window.history.replaceState(null, '', url);
}

function setRaceView(view) {
  raceView = view === 'results' && activeRace.sampleFinished && !activeRace.sampleCancelled ? 'results' : 'entries';
  dialog.dataset.raceView = raceView;
  document.querySelectorAll('[data-race-view-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.raceViewOption === raceView));
    button.disabled = button.dataset.raceViewOption === 'results' && (!activeRace.sampleFinished || activeRace.sampleCancelled);
    if (isLiveRace(activeRace)) {
      button.title = button.disabled ? devText('暂无赛果资料', 'Results unavailable', '結果は未取得') : '';
      return;
    }
    button.title = uiText(button.disabled ? activeRace.sampleCancelled ? '赛事已取消，没有本场赛果（示例）' : '赛果待公布（示例）' : '');
  });
  if (isLiveRace(activeRace)) {
    document.getElementById('race-table-title').textContent = uiText(raceView === 'results' ? '赛果' : '出马表');
    document.getElementById('race-table-subtitle').textContent = '';
    document.querySelector('#race-panel .entry-table-scroll').setAttribute('aria-label', document.getElementById('race-table-title').textContent);
    setEntryView(entryView);
    return;
  }
  document.getElementById('race-table-title').textContent = uiText(raceView === 'results' ? '赛果' : '出马表');
  document.getElementById('race-table-subtitle').textContent = uiText(raceView === 'results' ? 'RESULT' : '出走表');
  document.getElementById('race-table-caption').textContent = uiText(raceView === 'results' ? '虚构示例赛果；点击马名查看示例资料' : '虚构示例出马表；点击马名查看示例资料');
  document.querySelector('#race-panel .entry-table-scroll').setAttribute('aria-label', uiText(raceView === 'results' ? '示例赛果，可左右滚动' : '示例出马表，可左右滚动'));
  renderEntries(activeRace);
  renderDataQuality(activeRace);
  if (raceView === 'results') document.getElementById('draw-explainer').textContent = uiText(activeRace.sampleQuality && qualityCaseFor(activeRace).officialResult ? '冠军在前 · 其余按马号列出，名次待确认' : '按名次排序 · 着差为虚构示例');
  setEntryView(entryView);
  const url = new URL(window.location.href);
  url.searchParams.set('view', raceView);
  window.history.replaceState(null, '', url);
}

function setOddsPreview(available) {
  document.getElementById('odds-preview').checked = available;
  dialog.dataset.odds = available ? 'available' : 'unavailable';
  const status = document.getElementById('odds-status');
  const offline = document.getElementById('calendar-demo-network')?.value === 'offline' || navigator.onLine === false;
  status.dataset.state = oddsRefreshFailed || offline ? 'failed' : 'normal';
  if (offline) {
    status.textContent = uiText(available
      ? '当前离线 · 显示上一次成功刷新的赔率。上次成功时间：2026.10.20 12:00（示例）；来源：虚构数据。'
      : '当前离线 · 没有上一次成功的赔率记录，暂无数据。');
  } else if (oddsRefreshFailed) {
    status.textContent = uiText(available
      ? '本次获取失败 · 显示上一次成功刷新的赔率。上次成功时间：2026.10.20 12:00（示例）；来源：虚构数据。'
      : '本次获取失败 · 没有上一次成功的赔率记录，暂无数据。');
  } else {
    status.textContent = uiText(available
      ? '赔率来源：虚构示例 · 上次成功刷新：2026.10.20 12:00（示例）'
      : '暂无可用赔率 · 继续查看出马表和马匹战绩。');
  }
  document.getElementById('odds-column-state').textContent = uiText(oddsRefreshFailed || offline ? '上次成功 · 含本金' : '含本金 · 示例');
  document.getElementById('odds-column-label').textContent = uiText(activeRace.sampleFinished ? '单胜最终赔率' : '单胜赔率');
  document.getElementById('odds-failure-preview').setAttribute('aria-pressed', String(oddsRefreshFailed));
  const quality = activeRace.sampleQuality ? qualityCaseFor(activeRace) : null;
  if (quality) {
    status.textContent = uiText("{0}{1}{2}", {0: quality.failed ? '本次获取失败 · ' : '', 1: quality.time, 2: available ? ' · 显示已保存的可用倍率' : ' · 暂无可用倍率'});
    status.dataset.state = quality.failed ? 'failed' : 'normal';
    document.getElementById('odds-column-state').textContent = uiText(quality.failed ? '缓存 · 含本金' : '含本金 · 示例');
  }
  if (activeRace.sampleUpdateFailures?.some(item => item.field === 'odds')) {
    status.textContent = uiText(available ? `赔率来源：${activeRace.sampleOddsSource} · 取得时间：${new Date(activeRace.sampleOddsAt).toLocaleString('zh-CN')}（示例）` : '暂无可用赔率');
    status.dataset.state = 'normal';
    document.getElementById('odds-column-state').textContent = uiText('含本金 · 示例');
  }
  renderDataQuality(activeRace);
  const url = new URL(window.location.href);
  if (oddsRefreshFailed) url.searchParams.set('odds', available ? 'failed' : 'failed-empty');
  else if (available) url.searchParams.set('odds', 'sample');
  else url.searchParams.delete('odds');
  window.history.replaceState(null, '', url);
}

function showHorse(index, button) {
  const entry = sampleEntries[index];
  const language = activeRace.country === 'JP' ? 'ja' : activeRace.country === 'HK' ? 'zh-Hant' : 'en';
  horseOpener = button;
  entryScrollTop = dialog.scrollTop;
  document.getElementById('horse-title').textContent = sampleHorseNames[language][index];
  document.getElementById('horse-title').lang = language;
  document.getElementById('horse-emblem').textContent = uiText(String(entry.number).padStart(2, '0'));
  document.getElementById('horse-subtitle').textContent = uiText("{0}赛事 · 虚构马匹档案", {0: activeRace.place.split(' · ')[0]});
  const letter = String.fromCharCode(65 + index);
  const profile = {
    'horse-sex-age': '雌 · 3 岁（示例）',
    'horse-origin': language === 'ja' ? '日本（示例）' : language === 'zh-Hant' ? '澳大利亚（示例）' : '爱尔兰（示例）',
    'horse-trainer': language === 'ja' ? `厩舎 ${letter}（架空）` : language === 'zh-Hant' ? `練馬師 ${letter}（虛構）` : `Sample Trainer ${letter}`,
    'horse-sire': language === 'ja' ? `父馬 ${letter}（架空）` : language === 'zh-Hant' ? `父馬 ${letter}（虛構）` : `Sample Sire ${letter}`,
    'horse-dam': language === 'ja' ? `母馬 ${letter}（架空）` : language === 'zh-Hant' ? `母馬 ${letter}（虛構）` : `Sample Dam ${letter}`,
    'horse-damsire': index === 3 ? '暂无资料' : language === 'ja' ? `母父 ${letter}（架空）` : language === 'zh-Hant' ? `母父 ${letter}（虛構）` : `Sample Damsire ${letter}`
  };
  Object.entries(profile).forEach(([id, value]) => {
    document.getElementById(id).textContent = uiText(value);
  });
  if (detailReview && activeRace.id.startsWith('detail-') && index === 0) {
    document.getElementById('horse-sire').textContent = uiText('Real Steel (JPN) · 名称排版示例');
    document.getElementById('horse-dam').textContent = uiText('Forever Darling · 名称排版示例');
    document.getElementById('horse-damsire').textContent = uiText('暂无资料');
  }
  document.getElementById('horse-race-name').textContent = activeRace.name;
  document.getElementById('horse-race-name').lang = activeRace.nameLang;
  const quality = activeRace.sampleQuality ? qualityCaseFor(activeRace) : null;
  const hasOdds = dialog.dataset.odds === 'available' && !quality?.missingOdds?.includes(entry.number);
  const oddsLabel = activeRace.sampleFinished ? '本场单胜最终赔率' : '本场单胜赔率';
  document.getElementById('horse-current-odds-label').textContent = uiText(hasOdds && oddsRefreshFailed ? `${oddsLabel} · 上次成功` : oddsLabel);
  document.getElementById('horse-current-odds').textContent = uiText(hasOdds ? sampleOddsLabel(entry.odds) : '暂无数据');
  const oddsTime = document.getElementById('horse-odds-time');
  oddsTime.dataset.state = oddsRefreshFailed ? 'failed' : 'normal';
  oddsTime.textContent = uiText(oddsRefreshFailed
    ? hasOdds ? '本次获取失败 · 上次成功：2026.10.20 12:00（示例）' : '本次获取失败 · 无历史赔率'
    : hasOdds ? '虚构来源 · 10-20 12:00（示例）' : '有可靠数据时显示来源与更新时间');
  if (quality) {
    oddsTime.dataset.state = quality.failed ? 'failed' : 'normal';
    oddsTime.textContent = uiText(hasOdds ? quality.time : '本马暂无可用倍率 · 不以其他马匹的赔率代填');
  }
  if (activeRace.sampleUpdateFailures?.some(item => item.field === 'odds')) {
    oddsTime.dataset.state = 'normal';
    oddsTime.textContent = uiText(hasOdds ? `${activeRace.sampleOddsSource} · 取得时间：${new Date(activeRace.sampleOddsAt).toLocaleString('zh-CN')}（示例）` : '暂无可用赔率');
  }
  if (activeRace.sampleWithdrawnNumbers?.includes(entry.number)) {
    document.getElementById('horse-current-odds').textContent = uiText('已退赛');
    oddsTime.textContent = uiText('本场已退赛 · 对应未结算马券退还本金（示例）');
  }
  const returnLabel = raceView === 'results' ? '返回赛果' : '返回出马表';
  document.getElementById('back-to-entries').textContent = uiText("‹ {0}", {0: returnLabel});
  document.querySelector('.horse-back-button').innerHTML = [uiText(returnLabel), " ", "<span>›</span>"].join('');
  document.getElementById('horse-race-hint').textContent = uiText(raceView === 'results' ? '点击返回本场赛事与赛果' : '点击返回本场赛事与出马表');
  const formList = document.getElementById('horse-form-list');
  formList.removeAttribute('data-live-history');
  formList.replaceChildren();
  entry.form.forEach((position, raceIndex) => {
    const item = document.createElement('li');
    const pastRace = samplePastRaceDetails[raceIndex];
    const jockey = language === 'ja' ? `騎手 ${String.fromCharCode(65 + index)}` : language === 'zh-Hant' ? `騎師 ${String.fromCharCode(65 + index)}` : `Sample Jockey ${String.fromCharCode(65 + index)}`;
    item.innerHTML = ["<div class=\"horse-finish horse-finish-", String(finishTier(position)), "\"><b>", uiText(position), "<small>", uiText("着", null), "</small></b><span>", uiText("16 匹 · 示例", null), "</span></div><div class=\"past-race-name\"><button class=\"past-race-button\" type=\"button\" data-past-race=\"", String(raceIndex), "\" lang=\"", String(language), "\" aria-label=\"", uiAttr("{4}，查看比赛示例信息", {4: samplePastRaces[language][raceIndex]}), "\"><img class=\"race-grade-logo\" src=\"assets/race-grade-", String(pastRace.grade), ".webp\" alt=\"", uiText(gradeLabels[pastRace.grade]), "\"><span>", uiText(samplePastRaces[language][raceIndex]), "</span><span class=\"past-race-arrow\" aria-hidden=\"true\">›</span></button><span>", uiText("{8} · 示例赛场 · {9}", {8: pastRace.date, 9: pastRace.course}), "</span></div><div class=\"past-race-odds\"><b>", uiText(sampleOddsLabel(entry.pastOdds[raceIndex])), "</b><small>", uiText(entry.pastOdds[raceIndex] ? '单胜最终赔率 · 示例' : '赔率暂无数据'), "</small><span class=\"past-race-jockey\" lang=\"", String(language), "\">", uiText(jockey), "</span></div>"].join('');
    const raceButton = item.querySelector('.past-race-button');
    raceButton.addEventListener('click', () => showPastRace(index, raceIndex, raceButton));
    formList.append(item);
  });
  document.getElementById('race-panel').hidden = true;
  document.getElementById('history-panel').hidden = true;
  document.getElementById('horse-panel').hidden = false;
  dialog.dataset.panel = 'horse';
  dialog.setAttribute('aria-labelledby', 'horse-title');
  document.getElementById('dialog-section-label').textContent = uiText('HORSE INFORMATION');
  dialog.scrollTop = 0;
  document.getElementById('back-to-entries').focus({ preventScroll: true });
  const url = new URL(window.location.href);
  url.searchParams.set('horse', entry.number);
  window.history.replaceState(null, '', url);
}

function showPastRace(horseIndex, raceIndex, button) {
  const entry = sampleEntries[horseIndex];
  const pastRace = samplePastRaceDetails[raceIndex];
  const language = activeRace.country === 'JP' ? 'ja' : activeRace.country === 'HK' ? 'zh-Hant' : 'en';
  historyOpener = button;
  horseScrollTop = dialog.scrollTop;
  document.getElementById('history-title').textContent = samplePastRaces[language][raceIndex];
  document.getElementById('history-title').lang = language;
  const grade = document.getElementById('history-grade');
  grade.src = `assets/race-grade-${pastRace.grade}.webp`;
  grade.alt = uiText(gradeLabels[pastRace.grade]);
  setSurfaceBadge(document.getElementById('history-surface'), pastRace.surface);
  document.getElementById('history-region').textContent = uiText("{0} · 示例赛场", {0: activeRace.place.split(' · ')[0]});
  document.getElementById('history-date').textContent = uiText(pastRace.date);
  document.getElementById('history-course').textContent = pastRace.course;
  document.getElementById('history-horse-name').textContent = sampleHorseNames[language][horseIndex];
  document.getElementById('history-horse-name').lang = language;
  document.getElementById('history-finish').className = `horse-finish horse-finish-${finishTier(entry.form[raceIndex])}`;
  document.getElementById('history-position').textContent = uiText(entry.form[raceIndex]);
  document.getElementById('history-odds').textContent = uiText(sampleOddsLabel(entry.pastOdds[raceIndex]));
  document.getElementById('history-prize-label').textContent = uiText(activeRace.country === 'JP' ? '本赏金合计' : '赛事总赏金');
  document.getElementById('history-winner-prize-label').textContent = uiText(activeRace.country === 'JP' ? '冠军本赏金' : '冠军赏金');
  document.getElementById('history-prize-note').textContent = uiText(activeRace.country === 'JP' ? '本赏金与附加赏均待取得，分开保存（示例）' : '赏金资料待取得（示例）');
  document.getElementById('history-odds-label').textContent = uiText(entry.pastOdds[raceIndex] ? '单胜最终赔率 · 示例' : '赔率暂无数据');
  document.getElementById('history-jockey').textContent = uiText(language === 'ja' ? `騎手 ${String.fromCharCode(65 + horseIndex)}` : language === 'zh-Hant' ? `騎師 ${String.fromCharCode(65 + horseIndex)}` : `Sample Jockey ${String.fromCharCode(65 + horseIndex)}`);
  document.getElementById('history-jockey').lang = language;
  renderHistoryResolution(activeRace.sampleUnresolvedHistoryIndex === raceIndex, pastRace.date, document);
  document.getElementById('horse-panel').hidden = true;
  document.getElementById('history-panel').hidden = false;
  dialog.dataset.panel = 'history';
  dialog.setAttribute('aria-labelledby', 'history-title');
  document.getElementById('dialog-section-label').textContent = uiText('PAST RACE INFORMATION');
  dialog.scrollTop = 0;
  document.getElementById('back-to-horse').focus({ preventScroll: true });
  const url = new URL(window.location.href);
  url.searchParams.set('past', raceIndex + 1);
  window.history.replaceState(null, '', url);
}

function backToHorse() {
  document.getElementById('history-panel').hidden = true;
  document.getElementById('horse-panel').hidden = false;
  dialog.dataset.panel = 'horse';
  dialog.setAttribute('aria-labelledby', 'horse-title');
  document.getElementById('dialog-section-label').textContent = uiText('HORSE INFORMATION');
  dialog.scrollTop = horseScrollTop;
  historyOpener?.focus({ preventScroll: true });
  const url = new URL(window.location.href);
  url.searchParams.delete('past');
  window.history.replaceState(null, '', url);
}

function backToEntries() {
  document.getElementById('horse-panel').hidden = true;
  document.getElementById('race-panel').hidden = false;
  dialog.dataset.panel = 'race';
  dialog.setAttribute('aria-labelledby', 'race-title');
  document.getElementById('dialog-section-label').textContent = uiText('RACE INFORMATION');
  dialog.scrollTop = entryScrollTop;
  horseOpener?.focus({ preventScroll: true });
  const url = new URL(window.location.href);
  url.searchParams.delete('horse');
  window.history.replaceState(null, '', url);
}

function renderDataQuality(race) {
  const quality = race.sampleQuality ? qualityCaseFor(race) : null;
  const failures = [...(race.sampleUpdateFailures || [])];
  const offline = document.getElementById('calendar-demo-network')?.value === 'offline' || navigator.onLine === false;
  if ((oddsRefreshFailed || offline) && !failures.some(item => item.field === 'odds')) failures.push({ field: 'odds', label: '单胜赔率', reason: offline ? '当前离线，未能检查新赔率。' : '本次赔率请求失败。', lastSuccessAt: race.sampleOddsAt });
  const purse = race.layoutDemo || isLiveRace(race) ? null : samplePurses[race.country];
  const missing = [];
  if (!purse) missing.push('赛事总赏金、冠军赏金');
  else if (purse.winnerAmount == null) missing.push('冠军赏金');
  if (!race.startAt) missing.push('具体发走时间');
  if (quality?.missingJockeys?.length) missing.push(`骑师（${quality.missingJockeys.join('、')} 号马）`);
  if (quality?.missingOdds?.length) missing.push(`单胜倍率（${quality.missingOdds.join('、')} 号马）`);
  if (quality?.officialResult) missing.push('非冠军名次及着差');
  const hasIssue = Boolean(quality || missing.length || failures.length);
  const notice = document.getElementById('race-quality-notice');
  notice.hidden = !hasIssue;
  document.getElementById('race-quality-entry').hidden = !hasIssue;
  document.getElementById('quality-empty').hidden = !quality?.empty;
  document.querySelector('#race-panel .entry-table').hidden = Boolean(quality?.empty);
  document.querySelector('#race-panel .odds-preview-control').hidden = Boolean(quality);
  document.querySelector('#race-panel .entry-count').textContent = uiText(quality?.empty ? '暂无已取得名单' : quality?.officialResult ? '8 匹 · 仅冠军名次确认' : '8 匹 · 示例');
  if (!hasIssue) return;
  if (failures.length) {
    const time = value => value ? new Date(value).toLocaleString('zh-CN') : '暂无成功记录';
    notice.dataset.tone = 'failed';
    document.getElementById('race-quality-summary').textContent = uiText(failures.length === 1 ? `${failures[0].label}更新失败` : `${failures.length} 项资料更新失败`);
    document.getElementById('race-quality-title').textContent = uiText('部分资料本次更新失败');
    document.getElementById('race-quality-copy').textContent = uiText(failures.map(item => `${item.label}：${item.reason}${item.attemptedAt ? `\n本次尝试：${time(item.attemptedAt)}` : ''}\n上次成功：${time(item.lastSuccessAt)}`).join('\n\n')
      + (race.sampleLatestResultAt ? `\n\n赛果已成功更新：${time(race.sampleLatestResultAt)}。目前显示各项已取得的最新可用资料。` : '\n\n已取得的最新可用资料继续显示。')
      + (missing.length ? `\n尚待补齐：${uiList(missing, '、')}。` : '')
      + (quality ? `\n${quality.copy}` : ''));
    document.getElementById('race-quality-time').textContent = uiText('虚构状态演示 · 可手动刷新或下次进入时再试');
    document.getElementById('race-quality-ticket').textContent = uiText(quality?.ticket || '查看异常说明不处理资金；失败不表示退赛或取消，也不会撤销已取得的正式赛果。');
    return;
  }
  document.getElementById('race-quality-summary').textContent = uiText(quality ? { unpublished: '出走名单待公布', 'partial-entries': '部分资料待补', 'cached-failed': '本次更新未成功', 'empty-failed': '暂无可用资料', 'results-pending': '赛果待公布', 'official-partial': '部分赛果资料待补', conflict: '赛果资料待核实' }[quality.key] : '部分资料待补');
  if (!quality) {
    notice.dataset.tone = 'normal';
    document.getElementById('race-quality-title').textContent = uiText('部分赛事资料尚未取得');
    document.getElementById('race-quality-copy').textContent = uiText("暂缺：{0}。继续显示已保存的赛事资料，缺失字段不填入推测值。", {0: uiList(missing, '、')});
    document.getElementById('race-quality-time').textContent = uiText('示例缺失字段 · 未取得这些字段的成功更新时间');
    document.getElementById('race-quality-ticket').textContent = uiText('查看说明不处理资金；购买与结算仍按已确认的资料和日期资格判断。');
    return;
  }
  notice.dataset.tone = quality.key === 'conflict' ? 'conflict' : quality.failed ? 'failed' : 'normal';
  for (const [id, value] of [['race-quality-title', quality.title], ['race-quality-copy', quality.copy], ['race-quality-time', quality.time], ['race-quality-ticket', quality.ticket]]) document.getElementById(id).textContent = uiText(value);
  if (missing.length) document.getElementById('race-quality-copy').textContent += uiText(" 尚待补齐：{0}。", {0: uiList(missing, '；')});
  if (quality.officialResult && gamePreview && !gamePreview.hasUnread(race.id)) document.getElementById('race-quality-ticket').textContent = uiText('本场已查看结算；再次查看资料不会重复入账。');
  document.getElementById('quality-empty-title').textContent = uiText(quality.failed ? '本次未能取得出马表' : '正式出走名单待公布');
  if (quality.officialResult && raceView === 'results') document.getElementById('entry-view-description').textContent = uiText('仅冠军正式确认；其余名次待确认，按马号列出，不作为名次排序。点击马名仍可查看资料。');
}

function showRace(race, button) {
  opener = button;
  activeRace = race;
  const live = isLiveRace(race);
  if (desktopData) dialog.toggleAttribute('data-live-race', live);
  const qualityDialog = document.getElementById('race-quality-dialog');
  if (qualityDialog.open) qualityDialog.close();
  dialog.dataset.colorRegion = countryColors[race.country] || 'other';
  document.getElementById('history-panel').hidden = true;
  document.getElementById('horse-panel').hidden = true;
  document.getElementById('race-panel').hidden = false;
  dialog.dataset.panel = 'race';
  dialog.dataset.cancelled = String(Boolean(race.sampleCancelled));
  dialog.setAttribute('aria-labelledby', 'race-title');
  document.getElementById('dialog-section-label').textContent = uiText('RACE INFORMATION');
  document.getElementById('race-title').textContent = race.name;
  document.getElementById('race-title').lang = race.nameLang;
  document.getElementById('race-subtitle').textContent = uiText(race.subtitle);
  document.getElementById('race-region').textContent = uiText(race.place);
  document.getElementById('race-grade').textContent = uiText(race.gradeLabel || gradeLabels[race.grade || 'g1']);
  setSurfaceBadge(document.getElementById('race-surface'), race.surface);
  const raceDate = raceCalendarDate(race, displayTimeZone);
  document.getElementById('race-date').textContent = uiText("{0} 月 {1} 日（{2}）", {0: raceDate.month, 1: raceDate.day, 2: race.startAt ? '示例' : '来源日期 · 示例'});
  document.getElementById('race-start-time').textContent = uiText(race.startAt ? `${clockInZone(race.startAt, displayTimeZone)}（${race.sampleCancelled ? '原定 · ' : ''}示例）` : '待公布');
  document.getElementById('race-display-zone').textContent = uiText(race.startAt ? `${zonePreview === 'auto' ? calendarUi('电脑时区', 'Computer time zone', 'PCのタイムゾーン') : calendarUi('预览时区', 'Preview time zone', 'プレビューのタイムゾーン')} · ${displayTimeZone}` : '未取得具体时间');
  const venueTime = document.getElementById('race-venue-time');
  venueTime.hidden = !race.startAt || !race.venueTimeZone;
  if (race.startAt && race.venueTimeZone) {
    const venueDate = dateInZone(race.startAt, race.venueTimeZone);
    venueTime.textContent = uiText("赛场 {0}/{1} {2} · {3}", {0: venueDate.month, 1: venueDate.day, 2: clockInZone(race.startAt, race.venueTimeZone), 3: race.venueTimeZone});
  }
  const purse = race.layoutDemo || isLiveRace(race) ? null : samplePurses[race.country];
  const prizeFormatter = purse ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: purse.currency, currencyDisplay: 'code', maximumFractionDigits: 0 }) : null;
  document.getElementById('race-prize-label').textContent = uiText(race.country === 'JP' ? '本赏金合计' : '赛事总赏金');
  document.getElementById('race-winner-prize-label').textContent = uiText(race.country === 'JP' ? '冠军本赏金' : '冠军赏金');
  document.getElementById('race-prize').textContent = uiText(purse ? prizeFormatter.format(purse.amount) : '暂无数据');
  document.getElementById('race-winner-prize').textContent = uiText(purse?.winnerAmount != null ? prizeFormatter.format(purse.winnerAmount) : '暂无数据');
  document.getElementById('race-prize-note').textContent = uiText(race.country === 'JP'
    ? purse ? `附加赏另列：合计 ${prizeFormatter.format(purse.bonusAmount)} · 冠军 ${prizeFormatter.format(purse.winnerBonus)}。不计入上方本赏金；全部为虚构金额。` : '本赏金与附加赏均待取得，分开保存（示例）'
    : purse ? '虚构金额 · 以赛事原币种展示' : '赏金资料待取得（示例）');
  document.getElementById('race-course').textContent = race.course;
  document.getElementById('source-label').textContent = uiText(race.source);
  document.getElementById('race-state-label').textContent = uiText(race.sampleQuality ? qualityCaseFor(race).label : race.sampleCancelled ? '已取消 · 示例' : race.sampleFinished ? '已结束 · 示例' : '未结束 · 示例');
  renderRaceChange(race);
  setRaceView(race.sampleFinished ? 'results' : 'entries');
  if (race.sampleEntriesConfirmed === true || race.sampleQuality) document.getElementById('odds-preview').checked = race.sampleOfficialOdds === true;
  if (live) {
    const officialResult = race === desktopData.race;
    dialog.dataset.odds = officialResult && race.realResult ? 'available' : 'unavailable';
    document.getElementById('race-subtitle').textContent = officialResult
      ? devText('2026 年 · 官方赛果档案', '2026 · Official results archive', '2026年 · 公式結果アーカイブ')
      : devText('官方赛程记录', 'Official schedule record', '公式日程');
    document.getElementById('race-date').textContent = race.startAt
      ? new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'long', timeZone: displayTimeZone }).format(new Date(race.startAt))
      : race.date;
    document.getElementById('race-start-time').textContent = race.startAt
      ? clockInZone(race.startAt, displayTimeZone) + (race.provisional ? devText('（暂定）', ' (provisional)', '（予定）') : '')
      : devText('暂无资料', 'Unavailable', '未取得');
    document.getElementById('race-state-label').textContent = officialResult
      ? devText('已结束', 'Finished', '終了')
      : devText('赛程已公布', 'Schedule published', '日程公開済み');
    if (race.country === 'JP' && /^[0-9,]+$/.test(race.winnerPrize || '')) {
      document.getElementById('race-winner-prize').textContent = '¥' + race.winnerPrize;
    }
    document.getElementById('race-prize-note').textContent = devText('赏金以已取得的官方字段为准。', 'Prizes shown when available from the official source.', '公式資料から取得できた賞金を表示します。');
    renderLiveSource(race, refreshDesktopResult);
  } else {
    setOddsPreview(document.getElementById('odds-preview').checked);
  }
  gamePreview?.updateRaceAction(race);
  dialog.showModal();
  if (live) refreshDesktopResult?.(race);
  dialog.scrollTop = 0;
  document.querySelector('.entry-table-scroll').scrollLeft = 0;
  if (race.sampleChange && !race.sampleChange.read) {
    race.sampleChange.read = true;
    renderCalendar();
  }
}

function renderRaceChange(race) {
  const notice = document.getElementById('race-change-notice');
  const change = race.sampleChange;
  const history = document.getElementById('race-change-history');
  const historyRows = document.getElementById('race-change-history-rows');
  historyRows.replaceChildren();
  history.open = false;
  history.hidden = true;
  notice.hidden = !change;
  if (!change) return;
  notice.dataset.change = change.kind;
  const format = instant => {
    const date = dateInZone(instant, displayTimeZone);
    return `${date.year}.${String(date.month).padStart(2, '0')}.${String(date.day).padStart(2, '0')} ${clockInZone(instant, displayTimeZone)}`;
  };
  const title = record => ({ postponed: '赛事已改期', cancelled: '赛事已取消', withdrawn: `${(record.withdrawnNumbers || race.sampleWithdrawnNumbers || []).join('、')} 号马已退赛`, updated: '赛事关键信息已变更' })[record.kind];
  const renderFields = (record, target) => {
    target.replaceChildren();
    if (record.fields?.length) {
      for (const field of record.fields) {
        const row = document.createElement('div'); row.className = 'change-field-row';
        const label = document.createElement('span'); label.textContent = uiText(field.label);
        const value = item => field.label === '发走时间' ? format(item) : field.label === '场地类型' ? { turf: '芝', dirt: 'ダート', aw: 'AW' }[item] : field.label === '距离' ? `${item}m` : String(item);
        const old = document.createElement('del'); old.textContent = uiText(value(field.before));
        const next = document.createElement('strong'); next.textContent = uiText(value(field.after));
        row.append(label, old, document.createTextNode(' → '), next); target.append(row);
      }
    } else if (record.kind === 'postponed') {
      const old = document.createElement('del'); old.textContent = uiText(format(record.previousStartAt));
      const next = document.createElement('strong'); next.textContent = uiText(format(record.raceStartAt || race.startAt));
      target.append(old, document.createTextNode(' → '), next);
    } else target.textContent = uiText("{0} · {1}", {0: record.kind === 'cancelled' ? '保留原赛程日期' : '赛事照常保留', 1: format(record.raceStartAt || race.startAt)});
  };
  document.getElementById('race-change-title').textContent = uiText(title(change));
  renderFields(change, document.getElementById('race-change-dates'));
  const earlier = race.sampleChangeHistory || [];
  history.hidden = earlier.length === 0;
  document.getElementById('race-change-history-summary').textContent = uiText("过往变更（{0}）", {0: earlier.length});
  for (const record of earlier) {
    const article = document.createElement('article'); article.className = 'change-history-record';
    const heading = document.createElement('b'); heading.textContent = uiText(title(record));
    const time = document.createElement('small'); time.textContent = uiText("示例更新时间 {0} · {1}", {0: format(record.updatedAt), 1: displayTimeZone});
    const fields = document.createElement('div'); fields.className = 'change-history-fields';
    renderFields(record, fields);
    article.append(heading, time, fields); historyRows.append(article);
  }
  document.getElementById('race-change-copy').textContent = uiText({
    postponed: '气泡已移到新日期，原日期不重复保留。已购马券继续有效，保留确认时锁定的倍率，等待新日期赛果。',
    cancelled: '取消赛事仍可查看资料，但没有本场赛果，也不能新增马券；该场待结算马券退还本金，保留为无效记录。',
    withdrawn: '只退还所选退赛马匹的待结算马券本金；其他马匹的马券继续等待赛果。退赛马不可继续选购。',
    updated: '上方列出最新一次关键变更，旧记录可在下方展开查看。查看详情后黄色提醒消失，记录保留；再次发生新的关键变更时重新提醒。'
  }[change.kind]);
  document.getElementById('race-change-source').textContent = uiText("虚构变更记录 · 示例更新时间 {0} · {1}", {0: format(change.updatedAt), 1: displayTimeZone});
}

function syncDesktopRaces() {
  const saved = desktopData.schedule.races().filter(race => race.id !== 'jra-2026-tenno-autumn').map(race => desktopData.details.attach({ ...race }));
  races.splice(0, races.length, desktopData.race, desktopData.fixture, ...saved);
}

function renderCalendar() {
  const expandedDates = new Set([...calendar.querySelectorAll('.day-more[open]')].map(details => details.closest('.day').dataset.date));
  calendar.replaceChildren();
  document.getElementById('calendar-zone-label').textContent = uiText("{0} · {1}", {0: zonePreview === 'auto' ? '电脑时区' : '预览时区', 1: displayTimeZone});
  const datedRaces = races.filter(race => race !== desktopData?.fixture).map(race => ({ race, date: raceCalendarDate(race, displayTimeZone) }));
  const today = dateInZone(new Date(), displayTimeZone);
  const matchesRegion = race => dailyCalendar ? selectedRegions.has(countryColors[race.country] || 'other') : activeFilter === 'all' || race.region === activeFilter;
  if (dailyCalendar) updateCalendarControls(datedRaces, matchesRegion);
  for (const [index, cellDate] of calendarMonthDays(calendarYear, calendarMonth).entries()) {
    const { year, month, day: dayNumber } = cellDate;
    const outside = month !== calendarMonth || year !== calendarYear;
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    cell.setAttribute('aria-label', uiText("{0}年{1}月{2}日 {3}", {0: year, 1: month, 2: dayNumber, 3: weekdays[index % 7]}));
    if (outside) cell.classList.add('outside');
    if (today.year === year && today.month === month && today.day === dayNumber) cell.classList.add('today');

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = uiText(dayNumber);
    cell.append(date);
    if (outside) {
      const label = document.createElement('span');
      label.className = 'month-label';
      label.textContent = uiText("{0}月", {0: month});
      cell.append(label);
    }
    if (cell.classList.contains('today')) {
      const today = document.createElement('span');
      today.className = 'today-label';
      today.textContent = uiText('TODAY');
      cell.append(today);
    }

    const dayRaces = datedRaces.filter(({ race, date }) => date.year === year && date.month === month && date.day === dayNumber && matchesRegion(race)).map(({ race }) => race).sort(compareRaceImportance);
    if (dayRaces.some(race => race.layoutDemo)) {
      const label = document.createElement('span');
      label.className = 'demo-day-label';
      label.textContent = uiText(calendarUi('排版示例', 'Layout sample', '表示サンプル'));
      cell.append(label);
    }
    let foldedRaces = null;
    dayRaces.forEach((race, raceIndex) => {
      if (dayRaces.length >= 3 && raceIndex === 1) {
        foldedRaces = document.createElement('details');
        foldedRaces.className = 'day-more';
        foldedRaces.open = expandedDates.has(cell.dataset.date);
        const summary = document.createElement('summary');
        const remainingCount = dayRaces.length - 1;
        summary.innerHTML = ["<span class=\"expand-label\">", uiText(calendarUi(`展开其余 ${remainingCount} 场`, `Show ${remainingCount} more`, `残り${remainingCount}件を表示`)), "</span><span class=\"collapse-label\">", uiText(calendarUi(`收起其余 ${remainingCount} 场`, `Hide ${remainingCount} races`, `残り${remainingCount}件を閉じる`)), "</span>"].join('');
        foldedRaces.append(summary);
        cell.append(foldedRaces);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.raceId = race.id;
      button.title = race.name;
      button.className = `race-card ${race.region === 'world' ? 'overseas-race' : ''}`;
      button.dataset.colorRegion = countryColors[race.country] || 'other';
      const raceLabel = desktopData
        ? calendarUi(`${race.name}，查看赛事详情`, `${race.name}, view race details`, `${race.name}、詳細を表示`)
        : uiText(calendarUi(`${race.name}，${race.place}，查看示例详情`, `${race.name}, ${race.country}, view sample details`, `${race.name}、サンプル詳細を表示`));
      button.setAttribute('aria-label', raceLabel);
      button.innerHTML = '<span class="card-top"><span class="grade-badge"></span><span class="region-code" lang="en"></span><span class="surface-badge"></span><span class="card-arrow" aria-hidden="true">›</span></span><span class="race-name"></span>';
      button.querySelector('.grade-badge').textContent = gradeLabels[race.grade || 'g1'];
      const regionCode = button.querySelector('.region-code');
      regionCode.title = uiText(race.place.split(' · ')[0]);
      regionCode.textContent = uiText(regionCodes[race.country] || race.country);
      const raceName = button.querySelector('.race-name');
      raceName.lang = race.nameLang;
      raceName.textContent = race.name;
      setSurfaceBadge(button.querySelector('.surface-badge'), race.surface);
      if (race.sampleChange) {
        const kind = race.sampleChange.kind;
        const label = { postponed: '赛事已改期', cancelled: '赛事已取消', withdrawn: '存在马匹退赛', updated: '关键信息已变更' }[kind];
        const note = document.createElement('span');
        note.className = 'race-change-note';
        note.dataset.change = kind;
        note.textContent = uiText(calendarUi({ postponed: '↻ 改期', cancelled: '× 取消', withdrawn: '△ 退赛', updated: '↻ 资料变更' }[kind], { postponed: '↻ Rescheduled', cancelled: '× Cancelled', withdrawn: '△ Withdrawn', updated: '↻ Updated' }[kind], { postponed: '↻ 日程変更', cancelled: '× 中止', withdrawn: '△ 取消', updated: '↻ 更新' }[kind]));
        button.append(note);
        if (!race.sampleChange.read) {
          const badge = document.createElement('span');
          badge.className = 'race-change-flag';
          badge.dataset.change = kind;
          badge.textContent = uiText('⚠️');
          badge.title = uiText("未读变更 · {0}", {0: label});
          badge.setAttribute('aria-label', uiText("未读变更 · {0}", {0: label}));
          button.append(badge);
        }
        button.setAttribute('aria-label', uiText("{0}，{1}", {0: button.getAttribute('aria-label'), 1: label}));
      }
      button.addEventListener('click', () => {
        if (gamePreview?.interceptRace(race, button)) return;
        entryView = 'compact';
        showRace(race, button);
      });
      gamePreview?.decorateCard(button, race);
      (foldedRaces || cell).append(button);
    });
    if (foldedRaces && dayRaces.slice(1).some(race => gamePreview?.hasUnread(race.id))) {
      const alert = document.createElement('span');
      alert.className = 'game-fold-alert'; alert.textContent = uiText('!'); alert.setAttribute('aria-label', uiText('折叠赛事有未读模拟结算'));
      foldedRaces.querySelector('summary').append(alert);
    }
    if (foldedRaces && dayRaces.slice(1).some(race => race.sampleChange && !race.sampleChange.read)) {
      const warning = document.createElement('span');
      warning.className = 'fold-change-alert'; warning.textContent = uiText('⚠️'); warning.setAttribute('aria-label', uiText('折叠赛事含赛程或出走变更'));
      foldedRaces.querySelector('summary').append(warning);
    }
    calendar.append(cell);
  }
}

function goToMonth(year, month) {
  if (year < 1 || year > 9999) return;
  calendarYear = year;
  calendarMonth = month;
  const url = new URL(window.location.href);
  url.searchParams.set('year', year);
  url.searchParams.set('month', month);
  window.history.replaceState(null, '', url);
  renderCalendar();
  loadCalendarMonth?.(false);
}

function updateCalendarControls(datedRaces, matchesRegion) {
  document.querySelector('.month-title .year').textContent = uiText(calendarYear);
  document.getElementById('calendar-title').innerHTML = [uiText(calendarMonth), "<span>", uiText(calendarUi('月', '', '月')), "</span>"].join('');
  document.querySelector('.english-month').textContent = uiText(englishMonths[calendarMonth - 1]);
  document.querySelector('.season-label span').textContent = uiText("{0} SEASON", {0: calendarYear});
  document.getElementById('calendar-jump').setAttribute('aria-label', uiText(calendarUi(`${calendarYear}年${calendarMonth}月，选择年月`, `Choose month: ${calendarYear}-${calendarMonth}`, `${calendarYear}年${calendarMonth}月を選択`)));
  document.getElementById('calendar-previous').disabled = calendarYear === 1 && calendarMonth === 1;
  document.getElementById('calendar-next').disabled = calendarYear === 9999 && calendarMonth === 12;
  calendar.setAttribute('aria-label', uiText(calendarUi(`${calendarYear}年${calendarMonth}月示例月历`, `Sample race calendar: ${calendarYear}-${calendarMonth}`, `${calendarYear}年${calendarMonth}月のサンプル`)));
  const inMonth = datedRaces.filter(({ date }) => date.year === calendarYear && date.month === calendarMonth);
  const count = inMonth.filter(({ race }) => matchesRegion(race)).length;
  document.getElementById('calendar-month-summary').textContent = uiText(inMonth.length ? calendarUi(`本月 ${count} 场 · 示例资料`, `${count} ${count === 1 ? 'race' : 'races'} this month · Sample data`, `今月 ${count} レース · サンプル`) : calendarUi('本月资料未载入', 'Data not loaded for this month', '今月のデータは未取得'));
  const empty = document.getElementById('calendar-empty');
  empty.hidden = count > 0;
  empty.dataset.reason = inMonth.length ? 'filter' : 'missing';
  document.getElementById('calendar-empty-title').textContent = uiText(inMonth.length ? calendarUi('当前筛选没有匹配赛事', 'No races match these filters', '条件に一致するレースはありません') : calendarUi('本月资料尚未载入', 'Data not loaded for this month', '今月のデータは未取得'));
  document.getElementById('calendar-empty-copy').textContent = uiText(inMonth.length ? calendarUi('可以放宽地区筛选，再看看这个月的赛程。', 'Select more regions to see this month’s races.', '地域フィルターを広げてください。') : calendarUi('这里保留完整日期格。没有资料不代表没有比赛；本轮仅提供 2026 年 10—11 月的少量样例。', 'Missing data does not mean no races. This preview contains selected October–November 2026 samples.', '未取得は開催なしを意味しません。2026年10〜11月の一部サンプルです。'));
  const emptyAction = document.getElementById('calendar-empty-action');
  if (desktopData) {
    const year = desktopData.schedule.state(calendarYear);
    const directories = Object.values(year.providers);
    const hasSchedule = directories.some(source => source.races.length);
    calendar.setAttribute('aria-label', calendarUi(`${calendarYear}年${calendarMonth}月赛历`, `Race calendar: ${calendarYear}-${calendarMonth}`, `${calendarYear}年${calendarMonth}月のレースカレンダー`));
    document.getElementById('calendar-month-summary').textContent = devText(`本月已载入 ${count} 场`, `${count} races loaded`, `今月 ${count} レース`);
    if (!inMonth.length) {
      document.getElementById('calendar-empty-title').textContent = year.checking
        ? devText('正在查询本月赛程', 'Checking this month', '今月の日程を確認中')
        : hasSchedule ? devText('已载入的资料中暂无本月赛事', 'No races this month in the loaded schedules', '取得済みの日程に今月のレースはありません')
        : devText('本月赛程尚未取得', 'No schedule available yet', '今月の日程は未取得');
      document.getElementById('calendar-empty-copy').textContent = year.providersExpected.length
        ? devText('当前范围为日本 GⅠ／JpnⅠ 和 IFHA 可核对的海外前百赛事。来源状态见底栏。', 'Coverage includes Japanese GⅠ/JpnⅠ and matched IFHA Top 100 overseas races. See source status below.', '日本のGⅠ／JpnⅠと、IFHAで照合できた海外トップ100が対象です。取得状況は下部にあります。')
        : devText('该年度超出本版目录范围。', 'This year is outside the current directory coverage.', 'この年は現在の取得対象外です。');
    }
    emptyAction.hidden = !inMonth.length;
  }
  emptyAction.textContent = uiText(inMonth.length ? calendarUi('显示全部地区', 'Show all regions', '全地域を表示') : calendarUi('查看 10 月示例', 'Open October sample', '10月のサンプルへ'));
  activeFilter = selectedRegions.size === regionGroups.length ? 'all' : selectedRegions.size === 1 && selectedRegions.has('jp') ? 'jp' : selectedRegions.size === regionGroups.length - 1 && !selectedRegions.has('jp') ? 'world' : 'custom';
  document.querySelectorAll('[data-filter]').forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const custom = activeFilter === 'custom';
  const regionsButton = document.getElementById('calendar-regions');
  regionsButton.textContent = uiText(custom ? calendarUi(`已选 ${selectedRegions.size} 个地区 ⌄`, `${selectedRegions.size} regions selected ⌄`, `${selectedRegions.size} 地域選択 ⌄`) : calendarUi('细分地区 ⌄', 'Regions ⌄', '地域 ⌄'));
  regionsButton.classList.toggle('has-selection', custom);
}

function initUpdateRulePreview() {
  const race = races.find(item => item.id === 'update-demo');
  const panel = document.getElementById('calendar-update-rule-study');
  panel.hidden = !race;
  if (!race) return;
  const status = document.getElementById('update-rule-feedback');
  const original = structuredClone(race);
  let lastPatch = null;
  const published = () => ({ sampleEntriesConfirmed: true, sampleRunners: sampleEntries.map((entry, index) => ({ id: `horse-${entry.number}`, number: entry.number, name: sampleHorseNames.ja[index], jockey: `騎手 ${String.fromCharCode(65 + index)}`, weight: 55 })) });
  function apply(action) {
    if (action === 'reset') {
      for (const key of Object.keys(race)) delete race[key];
      Object.assign(race, structuredClone(original)); lastPatch = null;
      const date = raceCalendarDate(race, displayTimeZone); goToMonth(date.year, date.month);
      status.textContent = uiText('仅重置 29 日虚构更新示例；可从首次公布开始测试。'); return;
    }
    const at = new Date().toISOString();
    let patch;
    if (action === 'publish') {
      if (race.sampleEntriesConfirmed) { status.textContent = uiText('本场名单已公布，不重复载入首发资料。'); return; }
      patch = published();
    } else if (action === 'changed') {
      if (!race.sampleEntriesConfirmed) applyPreviewRaceUpdate(race, published(), at);
      const runners = structuredClone(race.sampleRunners);
      runners[0].jockey = '騎手 Z'; runners[0].weight = 56;
      patch = { startAt: '2026-10-29T06:30:00Z', place: '日本 · 示例赛场 B', distance: 2200, surface: 'dirt', course: 'ダート 2,200m（架空）', sampleRunners: runners };
    } else if (action === 'repeat') {
      if (!lastPatch) { status.textContent = uiText('请先应用一次关键变更，再测试重复更新。'); return; }
      patch = lastPatch;
    } else if (action === 'again') {
      patch = { startAt: new Date(new Date(race.startAt).getTime() + 15 * 60000).toISOString() };
    } else patch = { sampleOddsAt: at, sampleExampleOdds: '4.6', sampleExamplePrize: 320000000 };
    const changed = applyPreviewRaceUpdate(race, patch, at);
    if (action === 'changed' || action === 'again') lastPatch = structuredClone(patch);
    const date = raceCalendarDate(race, displayTimeZone);
    goToMonth(date.year, date.month);
    status.textContent = uiText(action === 'ordinary'
      ? `已模拟收到赔率／赏金更新，不触发新的黄色提醒；${race.sampleChange?.read ? '已读提醒保持消失' : race.sampleChange ? '原有未读提醒保留' : '不增加黄色提醒'}。`
      : changed.length
      ? `已应用 ${changed.length} 项关键变更。请点击 29 日的「更新ルール確認（架空）」查看详情、清除 ⚠️，然后测试重复更新或再次变更。`
      : `资料已更新，没有新的关键变更；${race.sampleChange?.read ? '已读提醒保持消失' : race.sampleChange ? '原有未读提醒保留' : '不增加黄色提醒'}。`);
  }
  panel.querySelectorAll('[data-update-rule]').forEach(button => button.addEventListener('click', () => apply(button.dataset.updateRule)));
  if (['changed', 'history'].includes(previewParams.get('updates'))) apply('changed');
  if (previewParams.get('updates') === 'history') { apply('again'); apply('again'); }
}

function initDailyCalendar() {
  document.body.dataset.calendarMode = 'daily';
  document.title = uiText('GⅠ 赛马日历 · 主日历操作预览');
  document.querySelector('.design-status').textContent = uiText('界面预览 · 示例资料');
  document.querySelector('.brand').href = 'index.html?preview=calendar&v=33';
  const settingsLink = document.querySelector('.settings-nav-link');
  if (settingsLink) settingsLink.href = 'settings.html?from=calendar&v=33';
  document.querySelector('.season-copy p').textContent = uiText('MONTHLY RACE SCHEDULE');
  document.querySelector('.season-label b').textContent = uiText('GⅠ CALENDAR');
  document.querySelector('.page-footer').innerHTML = ["<span>GⅠ RACE CALENDAR · DESIGN 33</span><span>", uiText("本轮不使用角色背景 · 数据为设计示例", null), "</span>"].join('');
  for (const id of ['calendar-update', 'calendar-jump', 'calendar-today', 'calendar-regions', 'calendar-state-study']) document.getElementById(id).hidden = false;
  document.getElementById('calendar-change-study').hidden = !changePreview;
  if (changePreview) {
    document.title = uiText('GⅠ 赛马日历 · 赛事变更与退款预览');
    document.querySelector('.page-footer>span').textContent = uiText('GⅠ RACE CALENDAR · DESIGN 44');
  }
  initUpdateRulePreview();
  document.querySelectorAll('[data-change-preview]').forEach(button => button.addEventListener('click', () => {
    entryView = 'compact';
    const race = races.find(item => item.id === button.dataset.changePreview);
    const date = raceCalendarDate(race, displayTimeZone);
    goToMonth(date.year, date.month);
    if (gamePreview?.interceptRace(race, button)) return;
    showRace(race, button);
  }));
  document.querySelectorAll('[data-refresh-refund]').forEach(button => button.addEventListener('click', () => gamePreview.prepareRefundDemo(button.dataset.refreshRefund)));
  for (const [id, label, delta] of [['calendar-previous', '上个月', -1], ['calendar-next', '下个月', 1]]) {
    const button = document.getElementById(id);
    button.setAttribute('aria-label', uiText(label));
    button.addEventListener('click', () => {
      const month = calendarMonth + delta;
      goToMonth(calendarYear + (month < 1 ? -1 : month > 12 ? 1 : 0), month < 1 ? 12 : month > 12 ? 1 : month);
    });
  }
  document.getElementById('calendar-today').addEventListener('click', () => {
    const today = dateInZone(new Date(), displayTimeZone);
    goToMonth(today.year, today.month);
    calendar.querySelector('.today')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
  document.getElementById('calendar-empty-action').addEventListener('click', () => {
    if (document.getElementById('calendar-empty').dataset.reason === 'missing') goToMonth(2026, desktop ? 11 : 10);
    else { selectedRegions = new Set(regionGroups.map(([key]) => key)); renderCalendar(); }
  });

  const monthDialog = document.getElementById('calendar-month-dialog');
  const yearInput = document.getElementById('calendar-year-input');
  document.getElementById('calendar-jump').addEventListener('click', () => {
    yearInput.value = calendarYear;
    updateMonthSelection();
    monthDialog.showModal();
  });
  function updateMonthSelection() {
    document.querySelectorAll('[data-calendar-month]').forEach(button => button.setAttribute('aria-pressed', String(Number(yearInput.value) === calendarYear && Number(button.dataset.calendarMonth) === calendarMonth)));
  }
  yearInput.addEventListener('input', updateMonthSelection);
  for (const [id, delta] of [['calendar-year-previous', -1], ['calendar-year-next', 1]]) document.getElementById(id).addEventListener('click', () => {
    if (!yearInput.reportValidity()) return;
    yearInput.value = Math.min(9999, Math.max(1, Number(yearInput.value) + delta));
    updateMonthSelection();
  });
  for (let month = 1; month <= 12; month += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.calendarMonth = month;
    button.innerHTML = ["<b>", uiText(month), "</b><span>", uiText("月", null), "</span>"].join('');
    button.addEventListener('click', () => {
      if (!yearInput.reportValidity()) return;
      goToMonth(Number(yearInput.value), month);
      monthDialog.close();
    });
    document.getElementById('calendar-month-options').append(button);
  }

  const regionDialog = document.getElementById('calendar-region-dialog');
  const regionOptions = document.getElementById('calendar-region-options');
  for (const [key, code, label] of regionGroups) {
    const option = document.createElement('label');
    option.dataset.colorRegion = key;
    option.innerHTML = ["<input type=\"checkbox\" value=\"", String(key), "\"><span class=\"region-option-color\"></span><span><b>", uiText(code), "</b><small>", uiText(label), "</small></span><span class=\"region-option-check\" aria-hidden=\"true\">✓</span>"].join('');
    regionOptions.append(option);
  }
  function updateRegionCount() {
    document.getElementById('calendar-region-count').textContent = uiText(calendarUi(`已选 ${regionOptions.querySelectorAll('input:checked').length} / 9`, `Selected ${regionOptions.querySelectorAll('input:checked').length} / 9`, `${regionOptions.querySelectorAll('input:checked').length} / 9 選択`));
  }
  document.getElementById('calendar-regions').addEventListener('click', () => {
    regionOptions.querySelectorAll('input').forEach(input => { input.checked = selectedRegions.has(input.value); });
    updateRegionCount();
    regionDialog.showModal();
  });
  regionOptions.addEventListener('change', updateRegionCount);
  for (const [id, checked] of [['calendar-regions-all', true], ['calendar-regions-none', false]]) document.getElementById(id).addEventListener('click', () => {
    regionOptions.querySelectorAll('input').forEach(input => { input.checked = checked; });
    updateRegionCount();
  });
  document.getElementById('calendar-regions-apply').addEventListener('click', () => {
    selectedRegions = new Set([...regionOptions.querySelectorAll('input:checked')].map(input => input.value));
    renderCalendar();
    regionDialog.close();
  });

  const status = document.getElementById('calendar-update');
  const refresh = document.getElementById('calendar-refresh');
  const network = document.getElementById('calendar-demo-network');
  if (desktopData) {
    const sourceList = document.createElement('ul');
    sourceList.id = 'desktop-schedule-sources';
    status.after(sourceList);
    const schedule = desktopData.schedule;
    const paint = () => {
      const year = schedule.state(calendarYear);
      const results = year.providersExpected.map(provider => year.providers[provider]);
      const offline = desktopData.offline || navigator.onLine === false;
      const failed = results.some(item => item?.status === 'failed');
      const obtained = results.some(item => item?.fetchedAt);
      const unpublished = results.some(item => item?.status === 'unpublished');
      const state = year.checking ? 'checking' : offline ? 'offline' : failed ? 'failed' : 'success';
      status.dataset.state = state;
      status.setAttribute('aria-busy', String(year.checking));
      status.querySelector('.update-orb').textContent = { checking: '↻', success: '✓', offline: '◇', failed: '!' }[state];
      refresh.disabled = year.checking || !year.providersExpected.length;
      document.getElementById('calendar-update-title').textContent = year.checking
        ? devText('正在检查赛程', 'Checking schedules', '日程を確認中')
        : offline ? devText('离线 · 显示本地赛历', 'Offline · Local calendar', 'オフライン · ローカル日程')
        : failed ? devText('部分赛程更新失败', 'Some schedule updates failed', '一部の日程を更新できませんでした')
        : unpublished ? devText('部分年度目录尚未取得', 'Some annual schedules are unavailable', '一部の年間日程は未取得')
        : obtained ? devText('赛程已载入', 'Schedules loaded', '日程を取得済み')
        : devText('显示本地赛历', 'Showing local calendar', 'ローカル日程を表示中');
      const latest = results.map(item => item?.fetchedAt).filter(Boolean).sort().at(-1);
      document.getElementById('calendar-update-copy').textContent = latest
        ? devText('上次成功 ', 'Last success ', '最終取得 ') + updateTime(latest)
        : devText('已取得的本地资料仍可浏览', 'Previously saved data remains available', '保存済みデータを表示できます');
      const labels = {
        archive: devText('随包档案', 'Bundled archive', '同梱アーカイブ'),
        success: devText('已保存', 'Saved', '保存済み'),
        failed: devText('获取失败', 'Fetch failed', '取得失敗'),
        unpublished: devText('年度目录未取得', 'Annual directory unavailable', '年間日程は未取得')
      };
      sourceList.replaceChildren(...year.providersExpected.map(provider => {
        const item = document.createElement('li');
        const result = year.providers[provider];
        item.textContent = `${{ jra: 'JAIRS / JRA', nar: 'NAR', ifha: 'IFHA' }[provider]} · ${labels[result?.status] || '—'}`
          + (result?.fetchedAt ? ` · ${updateTime(result.fetchedAt)}` : result?.archivedAt ? ` · ${updateTime(result.archivedAt)}` : '');
        if (result?.rankingYear) {
          item.textContent += devText(` · ${result.rankingYear} 前百榜单`, ` · ${result.rankingYear} Top 100`, ` · ${result.rankingYear}年トップ100`);
          if (result.rankingArchived) item.textContent += devText('（档案）', ' (archive)', '（アーカイブ）');
        }
        if (result?.matchedCount) item.textContent += devText(` · 已匹配 ${result.matchedCount} 场`, ` · ${result.matchedCount} matched`, ` · ${result.matchedCount}件照合済み`);
        if (result?.conflicts) item.textContent += devText(` · ${result.conflicts} 场日期待核`, ` · ${result.conflicts} fixture conflicts`, ` · ${result.conflicts}件の日程要確認`);
        if (result?.error) item.title = result.error;
        return item;
      }));
    };

    loadCalendarMonth = force => {
      const year = calendarYear;
      paint();
      return schedule.collect(year, force, () => {
        syncDesktopRaces();
        if (calendarYear === year) { paint(); renderCalendar(); }
      }).catch(console.error);
    };
    refresh.addEventListener('click', () => loadCalendarMonth(true));
    refreshCalendarPreview = () => loadCalendarMonth(true);

    let resultRequest;
    let updateCache;
    const updateRace = race => {
      if (dialog.open && activeRace.id === race.id) {
        if (activeRace !== race) Object.assign(activeRace, race);
        document.getElementById('race-title').textContent = activeRace.name;
        document.getElementById('race-title').lang = activeRace.nameLang;
        document.getElementById('race-region').textContent = activeRace.place;
        dialog.dataset.colorRegion = countryColors[activeRace.country] || 'other';
        dialog.dataset.odds = race.realResult?.runners.some(runner => runner.odds) ? 'available' : 'unavailable';
        renderLiveSource(activeRace, refreshDesktopResult);
        if (race.startAt) {
          document.getElementById('race-start-time').textContent = clockInZone(race.startAt, displayTimeZone);
          document.getElementById('race-date').textContent = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'long', timeZone: displayTimeZone }).format(new Date(race.startAt));
          document.getElementById('race-display-zone').textContent = devText('电脑时区 · ', 'Computer time zone · ', 'PCのタイムゾーン · ') + displayTimeZone;
        }
        if (dialog.dataset.panel === 'race') {
          const resultWasUnavailable = document.querySelector('[data-race-view-option="results"]').disabled;
          setRaceView(race.sampleFinished && resultWasUnavailable ? 'results' : raceView);
        } else if (dialog.dataset.panel === 'horse' && race.refreshState === 'success') {
          const runner = race.realResult?.runners.find(runner => String(runner.number) === document.getElementById('horse-emblem').textContent);
          if (runner && !runner.horseId) {
            const scroll = dialog.scrollTop;
            renderLiveHorse(activeRace, runner, desktopData.offline, finishTier, showRace);
            dialog.scrollTop = scroll;
          }
        }
      }
      renderCalendar();
    };
    refreshDesktopResult = (race = desktopData.race) => {
      if (race !== desktopData.race) return desktopData.details.load(race, () => updateRace(race));
      if (resultRequest) return resultRequest;
      race.refreshState = 'checking';
      race.lookup = { startedAt: Date.now(), stage: 'japan-result', attempts: [], hadData: Boolean(race.realResult) };
      updateRace(race);
      return resultRequest ??= (async () => {
        try {
          race.refreshState = await desktopData.refresh() ? 'success' : 'unavailable';
        } catch (error) {
          race.refreshState = desktopData.offline || navigator.onLine === false ? 'offline' : 'failed';
          race.failureKind = /timeout|timed out/i.test(error.message) ? 'timeout' : /SSL|TLS|secure connection/i.test(error.message) ? 'tls' : 'source';
        }
        race.lookup.duration = Date.now() - race.lookup.startedAt;
        race.lookup.attempts.push({ stage: 'japan-result', state: race.refreshState === 'success' ? 'success' : 'failed', duration: race.lookup.duration });
        updateCache?.();
        updateRace(race);
        return race.refreshState === 'success';
      })().finally(() => { resultRequest = null; });
    };
    collection = createCollection(desktopData, year => {
      renderCollection();
      updateCache();
      if (year !== undefined) {
        syncDesktopRaces();
        if (year === calendarYear) { paint(); renderCalendar(); }
      }
    });
    const renderCollection = configureCollectionStatus(desktopData, collection);
    updateCache = configureLocalCache(desktopData, collection);
    renderCollection();
    paint();
    return;
  }
  let refreshTimer;
  if (['offline', 'failed'].includes(previewParams.get('network'))) network.value = previewParams.get('network');
  function showUpdateState(state) {
    const copy = {
      checking: ['正在后台检查新资料', '先浏览已保存的赛历 · 不影响日历操作', '↻', '检查中…'],
      success: ['赛历已就绪', '资料更新于 2026.10.20 18:20（示例）', '✓', '检查更新 ↻'],
      offline: ['当前离线 · 已保存的赛历仍可浏览', '上次资料更新于 2026.10.20 18:20（示例）', '◇', '重新检查 ↻'],
      failed: ['部分来源更新失败 · 已保留原资料', 'JRA 暂未取得新资料 · 上次更新 2026.10.20 18:20（示例）', '!', '手动重试 ↻']
    }[state];
    status.dataset.state = state;
    document.getElementById('calendar-update-title').textContent = uiText(copy[0]);
    document.getElementById('calendar-update-copy').textContent = uiText(copy[1]);
    status.querySelector('.update-orb').textContent = uiText(copy[2]);
    refresh.textContent = uiText(copy[3]);
    refresh.disabled = state === 'checking';
    status.setAttribute('aria-busy', String(state === 'checking'));
    const translated = { checking: ['Checking for updates', 'Your saved calendar remains available', 'Checking…'], success: ['Calendar ready', 'Sample data · 2026-10-20 18:20', 'Check updates ↻'], offline: ['Offline · Showing saved calendar', 'Last available sample: 2026-10-20 18:20', 'Try again ↻'], failed: ['Some sources failed · Saved data retained', 'JRA update unavailable · Previous sample retained', 'Retry manually ↻'] }[state];
    if (previewParams.get('lang') === 'en') { document.getElementById('calendar-update-title').textContent = uiText(translated[0]); document.getElementById('calendar-update-copy').textContent = uiText(translated[1]); refresh.textContent = uiText(translated[2]); }
  }
  function checkUpdates() {
    clearTimeout(refreshTimer);
    if (network.value === 'offline') { showUpdateState('offline'); return; }
    showUpdateState('checking');
    // 一次性延迟仅模拟本轮检查，不请求来源、不自动重试或轮询。
    refreshTimer = setTimeout(() => {
      showUpdateState(network.value);
      document.getElementById('calendar-checked-at').textContent = uiText(calendarUi(` · 最近检查 ${clockInZone(new Date(), displayTimeZone)}（演示）`, ` · Last checked ${clockInZone(new Date(), displayTimeZone)} (sample)`, ` · 最終確認 ${clockInZone(new Date(), displayTimeZone)}（サンプル）`));
      if (network.value === 'success') gamePreview?.processRefreshedChanges();
    }, 900);
  }
  refresh.addEventListener('click', checkUpdates);
  network.addEventListener('change', () => {
    clearTimeout(refreshTimer);
    showUpdateState(network.value);
  });
  refreshCalendarPreview = checkUpdates;
  checkUpdates();
}

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    if (dailyCalendar) selectedRegions = new Set(regionGroups.map(([key]) => key).filter(key => activeFilter === 'all' || (activeFilter === 'jp' ? key === 'jp' : key !== 'jp')));
    document.querySelectorAll('[data-filter]').forEach(filter => {
      const selected = filter === button;
      filter.classList.toggle('active', selected);
      filter.setAttribute('aria-pressed', String(selected));
    });
    renderCalendar();
  });
});

document.querySelectorAll('[data-zone-preview]').forEach(button => {
  button.addEventListener('click', () => {
    zonePreview = button.dataset.zonePreview;
    computerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    displayTimeZone = zonePreview === 'auto' ? computerTimeZone : zonePreview;
    document.querySelectorAll('[data-zone-preview]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderCalendar();
  });
});
// Only the local date display is checked here; this never requests race data.
let calendarClockTimer;
let calendarClockStamp = null;
function checkCalendarClock() {
  clearTimeout(calendarClockTimer);
  const now = new Date();
  computerTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zonePreview === 'auto') displayTimeZone = computerTimeZone;
  const today = dateInZone(now, displayTimeZone);
  const stamp = `${displayTimeZone}/${today.year}-${today.month}-${today.day}`;
  if (calendarClockStamp !== null && stamp !== calendarClockStamp) renderCalendar();
  calendarClockStamp = stamp;
  calendarClockTimer = setTimeout(checkCalendarClock, 60000 - (now.getTime() % 60000) + 25);
}
window.addEventListener('focus', checkCalendarClock);
window.addEventListener('pageshow', checkCalendarClock);
window.addEventListener('pagehide', () => clearTimeout(calendarClockTimer));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(calendarClockTimer);
  else checkCalendarClock();
});

const rankingLink = document.getElementById('ranking-source-link');
rankingLink.href = rankingSource.url;
rankingLink.textContent = uiText("{0} 年官方榜单 ↗", {0: rankingSource.year});
importanceSamples.sort(compareRaceImportance).forEach((race, index) => {
  const item = document.createElement('li');
  const priority = priorityRaceIds.has(race.id);
  item.innerHTML = ["<span class=\"importance-number\">", uiText(index + 1), "</span><b>", uiText(race.name), "</b><span class=\"importance-tier", String(priority ? ' is-priority' : ''), "\">", uiText(priority ? '优先组' : '其余赛事'), "</span><small>", uiText(raceRanks[race.id] ? `官方 #${raceRanks[race.id]}` : '未入榜'), "</small>"].join('');
  item.dataset.raceId = race.id;
  document.getElementById('importance-preview-list').append(item);
});

dialog.querySelectorAll('.close-button, .close-dialog').forEach(button => button.addEventListener('click', () => dialog.close()));
document.querySelectorAll('#back-to-entries, .horse-back-button').forEach(button => button.addEventListener('click', backToEntries));
document.querySelectorAll('#back-to-horse, .history-back-button, #history-horse-name').forEach(button => button.addEventListener('click', backToHorse));
document.getElementById('horse-race-name').addEventListener('click', backToEntries);
document.getElementById('odds-preview').addEventListener('change', event => {
  if (activeRace.sampleEntriesConfirmed === true) activeRace.sampleOfficialOdds = event.target.checked;
  setOddsPreview(event.target.checked);
  gamePreview?.updateRaceAction(activeRace);
});
document.getElementById('odds-failure-preview').addEventListener('click', () => {
  oddsRefreshFailed = !oddsRefreshFailed;
  setOddsPreview(document.getElementById('odds-preview').checked);
});
document.querySelectorAll('[data-entry-view-option]').forEach(button => {
  button.addEventListener('click', () => setEntryView(button.dataset.entryViewOption));
});
document.querySelectorAll('[data-race-view-option]').forEach(button => {
  button.addEventListener('click', () => setRaceView(button.dataset.raceViewOption));
});
document.querySelectorAll('[data-entry-preview]').forEach(button => {
  button.addEventListener('click', () => {
    entryView = button.dataset.entryPreview;
    oddsRefreshFailed = false;
    document.getElementById('odds-preview').checked = button.hasAttribute('data-odds-preview');
    showRace(races.find(race => race.id === 'shuka'), button);
  });
});
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('entry');
  url.searchParams.delete('race');
  url.searchParams.delete('odds');
  url.searchParams.delete('horse');
  url.searchParams.delete('past');
  url.searchParams.delete('view');
  window.history.replaceState(null, '', url);
  const visibleOpener = opener?.isConnected && !opener.closest('[hidden], dialog:not([open])');
  const returnTarget = (visibleOpener ? opener : activeRace ? calendar.querySelector(`[data-race-id="${activeRace.id}"]`) : null) || document.querySelector('.game-shop-launcher');
  const foldedDay = returnTarget?.closest('.day-more');
  if (foldedDay) foldedDay.open = true;
  returnTarget?.focus();
});
if (dailyCalendar) initDailyCalendar();
gamePreview = createGamePreview({
  races, entries: sampleEntries, horseNames: sampleHorseNames, countryColors,
  storedWallet: desktopData?.wallet,
  saveWallet: desktop ? json => native('wallet', json) : null,
  showRace: (race, button) => { entryView = 'compact'; showRace(race, button); },
  closeRace: () => { if (dialog.open) dialog.close(); },
  renderCalendar,
  requestRefresh: () => refreshCalendarPreview ? refreshCalendarPreview() : gamePreview.processRefreshedChanges(),
  showOdds: () => setOddsPreview(true),
  getOddsStatus: race => document.getElementById('calendar-demo-network')?.value === 'offline' || navigator.onLine === false ? 'offline' : oddsRefreshFailed || race?.sampleUpdateFailures?.some(item => item.field === 'odds') || (race?.sampleQuality && qualityCaseFor(race).failed) ? 'failed' : 'success'
});
initDetailReview(window.location.search, document);
initQualityLinks(qualityPreviewKey, window.location.search, document);
initAvailabilityLinks(availabilityPreview, window.location.search, document);
initQualityDialog(document);
if (qualityRace) gamePreview.loadQualityExample(qualityRace);
document.documentElement.lang = calendarUi('zh-CN', 'en', 'ja');
for (const element of document.querySelectorAll('[data-ui-aria-en]')) { const copy = calendarUi(null, element.dataset.uiAriaEn, element.dataset.uiAriaJa); if (copy) element.setAttribute('aria-label', uiText(copy)); }
document.title = uiText(calendarUi('GⅠ 赛马日历', 'GⅠ Race Calendar', 'GⅠ レースカレンダー'));
if (previewParams.get('lang') === 'en') document.querySelectorAll('.weekday-row > div').forEach((element, index) => { element.childNodes[0].textContent = uiText(['MON','TUE','WED','THU','FRI','SAT','SUN'][index]); });
for (const element of document.querySelectorAll('[data-ui-en]')) {
  const copy = calendarUi(null, element.dataset.uiEn, element.dataset.uiJa || null);
  if (!copy) continue;
  const text = Array.from(element.childNodes).find(node => node.nodeType === 3 && node.textContent.trim());
  if (text) text.textContent = uiText(copy);
}
renderCalendar();
if (desktopData) {
  document.dispatchEvent(new Event('desktop-calendar-ready'));
  if (desktopData.backgroundCollection) collection?.run();
  if (previewParams.get('page') !== 'cache') loadCalendarMonth(false);
}

// 设计评审链接可直接打开指定版本，不需要先找到日历中的赛事。
const backgroundChoice = previewParams.get('background');
const backgroundStudies = {
  flash: ['荣进闪耀 · 左侧半身背景预览', '使用已选半身线稿，放在月历左侧，沿用当前配色。'],
  'agnes-a': ['爱丽数码 A · 合掌应援', '第一轮合掌半身方案，保留供对比。'],
  'agnes-b': ['爱丽数码 B · 认真记录', '第一轮笔记半身方案，保留供对比。'],
  'agnes-detective': ['爱丽数码 · 侦探半身线稿', '按参考图保留蝴蝶结侦探帽、放大镜与前倾神态，转为淡紫透明线稿。']
};
if (!dailyCalendar && Object.hasOwn(backgroundStudies, backgroundChoice)) {
  document.body.dataset.calendarBackground = 'flash';
  document.body.dataset.calendarCharacter = backgroundChoice;
  document.getElementById('background-review').hidden = false;
  document.getElementById('background-preview-title').textContent = uiText(backgroundStudies[backgroundChoice][0]);
  document.getElementById('background-preview-copy').textContent = uiText(backgroundStudies[backgroundChoice][1]);
  document.querySelectorAll('[data-background-choice]').forEach(link => link.setAttribute('aria-current', link.dataset.backgroundChoice === backgroundChoice ? 'page' : 'false'));
  document.title = uiText("GⅠ 赛马日历 · {0}", {0: backgroundStudies[backgroundChoice][0]});
}
if (!desktop && (previewParams.get('entry') === 'compact' || previewParams.get('entry') === 'detailed')) {
  entryView = previewParams.get('entry');
  oddsRefreshFailed = previewParams.get('odds') === 'failed' || previewParams.get('odds') === 'failed-empty';
  document.getElementById('odds-preview').checked = previewParams.get('odds') === 'sample' || previewParams.get('odds') === 'failed';
  const race = races.find(item => item.id === previewParams.get('race')) || races.find(item => item.id === 'shuka');
  showRace(race, document.querySelector(`[data-entry-preview="${entryView}"]`));
  if (previewParams.get('view') === 'entries' || previewParams.get('view') === 'results') setRaceView(previewParams.get('view'));
  const horseIndex = sampleEntries.findIndex(entry => String(entry.number) === previewParams.get('horse'));
  if (horseIndex !== -1) {
    showHorse(horseIndex, document.querySelector(`[data-horse-number="${sampleEntries[horseIndex].number}"]`));
    const pastIndex = Number(previewParams.get('past')) - 1;
    if (Number.isInteger(pastIndex) && pastIndex >= 0 && pastIndex < samplePastRaceDetails.length) {
      showPastRace(horseIndex, pastIndex, document.querySelector(`[data-past-race="${pastIndex}"]`));
    }
  }
}
gamePreview.openFromParams();
checkCalendarClock();

}

if (desktop) {
  loadDesktopData().then(startCalendar).catch(error => {
    const status = document.getElementById('calendar-update');
    status.hidden = false;
    status.dataset.state = 'failed';
    document.getElementById('calendar-update-title').textContent = devText('无法打开本地赛历', 'Could not open the local calendar', 'ローカルカレンダーを開けません');
    document.getElementById('calendar-update-copy').textContent = error.message;
    throw error;
  });
} else {
  startCalendar(null);
}

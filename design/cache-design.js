import { uiText, uiList } from './ui-language.mjs?v=76';
// 缓存管理交互设计：只修改内存中的固定样例，不读取文件、联网或持久保存。
import { previewLinks, unifiedPreview } from './preview-navigation.mjs?v=76';
import { desktop } from './desktop-bridge.mjs';
if (!desktop) {
const initialYears = [
  { year: 2023, scope: 'dates', baseMB: 0.4, detailMB: 0, updated: '2026.10.20 18:40' },
  { year: 2024, scope: 'results', baseMB: 0.4, detailMB: 24.4, updated: '2026.10.20 18:40' },
  { year: 2025, scope: 'results', baseMB: 0.4, detailMB: 28.2, updated: '2026.10.20 18:40' },
  { year: 2026, scope: 'full', baseMB: 0.6, detailMB: 129.6, updated: '2026.10.20 18:40' },
  { year: 2027, scope: 'dates', baseMB: 0.4, detailMB: 0, updated: '2026.10.20 18:40' },
  { year: 2028, scope: 'dates', baseMB: 0.2, detailMB: 0, updated: '2026.10.20 18:40' }
];
const demoNewTime = '2026.10.21 14:30';
const calendarView = document.getElementById('calendar-view');
const cacheView = document.getElementById('cache-view');
const clearDialog = document.getElementById('cache-clear-dialog');
let years = initialYears.map(year => ({ ...year, state: 'saved' }));
let collectionState = 'collecting';
let collectionProgress = 72;
let offline = false;
let clearYear = null;
let clearOpener = null;
let queryYear = null;
let pageOpener = null;
let calendarScroll = 0;

function announce(message, year = null) {
  queryYear = year;
  document.getElementById('cache-notice-text').textContent = uiText(message);
  document.getElementById('cache-notice').hidden = false;
  document.getElementById('cache-query-one').hidden = year === null;
  document.getElementById('cache-query-one').disabled = offline;
}

function showPage(page, button = null) {
  const showCache = page === 'cache';
  if (showCache && !calendarView.hidden) {
    calendarScroll = window.scrollY;
    pageOpener = button;
  }
  const raceDialog = document.getElementById('race-dialog');
  if (raceDialog.open) raceDialog.close();
  calendarView.hidden = showCache;
  cacheView.hidden = !showCache;
  document.querySelectorAll('[data-open-cache]').forEach(item => item.setAttribute('aria-current', showCache ? 'page' : 'false'));
  const url = new URL(window.location.href);
  for (const key of ['entry', 'race', 'horse', 'odds', 'past', 'view']) url.searchParams.delete(key);
  if (showCache) url.searchParams.set('page', 'cache');
  else url.searchParams.delete('page');
  window.history.replaceState(null, '', url);
  document.title = uiText(showCache ? 'GⅠ 赛马日历 · 设置／缓存管理设计' : 'GⅠ 赛马日历 · 前端设计');
  window.scrollTo(0, showCache ? 0 : calendarScroll);
  if (!showCache) pageOpener?.focus({ preventScroll: true });
}

function renderCollection() {
  const current = years.find(year => year.year === 2026);
  let state = collectionState;
  if (state === 'collecting' && offline) state = 'offline';
  if (state === 'cleared' && current.state === 'partial') state = 'on-demand';
  const labels = { collecting: '收集中 · 示例', paused: '已暂停 · 示例', complete: '收集完成 · 示例', offline: '等待联网 · 示例', cleared: '本年详情已清理', 'on-demand': '按需保存 · 示例' };
  const notes = {
    collecting: '赛历已可浏览，正在补充本年资料；尚未公布的出马表等待后续更新。',
    paused: '已保存的资料继续保留。恢复后接着收集，不需要从头开始。',
    complete: '当前示例中已公布的资料已补齐；之后按需检查新增信息。',
    offline: '本地资料仍可浏览。联网后继续补充，旧赔率会标明更新时间。',
    cleared: '日期气泡保留；不会自动重下整年资料。可按需补查，或选择具体年份重新下载。',
    'on-demand': '日期气泡和已补查的资料保留；不会自动重下整年资料。'
  };
  const status = document.getElementById('cache-collection-state');
  status.textContent = uiText(labels[state]);
  status.dataset.state = state;
  document.querySelector('.cache-collection').dataset.state = state;
  document.getElementById('cache-progress').value = collectionProgress;
  document.getElementById('cache-progress-value').textContent = uiText("{0}%", {0: collectionProgress});
  document.getElementById('cache-progress-description').textContent = uiText(state === 'cleared' || state === 'on-demand' ? '整年收集已停止，详细资料按需补查' : '2026 年 · 赛事、出走与相关马匹资料');
  document.getElementById('cache-collection-note').textContent = uiText(notes[state]);
  const action = document.getElementById('cache-collection-action');
  action.hidden = state === 'complete';
  action.disabled = offline;
  action.textContent = uiText(offline ? '联网后继续' : collectionState === 'cleared' ? '重新下载 2026 年资料' : state === 'paused' ? '继续收集' : '暂停收集');
  const historicalStep = document.querySelector('.cache-collection-steps>span:nth-child(2)');
  const historicalReady = years.filter(year => year.scope === 'results').every(year => year.state === 'saved');
  historicalStep.querySelector('i').textContent = uiText(historicalReady ? '✓' : '–');
  historicalStep.querySelector('small').textContent = uiText(historicalReady ? '2024、2025 年资料' : '已清理年份按需补查');
  historicalStep.classList.toggle('cache-step-incomplete', !historicalReady);
  const currentStep = document.querySelector('.cache-step-current');
  currentStep.querySelector('i').textContent = uiText(state === 'complete' ? '✓' : '3');
  document.getElementById('cache-demo-complete').disabled = offline || collectionState === 'cleared' || collectionState === 'complete';
}

function renderYears() {
  const list = document.getElementById('cache-year-list');
  list.replaceChildren();
  for (const year of years) {
    const row = document.createElement('li');
    row.className = `cache-year-row${year.year === 2026 ? ' cache-year-current' : ''}`;
    row.dataset.cacheYear = year.year;
    let title = year.scope === 'full' ? '赛事详情与马匹资料' : year.scope === 'results' ? '出马表与比赛排名' : '已公布的日期气泡';
    let detail = year.scope === 'full' ? '基础赛程 · 出走情况 · 赛果 · 相关马匹' : year.scope === 'results' ? '基础赛程 · 具体出走名单 · 比赛排名' : year.year > 2026 ? '尚未公布的日期等待来源更新' : '只保存日期气泡，未收集详细资料';
    if (year.state === 'cleared') {
      title = '详细资料已清理';
      detail = '日期气泡保留 · 之后按需联网补查';
    } else if (year.state === 'partial') {
      title = '已按需保存 1 场比赛资料';
      detail = '其他比赛详情仍待查询，未重新收集整年';
    } else if (year.year === 2026 && collectionState === 'collecting') {
      detail = uiList([detail, offline ? ' · 等待联网' : ' · 正在补齐'], '');
    }
    row.innerHTML = ["<div class=\"cache-year-number\"><strong>", uiText(year.year), "</strong>", uiText(year.year === 2026 ? ["<span>", uiText("本年", null), "</span>"].join('') : ''), "</div><div class=\"cache-year-content\"><b>", uiText(title), "</b><span>", uiText(detail), "</span></div><div class=\"cache-year-updated\"><b>", uiText(year.updated.split(' ')[0]), "</b><span>", uiText("{5} 更新", {5: year.updated.split(' ')[1]}), "</span></div><div class=\"cache-year-size\"><b>", uiText((year.baseMB + year.detailMB).toFixed(1)), " ", "<small>MB</small></b><span>", uiText("日期气泡 {7} MB", {7: year.baseMB.toFixed(1)}), "</span></div><div class=\"cache-year-actions\"></div>"].join('');
    const actions = row.querySelector('.cache-year-actions');
    if (year.detailMB > 0) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'cache-year-clear';
      clear.textContent = uiText('清理详情');
      clear.setAttribute('aria-label', uiText("清理 {0} 年详细资料", {0: year.year}));
      clear.addEventListener('click', () => openClearDialog(year, clear));
      actions.append(clear);
    }
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'cache-year-restore';
    restore.textContent = uiText("{0} 年重下", {0: year.year});
    restore.disabled = offline;
    restore.setAttribute('aria-label', uiText("重新下载 {0} 年资料", {0: year.year}));
    restore.title = uiText(year.scope === 'dates' ? '更新该年已公布的日期气泡' : year.scope === 'results' ? '重新下载该年出马表与比赛排名' : '重新下载该年赛事、出走与相关马匹资料');
    restore.addEventListener('click', () => collectYear(year));
    actions.append(restore);
    if (year.scope === 'dates') {
      const label = document.createElement('span');
      label.className = 'cache-dates-only';
      label.textContent = uiText('仅日期气泡');
      actions.append(label);
    }
    list.append(row);
  }
}

function renderCache() {
  document.getElementById('cache-total-size').innerHTML = [uiText(years.reduce((sum, year) => sum + year.baseMB + year.detailMB, 0).toFixed(1)), " ", "<small>MB</small>"].join('');
  const lastUpdated = years.map(year => year.updated).sort().at(-1);
  document.getElementById('cache-last-updated').textContent = uiText(lastUpdated.split(' ')[0]);
  document.getElementById('cache-last-updated-time').textContent = uiText("{0} · 示例资料更新时间", {0: lastUpdated.split(' ')[1]});
  document.getElementById('cache-offline-banner').hidden = !offline;
  document.getElementById('cache-check-updates').disabled = offline;
  document.getElementById('cache-demo-offline').setAttribute('aria-pressed', String(offline));
  document.getElementById('cache-demo-offline').textContent = uiText(offline ? '返回在线示例' : '预览离线状态');
  document.getElementById('cache-query-one').disabled = offline;
  renderCollection();
  renderYears();
}

function openClearDialog(year, button) {
  clearYear = year.year;
  clearOpener = button;
  document.getElementById('cache-clear-title').textContent = uiText("清理 {0} 年详细资料？", {0: year.year});
  document.getElementById('cache-clear-description').textContent = uiText("预计释放 {0} MB，日期气泡仍占用 {1} MB。", {0: year.detailMB.toFixed(1), 1: year.baseMB.toFixed(1)});
  document.getElementById('cache-clear-items').textContent = uiText(year.scope === 'full' ? '该年的出马表、赛果及相关马匹资料' : '该年已保存的出马表与比赛排名');
  clearDialog.showModal();
}

function collectYear(year) {
  if (year.year === 2026) {
    collectionState = 'collecting';
    collectionProgress = 0;
    year.state = 'saved';
    announce(uiText('已演示开始重新下载 2026 年资料，已有缓存继续保留。可用上方“预览收集完成”查看结束状态。'));
  } else {
    const initial = initialYears.find(item => item.year === year.year);
    if (year.scope !== 'dates') year.detailMB = initial.detailMB;
    year.state = 'saved';
    year.updated = demoNewTime;
    announce(uiText(year.scope === 'dates'
      ? `已演示重新下载 ${year.year} 年已公布的日期气泡，已额外查询的详情保留。`
      : `已演示重新下载 ${year.year} 年的出马表与比赛排名；其他年份资料保留。`));
  }
  renderCache();
}

document.querySelectorAll('[data-open-cache]').forEach(button => button.addEventListener('click', () => showPage('cache', button)));
document.querySelectorAll('[data-back-calendar]').forEach(button => button.addEventListener('click', () => showPage('calendar', button)));
document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  showPage('calendar');
});
document.getElementById('cache-collection-action').addEventListener('click', () => {
  if (collectionState === 'cleared') collectYear(years.find(year => year.year === 2026));
  else {
    collectionState = collectionState === 'paused' ? 'collecting' : 'paused';
    renderCache();
  }
});
document.getElementById('cache-demo-complete').addEventListener('click', () => {
  collectionState = 'complete';
  collectionProgress = 100;
  const current = years.find(year => year.year === 2026);
  current.detailMB = 179.6;
  current.updated = demoNewTime;
  current.state = 'saved';
  announce(uiText('收集完成状态 · 示例。本年当前已公布的资料已补齐，未公布资料仍等待更新。'));
  renderCache();
});
document.getElementById('cache-demo-offline').addEventListener('click', () => {
  offline = !offline;
  renderCache();
});
document.getElementById('cache-check-updates').addEventListener('click', () => {
  announce(uiText('已演示检查更新：2026.10.21 14:30。资料更新时间保持独立；已清理年份不会自动重下。'));
});
document.getElementById('cache-clear-confirm').addEventListener('click', () => {
  const year = years.find(item => item.year === clearYear);
  const freed = year.detailMB;
  year.detailMB = 0;
  year.state = 'cleared';
  if (year.year === 2026) {
    collectionState = 'cleared';
    collectionProgress = 0;
  }
  announce(uiText("已演示清理 {0} 年详情，释放 {1} MB；日期气泡和其他年份资料保留。", {0: year.year, 1: freed.toFixed(1)}), year.year);
  renderCache();
  clearDialog.close();
});
document.getElementById('cache-query-one').addEventListener('click', () => {
  const year = years.find(item => item.year === queryYear);
  year.detailMB = 0.8;
  year.state = 'partial';
  year.updated = demoNewTime;
  announce(uiText("已演示按需补查 {0} 年的 1 场比赛，新增 0.8 MB；其余比赛没有整年重下。", {0: year.year}));
  renderCache();
});
document.querySelectorAll('.cache-clear-close, #cache-clear-cancel').forEach(button => button.addEventListener('click', () => clearDialog.close()));
clearDialog.addEventListener('click', event => {
  const bounds = clearDialog.getBoundingClientRect();
  if (event.target === clearDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) clearDialog.close();
});
clearDialog.addEventListener('close', () => {
  const target = clearOpener?.isConnected ? clearOpener : document.querySelector(`[data-cache-year="${clearYear}"] button`);
  target?.focus({ preventScroll: true });
});
document.getElementById('cache-demo-reset').addEventListener('click', () => {
  years = initialYears.map(year => ({ ...year, state: 'saved' }));
  collectionState = 'collecting';
  collectionProgress = 72;
  offline = false;
  queryYear = null;
  document.getElementById('cache-notice').hidden = true;
  renderCache();
});
document.getElementById('cache-dismiss-notice').addEventListener('click', () => {
  document.getElementById('cache-notice').hidden = true;
});

renderCache();
const cacheLanguage = new URLSearchParams(window.location.search).get('lang');
const cacheFromCalendar = new URLSearchParams(window.location.search).get('from') === 'calendar';
document.getElementById('cache-back-settings').href = `settings.html?lang=${['zh', 'ja', 'en'].includes(cacheLanguage) ? cacheLanguage : 'zh'}${cacheFromCalendar ? '&from=calendar' : ''}&v=33`;
if (unifiedPreview(window.location.href)) {
  document.getElementById('cache-back-settings').href = previewLinks(window.location.href).language;
  document.querySelector('.cache-demo-toolbar span').textContent = uiText('流程预览：本页仍是独立缓存样例；返回月历会恢复所选收集场景，不进行实际下载或清理。');
}
if (new URLSearchParams(window.location.search).get('page') === 'cache') showPage('cache');
}

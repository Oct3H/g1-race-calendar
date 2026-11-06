import { uiText } from './ui-language.mjs?v=76';
// Isolated first-collection design preview. No network, storage or game calls.
export const collectionScenes = ['finding', 'details', 'failed', 'offline', 'offline-empty', 'complete'];

export function createCollectionPreview(scene = 'details', pausedFrom = 'details') {
  if (scene === 'paused') return { scene, pausedFrom: ['finding', 'details'].includes(pausedFrom) ? pausedFrom : 'details', expanded: false, notice: false };
  return { scene: collectionScenes.includes(scene) ? scene : 'details', pausedFrom: null, expanded: false, notice: false };
}

export function collectionView(state) {
  const scene = state.scene === 'paused' ? state.pausedFrom : state.scene;
  const hasDates = !['finding', 'offline-empty'].includes(scene);
  return { hasDates, running: state.scene !== 'paused' && ['finding', 'details'].includes(scene),
    canPause: ['finding', 'details'].includes(state.scene), canResume: state.scene === 'paused',
    canCheck: ['failed', 'offline', 'offline-empty'].includes(state.scene),
    tone: state.scene === 'failed' ? 'amber' : ['paused', 'offline', 'offline-empty'].includes(state.scene) ? 'muted' : 'green',
    completed: state.scene === 'complete' };
}

export function changeCollectionPreview(state, action, scene) {
  if (action === 'scene') return createCollectionPreview(scene);
  if (action === 'expand') return { ...state, expanded: !state.expanded };
  if (action === 'pause' && collectionView(state).canPause) return { ...state, scene: 'paused', pausedFrom: state.scene };
  if (action === 'resume' && state.scene === 'paused') return { ...state, scene: state.pausedFrom, pausedFrom: null };
  // Manual check demonstrates success for a failed source. Offline stays offline;
  // selecting another scene is an explicit design action, not automatic retry.
  if (action === 'check' && state.scene === 'failed') return { ...state, scene: 'details', notice: true };
  if (action === 'check' && ['offline', 'offline-empty'].includes(state.scene)) return { ...state, notice: true };
  return state;
}

export function collectionCopy(state) {
  const view = collectionView(state);
  const scenes = {
    finding: ['正在建立本地赛历', '先读取已公布日期。赛程尚未取得，暂不判断本月有多少场比赛。', '…'],
    details: ['赛程已保存，可以先浏览月历', '出马表、赛果与马匹资料继续在后台收集；未公布的内容保留为待公布。', '✓'],
    failed: ['部分来源未连接，已保存赛程仍可浏览', '成功取得的资料已经保留。失败项等待手动检查或下次进入时再试。', '…'],
    offline: ['当前离线，已保存资料仍可浏览', '本次没有更新。联网后可手动检查；旧资料和原更新时间继续保留。', '—'],
    'offline-empty': ['当前离线，尚未保存赛程', '可以查看月历日期；取得赛程前，不把空白解释为没有比赛。联网后请手动检查。', '—'],
    complete: ['已公布的资料已收集完成', '尚未公布的出马表与赛果继续等待；之后在启动、进入详情或手动刷新时补充。', '✓'],
    paused: ['资料收集已暂停', '已经保存的内容继续保留。点击继续后从原进度接着收集。', 'Ⅱ']
  };
  const [title, copy, symbol] = scenes[state.scene];
  const note = state.notice ? state.scene === 'details' ? '演示：手动检查成功，继续未完成收集；没有发起真实请求。' : '演示：仍处于离线，没有重试或改变已保存资料。'
    : '按来源与年份分批保存，不显示无法确认的总进度百分比；以上数量和状态均为虚构示例。';
  const stopped = ['paused', 'offline', 'offline-empty', 'failed'].includes(state.scene);
  const datesCopy = view.hasDates ? '日期气泡已保存，月历可直接浏览' : state.scene === 'paused' ? '已暂停，继续后读取已公布赛程' : state.scene === 'offline-empty' ? '等待联网后手动检查；目前没有日期资料' : '正在读取可用年份；未公布的年份不会编造日期';
  return { title, copy: state.notice && ['offline', 'offline-empty'].includes(state.scene) ? `手动检查后仍离线。${copy}` : copy, symbol, note,
    steps: [
      ['已公布赛程', datesCopy, view.hasDates],
      ['近两年出马表与赛果', view.completed ? '已公布内容已保存' : view.hasDates ? stopped ? '已保存的部分保留，未取齐的内容稍后补查' : '分批补充，已完成部分随时可查看' : '赛程取得后分批收集', view.completed],
      ['本年详情与马匹资料', view.completed ? '已公布内容已保存；其余继续待公布' : view.hasDates ? stopped ? '示例：已保存 12 场详情，未取齐部分待补查' : '示例：已保存 12 场详情，其余继续收集' : '只收集已公布资料；马匹近五场按需补查', view.completed]
    ] };
}

export function initCollectionPreview(doc, location, history, Observer) {
  const params = new URLSearchParams(location.search);
  if (params.get('collection') !== 'preview') return null;
  const ids = ['first-collection-review', 'first-collection-panel', 'first-collection-scene', 'first-collection-title', 'first-collection-copy', 'first-collection-symbol',
    'first-collection-toggle', 'first-collection-pause', 'first-collection-check', 'first-collection-progress', 'first-collection-note', 'calendar-month-summary', 'calendar-empty', 'calendar'];
  const el = Object.fromEntries(ids.map(id => [id, doc.getElementById(id)]));
  const flow = params.get('flow') === 'preview';
  let state = createCollectionPreview(params.get('collectionState'), params.get('collectionPausedFrom'));
  let actualSummary = el['calendar-month-summary'].textContent;
  const loadingSummary = uiText('赛程尚未取得 · 本月场数待确认');
  function paint() {
    const view = collectionView(state), copy = collectionCopy(state);
    doc.body.dataset.firstCollectionPreview = 'true';
    doc.body.dataset.collectionHasDates = String(view.hasDates);
    el['first-collection-review'].hidden = el['first-collection-panel'].hidden = false;
    el['first-collection-panel'].dataset.tone = view.tone;
    el['first-collection-title'].textContent = uiText(copy.title);
    el['first-collection-copy'].textContent = uiText(copy.copy);
    el['first-collection-symbol'].textContent = uiText(copy.symbol);
    el['first-collection-note'].textContent = uiText(copy.note);
    el['first-collection-progress'].hidden = !state.expanded;
    el['first-collection-toggle'].setAttribute('aria-expanded', String(state.expanded));
    el['first-collection-pause'].hidden = !view.canPause && !view.canResume;
    el['first-collection-pause'].textContent = uiText(view.canResume ? '继续收集' : '暂停');
    el['first-collection-check'].hidden = !view.canCheck;
    el.calendar.setAttribute('aria-busy', String(!view.hasDates && view.running));
    for (const [index, key] of ['dates', 'history', 'current'].entries()) {
      doc.getElementById(`first-step-${key}-title`).textContent = uiText(copy.steps[index][0]);
      doc.getElementById(`first-step-${key}-copy`).textContent = uiText(copy.steps[index][1]);
      const symbol = doc.getElementById(`first-step-${key}-symbol`);
      symbol.textContent = uiText(copy.steps[index][2] ? '✓' : String(index + 1));
      symbol.closest('li').dataset.complete = String(copy.steps[index][2]);
    }
    if (el['calendar-month-summary'].textContent !== loadingSummary) actualSummary = el['calendar-month-summary'].textContent;
    el['calendar-month-summary'].textContent = uiText(view.hasDates ? actualSummary : loadingSummary);
    el['calendar-empty'].hidden = !view.hasDates || el.calendar.querySelectorAll('.day:not(.outside) .race-card').length > 0;
    el['first-collection-scene'].value = state.scene === 'paused' ? state.pausedFrom : state.scene;
  }
  function syncLocation() {
    const url = new URL(location.href); url.searchParams.set('collectionState', state.scene);
    if (state.scene === 'paused') url.searchParams.set('collectionPausedFrom', state.pausedFrom);
    else url.searchParams.delete('collectionPausedFrom');
    history.replaceState(null, '', url);
  }
  function act(action, scene) {
    state = changeCollectionPreview(state, action, scene); paint();
    if (flow && action !== 'expand') syncLocation();
  }
  el['first-collection-toggle'].addEventListener('click', () => act('expand'));
  el['first-collection-pause'].addEventListener('click', () => act(state.scene === 'paused' ? 'resume' : 'pause'));
  el['first-collection-check'].addEventListener('click', () => act('check'));
  el['first-collection-scene'].addEventListener('change', event => {
    act('scene', event.target.value);
    if (!flow) syncLocation();
  });
  const observer = new Observer(paint);
  observer.observe(el.calendar, { childList: true });
  paint();
  return { getState: () => ({ ...state }), repaint: paint, disconnect: () => observer.disconnect() };
}

if (typeof document !== 'undefined') initCollectionPreview(document, window.location, window.history, MutationObserver);

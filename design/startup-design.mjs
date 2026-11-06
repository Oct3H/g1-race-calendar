import { uiText, uiAttr } from './ui-language.mjs?v=76';
import { createStartupPreview, applyStartupAction } from './startup-state-preview.mjs?v=76';

export function initStartupDesign(document, now = () => new Date(), zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone) {
  let state = createStartupPreview(now(), zone());
  const get = id => document.getElementById(id);
  function render() {
    get('startup-notice').textContent = uiText(state.message);
    get('startup-process').textContent = uiText(state.running ? '运行中' : '已退出');
    get('startup-window-count').textContent = uiText(state.windowOpen ? '1 个 · 现有主窗口' : '0 个 · 未打开');
    get('startup-checks').textContent = uiText("{0} 次", {0: state.startupChecks});
    get('startup-window').hidden = !state.windowOpen;
    get('startup-closed').hidden = state.windowOpen;
    get('startup-closed-title').textContent = uiText(state.running ? '窗口已关闭，应用仍在运行' : '应用已完全退出');
    get('startup-closed-copy').textContent = uiText(state.running ? '已开始的资料收集仍可继续。点击 Dock 唤回同一主窗口。' : '进度已保存。再次启动后自动继续未完成收集。');
    get('startup-window-id').textContent = uiText(state.windowId);
    get('startup-month').textContent = uiText("{0} 年 {1} 月", {0: state.month.year, 1: String(state.month.month).padStart(2, '0')});
    get('startup-filter').textContent = uiText(state.filter === 'all' ? '全部地区' : 'JP · 日本');
    get('startup-zone').textContent = uiText("电脑时区 · {0}", {0: state.timeZone});
    const labels = { collecting: '收集中', interrupted: '已保存 · 下次自动继续', paused: '主动暂停 · 不自动恢复', cleared: '详细资料已清理 · 不自动重下', complete: '已完成' };
    get('startup-task-list').innerHTML = state.tasks.map(task => ["<article class=\"startup-task\" data-state=\"", String(task.state), "\"><div><b>", uiText(task.year), "</b><span>", uiText(labels[task.state]), "</span></div><progress max=\"100\" value=\"", String(task.progress), "\" aria-label=\"", uiAttr("{4} 年收集进度", {4: task.year}), "\"></progress><small>", uiText(task.state === 'cleared' ? '日期气泡保留' : `${task.progress}% 已保存`), "</small></article>"].join('')).join('');
    get('startup-pause').disabled = !state.running || state.tasks[0].state !== 'collecting';
    get('startup-resume').disabled = !state.running || state.tasks[0].state !== 'paused';
  }
  document.querySelector('.startup-page').addEventListener('click', event => {
    const button = event.target.closest('[data-startup-action]');
    if (!button) return;
    applyStartupAction(state, button.dataset.startupAction, now(), zone());
    render();
  });
  get('startup-reset').addEventListener('click', () => { state = createStartupPreview(now(), zone()); render(); });
  render();
}

if (typeof document !== 'undefined') initStartupDesign(document);

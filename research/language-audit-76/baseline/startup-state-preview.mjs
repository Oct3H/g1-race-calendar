import { dateInZone } from './calendar-rules.js';

export function createStartupPreview(now, timeZone) {
  const today = dateInZone(now, timeZone);
  return {
    running: true, windowOpen: true, windowId: 'MAIN-01', processStarts: 1,
    startupChecks: 1, timeZone, month: { year: today.year, month: today.month }, filter: 'all',
    tasks: [
      { year: today.year, state: 'collecting', progress: 72 },
      { year: today.year - 1, state: 'paused', progress: 40 },
      { year: today.year - 2, state: 'cleared', progress: 0 }
    ],
    message: '已显示本地赛历，启动检查在后台进行；本年资料收集中。'
  };
}

export function applyStartupAction(state, action, now, timeZone) {
  if (action === 'close') {
    if (!state.running || !state.windowOpen) return;
    state.windowOpen = false;
    state.message = '窗口已关闭，应用继续运行；已开始的收集可继续。';
  } else if (action === 'quit') {
    if (!state.running) return;
    state.running = false; state.windowOpen = false;
    for (const task of state.tasks) if (task.state === 'collecting') task.state = 'interrupted';
    state.message = '应用已完全退出，已完成的进度保存；主动暂停与清理状态保留。';
  } else if (action === 'dock') {
    if (state.running && state.windowOpen) {
      state.message = '已唤回现有主窗口；月份与筛选保留，没有新建窗口或重复启动检查。';
      return;
    }
    const restarting = !state.running;
    state.running = true; state.windowOpen = true;
    const today = dateInZone(now, timeZone);
    state.month = { year: today.year, month: today.month };
    state.timeZone = timeZone; state.filter = 'all';
    if (restarting) {
      state.processStarts++; state.startupChecks++;
      for (const task of state.tasks) if (task.state === 'interrupted') task.state = 'collecting';
    }
    state.message = restarting
      ? '先显示本地赛历并后台检查更新，自动继续未完成收集；主动暂停与清理的年份不重下。'
      : '主窗口已重新打开，显示电脑当前月份及全部地区；未新增启动查询。';
  } else if (action === 'progress') {
    if (!state.running) { state.message = '应用已退出，收集不会继续；再次启动后从已保存进度恢复。'; return; }
    for (const task of state.tasks) if (task.state === 'collecting') {
      task.progress = Math.min(100, task.progress + 7);
      if (task.progress === 100) task.state = 'complete';
    }
    state.message = '已模拟保存一段新进度；主动暂停与清理的年份保持原状。';
  } else if (action === 'pause' || action === 'resume') {
    if (!state.running) return;
    const task = state.tasks[0];
    if (action === 'pause' && task.state === 'collecting') { task.state = 'paused'; state.message = '本年收集已主动暂停；退出或重开后仍保持暂停。'; }
    if (action === 'resume' && task.state === 'paused') { task.state = 'collecting'; state.message = '本年收集已继续，接着已保存的进度补充。'; }
  } else if (action === 'browse') {
    if (!state.running || !state.windowOpen) return;
    const date = state.month.month === 1 ? { year: state.month.year - 1, month: 12 } : { year: state.month.year, month: state.month.month - 1 };
    state.month = date; state.filter = 'JP';
    state.message = '已模拟浏览上个月并筛选 JP。可比较 Dock 唤回、关闭后重开与完全退出后重启。';
  }
}

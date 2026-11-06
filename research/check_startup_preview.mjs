import assert from 'node:assert/strict';
import { createStartupPreview, applyStartupAction } from '../design/startup-state-preview.mjs';
import { initStartupDesign } from '../design/startup-design.mjs';

const first = new Date('2026-10-25T04:00:00Z');
const later = new Date('2026-11-03T04:00:00Z');
const state = createStartupPreview(first, 'Asia/Shanghai');
assert.deepEqual([state.windowOpen, state.windowId, state.processStarts, state.startupChecks], [true, 'MAIN-01', 1, 1]);
applyStartupAction(state, 'browse', first, 'Asia/Shanghai');
assert.deepEqual([state.month.month, state.filter], [9, 'JP']);
for (let i = 0; i < 5; i++) applyStartupAction(state, 'dock', first, 'Asia/Shanghai');
assert.deepEqual([state.month.month, state.filter, state.windowId, state.processStarts, state.startupChecks], [9, 'JP', 'MAIN-01', 1, 1]);
applyStartupAction(state, 'close', first, 'Asia/Shanghai');
assert.deepEqual([state.running, state.windowOpen], [true, false]);
applyStartupAction(state, 'progress', first, 'Asia/Shanghai');
assert.deepEqual(state.tasks.map(task => task.progress), [79, 40, 0]);
applyStartupAction(state, 'dock', later, 'Asia/Tokyo');
assert.deepEqual([state.month.month, state.filter, state.timeZone, state.startupChecks], [11, 'all', 'Asia/Tokyo', 1]);
applyStartupAction(state, 'quit', later, 'Asia/Tokyo');
assert.deepEqual(state.tasks.map(task => task.state), ['interrupted', 'paused', 'cleared']);
assert.deepEqual([state.running, state.windowOpen], [false, false]);
applyStartupAction(state, 'progress', later, 'Asia/Tokyo');
assert.deepEqual(state.tasks.map(task => task.progress), [79, 40, 0]);
applyStartupAction(state, 'dock', later, 'Asia/Tokyo');
assert.deepEqual(state.tasks.map(task => task.state), ['collecting', 'paused', 'cleared']);
assert.deepEqual(state.tasks.map(task => task.progress), [79, 40, 0]);
assert.deepEqual([state.processStarts, state.startupChecks, state.windowId], [2, 2, 'MAIN-01']);
applyStartupAction(state, 'pause', later, 'Asia/Tokyo');
applyStartupAction(state, 'quit', later, 'Asia/Tokyo');
applyStartupAction(state, 'dock', later, 'Asia/Tokyo');
assert.equal(state.tasks[0].state, 'paused');
applyStartupAction(state, 'progress', later, 'Asia/Tokyo');
assert.equal(state.tasks[0].progress, 79);
applyStartupAction(state, 'resume', later, 'Asia/Tokyo');
for (let i = 0; i < 5; i++) applyStartupAction(state, 'progress', later, 'Asia/Tokyo');
assert.deepEqual([state.tasks[0].state, state.tasks[0].progress], ['complete', 100]);
applyStartupAction(state, 'quit', later, 'Asia/Tokyo');
applyStartupAction(state, 'dock', later, 'Asia/Tokyo');
assert.equal(state.tasks[0].state, 'complete');
assert.deepEqual(state.tasks.slice(1).map(task => task.state), ['paused', 'cleared']);

// Real UI controller rendered into small DOM doubles, with injected clock and zone.
class Node {
  constructor() { this.listeners = new Map(); this.textContent = ''; this.innerHTML = ''; this.hidden = false; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
}
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
const document = { getElementById: get, querySelector: get };
let now = first;
initStartupDesign(document, () => now, () => 'Asia/Shanghai');
const action = key => get('.startup-page').listeners.get('click')({ target: { closest: () => ({ dataset: { startupAction: key } }) } });
assert.equal(get('startup-window').hidden, false);
action('close');
assert.equal(get('startup-window').hidden, true);
assert.equal(get('startup-closed').hidden, false);
assert.equal(get('startup-process').textContent, '运行中');
action('progress');
assert.match(get('startup-task-list').innerHTML, /value="79"/);
action('quit');
assert.equal(get('startup-process').textContent, '已退出');
assert.match(get('startup-task-list').innerHTML, /下次自动继续/);
now = later;
action('dock');
assert.equal(get('startup-window').hidden, false);
assert.equal(get('startup-month').textContent, '2026 年 11 月');
assert.equal(get('startup-filter').textContent, '全部地区');
assert.equal(get('startup-checks').textContent, '2 次');
assert.match(get('startup-task-list').innerHTML, /主动暂停 · 不自动恢复/);
assert.match(get('startup-task-list').innerHTML, /详细资料已清理 · 不自动重下/);
assert.match(get('startup-task-list').innerHTML, /value="79"/);
get('startup-reset').listeners.get('click')();
assert.match(get('startup-task-list').innerHTML, /value="72"/);
console.log('PASS: one logical window, focus vs reopen vs restart, local current month/filter reset, no extra reopen queries, background progress, resumable interruption and preserved pause/clear/completed states; real UI controller with DOM doubles. Native macOS lifecycle/browser not implemented or rendered.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCollectionPreview, collectionView, collectionCopy, changeCollectionPreview, initCollectionPreview, collectionScenes } from '../design/first-collection-preview.mjs';

let state = createCollectionPreview('finding');
assert.equal(collectionView(state).hasDates, false);
state = changeCollectionPreview(state, 'expand');
state = changeCollectionPreview(state, 'pause');
assert.equal(state.scene, 'paused');
assert.equal(state.expanded, true);
assert.equal(collectionView(state).running, false);
assert.equal(collectionView(state).hasDates, false);
assert.match(collectionCopy(state).steps[0][1], /已暂停/);
state = changeCollectionPreview(state, 'resume');
assert.equal(state.scene, 'finding');
assert.equal(collectionView(state).running, true);
state = changeCollectionPreview(createCollectionPreview('details'), 'pause');
assert.equal(collectionView(state).hasDates, true);
assert.equal(changeCollectionPreview(state, 'resume').scene, 'details');
for (const scene of ['offline', 'offline-empty']) {
  const offline = changeCollectionPreview(createCollectionPreview(scene), 'check');
  assert.equal(offline.scene, scene);
  assert.equal(offline.notice, true);
  assert.equal(collectionView(offline).running, false);
  assert.match(collectionCopy(offline).copy, /手动检查后仍离线/);
}
assert.equal(changeCollectionPreview(createCollectionPreview('failed'), 'check').scene, 'details');
assert.equal(collectionView(createCollectionPreview('complete')).canPause, false);
assert.match(collectionCopy(createCollectionPreview('complete')).copy, /尚未公布/);
assert.equal(createCollectionPreview('untrusted-unknown').scene, 'details');

class Element {
  constructor(id) { this.id = id; this.hidden = true; this.textContent = ''; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.parent = { dataset: {} }; this.value = ''; this.cards = [1, 2]; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(key, value) { this.listeners[key] = value; }
  closest() { return this.parent; }
  querySelectorAll() { return this.cards; }
  fire(event, value) { this.listeners[event]({ target: { value } }); }
}
const html = fs.readFileSync(new URL('../design/index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size);
const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
elements['calendar-month-summary'].textContent = '本月 12 场 · 示例资料';
const doc = { body: { dataset: {} }, getElementById: id => { assert.ok(elements[id], `actual HTML contains ${id}`); return elements[id]; } };
let observed;
class Observer { constructor(callback) { this.callback = callback; observed = this; } observe(element) { assert.equal(element, elements.calendar); } disconnect() {} }
let replacements = 0;
const history = { replaceState() { replacements++; } };
const preview = initCollectionPreview(doc, { search: '?preview=calendar&collection=preview&collectionState=finding', href: 'http://127.0.0.1:8765/index.html?preview=calendar&collection=preview' }, history, Observer);
assert.equal(doc.body.dataset.collectionHasDates, 'false');
assert.match(elements['calendar-month-summary'].textContent, /待确认/);
assert.equal(elements.calendar.attrs['aria-busy'], 'true');
elements['first-collection-toggle'].fire('click');
assert.equal(elements['first-collection-progress'].hidden, false);
elements['first-collection-pause'].fire('click');
assert.equal(elements['first-collection-pause'].textContent, '继续收集');
assert.equal(elements.calendar.attrs['aria-busy'], 'false');
elements['first-collection-pause'].fire('click');
assert.equal(preview.getState().scene, 'finding');
// A month navigation can re-render the calendar while the source is unavailable.
elements['calendar-month-summary'].textContent = '本月资料未载入';
elements.calendar.cards = [];
observed.callback();
assert.match(elements['calendar-month-summary'].textContent, /待确认/);
elements['first-collection-scene'].fire('change', 'details');
assert.equal(elements['calendar-month-summary'].textContent, '本月资料未载入');
assert.equal(elements['calendar-empty'].hidden, false);
assert.equal(doc.body.dataset.collectionHasDates, 'true');
elements['first-collection-scene'].fire('change', 'offline-empty');
elements['first-collection-check'].fire('click');
assert.equal(preview.getState().scene, 'offline-empty');
assert.equal(elements['calendar-empty'].hidden, true);
assert.equal(replacements, 2);
for (const scene of collectionScenes) {
  elements['first-collection-scene'].fire('change', scene);
  assert.ok(elements['first-collection-title'].textContent);
  assert.equal(elements['first-collection-panel'].hidden, false);
}
assert.equal(initCollectionPreview({ getElementById() { throw Error('ordinary page must not be touched'); } }, { search: '' }, null, null), null);
// The unified flow restores a paused scene via URL, still collapsed on entry.
const flowLocation = { href: 'http://127.0.0.1:8765/index.html?flow=preview&collection=preview&collectionState=paused&collectionPausedFrom=finding&month=11', search: '?flow=preview&collection=preview&collectionState=paused&collectionPausedFrom=finding&month=11' };
const flowHistory = { replaceState(_state, _unused, url) { flowLocation.href = String(url); flowLocation.search = new URL(url).search; } };
const flow = initCollectionPreview(doc, flowLocation, flowHistory, Observer);
assert.equal(flow.getState().scene, 'paused');
assert.equal(flow.getState().expanded, false);
assert.equal(elements['first-collection-progress'].hidden, true);
elements['first-collection-pause'].fire('click');
assert.equal(new URL(flowLocation.href).searchParams.get('collectionState'), 'finding');
assert.equal(new URL(flowLocation.href).searchParams.has('collectionPausedFrom'), false);
assert.equal(new URL(flowLocation.href).searchParams.get('month'), '11');
elements['first-collection-pause'].fire('click');
assert.equal(new URL(flowLocation.href).searchParams.get('collectionState'), 'paused');
assert.equal(new URL(flowLocation.href).searchParams.get('collectionPausedFrom'), 'finding');
const source = fs.readFileSync(new URL('../design/first-collection-preview.mjs', import.meta.url), 'utf8');
assert.ok(!/\b(fetch|setInterval|setTimeout|localStorage|sessionStorage|placeTicket|settleRace)\b/.test(source));
console.log('PASS: six collection scenes, pause/resume, no-data semantics, manual failure checks, offline preservation, month rerender, ordinary-page isolation; DOM double only.');

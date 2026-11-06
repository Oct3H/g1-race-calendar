import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { welcomeDestination, previewLinks } from '../design/preview-navigation.mjs';
import { initCollectionPreview } from '../design/first-collection-preview.mjs';

const welcome = 'http://127.0.0.1:8765/welcome.html?flow=preview&year=2026&month=10';
const html = fs.readFileSync(new URL('../design/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../design/first-collection-preview.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../design/welcome.js', import.meta.url), 'utf8').replace(/^import[^\n]+;\n/gm, '');
assert.ok(css.includes('body[data-collection-has-dates="false"] #calendar .race-card'));

class Element {
  constructor() { this.textContent = ''; this.hidden = true; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.parent = { dataset: {} }; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  closest() { return this.parent; }
  querySelectorAll() { return [{ dataset: { raceId: 'sample-japan' } }, { dataset: { raceId: 'sample-overseas' } }]; }
}
class Observer { observe() {} disconnect() {} }

function selectAndOpen(language, href = welcome) {
  let assigned;
  const form = new Element();
  form.querySelector = () => ({ value: language });
  const formElements = Object.fromEntries(['welcome-form', 'welcome-continue', 'welcome-title', 'welcome-note', 'welcome-feedback', 'welcome-selection-hint'].map(id => [id, id === 'welcome-form' ? form : new Element()]));
  const document = { documentElement: {}, getElementById: id => formElements[id] };
  vm.runInNewContext(source, { desktop: false, document, window: { location: { href, assign: url => { assigned = url; } } }, welcomeDestination });
  form.listeners.change();
  form.listeners.submit({ preventDefault() {} });
  const destination = new URL(assigned);
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
  elements['calendar-month-summary'].textContent = '本月 12 场 · 示例资料';
  const calendarDoc = { body: { dataset: {} }, getElementById: id => { assert.ok(elements[id], id); return elements[id]; } };
  const controller = initCollectionPreview(calendarDoc, { href: destination.href, search: destination.search }, { replaceState() {} }, Observer);
  const cards = elements.calendar.querySelectorAll('.day:not(.outside) .race-card');
  // Exercise the exact route -> component -> CSS visibility condition. Calendar
  // cards are DOM fixtures; this does not claim browser pixel verification.
  return { language, destination, controller, elements,
    visibleCards: calendarDoc.body.dataset.collectionHasDates === 'false' ? 0 : cards.length };
}

const defaults = ['en', 'zh', 'ja'].map(language => selectAndOpen(language));
console.log('Default welcome card visibility:', defaults.map(r => `${r.language}=${r.visibleCards}`).join(', '));
for (const result of defaults) {
  assert.ok(result.visibleCards > 0, `${result.language}: the default navigation review must show its existing sample race cards`);
  assert.equal(result.destination.searchParams.get('lang'), result.language);
  assert.equal(result.destination.searchParams.get('year'), '2026');
  assert.equal(result.destination.searchParams.get('month'), '10');
  assert.equal(result.elements['first-collection-progress'].hidden, true);
}
const explicitFinding = selectAndOpen('en', `${welcome}&collectionState=finding`);
assert.equal(explicitFinding.visibleCards, 0);
assert.match(explicitFinding.elements['calendar-month-summary'].textContent, /待确认/);
const explicitOfflineEmpty = selectAndOpen('en', `${welcome}&collectionState=offline-empty`);
assert.equal(explicitOfflineEmpty.visibleCards, 0);
const reopened = new URL(previewLinks(defaults[0].destination.href).welcome);
assert.equal(selectAndOpen('en', reopened.href).visibleCards, 2);
console.log('PASS: actual language form → route → collection initialization keeps preview cards visible for all languages; explicit no-data scenes still hide cards. DOM/CSS contract, no browser rendering.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { previewLinks, unifiedPreview, welcomeDestination } from '../design/preview-navigation.mjs';
import { createCollectionPreview } from '../design/first-collection-preview.mjs';

const welcome = 'http://127.0.0.1:8765/welcome.html?flow=preview&year=2026&month=11';
assert.equal(unifiedPreview(welcome), true);
for (const language of ['zh', 'ja', 'en']) {
  const calendar = new URL(welcomeDestination(welcome, language));
  assert.equal(calendar.pathname, '/index.html');
  assert.equal(calendar.searchParams.get('lang'), language);
  assert.equal(calendar.searchParams.get('collectionState'), 'details');
  assert.equal(calendar.searchParams.get('month'), '11');
  assert.equal(calendar.searchParams.get('settingsMenu'), 'preview');
}
assert.equal(welcomeDestination('http://127.0.0.1:8765/welcome.html', 'en'), 'settings.html?v=28&lang=en&section=language');
assert.throws(() => welcomeDestination(welcome, 'invalid'));
const paused = 'http://127.0.0.1:8765/index.html?flow=preview&collection=preview&collectionState=paused&collectionPausedFrom=finding&lang=ja&year=2026&month=11&game=refund-withdrawn&race=example';
const links = previewLinks(paused);
for (const destination of ['language', 'sources', 'cache', 'calendar']) {
  const url = new URL(links[destination]);
  assert.equal(url.searchParams.get('lang'), 'ja');
  assert.equal(url.searchParams.get('month'), '11');
  assert.equal(url.searchParams.get('collectionState'), 'paused');
  assert.equal(url.searchParams.get('collectionPausedFrom'), 'finding');
  assert.equal(url.searchParams.get('game'), null);
  assert.equal(url.searchParams.get('race'), null);
  assert.equal(new URL(previewLinks(url.href).calendar).searchParams.get('page'), null);
}
assert.equal(new URL(links.cache).searchParams.get('page'), 'cache');
assert.equal(new URL(links.language).searchParams.get('section'), 'language');
assert.equal(new URL(links.sources).searchParams.get('section'), 'sources');
assert.equal(new URL(links.welcome).searchParams.get('collectionState'), 'details');
assert.equal(new URL(links.welcome).searchParams.has('collectionPausedFrom'), false);
assert.equal(new URL(previewLinks('file:///workspace/design/index.html?settingsMenu=preview&year=2026&month=10').calendar).protocol, 'file:');
assert.equal(new URL(previewLinks('http://127.0.0.1:8765/index.html?settingsMenu=preview&lang=bad').calendar).searchParams.get('lang'), 'zh');
assert.equal(new URL(previewLinks('http://127.0.0.1:8765/index.html?settingsMenu=preview').calendar).searchParams.has('flow'), false);
assert.equal(createCollectionPreview('paused', 'finding').expanded, false);
assert.equal(createCollectionPreview('paused', 'finding').pausedFrom, 'finding');

const source = name => fs.readFileSync(new URL(`../design/${name}`, import.meta.url), 'utf8').replace(/^import[^\n]+;\n/gm, '');
class Element {
  constructor(value) { this.value = value; this.dataset = {}; this.attrs = {}; this.listeners = {}; this.disabled = false; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(key, callback) { this.listeners[key] = callback; }
}
// Execute the real language-selection form handlers; there is no default choice.
const form = new Element();
let selected = null, assigned = null;
form.querySelector = () => selected;
const welcomeElements = Object.fromEntries(['welcome-form', 'welcome-continue', 'welcome-title', 'welcome-note', 'welcome-feedback', 'welcome-selection-hint'].map(id => [id, id === 'welcome-form' ? form : new Element()]));
welcomeElements['welcome-continue'].disabled = true;
const welcomeDoc = { documentElement: {}, getElementById: id => welcomeElements[id] };
vm.runInNewContext(source('welcome.js'), { desktop: false, document: welcomeDoc, window: { location: { href: welcome, assign: href => { assigned = href; } } }, welcomeDestination });
form.listeners.submit({ preventDefault() {} });
assert.equal(assigned, null);
selected = { value: 'ja' };
form.listeners.change();
assert.equal(welcomeElements['welcome-continue'].disabled, false);
assert.equal(welcomeDoc.documentElement.lang, 'ja');
form.listeners.submit({ preventDefault() {} });
assert.equal(new URL(assigned).pathname, '/index.html');
assert.equal(new URL(assigned).searchParams.get('lang'), 'ja');

// Execute actual settings events and inspect links after changing language/tab.
const languageInputs = ['zh', 'ja', 'en'].map(value => new Element(value));
const tabs = ['language', 'sources'].map(section => { const e = new Element(); e.dataset.section = section; return e; });
const returns = [new Element(), new Element()], welcomeLink = new Element();
const settingsElements = Object.fromEntries(['language-panel', 'sources-panel', 'settings-cache-link', 'language-feedback', 'preview-language'].map(id => [id, new Element()]));
const settingsDoc = { documentElement: {},
  getElementById: id => settingsElements[id],
  querySelector: selector => { assert.equal(selector, '[data-i18n="welcomePreview"]'); return welcomeLink; },
  querySelectorAll: selector => selector === '[name="language"]' ? languageInputs : selector === '[data-section]' ? tabs : selector === '.settings-return, .app-header .brand' ? returns : [] };
const location = { href: links.language, search: new URL(links.language).search };
const history = { replaceState(_state, _unused, value) { location.href = String(value); location.search = new URL(value).search; } };
vm.runInNewContext(source('settings.js'), { desktop: false, document: settingsDoc, window: { location, history }, URL, URLSearchParams, previewLinks, unifiedPreview });
languageInputs[2].listeners.change();
tabs[1].listeners.click();
for (const href of [returns[0].href, settingsElements['settings-cache-link'].href]) {
  const url = new URL(href);
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(url.searchParams.get('collectionState'), 'paused');
  assert.equal(url.searchParams.get('collectionPausedFrom'), 'finding');
  assert.equal(url.searchParams.get('month'), '11');
}
assert.equal(new URL(location.href).searchParams.get('section'), 'sources');
assert.equal(settingsElements['sources-panel'].hidden, false);
assert.equal(settingsElements['language-panel'].hidden, true);
assert.equal(new URL(welcomeLink.href).pathname, '/welcome.html');
console.log('PASS: three-language selection → calendar; settings/source/cache round trips; month and paused stage retained; old welcome behaviour and preview-only scope preserved. Actual form/settings handlers, no browser rendering.');

// Opt-in entry study. Ordinary calendar/settings URLs keep their existing behaviour.
import { previewLinks } from './preview-navigation.mjs?v=74';
const previewParams = new URLSearchParams(window.location.search);
if (previewParams.get('settingsMenu') === 'preview') initSettingsMenuPreview();

function settingsPreviewLinks() {
  return previewLinks(window.location.href);
}

function initSettingsMenuPreview() {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('settings-menu-preview.css?v=46', window.location.href).href;
  document.head.append(stylesheet);

  function updateReturnLinks() {
    const links = settingsPreviewLinks();
    if (document.getElementById('language-panel')) {
      document.querySelectorAll('.settings-return, .app-header .brand').forEach(link => { link.href = links.calendar; });
      document.getElementById('settings-cache-link').href = links.cache;
    }
    const cacheBack = document.getElementById('cache-back-settings');
    if (cacheBack) cacheBack.href = links.language;
  }
  updateReturnLinks();
  document.addEventListener('change', updateReturnLinks);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-section]')) updateReturnLinks();
  });

  const original = document.querySelector('.header-actions .settings-nav-link');
  if (!original) return;
  const language = previewParams.get('lang');
  const copies = {
    zh: ['设置', '语言与显示', '中文 · 日本語 · English', '资料来源', '来源目录与赔率市场', '缓存管理', '更新记录与按年清理', '预览', '‹ 返回赛历', '让熟悉的赛历，用你习惯的语言呈现。', '资料有出处，更新有记录。'],
    ja: ['設定', '言語と表示', '中文 · 日本語 · English', 'データソース', '参照元とオッズ市場', 'キャッシュ管理', '更新記録・年別削除', 'プレビュー', '‹ カレンダーへ', 'いつものレースカレンダーを、使いやすい言語で。', '参照元と更新記録を確認できます。'],
    en: ['Settings', 'Language & display', '中文 · 日本語 · English', 'Data sources', 'Sources and odds markets', 'Cache management', 'Updates and cleanup by year', 'Preview', '‹ Back to calendar', 'Your familiar race calendar, in the language you prefer.', 'Know the source. See the update history.']
  };
  const copy = copies[language] || copies.zh;
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-menu-preview';
  wrapper.innerHTML = `<button class="settings-menu-trigger" type="button" aria-expanded="false" aria-controls="settings-quick-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-1 3-3 1-3 3 2 2-2 2 3 3 3 1 1 3h4l1-3 3-1 3-3-2-2 2-2-3-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg><span>${copy[0]}</span><span class="settings-menu-chevron" aria-hidden="true">⌄</span></button>
    <a class="settings-menu-trigger settings-menu-calendar-return" hidden>${copy[8]}</a>
    <nav id="settings-quick-panel" class="settings-quick-panel" aria-label="${copy[0]}" hidden>
      <div class="settings-quick-heading"><div><small>PERSONAL SETTINGS</small><b>${copy[0]}</b></div><span>${copy[7]}</span></div>
      <a data-settings-destination="language"><span class="settings-quick-icon" aria-hidden="true">Aa</span><span><b>${copy[1]}</b><small>${copy[2]}</small></span><span class="settings-quick-arrow" aria-hidden="true">›</span></a>
      <a data-settings-destination="sources"><span class="settings-quick-icon" aria-hidden="true">↗</span><span><b>${copy[3]}</b><small>${copy[4]}</small></span><span class="settings-quick-arrow" aria-hidden="true">›</span></a>
      <a data-settings-destination="cache"><span class="settings-quick-icon" aria-hidden="true">▤</span><span><b>${copy[5]}</b><small>${copy[6]}</small></span><span class="settings-quick-arrow" aria-hidden="true">›</span></a>
    </nav>`;
  original.replaceWith(wrapper);
  const trigger = wrapper.querySelector('button');
  const panel = wrapper.querySelector('nav');
  const returnLink = wrapper.querySelector('.settings-menu-calendar-return');
  function setOpen(open) {
    if (open) {
      const links = settingsPreviewLinks();
      panel.querySelectorAll('[data-settings-destination]').forEach(link => { link.href = links[link.dataset.settingsDestination]; });
    }
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  }
  trigger.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault(); setOpen(false); trigger.focus();
    }
  });
  wrapper.addEventListener('focusout', () => {
    setTimeout(() => { if (!wrapper.contains(document.activeElement)) setOpen(false); }, 0);
  });
  panel.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });

  const cacheView = document.getElementById('cache-view');
  function syncPage() {
    const inCache = cacheView && !cacheView.hidden;
    trigger.hidden = Boolean(inCache);
    returnLink.hidden = !inCache;
    returnLink.href = settingsPreviewLinks().calendar;
    setOpen(false);
    if (inCache && !cacheView.querySelector('.settings-cache-layout')) {
      const settingsStyles = document.createElement('link');
      settingsStyles.rel = 'stylesheet';
      settingsStyles.href = new URL('settings.css?v=28', window.location.href).href;
      document.head.insertBefore(settingsStyles, stylesheet);
      addCacheSettingsNavigation(cacheView, copy);
    }
  }
  syncPage();
  // The existing brand button switches cache/calendar in place without a reload.
  if (cacheView) new MutationObserver(syncPage).observe(cacheView, { attributes: true, attributeFilter: ['hidden'] });
}

function addCacheSettingsNavigation(cacheView, copy) {
  const links = settingsPreviewLinks();
  const heading = document.createElement('div');
  heading.className = 'settings-heading';
  heading.innerHTML = `<div><p>PERSONAL SETTINGS</p><h1>${copy[0]}</h1><span>${copy[9]}</span></div><span class="settings-heading-star" aria-hidden="true">✦</span>`;
  const layout = document.createElement('div');
  layout.className = 'settings-layout settings-cache-layout';
  const nav = document.createElement('nav');
  nav.className = 'settings-nav';
  nav.setAttribute('aria-label', copy[0]);
  nav.innerHTML = [['language', 'Aa', copy[1]], ['sources', '↗', copy[3]], ['cache', '▤', copy[5]]].map(([key, icon, label]) =>
    `<a class="settings-cache-link" data-settings-destination="${key}" ${key === 'cache' ? 'aria-current="page"' : ''}><span class="settings-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span><span aria-hidden="true">›</span></a>`
  ).join('') + `<p>${copy[10]}</p>`;
  nav.querySelectorAll('[data-settings-destination]').forEach(link => { link.href = links[link.dataset.settingsDestination]; });
  document.getElementById('cache-back-settings').hidden = true;
  cacheView.querySelector('.cache-settings-breadcrumb').hidden = true;
  const oldTitle = document.getElementById('cache-title');
  const title = document.createElement('h2');
  title.id = oldTitle.id;
  title.textContent = oldTitle.textContent;
  oldTitle.replaceWith(title);
  const content = document.createElement('div');
  content.className = 'settings-content settings-cache-content';
  // Move existing controls so their listeners and in-memory cache examples survive.
  content.append(...cacheView.childNodes);
  layout.append(nav, content);
  cacheView.classList.add('settings-cache-shell');
  cacheView.append(heading, layout);
}

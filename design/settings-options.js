import { uiText } from './ui-language.mjs?v=76';
const designParams = new URLSearchParams(window.location.search);
const scheme = designParams.get('scheme') === 'sky' ? 'sky' : 'field';
document.documentElement.dataset.settingsDesign = scheme;

document.addEventListener('DOMContentLoaded', () => {
  const copy = scheme === 'field'
    ? ['A · 草绿与奶油金', '草地绿负责操作，奶油白承载内容，金色点缀重点；保留左侧分类。']
    : ['B · 天空蓝与珊瑚橙', '天空蓝负责操作，珊瑚橙突出标题与提示；分类改为顶部页签。'];
  document.getElementById('design-option-title').textContent = uiText(copy[0]);
  document.getElementById('design-option-description').textContent = uiText(copy[1]);
  function updateComparisonLinks() {
    document.querySelectorAll('[data-settings-scheme]').forEach(link => {
      const url = new URL(window.location.href);
      url.searchParams.set('scheme', link.dataset.settingsScheme);
      link.href = url.href;
      if (link.dataset.settingsScheme === scheme) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const original = new URL('settings.html', window.location.href);
    for (const key of ['lang', 'section']) {
      const value = new URL(window.location.href).searchParams.get(key);
      if (value) original.searchParams.set(key, value);
    }
    document.getElementById('design-option-original').href = original.href;
  }
  updateComparisonLinks();
  document.addEventListener('change', updateComparisonLinks);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-section]')) updateComparisonLinks();
  });
});

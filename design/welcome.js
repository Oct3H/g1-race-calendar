// 首次启动网页演示；选择传给下一预览页，不持久保存或开始联网收集。
import { desktop, saveDesktopLanguage } from './desktop-bridge.mjs';
import { welcomeDestination } from './preview-navigation.mjs?v=74';
if (desktop) document.body.dataset.desktop = 'dev';
const welcomeCopy = {
  zh: { locale: 'zh-CN', title: '请选择语言', note: '之后可以在设置中修改。', selected: '已选择：中文', action: '继续', hint: '仅切换界面语言，赛事名与马名保留原规则。' },
  ja: { locale: 'ja', title: '言語を選択', note: 'あとから設定で変更できます。', selected: '選択中：日本語', action: '続ける', hint: '画面の言語のみ変更します。レース名と馬名の表示ルールは維持されます。' },
  en: { locale: 'en', title: 'Choose your language', note: 'You can change this later in Settings.', selected: 'Selected: English', action: 'Continue', hint: 'Only the interface changes. Race and horse names keep their regional naming rules.' }
};

const form = document.getElementById('welcome-form');
const continueButton = document.getElementById('welcome-continue');
form.addEventListener('change', () => {
  const selected = form.querySelector('[name="language"]:checked');
  const copy = welcomeCopy[selected.value];
  document.documentElement.lang = copy.locale;
  document.title = 'GⅠ Race Calendar · ' + copy.title;
  document.getElementById('welcome-title').textContent = copy.title;
  document.getElementById('welcome-note').textContent = copy.note;
  document.getElementById('welcome-feedback').textContent = copy.selected;
  document.getElementById('welcome-selection-hint').textContent = copy.hint;
  continueButton.textContent = copy.action + ' ›';
  continueButton.disabled = false;
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = form.querySelector('[name="language"]:checked');
  if (!selected) return;
  if (desktop) {
    continueButton.disabled = true;
    try { await saveDesktopLanguage(selected.value); }
    catch { continueButton.disabled = false; return; }
  }
  window.location.assign(welcomeDestination(window.location.href, selected.value));
});

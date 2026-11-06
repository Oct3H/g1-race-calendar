// 设置页设计预览：仅翻译本页与界面示例，选择保留在网址中，不保存应用偏好。
import { previewLinks, unifiedPreview } from './preview-navigation.mjs?v=74';
const messages = {
  zh: {
    welcomePreview: '预览首次启动语言选择 ↗',
    review: '设置页三语预览', prototype: '本页与示例可切换语言，尚未启用全局设置',
    brand: 'GⅠ 赛马日历', back: '‹ 返回赛历', title: '设置', subtitle: '让熟悉的赛历，用你习惯的语言呈现。',
    navLabel: '设置分类', languageNav: '语言与显示', sourcesNav: '资料来源', cacheNav: '缓存管理', navNote: '资料有出处，更新有记录。',
    languageTitle: '显示语言', languageIntro: '选择应用界面的语言。赛事与马匹名称保留各地区原有的显示规则。',
    selected: '当前预览：中文 · 界面文字即时切换', nameTitle: '名称保留原规则',
    nameRule: '日本日文 · 香港繁体中文 · 其他地区英文。语言切换不会改写来源原名。',
    previewTitle: '界面预览', previewTag: '名称显示示例', calendarLabel: '赛事日历',
    filterAll: '全部赛事', filterJapan: '日本', filterWorld: '海外', resultLabel: '赛果', entriesLabel: '出马表', horseLabel: '马匹资料', marginLabel: '着差',
    sourcesTitle: '资料来源', sourcesIntro: '查看资料来自哪里，以及海外独赢赔率的来源顺序。',
    priorityTitle: '海外赔率来源顺序', priorityLocal: '当地权威赛马机构', priorityLocalNote: '优先采用可信、且市场与赔率口径已核实的数据。',
    priorityHkjc: '香港赛马会', priorityHkjcNote: '当地缺少可信数据时，使用已核实的港马会资料，并标明市场。',
    priorityMissing: '两者都无可靠数据时显示暂无资料；不拼接或平均不同市场的赔率。',
    sourceExampleTitle: '赛事详情中的来源展示', historicalRecord: '已核对的历史记录', oddsLabel: '单胜最终赔率 · 含本金', oddsUnit: '倍',
    marketLabel: '市场／类型', sourceLabel: '资料来源', rawLabel: '来源原值', checkedLabel: '核验日期',
    sourceExampleNote: '历史来源展示示例，非实时赔率。原值 15/8 换算为含本金倍率：1＋15/8＝2.875。',
    directoryTitle: '来源目录', directoryStatus: '代表资料已核对 · 尚未正式接入',
    directoryNote: '目录汇总当前核验来源，不代表每场或每个字段均有数据。具体赛事仍显示实际采用的出处。',
    rankingRegion: '国际赛事排名', rankingRole: '年度前百名单与排序', japanRegion: '日本', japanRole: 'JRA／地方赛事与马匹资料；netkeiba 为补充候选',
    hongkongRegion: '香港／海外转播', hongkongRole: '本地赛果与独赢；部分海外转播赛果及赛前资料',
    britainRegion: '英国／爱尔兰', britainRole: '当地官方赛果、SP 或派彩；不同字段分别核验',
    europeRegion: '法国／德国', europeRole: '赛事、赏金或赛果；法国直接详情仍待验证',
    australiaRegion: '澳大利亚', australiaRole: '官方比赛册、赏金与赛后摘要；完整直连赛果待验证',
    americaRegion: '美国', americaRole: '已核对 BCC 官网与 Equibase 公开赛果 PDF',
    arabRegion: '阿联酋／沙特', arabRole: '部分赛事与赏金；逐马详情及赔率仍需验证',
    footerNote: '设置与来源展示设计 · 选择通过网址保留，不写入应用偏好'
  },
  ja: {
    welcomePreview: '初回起動の言語選択をプレビュー ↗',
    review: '設定ページの3言語プレビュー', prototype: 'このページと表示例のみ切り替え可能。アプリ全体への適用は未実装です',
    brand: 'GⅠ レースカレンダー', back: '‹ カレンダーへ', title: '設定', subtitle: 'いつものレースカレンダーを、使い慣れた言語で。',
    navLabel: '設定メニュー', languageNav: '言語と表示', sourcesNav: 'データの出典', cacheNav: 'キャッシュ管理', navNote: '出典を確認し、更新の記録を残す。',
    languageTitle: '表示言語', languageIntro: '画面の表示言語を選択します。レース名と馬名は、地域ごとの表示ルールを維持します。',
    selected: 'プレビュー：日本語 · 画面の表示を切り替えました', nameTitle: '名称の表示ルールを維持',
    nameRule: '日本は日本語、香港は繁体字中国語、その他の地域は英語。言語を切り替えても、出典の名称は変更しません。',
    previewTitle: '画面プレビュー', previewTag: '名称の表示例', calendarLabel: 'レースカレンダー',
    filterAll: 'すべてのレース', filterJapan: '日本', filterWorld: '海外', resultLabel: 'レース結果', entriesLabel: '出馬表', horseLabel: '競走馬情報', marginLabel: '着差',
    sourcesTitle: 'データの出典', sourcesIntro: 'データの出典と、海外の単勝オッズに使用する情報源の優先順位を確認できます。',
    priorityTitle: '海外オッズの情報源の優先順位', priorityLocal: '現地の信頼できる競馬機関', priorityLocalNote: '市場とオッズの定義を確認できた、信頼性のあるデータを優先します。',
    priorityHkjc: '香港ジョッキークラブ', priorityHkjcNote: '現地の信頼できるデータがない場合は、確認済みのHKJCデータを使用し、市場を明記します。',
    priorityMissing: 'どちらも信頼できるデータがない場合は「情報なし」と表示します。異なる市場のオッズを混合・平均しません。',
    sourceExampleTitle: 'レース詳細での出典表示', historicalRecord: '確認済みの過去データ', oddsLabel: '単勝確定オッズ · 元本を含む', oddsUnit: '倍',
    marketLabel: '市場／種別', sourceLabel: 'データの出典', rawLabel: '出典の元の値', checkedLabel: '確認日',
    sourceExampleNote: '過去データの表示例であり、リアルタイムのオッズではありません。15/8を元本込みの倍率に換算：1＋15/8＝2.875。',
    directoryTitle: '情報源一覧', directoryStatus: '一部の資料を確認済み · 本番接続は未実装',
    directoryNote: 'これまで確認した情報源の一覧です。全レース・全項目の取得を保証するものではありません。各レースには実際に使用した出典を表示します。',
    rankingRegion: '国際レースランキング', rankingRole: '年間トップ100と順位', japanRegion: '日本', japanRole: 'JRA・地方競馬のレースと競走馬情報。netkeibaは補完候補',
    hongkongRegion: '香港／海外中継', hongkongRole: '香港の結果と単勝。一部の海外中継レースの結果・出走資料',
    britainRegion: '英国／アイルランド', britainRole: '現地公式の結果、SPまたは払戻金。項目ごとに定義を確認',
    europeRegion: 'フランス／ドイツ', europeRole: 'レース・賞金・結果。フランスの詳細データの直接取得は未確認',
    australiaRegion: 'オーストラリア', australiaRole: '公式レースブック・賞金・結果概要。全着順の直接取得は未確認',
    americaRegion: '米国', americaRole: 'BCC公式ページとEquibase公開結果PDFを確認済み',
    arabRegion: 'UAE／サウジアラビア', arabRole: '一部のレースと賞金。全馬の詳細・オッズは要確認',
    footerNote: '設定・出典表示のデザイン。選択はURLに保持され、アプリ設定には保存されません'
  },
  en: {
    welcomePreview: 'Preview first-launch language selection ↗',
    review: 'Settings in three languages', prototype: 'Language preview for this page and its examples; global settings are not active',
    brand: 'GⅠ Race Calendar', back: '‹ Back to calendar', title: 'Settings', subtitle: 'Your familiar race calendar, in the language you prefer.',
    navLabel: 'Settings categories', languageNav: 'Language & display', sourcesNav: 'Data sources', cacheNav: 'Cache management', navNote: 'Trace the source. Keep the update record.',
    languageTitle: 'Display language', languageIntro: 'Choose the language of the interface. Race and horse names keep their regional naming rules.',
    selected: 'Preview: English · Interface language updated', nameTitle: 'Keep regional names',
    nameRule: 'Japanese for Japan, Traditional Chinese for Hong Kong, and English elsewhere. Switching language does not rewrite source names.',
    previewTitle: 'Interface preview', previewTag: 'Name display examples', calendarLabel: 'Race calendar',
    filterAll: 'All races', filterJapan: 'Japan', filterWorld: 'Overseas', resultLabel: 'Results', entriesLabel: 'Racecard', horseLabel: 'Horse profile', marginLabel: 'Margin',
    sourcesTitle: 'Data sources', sourcesIntro: 'See where the data comes from and which sources take priority for overseas Win odds.',
    priorityTitle: 'Source priority for overseas odds', priorityLocal: 'Authoritative local racing bodies', priorityLocalNote: 'Use trustworthy local data first, once its market and odds format have been verified.',
    priorityHkjc: 'Hong Kong Jockey Club', priorityHkjcNote: 'When trustworthy local data is unavailable, use verified HKJC data and identify its market.',
    priorityMissing: 'If neither has reliable data, show “Unavailable”. Do not combine or average odds from different markets.',
    sourceExampleTitle: 'Source details on a race page', historicalRecord: 'Verified historical record', oddsLabel: 'Final Win odds · Includes stake', oddsUnit: '×',
    marketLabel: 'Market / type', sourceLabel: 'Data source', rawLabel: 'Original value', checkedLabel: 'Verified on',
    sourceExampleNote: 'A historical display example, not live odds. Fractional odds of 15/8 become a return including stake of 1 + 15/8 = 2.875.',
    directoryTitle: 'Source directory', directoryStatus: 'Sample records checked · Live integration pending',
    directoryNote: 'This directory lists sources reviewed so far. Coverage varies by race and field. Each race will identify the sources actually used.',
    rankingRegion: 'International race rankings', rankingRole: 'Annual Top 100 list and ranking', japanRegion: 'Japan', japanRole: 'JRA and local races and horse records; netkeiba is a potential supplement',
    hongkongRegion: 'Hong Kong / Overseas simulcasts', hongkongRole: 'Local results and Win odds; selected overseas results and pre-race guides',
    britainRegion: 'Great Britain / Ireland', britainRole: 'Official results, SP or dividends; definitions checked separately',
    europeRegion: 'France / Germany', europeRole: 'Races, purses or results; direct French race details still unverified',
    australiaRegion: 'Australia', australiaRole: 'Official racebooks, purses and result summaries; direct full results still unverified',
    americaRegion: 'United States', americaRole: 'BCC official page and public Equibase result PDF checked',
    arabRegion: 'UAE / Saudi Arabia', arabRole: 'Selected races and purses; runner details and odds need further verification',
    footerNote: 'Settings and source display prototype. Selections stay in the URL, not in app preferences'
  }
};

const locales = { zh: 'zh-CN', ja: 'ja', en: 'en' };
const languageNames = { zh: '中文', ja: '日本語', en: 'English' };
const params = new URLSearchParams(window.location.search);
let language = Object.hasOwn(messages, params.get('lang')) ? params.get('lang') : 'zh';
let section = params.get('section') === 'sources' ? 'sources' : 'language';

function renderSettings() {
  const copy = messages[language];
  document.documentElement.lang = locales[language];
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = copy[element.dataset.i18n];
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', copy[element.dataset.i18nAria]);
  });
  document.querySelectorAll('[name="language"]').forEach(input => {
    input.checked = input.value === language;
  });
  document.querySelectorAll('[data-section]').forEach(button => {
    button.setAttribute('aria-current', button.dataset.section === section ? 'page' : 'false');
  });
  document.getElementById('language-panel').hidden = section !== 'language';
  document.getElementById('sources-panel').hidden = section !== 'sources';
  const fromCalendar = new URLSearchParams(window.location.search).get('from') === 'calendar';
  document.getElementById('settings-cache-link').href = `index.html?page=cache&lang=${language}${fromCalendar ? '&from=calendar' : ''}&v=33`;
  document.querySelectorAll('.settings-return, .app-header .brand').forEach(link => {
    link.href = fromCalendar ? `index.html?preview=calendar&lang=${language}&v=33` : 'index.html?v=33';
  });
  document.getElementById('language-feedback').textContent = copy.selected;
  document.getElementById('preview-language').textContent = languageNames[language];
  document.title = copy.brand + ' · ' + copy.title;
  const url = new URL(window.location.href);
  url.searchParams.set('lang', language);
  url.searchParams.set('section', section);
  window.history.replaceState(null, '', url);
  if (unifiedPreview(url.href)) {
    const links = previewLinks(url.href);
    document.getElementById('settings-cache-link').href = links.cache;
    document.querySelectorAll('.settings-return, .app-header .brand').forEach(link => { link.href = links.calendar; });
    document.querySelector('[data-i18n="welcomePreview"]').href = links.welcome;
  }
}

document.querySelectorAll('[name="language"]').forEach(input => {
  input.addEventListener('change', () => {
    language = input.value;
    renderSettings();
  });
});
document.querySelectorAll('[data-section]').forEach(button => {
  button.addEventListener('click', () => {
    section = button.dataset.section;
    renderSettings();
  });
});
renderSettings();

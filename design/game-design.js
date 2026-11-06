import { devText } from './desktop-bridge.mjs';
import { uiText, uiAttr, uiList, registerUiNames } from './ui-language.mjs?v=76';
import { notificationState, initNotificationReview } from './notification-review.mjs?v=76';
import { createUnopenedShop, activateShop, accrueShopBank } from './shop-start-preview.mjs?v=76';
import { createCorrectionPreview } from './correction-design.mjs?v=76';
import { createState, addBankDays, withdraw, canBet, withinBetWindow, bettingBlockReason, grossReturn, placeTicket, recordRaceResult, settleRace, refundTickets, pendingRefundExample, applyRaceChanges, unreadRefundRaceIds, unreadForRace, markRead, settlementExample } from './game-state.mjs?v=76';
import { recordPreviewRaceChange } from './race-change-state.mjs?v=76';
import { voluntaryRefundBlockReason, refundPreviewTicket } from './voluntary-refund-preview.mjs?v=76';
import { qualityCaseFor, recordQualityResult } from './data-quality-preview.mjs?v=76';

export function createGamePreview({ races, entries, horseNames, countryColors, showRace, closeRace, renderCalendar, showOdds, requestRefresh, getOddsStatus, storedWallet, saveWallet }) {
  registerUiNames([...races.map(race => race.name), ...Object.values(horseNames).flat()]);
  const refundPreview = Boolean(saveWallet) || new URLSearchParams(window.location.search).get('refund') === 'preview';
  let state = storedWallet || createUnopenedShop();
  let savedWallet = JSON.stringify(state);
  let view = 'wallet';
  let selectedRace = null;
  let selectedHorse = 1;
  let ticketFilter = 'all';
  let cutoffTimer;
  let resultRace = null;
  let resultOpener = null;
  let resultDestination = 'race';
  let resultStages = [];
  let resultTickets = [];
  let queuedChanges = [];
  let automaticRefundQueue = false;
  let refundReturnTo = 'calendar';
  let correctionBankruptcy = false;
  let deferredAfterRefund = null;
  let notificationCase = null;
  let notificationWaiting = false;
  const originalRaceStates = new Map(races.map(race => [race.id, structuredClone({ sampleFinished: race.sampleFinished, sampleCancelled: race.sampleCancelled, sampleWithdrawnNumbers: race.sampleWithdrawnNumbers, sampleChange: race.sampleChange, sampleChangeHistory: race.sampleChangeHistory })]));
  const money = amount => `¥${new Intl.NumberFormat('ja-JP').format(amount)}`;
  const signed = amount => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${money(Math.abs(amount))}`;
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const horses = race => entries.map((entry, index) => ({ ...entry, odds: race.sampleQuality && qualityCaseFor(race).missingOdds?.includes(entry.number) ? null : entry.odds, name: horseNames[race.country === 'JP' ? 'ja' : race.country === 'HK' ? 'zh-Hant' : 'en'][index] }));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  const tools = document.createElement('div');
  tools.className = 'game-tools';
  tools.innerHTML = '<button class="game-shop-launcher" type="button" data-game-action="wallet"><img src="assets/special-week-shop-v1.png" alt=""><span class="visually-hidden" aria-hidden="true" id="game-header-cash"></span><span class="visually-hidden" aria-hidden="true" id="game-header-bank"></span></button>';
  document.querySelector('.header-actions').prepend(tools);
  const raceAction = document.createElement('div');
  raceAction.className = 'game-race-action';
  raceAction.id = 'game-race-action';
  raceAction.hidden = true;
  raceAction.innerHTML = ["<div id=\"game-race-purchase\" class=\"game-race-purchase\" hidden><button type=\"button\" class=\"game-primary\" id=\"game-race-bet\">", uiText("购买马券 ", null), "<span>›</span></button><small id=\"game-race-reason\"></small></div><button type=\"button\" class=\"game-quality-settlement\" id=\"game-quality-result\" hidden>", uiText("! 查看结果并结算", null), "</button>"].join('');
  document.querySelector('#race-panel .source-placeholder').after(raceAction);

  const modal = document.createElement('dialog');
  modal.id = 'game-dialog';
  modal.setAttribute('aria-labelledby', 'game-title');
  modal.innerHTML = ["<div class=\"dialog-ribbon\"><span id=\"game-ribbon\">SPECIAL WEEK’S SHOP</span><span class=\"game-demo-tag\">", uiText("虚拟日元", null), "</span><button class=\"close-button\" type=\"button\" data-game-action=\"close\" aria-label=\"", uiAttr("关闭小店", null), "\">×</button></div>\n    <div class=\"game-body\"><div class=\"game-heading\"><div><p id=\"game-kicker\"></p><h2 id=\"game-title\" tabindex=\"-1\"></h2></div><div class=\"game-host\"><span lang=\"ja\">", uiText("いらっしゃいませ♪", null), "</span><img src=\"assets/special-week-shop-v1.png\" alt=\"", uiAttr("特别周小店店员", null), "\"></div></div>\n    <p id=\"game-feedback\" role=\"status\" aria-live=\"polite\"></p>\n    <section class=\"game-panel\" data-game-panel=\"wallet\">\n      <div class=\"game-wallet-overview\"><div class=\"game-balance-card\"><span class=\"game-card-label\"><i class=\"game-coin\" aria-hidden=\"true\">¥</i>", uiText("可用资金", null), "</span><strong id=\"game-cash\"></strong><small id=\"game-cash-note\">", uiText("首次进入小店获赠 ¥500,000 · 只发放一次", null), "</small></div>\n      <button class=\"game-bank-shortcut\" type=\"button\" data-game-action=\"bank\"><span class=\"game-bank-label\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 9h18L12 3 3 9Zm2 3v7m7-7v7m7-7v7M3 22h18\"/></svg><b>", uiText("银行", null), "</b><small>DAILY BONUS</small></span><strong id=\"game-bank-summary\"></strong><small class=\"game-bank-note\">", uiText("每日 +¥10,000 · 随时取出", null), "</small><span class=\"game-bank-arrow\" aria-hidden=\"true\">›</span></button></div>\n      <section class=\"game-shop-preferences\" aria-label=\"", uiAttr("小店显示设置", null), "\"><div><b>", uiText("赛事详情购买入口", null), "</b><small>", uiText("默认隐藏；开启后，在赛事详情显示“购买马券”。小店内仍可正常购买。", null), "</small></div><button id=\"game-toggle-detail-entry\" type=\"button\" role=\"switch\" aria-checked=\"false\" data-game-action=\"toggle-detail-entry\">", uiText("已关闭", null), "</button></section>\n      <div class=\"game-section-heading\"><h3>", uiText("未来 30 天赛事", null), "</h3><span>", uiText("仅单胜／独赢", null), "</span></div><p class=\"game-eligibility-note\">", uiText("确认出走名单且取得官方单胜赔率后才可购买；比赛当日截止。以下资格状态均为虚构演示。", null), "</p><div id=\"game-upcoming\" class=\"game-upcoming\"></div>\n      <section id=\"game-ticket-folder\" aria-labelledby=\"game-ticket-folder-title\"><div class=\"game-section-heading\"><h3 id=\"game-ticket-folder-title\" tabindex=\"-1\">", uiText("我的马券", null), "</h3><span id=\"game-ticket-count\" role=\"status\"></span></div><p class=\"game-folder-rule\">", uiText("同场可买多匹，同马可分次追加；每笔独立锁定倍率。{0}官方退赛／取消仍自动退本金。", {0: refundPreview ? '退款预览：比赛当天及前 2 天不开放主动退款；比赛当天不能购买新马券。' : '确认后不可主动撤回。'}), "</p><div id=\"game-ticket-filters\" class=\"game-ticket-filters\" role=\"group\" aria-label=\"", uiAttr("按马券状态筛选", null), "\"></div><p class=\"game-ticket-filter-note\">", uiText("筛选只改变显示；待查看结算仍在打开结果时入账。", null), "</p><div id=\"game-tickets\"></div></section>\n      <details class=\"game-demo-controls\"><summary>", uiText("设计演示 · 比较结算与退款", null), "</summary><p>", uiText("以下按钮替换虚构记录。赛果到达后只出现红叹号，点击查看时才结算；退款仍在检查更新成功后自动处理。", null), "</p><div><button type=\"button\" data-game-action=\"example\" data-kind=\"win\">", uiText("载入赢的示例", null), "</button><button type=\"button\" data-game-action=\"example\" data-kind=\"dead-heat\">", uiText("载入同着冠军示例", null), "</button><button type=\"button\" data-game-action=\"example\" data-kind=\"lose\">", uiText("载入输的示例", null), "</button><button type=\"button\" data-game-action=\"example\" data-kind=\"broke\">", uiText("载入破产示例", null), "</button><button type=\"button\" data-game-action=\"example\" data-kind=\"refund-cancelled\">", uiText("刷新演示：取消退款", null), "</button><button type=\"button\" data-game-action=\"example\" data-kind=\"refund-withdrawn\">", uiText("刷新演示：退赛退款", null), "</button><button type=\"button\" data-game-action=\"folder-example\">", uiText("载入分组马券示例", null), "</button><button type=\"button\" data-game-action=\"status-example\">", uiText("载入多状态／两场待查看示例", null), "</button><button type=\"button\" data-game-action=\"reset\">", uiText("重置本金与演示", null), "</button></div></details>\n    </section>\n    <section class=\"game-panel\" data-game-panel=\"bank\" hidden>\n      <div class=\"game-balance-card game-bank-card\"><span class=\"game-card-label\"><i class=\"game-coin\" aria-hidden=\"true\">¥</i>", uiText("银行余额", null), "</span><strong id=\"game-bank-balance\"></strong><small>", uiText("每日 +¥10,000 · 上限 ¥1,000,000", null), "</small></div>\n      <p class=\"game-explainer\">", uiText("首次进入小店后银行才开始累计，当天为 0，从次日起每日 +¥10,000；之后关闭日历期间也累计。领取后转入可用资金。", null), "</p><p id=\"game-bank-timezone\" class=\"game-bank-timezone\"></p>\n      <form id=\"game-withdraw-form\"><label for=\"game-withdraw\">", uiText("取出金额", null), "</label><div class=\"game-amount-row\"><span>¥</span><input id=\"game-withdraw\" type=\"number\" min=\"1\" step=\"1\" inputmode=\"numeric\" required><button type=\"button\" data-game-action=\"withdraw-all\">", uiText("全部取出", null), "</button></div><button class=\"game-primary\" id=\"game-withdraw-submit\" type=\"submit\">", uiText("转入可用资金 ", null), "<span>›</span></button></form>\n      <details class=\"game-demo-controls\"><summary>", uiText("设计演示 · 模拟经过天数", null), "</summary><p>", uiText("用于比较累计、封顶和取款状态，本轮不会真实等待日期变化。", null), "</p><div><button type=\"button\" data-game-action=\"days\" data-days=\"1\">", uiText("经过 1 天", null), "</button><button type=\"button\" data-game-action=\"days\" data-days=\"7\">", uiText("经过 7 天", null), "</button><button type=\"button\" data-game-action=\"days\" data-days=\"100\">", uiText("经过 100 天", null), "</button></div></details>\n      <button class=\"game-text-button\" type=\"button\" data-game-action=\"wallet\">", uiText("‹ 返回小店", null), "</button>\n    </section>\n    <section class=\"game-panel\" data-game-panel=\"bet\" hidden>\n      <div class=\"game-bet-race\"><span class=\"grade-badge\">GⅠ</span><b id=\"game-bet-race-name\"></b><small id=\"game-bet-race-date\"></small></div>\n      <form id=\"game-bet-form\"><fieldset class=\"game-horse-choices\"><legend>", uiText("选择马匹 ", null), "<span>", uiText("单胜倍率 · 含本金", null), "</span></legend><div id=\"game-horses\"></div></fieldset>\n      <label for=\"game-stake\">", uiText("马券金额", null), "</label><div class=\"game-amount-row\"><span>¥</span><input id=\"game-stake\" type=\"number\" min=\"1\" step=\"1\" value=\"10000\" inputmode=\"numeric\" aria-describedby=\"game-stake-help game-stake-error\" aria-invalid=\"false\" required></div><p id=\"game-stake-help\" class=\"game-stake-help\"></p><p id=\"game-stake-error\" class=\"game-stake-error\" role=\"status\" hidden></p><div class=\"game-quick-amounts\"><button type=\"button\" data-game-action=\"stake\" data-amount=\"1000\">¥1,000</button><button type=\"button\" data-game-action=\"stake\" data-amount=\"10000\">¥10,000</button><button type=\"button\" data-game-action=\"stake\" data-amount=\"50000\">¥50,000</button></div>\n      <div class=\"game-ticket-preview\"><div class=\"game-ticket-preview-heading\"><b>", uiText("本次马券", null), "</b><span>", uiText("WIN · 单胜／独赢", null), "</span></div><div class=\"game-ticket-selection\"><span id=\"game-selected-number\" class=\"game-horse-number\"></span><b id=\"game-selected-horse\"></b><div><small>", uiText("本次支出", null), "</small><strong id=\"game-selected-stake\"></strong></div></div><dl class=\"game-confirm-facts\"><div><dt>", uiText("确认时锁定倍率", null), "</dt><dd id=\"game-lock-odds\"></dd></div><div><dt>", uiText("单独获胜时返还", null), "</dt><dd id=\"game-return\"></dd></div><div><dt>", uiText("单独获胜时净收益", null), "</dt><dd id=\"game-profit\"></dd></div></dl><p class=\"game-ticket-balance\">", uiText("购买后可用资金 ", null), "<b id=\"game-cash-after\"></b></p></div><p id=\"game-purchase-record-note\" class=\"game-purchase-record-note\" role=\"status\"></p><p id=\"game-quote-source\" class=\"game-quote-source\"></p><p class=\"game-explainer\">", uiText("未来 30 天内、出走确认且有官方单胜赔率才可购买；确认时再次校验并锁定倍率。比赛当日截止。同着冠军按数量分摊总返还，最后向下取整。", null), "</p><p id=\"game-cached-odds-note\" class=\"game-cached-odds-note\" role=\"status\" hidden></p><p id=\"game-purchase-reason\" class=\"game-purchase-reason\" role=\"status\"></p><button id=\"game-bet-submit\" class=\"game-primary\" type=\"submit\">", uiText("确认购买马券 ", null), "<span>›</span></button></form><button class=\"game-text-button\" type=\"button\" data-game-action=\"wallet\">", uiText("‹ 返回小店", null), "</button>\n    </section>\n    <section class=\"game-panel game-result-panel\" data-game-panel=\"result\" hidden>\n      <div id=\"game-result-visual\" class=\"game-result-visual\"><img id=\"game-result-image\" alt=\"\" hidden><div id=\"game-image-pending\"><span id=\"game-result-symbol\"></span><b id=\"game-image-label\"></b><small>", uiText("指定梗图待确认", null), "</small></div></div>\n      <p id=\"game-result-caption\"></p><p id=\"game-result-new-correction\" class=\"correction-new-update\" role=\"status\" hidden></p><p id=\"game-refund-pending\" class=\"notification-pending\" role=\"status\" hidden></p><button id=\"notification-modal-refresh\" class=\"correction-incoming-demo\" type=\"button\" data-game-action=\"notification-refresh\" hidden>", uiText("演示：查询返回退款／更正", null), "</button><strong id=\"game-result-profit\"></strong><p id=\"game-result-summary\"></p><div id=\"game-result-details\" class=\"game-result-details\"></div><p id=\"game-bankrupt-japanese\" lang=\"ja\" hidden>", uiText("ギャンブルはやめよう。", null), "</p>\n      <button id=\"game-result-incoming\" class=\"correction-incoming-demo\" type=\"button\" data-game-action=\"incoming-correction\" hidden>", uiText("演示：查询返回新更正", null), "</button><button class=\"game-primary\" id=\"game-result-continue\" type=\"button\" data-game-action=\"close\">", uiText("关闭并查看比赛 ", null), "<span>›</span></button>\n    </section>\n    <p class=\"game-preview-note\">", uiText("DESIGN 62 · 仅使用虚拟日元，赛事、官方赔率资格与结果均为虚构示例。整页重载会重置；真实数据与资金存储尚未接入。", null), "</p></div>"].join('');
  document.body.append(modal);
  const get = id => document.getElementById(id);

  if (saveWallet) {
    modal.querySelector('.game-eligibility-note').textContent = devText('仅开放虚构场次测试马券。真实赛果与虚拟资金分开保存。', 'Tickets are enabled for the fictional test race. Official results and virtual funds are stored separately.', '馬券を購入できるのは架空のテストレースです。公式結果と仮想資金は別々に保存されます。');
    modal.querySelector('.game-preview-note').textContent = devText('开发测试 · 资金与马券保存在本机。', 'Dev build · Funds and tickets are saved on this Mac.', '開発版 · 資金と馬券はこのMacに保存されます。');
  }

  function updateHeader() {
    if (saveWallet) {
      const json = JSON.stringify(state);
      if (json !== savedWallet) {
        savedWallet = json;
        saveWallet(json).catch(error => {
          if (savedWallet === json) savedWallet = null;
          feedback(devText('无法保存马券资料：', 'Could not save ticket data: ', '馬券データを保存できません：') + error.message);
        });
      }
    }
    get('game-header-cash').textContent = uiText(money(state.cash));
    if (notificationCase) get('notification-summary').textContent = uiText("可用 {0} · {1}", {0: money(state.cash), 1: notificationWaiting ? '点击检查更新，模拟本次查询返回。' : '本次更新已处理；结算和更正仍需查看才入账，异常从赛事详情头像查看。'});
    get('game-header-bank').textContent = uiText(money(state.bank));
    tools.querySelector('button').setAttribute('aria-label', uiText("打开特别周的小店，可用资金 {0}，银行 {1}", {0: money(state.cash), 1: money(state.bank)}));
    get('game-preview-cash').textContent = uiText(money(state.cash));
    const ready = state.tickets.filter(ticket => ticket.status === 'pending' && ticket.confirmedWinners).length;
    get('game-preview-settlement-state').textContent = uiText(ready ? `${ready} 张马券已有确认赛果 · 返还尚未入账，点击赛事红色叹号查看并结算。` : state.tickets.some(ticket => ticket.status === 'pending') ? '仍有马券等待赛果，不提前结算。' : state.tickets.length ? '本场已结算 · 再次查看不会重复入账。' : '尚无马券。');
  }
  function feedback(message = '') { get('game-feedback').textContent = uiText(message); }
  function open(panel, title, kicker) {
    clearTimeout(cutoffTimer);
    view = panel;
    modal.dataset.view = panel;
    const themeRace = panel === 'bet' ? selectedRace : panel === 'result' ? resultRace : null;
    if (themeRace) modal.dataset.colorRegion = countryColors[themeRace.country] || 'other';
    else delete modal.dataset.colorRegion;
    modal.querySelectorAll('[data-game-panel]').forEach(section => { section.hidden = section.dataset.gamePanel !== panel; });
    get('game-title').textContent = uiText(title);
    get('game-kicker').textContent = uiText(kicker);
    modal.querySelector('.close-button').setAttribute('aria-label', uiText(panel === 'result' ? '关闭结算' : '关闭小店'));
    feedback();
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    get('game-title').focus({ preventScroll: true });
  }
  function openWallet() {
    if (state.shopActivated === false) activateShop(state, new Date(), zone());
    if (state.shopActivated === true) accrueShopBank(state, new Date());
    if (state.resultCorrections && correctionPreview.openFirst(tools.querySelector('button'))) return;
    const unreadRace = races.filter(race => unreadForRace(state, race.id).length)
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt) || a.id.localeCompare(b.id))[0];
    if (unreadRace) { showResult(unreadRace, tools.querySelector('button'), 'wallet'); return; }
    resultRace = null;
    open('wallet', '特别周的小店', 'WELCOME TO THE SHOP');
    get('game-cash').textContent = uiText(money(state.cash));
    get('game-cash-note').textContent = uiText(state.cash === 0 && state.correctionBankrupt ? '更正扣款后资金归零 · 可等待其他马券或从银行取款' : state.cash === 0 && state.tickets.some(ticket => ticket.status === 'pending')
      ? '资金已押出 · 等待未结算马券，不判定破产'
      : '首次进入小店获赠 ¥500,000 · 只发放一次');
    get('game-bank-summary').textContent = uiText(money(state.bank));
    const now = new Date();
    const upcoming = races.filter(race => withinBetWindow(race, now, zone()) && !race.sampleFinished);
    get('game-upcoming').innerHTML = upcoming.length ? upcoming.map(race => {
      const missing = [];
      if (race.sampleEntriesConfirmed !== true) missing.push('出马表尚未确认');
      if (race.sampleOfficialOdds !== true || !race.sampleOddsSource?.trim()) missing.push('官方单胜赔率尚未取得');
      const reason = race.sampleCancelled ? bettingBlockReason(race, now, zone()) : uiList(missing, ' · ') || bettingBlockReason(race, now, zone());
      return ["<button type=\"button\" ", String(reason ? 'disabled' : 'data-game-action="bet"'), " data-race=\"", String(race.id), "\" data-color-region=\"", String(countryColors[race.country] || 'other'), "\" title=\"", uiText(reason || '出走已确认 · 已取得官方赔率（虚构资格）'), "\"><span class=\"game-upcoming-meta\">", uiText(race.grade === 'jpn1' ? '<span class="grade-badge">JpnⅠ</span>' : '<img src="assets/race-grade-g1.webp" alt="GⅠ">'), "<small>", uiText(new Date(race.startAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })), "<i>·</i>", uiText(race.country), "</small></span><b lang=\"", String(race.nameLang), "\">", uiText(escape(race.name)), "</b><span class=\"game-upcoming-bottom\"><small>", uiText(reason || '出走确认 · 官方赔率'), "</small><span>", uiText(reason ? '暂不可购买' : '选择马匹 ›'), "</span></span></button>"].join('');
    }).join('') : ["<p class=\"game-empty\">", uiText("未来 30 天暂无已载入的赛事资料。仍可比较下方设计示例。", null), "</p>"].join('');
    const entryToggle = get('game-toggle-detail-entry');
    entryToggle.setAttribute('aria-checked', String(state.detailBetEntry === true));
    entryToggle.textContent = uiText(state.detailBetEntry === true ? '已开启' : '已关闭');
    renderTicketFolder();
    updateHeader();
  }
  function renderTicketFolder() {
    const filters = [['all', '全部'], ['waiting', '等待赛果'], ['ready', '待查看结算'], ['settled', '已结算'], ['refunded', '已退款']];
    const category = ticket => ticket.status === 'pending' ? ticket.confirmedWinners ? 'ready' : 'waiting' : ticket.status === 'void' ? 'refunded' : 'settled';
    const visible = state.tickets.filter(ticket => ticketFilter === 'all' || category(ticket) === ticketFilter);
    get('game-ticket-filters').innerHTML = filters.map(([key, label]) => ["<button type=\"button\" data-game-action=\"ticket-filter\" data-filter=\"", String(key), "\" aria-pressed=\"", String(ticketFilter === key), "\">", uiText(label), "<span>", uiText(key === 'all' ? state.tickets.length : state.tickets.filter(ticket => category(ticket) === key).length), "</span></button>"].join('')).join('');
    const groups = new Map();
    for (const ticket of [...visible].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt) || b.id - a.id)) {
      if (!groups.has(ticket.raceId)) groups.set(ticket.raceId, []);
      groups.get(ticket.raceId).push(ticket);
    }
    const ordered = [...groups].sort((a, b) => Number(b[1].some(ticket => ticket.status === 'pending')) - Number(a[1].some(ticket => ticket.status === 'pending')));
    get('game-ticket-count').textContent = uiText("{0} 场 · {1}{2} 张", {0: groups.size, 1: visible.length, 2: ticketFilter === 'all' ? '' : ` / ${state.tickets.length}`});
    get('game-tickets').innerHTML = ordered.length ? ordered.map(([raceId, tickets]) => {
      const race = races.find(item => item.id === raceId);
      const pending = tickets.filter(ticket => ticket.status === 'pending').length;
      const ready = tickets.filter(ticket => category(ticket) === 'ready').length;
      const voluntary = tickets.filter(ticket => ticket.status === 'void' && ticket.voidReason === 'voluntary').length;
      const voided = tickets.filter(ticket => ticket.status === 'void' && ticket.voidReason !== 'voluntary').length;
      const completed = tickets.length - pending - voided - voluntary;
      const counts = [pending - ready && `等待赛果 ${pending - ready}`, ready && `待查看结算 ${ready}`, completed && `已结算 ${completed}`, voluntary && `主动退款 ${voluntary}`, voided && `无效 ${voided}`].filter(Boolean).join(' · ');
      const spent = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
      const returned = tickets.reduce((sum, ticket) => sum + (ticket.returned || 0), 0);
      const blocked = bettingBlockReason(race, new Date(), zone()) || (state.cash === 0 ? '可用资金不足' : '');
      const date = new Date(race.startAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      return ["<details class=\"game-ticket-group\" data-color-region=\"", String(countryColors[race.country] || 'other'), "\" data-ticket-race=\"", String(race.id), "\" ", ">\n        <summary><span class=\"game-ticket-group-top\"><span class=\"game-ticket-group-date\">", uiText("{3} · {4}", {3: date, 4: race.country}), "</span><span class=\"game-ticket-group-count\">", uiText("{5} 张马券", {5: tickets.length}), "</span></span><span class=\"game-ticket-group-name\"><b lang=\"", String(race.nameLang), "\">", uiText(escape(race.name)), "</b><span aria-hidden=\"true\">⌄</span></span><span class=\"game-ticket-group-stats\"><span>", uiText(ticketFilter === 'all' ? '累计购买' : '本筛选购买'), " ", "<b>", uiText(money(spent)), "</b></span><span>", uiText(tickets.some(ticket => ticket.originalSettlement) ? '更正后应返还' : ticketFilter === 'all' ? '已返还' : '本筛选已返还'), " ", "<b>", uiText(money(returned)), "</b></span></span><span class=\"game-ticket-group-state\">", uiText(counts), "</span></summary>\n        <div class=\"game-ticket-group-body\"><div class=\"game-ticket-group-actions\"><button type=\"button\" data-game-action=\"race\" data-race=\"", String(race.id), "\">", uiText("{14} ›", {14: ready ? '查看并结算' : '查看赛事'}), "</button><button type=\"button\" data-game-action=\"bet\" data-race=\"", String(race.id), "\" ", String(blocked ? 'disabled' : ''), ">", uiText("继续购买／追加 ›", null), "</button><small>", uiText(blocked || '新马券按本次确认的倍率锁定'), "</small></div><p class=\"game-ticket-group-order\">", uiText("逐笔记录 · 最新购买在前", null), "</p>", uiText(tickets.map(ticket => renderFolderTicket(ticket, race, state.tickets.filter(item => item.raceId === raceId))).join('')), "</div>\n      </details>"].join('');
    }).join('') : state.tickets.length ? ["<div class=\"game-empty game-empty-tickets\"><span class=\"game-ticket-stub\" aria-hidden=\"true\">WIN</span><p><b>", uiText("暂无「{0}」马券", {0: filters.find(([key]) => key === ticketFilter)[1]}), "</b><span>", uiText("可以切换其他状态，或返回全部记录。", null), "</span></p><button type=\"button\" class=\"game-text-button\" data-game-action=\"ticket-filter\" data-filter=\"all\">", uiText("查看全部 ›", null), "</button></div>"].join('') : ["<div class=\"game-empty game-empty-tickets\"><span class=\"game-ticket-stub\" aria-hidden=\"true\">WIN</span><p><b>", uiText("马券夹还是空的", null), "</b><span>", uiText("从上方选择一场未来赛事，收好你的第一张马券。", null), "</span></p></div>"].join('');
  }
  function renderFolderTicket(ticket, race, tickets) {
    const pending = ticket.status === 'pending';
    const voided = ticket.status === 'void';
    const voluntary = voided && ticket.voidReason === 'voluntary';
    const addition = tickets.some(previous => previous.horseNumber === ticket.horseNumber && previous.id < ticket.id);
    const status = pending ? ticket.confirmedWinners ? '待点击结算' : '等待赛果' : voluntary ? '主动退款 · 已退本金' : voided ? '无效 · 已退款' : `${ticket.originalSettlement ? '更正赛果 · ' : ''}${ticket.status === 'won' ? '命中' : '未命中'} · ${signed(ticket.profit)}${ticket.originalSettlement ? '（应计）' : ''}`;
    const date = value => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '暂无记录';
    const note = ticket.originalSettlement ? '本栏按更正赛果展示应返还；原结算及实际补扣、免除金额可查看本场更正记录。' : voluntary ? '主动申请退款 · 本金已退回可用资金 · 不计输赢' : voided ? `${ticket.voidReason === 'cancelled' ? '赛事取消' : '所选马匹退赛'} · 不计输赢` : ticket.status === 'won' && ticket.deadHeatCount > 1 ? `同着命中 · ${ticket.deadHeatCount} 匹冠军分摊总返还` : pending ? '单独获胜时的返还估算；同着按冠军数量分摊。' : '已按本张马券的锁定倍率独立结算。';
    const refundBlocked = refundPreview ? voluntaryRefundBlockReason(ticket, race, new Date(), zone()) : '';
    const refundControl = !refundPreview ? '' : refundBlocked
      ? ["<div class=\"game-ticket-refund-unavailable\"><button type=\"button\" disabled>", uiText("申请退款", null), "</button><span>", uiText(refundBlocked), "</span></div>"].join('')
      : ["<details class=\"game-ticket-refund-request\"><summary>", uiText("申请退款 ", null), "<span>", uiText("方案预览 ›", null), "</span></summary><div class=\"game-ticket-refund-confirm\"><b>", uiText("退回本张马券的全部本金？", null), "</b><p>", uiText("仅处理 #{0}，同场其他马券和追加记录继续保留。比赛当天及前 2 个日历日不可主动退款，不计输赢。", {0: String(ticket.id).padStart(4, '0')}), "</p><dl><div><dt>", uiText("退回本金", null), "</dt><dd>", uiText(money(ticket.amount)), "</dd></div><div><dt>", uiText("退款后可用", null), "</dt><dd>", uiText(money(state.cash + ticket.amount)), "</dd></div></dl><div class=\"game-ticket-refund-actions\"><button type=\"button\" data-game-action=\"keep-ticket\">", uiText("保留马券", null), "</button><button type=\"button\" data-game-action=\"ticket-refund\" data-id=\"", String(ticket.id), "\">", uiText("确认退款", null), "</button></div><p class=\"game-ticket-refund-error\" role=\"status\" hidden></p></div></details>"].join('');
    return ["<article class=\"game-ticket game-ticket-record\" data-status=\"", String(ticket.status), "\" data-ticket-id=\"", String(ticket.id), "\" data-color-region=\"", String(countryColors[race.country] || 'other'), "\">\n      <div class=\"game-ticket-record-title\"><span class=\"game-horse-number\">", uiText(ticket.horseNumber), "</span><b>", uiText(escape(ticket.horseName)), "</b>", uiText(addition ? ["<span class=\"game-ticket-addition\">", uiText("追加购买", null), "</span>"].join('') : ''), "<span class=\"game-ticket-record-id\">", uiText("#{6}", {6: String(ticket.id).padStart(4, '0')}), "</span></div><strong class=\"game-ticket-status\">", uiText(status), "</strong>\n      <dl class=\"game-ticket-record-facts\"><div><dt>", uiText("本笔金额", null), "</dt><dd>", uiText(money(ticket.amount)), "</dd></div><div><dt>", uiText("锁定倍率 · 含本金", null), "</dt><dd>", uiText(ticket.odds), "<small>", uiText(" 倍", null), "</small></dd></div><div><dt>", uiText(pending ? '单独获胜时返还估算' : voided ? '已退本金' : ticket.originalSettlement ? '更正后应返还' : '已返还'), "</dt><dd>", uiText(money(pending ? grossReturn(ticket.amount, ticket.odds) : ticket.returned)), "</dd></div></dl>\n      <p class=\"game-ticket-record-note\">", uiText(note), "</p>\n      <details class=\"game-ticket-record-details\"><summary><span class=\"game-ticket-details-open\">", uiText("查看详情", null), "</span><span class=\"game-ticket-details-close\">", uiText("收起详情", null), "</span><span class=\"game-ticket-details-chevron\" aria-hidden=\"true\">⌄</span></summary><div class=\"game-ticket-record-source\"><span>", uiText("购买时间：{13} · {14}", {13: date(ticket.placedAt), 14: zone()}), "</span><span>", uiText("赔率来源：{15}", {15: escape(ticket.source || '暂无记录')}), "</span><span>", uiText("赔率取得时间：{16} · {17}", {16: date(ticket.oddsAt), 17: zone()}), "</span>", uiText("{18}{19}", {18: voluntary ? ["<span>", uiText("主动退款时间：{0} · {1}", {0: date(ticket.refundedAt), 1: zone()}), "</span>"].join('') : '', 19: ticket.originalSettlement ? correctionPreview.ticketHistory(ticket) : ''}), "</div></details>", uiText("\n      {20}\n      {21}\n      {22}\n    ", {20: refundControl, 21: ticket.originalSettlement ? ["<button class=\"game-ticket-open\" type=\"button\" data-game-action=\"correction\" data-race=\"", String(race.id), "\">", uiText("查看本场更正记录 ›", null), "</button>"].join('') : '', 22: race.sampleQuality && pending && !ticket.confirmedWinners ? ["<p class=\"game-quality-ticket-note\">", uiText(qualityCaseFor(race).ticket), "</p>"].join('') : pending && !ticket.confirmedWinners ? ["<details class=\"game-ticket-demo\"><summary>", uiText("演示赛果／变更", null), "</summary><button type=\"button\" data-game-action=\"settle\" data-id=\"", String(ticket.id), "\" data-win=\"yes\">", uiText("模拟取得获胜赛果", null), "</button><button type=\"button\" data-game-action=\"settle\" data-id=\"", String(ticket.id), "\" data-win=\"no\">", uiText("模拟取得未胜赛果", null), "</button><button type=\"button\" data-game-action=\"refund\" data-id=\"", String(ticket.id), "\" data-reason=\"withdrawn\">", uiText("本马退赛", null), "</button><button type=\"button\" data-game-action=\"refund\" data-id=\"", String(ticket.id), "\" data-reason=\"cancelled\">", uiText("赛事取消", null), "</button></details>"].join('') : ["<button class=\"game-ticket-open\" type=\"button\" data-game-action=\"result\" data-race=\"", String(race.id), "\">", uiText("查看{1}{2}", {1: voided ? '退款' : '结算', 2: !ticket.read ? ' !' : ''}), "</button>"].join('')}), "</article>"].join('');
  }
  function confirmTicketRefund(ticketId) {
    if (!refundPreview) throw new Error('当前未启用主动退款预览');
    const ticket = state.tickets.find(item => item.id === ticketId);
    if (!ticket) throw new Error('未找到本张马券');
    const race = races.find(item => item.id === ticket.raceId);
    refundPreviewTicket(state, ticketId, race, new Date(), zone());
    const folder = get('game-tickets');
    const opened = new Set([...folder.querySelectorAll('.game-ticket-group[open]')].map(group => group.dataset.ticketRace));
    renderTicketFolder();
    folder.querySelectorAll('.game-ticket-group').forEach(group => { group.open = opened.has(group.dataset.ticketRace) || group.dataset.ticketRace === race.id; });
    get('game-cash').textContent = uiText(money(state.cash));
    get('game-cash-note').textContent = uiText('首次进入小店获赠 ¥500,000 · 只发放一次');
    updateHeader();
    renderCalendar();
    const row = folder.querySelector(`[data-ticket-id="${ticketId}"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      row.querySelector('.game-ticket-open').focus({ preventScroll: true });
    } else {
      feedback(uiText("已退回 {0} 本金，记录可在「已退款」中查看。", {0: money(ticket.amount)}));
      get('game-ticket-filters').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    }
  }
  function openBank() {
    if (state.shopActivated === false) { openWallet(); return; }
    if (state.shopActivated === true) accrueShopBank(state, new Date());
    open('bank', '银行', 'DAILY SUPPORT');
    get('game-bank-balance').textContent = uiText(money(state.bank));
    get('game-bank-timezone').textContent = uiText(state.bankTimeZone ? `换日时区 · ${state.bankTimeZone}（首次进入小店时固定）` : '历史演示账户 · 换日时区未记录');
    get('game-withdraw').value = state.bank ? Math.min(state.bank, 10000) : '';
    get('game-withdraw').max = state.bank;
    get('game-withdraw-submit').disabled = state.bank === 0;
    updateHeader();
  }
  function openBet(race, opener) {
    if (state.shopActivated === false) { openWallet(); return; }
    const reason = bettingBlockReason(race, new Date(), zone());
    if (reason) { feedback(uiText(reason)); return; }
    selectedRace = race;
    selectedHorse = horses(race).find(horse => horse.odds != null && !race.sampleWithdrawnNumbers?.includes(horse.number))?.number;
    if (!selectedHorse) { feedback(uiText('暂无可以购买马券的参赛马匹')); return; }
    modal.close();
    showRace(race, opener);
    showOdds();
    open('bet', '选一张心仪的马券', 'RACE TICKET · WIN');
    get('game-bet-race-name').textContent = race.name;
    get('game-bet-race-date').textContent = uiText("{0} · {1}", {0: new Date(race.startAt).toLocaleDateString('zh-CN'), 1: race.place});
    get('game-horses').innerHTML = horses(race).map(horse => {
      const withdrawn = race.sampleWithdrawnNumbers?.includes(horse.number);
      const missing = horse.odds == null;
      return ["<label data-withdrawn=\"", String(Boolean(withdrawn)), "\" data-missing-odds=\"", String(missing), "\"><input type=\"radio\" name=\"game-horse\" value=\"", String(horse.number), "\" ", String(horse.number === selectedHorse ? 'checked' : ''), " ", String(withdrawn || missing ? 'disabled' : ''), "><span class=\"game-horse-number\">", uiText(horse.number), "</span><b>", uiText(escape(horse.name)), "</b><strong>", uiText(withdrawn ? '已退赛' : missing ? '暂无倍率' : [uiText(horse.odds), "<small>", uiText(" 倍", null), "</small>"].join('')), "</strong></label>"].join('');
    }).join('');
    get('game-stake').value = Math.min(state.cash, 10000) || '';
    get('game-stake').max = state.cash;
    updateQuote();
  }
  function updateQuote() {
    const horse = horses(selectedRace).find(item => item.number === selectedHorse);
    const stakeInput = get('game-stake');
    const rawAmount = stakeInput.value.trim();
    const amount = Number(rawAmount);
    const amountError = rawAmount === '' ? '请输入马券金额。'
      : !Number.isSafeInteger(amount) || amount < 1 ? '请输入 ¥1 起的整数金额。'
      : amount > state.cash ? uiText('金额超过可用资金 {0}。', {0: money(state.cash)}) : '';
    get('game-stake-help').textContent = uiText('¥1 起，仅限整数；可用资金 {0}。快捷金额会替换当前输入。', {0: money(state.cash)});
    get('game-stake-error').textContent = uiText(amountError);
    get('game-stake-error').hidden = !amountError;
    stakeInput.setAttribute('aria-invalid', String(Boolean(amountError)));
    get('game-bet-form').querySelectorAll('[data-game-action="stake"]').forEach(button => {
      button.disabled = Number(button.dataset.amount) > state.cash;
      button.setAttribute('aria-pressed', String(!amountError && Number(button.dataset.amount) === amount));
    });
    const validOdds = horse.odds != null;
    const valid = validOdds && !amountError;
    const returned = valid ? grossReturn(amount, horse.odds) : null;
    get('game-selected-number').textContent = uiText(horse.number);
    get('game-selected-horse').textContent = horse.name;
    const existing = state.tickets.filter(ticket => ticket.raceId === selectedRace.id && ticket.horseNumber === selectedHorse && ticket.status === 'pending');
    const refundPolicy = refundPreview ? '退款预览：比赛当天及前 2 个日历日不可主动退款。' : '确认后不可主动撤回。';
    get('game-purchase-record-note').textContent = uiText(existing.length
      ? `已持有本场该马 ${existing.length} 张马券，合计 ${money(existing.reduce((sum, ticket) => sum + ticket.amount, 0))}。本次追加独立成券，旧马券倍率不变；${refundPolicy}`
      : `本次购买独立成券；${refundPolicy}官方退赛或取消仍自动退本金。`);
    get('game-selected-stake').textContent = uiText(valid ? money(amount) : '—');
    get('game-cash-after').textContent = uiText(valid ? money(state.cash - amount) : '—');
    get('game-lock-odds').textContent = uiText(validOdds ? `${horse.odds} 倍` : '暂无倍率');
    get('game-return').textContent = uiText(returned === null ? '—' : money(returned));
    get('game-profit').textContent = uiText(returned === null ? '—' : signed(returned - amount));
    const acquiredAt = selectedRace.sampleOddsAt
      ? `${new Date(selectedRace.sampleOddsAt).toLocaleString('zh-CN')}（${zone()}）`
      : '暂无记录';
    get('game-quote-source').textContent = uiText("赔率来源：{0}\n取得时间：{1} · 与赛事详情共用资料", {0: selectedRace.sampleOddsSource, 1: acquiredAt});
    const mode = getOddsStatus(selectedRace);
    const cached = mode === 'offline' || mode === 'failed';
    get('game-cached-odds-note').hidden = !cached;
    get('game-cached-odds-note').textContent = uiText(cached
      ? `${mode === 'offline' ? '当前离线' : '本次赔率获取失败'} · 使用上次缓存的官方赔率。取得时间：${acquiredAt}。确认后按此倍率锁定。`
      : '');
    const blocked = bettingBlockReason(selectedRace, new Date(), zone()) || (!validOdds ? '本马暂无可用单胜倍率' : '');
    get('game-purchase-reason').textContent = uiText(blocked);
    get('game-bet-submit').disabled = Boolean(blocked) || !valid;
    get('game-bet-submit').textContent = uiText(blocked ? '当前不可购买' : cached ? '按缓存赔率确认购买 ›' : '确认购买马券 ›');
    schedulePurchaseCutoff();
  }
  function schedulePurchaseCutoff() {
    clearTimeout(cutoffTimer);
    const cutoff = new Date(selectedRace.startAt);
    cutoff.setHours(0, 0, 0, 0);
    const remaining = cutoff.getTime() - Date.now();
    // 仅更新购买控件；不联网。长于浏览器计时上限时分段等待。
    if (remaining > 0 && view === 'bet') cutoffTimer = setTimeout(updateQuote, Math.min(remaining + 25, 2147483647));
  }
  function showResult(race, opener, destination = 'race', refundOnly = false) {
    if (!refundOnly && state.resultCorrections && correctionPreview.hasUnread(race.id)) { correctionPreview.show(race, opener, destination); return; }
    correctionBankruptcy = false;
    if (race.sampleQuality && !qualityCaseFor(race).officialResult && !refundOnly) { feedback(uiText('尚无可核实的正式冠军，继续等待赛果。')); return; }
    // Opening the result is the settlement trigger; background refunds never settle race winnings.
    if (!refundOnly) settleRace(state, race.id);
    const settled = state.tickets.filter(item => item.raceId === race.id && item.status !== 'pending');
    if (!settled.length) return;
    const unread = settled.filter(ticket => !ticket.read);
    resultTickets = unread.length ? unread : settled;
    if (refundOnly) resultTickets = resultTickets.filter(ticket => ticket.status === 'void');
    if (!resultTickets.length) return;
    resultRace = race;
    resultOpener = opener;
    resultDestination = destination;
    const counted = resultTickets.filter(ticket => ticket.status !== 'void');
    const profit = counted.reduce((sum, ticket) => sum + ticket.profit, 0);
    const broke = state.cash === 0 && !state.tickets.some(ticket => ticket.status === 'pending');
    const moreUnread = destination === 'wallet' && races.some(item => item.id !== race.id && unreadForRace(state, item.id).length);
    resultStages = counted.length ? [profit > 0 ? 'win' : 'lose'] : [];
    if (resultTickets.some(ticket => ticket.status === 'void')) resultStages.push('refund');
    if (broke && !moreUnread && !(refundOnly && deferredAfterRefund)) resultStages.push('broke');
    renderResultStage();
  }
  function renderResultStage() {
    const race = resultRace;
    const kind = resultStages[0];
    get('game-result-new-correction').hidden = true;
    get('game-result-incoming').hidden = state.sampleIncomingDemo !== true || kind === 'broke' || kind === 'refund';
    get('game-refund-pending').hidden = !(automaticRefundQueue && unreadRefundRaceIds(state).length && kind !== 'refund');
    get('notification-modal-refresh').hidden = !notificationCase || !notificationWaiting || kind === 'refund' || kind === 'broke';
    const broke = kind === 'broke';
    const refund = kind === 'refund';
    const tickets = resultTickets.filter(ticket => refund ? ticket.status === 'void' : ticket.status !== 'void');
    const profit = tickets.reduce((sum, ticket) => sum + ticket.profit, 0);
    const refunded = tickets.reduce((sum, ticket) => sum + ticket.returned, 0);
    const hit = tickets.some(ticket => ticket.status === 'won');
    const even = !refund && !broke && hit && profit === 0;
    open('result', refund ? tickets.some(ticket => ticket.voidReason === 'voluntary') ? '马券退款 · 本金已退回' : '马券无效 · 本金已退回' : broke ? '资金用完了…' : hit ? profit > 0 ? '本场命中！' : profit === 0 ? '本场命中 · 收支持平' : '本场命中 · 净亏损' : '这场没有命中', refund ? 'TICKET REFUND' : broke ? 'ZERO BALANCE' : 'RACE SETTLEMENT');
    modal.dataset.result = kind;
    get('game-result-symbol').textContent = uiText(refund ? '↩' : kind === 'win' ? '✦' : kind === 'lose' ? '…' : '¥0');
    get('game-image-label').textContent = uiText({ win: '特别周 · 眼冒星星', lose: '特别周 · 哭泣', broke: '特别周 · 求女儿们给钱', refund: '本金原额退回 · 不计输赢' }[kind]);
    const image = get('game-result-image');
    image.hidden = broke || refund || even;
    get('game-image-pending').hidden = !broke && !refund && !even;
    get('game-image-pending').querySelector('small').hidden = refund || even;
    if (even) { modal.dataset.result = 'even'; get('game-result-symbol').textContent = uiText('＝'); get('game-image-label').textContent = uiText('命中 · 收支持平'); }
    if (kind === 'lose') { image.src = 'assets/special-week-cry.png'; image.alt = uiText('特别周哭泣表情候选，来自《うまゆる》相关截图'); }
    if (kind === 'win') { image.src = 'assets/special-week-star-eyes-v1.png'; image.alt = uiText('特别周眼冒金色星星、开心欢呼的原创绘制表情'); }
    get('game-result-caption').textContent = uiText(broke ? correctionBankruptcy ? '赛果更正扣款后资金归零 · 其他待结算马券保留' : '所有马券均已结算' : race.name);
    get('game-result-profit').textContent = uiText(refund ? money(refunded) : broke ? money(state.cash) : signed(profit));
    get('game-result-summary').textContent = uiText(refund ? `已退回可用资金 · 当前 ${money(state.cash)} · 重复查看不会再次入账` : broke ? '当前可用资金' : `本场净收益 · 当前可用 ${money(state.cash)}`);
    get('game-result-details').innerHTML = tickets.map(ticket => {
      const shared = ticket.status === 'won' && ticket.deadHeatCount > 1;
      const formula = `${money(ticket.amount)} × ${ticket.odds} 倍${shared ? ` ÷ ${ticket.deadHeatCount}` : ''}`;
      const note = shared ? ["<small class=\"game-dead-heat-note\">", uiText("同着命中 · {0} 匹冠军 · 锁定倍率不变", {0: ticket.deadHeatCount}), "<br>", uiText("单独获胜时可返还 {1} → 本次 {2}；分摊后向下取整。", {1: money(ticket.singleWinnerReturn), 2: money(ticket.returned)}), "</small>"].join('') : '';
      return ["<div><span>", uiText("{0} 号 {1}", {0: ticket.horseNumber, 1: escape(ticket.horseName)}), "</span><b>", uiText(refund ? ticket.voidReason === 'voluntary' ? '主动申请退款 · 不计输赢' : `无效 · ${ticket.voidReason === 'cancelled' ? '赛事取消' : '马匹退赛'}` : formula), "</b><span>", uiText("{3} {4}", {3: refund ? '退还本金' : '总返还', 4: money(ticket.returned)}), "</span>", uiText(note), "</div>"].join('');
    }).join('');
    get('game-result-details').hidden = broke;
    get('game-bankrupt-japanese').hidden = !broke;
    const label = resultStages.length > 1 ? resultStages[1] === 'refund' ? '继续查看退款' : '继续查看资金状态' : resultDestination === 'wallet' ? '返回小店' : resultDestination === 'calendar' ? '知道了，返回日历' : '关闭并查看比赛';
    get('game-result-continue').innerHTML = [uiText(label), " ", "<span>›</span>"].join('');
    if (resultStages.length > 1) modal.querySelector('.close-button').setAttribute('aria-label', uiText('继续查看资金状态'));
    updateHeader();
  }
  function finishResult(destination = resultDestination) {
    const race = resultRace;
    const opener = resultOpener;
    markRead(state, race.id, resultTickets.map(ticket => ticket.id));
    resultRace = null;
    resultStages = [];
    resultTickets = [];
    correctionBankruptcy = false;
    modal.close();
    renderCalendar();
    if (automaticRefundQueue) {
      if (showNextRefund()) return;
      automaticRefundQueue = false;
      if (deferredAfterRefund) {
        const context = deferredAfterRefund; deferredAfterRefund = null;
        if (context.bankrupt && state.cash === 0) { showBankruptcy(context.race, context.opener, context.destination, context.correctionBankruptcy); return; }
        returnResultDestination(context.destination, context.race, context.opener);
        return;
      }
      destination = refundReturnTo;
    }
    returnResultDestination(destination, race, opener);
  }
  function returnResultDestination(destination, race, opener) {
    if (destination === 'wallet') openWallet();
    else if (destination === 'bank') openBank();
    else if (destination === 'calendar') { closeRace(); document.getElementById('calendar-refresh')?.focus({ preventScroll: true }); }
    else showRace(race, opener);
  }
  function showNextRefund() {
    if (correctionPreview.isOpen() || (view === 'result' && resultRace && modal.open)) return false;
    const raceId = unreadRefundRaceIds(state)[0];
    if (!raceId) return false;
    showResult(races.find(race => race.id === raceId), document.getElementById('calendar-refresh'), refundReturnTo, true);
    return true;
  }
  function processRefreshedChanges() {
    if (notificationWaiting) publishNotificationUpdate();
    for (const change of queuedChanges) {
      const race = races.find(item => item.id === change.raceId);
      if (change.reason === 'cancelled' ? race.sampleCancelled : race.sampleWithdrawnNumbers?.includes(change.number)) continue;
      const withdrawnNumbers = change.reason === 'withdrawn' ? [...new Set([...(race.sampleWithdrawnNumbers || []), change.number])] : race.sampleWithdrawnNumbers || [];
      recordPreviewRaceChange(race, { kind: change.reason, updatedAt: new Date().toISOString(), withdrawnNumbers });
      if (change.reason === 'cancelled') race.sampleCancelled = true;
      else race.sampleWithdrawnNumbers = withdrawnNumbers;
    }
    queuedChanges = [];
    applyRaceChanges(state, races);
    updateHeader();
    renderCalendar();
    if (unreadRefundRaceIds(state).length) {
      if (!automaticRefundQueue) refundReturnTo = modal.open && ['wallet', 'bank'].includes(view) ? view : 'calendar';
      automaticRefundQueue = true;
      for (const id of ['game-refund-pending', 'correction-refund-pending']) {
        get(id).hidden = false;
        get(id).textContent = uiText('有退款已自动到账；当前金额保留打开时的记录，关闭后接续查看。');
      }
      const label = correctionPreview.hasQueued() ? '继续查看新更正' : '继续查看退款';
      if (correctionPreview.isOpen()) get('correction-continue').innerHTML = [uiText(label), " ", "<span>›</span>"].join('');
      else if (modal.open && view === 'result' && resultStages[0] !== 'refund') get('game-result-continue').innerHTML = [uiText(label), " ", "<span>›</span>"].join('');
      showNextRefund();
    }
  }
  function resumeRefunds(context) {
    if (!automaticRefundQueue) return false;
    if (!unreadRefundRaceIds(state).length) { automaticRefundQueue = false; return false; }
    deferredAfterRefund = context;
    resultRace = null; resultStages = []; resultTickets = []; correctionBankruptcy = false;
    modal.close();
    return showNextRefund();
  }
  function markCurrentResultRead() {
    const refund = resultStages[0] === 'refund';
    markRead(state, resultRace.id, resultTickets.filter(ticket => refund ? ticket.status === 'void' : ticket.status !== 'void').map(ticket => ticket.id));
  }
  function showBankruptcy(race, opener, destination, corrected = true) {
    resultRace = race; resultOpener = opener; resultDestination = destination;
    resultTickets = []; resultStages = ['broke']; correctionBankruptcy = corrected;
    renderResultStage();
  }
  function dismiss() {
    if (view === 'result' && resultRace) {
      if (state.resultCorrections && correctionPreview.hasQueued()) {
        const context = { race: resultRace, opener: resultOpener, destination: resultDestination, bankrupt: resultStages.includes('broke') };
        markCurrentResultRead();
        resultRace = null; resultStages = []; resultTickets = []; correctionBankruptcy = false;
        correctionPreview.continueQueued(context);
        return;
      }
      if (automaticRefundQueue && unreadRefundRaceIds(state).length && resultStages[0] !== 'refund') {
        const context = { race: resultRace, opener: resultOpener, destination: resultDestination, bankrupt: resultStages.includes('broke'), correctionBankruptcy };
        markCurrentResultRead();
        if (resumeRefunds(context)) return;
      }
      if (resultStages.length > 1) { resultStages.shift(); renderResultStage(); }
      else finishResult();
    } else modal.close();
  }
  function leaveForCalendar() { modal.close(); closeRace(); renderCalendar(); document.getElementById('calendar-title').scrollIntoView({ block: 'start', behavior: 'instant' }); }
  function resetRaceSamples() {
    for (const race of races) {
      const original = originalRaceStates.get(race.id);
      for (const key of Object.keys(original)) {
        if (original[key] === undefined) delete race[key];
        else race[key] = structuredClone(original[key]);
      }
      delete race.sampleWinnerNumber;
      delete race.sampleWinnerNumbers;
    }
  }
  function loadExample(kind) {
    resetRaceSamples();
    queuedChanges = [];
    automaticRefundQueue = false;
    const refund = kind.startsWith('refund-');
    const reason = kind === 'refund-cancelled' ? 'cancelled' : 'withdrawn';
    const race = refund ? races.find(item => item.id === `change-${reason}`) || races.find(item => item.id === 'cox') : races.find(item => item.id === 'shuka');
    if (refund) {
      delete race.sampleCancelled;
      delete race.sampleWithdrawnNumbers;
      delete race.sampleChange;
      delete race.sampleChangeHistory;
      queuedChanges.push({ raceId: race.id, reason, number: 2 });
      state = pendingRefundExample(race.id, horses(race));
    } else {
      if (kind === 'dead-heat') race.sampleWinnerNumbers = [1, 2];
      else race.sampleWinnerNumber = kind === 'win' ? 1 : 2;
      state = settlementExample(kind, race.id, horses(race));
    }
    get('game-settlement-study').hidden = refund;
    updateHeader();
    leaveForCalendar();
    document.querySelector(`[data-game-race-id="${race.id}"]`)?.focus({ preventScroll: true });
    return race;
  }
  function loadFolderExample() {
    resetRaceSamples();
    queuedChanges = [];
    automaticRefundQueue = false;
    state = createState();
    ticketFilter = 'all';
    const add = (raceId, index, amount, odds, placedAt) => {
      const race = races.find(item => item.id === raceId);
      const sample = { ...race, sampleFinished: false, sampleCancelled: false, sampleWithdrawnNumbers: [], sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '官方单胜来源（虚构演示）', sampleOddsAt: placedAt };
      placeTicket(state, sample, { ...horses(race)[index], odds }, amount, new Date(placedAt), zone());
    };
    add('cox', 0, 10000, '3.2', '2026-10-21T03:00:00Z');
    add('cox', 0, 5000, '3.6', '2026-10-22T03:00:00Z');
    add('cox', 1, 10000, '4.8', '2026-10-22T03:05:00Z');
    if (refundPreview) {
      add('tenno', 0, 12000, '3.2', '2026-10-22T03:10:00Z');
      add('tenno', 0, 5000, '3.4', '2026-10-23T03:00:00Z');
    }
    add('shuka', 0, 10000, '3.2', '2026-10-16T03:00:00Z');
    add('shuka', 0, 5000, '3.6', '2026-10-17T03:00:00Z');
    add('shuka', 1, 8000, '4.8', '2026-10-17T03:05:00Z');
    recordRaceResult(state, 'shuka', 1);
    settleRace(state, 'shuka');
    markRead(state, 'shuka');
    races.find(race => race.id === 'shuka').sampleWinnerNumber = 1;
    add('arc', 1, 6000, '4.8', '2026-10-02T03:00:00Z');
    refundTickets(state, 'arc', 'withdrawn', 2);
    markRead(state, 'arc');
    const arc = races.find(race => race.id === 'arc');
    arc.sampleWithdrawnNumbers = [2];
    recordPreviewRaceChange(arc, { kind: 'withdrawn', updatedAt: '2026-10-03T01:00:00Z', withdrawnNumbers: [2] });
    arc.sampleChange.read = true;
    get('game-settlement-study').hidden = true;
    updateHeader();
    renderCalendar();
    openWallet();
    get('game-ticket-folder').scrollIntoView({ block: 'start', behavior: 'instant' });
    get('game-ticket-folder-title').focus({ preventScroll: true });
  }
  function loadStatusExample() {
    loadFolderExample();
    for (const [raceId, amount, placedAt] of [['shuka', 2000, '2026-10-17T03:10:00Z'], ['arc', 3000, '2026-10-02T03:10:00Z']]) {
      const race = races.find(item => item.id === raceId);
      const sample = { ...race, sampleFinished: false, sampleWithdrawnNumbers: [], sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '官方单胜来源（虚构演示）', sampleOddsAt: placedAt };
      placeTicket(state, sample, horses(race)[0], amount, new Date(placedAt), zone());
      recordRaceResult(state, raceId, 1);
      race.sampleFinished = true;
      race.sampleWinnerNumber = 1;
    }
    get('game-cash').textContent = uiText(money(state.cash));
    renderTicketFolder();
    updateHeader();
    renderCalendar();
    feedback(uiText('已载入两场待查看赛果，返还尚未入账。可先切换状态；点击小店后按比赛时间由早到晚展示。'));
  }
  function loadNotificationExample(key) {
    if (!['combined', 'result', 'correction', 'shortfall'].includes(key)) return;
    // All four scenarios replace the isolated review account, never a saved wallet.
    modal.close(); correctionPreview.reset(); closeRace();
    resetRaceSamples(); state = notificationState(races, horses, key === 'shortfall');
    ticketFilter = 'all'; queuedChanges = []; automaticRefundQueue = false; deferredAfterRefund = null;
    resultRace = null; resultStages = []; resultTickets = []; correctionBankruptcy = false;
    notificationCase = key; notificationWaiting = true;
    const correctionRace = races.find(race => race.id === 'notify-correction');
    const result = races.find(race => race.id === 'notify-result');
    correctionRace.sampleFinished = true; correctionRace.sampleWinnerNumber = 1;
    delete races.find(race => race.id === 'notify-failure').sampleUpdateFailures;
    if (key === 'result') {
      result.sampleFinished = true; result.sampleWinnerNumber = 1;
      recordRaceResult(state, result.id, 1);
      showResult(result, tools.querySelector('button'), 'calendar');
    }
    if (['correction', 'shortfall'].includes(key)) {
      correctionPreview.receive(correctionRace, { id: 'notification-v1', at: '2026-10-27T04:00:00Z', winners: [2], source: '正式更正（虚构）' });
      correctionPreview.show(correctionRace, tools.querySelector('button'), 'calendar');
    }
    updateHeader(); renderCalendar();
    const receipt = get('correction-dialog');
    let refresh = receipt.querySelector('[data-notification-refresh]');
    if (!refresh && ['correction', 'shortfall'].includes(key)) {
      refresh = document.createElement('button'); refresh.type = 'button';
      refresh.dataset.notificationRefresh = ''; refresh.className = 'correction-incoming-demo';
      refresh.textContent = uiText('演示：查询返回退款／更正');
      receipt.querySelector('.dialog-body').append(refresh);
    }
    if (refresh) refresh.hidden = !['correction', 'shortfall'].includes(key);
  }
  function publishNotificationUpdate() {
    notificationWaiting = false;
    const correctionRace = races.find(race => race.id === 'notify-correction');
    const result = races.find(race => race.id === 'notify-result');
    if (notificationCase !== 'shortfall') {
      const target = notificationCase === 'result' ? result : correctionRace;
      const winners = notificationCase === 'correction' ? [1] : [2];
      correctionPreview.receive(target, { id: 'notification-v2', at: '2026-10-28T04:00:00Z', winners, source: '本次查询返回的正式更正（虚构）' });
    }
    if (['combined', 'correction'].includes(notificationCase)) {
      result.sampleFinished = true; result.sampleWinnerNumber = 1;
      recordRaceResult(state, result.id, 1);
    }
    queuedChanges.push({ raceId: 'notify-refund', reason: 'cancelled' });
    races.find(race => race.id === 'notify-failure').sampleUpdateFailures = [{ field: 'odds', label: '单胜赔率', reason: '本次请求失败；保留已取得资料（虚构）', lastSuccessAt: '2026-10-26T04:00:00Z' }];
  }
  function loadQualityExample(race) {
    state = createState();
    ticketFilter = 'all';
    const quality = qualityCaseFor(race);
    if (quality.past) {
      const placedAt = new Date(new Date(race.startAt).getTime() - 86400000);
      const sample = { ...race, sampleFinished: false, sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '购券时已确认的官方报价（虚构）', sampleOddsAt: placedAt.toISOString() };
      placeTicket(state, sample, horses(race)[0], 10000, placedAt, zone());
      recordQualityResult(state, race);
    }
    updateHeader();
  }
  function handleAction(event) {
    const button = event.target.closest('[data-game-action]');
    if (!button) return;
    const action = button.dataset.gameAction;
    if (action === 'ticket-filter' && ['all', 'waiting', 'ready', 'settled', 'refunded'].includes(button.dataset.filter)) {
      ticketFilter = button.dataset.filter;
      renderTicketFolder();
      get('game-ticket-filters').querySelector(`[data-filter="${ticketFilter}"]`).focus({ preventScroll: true });
    }
    if (action === 'notification-refresh') requestRefresh();
    if (action === 'incoming-correction') correctionPreview.simulateIncoming();
    if (action === 'correction') correctionPreview.show(races.find(race => race.id === button.dataset.race), button, 'wallet');
    if (action === 'toggle-detail-entry') { state.detailBetEntry = state.detailBetEntry !== true; get('game-race-purchase').hidden = !state.detailBetEntry; get('game-race-action').hidden = !state.detailBetEntry && get('game-quality-result').hidden; openWallet(); get('game-toggle-detail-entry').focus({ preventScroll: true }); }
    if (action === 'wallet') openWallet();
    if (action === 'bank') openBank();
    if (action === 'close') dismiss();
    if (action === 'bet') openBet(races.find(race => race.id === button.dataset.race), button);
    if (action === 'race') {
      const race = races.find(race => race.id === button.dataset.race);
      if (state.resultCorrections && correctionPreview.hasUnread(race.id)) correctionPreview.show(race, button, 'wallet');
      else if (unreadForRace(state, race.id).length) showResult(race, button, 'wallet');
      else { modal.close(); showRace(race, button); }
    }
    if (action === 'folder-example') loadFolderExample();
    if (action === 'status-example') loadStatusExample();
    if (action === 'keep-ticket') {
      const request = button.closest('.game-ticket-refund-request');
      request.open = false;
      request.querySelector('summary').focus({ preventScroll: true });
    }
    if (action === 'ticket-refund') {
      try { confirmTicketRefund(Number(button.dataset.id)); }
      catch (error) {
        const message = button.closest('.game-ticket-refund-request').querySelector('.game-ticket-refund-error');
        message.textContent = uiText(error.message);
        message.hidden = false;
        button.disabled = true;
      }
    }
    if (action === 'stake') { get('game-stake').value = button.dataset.amount; updateQuote(); }
    if (action === 'days') { addBankDays(state, Number(button.dataset.days)); openBank(); feedback(uiText("已演示累计 {0} 天，银行最多保留 ¥1,000,000。", {0: state.bankDays})); }
    if (action === 'withdraw-all') get('game-withdraw').value = state.bank || '';
    if (action === 'example') { loadExample(button.dataset.kind); if (button.dataset.kind.startsWith('refund-')) requestRefresh(); }
    if (action === 'reset') { state = createState(); ticketFilter = 'all'; queuedChanges = []; automaticRefundQueue = false; get('game-settlement-study').hidden = true; resetRaceSamples(); renderCalendar(); openWallet(); }
    if (action === 'result') showResult(races.find(race => race.id === button.dataset.race), button, 'wallet');
    if (action === 'refund') {
      const ticket = state.tickets.find(item => item.id === Number(button.dataset.id));
      const reason = button.dataset.reason;
      queuedChanges.push({ raceId: ticket.raceId, reason, number: ticket.horseNumber });
      leaveForCalendar();
      requestRefresh();
    }
    if (action === 'settle') {
      const ticket = state.tickets.find(item => item.id === Number(button.dataset.id));
      const winner = button.dataset.win === 'yes' ? ticket.horseNumber : ticket.horseNumber === 1 ? 2 : 1;
      recordRaceResult(state, ticket.raceId, winner);
      get('game-settlement-study').hidden = false;
      const race = races.find(race => race.id === ticket.raceId);
      race.sampleFinished = true;
      race.sampleWinnerNumber = winner;
      delete race.sampleWinnerNumbers;
      updateHeader();
      leaveForCalendar();
    }
  }
  modal.addEventListener('click', handleAction);
  tools.addEventListener('click', handleAction);
  modal.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  get('game-horses').addEventListener('change', event => { selectedHorse = Number(event.target.value); updateQuote(); });
  get('game-stake').addEventListener('input', updateQuote);
  window.addEventListener('focus', () => { if (modal.open && view === 'bet') updateQuote(); });
  for (const event of ['online', 'offline']) window.addEventListener(event, () => { if (modal.open && view === 'bet') updateQuote(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && modal.open && view === 'bet') updateQuote(); });
  modal.addEventListener('close', () => { if (!modal.open) clearTimeout(cutoffTimer); });
  get('game-withdraw-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const amount = Number(get('game-withdraw').value); withdraw(state, amount); openBank(); feedback(uiText("已转入可用资金 {0}。", {0: money(amount)})); } catch (error) { feedback(uiText(error.message)); }
  });
  get('game-bet-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      placeTicket(state, selectedRace, horses(selectedRace).find(item => item.number === selectedHorse), Number(get('game-stake').value), new Date(), zone());
      openWallet();
      feedback(uiText('马券已收好，本次倍率已锁定。'));
    } catch (error) { updateQuote(); feedback(uiText(error.message)); }
  });
  const correctionPreview = createCorrectionPreview({
    document, races, horses, getState: () => state,
    replaceState: next => { state = next; ticketFilter = 'all'; queuedChanges = []; automaticRefundQueue = false; get('game-settlement-study').hidden = true; },
    getResultContext: () => modal.open && view === 'result' && resultRace ? { race: resultRace, opener: resultOpener, destination: resultDestination } : null,
    resetSamples: resetRaceSamples, closeGame: () => modal.close(), closeRace, showRace, openWallet,
    onBankrupt: showBankruptcy,
    afterCorrections: resumeRefunds,
    changed: () => {
      updateHeader(); renderCalendar();
      if (automaticRefundQueue && unreadRefundRaceIds(state).length && correctionPreview.isOpen()) {
        get('correction-refund-pending').hidden = false;
        get('correction-refund-pending').textContent = uiText('退款已自动到账，将在更正提示结束后展示。');
        get('correction-continue').innerHTML = [uiText(correctionPreview.hasQueued() ? '继续查看新更正' : '继续查看退款'), " ", "<span>›</span>"].join('');
      }
    }, money, signed, escape, countryColors
  });
  initNotificationReview(window.location.search, document, loadNotificationExample);
  get('notification-study').addEventListener('click', event => { if (event.target.closest('[data-notification-refresh]')) requestRefresh(); });
  get('correction-dialog').addEventListener('click', event => { if (event.target.closest('[data-notification-refresh]')) requestRefresh(); });
  updateHeader();
  return {
    loadQualityExample,
    prepareRefundDemo(reason) {
      loadExample(`refund-${reason}`);
      requestRefresh();
    },
    processRefreshedChanges,
    hasUnread: raceId => unreadForRace(state, raceId).length > 0 || Boolean(state.resultCorrections && correctionPreview.hasUnread(raceId)),
    decorateCard(button, race) {
      button.dataset.gameRaceId = race.id;
      const corrected = state.resultCorrections && correctionPreview.hasUnread(race.id);
      if (corrected || unreadForRace(state, race.id).length) {
        const badge = document.createElement('span');
        badge.className = 'game-alert'; badge.textContent = uiText('!'); badge.setAttribute('aria-label', uiText(corrected ? '赛果更正待查看，点击处理差额' : '赛果待查看，点击查看并结算'));
        button.append(badge); button.setAttribute('aria-label', uiText("{0}，赛果待查看或结算", {0: button.getAttribute('aria-label')}));
      }
    },
    interceptRace(race, button) {
      if (state.resultCorrections && correctionPreview.hasUnread(race.id)) return correctionPreview.show(race, button);
      if (!unreadForRace(state, race.id).length) return false;
      showResult(race, button); return true;
    },
    updateRaceAction(race) {
      const purchaseEntry = get('game-race-purchase');
      purchaseEntry.hidden = state.shopActivated === false || state.detailBetEntry !== true;
      const allowed = canBet(race, new Date(), zone());
      get('game-race-bet').disabled = !allowed || state.cash === 0;
      get('game-race-reason').textContent = uiText(allowed ? `未来 30 天内 · 出走确认 · 官方单胜（演示） · 可用 ${money(state.cash)}` : bettingBlockReason(race, new Date(), zone()));
      get('game-race-bet').onclick = () => openBet(race, get('game-race-bet'));
      const qualityResult = get('game-quality-result');
      qualityResult.hidden = !race.sampleQuality || !qualityCaseFor(race).officialResult || !unreadForRace(state, race.id).length;
      qualityResult.onclick = () => { closeRace(); showResult(race, qualityResult); };
      get('game-race-action').hidden = purchaseEntry.hidden && qualityResult.hidden;
    },
    openFromParams() {
      if (new URLSearchParams(location.search).get('notifications') === 'preview') { loadNotificationExample('combined'); requestRefresh(); return; }
      const correctionCase = new URLSearchParams(location.search).get('correction');
      if (correctionCase) { correctionPreview.loadExample(correctionCase); return; }
      const requested = new URLSearchParams(location.search).get('game');
      if (requested === 'tickets') loadFolderExample();
      if (requested === 'ticket-status') loadStatusExample();
      if (requested === 'wallet') openWallet();
      if (requested === 'bank') openBank();
      if (requested === 'bet') {
        const requestedId = new URLSearchParams(location.search).get('race');
        const race = races.find(item => item.id === requestedId) || races.find(item => canBet(item, new Date(), zone()));
        if (race && canBet(race, new Date(), zone())) openBet(race, tools.querySelector('button'));
        else { openWallet(); feedback(uiText('该场当前不符合购买条件，请查看未来 30 天的赛事。')); }
      }
      if (['win', 'lose', 'broke', 'dead-heat', 'refund-cancelled', 'refund-withdrawn'].includes(requested)) {
        loadExample(requested);
        if (requested.startsWith('refund-')) requestRefresh();
      }
    }
  };
}

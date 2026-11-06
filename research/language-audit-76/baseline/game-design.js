import { notificationState, initNotificationReview } from './notification-review.mjs?v=72';
import { createUnopenedShop, activateShop, accrueShopBank } from './shop-start-preview.mjs?v=60';
import { createCorrectionPreview } from './correction-design.mjs?v=72';
import { createState, addBankDays, withdraw, canBet, withinBetWindow, bettingBlockReason, grossReturn, placeTicket, recordRaceResult, settleRace, refundTickets, pendingRefundExample, applyRaceChanges, unreadRefundRaceIds, unreadForRace, markRead, settlementExample } from './game-state.mjs?v=58';
import { recordPreviewRaceChange } from './race-change-state.mjs?v=41';
import { voluntaryRefundBlockReason, refundPreviewTicket } from './voluntary-refund-preview.mjs?v=49';
import { qualityCaseFor, recordQualityResult } from './data-quality-preview.mjs?v=62';

export function createGamePreview({ races, entries, horseNames, countryColors, showRace, closeRace, renderCalendar, showOdds, requestRefresh, getOddsStatus }) {
  const refundPreview = new URLSearchParams(window.location.search).get('refund') === 'preview';
  let state = createUnopenedShop();
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
  raceAction.innerHTML = '<div id="game-race-purchase" class="game-race-purchase" hidden><button type="button" class="game-primary" id="game-race-bet">购买马券 <span>›</span></button><small id="game-race-reason"></small></div><button type="button" class="game-quality-settlement" id="game-quality-result" hidden>! 查看结果并结算</button>';
  document.querySelector('#race-panel .source-placeholder').after(raceAction);

  const modal = document.createElement('dialog');
  modal.id = 'game-dialog';
  modal.setAttribute('aria-labelledby', 'game-title');
  modal.innerHTML = `<div class="dialog-ribbon"><span id="game-ribbon">SPECIAL WEEK’S SHOP</span><span class="game-demo-tag">虚拟日元</span><button class="close-button" type="button" data-game-action="close" aria-label="关闭小店">×</button></div>
    <div class="game-body"><div class="game-heading"><div><p id="game-kicker"></p><h2 id="game-title"></h2></div><div class="game-host"><span lang="ja">いらっしゃいませ♪</span><img src="assets/special-week-shop-v1.png" alt="特别周小店店员"></div></div>
    <p id="game-feedback" role="status" aria-live="polite"></p>
    <section class="game-panel" data-game-panel="wallet">
      <div class="game-wallet-overview"><div class="game-balance-card"><span class="game-card-label"><i class="game-coin" aria-hidden="true">¥</i>可用资金</span><strong id="game-cash"></strong><small id="game-cash-note">首次进入小店获赠 ¥500,000 · 只发放一次</small></div>
      <button class="game-bank-shortcut" type="button" data-game-action="bank"><span class="game-bank-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18L12 3 3 9Zm2 3v7m7-7v7m7-7v7M3 22h18"/></svg><b>银行</b><small>DAILY BONUS</small></span><strong id="game-bank-summary"></strong><small class="game-bank-note">每日 +¥10,000 · 随时取出</small><span class="game-bank-arrow" aria-hidden="true">›</span></button></div>
      <section class="game-shop-preferences" aria-label="小店显示设置"><div><b>赛事详情购买入口</b><small>默认隐藏；开启后，在赛事详情显示“购买马券”。小店内仍可正常购买。</small></div><button id="game-toggle-detail-entry" type="button" role="switch" aria-checked="false" data-game-action="toggle-detail-entry">已关闭</button></section>
      <div class="game-section-heading"><h3>未来 30 天赛事</h3><span>仅单胜／独赢</span></div><p class="game-eligibility-note">确认出走名单且取得官方单胜赔率后才可购买；比赛当日截止。以下资格状态均为虚构演示。</p><div id="game-upcoming" class="game-upcoming"></div>
      <section id="game-ticket-folder" aria-labelledby="game-ticket-folder-title"><div class="game-section-heading"><h3 id="game-ticket-folder-title" tabindex="-1">我的马券</h3><span id="game-ticket-count" role="status"></span></div><p class="game-folder-rule">同场可买多匹，同马可分次追加；每笔独立锁定倍率。${refundPreview ? '退款预览：比赛当天及前 2 天不开放主动退款；比赛当天不能购买新马券。' : '确认后不可主动撤回。'}官方退赛／取消仍自动退本金。</p><div id="game-ticket-filters" class="game-ticket-filters" role="group" aria-label="按马券状态筛选"></div><p class="game-ticket-filter-note">筛选只改变显示；待查看结算仍在打开结果时入账。</p><div id="game-tickets"></div></section>
      <details class="game-demo-controls"><summary>设计演示 · 比较结算与退款</summary><p>以下按钮替换虚构记录。赛果到达后只出现红叹号，点击查看时才结算；退款仍在检查更新成功后自动处理。</p><div><button type="button" data-game-action="example" data-kind="win">载入赢的示例</button><button type="button" data-game-action="example" data-kind="dead-heat">载入同着冠军示例</button><button type="button" data-game-action="example" data-kind="lose">载入输的示例</button><button type="button" data-game-action="example" data-kind="broke">载入破产示例</button><button type="button" data-game-action="example" data-kind="refund-cancelled">刷新演示：取消退款</button><button type="button" data-game-action="example" data-kind="refund-withdrawn">刷新演示：退赛退款</button><button type="button" data-game-action="folder-example">载入分组马券示例</button><button type="button" data-game-action="status-example">载入多状态／两场待查看示例</button><button type="button" data-game-action="reset">重置本金与演示</button></div></details>
    </section>
    <section class="game-panel" data-game-panel="bank" hidden>
      <div class="game-balance-card game-bank-card"><span class="game-card-label"><i class="game-coin" aria-hidden="true">¥</i>银行余额</span><strong id="game-bank-balance"></strong><small>每日 +¥10,000 · 上限 ¥1,000,000</small></div>
      <p class="game-explainer">首次进入小店后银行才开始累计，当天为 0，从次日起每日 +¥10,000；之后关闭日历期间也累计。领取后转入可用资金。</p><p id="game-bank-timezone" class="game-bank-timezone"></p>
      <form id="game-withdraw-form"><label for="game-withdraw">取出金额</label><div class="game-amount-row"><span>¥</span><input id="game-withdraw" type="number" min="1" step="1" inputmode="numeric" required><button type="button" data-game-action="withdraw-all">全部取出</button></div><button class="game-primary" id="game-withdraw-submit" type="submit">转入可用资金 <span>›</span></button></form>
      <details class="game-demo-controls"><summary>设计演示 · 模拟经过天数</summary><p>用于比较累计、封顶和取款状态，本轮不会真实等待日期变化。</p><div><button type="button" data-game-action="days" data-days="1">经过 1 天</button><button type="button" data-game-action="days" data-days="7">经过 7 天</button><button type="button" data-game-action="days" data-days="100">经过 100 天</button></div></details>
      <button class="game-text-button" type="button" data-game-action="wallet">‹ 返回小店</button>
    </section>
    <section class="game-panel" data-game-panel="bet" hidden>
      <div class="game-bet-race"><span class="grade-badge">GⅠ</span><b id="game-bet-race-name"></b><small id="game-bet-race-date"></small></div>
      <form id="game-bet-form"><fieldset class="game-horse-choices"><legend>选择马匹 <span>单胜倍率 · 含本金</span></legend><div id="game-horses"></div></fieldset>
      <label for="game-stake">马券金额</label><div class="game-amount-row"><span>¥</span><input id="game-stake" type="number" min="1" step="1" value="10000" inputmode="numeric" required></div><div class="game-quick-amounts"><button type="button" data-game-action="stake" data-amount="1000">¥1,000</button><button type="button" data-game-action="stake" data-amount="10000">¥10,000</button><button type="button" data-game-action="stake" data-amount="50000">¥50,000</button></div>
      <div class="game-ticket-preview"><div class="game-ticket-preview-heading"><b>本次马券</b><span>WIN · 单胜／独赢</span></div><div class="game-ticket-selection"><span id="game-selected-number" class="game-horse-number"></span><b id="game-selected-horse"></b><div><small>本次支出</small><strong id="game-selected-stake"></strong></div></div><dl class="game-confirm-facts"><div><dt>确认时锁定倍率</dt><dd id="game-lock-odds"></dd></div><div><dt>单独获胜时返还</dt><dd id="game-return"></dd></div><div><dt>单独获胜时净收益</dt><dd id="game-profit"></dd></div></dl><p class="game-ticket-balance">购买后可用资金 <b id="game-cash-after"></b></p></div><p id="game-purchase-record-note" class="game-purchase-record-note" role="status"></p><p id="game-quote-source" class="game-quote-source"></p><p class="game-explainer">未来 30 天内、出走确认且有官方单胜赔率才可购买；确认时再次校验并锁定倍率。比赛当日截止。同着冠军按数量分摊总返还，最后向下取整。</p><p id="game-cached-odds-note" class="game-cached-odds-note" role="status" hidden></p><p id="game-purchase-reason" class="game-purchase-reason" role="status"></p><button id="game-bet-submit" class="game-primary" type="submit">确认购买马券 <span>›</span></button></form><button class="game-text-button" type="button" data-game-action="wallet">‹ 返回小店</button>
    </section>
    <section class="game-panel game-result-panel" data-game-panel="result" hidden>
      <div id="game-result-visual" class="game-result-visual"><img id="game-result-image" alt="" hidden><div id="game-image-pending"><span id="game-result-symbol"></span><b id="game-image-label"></b><small>指定梗图待确认</small></div></div>
      <p id="game-result-caption"></p><p id="game-result-new-correction" class="correction-new-update" role="status" hidden></p><p id="game-refund-pending" class="notification-pending" role="status" hidden></p><button id="notification-modal-refresh" class="correction-incoming-demo" type="button" data-game-action="notification-refresh" hidden>演示：查询返回退款／更正</button><strong id="game-result-profit"></strong><p id="game-result-summary"></p><div id="game-result-details" class="game-result-details"></div><p id="game-bankrupt-japanese" lang="ja" hidden>ギャンブルはやめよう。</p>
      <button id="game-result-incoming" class="correction-incoming-demo" type="button" data-game-action="incoming-correction" hidden>演示：查询返回新更正</button><button class="game-primary" id="game-result-continue" type="button" data-game-action="close">关闭并查看比赛 <span>›</span></button>
    </section>
    <p class="game-preview-note">DESIGN 62 · 仅使用虚拟日元，赛事、官方赔率资格与结果均为虚构示例。整页重载会重置；真实数据与资金存储尚未接入。</p></div>`;
  document.body.append(modal);
  const get = id => document.getElementById(id);

  function updateHeader() {
    get('game-header-cash').textContent = money(state.cash);
    if (notificationCase) get('notification-summary').textContent = `可用 ${money(state.cash)} · ${notificationWaiting ? '点击检查更新，模拟本次查询返回。' : '本次更新已处理；结算和更正仍需查看才入账，异常从赛事详情头像查看。'}`;
    get('game-header-bank').textContent = money(state.bank);
    tools.querySelector('button').setAttribute('aria-label', `打开特别周的小店，可用资金 ${money(state.cash)}，银行 ${money(state.bank)}`);
    get('game-preview-cash').textContent = money(state.cash);
    const ready = state.tickets.filter(ticket => ticket.status === 'pending' && ticket.confirmedWinners).length;
    get('game-preview-settlement-state').textContent = ready ? `${ready} 张马券已有确认赛果 · 返还尚未入账，点击赛事红色叹号查看并结算。` : state.tickets.some(ticket => ticket.status === 'pending') ? '仍有马券等待赛果，不提前结算。' : state.tickets.length ? '本场已结算 · 再次查看不会重复入账。' : '尚无马券。';
  }
  function feedback(message = '') { get('game-feedback').textContent = message; }
  function open(panel, title, kicker) {
    clearTimeout(cutoffTimer);
    view = panel;
    modal.dataset.view = panel;
    const themeRace = panel === 'bet' ? selectedRace : panel === 'result' ? resultRace : null;
    if (themeRace) modal.dataset.colorRegion = countryColors[themeRace.country] || 'other';
    else delete modal.dataset.colorRegion;
    modal.querySelectorAll('[data-game-panel]').forEach(section => { section.hidden = section.dataset.gamePanel !== panel; });
    get('game-title').textContent = title;
    get('game-kicker').textContent = kicker;
    modal.querySelector('.close-button').setAttribute('aria-label', panel === 'result' ? '关闭结算' : '关闭小店');
    feedback();
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
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
    get('game-cash').textContent = money(state.cash);
    get('game-cash-note').textContent = state.cash === 0 && state.correctionBankrupt ? '更正扣款后资金归零 · 可等待其他马券或从银行取款' : state.cash === 0 && state.tickets.some(ticket => ticket.status === 'pending')
      ? '资金已押出 · 等待未结算马券，不判定破产'
      : '首次进入小店获赠 ¥500,000 · 只发放一次';
    get('game-bank-summary').textContent = money(state.bank);
    const now = new Date();
    const upcoming = races.filter(race => withinBetWindow(race, now, zone()) && !race.sampleFinished);
    get('game-upcoming').innerHTML = upcoming.length ? upcoming.map(race => {
      const missing = [];
      if (race.sampleEntriesConfirmed !== true) missing.push('出马表尚未确认');
      if (race.sampleOfficialOdds !== true || !race.sampleOddsSource?.trim()) missing.push('官方单胜赔率尚未取得');
      const reason = race.sampleCancelled ? bettingBlockReason(race, now, zone()) : missing.join(' · ') || bettingBlockReason(race, now, zone());
      return `<button type="button" ${reason ? 'disabled' : 'data-game-action="bet"'} data-race="${race.id}" data-color-region="${countryColors[race.country] || 'other'}" title="${reason || '出走已确认 · 已取得官方赔率（虚构资格）'}"><span class="game-upcoming-meta">${race.grade === 'jpn1' ? '<span class="grade-badge">JpnⅠ</span>' : '<img src="assets/race-grade-g1.webp" alt="GⅠ">'}<small>${new Date(race.startAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}<i>·</i>${race.country}</small></span><b lang="${race.nameLang}">${escape(race.name)}</b><span class="game-upcoming-bottom"><small>${reason || '出走确认 · 官方赔率'}</small><span>${reason ? '暂不可购买' : '选择马匹 ›'}</span></span></button>`;
    }).join('') : '<p class="game-empty">未来 30 天暂无已载入的赛事资料。仍可比较下方设计示例。</p>';
    const entryToggle = get('game-toggle-detail-entry');
    entryToggle.setAttribute('aria-checked', String(state.detailBetEntry === true));
    entryToggle.textContent = state.detailBetEntry === true ? '已开启' : '已关闭';
    renderTicketFolder();
    updateHeader();
  }
  function renderTicketFolder() {
    const filters = [['all', '全部'], ['waiting', '等待赛果'], ['ready', '待查看结算'], ['settled', '已结算'], ['refunded', '已退款']];
    const category = ticket => ticket.status === 'pending' ? ticket.confirmedWinners ? 'ready' : 'waiting' : ticket.status === 'void' ? 'refunded' : 'settled';
    const visible = state.tickets.filter(ticket => ticketFilter === 'all' || category(ticket) === ticketFilter);
    get('game-ticket-filters').innerHTML = filters.map(([key, label]) => `<button type="button" data-game-action="ticket-filter" data-filter="${key}" aria-pressed="${ticketFilter === key}">${label}<span>${key === 'all' ? state.tickets.length : state.tickets.filter(ticket => category(ticket) === key).length}</span></button>`).join('');
    const groups = new Map();
    for (const ticket of [...visible].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt) || b.id - a.id)) {
      if (!groups.has(ticket.raceId)) groups.set(ticket.raceId, []);
      groups.get(ticket.raceId).push(ticket);
    }
    const ordered = [...groups].sort((a, b) => Number(b[1].some(ticket => ticket.status === 'pending')) - Number(a[1].some(ticket => ticket.status === 'pending')));
    get('game-ticket-count').textContent = `${groups.size} 场 · ${visible.length}${ticketFilter === 'all' ? '' : ` / ${state.tickets.length}`} 张`;
    get('game-tickets').innerHTML = ordered.length ? ordered.map(([raceId, tickets], index) => {
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
      return `<details class="game-ticket-group" data-color-region="${countryColors[race.country] || 'other'}" data-ticket-race="${race.id}" ${index === 0 ? 'open' : ''}>
        <summary><span class="game-ticket-group-top"><span class="game-ticket-group-date">${date} · ${race.country}</span><span class="game-ticket-group-count">${tickets.length} 张马券</span></span><span class="game-ticket-group-name"><b lang="${race.nameLang}">${escape(race.name)}</b><span aria-hidden="true">⌄</span></span><span class="game-ticket-group-stats"><span>${ticketFilter === 'all' ? '累计购买' : '本筛选购买'} <b>${money(spent)}</b></span><span>${tickets.some(ticket => ticket.originalSettlement) ? '更正后应返还' : ticketFilter === 'all' ? '已返还' : '本筛选已返还'} <b>${money(returned)}</b></span></span><span class="game-ticket-group-state">${counts}</span></summary>
        <div class="game-ticket-group-body"><div class="game-ticket-group-actions"><button type="button" data-game-action="race" data-race="${race.id}">${ready ? '查看并结算' : '查看赛事'} ›</button><button type="button" data-game-action="bet" data-race="${race.id}" ${blocked ? 'disabled' : ''}>继续购买／追加 ›</button><small>${blocked || '新马券按本次确认的倍率锁定'}</small></div><p class="game-ticket-group-order">逐笔记录 · 最新购买在前</p>${tickets.map(ticket => renderFolderTicket(ticket, race, state.tickets.filter(item => item.raceId === raceId))).join('')}</div>
      </details>`;
    }).join('') : state.tickets.length ? `<div class="game-empty game-empty-tickets"><span class="game-ticket-stub" aria-hidden="true">WIN</span><p><b>暂无「${filters.find(([key]) => key === ticketFilter)[1]}」马券</b><span>可以切换其他状态，或返回全部记录。</span></p><button type="button" class="game-text-button" data-game-action="ticket-filter" data-filter="all">查看全部 ›</button></div>` : '<div class="game-empty game-empty-tickets"><span class="game-ticket-stub" aria-hidden="true">WIN</span><p><b>马券夹还是空的</b><span>从上方选择一场未来赛事，收好你的第一张马券。</span></p></div>';
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
      ? `<div class="game-ticket-refund-unavailable"><button type="button" disabled>申请退款</button><span>${refundBlocked}</span></div>`
      : `<details class="game-ticket-refund-request"><summary>申请退款 <span>方案预览 ›</span></summary><div class="game-ticket-refund-confirm"><b>退回本张马券的全部本金？</b><p>仅处理 #${String(ticket.id).padStart(4, '0')}，同场其他马券和追加记录继续保留。比赛当天及前 2 个日历日不可主动退款，不计输赢。</p><dl><div><dt>退回本金</dt><dd>${money(ticket.amount)}</dd></div><div><dt>退款后可用</dt><dd>${money(state.cash + ticket.amount)}</dd></div></dl><div class="game-ticket-refund-actions"><button type="button" data-game-action="keep-ticket">保留马券</button><button type="button" data-game-action="ticket-refund" data-id="${ticket.id}">确认退款</button></div><p class="game-ticket-refund-error" role="status" hidden></p></div></details>`;
    return `<article class="game-ticket game-ticket-record" data-status="${ticket.status}" data-ticket-id="${ticket.id}" data-color-region="${countryColors[race.country] || 'other'}">
      <div class="game-ticket-record-title"><span class="game-horse-number">${ticket.horseNumber}</span><b>${escape(ticket.horseName)}</b>${addition ? '<span class="game-ticket-addition">追加购买</span>' : ''}<span class="game-ticket-record-id">#${String(ticket.id).padStart(4, '0')}</span></div><strong class="game-ticket-status">${status}</strong>
      <dl class="game-ticket-record-facts"><div><dt>本笔金额</dt><dd>${money(ticket.amount)}</dd></div><div><dt>锁定倍率 · 含本金</dt><dd>${ticket.odds}<small> 倍</small></dd></div><div><dt>${pending ? '单独获胜时返还估算' : voided ? '已退本金' : ticket.originalSettlement ? '更正后应返还' : '已返还'}</dt><dd>${money(pending ? grossReturn(ticket.amount, ticket.odds) : ticket.returned)}</dd></div></dl>
      <p class="game-ticket-record-note">${note}</p>
      <details class="game-ticket-record-details"><summary><span class="game-ticket-details-open">查看详情</span><span class="game-ticket-details-close">收起详情</span><span class="game-ticket-details-chevron" aria-hidden="true">⌄</span></summary><div class="game-ticket-record-source"><span>购买时间：${date(ticket.placedAt)} · ${zone()}</span><span>赔率来源：${escape(ticket.source || '暂无记录')}</span><span>赔率取得时间：${date(ticket.oddsAt)} · ${zone()}</span>${voluntary ? `<span>主动退款时间：${date(ticket.refundedAt)} · ${zone()}</span>` : ''}${ticket.originalSettlement ? correctionPreview.ticketHistory(ticket) : ''}</div></details>
      ${refundControl}
      ${ticket.originalSettlement ? `<button class="game-ticket-open" type="button" data-game-action="correction" data-race="${race.id}">查看本场更正记录 ›</button>` : ''}
      ${race.sampleQuality && pending && !ticket.confirmedWinners ? `<p class="game-quality-ticket-note">${qualityCaseFor(race).ticket}</p>` : pending && !ticket.confirmedWinners ? `<details class="game-ticket-demo"><summary>演示赛果／变更</summary><button type="button" data-game-action="settle" data-id="${ticket.id}" data-win="yes">模拟取得获胜赛果</button><button type="button" data-game-action="settle" data-id="${ticket.id}" data-win="no">模拟取得未胜赛果</button><button type="button" data-game-action="refund" data-id="${ticket.id}" data-reason="withdrawn">本马退赛</button><button type="button" data-game-action="refund" data-id="${ticket.id}" data-reason="cancelled">赛事取消</button></details>` : `<button class="game-ticket-open" type="button" data-game-action="result" data-race="${race.id}">查看${voided ? '退款' : '结算'}${!ticket.read ? ' !' : ''}</button>`}
    </article>`;
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
    get('game-cash').textContent = money(state.cash);
    get('game-cash-note').textContent = '首次进入小店获赠 ¥500,000 · 只发放一次';
    updateHeader();
    renderCalendar();
    const row = folder.querySelector(`[data-ticket-id="${ticketId}"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      row.querySelector('.game-ticket-open').focus({ preventScroll: true });
    } else {
      feedback(`已退回 ${money(ticket.amount)} 本金，记录可在「已退款」中查看。`);
      get('game-ticket-filters').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    }
  }
  function openBank() {
    if (state.shopActivated === false) { openWallet(); return; }
    if (state.shopActivated === true) accrueShopBank(state, new Date());
    open('bank', '银行', 'DAILY SUPPORT');
    get('game-bank-balance').textContent = money(state.bank);
    get('game-bank-timezone').textContent = state.bankTimeZone ? `换日时区 · ${state.bankTimeZone}（首次进入小店时固定）` : '历史演示账户 · 换日时区未记录';
    get('game-withdraw').value = state.bank ? Math.min(state.bank, 10000) : '';
    get('game-withdraw').max = state.bank;
    get('game-withdraw-submit').disabled = state.bank === 0;
    updateHeader();
  }
  function openBet(race, opener) {
    if (state.shopActivated === false) { openWallet(); return; }
    const reason = bettingBlockReason(race, new Date(), zone());
    if (reason) { feedback(reason); return; }
    selectedRace = race;
    selectedHorse = horses(race).find(horse => horse.odds != null && !race.sampleWithdrawnNumbers?.includes(horse.number))?.number;
    if (!selectedHorse) { feedback('暂无可以购买马券的参赛马匹'); return; }
    modal.close();
    showRace(race, opener);
    showOdds();
    open('bet', '选一张心仪的马券', 'RACE TICKET · WIN');
    get('game-bet-race-name').textContent = race.name;
    get('game-bet-race-date').textContent = `${new Date(race.startAt).toLocaleDateString('zh-CN')} · ${race.place}`;
    get('game-horses').innerHTML = horses(race).map(horse => {
      const withdrawn = race.sampleWithdrawnNumbers?.includes(horse.number);
      const missing = horse.odds == null;
      return `<label data-withdrawn="${Boolean(withdrawn)}" data-missing-odds="${missing}"><input type="radio" name="game-horse" value="${horse.number}" ${horse.number === selectedHorse ? 'checked' : ''} ${withdrawn || missing ? 'disabled' : ''}><span class="game-horse-number">${horse.number}</span><b>${escape(horse.name)}</b><strong>${withdrawn ? '已退赛' : missing ? '暂无倍率' : `${horse.odds}<small> 倍</small>`}</strong></label>`;
    }).join('');
    get('game-stake').value = Math.min(state.cash, 10000) || '';
    get('game-stake').max = state.cash;
    updateQuote();
  }
  function updateQuote() {
    const horse = horses(selectedRace).find(item => item.number === selectedHorse);
    const amount = Number(get('game-stake').value);
    const validOdds = horse.odds != null;
    const valid = validOdds && Number.isSafeInteger(amount) && amount > 0 && amount <= state.cash;
    const returned = valid ? grossReturn(amount, horse.odds) : null;
    get('game-selected-number').textContent = horse.number;
    get('game-selected-horse').textContent = horse.name;
    const existing = state.tickets.filter(ticket => ticket.raceId === selectedRace.id && ticket.horseNumber === selectedHorse && ticket.status === 'pending');
    const refundPolicy = refundPreview ? '退款预览：比赛当天及前 2 个日历日不可主动退款。' : '确认后不可主动撤回。';
    get('game-purchase-record-note').textContent = existing.length
      ? `已持有本场该马 ${existing.length} 张马券，合计 ${money(existing.reduce((sum, ticket) => sum + ticket.amount, 0))}。本次追加独立成券，旧马券倍率不变；${refundPolicy}`
      : `本次购买独立成券；${refundPolicy}官方退赛或取消仍自动退本金。`;
    get('game-selected-stake').textContent = valid ? money(amount) : '—';
    get('game-cash-after').textContent = valid ? money(state.cash - amount) : '—';
    get('game-lock-odds').textContent = validOdds ? `${horse.odds} 倍` : '暂无倍率';
    get('game-return').textContent = returned === null ? '—' : money(returned);
    get('game-profit').textContent = returned === null ? '—' : signed(returned - amount);
    const acquiredAt = selectedRace.sampleOddsAt
      ? `${new Date(selectedRace.sampleOddsAt).toLocaleString('zh-CN')}（${zone()}）`
      : '暂无记录';
    get('game-quote-source').textContent = `赔率来源：${selectedRace.sampleOddsSource}\n取得时间：${acquiredAt} · 与赛事详情共用资料`;
    const mode = getOddsStatus(selectedRace);
    const cached = mode === 'offline' || mode === 'failed';
    get('game-cached-odds-note').hidden = !cached;
    get('game-cached-odds-note').textContent = cached
      ? `${mode === 'offline' ? '当前离线' : '本次赔率获取失败'} · 使用上次缓存的官方赔率。取得时间：${acquiredAt}。确认后按此倍率锁定。`
      : '';
    const blocked = bettingBlockReason(selectedRace, new Date(), zone()) || (!validOdds ? '本马暂无可用单胜倍率' : '');
    get('game-purchase-reason').textContent = blocked;
    get('game-bet-submit').disabled = Boolean(blocked) || !valid;
    get('game-bet-submit').textContent = blocked ? '当前不可购买' : cached ? '按缓存赔率确认购买 ›' : '确认购买马券 ›';
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
    if (race.sampleQuality && !qualityCaseFor(race).officialResult && !refundOnly) { feedback('尚无可核实的正式冠军，继续等待赛果。'); return; }
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
    get('game-result-symbol').textContent = refund ? '↩' : kind === 'win' ? '✦' : kind === 'lose' ? '…' : '¥0';
    get('game-image-label').textContent = { win: '特别周 · 眼冒星星', lose: '特别周 · 哭泣', broke: '特别周 · 求女儿们给钱', refund: '本金原额退回 · 不计输赢' }[kind];
    const image = get('game-result-image');
    image.hidden = broke || refund || even;
    get('game-image-pending').hidden = !broke && !refund && !even;
    get('game-image-pending').querySelector('small').hidden = refund || even;
    if (even) { modal.dataset.result = 'even'; get('game-result-symbol').textContent = '＝'; get('game-image-label').textContent = '命中 · 收支持平'; }
    if (kind === 'lose') { image.src = 'assets/special-week-cry.png'; image.alt = '特别周哭泣表情候选，来自《うまゆる》相关截图'; }
    if (kind === 'win') { image.src = 'assets/special-week-star-eyes-v1.png'; image.alt = '特别周眼冒金色星星、开心欢呼的原创绘制表情'; }
    get('game-result-caption').textContent = broke ? correctionBankruptcy ? '赛果更正扣款后资金归零 · 其他待结算马券保留' : '所有马券均已结算' : race.name;
    get('game-result-profit').textContent = refund ? money(refunded) : broke ? money(state.cash) : signed(profit);
    get('game-result-summary').textContent = refund ? `已退回可用资金 · 当前 ${money(state.cash)} · 重复查看不会再次入账` : broke ? '当前可用资金' : `本场净收益 · 当前可用 ${money(state.cash)}`;
    get('game-result-details').innerHTML = tickets.map(ticket => {
      const shared = ticket.status === 'won' && ticket.deadHeatCount > 1;
      const formula = `${money(ticket.amount)} × ${ticket.odds} 倍${shared ? ` ÷ ${ticket.deadHeatCount}` : ''}`;
      const note = shared ? `<small class="game-dead-heat-note">同着命中 · ${ticket.deadHeatCount} 匹冠军 · 锁定倍率不变<br>单独获胜时可返还 ${money(ticket.singleWinnerReturn)} → 本次 ${money(ticket.returned)}；分摊后向下取整。</small>` : '';
      return `<div><span>${ticket.horseNumber} 号 ${escape(ticket.horseName)}</span><b>${refund ? ticket.voidReason === 'voluntary' ? '主动申请退款 · 不计输赢' : `无效 · ${ticket.voidReason === 'cancelled' ? '赛事取消' : '马匹退赛'}` : formula}</b><span>${refund ? '退还本金' : '总返还'} ${money(ticket.returned)}</span>${note}</div>`;
    }).join('');
    get('game-result-details').hidden = broke;
    get('game-bankrupt-japanese').hidden = !broke;
    const label = resultStages.length > 1 ? resultStages[1] === 'refund' ? '继续查看退款' : '继续查看资金状态' : resultDestination === 'wallet' ? '返回小店' : resultDestination === 'calendar' ? '知道了，返回日历' : '关闭并查看比赛';
    get('game-result-continue').innerHTML = `${label} <span>›</span>`;
    if (resultStages.length > 1) modal.querySelector('.close-button').setAttribute('aria-label', '继续查看资金状态');
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
        get(id).textContent = '有退款已自动到账；当前金额保留打开时的记录，关闭后接续查看。';
      }
      const label = correctionPreview.hasQueued() ? '继续查看新更正' : '继续查看退款';
      if (correctionPreview.isOpen()) get('correction-continue').innerHTML = `${label} <span>›</span>`;
      else if (modal.open && view === 'result' && resultStages[0] !== 'refund') get('game-result-continue').innerHTML = `${label} <span>›</span>`;
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
    get('game-cash').textContent = money(state.cash);
    renderTicketFolder();
    updateHeader();
    renderCalendar();
    feedback('已载入两场待查看赛果，返还尚未入账。可先切换状态；点击小店后按比赛时间由早到晚展示。');
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
      refresh.textContent = '演示：查询返回退款／更正';
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
        message.textContent = error.message;
        message.hidden = false;
        button.disabled = true;
      }
    }
    if (action === 'stake') { get('game-stake').value = button.dataset.amount; updateQuote(); }
    if (action === 'days') { addBankDays(state, Number(button.dataset.days)); openBank(); feedback(`已演示累计 ${state.bankDays} 天，银行最多保留 ¥1,000,000。`); }
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
    try { const amount = Number(get('game-withdraw').value); withdraw(state, amount); openBank(); feedback(`已转入可用资金 ${money(amount)}。`); } catch (error) { feedback(error.message); }
  });
  get('game-bet-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      placeTicket(state, selectedRace, horses(selectedRace).find(item => item.number === selectedHorse), Number(get('game-stake').value), new Date(), zone());
      openWallet();
      feedback('马券已收好，本次倍率已锁定。');
    } catch (error) { updateQuote(); feedback(error.message); }
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
        get('correction-refund-pending').textContent = '退款已自动到账，将在更正提示结束后展示。';
        get('correction-continue').innerHTML = `${correctionPreview.hasQueued() ? '继续查看新更正' : '继续查看退款'} <span>›</span>`;
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
        badge.className = 'game-alert'; badge.textContent = '!'; badge.setAttribute('aria-label', corrected ? '赛果更正待查看，点击处理差额' : '赛果待查看，点击查看并结算');
        button.append(badge); button.setAttribute('aria-label', `${button.getAttribute('aria-label')}，赛果待查看或结算`);
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
      get('game-race-reason').textContent = allowed ? `未来 30 天内 · 出走确认 · 官方单胜（演示） · 可用 ${money(state.cash)}` : bettingBlockReason(race, new Date(), zone());
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
        else { openWallet(); feedback('该场当前不符合购买条件，请查看未来 30 天的赛事。'); }
      }
      if (['win', 'lose', 'broke', 'dead-heat', 'refund-cancelled', 'refund-withdrawn'].includes(requested)) {
        loadExample(requested);
        if (requested.startsWith('refund-')) requestRefresh();
      }
    }
  };
}

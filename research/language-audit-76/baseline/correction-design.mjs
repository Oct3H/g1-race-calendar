import { createState, placeTicket, settleRace, recordRaceResult, markRead, unreadForRace, addBankDays } from './game-state.mjs?v=43';
import { recordResultCorrection, correctionImpact, hasUnreadCorrection, applyResultCorrection } from './result-correction-preview.mjs?v=56';

export function createCorrectionPreview({ document, races, horses, getState, replaceState, resetSamples, closeGame, closeRace, showRace, openWallet, onBankrupt, changed, money, signed, escape, countryColors, getResultContext = () => null, afterCorrections = () => false }) {
  const cases = [['credit', '补发返还'], ['debit', '扣回返还'], ['shortfall', '不足归零'], ['multiple', '连续三次更正'], ['tie', '改为同着冠军'], ['neutral', '不影响本券金额'], ['live-result', '结算弹窗中收到更正'], ['live', '更正弹窗中再收到更正']];
  const study = document.getElementById('correction-study');
  const modal = document.createElement('dialog');
  modal.id = 'correction-dialog';
  modal.setAttribute('aria-labelledby', 'correction-title');
  modal.innerHTML = `<div class="dialog-ribbon"><span>OFFICIAL RESULT REVISION</span><button class="close-button" type="button" data-correction-close aria-label="关闭更正提示">×</button></div><div class="dialog-body"><p class="correction-kicker">正式赛果更正 · 虚构预览</p><h2 id="correction-title"></h2><p id="correction-race"></p><p id="correction-new-update" class="correction-new-update" role="status" hidden></p><p id="correction-refund-pending" class="notification-pending" role="status" hidden></p><div class="correction-amount"><span>本次可用资金变化</span><strong id="correction-delta"></strong><small id="correction-balance"></small></div><div id="correction-waived" class="correction-waived" hidden></div><p id="correction-rule"></p><div id="correction-rows" class="correction-rows"></div><details class="correction-history"><summary>查看原结算、发布版本与调整记录</summary><div id="correction-history"></div></details><button id="correction-incoming-demo" class="correction-incoming-demo" type="button" data-correction-incoming hidden>演示：查询返回新更正</button><p class="entry-sample-note">只用最新正式赛果计算净差额，购买本金与锁定倍率不变；查看同一版本不会再次调整。</p><button class="primary-button" id="correction-continue" type="button" data-correction-close>关闭并查看赛事</button></div>`;
  document.body.append(modal);
  let active = null;
  const queuedRaces = new Set();
  let deferredBankruptcy = null;
  const get = id => document.getElementById(id);
  const winnerLabel = winners => `${winners.join('、')} 号${winners.length > 1 ? '（同着）' : ''}`;

  function loadExample(key) {
    if (!cases.some(([value]) => value === key)) return;
    active = null; queuedRaces.clear(); deferredBankruptcy = null; modal.close();
    resetSamples();
    closeGame(); closeRace();
    const race = races.find(item => item.id === 'shuka');
    const state = createState();
    const boughtAt = new Date('2026-10-17T03:00:00Z');
    const sample = { ...race, sampleFinished: false, sampleCancelled: false, sampleWithdrawnNumbers: [], sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '购券时官方单胜（虚构）', sampleOddsAt: boughtAt.toISOString() };
    placeTicket(state, sample, { ...horses(race)[0], odds: '4.0' }, 10000, boughtAt, 'Asia/Shanghai');
    const previous = ['credit', 'neutral', 'live'].includes(key) ? 2 : 1;
    if (key === 'live-result') recordRaceResult(state, race.id, previous);
    else { settleRace(state, race.id, previous); markRead(state, race.id); }
    state.sampleIncomingDemo = ['live', 'live-result'].includes(key);
    race.sampleWinnerNumber = previous; race.sampleFinished = true;
    delete race.sampleWinnerNumbers;
    if (key === 'shortfall') {
      const other = races.find(item => item.id === 'tenno');
      placeTicket(state, { ...other, sampleEntriesConfirmed: true, sampleOfficialOdds: true, sampleOddsSource: '其他待赛马券（虚构）' }, horses(other)[1], 520000, new Date('2026-10-22T03:00:00Z'), 'Asia/Shanghai');
      addBankDays(state, 3);
    }
    const updates = key === 'live-result' ? [] : key === 'multiple' ? [[2], [1], [1, 2]] : [key === 'neutral' ? [3] : ['credit', 'live'].includes(key) ? [1] : key === 'tie' ? [1, 2] : [2]];
    for (const [index, winners] of updates.entries()) recordResultCorrection(state, race, { id: `revision-${index + 1}`, at: `2026-10-${19 + index}T04:00:00Z`, winners, source: '官方正式更正公告（虚构）' });
    replaceState(state);
    study.hidden = false;
    get('correction-study-summary').textContent = `${cases.find(([value]) => value === key)[1]} · 已取得更正，尚未查看；可用 ${money(state.cash)}。${key === 'shortfall' ? '另有 ¥520,000 待赛马券，银行 ¥30,000。' : ''}${key === 'neutral' ? '只有黄色提示，不新增资金红叹号。' : '点击秋華賞红色 ! 或小店查看后才调整。'}`;
    if (state.sampleIncomingDemo) get('correction-study-summary').textContent = `${key === 'live-result' ? '已取得正式赛果，尚未结算' : '已取得第一版更正，尚未处理'}。点击秋華賞红 !，再点弹窗内的“演示：查询返回新更正”。当前金额与记录保持不变，关闭后立即展示并处理最新更正；可连续模拟多次返回。`;
    changed();
  }

  function nextQueuedRace() {
    const state = getState();
    return races.filter(race => queuedRaces.has(race.id) && state.resultCorrections?.[race.id]?.appliedId !== state.resultCorrections?.[race.id]?.versions.at(-1)?.id)
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt) || a.id.localeCompare(b.id))[0];
  }

  function receive(race, update) {
    if (!recordResultCorrection(getState(), race, update)) return false;
    const resultContext = getResultContext();
    if (active || resultContext) {
      queuedRaces.add(race.id);
      const notice = get(active ? 'correction-new-update' : 'game-result-new-correction');
      notice.hidden = false;
      notice.textContent = '收到新的正式赛果更正。当前内容保持不变，关闭后立即展示并处理最新差额。';
      get(active ? 'correction-continue' : 'game-result-continue').innerHTML = '继续查看新更正 <span>›</span>';
    }
    changed();
    return true;
  }

  function simulateIncoming() {
    if (!getState().sampleIncomingDemo) return;
    const race = active?.race || getResultContext()?.race;
    if (!race) return;
    const last = getState().resultCorrections?.[race.id]?.versions.at(-1);
    const count = (getState().resultCorrections?.[race.id]?.versions.length || 0) + 1;
    const winners = count % 3 === 1 ? [2] : count % 3 === 2 ? [1, 2] : [1];
    receive(race, { id: `live-revision-${count}`, at: new Date(Date.parse(last?.at || '2026-10-25T04:00:00Z') + 60000).toISOString(), winners, source: '已发起查询返回的正式更正（虚构演示）' });
  }

  function show(race, opener, destination = 'race') {
    const state = getState();
    const impact = correctionImpact(state, race.id);
    if (!impact) return false;
    if (modal.open) return true;
    queuedRaces.delete(race.id);
    const receipt = applyResultCorrection(state, race.id, new Date().toISOString());
    const history = state.resultCorrections[race.id];
    const record = receipt || history.adjustments.at(-1);
    active = { race, opener, destination, bankrupt: Boolean(receipt?.bankrupt) };
    closeGame(); closeRace();
    modal.dataset.colorRegion = countryColors[race.country] || 'other';
    get('correction-title').textContent = record.expectedDelta > 0 ? '更正返还已补发' : record.expectedDelta < 0 ? '更正差额已扣回' : '赛果已更正 · 金额不变';
    get('correction-race').textContent = `${race.name} · 最新冠军 ${winnerLabel(impact.latest.winners)}`;
    get('correction-delta').textContent = signed(record.actualDelta);
    get('correction-balance').textContent = `查看前 ${money(record.beforeCash)} → 查看后 ${money(record.afterCash)}`;
    get('correction-waived').hidden = record.waived === 0;
    get('correction-waived').textContent = `应扣回 ${money(-record.expectedDelta)} · 实扣 ${money(-record.actualDelta)} · 未扣足 ${money(record.waived)} 已免除，不记欠款。之后派彩和银行取款正常可用。`;
    get('correction-rule').textContent = receipt ? active.bankrupt ? '本次更正后资金归零。先核对差额，关闭后显示破产提示；其他待结算马券继续保留。' : '本次差额已在展示此提示时处理。' : '这是已处理记录，再次查看不会补发或扣款。';
    get('correction-rows').innerHTML = record.rows.map(row => `<article><b>#${String(row.id).padStart(4, '0')} · ${row.horseNumber} 号 ${escape(row.horseName)}</b><small>本金 ${money(row.amount)} · 锁定 ${row.odds} 倍</small><span>此前应返还 ${money(row.beforeReturn)} → 更正后 ${money(row.nextReturn)}</span><strong>${signed(row.delta)}</strong></article>`).join('');
    get('correction-history').innerHTML = `<p>原结算：${state.tickets.filter(ticket => ticket.raceId === race.id && ticket.originalSettlement).map(ticket => `#${ticket.id} · 冠军 ${winnerLabel(ticket.originalSettlement.winnerNumbers)} · 返还 ${money(ticket.originalSettlement.returned)}`).join('；')}</p>` + history.versions.map((version, index) => `<p><b>发布版本 ${index + 1} · ${escape(version.id)}</b><span>${escape(version.at)} · 冠军 ${winnerLabel(version.winners)} · ${escape(version.source)}</span></p>`).join('') + history.adjustments.map(item => `<p><b>已查看调整 · ${escape(item.id)}</b><span>${escape(item.at)} · 应调整 ${signed(item.expectedDelta)} · 实际 ${signed(item.actualDelta)} · 免除 ${money(item.waived)}</span></p>`).join('');
    modal.querySelector('.correction-history').open = false;
    get('correction-continue').textContent = active.bankrupt ? '继续查看资金状态' : destination === 'wallet' ? '继续前往小店' : '关闭并查看赛事';
    get('correction-new-update').hidden = true;
    get('correction-refund-pending').hidden = true;
    get('correction-incoming-demo').hidden = state.sampleIncomingDemo !== true;
    get('correction-study-summary').textContent = `最新更正 ${impact.latest.id} 已查看并处理；当前可用 ${money(state.cash)}。重复查看记录不会再次调整。${receipt?.bankrupt ? '本次归零，关闭差额后显示破产提示。' : ''}`;
    modal.showModal();
    changed();
    return true;
  }
  function finish() {
    if (!active) return;
    const current = active; active = null;
    modal.close();
    if (continueQueued(current)) return;
    const bankrupt = current.bankrupt || deferredBankruptcy?.bankrupt;
    deferredBankruptcy = null;
    if (afterCorrections({ ...current, bankrupt, correctionBankruptcy: true })) return;
    if (bankrupt && getState().cash === 0) onBankrupt(current.race, current.opener, current.destination);
    else if (current.destination === 'wallet') openWallet();
    else showRace(current.race, current.opener);
  }
  modal.addEventListener('click', event => {
    if (event.target.closest('[data-correction-incoming]')) simulateIncoming();
    if (event.target.closest('[data-correction-close]')) finish();
  });
  modal.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  study.addEventListener('click', event => {
    const button = event.target.closest('[data-correction-case]');
    if (button) loadExample(button.dataset.correctionCase);
    if (event.target.closest('[data-correction-view]')) show(races.find(item => item.id === 'shuka'), event.target);
  });
  get('correction-study-links').innerHTML = cases.map(([key, label]) => `<button type="button" data-correction-case="${key}">${label}</button>`).join('') + '<button type="button" data-correction-view>查看本场更正／已处理记录 ›</button>';
  get('correction-study-links').innerHTML += '<a class="correction-startup-link" href="startup-preview.html?v=59">启动与窗口预览 ›</a>';

  function continueQueued(context) {
    const race = nextQueuedRace();
    if (!race) return false;
    if (context.bankrupt) deferredBankruptcy = context;
    show(race, context.opener, context.destination);
    return true;
  }
  return {
    reset() { active = null; queuedRaces.clear(); deferredBankruptcy = null; modal.close(); },
    loadExample,
    show,
    receive,
    simulateIncoming,
    hasQueued: () => Boolean(nextQueuedRace()),
    isOpen: () => Boolean(active && modal.open),
    continueQueued,
    hasUnread: raceId => hasUnreadCorrection(getState(), raceId),
    openFirst(opener) {
      const first = races.filter(race => hasUnreadCorrection(getState(), race.id) || unreadForRace(getState(), race.id).length).sort((a, b) => new Date(a.startAt) - new Date(b.startAt) || a.id.localeCompare(b.id))[0];
      return first && hasUnreadCorrection(getState(), first.id) ? show(first, opener, 'wallet') : false;
    },
    ticketHistory(ticket) {
      if (!ticket.originalSettlement) return '';
      return `<div class="correction-ticket-history"><b>原结算返还 ${money(ticket.originalSettlement.returned)}</b>${ticket.correctionHistory.map(item => `<span>${escape(item.id)} · 应返还 ${money(item.beforeReturn)} → ${money(item.nextReturn)} · 差额 ${signed(item.delta)}</span>`).join('')}<small>实扣、补发和免除金额见本场更正记录。</small></div>`;
    }
  };
}

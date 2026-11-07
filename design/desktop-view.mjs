import { devText, native } from './desktop-bridge.mjs';
import { makeSourceLink, updateTime } from './desktop-data.mjs';
import { loadHorseProfile, loadRecentStarts } from './desktop-details.mjs';
import { showDetailMascot, clearDetailMascot } from './detail-mascot.mjs';

const get = id => document.getElementById(id);
let queryTimer;
function stopQueryTimer() {
  if (queryTimer !== undefined) clearInterval(queryTimer);
  queryTimer = undefined;
}
get('race-dialog')?.addEventListener('close', () => {
  stopQueryTimer();
  for (const host of document.querySelectorAll('.detail-mascot')) clearDetailMascot(host);
  if (get('horse-panel')) get('horse-panel').dataset.liveHorse = '';
});

function mascotHost(parent, id) {
  let host = get(id);
  if (!host) { host = document.createElement('aside'); host.id = id; parent.append(host); }
  return host;
}

export function renderRecentStartCards(list, starts, finishTier, open) {
  list.replaceChildren();
  list.dataset.liveHistory = '';
  const text = (tag, className, value) => {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  };
  for (const start of starts) {
    const item = document.createElement('li');
    item.dataset.liveHistoryDate = start.date;
    item.dataset.finish = finishTier(start.rank);
    const position = text('div', 'history-position', '');
    position.append(text('b', '', start.rank || '—'), text('small', '', devText('着', 'PLACE', '着')));
    const main = document.createElement('div');
    main.className = 'history-race-main';
    main.append(text('time', 'history-race-date', start.date));
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'past-race-button';
    button.disabled = !start.url && !start.overseas;
    const grade = start.grade?.normalize('NFKC');
    const gradeLevel = {'G1':'g1','GI':'g1','G2':'g2','GII':'g2','G3':'g3','GIII':'g3'}[grade];
    if (gradeLevel) {
      const logo = document.createElement('img'); logo.className = 'race-grade-logo'; logo.src = 'assets/race-grade-' + gradeLevel + '.webp'; logo.alt = start.grade; button.append(logo);
    } else if (grade) button.append(text('span', 'history-grade-label', start.grade));
    button.append(text('span', 'history-race-title', start.name || devText('赛事名称待取得', 'Race name pending', 'レース名は未取得')));
    if (!button.disabled) button.append(text('span', 'past-race-arrow', '›'));
    button.addEventListener('click', () => open?.(start, button));
    main.append(button);
    const meta = text('div', 'history-race-meta', '');
    const field = (label, value) => { const span = document.createElement('span'); span.append(text('small','',label),document.createTextNode(value || '—')); meta.append(span); };
    field(devText('赛场', 'Venue', '競馬場'), start.course);
    if (start.distance) field('', (start.surface === 'turf' ? '芝 ' : start.surface === 'dirt' ? 'ダート ' : '') + start.distance + 'm');
    field(devText('骑师', 'Jockey', '騎手'), start.jockey);
    main.append(meta);
    const metric = text('div', 'history-race-metric', '');
    const time = start.finishTime?.match(/^(\d+)[.:](\d{2})\.(\d+)$/);
    const finishTime = time ? `${time[1]}:${time[2]}.${time[3]}` : undefined;
    const margin = start.margin && !/^[-—]+$/.test(start.margin) ? start.margin : undefined;
    const label = finishTime ? devText('完赛时间','Finish time','走破タイム') : margin ? devText('着差','Margin','着差') : devText('单胜最终赔率','Final Win','最終単勝');
    metric.append(text('small', '', label), text('b', finishTime ? 'history-race-time' : 'history-race-margin', finishTime || margin || (start.odds ? start.odds + ' ×' : '—')));
    if (start.odds && (finishTime || margin)) metric.append(text('small', 'history-final-odds', devText('单胜 ', 'Win ', '単勝 ') + start.odds + ' ×'));
    item.append(position, main, metric); list.append(item);
  }
  if (!starts.length) list.append(text('li','history-empty',devText('本场之前的战绩尚未取得', 'Earlier starts have not been retrieved', '本レース以前の戦績は未取得です')));
}

function queryStage(stage) {
  const labels = {
    'japan-result': ['日本官方赛果', 'Japanese official results', '日本の公式結果'],
    'japan-index': ['日本年度资料目录', 'Japanese annual archive', '日本の年間アーカイブ'],
    'japan-entries': ['日本官方出马表', 'Japanese declarations', '日本の公式出馬表'],
    'hkjc-overseas': ['港马会海外资料', 'HKJC overseas records', 'HKJC海外情報'],
    'hkjc-program': ['香港当日赛事目录', 'Hong Kong race directory', '香港の開催日程'],
    'hkjc-result': ['香港官方赛果', 'Hong Kong official results', '香港の公式結果'],
    'hkjc-entries': ['香港官方出马表', 'Hong Kong declarations', '香港の出馬表'],
    'nar-program': ['地方赛事资料页', 'NAR race page', '地方競馬のレース情報'],
    'nar-entries': ['地方官方出马表', 'NAR declarations', '地方競馬の出馬表'],
    'nar-result': ['地方官方赛果', 'NAR official results', '地方競馬の公式結果']
  };
  return devText(...(labels[stage] || ['读取本地资料', 'Reading local data', 'ローカルデータを読込中']));
}

export function renderLiveTable(race, view, finishTier, openHorse) {
  const results = view === 'results';
  const rows = get('entry-rows');
  rows.replaceChildren();
  const data = race.realResult;
  const count = data?.runners.length ?? 0;
  document.querySelector('#race-panel .entry-count').textContent = data
    ? devText(`${count} 匹`, `${count} runners`, `${count} 頭`)
    : devText('名单待取得', 'Starters pending', '出走馬は未取得');
  get('draw-explainer').textContent = '';
  get('race-table-caption').textContent = results
    ? devText('正式赛果', 'Official results', '公式結果')
    : devText('实际出走名单', 'Actual starters', '実際の出走馬');
  get('entry-view-description').textContent = !data
    ? race.refreshState === 'checking'
      ? devText('正在读取官方详情…', 'Retrieving official details…', '公式詳細を取得中…')
      : devText('尚未取得本场名单。点击头像查看原因，或重新获取。', 'Starters unavailable. Select the portrait for details or refresh.', '出走馬は未取得です。アイコンで状況を確認するか再取得してください。')
    : results
      ? devText('正式赛果 · 按名次排序。', 'Official results · Ordered by finish.', '公式結果 · 着順順。')
      : data.finished === false
        ? devText('官方已公布名单 · 赔率为当前取得的独赢报价，含本金。', 'Published starters · Retrieved Win odds include stake.', '公開済み出走馬 · 取得した単勝オッズは元本込み。')
        : devText('按马号显示实际出走名单。赔率为最终单胜倍率，含本金。', 'Actual starters in saddlecloth order. Final Win odds include stake.', '馬番順の実際の出走馬。最終単勝オッズは元本込み。');
  if (!data) return;
  const ordered = [...data.runners].sort(results ? (a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999) : (a, b) => a.number - b.number);
  for (const runner of ordered) {
    const row = rows.insertRow();
    const tier = finishTier(runner.rank);
    row.dataset.finish = tier;
    const fields = [
      [runner.rank, 'result-only'], [runner.bracket, 'entry-only draw-cell'], [runner.number, 'horse-number'],
      [runner.name, 'horse-name'], [runner.sexAge, 'entry-only'], [runner.weight, 'entry-only carried-weight'],
      [runner.jockey, 'jockey-name'], [runner.trainer, 'detail-only'], ['—', 'detail-only desktop-history-missing'],
      [runner.odds, 'entry-only odds-column odds-value'], [runner.margin, 'result-only result-margin']
    ];
    for (const [value, className] of fields) {
      const cell = row.insertCell();
      cell.className = className;
      cell.textContent = value || '—';
    }
    const rank = document.createElement('span');
    rank.className = `form-position result-position form-${tier}`;
    rank.textContent = runner.rank;
    row.cells[0].replaceChildren(rank);
    row.cells[3].lang = runner.nameLang || (race.country === 'HK' ? 'zh-Hant' : 'en');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'horse-name-button';
    button.textContent = runner.name + ' ›';
    button.addEventListener('click', () => openHorse?.(runner, button));
    row.cells[3].replaceChildren(button);
  }
}

export function renderLiveSource(race, refresh) {
  stopQueryTimer();
  const details = get('source-label').parentElement;
  details.querySelectorAll('a, .desktop-source-time, .desktop-detail-refresh').forEach(element => element.remove());
  details.dataset.liveSource = '';
  const label = race.realResult?.url?.includes('hkjc.com') ? 'HKJC' : {jra: 'JAIRS · JRA', nar: 'NAR', 'nar-history': 'NAR', ifha: 'IFHA', archive: 'IFHA', hkjc: 'HKJC', 'overseas-history': 'HKJC'}[race.scheduleSource] || 'JAIRS';
  const directory = race.realResult?.url || (race.scheduleSource === 'archive'
      ? 'https://www.ifhaonline.org/resources/WTGradedRanking/LWGRank.asp?batch=10'
      : race.scheduleURL);
  const note = document.createElement('small');
  note.textContent = devText('上次成功获取 ', 'Last retrieved ', '最終取得 ') + updateTime(race.realResult?.fetchedAt);
  const link = makeSourceLink(directory, label);
  note.className = 'desktop-source-time';
  details.append(link, note);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button desktop-detail-refresh';
  button.textContent = devText('重新获取详情 ↻', 'Refresh details ↻', '詳細を再取得 ↻');
  button.disabled = race.refreshState === 'checking';
  button.addEventListener('click', () => refresh?.(race));
  details.append(button);
  const failed = race.refreshState === 'failed' || race.refreshState === 'offline';
  const host = mascotHost(document.querySelector('#race-panel .entry-header'), 'race-load-mascot');
  const initialLoad = race.refreshState === 'checking' && !race.realResult;
  const fresh = race.refreshState === 'success' && !race.lookup?.hadData;
  showDetailMascot(host, race.id, initialLoad ? 'loading' : fresh ? 'complete' : 'idle',
    initialLoad ? undefined : race.refreshState === 'checking'
      ? devText('本地资料已就绪，后台检查中', 'Saved data ready; checking updates', '保存済みデータを表示・更新確認中')
      : failed ? devText('更新未完成，旧资料已保留', 'Update failed; saved data kept', '更新失敗・保存済み情報を表示')
      : race.refreshState === 'unavailable' ? devText('暂未取得本场资料', 'Details not retrieved', '詳細は未取得だよ') : undefined);
  const summary = race.refreshState === 'unavailable'
    ? devText('尚未查询到本场详情', 'Race details not found yet', 'レース詳細は未取得')
    : race.refreshState === 'checking'
    ? devText('正在获取赛事详情', 'Retrieving race details', '詳細を取得中')
    : failed
    ? devText('详情更新失败', 'Details update failed', '詳細の更新に失敗')
    : devText('部分赛事资料待补', 'Some details are missing', '一部データが未取得');
  get('race-quality-summary').textContent = summary;
  get('race-quality-entry').hidden = false;
  get('race-quality-notice').hidden = false;
  get('race-quality-notice').dataset.tone = failed ? 'failed' : 'normal';
  get('race-quality-title').textContent = summary;
  get('race-quality-copy').textContent = failed
    ? devText('本次未能取得赛事详情。已保存的资料仍可查看。', 'Could not retrieve race details. Saved data remains available.', '詳細を取得できませんでした。保存済みの情報は引き続き表示します。')
    : race.refreshState === 'unavailable'
      ? devText('当前来源尚未返回匹配本场的正式名单或赛果。可能尚未公布，也可能不在该来源的历史范围内；可以查看官方来源并稍后重新获取。', 'The source has not returned matching declarations or results. They may be unpublished or outside its historical coverage. Check the official source or refresh later.', 'この出典から一致する出馬表・結果を取得できませんでした。未公開、または出典の保存対象外の可能性があります。公式出典をご確認ください。')
    : race.refreshState === 'unsupported'
      ? devText('此来源的逐马详情尚未接通。已保存的赛程可浏览，来源链接可核对原始资料。', 'Runner details for this source are not connected yet. The source link opens the official record.', 'この出典の出走馬詳細は接続準備中です。出典リンクから公式記録を確認できます。')
      : race.refreshState === 'unpublished'
        ? devText('本场尚未取得正式出马表或赛果，公布后可重新获取。', 'Official declarations or results have not been retrieved yet. Refresh after publication.', '公式の出馬表・結果は未取得です。公開後に再取得できます。')
        : devText('页面显示已取得的官方字段，横线表示该字段尚未取得。点击马名查看已取得的基础资料与血统。', 'Available official fields are shown. A dash marks an unavailable field. Select a horse for its profile and pedigree.', '取得済みの公式項目を表示しています。未取得は「—」です。馬名から基本情報・血統を確認できます。');
  get('race-quality-time').textContent = note.textContent;
  if (race.lookup) {
    if (race.refreshState === 'checking') {
      const paint = () => {
        if (!get('race-dialog').open || get('race-dialog').dataset.panel !== 'race') { stopQueryTimer(); return; }
        const seconds = Math.floor((Date.now() - race.lookup.startedAt) / 1000);
        get('entry-view-description').textContent = queryStage(race.lookup.stage) + devText(` · 查询中，已用 ${seconds} 秒`, ` · Loading, ${seconds}s elapsed`, ` · 取得中、${seconds}秒経過`)
          + (race.realResult ? devText(' · 先显示已保存资料', ' · Showing saved data', ' · 保存済みデータを表示') : '');
      };
      queryTimer = setInterval(paint, 1000);
    } else {
      const seconds = (race.lookup.duration / 1000).toFixed(1);
      get('race-quality-time').textContent += devText(` · 本次查询 ${seconds} 秒`, ` · This query took ${seconds}s`, ` · 今回の取得 ${seconds}秒`);
      if (failed && race.failureKind === 'timeout') get('race-quality-copy').textContent = devText('连接等待超时，本次查询已结束。来源可能响应较慢，已保存资料继续显示，可手动重新获取。', 'The request timed out and has ended. The source may be slow. Saved data remains available, and you can refresh manually.', '接続がタイムアウトしました。出典の応答が遅い可能性があります。保存済み情報を表示しています。手動で再取得できます。');
      if (failed && race.failureKind === 'tls') get('race-quality-copy').textContent = devText('未能与来源建立安全连接，本次查询已结束。已保存资料继续显示，可稍后手动重新获取。', 'A secure connection to the source could not be established. The query has ended. Saved data remains available.', '出典への安全な接続を確立できませんでした。取得は終了しました。保存済み情報を表示しています。');
      if (failed && race.failureKind === 'format') get('race-quality-copy').textContent = devText('来源已返回资料，但表格格式未通过核对，本次无法载入。已保存的资料继续显示。', 'The source returned data, but its table format could not be verified. Saved data remains available.', '出典から応答を受信しましたが、表の形式を確認できませんでした。保存済み情報を表示しています。');
      get('race-quality-copy').style.whiteSpace = 'pre-line';
      get('race-quality-copy').textContent += '\n' + race.lookup.attempts.map(attempt => queryStage(attempt.stage) + ' · ' + (attempt.duration / 1000).toFixed(1) + 's · '
        + (attempt.state === 'success' ? devText('已收到响应', 'Response received', '応答受信') : devText('请求失败', 'Request failed', 'リクエスト失敗'))).join('\n');
      const candidates = race.lookup.misses?.reduce((count, miss) => count + miss.candidates.length, 0);
      if (candidates && race.refreshState === 'unavailable') get('race-quality-copy').textContent += devText(`\n来源返回了 ${candidates} 条赛事记录，未能唯一匹配本场。`, `\nThe source returned ${candidates} race records without a unique match.`, `\n出典から${candidates}件のレース情報を受信しましたが、一致を確認できませんでした。`);
    }
  }
  if (race.country === 'JP' && race.realResult?.runners.some(runner => runner.nameLang !== 'ja')) {
    get('race-quality-copy').textContent += devText(' 日文马名尚未取得，当前显示英文来源名称。', ' Japanese names are unavailable. Names from the English source are shown.', ' 日本語馬名は未取得のため、英語出典の名前を表示しています。');
  }
  get('race-quality-ticket').textContent = '';
  get('race-state-label').textContent = race.sampleFinished
    ? devText('已结束', 'Finished', '終了')
    : race.realResult ? devText('出马表已取得', 'Declarations loaded', '出馬表を取得済み')
    : race.refreshState === 'checking' ? devText('详情查询中', 'Loading details', '詳細取得中') : devText('赛程已公布', 'Schedule published', '日程公開済み');
  if (race.realResult?.purse) {
    get('race-prize').textContent = race.realResult.currency + ' ' + race.realResult.purse;
    if (race.country === 'JP') get('race-prize-label').textContent = devText('赛事总赏金（来源口径）', 'Total purse (source basis)', '賞金総額（出典の表記）');
  }
  if (race.realResult?.winnerPrize) get('race-winner-prize').textContent = race.realResult.currency + ' ' + race.realResult.winnerPrize;
}

export function renderLiveHorse(race, runner, offline, finishTier, openRace) {
  const dialog = get('race-dialog');
  get('race-panel').hidden = true;
  get('history-panel').hidden = true;
  get('horse-panel').hidden = false;
  dialog.dataset.panel = 'horse';
  dialog.setAttribute('aria-labelledby', 'horse-title');
  get('dialog-section-label').textContent = 'HORSE INFORMATION';
  get('horse-title').textContent = runner.name;
  get('horse-title').lang = runner.nameLang || race.nameLang;
  get('horse-subtitle').textContent = '';
  get('horse-race-hint').textContent = devText('点击返回本场赛事', 'Return to this race', '本レースへ戻る');
  get('horse-emblem').textContent = runner.number;
  get('horse-race-name').textContent = race.name;
  get('horse-current-odds-label').textContent = race.sampleFinished
    ? devText('本场单胜最终赔率', 'Final Win odds', '本レースの最終単勝オッズ')
    : devText('本场单胜赔率', 'Win odds', '本レースの単勝オッズ');
  get('horse-current-odds').textContent = runner.odds || '—';
  get('horse-odds-time').textContent = updateTime(race.realResult?.fetchedAt);
  get('horse-form-list').replaceChildren();
  get('back-to-entries').textContent = devText('‹ 返回赛事', '‹ Back to race', '‹ レースに戻る');
  document.querySelector('.horse-back-button').textContent = devText('返回赛事 ›', 'Back to race ›', 'レースに戻る ›');
  const status = document.querySelector('.horse-data-status');
  const identity = race.id + ':' + runner.number;
  get('horse-panel').dataset.liveHorse = identity;
  const mascot = mascotHost(document.querySelector('.horse-hero'), 'horse-load-mascot');
  showDetailMascot(mascot, identity, runner.horseId ? 'loading' : 'idle');
  const paint = (profile = {}) => {
    for (const [id, value] of Object.entries({ 'horse-sex-age': runner.sexAge || profile.sex, 'horse-origin': runner.origin || profile.origin,
      'horse-trainer': runner.trainer, 'horse-sire': runner.sire || profile.sire, 'horse-dam': runner.dam || profile.dam,
      'horse-damsire': runner.damSire || profile.damSire })) get(id).textContent = value || '—';
    status.replaceChildren(document.createTextNode(devText('官方资料 · ', 'Official data · ', '公式データ · ') + updateTime(profile.fetchedAt || race.realResult?.fetchedAt)));
    if (profile.url) status.append(makeSourceLink(profile.url, 'HKJC'));
    const before = race.date || race.startAt?.slice(0, 10);
    const starts = (profile.starts || runner.starts || []).filter(start => start.date < before).slice(0, 5);
    const list = get('horse-form-list');
    renderRecentStartCards(list, starts, finishTier, (start, button) => {
        if (start.overseas) {
          openRace({ id: 'overseas-history-' + start.date + '-' + runner.horseId, name: start.course + ' · ' + start.date,
            date: start.date, country: '', region: 'world', nameLang: 'en', gradeLabel: start.grade, place: start.course,
            course: start.distance + 'm', distance: start.distance, targetHorseName: runner.name,
            scheduleSource: 'overseas-history', scheduleURL: profile.url }, button);
          return;
        }
        const url = new URL(start.url);
        if (url.host === 'www.keiba.go.jp') {
          openRace({ id: 'nar-history-' + start.date + '-' + url.searchParams.get('k_babaCode') + '-' + url.searchParams.get('k_raceNo'),
            date: start.date, name: start.name, country: 'JP', nameLang: 'ja', gradeLabel: start.grade || '—',
            place: start.course || 'NAR', course: start.distance ? start.distance + 'm' : '—', region: 'jp',
            scheduleSource: 'nar-history', scheduleURL: url.href }, button);
        } else {
          url.pathname = '/zh-hk/local/information/archive/localresults';
          const course = url.searchParams.get('Racecourse') || 'ST';
          url.searchParams.delete('Racecourse');
          url.searchParams.set('racecourse', course);
          openRace({ id: 'hkjc-' + start.date + '-' + course + '-' + start.raceNo, date: start.date, name: start.name || start.date + ' R' + start.raceNo,
            country: 'HK', nameLang: 'zh-Hant', gradeLabel: start.grade || '—',
            place: start.course, course: start.distance ? start.distance + 'm' : '—', region: 'world', scheduleSource: 'hkjc', scheduleURL: url.href }, button);
        }
    });
  };
  paint();
  if (runner.horseId) {
    status.textContent = devText('正在读取马匹档案…', 'Retrieving horse profile…', '競走馬情報を取得中…');
    const current = () => get('horse-panel').dataset.liveHorse === identity && get('race-dialog').dataset.panel === 'horse';
    loadHorseProfile(runner.horseId, runner.name, Number((race.date || race.startAt).slice(0, 4)), offline, saved => {
      if (!current()) return;
      paint(saved);
      showDetailMascot(mascot, identity, 'idle', devText('本地资料已就绪', 'Saved data ready', '保存済みデータを表示'));
    }).then(async profile => {
      if (!current()) return;
      paint(profile);
      const before = race.date || race.startAt?.slice(0, 10);
      const history = await loadRecentStarts(profile, runner, before, offline, starts => { if (current()) paint({ ...profile, starts }); },
        () => { if (current()) showDetailMascot(mascot, identity, 'loading', devText('正在补齐近五场资料…', 'Loading recent race details…', '近5走の詳細を取得中…')); });
      if (!current()) return;
      paint({ ...profile, starts: history.starts });
      showDetailMascot(mascot, identity, history.failed || profile.stale ? 'idle' : !profile.fromCache || history.updated ? 'complete' : 'idle',
        history.failed || profile.stale ? devText('部分资料待补，已显示可用记录', 'Some details missing; available data shown', '一部未取得・取得済み情報を表示') : undefined);
    }).catch(() => {
      if (current()) {
        status.textContent = devText('马匹档案更新失败 · 保留本场已取得资料', 'Horse profile update failed · Showing retrieved race data', '競走馬情報の更新失敗 · 取得済みのレース情報を表示');
        showDetailMascot(mascot, identity, 'idle', devText('更新未完成，资料已保留', 'Update failed; data kept', '更新失敗・取得済み情報を表示'));
      }
    });
  }
  dialog.scrollTop = 0;
}

export function configureCollectionStatus(data, collection) {
  const toggle = get('first-collection-toggle');
  const pause = get('first-collection-pause');
  const check = get('first-collection-check');
  const panel = get('first-collection-panel');
  const cacheCheck = get('cache-check-updates');
  const offline = () => data.offline || navigator.onLine === false;
  const active = () => ['dates', 'race', 'horse'].includes(collection.progress.phase);
  const reportError = error => {
    console.error(error);
    get('first-collection-title').textContent = devText('进度保存失败', 'Could not save progress', '進捗を保存できません');
  };
  const checkUpdates = () => collection.check().catch(reportError);
  cacheCheck.addEventListener('click', checkUpdates);
  check.addEventListener('click', checkUpdates);
  toggle.addEventListener('click', () => {
    const details = get('first-collection-progress');
    details.hidden = !details.hidden;
    toggle.setAttribute('aria-expanded', String(!details.hidden));
  });
  pause.addEventListener('click', () => collection.setPaused(!collection.state.paused).catch(reportError));
  toggle.textContent = devText('收集进度 ⌄', 'Collection progress ⌄', '収集状況 ⌄');
  check.textContent = devText('检查更新', 'Check for updates', '更新を確認');
  return () => {
    const { state, progress, dateYears, detailYears } = collection;
    const { dates, directoriesMissing, races, horses, unavailable, failed } = collection.totals();
    const running = active() && !state.paused && !offline();
    const partial = directoriesMissing + unavailable + failed > 0;
    panel.hidden = !data.backgroundCollection;
    panel.dataset.tone = state.paused || offline() ? 'muted' : partial || progress.phase === 'error' ? 'amber' : 'green';
    get('first-collection-title').textContent = state.paused
      ? devText('资料收集已暂停', 'Collection paused', '収集を一時停止中')
      : offline() ? devText('离线 · 已保存的资料可浏览', 'Offline · Saved data is available', 'オフライン · 保存済み資料を表示')
      : progress.phase === 'error' ? devText('本次收集未完成', 'Collection interrupted', '収集が中断されました')
      : running ? devText('正在后台收集资料', 'Collecting data in the background', 'バックグラウンドで収集中')
      : partial ? devText('本轮检查结束 · 部分资料待补', 'Check finished · Some data is missing', '確認終了 · 一部未取得')
      : dates ? devText('本轮检查结束', 'Check finished', '確認終了')
      : devText('等待检查', 'Waiting to check', '確認待ち');
    get('first-collection-symbol').textContent = running ? '↻' : state.paused ? 'Ⅱ' : partial ? '!' : '◇';
    get('first-collection-copy').textContent = running
      ? [progress.year, progress.name].filter(Boolean).join(' · ')
      : devText('已保存的赛程和详情可随时浏览', 'Browse saved schedules and details at any time', '保存済みの日程と詳細はいつでも表示できます');
    const range = years => Math.min(...years) + '–' + Math.max(...years);
    get('first-step-dates-title').textContent = devText('赛程 ', 'Schedules ', '日程 ') + range(dateYears);
    get('first-step-dates-copy').textContent = devText(`已检查 ${dates} 年 · ${directoriesMissing} 个目录未更新`, `${dates} years checked · ${directoriesMissing} directories not updated`, `${dates}年確認済み · ${directoriesMissing}件未更新`);
    get('first-step-history-title').textContent = devText('赛事详情 ', 'Race details ', 'レース詳細 ') + range(detailYears);
    get('first-step-history-copy').textContent = devText(`已处理 ${races} 场 · ${unavailable} 项未取得 · ${failed} 项失败`, `${races} races processed · ${unavailable} unavailable · ${failed} failed`, `${races}レース処理 · ${unavailable}件未取得 · ${failed}件失敗`);
    get('first-step-current-title').textContent = devText('本年马匹资料', 'Current-year horse profiles', '今年の競走馬情報');
    get('first-step-current-copy').textContent = devText(`已处理 ${horses} 份可识别档案`, `${horses} identified profiles processed`, `識別可能な${horses}件の情報を処理`);
    get('first-collection-note').textContent = devText('已清理的年份可单场补查，也可在设置中按年重下。', 'Open a race to restore it, or redownload the year from Settings.', '削除した詳細はレースごとに取得するか、設定から年単位で再取得できます。');
    pause.hidden = !running && !state.paused;
    pause.textContent = state.paused ? devText('继续收集', 'Resume', '再開') : devText('暂停', 'Pause', '一時停止');
    check.hidden = running || state.paused || offline();
    cacheCheck.disabled = active() || state.paused || offline();
  };
}

export function configureLocalCache(data, collection) {
  const host = get('cache-view');
  if (new URLSearchParams(window.location.search).get('page') !== 'cache') return () => {};
  const panel = document.createElement('section');
  panel.className = 'desktop-cache-panel cache-years';
  const heading = document.createElement('h2');
  heading.textContent = devText('按年管理', 'Manage by year', '年別管理');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'calendar-soft-button';
  const list = document.createElement('ul');
  list.className = 'cache-year-list';
  panel.append(heading, status, pause, list);
  host.querySelector('.cache-page-heading').after(panel);
  const offline = () => data.offline || navigator.onLine === false;
  let rows = new Map();
  let busy = false;
  let failure = '';

  function paint() {
    const { state, progress } = collection;
    pause.textContent = state.paused ? devText('继续收集', 'Resume collection', '収集を再開') : devText('暂停收集', 'Pause collection', '収集を一時停止');
    pause.disabled = busy || offline();
    status.textContent = failure || (state.paused
      ? devText('已暂停 · 进度已保存', 'Paused · Progress saved', '一時停止 · 進捗を保存済み')
      : offline() ? devText('离线 · 可管理本地资料', 'Offline · Local data can be managed', 'オフライン · 保存済み資料を管理できます')
      : progress.year ? [progress.year, progress.name || devText('正在检查赛程', 'Checking schedules', '日程を確認中')].join(' · ')
      : devText('清理后仍可浏览赛程。按年重下只处理所选年份的详情。', 'Calendar dates remain after clearing. Redownload targets only the selected year.', '削除後も日程を表示できます。年別再取得は選択年の詳細のみを対象にします。'));
    for (const [year, row] of rows) {
      const requested = state.years[year]?.requested;
      row.clear.disabled = busy || (!row.races && !row.horses && !requested);
      row.restore.disabled = busy || offline() || requested || !data.schedule.state(year).providersExpected.length;
      row.restore.textContent = requested ? devText('已排队／收集中', 'Queued / collecting', '待機中／収集中') : devText('按年重下', 'Redownload year', '年別再取得');
    }
  }
  async function reload() {
    const saved = new Map((await native('cacheYears')).map(row => [row.year, row]));
    const years = [...new Set([...saved.keys(), ...collection.dateYears, ...Object.keys(collection.state.years).map(Number)])].sort((a, b) => b - a);
    rows = new Map(years.map(year => {
      const { races = 0, horses = 0, revision = 0 } = saved.get(year) || {};
      const item = document.createElement('li');
      item.className = 'cache-year-row';
      item.dataset.cacheYear = String(year);
      const number = document.createElement('strong');
      number.textContent = String(year);
      const content = document.createElement('span');
      const cleared = revision && collection.state.years[year]?.revision !== revision;
      content.textContent = devText(`${races} 场赛事详情 · ${horses} 份马匹档案`, `${races} race records · ${horses} horse profiles`, `レース詳細 ${races}件 · 競走馬情報 ${horses}件`)
        + (cleared ? devText(' · 暂停整年自动补查', ' · Automatic year collection suspended', ' · 年別の自動取得を停止中') : '');
      const actions = document.createElement('div');
      actions.className = 'cache-year-actions';
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'cache-year-clear';
      clear.textContent = devText('清理详情', 'Clear details', '詳細を削除');
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'cache-year-restore';
      clear.addEventListener('click', () => {
        if (window.confirm(devText(`清理 ${year} 年赛事详情？日期气泡和马券会保留。`, `Clear ${year} details? Calendar dates and tickets will be kept.`, `${year}年の詳細を削除しますか？ 日付と馬券は保持されます。`))) {
          action(() => collection.clear(year));
        }
      });
      restore.addEventListener('click', () => action(() => collection.redownload(year)));
      actions.append(clear, restore);
      item.append(number, content, actions);
      return [year, { item, clear, restore, races, horses }];
    }));
    list.replaceChildren(...[...rows.values()].map(row => row.item));
    paint();
  }
  const reportError = error => {
    console.error(error);
    failure = devText('本次操作失败，请重试。', 'The operation failed. Try again.', '操作に失敗しました。再試行してください。');
    paint();
  };
  const action = async callback => {
    busy = true;
    failure = '';
    paint();
    try { await callback(); await reload(); }
    catch (error) { reportError(error); }
    finally { busy = false; paint(); }
  };
  pause.addEventListener('click', () => action(() => collection.setPaused(!collection.state.paused)));
  reload().catch(reportError);
  let previousPhase = collection.progress.phase;
  return () => {
    const phase = collection.progress.phase;
    paint();
    if (!busy && phase === 'idle' && previousPhase !== 'idle') reload().catch(reportError);
    previousPhase = phase;
  };
}

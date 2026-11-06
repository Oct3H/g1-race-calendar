import { devText } from './desktop-bridge.mjs';
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
    loadHorseProfile(runner.horseId, runner.name, offline, saved => {
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

export function configureLocalCache(data, refresh) {
  const host = get('cache-view');
  const panel = document.createElement('section');
  panel.className = 'desktop-cache-panel cache-years';
  const heading = document.createElement('h2');
  heading.textContent = devText('2026 年 · 赛事详情', '2026 · Race details', '2026年 · レース詳細');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'cache-year-clear';
  clear.textContent = devText('清理 2026 年详情', 'Clear 2026 details', '2026年の詳細を削除');
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'cache-year-restore';
  restore.textContent = devText('重新下载 2026 年详情', 'Redownload 2026 details', '2026年の詳細を再取得');
  panel.append(heading, status, clear, restore);
  host.querySelector('.cache-page-heading').after(panel);
  const render = () => {
    status.textContent = data.race.realResult
      ? '天皇賞（秋） · ' + updateTime(data.race.realResult.fetchedAt)
      : devText('已保留日期气泡。赛事详情可重新下载。', 'Calendar dates are kept. Race details can be downloaded again.', '日付は保持されます。詳細は再取得できます。');
    clear.disabled = !data.race.realResult;
  };
  const action = async callback => {
    restore.disabled = clear.disabled = true;
    try { await callback(); render(); }
    catch { render(); status.textContent += devText(' · 本次操作失败', ' · The operation failed', ' · 操作に失敗しました'); }
    finally { restore.disabled = false; }
  };
  clear.addEventListener('click', () => {
    if (window.confirm(devText('清理 2026 年赛事详情？日期气泡和马券会保留。', 'Clear 2026 race details? Calendar dates and tickets will be kept.', '2026年の詳細を削除しますか？ 日付と馬券は保持されます。'))) {
      action(data.clear);
    }
  });
  restore.addEventListener('click', () => action(async () => {
    if (!(await refresh())) throw new Error('Refresh failed');
  }));
  render();
  return render;
}

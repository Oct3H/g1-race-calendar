// Fictional review scenarios only; no fetching, source inference or persistence.
import { recordRaceResult } from './game-state.mjs?v=43';

export const qualityCases = [
  { key: 'unpublished', label: '出马表待公布', country: 'JP', empty: true, title: '赛程已公布 · 正式出走名单待公布', copy: '已知日期继续保留。报名不等于确认出走；尚未取得正式名单与官方单胜赔率，暂不可购买。', time: '赛程资料：2026.10.20 12:00 · 名单尚未公布（虚构）', ticket: '暂无本场马券 · 名单确认并取得官方赔率后才可购买。' },
  { key: 'partial-entries', label: '出马表局部缺失', country: 'JP', entriesConfirmed: true, officialOdds: true, missingOdds: [2, 5], missingJockeys: [3, 6], title: '出走已确认 · 部分字段暂缺', copy: '骑师和部分单胜赔率暂缺，已取得的马匹资料继续展示。缺少倍率的马匹暂不能选择，不用其他马的赔率代填。', time: '名单／可用赔率：2026.10.23 12:00（虚构）', ticket: '仅可购买具有可核实倍率的马匹；不影响其他马的选择。' },
  { key: 'cached-failed', label: '失败 · 保留缓存', country: 'AU', entriesConfirmed: true, officialOdds: true, failed: true, title: '本次获取失败 · 继续显示上次成功资料', copy: '此次失败不表示官方尚未公布，也不代表马匹退赛。名单和原赔率继续保留，确认购买时仍锁定当前显示的缓存倍率。', time: '本次检查：2026.10.24 12:00 · 上次成功：2026.10.23 12:00（虚构）', ticket: '缓存官方赔率仍可使用；比赛当日及其他购买资格照常校验。' },
  { key: 'empty-failed', label: '失败 · 没有缓存', country: 'AU', empty: true, failed: true, title: '资料获取失败 · 尚无可用缓存', copy: '赛程气泡保留，但没有已保存的名单或赔率。不编造出走信息，也不把获取失败写成尚未公布。可手动重试或下次进入时再检查。', time: '本次检查：2026.10.24 12:00 · 尚无成功记录（虚构）', ticket: '无法确认出走和官方倍率，暂不可购买；不会扣款。' },
  { key: 'results-pending', label: '赛果待公布', country: 'AU', past: true, entriesConfirmed: true, title: '计划发走时间已过 · 正式赛果待取得', copy: '继续展示已保存出马表。仅凭时间经过不能推定冠军、判定未命中或自动退本金；等待可信官方正式赛果。', time: '出马表已保存 · 尚无正式赛果（虚构）', ticket: '已购 1 张 · 本金已扣除，返还尚未入账；等待正式赛果。' },
  { key: 'official-partial', label: '正式冠军 · 其余待补', country: 'JP', past: true, entriesConfirmed: true, officialResult: true, missingJockeys: [3, 6], title: '正式冠军已确认 · 其他名次与着差待补', copy: '可信官方正式冠军及无同着已确认。冠军以金色显示，其余名次保留“待确认”，不按马号推造排名；缺失字段不阻止点击结算。', time: '正式赛果确认：2026.10.18 16:10（虚构）', ticket: '已购 1 张 · 红色 ! 待查看；点击展示结果时返还，缺字段后续补齐。' },
  { key: 'conflict', label: '关键赛果待核实', country: 'AU', past: true, entriesConfirmed: true, title: '冠军资料存在冲突 · 暂停本场结算', copy: '两个取得的结果对冠军身份不一致，尚不能确认可用于结算的正式结果。保留来源记录和已有马券，不任选一份结果，也不自动退款。', time: '最后检查：2026.10.24 12:00 · 正式冠军仍待核实（虚构）', ticket: '已购 1 张 · 资金保持原状，暂不显示可结算的红色 !。' }
];

export function qualityCaseFor(race) {
  return qualityCases.find(item => item.key === race.sampleQuality);
}

// Relative dates keep this review usable without changing the computer clock.
export function createAvailabilityRaces(now = new Date(), complete = false) {
  const at = days => new Date(now.getTime() + days * 86400000).toISOString();
  const base = { layoutDemo: false, region: 'jp', country: 'JP', nameLang: 'ja', venueTimeZone: 'Asia/Tokyo',
    place: '日本 · 示例赛场', surface: 'turf', course: '芝 2,000m（架空）',
    source: '无（资料更新的虚构演示）', sampleOddsSource: '官方单胜来源（虚构演示）' };
  return [
    { ...base, id: 'availability-entries', name: '出走待ちレース（架空）', startAt: at(7),
      subtitle: '赛程已保存，等待正式出马表与单胜赔率', sampleEntriesConfirmed: complete, sampleOfficialOdds: complete,
      sampleOddsAt: complete ? at(0) : undefined },
    { ...base, id: 'availability-odds', country: 'AU', region: 'world', nameLang: 'en', venueTimeZone: 'Australia/Melbourne',
      place: '澳大利亚 · 示例赛场', name: 'Odds Pending Stakes (Sample)', startAt: at(8),
      subtitle: '出走已确认，等待官方单胜赔率', sampleEntriesConfirmed: true, sampleOfficialOdds: complete,
      sampleOddsAt: complete ? at(0) : undefined },
    { ...base, id: 'availability-updated', name: '更新確認レース（架空）', startAt: at(-2), sampleFinished: true,
      subtitle: '最新可用资料展示示例 · 马匹与赛果均为虚构', sampleEntriesConfirmed: true, sampleOfficialOdds: true,
      sampleOddsAt: complete ? at(0) : at(-3), sampleLatestResultAt: at(0),
      sampleUpdateFailures: complete ? [] : [{ field: 'odds', label: '单胜赔率', reason: '本次请求未能取得赔率；保留上次成功值，不影响已取得的赛果。',
        attemptedAt: at(0), lastSuccessAt: at(-3) }] }
  ];
}

export function initAvailabilityLinks(mode, search, document) {
  if (!['preview', 'complete'].includes(mode)) return;
  const section = document.getElementById('quality-study');
  section.hidden = false;
  section.querySelector('span').textContent = 'DATA AVAILABILITY · DESIGN 62';
  section.querySelector('strong').textContent = '资料照常展示，更新异常交给诗歌剧';
  section.querySelector('small').textContent = '以下为虚构示例。小店保留资料未齐的赛事卡片并列出缺项；失败项在诗歌剧头像内说明，不增加资料分区。恢复成功后头像消失，原表格与间距不变。';
  const links = document.getElementById('quality-study-links');
  links.replaceChildren();
  for (const [label, availability, shop] of [['小店 · 查看待公布卡片', 'preview', true], ['详情 · 赛果已更新，赔率失败', 'preview', false], ['详情 · 全部更新成功', 'complete', false]]) {
    const params = new URLSearchParams(search);
    for (const key of ['quality', 'game', 'race', 'entry', 'horse', 'past', 'view', 'odds', 'quote', 'year', 'month']) params.delete(key);
    params.set('availability', availability);
    params.set('v', '62');
    if (shop) params.set('game', 'wallet');
    else for (const [key, value] of Object.entries({ entry: 'compact', race: 'availability-updated', view: 'results' })) params.set(key, value);
    const link = document.createElement('a');
    link.href = `index.html?${params}`;
    link.textContent = label;
    if (mode === availability && new URLSearchParams(search).get('game') === (shop ? 'wallet' : null)) link.setAttribute('aria-current', 'page');
    links.append(link);
  }
}

export function createQualityRace(key) {
  const quality = qualityCases.find(item => item.key === key);
  if (!quality) return null;
  const japan = quality.country === 'JP';
  return {
    id: 'quality-demo', sampleQuality: key, layoutDemo: true,
    startAt: quality.past ? '2026-10-18T06:40:00Z' : '2026-10-29T06:40:00Z',
    day: quality.past ? 18 : 29, venueTimeZone: japan ? 'Asia/Tokyo' : 'Australia/Melbourne',
    country: quality.country, region: japan ? 'jp' : 'world', nameLang: japan ? 'ja' : 'en',
    name: japan ? '資料確認レース（架空）' : 'Data Check Stakes (Sample)',
    place: japan ? '日本 · 示例赛场' : '澳大利亚 · 示例赛场',
    subtitle: `${quality.label} · 虚构资料状态演示`, surface: 'turf', course: '芝 2,000m（架空）',
    source: '无（本轮全部资料与官方确认状态均为虚构）',
    sampleEntriesConfirmed: quality.entriesConfirmed === true,
    sampleOfficialOdds: quality.officialOdds === true,
    sampleOddsSource: quality.officialOdds ? '官方单胜来源（虚构演示）' : undefined,
    sampleOddsAt: quality.officialOdds ? '2026-10-23T04:00:00Z' : undefined,
    sampleFinished: quality.officialResult === true,
    sampleWinnerNumber: quality.officialResult ? 1 : undefined
  };
}

export function recordQualityResult(state, race) {
  const quality = qualityCaseFor(race);
  if (!quality?.officialResult) return false;
  recordRaceResult(state, race.id, race.sampleWinnerNumber);
  return true;
}

export function initQualityLinks(key, search, document) {
  const section = document.getElementById('quality-study');
  if (!qualityCases.some(item => item.key === key)) return;
  section.hidden = false;
  const links = document.getElementById('quality-study-links');
  for (const item of qualityCases) {
    const params = new URLSearchParams(search);
    for (const name of ['game', 'horse', 'past', 'view', 'odds', 'expression']) params.delete(name);
    for (const [name, value] of Object.entries({ quality: item.key, entry: 'compact', race: 'quality-demo', year: '2026', month: '10', v: '54' })) params.set(name, value);
    const link = document.createElement('a');
    link.href = `index.html?${params}`;
    link.textContent = item.label;
    if (item.key === key) link.setAttribute('aria-current', 'page');
    links.append(link);
  }
}

export function initQualityDialog(document) {
  const avatar = document.getElementById('quality-avatar-button');
  const entry = document.getElementById('race-quality-entry');
  const raceDialog = document.getElementById('race-dialog');
  const modal = document.getElementById('race-quality-dialog');
  avatar.addEventListener('click', () => {
    if (entry.hidden || !raceDialog.open || raceDialog.dataset.panel !== 'race' || modal.open) return;
    modal.dataset.colorRegion = raceDialog.dataset.colorRegion;
    modal.showModal();
  });
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) modal.close();
  });
  modal.addEventListener('close', () => {
    if (raceDialog.open && raceDialog.dataset.panel === 'race' && !entry.hidden) avatar.focus({ preventScroll: true });
  });
  raceDialog.addEventListener('close', () => {
    if (modal.open) modal.close();
  });
}

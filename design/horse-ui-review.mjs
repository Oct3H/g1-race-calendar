import { devText } from './desktop-bridge.mjs';
import { renderLiveHorse } from './desktop-view.mjs';
import { showDetailMascot } from './detail-mascot.mjs';

if (new URL(location.href).searchParams.get('horseReview') === 'preview') {
  const {race, runner} = await (await fetch('data/horse-ui-review.json')).json();
  const dialog = document.getElementById('race-dialog');
  dialog.dataset.liveRace = '';
  dialog.dataset.colorRegion = 'jp';
  const open = () => {
    renderLiveHorse(race, runner, true, rank => rank===1 ? 'win' : rank<=5 ? 'placed' : 'other', () => {});
    dialog.showModal();
    document.getElementById('horse-load-mascot').dataset.reviewMascot = '';
  };
  open();
  const controls = document.createElement('div');
  controls.className = 'horse-ui-review-controls';
  const note = document.createElement('small');
  note.textContent = devText('界面预览 · 已保存的官方战绩样本', 'UI review · Saved official records', 'UIプレビュー · 保存済み公式戦績');
  controls.append(note);
  for (const [state, label] of [['loading', devText('奔跑加载', 'Loading', '読み込み')], ['complete',devText('完成跳跃','Complete','完了')], ['idle',devText('本地就绪','Cached','保存済み')]]) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => showDetailMascot(document.getElementById('horse-load-mascot'), 'review-'+Date.now(), state));
    controls.append(button);
  }
  document.getElementById('horse-panel').prepend(controls);
  document.querySelector('.horse-back-button').style.display = 'none';
  document.getElementById('back-to-entries').style.display = 'none';
  const reopen = document.createElement('button');
  reopen.className = 'secondary-button'; reopen.textContent = devText('打开马匹界面预览','Open horse preview','競走馬プレビューを開く');
  reopen.addEventListener('click', open);
  document.querySelector('.app-header').append(reopen);
}

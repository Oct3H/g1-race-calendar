import { devText } from './desktop-bridge.mjs';

const states = new WeakMap();
export function showDetailMascot(host, identity, state, message) {
  if (!host) return;
  const previous = states.get(host);
  if (state === 'complete' && previous?.identity === identity && previous.completed && previous.state !== 'complete') state = 'idle';
  const caption = message || (state === 'loading'
    ? devText('正在加载中…', 'Loading…', '読み込み中…')
    : state === 'complete' ? devText('加载完成！', 'All loaded!', '読み込み完了！')
    : devText('资料已就绪', 'Data is ready', 'データは準備できたよ'));
  if (previous?.identity === identity && previous.state === state) {
    host.querySelector('.tachyon-speech').textContent = caption;
    return;
  }
  if (previous?.timer) clearTimeout(previous.timer);
  host.classList.add('detail-mascot');
  host.dataset.state = state;
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  const sprite = document.createElement('span');
  sprite.className = 'tachyon-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  const speech = document.createElement('span');
  speech.className = 'tachyon-speech';
  speech.textContent = caption;
  host.replaceChildren(speech, sprite);
  const current = {identity, state, completed: state === 'complete' || (state !== 'loading' && previous?.identity === identity && previous.completed)};
  if (state === 'complete') current.timer = setTimeout(() => showDetailMascot(host, identity, 'idle'), 3200);
  states.set(host, current);
}

export function clearDetailMascot(host) {
  const previous = states.get(host);
  if (previous?.timer) clearTimeout(previous.timer);
  states.delete(host);
}

(() => {
  const calendarPath = '/desktop-calendar-preview.html';
  const desktop = Boolean(window.webkit?.messageHandlers.calendar);
  const previewPage = location.pathname === calendarPath;
  const onCalendarPage = previewPage || (desktop && location.pathname.endsWith('/index.html'));
  const previewSettings = new URLSearchParams(location.search).get('desktopLayout') === 'preview';
  if ((!onCalendarPage && !previewSettings) || document.documentElement.dataset.workspaceScript) return;
  document.documentElement.dataset.workspaceScript = 'loaded';
  if (previewPage) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ preview: 'calendar', settingsMenu: 'preview', lang: 'zh', year: '2026', month: '10' })) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    history.replaceState(null, '', url);
  }

  // Keep Settings and Cache round trips inside the review without changing their original links.
  document.addEventListener('click', event => {
    if (desktop) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const destination = new URL(link.href);
    if (destination.origin !== location.origin) return;
    if (destination.pathname === '/index.html' && destination.searchParams.get('preview') === 'calendar') {
      destination.pathname = calendarPath;
    } else if (destination.pathname === '/settings.html' && destination.searchParams.get('from') === 'calendar') {
      destination.searchParams.set('desktopLayout', 'preview');
    } else {
      return;
    }
    link.href = destination.href;
  }, true);

  if (!onCalendarPage) return;

  document.addEventListener(desktop ? 'desktop-calendar-ready' : 'DOMContentLoaded', () => {
    const get = id => document.getElementById(id);
    const find = selector => document.querySelector(selector);
    const language = document.documentElement.lang;
    const [preview, detailsLabel, refreshLabel, refreshingLabel, scrollLabel] = {
      en: ['Layout preview', 'Update & legend', 'Update month', 'Updating…', 'Scrollable month calendar'],
      ja: ['レイアウトプレビュー', '更新状況と凡例', '今月を更新', '更新中…', 'スクロールできる月間カレンダー']
    }[language] || ['布局预览', '状态与图例', '更新本月', '更新中…', '可滚动的月历'];

    const header = find('.app-header');
    const actions = find('.header-actions');
    const navigation = find('.month-control');
    const filters = find('.calendar-filter-controls');
    const refresh = get('calendar-refresh');
    const status = get('calendar-update');
    const shop = get('game-dialog');
    const shopBody = shop.querySelector('.game-body');
    shop.addEventListener('focusin', event => {
      if (event.target.id === 'game-title') shopBody.scrollTop = 0;
    });
    header.insertBefore(navigation, actions);
    header.insertBefore(filters, actions);
    actions.prepend(refresh);

    const shell = find('.calendar-shell');
    const scroll = document.createElement('div');
    scroll.className = 'workspace-calendar-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', scrollLabel);
    scroll.append(find('.weekday-row'), get('calendar-empty'), get('calendar'));
    shell.append(scroll);
    find('.calendar-toolbar').hidden = true;

    const footer = document.createElement('footer');
    footer.className = 'workspace-status';
    const badge = document.createElement('span');
    badge.className = 'workspace-preview-badge';
    badge.textContent = desktop ? 'Dev v2.4' : preview;
    const details = document.createElement('details');
    details.className = 'workspace-status-details';
    const summary = document.createElement('summary');
    summary.textContent = detailsLabel;
    const panel = document.createElement('div');
    panel.className = 'workspace-status-panel';
    const zone = get('calendar-zone-label');
    zone.classList.add('workspace-zone');
    panel.append(find('.calendar-footer'), zone);
    if (desktop) {
      panel.append(get('desktop-schedule-sources'));
    } else {
      panel.append(get('calendar-state-study'), get('calendar-change-study'), get('calendar-update-rule-study'), get('game-settlement-study'));
    }
    details.append(summary, panel);
    footer.append(find('.calendar-hint'), status, badge, details);
    get('calendar-view').append(footer);

    const syncRefreshLabel = () => {
      const label = status.dataset.state === 'checking' ? refreshingLabel : refreshLabel;
      refresh.textContent = '↻ ' + label;
      refresh.title = label + ' (⌘R)';
    };
    new MutationObserver(syncRefreshLabel).observe(status, { attributes: true, attributeFilter: ['data-state'] });
    syncRefreshLabel();
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && details.open && !find('dialog[open]')) {
        details.open = false;
        summary.focus();
      }
      if (event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'r' && !get('calendar-view').hidden && !find('dialog[open]')) {
        event.preventDefault();
        refresh.click();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!details.contains(event.target)) details.open = false;
    });
    panel.addEventListener('click', event => {
      if (event.target.closest('.calendar-change-study button')) details.open = false;
    });
    document.body.dataset.calendarWorkspacePreview = '';
  });
})();

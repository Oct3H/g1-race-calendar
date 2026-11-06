// Shared URL context for the opt-in design flow; no persistence or app routing.
export function unifiedPreview(href) {
  return new URL(href).searchParams.get('flow') === 'preview';
}

export function previewLinks(href) {
  const current = new URL(href);
  const flow = unifiedPreview(href);
  const language = ['zh', 'ja', 'en'].includes(current.searchParams.get('lang')) ? current.searchParams.get('lang') : 'zh';
  const common = new URLSearchParams({ settingsMenu: 'preview', lang: language, v: '74' });
  for (const key of ['year', 'month', 'collection', 'collectionState', 'collectionPausedFrom']) {
    const value = current.searchParams.get(key);
    if (value) common.set(key, value);
  }
  if (flow) {
    common.set('flow', 'preview');
    common.set('collection', 'preview');
    if (!common.has('collectionState')) common.set('collectionState', 'details');
  }
  const calendar = new URL('index.html', current);
  calendar.search = common; calendar.searchParams.set('preview', 'calendar');
  const settings = new URL('settings.html', current);
  settings.search = common; settings.searchParams.set('from', 'calendar');
  const languagePage = new URL(settings); languagePage.searchParams.set('section', 'language');
  const sources = new URL(settings); sources.searchParams.set('section', 'sources');
  const cache = new URL(calendar); cache.searchParams.set('page', 'cache'); cache.searchParams.set('from', 'calendar');
  const welcome = new URL('welcome.html', current);
  welcome.search = common;
  if (flow) { welcome.searchParams.set('collectionState', 'details'); welcome.searchParams.delete('collectionPausedFrom'); }
  return { calendar: calendar.href, language: languagePage.href, sources: sources.href, cache: cache.href, welcome: welcome.href };
}

export function welcomeDestination(href, language) {
  const url = new URL(href);
  if (!['zh', 'ja', 'en'].includes(language)) throw new Error('Choose a supported interface language');
  if (!unifiedPreview(href)) return `settings.html?v=28&lang=${language}&section=language`;
  url.searchParams.set('lang', language);
  // The navigation review has sample dates already. Starting in the static
  // no-data scene would hide every card forever, since previews do not download.
  if (!url.searchParams.has('collectionState')) url.searchParams.set('collectionState', 'details');
  return previewLinks(url.href).calendar;
}

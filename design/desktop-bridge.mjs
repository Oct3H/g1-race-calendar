const channel = typeof window !== 'undefined' && window.webkit?.messageHandlers.calendar;
export const desktop = Boolean(channel);
export const native = (command, value = null) => channel.postMessage({ command, value });

export function devText(zh, en, ja) {
  const language = new URL(window.location.href).searchParams.get('lang');
  return language === 'en' ? en : language === 'ja' ? ja : zh;
}

export function saveDesktopLanguage(language) {
  return native('language', language).catch(error => {
    window.alert(devText('无法保存语言设置', 'Could not save the language', '言語設定を保存できません') + '\n' + error.message);
    throw error;
  });
}

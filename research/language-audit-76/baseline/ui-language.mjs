import { uiMessages } from './ui-messages.mjs?v=76';

export function interfaceLanguage(search = globalThis.window?.location?.search || globalThis.location?.search || '') {
  const value = new URLSearchParams(search).get('lang');
  return ['zh', 'ja', 'en'].includes(value) ? value : 'zh';
}
const missing = new Set();
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.keys(uiMessages).filter(key => /\{\d+\}/.test(key)).sort((a,b) => b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(key => {
  const slots = [...key.matchAll(/\{(\d+)\}/g)].map(match => match[1]);
  const parts = key.split(/\{\d+\}/g).map(escapePattern);
  return { key, slots, pattern: new RegExp('^'+parts.join('([\\s\\S]*?)')+'$') };
});
function render(message, values, language, attr, depth = 0) {
  if (typeof message !== 'string') return message;
  if (language === 'zh') return values ? message.replace(/\{(\d+)\}/g, (_, key) => String(values[key])) : message;
  const lead = message.match(/^\s*/)[0], trail = message.match(/\s*$/)[0];
  let key = message.trim(), slots = values;
  if (!uiMessages[key] && !values && /[\u3040-\u30ff\u4e00-\u9fff]/.test(key) && !/<[a-z][\s>]/i.test(key)) {
    for (const candidate of patterns) {
      const matched = key.match(candidate.pattern);
      if (!matched) continue;
      key = candidate.key; slots = Object.fromEntries(candidate.slots.map((slot,index) => [slot,matched[index+1]])); break;
    }
  }
  const pair = uiMessages[key];
  if (!pair) {
    if (depth === 0 && /[\u4e00-\u9fff]/.test(key) && !/<[a-z][\s>]/i.test(key)) missing.add(key);
    return message;
  }
  const translated = pair[language === 'en' ? 0 : 1];
  const escapeLiteral = value => attr ? value.replace(/[&"<>]/g, char => ({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[char])) : value;
  const parts = translated.split(/(\{\d+\})/g).map(part => {
    const slot = part.match(/^\{(\d+)\}$/);
    if (!slot) return escapeLiteral(part);
    const value = slots?.[slot[1]];
    if (typeof value === 'string' && depth < 6 && value !== message) return String(render(value,null,language,false,depth+1));
    return String(value);
  });
  return lead + parts.join('') + trail;
}
export function translateUi(message, values = null, language = interfaceLanguage()) { return render(message,values,language,false); }
export function uiText(message, values = null) { return render(message,values,interfaceLanguage(),false); }
export function uiAttr(message, values = null) { return render(message,values,interfaceLanguage(),true); }
export function missingUiMessages() { return [...missing]; }
export function clearMissingUiMessages() { missing.clear(); }

// Only source-marked UI nodes; names, badges and artwork have no localization markers.
export function applyStaticUi(doc, language = interfaceLanguage()) {
  doc.documentElement.lang = {zh:'zh-CN',ja:'ja',en:'en'}[language];
  for (const element of doc.querySelectorAll('[data-ui-text]')) {
    const nodes = [...element.childNodes].filter(node => node.nodeType === 3);
    for (const [index,message] of Object.entries(JSON.parse(element.getAttribute('data-ui-text')))) {
      if (!nodes[index]) throw new Error(`Missing marked UI text node: ${element.id || element.tagName}/${index}`);
      nodes[index].textContent = render(message,null,language,false);
    }
  }
  for (const element of doc.querySelectorAll('[data-ui-attrs]')) {
    for (const [attribute,message] of Object.entries(JSON.parse(element.getAttribute('data-ui-attrs')))) element.setAttribute(attribute,render(message,null,language,false));
  }
}
if (typeof document !== 'undefined' && document.documentElement) applyStaticUi(document);

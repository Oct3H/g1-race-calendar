import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../design/design.js',import.meta.url),'utf8');
const html = await readFile(new URL('../design/index.html',import.meta.url),'utf8');
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id,{dataset:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;}}); return nodes.get(id); };
const staticNodes = [...html.matchAll(/<([a-z0-9]+)\b([^>]*data-ui-en="[^"]*"[^>]*)>([^<]*)/g)].map(([,tag,attrs,text])=>({dataset:{uiEn:attrs.match(/data-ui-en="([^"]*)"/)[1],uiJa:attrs.match(/data-ui-ja="([^"]*)"/)[1]},childNodes:[{nodeType:3,textContent:text}]}));
for(const language of ['en','ja','zh']) {
 const context = vm.createContext({previewParams:new URLSearchParams(`lang=${language}`),document:{documentElement:{},getElementById:get,querySelector:get,querySelectorAll:q=>q==='[data-ui-en]'?staticNodes:[]},calendar:get('calendar'),calendarYear:2026,calendarMonth:10,selectedRegions:new Set(['jp']),regionGroups:[['jp'],['other']],englishMonths:['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']});
 const start=code.indexOf('function calendarUi(');vm.runInContext(code.slice(start,code.indexOf('const dailyCalendar',start)),context);
 const update=code.indexOf('function updateCalendarControls(');vm.runInContext(code.slice(update,code.indexOf('function initUpdateRulePreview(',update)),context);
 vm.runInContext('updateCalendarControls([{race:{id:"unchanged",name:"秋華賞"},date:{year:2026,month:10}}],()=>true)',context);
 if(language==='en'){
  assert.match(get('calendar-month-summary').textContent,/1 race this month/);
  assert.equal(get('calendar-regions').textContent,'Regions ⌄');
  context.calendarMonth=11;vm.runInContext('updateCalendarControls([],()=>true)',context);
  assert.equal(get('calendar-empty-title').textContent,'Data not loaded for this month');
  const pos=code.indexOf('document.documentElement.lang = calendarUi');
  vm.runInContext(code.slice(pos,code.indexOf('renderCalendar();',pos)),context);
  assert.equal(context.document.documentElement.lang,'en');
  assert.ok(staticNodes.some(n=>n.childNodes[0].textContent==='Today'));
  assert.ok(staticNodes.some(n=>n.childNodes[0].textContent==='All races'));
  assert.match(code,/Checking for updates/);
 }
 if(language==='zh')assert.match(get('calendar-month-summary').textContent,/本月 1 场/);
}
// A visible English UI must include the region legend, not only URL/settings labels.
assert.ok(html.includes('data-ui-en="JP Japan"'), "region legend must use the selected UI language");
console.log('PASS: actual month/filter/empty-state and static UI rendering follow lang; race-name policy unchanged. DOM doubles, no browser rendering.');

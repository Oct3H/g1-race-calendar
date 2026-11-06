// Offline DOM execution only. No browser, rendering, network or real clock waiting.
import { parseHTML } from './vendor/linkedom-worker.mjs';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const design = new URL('../../design/', import.meta.url);
export async function loadPage(file, query, sourceDirectory = design) {
  const root = new URL(sourceDirectory, import.meta.url);
  const location = new URL(`http://preview.invalid/${file}?${query}`);
  const html = await readFile(new URL(file,root),'utf8');
  let nextTimer=1; const timers=new Map(), errors=[];
  const history={replaceState(_s,_t,url){location.href=new URL(url,location).href;}};
  class Clock extends Date { constructor(...args){super(...(args.length?args:['2026-10-20T04:00:00Z']));}static now(){return Date.parse('2026-10-20T04:00:00Z');} }
  const globals={location,history,Date:Clock,Intl,URL,URLSearchParams,console,structuredClone,
    setTimeout(fn,delay){const id=nextTimer++;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
    scrollY:0,scrollTo(){},navigator:{onLine:true},
    fetch:async url=>{if(String(url)==='data/races-2025.json')return {ok:true,json:async()=>JSON.parse(await readFile(new URL(url,root),'utf8'))};throw new Error('Unexpected network request: '+url);}};
  const window=parseHTML(html,globals),document=window.document;
  window.HTMLElement.prototype.focus=function(){document.__focus=this;};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,right:100,top:0,bottom:100};};
  window.HTMLElement.prototype.reportValidity=function(){return !this.required || this.value!=='';};
  window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
  window.HTMLElement.prototype.close=function(){if(!this.open)return;this.open=false;this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(v));}});
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(value){this.toggleAttribute('checked',Boolean(value));}});
  const sandbox={...globals,window,document,MutationObserver:window.MutationObserver,navigator:globals.navigator,Event:window.Event,Node:window.Node,performance};
  const context=vm.createContext(sandbox);const modules=new Map();
  function module(url){
    if(modules.has(url.href))return modules.get(url.href);
    assert.equal(new URL('.',url).pathname.startsWith(root.pathname),true);
    let source=readFileSync(url,'utf8');
    if(url.pathname.endsWith('/design.js')){
      const calendarEnd='\ncheckCalendarClock();\n\n}';
      assert.ok(source.includes(calendarEnd));
      source='export let qa;\n'+source.replace(calendarEnd, '\ncheckCalendarClock();\nreturn {races, sampleHorseNames, samplePastRaces, samplePastRaceDetails, importanceSamples, showRace, showHorse, showPastRace, renderCalendar};\n}').replace('  startCalendar(null);','  qa = startCalendar(null);');
    }
    const m=new vm.SourceTextModule(source,{context,identifier:url.href});modules.set(url.href,m);
    return m;
  }
  const loaded=[];
  for(const script of document.querySelectorAll('script[type="module"][src]')){
    const url=new URL(script.getAttribute('src'),root);const m=module(url);
    if(m.status==='unlinked')await m.link((spec,parent)=>{if(!spec.startsWith('./'))throw new Error('Unexpected module import '+spec);return module(new URL(spec,parent.identifier));});
    if(m.status!=='evaluated')await m.evaluate();loaded.push(m);
  }
  const ui=[...modules.values()].find(m=>m.identifier.includes('/ui-language.mjs'))?.namespace;
  const qa=[...modules.values()].find(m=>m.identifier.includes('/design.js'))?.namespace.qa;
  async function flush(){for(let i=0;i<8;i++){const pending=[...timers].filter(([,x])=>x.delay<1000);if(!pending.length)break;for(const[id,timer]of pending){timers.delete(id);timer.fn();}await Promise.resolve();}await new Promise(resolve=>setImmediate(resolve));}
  function click(selector){const node=typeof selector==='string'?document.querySelector(selector):selector;assert.ok(node,'Missing clickable '+selector);node.dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));const form=node.closest('form[method="dialog"]');if(form)form.closest('dialog').close();return node;}
  function change(selector,value){const node=document.querySelector(selector);assert.ok(node);node.value=value;node.dispatchEvent(new window.Event('change',{bubbles:true}));return node;}
  return {document,window,location,ui,qa,modules,click,change,flush,timers,errors};
}
if(process.argv[1]?.endsWith('dom-runner.mjs')){
 const page=await loadPage('index.html','preview=calendar&settingsMenu=preview&lang=en&year=2026&month=10');await page.flush();
 console.log('DOM initialized:',page.document.title,'cards:',page.document.querySelectorAll('.race-card').length);
 console.log('Missing:',page.ui.missingUiMessages());
}

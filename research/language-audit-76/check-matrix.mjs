import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { uiMessages } from '../../design/ui-messages.mjs';
import { loadPage } from './dom-runner.mjs';
const results=[],issues=[];
const locales=['zh','ja','en'];
const fixed=['芝','ダート','架空','虛構','ギャンブルはやめよう。','中文','日本語'];
function scan(page,label,language){
  const {document,qa}=page;
  const names=page.ui?.registeredUiNames() || (qa?[...qa.races.map(r=>r.name),...Object.values(qa.sampleHorseNames).flat(),...Object.values(qa.samplePastRaces).flat(),...qa.importanceSamples.map(r=>r.name)]:[]);
  const clean=value=>{let s=value;for(const x of [...names,...fixed].sort((a,b)=>b.length-a.length))s=s.split(x).join('');return s;};
  for(const value of page.ui?.missingUiMessages()||[])if(/[\u4e00-\u9fff]/.test(clean(value)))issues.push({language,label,kind:'missing-message',text:value});
  page.ui?.clearMissingUiMessages();
  for(const element of document.querySelectorAll('*')){
    if(element.closest('script,style'))continue;
    for(const node of element.childNodes)if(node.nodeType===3){
      const text=node.textContent.trim();
      if(/undefined|\[object Object\]|\{\d+\}/.test(text))issues.push({language,label,kind:'broken-value',text});
      if(language==='ja'&&uiMessages[text]&&uiMessages[text][1].replace(/[^\p{L}\p{N}]/gu,'')!==text.replace(/[^\p{L}\p{N}]/gu,'')&&clean(text)===text)issues.push({language,label,kind:'untranslated-ja',text});
    }
  }
  if(language==='en')for(const element of document.querySelectorAll('*')){
    if(element.closest('script,style,.race-name,.horse-name-cell,#race-title,#horse-title,#history-title,#history-horse-name,#horse-race-name,.header-caption,.language-code,.surface-badge,#race-course,#history-course'))continue;
    for(const node of element.childNodes)if(node.nodeType===3&&/[\u4e00-\u9fff]/.test(clean(node.textContent)))issues.push({language,label,kind:'text',node:element.id||element.className||element.tagName,text:node.textContent.trim()});
    for(const key of ['aria-label','title','placeholder','alt']){
      const value=element.getAttribute(key);if(value&&/[\u4e00-\u9fff]/.test(clean(value)))issues.push({language,label,kind:key,node:element.id||element.className||element.tagName,text:value});
    }
  }
  results.push({language,label});
}
for(const language of locales){
 const query=`preview=calendar&settingsMenu=preview&year=2026&month=10&lang=${language}`;
 try{
 const p=await loadPage('index.html',query);await p.flush();scan(p,'calendar-start',language);
 p.click('#calendar-regions');scan(p,'region-dialog',language);
 assert.match(p.document.getElementById('calendar-region-count').textContent,/9/);
 p.click('#calendar-regions-none');p.click('#calendar-regions-apply');scan(p,'empty-filter',language);
 p.click('#calendar-empty-action');p.click('#calendar-jump');scan(p,'month-dialog',language);
 p.click('[data-calendar-month="2"]');scan(p,'unloaded-month',language);p.click('#calendar-today');
 const originalNames=p.qa.races.map(r=>r.name);
 for(const race of p.qa.races){p.qa.showRace(race,null);assert.equal(p.document.getElementById('race-title').textContent,race.name);scan(p,'race-'+race.id,language);
  const horse=p.document.querySelector('.horse-name-button');if(horse){p.click(horse);scan(p,'horse-'+race.id,language);p.click('.past-race-button');scan(p,'history-'+race.id,language);}
  p.document.getElementById('race-dialog').close();
 }
 assert.deepEqual(p.qa.races.map(r=>r.name),originalNames);
 }catch(e){issues.push({language,label:'calendar',kind:'execution',text:e.stack});}
 try{
 const p=await loadPage('index.html',query+'&page=cache');await p.flush();scan(p,'cache-start',language);
 p.click('#cache-demo-offline');scan(p,'cache-offline',language);p.click('#cache-demo-offline');
 p.click('[data-cache-year="2024"] .cache-year-clear');scan(p,'cache-clear-confirm',language);p.click('#cache-clear-confirm');scan(p,'cache-cleared',language);
 p.click('#cache-query-one');scan(p,'cache-single-race',language);p.click('[data-cache-year="2024"] .cache-year-restore');scan(p,'cache-redownload',language);
 p.click('#cache-collection-action');scan(p,'cache-paused',language);p.click('#cache-collection-action');p.click('#cache-demo-complete');scan(p,'cache-complete',language);
 }catch(e){issues.push({language,label:'cache',kind:'execution',text:e.stack});}
 for(const state of ['finding','details','failed','offline','offline-empty','complete'])try{
 const p=await loadPage('index.html',query+`&flow=preview&collection=preview&collectionState=${state}`);await p.flush();scan(p,'collection-'+state,language);
 if(['finding','details'].includes(state)){p.click('#first-collection-pause');scan(p,'collection-paused-'+state,language);p.click('#first-collection-pause');}
 if(['failed','offline','offline-empty'].includes(state)){p.click('#first-collection-check');scan(p,'collection-check-'+state,language);}
 }catch(e){issues.push({language,label:'collection-'+state,kind:'execution',text:e.stack});}
 for(const quality of ['unpublished','partial-entries','cached-failed','empty-failed','results-pending','official-partial','conflict'])try{
 const p=await loadPage('index.html',query+`&quality=${quality}&entry=compact&race=quality-demo`);await p.flush();p.click('#quality-avatar-button');scan(p,'quality-'+quality,language);
 }catch(e){issues.push({language,label:'quality-'+quality,kind:'execution',text:e.stack});}
 try{
 const p=await loadPage('index.html',query+'&refund=preview&game=wallet');await p.flush();scan(p,'shop',language);
 assert.equal(p.document.getElementById('game-cash').textContent,'¥500,000');p.click('[data-game-action="bank"]');scan(p,'bank',language);p.click('[data-game-action="days"][data-days="7"]');p.document.getElementById('game-withdraw').value='10000';p.document.getElementById('game-withdraw-form').dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(p.document.getElementById('game-bank-balance').textContent,'¥60,000');scan(p,'bank-withdraw',language);
 p.click('#game-dialog [data-game-action="wallet"]');assert.equal(p.document.getElementById('game-cash').textContent,'¥510,000');
 const bet=p.document.querySelector('#game-upcoming [data-game-action="bet"]');if(bet){p.click(bet);scan(p,'purchase',language);p.document.getElementById('game-bet-form').dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(p.document.getElementById('game-cash').textContent,'¥500,000');scan(p,'ticket-folder',language);}
 }catch(e){issues.push({language,label:'shop',kind:'execution',text:e.stack});}
 for(const key of ['credit','debit','shortfall','multiple','tie','neutral','live-result','live'])try{
 const p=await loadPage('index.html',query+`&correction=${key}`);await p.flush();p.qa.showRace;const race=p.qa.races.find(r=>r.id==='shuka');
 p.click(`[data-game-race-id="${race.id}"]`);scan(p,'correction-'+key,language);
 }catch(e){issues.push({language,label:'correction-'+key,kind:'execution',text:e.stack});}
 try{
 const p=await loadPage('index.html',query+'&notifications=preview&refund=preview');await p.flush();scan(p,'notifications-refund',language);
 p.click('#game-dialog [data-game-action="close"]');p.click('.game-shop-launcher');scan(p,'notifications-correction',language);p.click('#correction-dialog [data-correction-close]');scan(p,'notifications-settlement',language);
 for(const state of ['result','correction','shortfall']){p.click(`[data-notification-case="${state}"]`);scan(p,'notification-start-'+state,language);p.click(state==='result'?'#notification-modal-refresh':'#correction-dialog [data-notification-refresh]');await p.flush();scan(p,'notification-arrival-'+state,language);}
 }catch(e){issues.push({language,label:'notifications',kind:'execution',text:e.stack});}
 for(const section of ['language','sources'])try{
 const p=await loadPage('settings.html',query+'&section='+section);scan(p,'settings-'+section,language);
 for(const next of ['en','ja','zh','en']){const input=p.document.querySelector(`[name="language"][value="${next}"]`);input.dispatchEvent(new p.window.Event('change',{bubbles:true}));assert.equal(p.location.searchParams.get('lang'),next);assert.equal(p.document.documentElement.lang,{en:'en',ja:'ja',zh:'zh-CN'}[next]);const link=new URL(p.document.querySelector('.settings-return').href,p.location);assert.equal(link.searchParams.get('lang'),next);assert.equal(link.searchParams.get('month'),'10');scan(p,`settings-${section}-switch-${next}`,next);}
 }catch(e){issues.push({language,label:'settings-'+section,kind:'execution',text:e.stack});}
 for(const file of ['welcome.html','startup-preview.html','settings-options.html','density-2025.html'])try{
 const p=await loadPage(file,query);await p.flush();scan(p,file,language);
 }catch(e){issues.push({language,label:file,kind:'execution',text:e.stack});}
}
const unique=[...new Map(issues.map(item=>[JSON.stringify(item),item])).values()];
await writeFile(new URL('./matrix-result.json',import.meta.url),JSON.stringify({status:unique.length?'FAILED':'PASSED',checks:results.length,results,issues:unique},null,2)+'\n');
console.log('DOM scenarios:',results.length,'Issues:',unique.length);
for(const row of unique.slice(0,18))console.log(row.language,row.label,row.kind,row.text.slice(0,170));
process.exitCode=unique.length?1:0;

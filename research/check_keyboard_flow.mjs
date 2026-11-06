// Actual controller events with an offline DOM. Does not emulate native Tab or dialog focus trapping.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {loadPage} from './language-audit-76/dom-runner.mjs';
const results=[];
for(const lang of ['zh','ja','en']){
 const p=await loadPage('index.html',`preview=calendar&settingsMenu=preview&lang=${lang}&year=2026&month=10&availability=complete&refund=preview`);await p.flush();
 const get=id=>p.document.getElementById(id);
 const launcher=p.document.querySelector('.game-shop-launcher');launcher.focus();p.click(launcher);
 assert.equal(get('game-title').getAttribute('tabindex'),'-1');assert.ok(p.document.__focus===get('game-title'),'new panel heading receives focus');
 const bank=p.document.querySelector('#game-dialog [data-game-action="bank"]');bank.focus();p.click(bank);
 assert.equal(get('game-dialog').dataset.view,'bank');assert.ok(p.document.__focus===get('game-title'),'new panel heading receives focus');
 p.click('#game-dialog [data-game-action="wallet"]');assert.ok(p.document.__focus===get('game-title'),'new panel heading receives focus');
 const bet=p.document.querySelector('#game-upcoming [data-race="availability-entries"]');bet.focus();p.click(bet);
 assert.equal(get('game-dialog').dataset.view,'bet');assert.ok(p.document.__focus===get('game-title'),'new panel heading receives focus');
 const cancel=new p.window.Event('cancel',{cancelable:true});get('game-dialog').dispatchEvent(cancel);
 assert.equal(cancel.defaultPrevented,true);assert.equal(get('game-dialog').open,false);
 if(get('race-dialog').open)p.click('#race-dialog .close-button');
 assert.ok(!p.document.__focus?.closest('dialog:not([open])'),'never return focus into the closed shop');
 const race=p.document.querySelector('.race-card[data-race-id="shuka"]');race.focus();p.click(race);
 const horse=p.document.querySelector('.horse-name-button');horse.focus();p.click(horse);assert.ok(p.document.__focus===get('back-to-entries'),'horse return button focus');
 const past=p.document.querySelector('.past-race-button');past.focus();p.click(past);assert.ok(p.document.__focus===get('back-to-horse'),'history return button focus');
 p.click('#back-to-horse');assert.ok(p.document.__focus===past,'return to history opener');p.click('#back-to-entries');assert.ok(p.document.__focus===horse,'return to horse opener');
 p.click('#race-dialog .close-button');assert.ok(p.document.__focus?.dataset.raceId==='shuka' && p.document.__focus.isConnected,'return to current source race card');
 const settings=p.document.querySelector('.settings-menu-trigger');settings.focus();p.click(settings);
 const esc=new p.window.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(esc,'key',{value:'Escape'});p.document.dispatchEvent(esc);
 assert.equal(get('settings-quick-panel').hidden,true);assert.ok(p.document.__focus===settings,'return to settings button');
 results.push({lang,passed:['shop panel heading focus','bank and purchase panel transitions','shop cancel handler','horse/history entry and return focus','race close returns to source card','settings Escape closes and returns focus']});
}
await writeFile(new URL('./keyboard-flow-check-80.json',import.meta.url),JSON.stringify({round:80,status:'PASSED',method:'Offline actual DOM/controllers; no native Tab, focus trap or pixels',results},null,2)+'\n');
console.log('PASS: three-language controller focus transitions, return targets, cancel and settings Escape. Native keyboard behaviour not rendered.');

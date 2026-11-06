// Execute the actual UI controllers in an offline DOM; no browser or live wallet.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {loadPage} from './language-audit-76/dom-runner.mjs';
import {grossReturn} from '../design/game-state.mjs';
const money=value=>`¥${new Intl.NumberFormat('ja-JP').format(value)}`;
const checks=[];
for(const language of ['zh','ja','en']){
  const p=await loadPage('index.html',`preview=calendar&settingsMenu=preview&lang=${language}&availability=complete&refund=preview&game=wallet`);
  await p.flush();
  const get=id=>p.document.getElementById(id);
  const open=()=>p.click('#game-upcoming [data-game-action="bet"][data-race="availability-entries"]');
  const input=value=>{get('game-stake').value=String(value);get('game-stake').dispatchEvent(new p.window.Event('input',{bubbles:true}));};
  const submit=()=>get('game-bet-form').dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));
  const buttons=()=>[...get('game-bet-form').querySelectorAll('[data-game-action="stake"]')];
  assert.equal(get('game-cash').textContent,'¥500,000');open();
  assert.equal(get('game-dialog').dataset.colorRegion,'jp');
  assert.equal(get('game-stake').getAttribute('min'),'1');assert.equal(get('game-stake').getAttribute('step'),'1');
  assert.equal(get('game-stake').getAttribute('aria-describedby'),'game-stake-help game-stake-error');
  assert.deepEqual(buttons().map(b=>b.dataset.amount),['1000','10000','50000']);
  p.click(buttons()[0]);assert.equal(get('game-stake').value,'1000');assert.equal(buttons()[0].getAttribute('aria-pressed'),'true');
  p.click(buttons()[1]);assert.equal(get('game-stake').value,'10000');assert.equal(buttons()[0].getAttribute('aria-pressed'),'false');
  for(const value of ['',0,-1,1.5,500001,9007199254740992,'bad']){
    input(value);assert.equal(get('game-stake').value,String(value),'keep the editable input');
    assert.equal(get('game-stake').getAttribute('aria-invalid'),'true');assert.equal(get('game-stake-error').hidden,false);
    assert.ok(get('game-stake-error').textContent.length);assert.equal(get('game-bet-submit').disabled,true);
    for(const id of ['game-selected-stake','game-return','game-profit','game-cash-after'])assert.equal(get(id).textContent,'—');
    submit();assert.equal(get('game-dialog').dataset.view,'bet');assert.equal(get('game-preview-cash').textContent,'¥500,000');
    assert.equal(get('game-tickets').querySelectorAll('.game-ticket-record').length,0);
  }
  const odds=get('game-lock-odds').textContent.match(/[0-9]+(?:\.[0-9]+)?/)[0];
  for(const amount of [1,999,1000,10001,500000]){
    input(amount);assert.equal(get('game-stake').getAttribute('aria-invalid'),'false');assert.equal(get('game-stake-error').hidden,true);
    assert.equal(get('game-bet-submit').disabled,false);assert.equal(get('game-selected-stake').textContent,money(amount));
    assert.equal(get('game-return').textContent,money(grossReturn(amount,odds)));assert.equal(get('game-cash-after').textContent,money(500000-amount));
  }
  input(499950);submit();assert.equal(get('game-cash').textContent,'¥50');open();
  assert.equal(get('game-stake').value,'50');assert.equal(get('game-bet-submit').disabled,false);assert.ok(buttons().every(b=>b.disabled));
  input(51);assert.equal(get('game-bet-submit').disabled,true);assert.match(get('game-stake-error').textContent,/¥50/);
  input(1);submit();assert.equal(get('game-cash').textContent,'¥49');assert.equal(get('game-tickets').querySelectorAll('.game-ticket-record').length,2);
  const original=p.document.querySelector('[data-ticket-id="1"]');assert.ok(original);assert.match(original.textContent,/499,950/);
  p.click('#game-upcoming [data-game-action="bet"][data-race="availability-odds"]');assert.equal(get('game-dialog').dataset.colorRegion,'au');
  assert.deepEqual([...p.ui.missingUiMessages()],[]);
  checks.push({language,cases:['shortcut replacement and selection','empty/zero/negative/fraction/over-balance/unsafe/text rejected','invalid submission leaves cash and tickets unchanged','¥1 and non-hundred amounts accepted','quote math and recovery','low balance shortcuts disabled','two independent purchases debit exactly once','JP/AU theme attributes','no missing UI messages']});
}
await writeFile(new URL('./purchase-amount-check-77.json',import.meta.url),JSON.stringify({round:77,status:'PASSED',method:'Actual modules and events in offline DOM; not browser rendering',checks},null,2)+'\n');
console.log('PASS: three-language purchase amount input, errors, shortcut replacement, low balance and actual submission.');

import test from 'node:test';
import assert from 'node:assert/strict';
import { statePatch, applyStatePatch } from '../shared/state-patch';
import { newGame, publicView, applyCommand } from '../server/game';
import { allModesSampleContent } from '../shared/sample';
import { randomUUID } from 'node:crypto';
import type {Actor} from '../shared/model';

test('state patches reconstruct private views across clue, answer and reset transitions',()=>{
 const g=newGame('secret');Object.assign(g,allModesSampleContent());
 g.players=g.teams.map((t,i)=>({id:'p'+i,name:'P'+i,teamId:t.id,tokenHash:'secret',active:true,selections:0}));
 const online=new Set(g.players.map(p=>p.id));
 const actors:Actor[]=[{role:'host'},{role:'display'},{role:'player',playerId:'p0'}];
 let previous=actors.map(a=>publicView(g,a,online,0,null));
 const commands:[string,any][]=[['start',{}],['open-clue',{category:2,row:0}],['close-clue',{}],['return-board',{}],['reset-game',{confirm:true}]];
 for(const [type,payload] of commands){
  applyCommand(g,{role:'host'},{id:randomUUID(),type,payload},0,online);
  const next=actors.map(a=>publicView(g,a,online,0,null));
  next.forEach((view,i)=>assert.deepEqual(JSON.parse(JSON.stringify(applyStatePatch(previous[i],JSON.parse(JSON.stringify(statePatch(previous[i],view)))))),JSON.parse(JSON.stringify(view))));
  previous=next;
 }
});

test('unchanged images are not resent on timer updates',()=>{
 const g=newGame('secret');Object.assign(g,allModesSampleContent());
 const before=publicView(g,{role:'host'},new Set(),0,null);
 const after=publicView(g,{role:'host'},new Set(),1000,null);
 const patch=statePatch(before,after);
 assert.equal(patch.set.boards,undefined);
 const fullBytes=Buffer.byteLength(JSON.stringify(after));
 const patchBytes=Buffer.byteLength(JSON.stringify(patch));
 assert.ok(patchBytes<fullBytes/100);
 console.log(`Sample host update: ${fullBytes} bytes full, ${patchBytes} bytes patch`);
});

test('patches remove fields that disappear',()=>{
 const before=publicView(newGame('secret'),{role:'player',playerId:'old'},new Set(),0,null);
 const after={...before};delete after.playerId;
 assert.deepEqual(applyStatePatch(before,statePatch(before,after)),after);
});

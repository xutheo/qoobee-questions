import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newGame, hash, applyCommand, publicView, pause } from '../server/game';
import { sampleContent } from '../shared/sample';
import { samplePuzzle, puzzleReady, type Puzzle } from '../shared/puzzles';
import { validateGame } from '../server/storage';
import type { Actor } from '../shared/model';
function setup(type: Puzzle['type'], playersPerTeam = 3) {
 const g=newGame('secret'); Object.assign(g,sampleContent()); const config=samplePuzzle(type);
 Object.assign(g.boards[0][0].clues[0],{kind:'group',groupMode:'time',puzzle:config});
 g.teams.forEach((t,ti)=>{for(let i=0;i<playersPerTeam;i++)g.players.push({id:`p${ti}${i}`,name:`p${ti}${i}`,teamId:t.id,tokenHash:hash(`p${ti}${i}`),active:true,selections:0});});
 const online=new Set(g.players.map(p=>p.id));
 const cmd=(type:string,payload:any={},at=0,actor:Actor={role:'host'})=>applyCommand(g,actor,{id:randomUUID(),type,payload},at,online);
 cmd('start');cmd('open-clue',{category:0,row:0}); const payload={attemptId:g.current!.id};cmd('start-group',payload,1000);
 const team=g.current!.group!.puzzle!.teams[g.teams[0].id]; const actor:Actor={role:'player',playerId:team.operator};
 return {g,config,team,actor,cmd,payload,online};
}
test('puzzle samples validate; missing or duplicate order is rejected',()=>{for(const type of ['bomb','code','timeline'] as const)assert.ok(puzzleReady(samplePuzzle(type)));const p=samplePuzzle('bomb');p.solution[1]=p.solution[0];assert.equal(puzzleReady(p),false);});
test('bomb defusal checks wire order, operator access and persisted progress',()=>{
 const f=setup('bomb'), {g,team,cmd,payload,actor,config}=f;
 const other=g.players.find(p=>p.teamId===g.teams[0].id&&p.id!==team.operator)!;
 assert.throws(()=>cmd('submit-puzzle',{...payload,item:config.solution[0]},1500,{role:'player',playerId:other.id}),/operator/);
 cmd('submit-puzzle',{...payload,item:config.solution[1]},2000,actor);assert.equal(team.mistakes,1);assert.equal(team.progress.length,0);
 config.solution.forEach((item,i)=>cmd('submit-puzzle',{...payload,item},3000+i*1000,actor));
 assert.equal(team.finishedMs,5000);assert.equal(validateGame(g).current!.group!.puzzle!.teams[g.teams[0].id].finishedMs,5000);
 assert.throws(()=>cmd('group-done',payload,7000,actor),/not accepting/);
 assert.throws(()=>cmd('unfinish-group',payload,7000,actor),/not accepting/);
 assert.throws(()=>cmd('submit-puzzle',{...payload,item:config.solution[0]},7000,actor),/already finished/);
});
test('private puzzle hints and solutions never leak to other players or display',()=>{
 const {g,online,actor,team}=setup('code');
 for(const role of [actor,{role:'display'} as Actor]) {
  const v=publicView(g,role,online,2000,null),p=v.boards[0][0].clues[0].puzzle!;
  assert.deepEqual(p.answers,[]);assert.deepEqual(p.hints,[]);assert.deepEqual(p.solution,[]);
  for(const state of Object.values(v.current!.group!.puzzle!.teams)) assert.ok(Object.keys(state.assignments).every(id=>id===role.playerId));
 }
 const own=publicView(g,actor,online,2000,null);assert.deepEqual(own.current!.group!.puzzle!.teams[g.teams[0].id].assignments[actor.playerId!],team.assignments[actor.playerId!]);
 assert.equal(publicView(g,{role:'host'},online,2000,null).boards[0][0].clues[0].puzzle!.answers[0],'ROSE');
});
test('Codebreakers counts wrong guesses and accepts normalized exact answers',()=>{
 const {cmd,team,payload,actor}=setup('code');cmd('submit-puzzle',{...payload,answer:'wrong'},2000,actor);assert.equal(team.mistakes,1);
 cmd('submit-puzzle',{...payload,answer:' rose '},3000,actor);assert.equal(team.finishedMs,2000);
});
test('Timelines locks out wrong orders for ten active seconds and preserves pause time',()=>{
 const {g,cmd,team,payload,actor,config}=setup('timeline');cmd('submit-puzzle',{...payload,order:[...config.solution].reverse()},2000,actor);
 assert.equal(team.mistakes,1);assert.throws(()=>cmd('submit-puzzle',{...payload,order:config.solution},11999,actor),/locked out/);
 pause(g,11999);cmd('resume',{},50000);
 cmd('submit-puzzle',{...payload,order:config.solution},50001,actor);assert.equal(team.finishedMs,11000);
});
test('host may transfer operator; ended activities reject further submissions',()=>{
 const {g,cmd,team,payload,actor}=setup('code');const target=g.players.find(p=>p.teamId===g.teams[0].id&&p.id!==actor.playerId)!;
 cmd('puzzle-operator',{...payload,teamId:target.teamId,playerId:target.id});assert.equal(team.operator,target.id);
 assert.throws(()=>cmd('submit-puzzle',{...payload,answer:'ROSE'},2000,actor),/operator/);
 cmd('lock-group',payload,3000);assert.throws(()=>cmd('submit-puzzle',{...payload,answer:'ROSE'},4000,{role:'player',playerId:target.id}),/not accepting/);
});

test('before start, puzzle views show instructions but no puzzle material or assignments',()=>{
 const {g,online}=setup('code');g.current!.group!.status='ready';delete g.current!.group!.puzzle;
 const q=g.boards[0][0].clues[0];q.prompt='Secret prompt';q.puzzle!.instructions='Discuss clues and submit as a team.';
 for(const actor of [{role:'display'} as Actor,{role:'player',playerId:g.players[0].id} as Actor]) {
  const view=publicView(g,actor,online,0,null),clue=view.boards[0][0].clues[0];
  assert.equal(clue.puzzle!.instructions,'Discuss clues and submit as a team.');assert.equal(clue.prompt,'');assert.equal(clue.puzzle!.message,'');assert.deepEqual(clue.puzzle!.items,[]);assert.deepEqual(clue.puzzle!.hints,[]);assert.deepEqual(clue.puzzle!.answers,[]);assert.equal(view.current!.group!.puzzle,undefined);
 }
});

test('undo end reopens activity without counting review time or losing puzzle progress',()=>{
 const {g,cmd,team,payload,actor}=setup('bomb');
 cmd('submit-puzzle',{...payload,item:'Blue ●'},2000,actor);cmd('lock-group',payload,3000);
 assert.throws(()=>cmd('undo-end-group',payload,4000,actor),/Only the host/);
 cmd('undo-end-group',payload,20000);
 assert.equal(g.current!.group!.status,'playing');assert.deepEqual(team.progress,['Blue ●']);assert.equal(g.current!.group!.elapsedMs,2000);
 cmd('submit-puzzle',{...payload,item:'Green ■'},21000,actor);assert.equal(g.current!.group!.elapsedMs,3000);
 assert.throws(()=>cmd('undo-end-group',payload,22000),/No ended/);
});

test('wrong bomb cuts enforce a one-second server lockout',()=>{
 const {cmd,team,payload,actor}=setup('bomb');cmd('submit-puzzle',{...payload,item:'Red ★'},2000,actor);
 assert.equal(team.lockedUntil,2000);assert.throws(()=>cmd('submit-puzzle',{...payload,item:'Blue ●'},2999,actor),/one second/);assert.equal(team.mistakes,1);
 cmd('submit-puzzle',{...payload,item:'Blue ●'},3000,actor);assert.deepEqual(team.progress,['Blue ●']);
});
test('positive activity awards transfer category selection to the awarded team',()=>{
 const {g,cmd,payload}=setup('code');cmd('lock-group',payload,2000);
 const team=g.teams.find(t=>t.id!==g.selectorTeamId)!;cmd('award-group',{...payload,teamId:team.id,points:100,reason:'Winner'},3000);assert.equal(g.selectorTeamId,team.id);
});

test('bombs finish after the required subset; omitted wires are mistakes and timelines still need every event',()=>{
 const {config,team,cmd,payload,actor}=setup('bomb');
 config.solution=config.solution.slice(0,2);assert.ok(puzzleReady(config));
 const omitted=config.items.find(x=>!config.solution.includes(x))!;
 cmd('submit-puzzle',{...payload,item:omitted},2000,actor);
 assert.equal(team.mistakes,1);assert.deepEqual(team.progress,[]);
 cmd('submit-puzzle',{...payload,item:config.solution[0]},3000,actor);
 assert.equal(team.finishedMs,null);
 cmd('submit-puzzle',{...payload,item:config.solution[1]},4000,actor);
 assert.equal(team.finishedMs,3000);assert.equal(team.progress.length,2);
 assert.throws(()=>cmd('submit-puzzle',{...payload,item:omitted},5000,actor),/already finished/);
 config.solution=[];assert.equal(puzzleReady(config),false);
 const timeline=samplePuzzle('timeline');timeline.solution.pop();assert.equal(puzzleReady(timeline),false);
});

test('every bomb player including operator receives a clue even when only three clues exist',async()=>{
 const {startPuzzle}=await import('../server/puzzles');
 const {g,config}=setup('bomb');const teamId=g.teams[0].id;
 const operator=g.current!.group!.puzzle!.teams[teamId].operator;
 g.players.push({id:'extra',name:'Extra',teamId,tokenHash:hash('extra'),active:true,selections:0});
 config.hints=['First clue','Second clue','Third clue'];
 startPuzzle(g,g.current!.representatives);
 let assignments=g.current!.group!.puzzle!.teams[teamId].assignments;
 assert.equal(assignments[operator].length,1);
 assert.deepEqual(new Set(Object.values(assignments).flat()),new Set(config.hints));
 assert.ok(Object.entries(assignments).filter(([id])=>id!==operator).every(([,hints])=>hints.length===1));
 config.hints.push('Fourth clue');startPuzzle(g,g.current!.representatives);
 assignments=g.current!.group!.puzzle!.teams[teamId].assignments;
 assert.ok(Object.values(assignments).every(hints=>hints.length===1));
 assert.deepEqual(new Set(Object.values(assignments).flat()),new Set(config.hints));
});

test('bomb colors differ by team, survive saving, remain private, and validate mapped cuts',async()=>{
 const {recolor}=await import('../server/bomb-colors');
 const {g,config,cmd,payload,online}=setup('bomb');
 const teams=g.current!.group!.puzzle!.teams;
 const [a,b]=g.teams.map(t=>teams[t.id]);
 assert.notDeepEqual(a.colors,b.colors);
 const actor:Actor={role:'player',playerId:b.operator};
 const own=publicView(g,actor,online,1000,null);
 const visible=own.boards[0][0].clues[0].puzzle!;
 assert.deepEqual([...visible.items].sort(),config.items.map(item=>recolor(item,b.colors!)).sort());
 const allHints=Object.values(b.assignments).flat().sort();
 assert.deepEqual(allHints,[...config.hints.map(hint=>recolor(hint,b.colors!))].sort());
 assert.ok(Object.values(own.current!.group!.puzzle!.teams).every(t=>t.colors===undefined));
 assert.deepEqual(own.current!.group!.puzzle!.teams[g.teams[0].id].assignments,{});
 assert.deepEqual(validateGame(g).current!.group!.puzzle!.teams[g.teams[1].id].colors,b.colors);
 const wrong=config.items.find(item=>item!==config.solution[0])!;
 cmd('submit-puzzle',{...payload,item:recolor(wrong,b.colors!)},2000,actor);assert.equal(b.mistakes,1);
 config.solution.forEach((item,i)=>cmd('submit-puzzle',{...payload,item:recolor(item,b.colors!)},3000+i*1000,actor));
 assert.notEqual(b.finishedMs,null);
 const after=publicView(g,actor,online,7000,null);
 assert.deepEqual(after.current!.group!.puzzle!.teams[g.teams[1].id].progress,config.solution.map(item=>recolor(item,b.colors!)));
 const display=publicView(g,{role:'display'},online,7000,null);
 for(const t of Object.values(display.current!.group!.puzzle!.teams)){assert.equal(t.colors,undefined);assert.deepEqual(t.assignments,{});assert.deepEqual(t.progress,[]);}
});

test('color substitution is simultaneous and supports twelve distinct team mappings',async()=>{
 const {recolor,teamColors}=await import('../server/bomb-colors');
 assert.equal(recolor('Red before BLUE; redwood stays.',{red:'blue',blue:'red'}),'Blue before RED; redwood stays.');
 const used=new Set<string>();
 const mappings=Array.from({length:12},()=>teamColors(['Red ★','Red ●'],used));
 assert.equal(new Set(mappings.map(m=>m.red)).size,12);
});

test('math relay sends private expressions, accepts only final player, tracks mistakes without lockout',()=>{
 const {g,config,team,cmd,payload,actor,online}=setup('relay');
 assert.ok(puzzleReady(config));assert.equal(team.relay!.order.length,4);
 assert.equal(team.operator,team.relay!.order.at(-1));
 assert.equal(Object.values(team.assignments).flat().length,4);
 const other=g.players.find(p=>p.teamId===g.teams[0].id&&p.id!==team.operator)!;
 assert.throws(()=>cmd('submit-puzzle',{...payload,answer:String(team.relay!.answer)},1500,{role:'player',playerId:other.id}),/operator/);
 cmd('submit-puzzle',{...payload,answer:String(team.relay!.answer!+1)},2000,actor);
 assert.equal(team.mistakes,1);assert.equal(team.lockedUntil,0);
 cmd('submit-puzzle',{...payload,answer:String(team.relay!.answer)},2001,actor);
 assert.equal(team.finishedMs,1001);
 for(const role of [actor,{role:'player',playerId:other.id} as Actor,{role:'display'} as Actor]) {
   const view=publicView(g,role,online,2001,null);
   for(const state of Object.values(view.current!.group!.puzzle!.teams)) {
     assert.equal(state.relay?.answer,undefined);
     assert.ok(Object.keys(state.assignments).every(id=>id===role.playerId));
   }
 }
 assert.deepEqual(validateGame(g).current!.group!.puzzle!.teams[g.teams[0].id].relay,team.relay);
 assert.throws(()=>cmd('puzzle-operator',{...payload,teamId:g.teams[0].id,playerId:other.id},2002),/last relay/);
 const second=g.current!.group!.puzzle!.teams[g.teams[1].id];
 assert.notEqual(team.assignments[team.relay!.order[0]][0],second.assignments[second.relay!.order[0]][0]);
});

test('generated relay expressions evaluate to the server answer for different sizes and difficulties',async()=>{
 const {makeRelay}=await import('../server/relay');
 for(const count of [1,2,4,10,100])for(const difficulty of [1,2,3,4,5]) {
   const relay=makeRelay(count,1,difficulty,['multiply','subtract','divide','add']);
   let value=0;
   for(const [i,expression] of relay.expressions.entries()) {
     assert.doesNotMatch(expression, /[()]/);
     const parts=expression.split(' ');
     assert.equal((parts.length-1)/2,difficulty);
     value=i===0?Number(parts[0]):value;
     // Independently evaluate the generated numeric-only expression using JS precedence.
     const arithmetic=[String(value),...parts.slice(1)].join(' ').replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');
     assert.match(arithmetic,/^[0-9 +*/.-]+$/);
     value=Function('return '+arithmetic)();
     assert.ok(Number.isSafeInteger(value));assert.ok(value>0);
   }
   assert.equal(value,relay.answer);
 }
});

test('relay uses PEMDAS and left-to-right for equal precedence',async()=>{
 const {evaluateRelay}=await import('../server/relay');
 assert.equal(evaluateRelay([2,3,4],['+','×']),14);
 assert.equal(evaluateRelay([20,6,3],['−','÷']),18);
 assert.equal(evaluateRelay([24,4,2],['÷','×']),12);
 assert.equal(evaluateRelay([10,3,2],['−','+']),9);
});

test('fixed sample relays use the published questions and PEMDAS answers',async()=>{
 const {fixedRelay}=await import('../server/relay');
 const {sampleRelays}=await import('../shared/sample-relays');
 assert.deepEqual(sampleRelays.map(expressions=>fixedRelay(expressions).answer),[19,13,44,74,18]);
});

test('relays allocate at least four steps fairly and only the final step owner submits',()=>{
 for(const count of [1,2,3,4,5,8]) {
  const {g,team,cmd,payload,online}=setup('relay',count);
  const order=team.relay!.order;
  assert.equal(order.length,Math.max(4,count));
  const sizes=Object.values(team.assignments).map(a=>a.length);
  assert.equal(sizes.reduce((a,b)=>a+b,0),order.length);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1);
  assert.equal(team.operator,order.at(-1));
  for(const id of new Set(order)) {
   const view=publicView(g,{role:'player',playerId:id},online,1000,null);
   assert.deepEqual(view.current!.group!.puzzle!.teams[g.teams[0].id].assignments,{[id]:team.assignments[id]});
   if(id!==team.operator)assert.throws(()=>cmd('submit-puzzle',{...payload,answer:String(team.relay!.answer)},2000,{role:'player',playerId:id}),/operator/);
  }
  assert.deepEqual(validateGame(g).current!.group!.puzzle!.teams[g.teams[0].id].relay!.order,order);
  cmd('submit-puzzle',{...payload,answer:String(team.relay!.answer)},2000,{role:'player',playerId:team.operator});
  assert.equal(team.finishedMs,1000);
 }
});

test('puzzle penalties apply on review, undo cleanly, and never double charge',()=>{
 const {g,team,cmd,payload}=setup('bomb');team.mistakes=2;
 assert.equal(g.teams[0].score,0);cmd('lock-group',payload,2000);assert.equal(g.teams[0].score,-100);
 cmd('undo-end-group',payload,3000);assert.equal(g.teams[0].score,0);
 team.mistakes=3;cmd('lock-group',payload,4000);assert.equal(g.teams[0].score,-150);
 cmd('close-clue',{},5000);assert.equal(g.teams[0].score,-150);
 assert.ok(validateGame(g));
});
test('bomb and relay expire after three minutes of active time and deduct mistakes once',async()=>{
 const {advanceTimers}=await import('../server/game');
 for(const type of ['bomb','relay'] as const){
  const {g,team,cmd,payload}=setup(type);team.mistakes=1;
  assert.equal(g.current!.group!.timeLimitMs,180000);
  cmd('pause',{},61000);advanceTimers(g,161000);assert.equal(g.current!.group!.elapsedMs,60000);
  cmd('resume',{},161000);advanceTimers(g,280999);assert.equal(g.current!.group!.status,'playing');
  advanceTimers(g,281000);assert.equal(g.current!.group!.status,'review');assert.equal(g.teams[0].score,-50);
  advanceTimers(g,300000);assert.equal(g.teams[0].score,-50);
  assert.throws(()=>cmd('undo-end-group',payload,300000),/expired/);
 }
});

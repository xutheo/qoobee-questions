import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {io, type Socket} from 'socket.io-client';
import {allModesSampleContent} from '../shared/sample';
import {applyStatePatch} from '../shared/state-patch';
import {recolor} from '../server/bomb-colors';
import {DiskStore} from '../server/storage';
import type {View} from '../shared/model';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const port=4500+Math.floor(Math.random()*500),url=`http://127.0.0.1:${port}`,root=await fs.mkdtemp(process.cwd()+'/.stress-data-');
const report:any={started:new Date().toISOString(),environment:'Local loopback, production server, actual Socket.IO clients and disk persistence',players:15,totalConnections:17,cluesCompleted:0,examplesCompleted:0,commands:0,expectedBuzzRejections:0,unexpectedErrors:[],disconnects:[],connectErrors:[],reconnects:0,stateMessages:0,receivedJsonBytes:0};
let measuring=true,output='',hostNext=0;const latencies:number[]=[];const clients:{socket:Socket,state:View,label:string,session:any}[]=[];
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env:{...process.env,PORT:String(port),DATA_DIR:root},windowsHide:true,stdio:['ignore','pipe','pipe']});
server.stdout!.on('data',d=>output+=d);server.stderr!.on('data',d=>output+=d);
async function api(route:string,body:any){const r=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,data.error);return data;}
async function connect(session:any,label:string){const socket=io(url,{auth:{...session,statePatches:true},reconnection:true,timeout:10000});const c={socket,state:null as unknown as View,label,session};clients.push(c);
 socket.on('disconnect',reason=>{if(measuring)report.disconnects.push({label,reason,at:new Date().toISOString()});});socket.on('connect_error',e=>{if(measuring)report.connectErrors.push({label,message:e.message});});socket.io.on('reconnect',()=>{if(measuring)report.reconnects++;});
 socket.on('state',(v:View)=>{c.state=v;report.stateMessages++;report.receivedJsonBytes+=Buffer.byteLength(JSON.stringify(v));});socket.on('state-patch',p=>{c.state=applyStatePatch(c.state,p);report.stateMessages++;report.receivedJsonBytes+=Buffer.byteLength(JSON.stringify(p));});
 for(let i=0;i<200&&!c.state;i++)await sleep(50);assert.ok(c.state,'Initial state missing: '+label);return c;}
async function cmd(c:typeof clients[number],type:string,payload:any={},allowRejected=false){if(c.label==='host'){await sleep(Math.max(0,hostNext-performance.now()));hostNext=performance.now()+130;}
 const start=performance.now();report.commands++;const ack=await c.socket.timeout(10000).emitWithAck('command',{id:randomUUID(),type,payload});latencies.push(performance.now()-start);
 if(!ack.ok&&!allowRejected){report.unexpectedErrors.push({type,error:ack.error});throw Error(type+': '+ack.error);}return ack;}
try{
 for(let i=0;i<150;i++){try{if((await fetch(url+'/api/health')).ok)break;}catch{}await sleep(100);}
 const session=await api('/api/games',{name:'15-player full-game stress test'}),h=await connect(session,'host');
 const content=allModesSampleContent();content.boards[0][3].collectAnswers=true;content.boards[0][5].exampleMode=true;content.boards[1][2].exampleMode=true;
 content.boards[1][1].openToAll=true;for(const q of content.boards[1][1].clues)q.quotes=[1,2,3].map(i=>({text:'Stress-test quote '+i,source:'#test'}));
 content.boards[1][0].clues[0].image=content.boards[0][2].clues[0].image;content.boards[1][0].clues[0].zoom={x:.3,y:.7};
 await cmd(h,'save-content',content);await cmd(h,'add-team',{name:'Third team'});
 const players:typeof clients=[];for(let i=0;i<15;i++){const session=await api('/api/join',{code:h.state.code,name:'P'+i,token:randomUUID()+randomUUID()});const p=await connect(session,'player-'+i);players.push(p);await cmd(p,'choose-team',{teamId:h.state.teams[i%3].id});}
 const display=await connect({gameId:session.gameId,role:'display',code:h.state.code},'display');
 const byId=(id:string)=>players.find(p=>p.state.playerId===id)!;
 await cmd(h,'set-auto-sounds',{enabled:true});await cmd(h,'adjust-score',{teamId:h.state.teams[0].id,amount:1});await cmd(h,'adjust-score',{teamId:h.state.teams[0].id,amount:-1});
 await cmd(h,'start');await cmd(h,'show-instructions',{visible:false});
 async function activity(){let c=h.state.current!;const attemptId=c.id;let q=h.state.boards[h.state.board][c.category].clues[c.row];if(c.group!.status==='ready')await cmd(h,'start-group',{attemptId});c=h.state.current!;
 if(q.puzzle){for(const [teamId,t] of Object.entries(c.group!.puzzle!.teams)){const actor=byId(t.operator);switch(q.puzzle.type){case 'relay':await cmd(actor,'submit-puzzle',{attemptId,answer:String(t.relay!.answer)});break;case 'bomb':for(const item of q.puzzle.solution)await cmd(actor,'submit-puzzle',{attemptId,item:recolor(item,t.colors||{})});break;case 'code':await cmd(actor,'submit-puzzle',{attemptId,answer:q.puzzle.answers[0]});break;case 'timeline':await cmd(actor,'submit-puzzle',{attemptId,order:q.puzzle.solution});break;}}}
 else await Promise.all(players.map(p=>cmd(p,c.group!.mode==='time'?'group-done':'submit-group',{attemptId,score:'5'})));
 await cmd(h,'lock-group',{attemptId});if(!c.example){for(let i=0;i<2;i++)await cmd(h,'award-group',{attemptId,teamId:h.state.teams[i].id,...(h.state.boards[h.state.board][c.category].teamBased?{place:i+1}:{points:100,reason:'Stress test'})});}else report.examplesCompleted++;
 await cmd(h,'return-board');}
 async function intros(){while(h.state.introCategory!=null){if(h.state.current?.example)await activity();await cmd(h,'next-category');}}
 await intros();
 for(let b=0;b<2;b++){
 for(let category=0;category<6;category++)for(let row=0;row<5;row++){
 await cmd(h,'open-clue',{category,row});let c=h.state.current!,q=h.state.boards[b][category].clues[row];const attemptId=c.id;
 if(c.group?.teamAnswers){await Promise.all(Object.values(c.representatives).map(id=>cmd(byId(id),'submit-group',{attemptId,score:'Answer'})));await cmd(h,'lock-group',{attemptId});for(let i=0;i<h.state.teams.length;i++){const teamId=h.state.teams[i].id;await cmd(h,'present-team-answer',{attemptId,teamId,reveal:true});await cmd(h,'judge-team-answer',{attemptId,teamId,correct:i%2===0});}await cmd(h,'return-board');}
 else if(c.group)await activity();
 else if(q.boost){await cmd(h,'start-boost',{attemptId,teamId:h.state.teams[0].id,wager:10});await cmd(h,'judge',{buzzId:h.state.current!.buzzId,correct:true});await cmd(h,'return-board');}
 else{if(q.quotes)await cmd(h,'reveal-quote',{attemptId,revealed:1});const eligible=h.state.current!.state==='open'?players:Object.values(c.representatives).map(byId);const buzz=await Promise.all(eligible.map(p=>cmd(p,'buzz',{attemptId},true)));assert.equal(buzz.filter(a=>a.ok).length,1);report.expectedBuzzRejections+=buzz.filter(a=>!a.ok).length;await cmd(h,'judge',{buzzId:h.state.current!.buzzId,correct:true});await cmd(h,'return-board');}
 report.cluesCompleted++;if(report.cluesCompleted%10===0)console.log(`Completed ${report.cluesCompleted}/60 clues; disconnects=${report.disconnects.length}`);
 }
 if(b===0){assert.ok(h.state.intermission);await sleep(1000);await cmd(h,'end-intermission');await intros();}
 }
 assert.equal(h.state.phase,'final-wager');for(const t of h.state.teams)await cmd(byId(t.captain!),'wager',{amount:100});await cmd(h,'lock-wagers');for(const t of h.state.teams)await cmd(byId(t.captain!),'final-answer',{answer:'Africa'});await cmd(h,'lock-answers');for(const t of h.state.teams){for(const field of ['team','answer','wager'])await cmd(h,'present-final',{teamId:t.id,field});await cmd(h,'judge-final',{teamId:t.id,correct:true});}await cmd(h,'finish-final');
 await sleep(30000);assert.ok(clients.every(c=>c.socket.connected && c.state.phase==='finished'));const saved=(await new DiskStore(root).load(session.gameId)).game;assert.equal(saved.phase,'finished');assert.equal(saved.boards.flatMap(b=>b.flatMap(c=>c.clues)).filter(q=>q.used).length,60);for(const c of clients)assert.deepEqual(c.state.teams.map(t=>t.score),h.state.teams.map(t=>t.score));
 report.finalScores=h.state.teams.map(t=>({name:t.name,score:t.score}));report.result='passed';report.allClientsFinishedAndScoresMatched=true;
}catch(e){report.result='failed';report.failure=String(e);report.serverOutput=output;process.exitCode=1;}
finally{measuring=false;latencies.sort((a,b)=>a-b);report.ackLatencyMs={median:Math.round(latencies[Math.floor(latencies.length*.5)]||0),p95:Math.round(latencies[Math.floor(latencies.length*.95)]||0),max:Math.round(latencies.at(-1)||0)};report.finished=new Date().toISOString();report.durationSeconds=Math.round((Date.parse(report.finished)-Date.parse(report.started))/1000);await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/stress-15-full-game.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));clients.forEach(c=>c.socket.disconnect());server.kill();await new Promise<void>(r=>server.exitCode!==null?r():server.once('exit',()=>r()));await fs.rm(root,{recursive:true,force:true});}

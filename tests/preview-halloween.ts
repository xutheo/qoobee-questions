import {io} from 'socket.io-client';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {newGame,hash,applyCommand} from '../server/game';
import {DiskStore} from '../server/storage';
import {sampleContent} from '../shared/sample';
const root=await mkdtemp(process.cwd()+'/.halloween-preview-');
const g=newGame('preview');Object.assign(g,sampleContent());
g.teams.forEach((t,i)=>{t.icon=i?'vampire':'pumpkin';t.captain='p'+i;g.players.push({id:'p'+i,name:'Player'+i,teamId:t.id,tokenHash:hash('preview'+i),active:true,selections:0});});
const online=new Set(g.players.map(p=>p.id));const cmd=(type:string,payload={},actor:any={role:'host'})=>applyCommand(g,actor,{id:randomUUID(),type,payload},1000,online);
g.boards[0][0].collectAnswers=true;cmd('start');cmd('open-clue',{category:0,row:0});const attemptId=g.current!.id;
g.teams.forEach((t,i)=>cmd('submit-group',{attemptId,score:i?'A wonderfully spooky pumpkin':'Qoobee the friendly vampire'},{role:'player',playerId:'p'+i}));cmd('lock-group',{attemptId});g.teams.forEach(t=>cmd('present-team-answer',{attemptId,teamId:t.id,reveal:true}));await new DiskStore(root).save(g);
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env:{...process.env,PORT:'3298',DATA_DIR:root},windowsHide:true,stdio:'ignore'});let browser;let socket:any;
try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3298/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
socket=io('http://127.0.0.1:3298',{auth:{gameId:g.id,role:'host',token:'preview'}});await new Promise(r=>socket.once('state',r));await socket.timeout(5000).emitWithAck('command',{id:randomUUID(),type:'resume'});
browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({reducedMotion:"reduce"});for(const [w,h] of [[1920,1080],[1280,720]]){await page.setViewportSize({width:w,height:h});await page.goto(`http://127.0.0.1:3298/?game=${g.id}&display=1&code=${g.code}`);await page.locator('.team-answer-card').first().waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLImageElement>('.team-icon')).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:`artifacts/halloween-answers-${w}.png`});const boxes=await page.locator('.team-answer-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));if(boxes[0].y!==boxes[1].y || boxes.some(b=>b.right>w||b.bottom>h))throw Error('Answer layout does not fit');console.log(w,boxes);}}
finally{await browser?.close();socket?.disconnect();server.kill();await new Promise(r=>server.exitCode!==null?r(null):server.once('exit',r));await rm(root,{recursive:true,force:true});}


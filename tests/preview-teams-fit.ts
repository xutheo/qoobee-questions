import {io} from 'socket.io-client';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {newGame,hash,applyCommand} from '../server/game';
import {DiskStore} from '../server/storage';
import {sampleContent} from '../shared/sample';
const root=await mkdtemp(process.cwd()+'/.teams-fit-preview-');
const g=newGame('preview');Object.assign(g,sampleContent());
applyCommand(g,{role:'host'},{id:randomUUID(),type:'add-team',payload:{name:'Qooblets'}},1000,new Set());
g.teams.forEach((t,i)=>{for(let j=0;j<4;j++)g.players.push({id:`p${i}${j}`,name:['Edward','Donald','Anthon','Brenda'][j],teamId:t.id,tokenHash:hash(`p${i}${j}`),active:true,selections:0});});
await new DiskStore(root).save(g);
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env:{...process.env,PORT:'3298',DATA_DIR:root},windowsHide:true,stdio:'ignore'});let browser;let socket:any;
try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3298/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
socket=io('http://127.0.0.1:3298',{auth:{gameId:g.id,role:'host',token:'preview'}});await new Promise(r=>socket.once('state',r));await socket.timeout(5000).emitWithAck('command',{id:randomUUID(),type:'resume'});
browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({reducedMotion:"reduce"});for(const [w,h] of [[1920,1080],[1280,720]]){await page.setViewportSize({width:w,height:h});await page.goto(`http://127.0.0.1:3298/?game=${g.id}&display=1&code=${g.code}`);await page.locator('.stream-team-total').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`artifacts/teams-fit-${w}.png`});const results=await page.locator('.stream-scores>div').evaluateAll(cards=>cards.map(card=>{const members=[...card.querySelectorAll('li')].map(el=>el.getBoundingClientRect());const title=card.querySelector('.stream-team-total')!;return {oneLine:new Set(members.map(r=>r.top)).size===1, fits:title.scrollWidth<=title.clientWidth};}));if(results.some(r=>!r.oneLine||!r.fits))throw Error(JSON.stringify(results));console.log(w,results);}}

finally{await browser?.close();socket?.disconnect();server.kill();await new Promise(r=>server.exitCode!==null?r(null):server.once('exit',r));await rm(root,{recursive:true,force:true});}


import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {io} from 'socket.io-client';
const root=await mkdtemp(process.cwd()+'/.intro-preview-');
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env:{...process.env,PORT:'3298',DATA_DIR:root},windowsHide:true,stdio:'ignore'});
let browser,socket;
try{
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3298/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const session=await (await fetch('http://127.0.0.1:3298/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Welcome preview'})})).json();
socket=io('http://127.0.0.1:3298',{auth:session});const state=await new Promise(r=>socket.once('state',r));
browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();await mkdir('artifacts',{recursive:true});
for(const [w,h] of [[1920,1080],[1280,720]]){await page.setViewportSize({width:w,height:h});await page.goto(`http://127.0.0.1:3298/?game=${session.gameId}&display=1&code=${state.code}`);await page.locator('.qoobee-welcome').waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.welcome-photo')).every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:`artifacts/qoobee-intro-${w}.png`});console.log(w,await page.locator('.qoobee-welcome').evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scrollHeight:el.scrollHeight})));}
}finally{await browser?.close();socket?.disconnect();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(root,{recursive:true,force:true});}

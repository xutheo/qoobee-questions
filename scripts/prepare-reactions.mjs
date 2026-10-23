import { chromium } from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage();
 for(const [file,name,start,end] of [ ['aww sound effect ( 4K ).mp3','awww.wav',0.25,null],['Clapping Sound Effects.mp3','applause.wav',3,6]]) {
  const source=(await readFile('sound-clips/'+file)).toString('base64');
  const result=await page.evaluate(async({source,start,end})=>{
   const bytes=Uint8Array.from(atob(source),c=>c.charCodeAt(0));const context=new AudioContext();
   try {
    const decoded=await context.decodeAudioData(bytes.buffer);const stop=end??decoded.duration;
    if(stop>decoded.duration||start>=stop)throw Error('Clip is too short for requested range');
    const rate=22050,offline=new OfflineAudioContext(1,Math.round((stop-start)*rate),rate);
    const node=offline.createBufferSource();node.buffer=decoded;node.connect(offline.destination);node.start(0,start,stop-start);
    const audio=await offline.startRendering();const pcm=audio.getChannelData(0);
    const data=new Uint8Array(pcm.length*2);const view=new DataView(data.buffer);
    for(let i=0;i<pcm.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*0.512*32767),true);
    let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
    return {base64:btoa(binary),duration:stop-start,sourceDuration:decoded.duration};
   } finally {await context.close();}
  },{source,start,end});
  const pcm=Buffer.from(result.base64,'base64'),header=Buffer.alloc(44);
  header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(22050,24);header.writeUInt32LE(44100,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  await writeFile('public/audio/'+name,Buffer.concat([header,pcm]));console.log(`${name}: ${result.duration.toFixed(3)} seconds (source ${result.sourceDuration.toFixed(3)} seconds)`);
 }
} finally {await browser.close();}


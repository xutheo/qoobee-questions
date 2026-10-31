import React, {useEffect,useState} from 'react';
import type {View} from '../shared/model';

export function ProgressivePrompt({v,text,connected}:{v:View;text:string;connected:boolean}) {
  const c=v.current, timer=c?.textReveal;
  const [tick,setTick]=useState({at:v.serverNow,elapsed:0});
  const running=!!timer && timer.runningSince!==null && connected && !v.paused && !v.storageError;
  useEffect(()=>{
    setTick({at:v.serverNow,elapsed:0});
    if(!running)return;
    const start=performance.now();
    const id=setInterval(()=>setTick({at:v.serverNow,elapsed:performance.now()-start}),50);
    return()=>clearInterval(id);
  },[v.serverNow,c?.id,running]);
  const elapsed=(timer?.elapsedMs || 0)+(running ? Math.max(0,v.serverNow-timer!.runningSince!)+(tick.at===v.serverNow?tick.elapsed:0) : 0);
  const chars=Array.from(text), charactersPerSecond=Math.max(25,chars.length/5);
  const count=!timer || c?.state==='resolved' || c?.revealedAnswer ? chars.length : Math.min(chars.length,Math.floor(elapsed * charactersPerSecond / 1000));
  const hidden=!!timer && c?.state==='answering' && count<chars.length;
  return <h1 className="progressive-prompt" aria-label={hidden ? 'Question hidden while answering' : chars.slice(0,count).join('')}><span style={{visibility:hidden?'hidden':'visible'}}>{chars.slice(0,count).join('')}</span><span aria-hidden="true" style={{visibility:'hidden'}}>{chars.slice(count).join('')}</span></h1>;
}


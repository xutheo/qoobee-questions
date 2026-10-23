import {basePath} from './environment';
import React, {useEffect,useRef,useState} from 'react';
import {money,type View} from '../shared/model';
export function ScoreValue({value}:{value:number}) {
 const previous=useRef(value);const [change,setChange]=useState<{amount:number;key:number}|null>(null);
 useEffect(()=>{const difference=value-previous.current;previous.current=value;if(!difference)return;setChange({amount:difference,key:Date.now()});const timer=setTimeout(()=>setChange(null),2400);return()=>clearTimeout(timer);},[value]);
 return <span className="animated-score"><strong>{money(value)}</strong>{change&&<span key={change.key} className={'score-change '+(change.amount>0?'positive':'negative')}>{change.amount>0?'+':''}{money(change.amount)}</span>}</span>;
}
export function ActivityTimer({v}:{v:View}) {
 const group=v.current?.group;const [now,setNow]=useState(0);
 useEffect(()=>{setNow(0);if(!group?.timeLimitMs||group.status!=='playing'||v.paused)return;const start=performance.now();const t=setInterval(()=>setNow(performance.now()-start),200);return()=>clearInterval(t);},[group?.elapsedMs,group?.status,v.paused]);
 if(!group?.timeLimitMs||group.status==='ready')return null;
 const seconds=Math.max(0,Math.ceil((group.timeLimitMs-group.elapsedMs-(group.status==='playing'&&!v.paused?now:0))/1000));
 return <div className="activity-countdown" role="timer">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} remaining</div>;
}
export function StreamMusic({playing}:{playing:boolean}) {
 const context=useRef<AudioContext|null>(null),audio=useRef<HTMLAudioElement|null>(null);
 const [enabled,setEnabled]=useState(false),[source,setSource]=useState('');
 useEffect(()=>{
  let alive=true;const enable=()=>{context.current??=new AudioContext();void context.current.resume().then(()=>{if(alive)setEnabled(context.current?.state==='running');}).catch(()=>{});};
  enable();document.addEventListener('pointerdown',enable);document.addEventListener('keydown',enable);
  return()=>{alive=false;document.removeEventListener('pointerdown',enable);document.removeEventListener('keydown',enable);void context.current?.close();};
 },[]);
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source);},[source]);
 useEffect(()=>{
  if(!enabled||!playing){audio.current?.pause();return;}
  const a=new Audio(source || basePath+'audio/jeopardy-theme.mp3');a.loop=!!source;a.volume=.3;audio.current=a;
  const seekStart=()=>{if(!source && a.duration>1)a.currentTime=1;};
  a.addEventListener('loadedmetadata',seekStart);
  a.addEventListener('ended',()=>{if(!source){seekStart();void a.play().catch(()=>setEnabled(false));}});
  let cancelled=false;void a.play().catch(()=>{if(!cancelled)setEnabled(false);});
  return()=>{cancelled=true;a.pause();audio.current=null;};
 },[playing,enabled,source]);
 return <details className="stream-audio-controls"><summary>Audio settings</summary><button onClick={async()=>{context.current??=new AudioContext();await context.current.resume();setEnabled(true);}}>Enable sound</button><label>Music file (optional)<input type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(file)setSource(URL.createObjectURL(file));}}/></label><small>{!enabled?'Enable sound once on this device.':playing?'Host has started music.':'Waiting for host to play music.'} Uses the Jeopardy theme unless you select another music file.</small></details>;
}

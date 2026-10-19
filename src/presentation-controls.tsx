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
 useEffect(()=>()=>{void context.current?.close();},[]);
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source);},[source]);
 useEffect(()=>{
  if(!enabled||!playing){audio.current?.pause();return;}
  if(source){const a=new Audio(source);a.loop=true;a.volume=.3;audio.current=a;void a.play().catch(()=>setEnabled(false));return()=>{a.pause();audio.current=null;};}
  const ctx=context.current;if(!ctx)return;
  // Original quiet thinking loop; no downloaded theme or streamed audio traffic.
  const notes=[60,64,67,71,69,65,62,67,64,69,72,67,65,62,59,62];let step=0;
  const play=()=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=440*Math.pow(2,(notes[step++%notes.length]-69)/12);gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.065,ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.4);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.45);};
  play();const interval=setInterval(play,500);return()=>clearInterval(interval);
 },[playing,enabled,source]);
 return <details className="stream-audio-controls"><summary>Audio settings</summary><button onClick={async()=>{context.current??=new AudioContext();await context.current.resume();setEnabled(true);}}>Enable sound</button><label>Music file (optional)<input type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(file)setSource(URL.createObjectURL(file));}}/></label><small>{!enabled?'Enable sound once on this device.':playing?'Host has started music.':'Waiting for host to play music.'} Uses a built-in thinking loop unless you select a music file.</small></details>;
}

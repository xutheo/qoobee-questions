import React,{useEffect,useRef,useState} from 'react';
import {basePath} from './environment';
import type {View} from '../shared/model';
export function StreamReactions({cue,connected}:{cue:View['soundCue'];connected:boolean}) {
 const context=useRef<AudioContext|null>(null),current=useRef<AudioBufferSourceNode|null>(null),seen=useRef(cue?.id),generation=useRef(0);
 const buffers=useRef<Record<string,Promise<AudioBuffer>>>({});const [blocked,setBlocked]=useState(false),[failed,setFailed]=useState(false);
 const enable=()=>{const ctx=context.current;if(ctx)void ctx.resume().then(()=>setBlocked(ctx.state!=='running')).catch(()=>setBlocked(true));};
 useEffect(()=>{
  const ctx=new AudioContext();context.current=ctx;
  const check=()=>setBlocked(ctx.state!=='running');ctx.addEventListener('statechange',check);check();enable();
  for(const kind of ['applause','awww']){buffers.current[kind]=fetch(`${basePath}audio/${kind}.wav`).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b));void buffers.current[kind].catch(()=>setFailed(true));}
  document.addEventListener('pointerdown',enable);document.addEventListener('keydown',enable);
  return()=>{generation.current++;current.current?.stop();ctx.removeEventListener('statechange',check);void ctx.close();document.removeEventListener('pointerdown',enable);document.removeEventListener('keydown',enable);};
 },[]);
 useEffect(()=>{
  if(!connected){generation.current++;current.current?.stop();current.current=null;seen.current=cue?.id;return;}
  if(!cue||seen.current===cue.id)return;seen.current=cue.id;
  const ticket=++generation.current;current.current?.stop();current.current=null;
  if(cue.kind==='stop')return;
  const ctx=context.current;if(!ctx||ctx.state!=='running'){setBlocked(true);return;}
  void buffers.current[cue.kind]?.then(buffer=>{if(ticket!==generation.current||ctx.state!=='running')return;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(ctx.destination);current.current=source;source.start();}).catch(()=>setFailed(true));
 },[cue?.id,connected]);
 return blocked||failed ? <button className="audio-unlock" onClick={enable}>{failed?'Sound files unavailable — refresh after deployment': 'Enable sound — browser requires a click'}</button>:null;
}

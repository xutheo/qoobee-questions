import React,{useEffect,useRef,useState} from 'react';
import {wordThreshold} from '../shared/plan';
type Clue={word:string;score:number;stage:number};
type Reveal={clue:Clue;index:number;id:string};
export function WordClueBoard({clues}:{clues:Clue[]}){
 const signature=JSON.stringify(clues),previous=useRef(clues),board=useRef<HTMLDivElement>(null),flash=useRef<HTMLDivElement>(null),veil=useRef<HTMLDivElement>(null);
 const [queue,setQueue]=useState<Reveal[]>([]);const active=queue[0];
 useEffect(()=>{
  const old=previous.current;previous.current=clues;
  const appended=clues.length>old.length&&old.every((c,i)=>JSON.stringify(c)===JSON.stringify(clues[i]));
  if(appended)setQueue(q=>[...q,...clues.slice(old.length).map((clue,i)=>({clue,index:old.length+i,id:JSON.stringify([old.length+i,clue])}))]);
  else if(JSON.stringify(old)!==signature)setQueue([]);
 },[signature]);
 useEffect(()=>{
  if(!active)return;
  let cancelled=false;const animations:Animation[]=[];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{if(!cancelled)setQueue(q=>q.slice(1));};
  const timer=window.setTimeout(()=>{
   const card=flash.current,target=board.current?.querySelector<HTMLElement>(`[data-clue-index="${active.index}"]`);
   if(!card||!target){finish();return;}
   if(reduced){finish();return;}
   const from=card.getBoundingClientRect(),to=target.getBoundingClientRect();
   const dx=to.x+to.width/2-(from.x+from.width/2),dy=to.y+to.height/2-(from.y+from.height/2);
   animations.push(veil.current!.animate([{opacity:1},{opacity:0}],{duration:650,fill:'forwards'}));
   const flight=card.animate([{transform:'translate(-50%, -50%) scale(1)'},{transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${Math.min(to.width/from.width,to.height/from.height)})`}],{duration:700,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
   animations.push(flight);flight.onfinish=finish;
  },1600);
  return()=>{cancelled=true;clearTimeout(timer);animations.forEach(a=>a.cancel());};
 },[active?.id]);
 return <><div className="plan-clue-sets" ref={board}>{[1,2,3].map(stage=><section className="plan-clue-set" key={stage}><h3>Set {stage} <small>{wordThreshold(stage)}%</small></h3><div className="plan-clues">{clues.map((c,i)=>c.stage===stage&&<div data-clue-index={i} style={{visibility:queue.some(q=>q.index===i)?'hidden':undefined}} className={c.score>=wordThreshold(stage)?'qualifying-clue':''} key={i}><span>{c.word}</span><strong>{c.score}%</strong></div>)}</div></section>)}</div>{active&&<div className="plan-clue-reveal" aria-live="polite"><div className="plan-clue-veil" ref={veil}/><div key={active.id} ref={flash} className={`plan-clue-flash ${active.clue.score>=wordThreshold(active.clue.stage)?'is-qualified':''}`}><span>{active.clue.word}</span><strong>{active.clue.score}%</strong>{active.clue.score>=wordThreshold(active.clue.stage)&&<div className="plan-clue-sparkles" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--angle':`${i*30}deg`} as React.CSSProperties}>✦</i>)}</div>}</div></div>}</>;
}

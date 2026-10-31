import {BombWire} from './bomb-wire';
import React,{useEffect,useState} from 'react';
import type {View} from '../shared/model';
export function AudienceBomb({v,send,disabled=false}:{v:View;send?:(type:string,payload?:unknown)=>Promise<boolean>;disabled?:boolean}) {
 const bomb=v.current?.group?.puzzle?.audienceBomb;
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{setElapsed(0);const start=performance.now();const id=setInterval(()=>setElapsed(performance.now()-start),100);return()=>clearInterval(id);},[v.serverNow]);
 if(!bomb)return null;
 const locked=v.serverNow+elapsed<bomb.lockedUntil;
 return <section className="audience-bomb"><h2>Audience Bomb Defusal</h2><div className="audience-bomb-layout"><ol>{bomb.hints.map((hint,i)=><li key={i}>{hint}</li>)}</ol><div className={'wire-box'+(locked?' mistake-flash':'')}><h3>{bomb.defused?'DEFUSED':'AUDIENCE MODULE'}</h3>{bomb.items.map((item,i)=><button key={item} className={'wire wire-'+(['red','blue','yellow','green','purple','orange','white','pink','cyan'].indexOf(item.split(' ')[0].toLowerCase()))+(bomb.progress.includes(item)?' is-cut':'')} disabled={!send || disabled || locked || bomb.defused || bomb.progress.includes(item)} onClick={()=>void send?.('cut-audience-wire',{attemptId:v.current!.id,item})}><span className="wire-label">{item}</span><BombWire cut={bomb.progress.includes(item)}/><b>{bomb.progress.includes(item)?'CUT ✓':send?'Cut wire':''}</b></button>)}<p>Mistakes: {bomb.mistakes}{locked?' · Incorrect wire':''}</p></div></div></section>;
}

import React from 'react';
import type { ClueData, View } from '../shared/model';

export function QuoteList({clue, count = 1, showAll = false}: {clue: ClueData; count?: number; showAll?: boolean}) {
  if (showAll) return <div className="host-quote-preview">{clue.quotes?.map((_,i)=><section key={i} className={count===i+1 ? "current-quote" : ""}><QuoteList clue={clue} count={i+1}/></section>)}</div>;
  const quote = clue.quotes?.[count - 1];
  if (!quote) return null;
  return <div className="quote-list" aria-live="polite" aria-atomic="true"><blockquote key={count}><span className="quote-number">QUOTE {count}</span>{quote.text && <p>{quote.text}</p>}{quote.image && <img className="quote-image" src={quote.image} alt={quote.imageAlt || `Image for quote ${count}`}/>}{quote.source && <footer>{quote.source}</footer>}</blockquote></div>;
}

export function QuoteControls({v,send,disabled}: {v:View;send:(type:string,payload?:unknown)=>Promise<boolean>;disabled:boolean}) {
  const c=v.current;
  if(v.role!=='host' || !c || !v.boards[v.board][c.category].clues[c.row].quotes) return null;
  const count=c.quotesRevealed ?? 1;
  return <div className="host-clue-actions quote-controls"><strong>Quote {count} of 3</strong><button className="secondary" disabled={disabled || count<=1} onClick={()=>void send("previous-quote",{attemptId:c.id,revealed:count})}>Previous quote</button><button className="primary" disabled={disabled || count>=3} onClick={()=>void send('reveal-quote',{attemptId:c.id,revealed:count})}>{count<3 ? 'Next quote' : 'Final quote'}</button></div>;
}

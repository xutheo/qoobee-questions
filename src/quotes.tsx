import React from 'react';
import type { ClueData, View } from '../shared/model';

export function QuoteList({clue, count = 1}: {clue: ClueData; count?: number}) {
  const quote = clue.quotes?.[count - 1];
  if (!quote) return null;
  return <div className="quote-list" aria-live="polite" aria-atomic="true"><blockquote key={count}><span className="quote-number">QUOTE {count}</span>{quote.text && <p>{quote.text}</p>}{quote.image && <img className="quote-image" src={quote.image} alt={quote.imageAlt || `Image for quote ${count}`}/>}{quote.source && <footer>{quote.source}</footer>}</blockquote></div>;
}

export function QuoteControls({v,send,disabled}: {v:View;send:(type:string,payload?:unknown)=>Promise<boolean>;disabled:boolean}) {
  const c=v.current;
  if(v.role!=='host' || !c || !v.boards[v.board][c.category].clues[c.row].quotes) return null;
  const count=c.quotesRevealed ?? 1;
  return <div className="host-clue-actions quote-controls"><strong>Quote {count} of 3</strong><button className="primary" disabled={disabled || count>=3} onClick={()=>void send('reveal-quote',{attemptId:c.id,revealed:count})}>{count<3 ? 'Next quote' : 'Final quote'}</button></div>;
}

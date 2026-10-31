import React from 'react';
import { FitClue } from './fit-clue';
import { type View, money } from '../shared/model';

export function StreamFinal({ v }: { v: View }) {
  if (v.phase === 'finished') {
    const teams = [...v.teams].sort((a, b) => b.score - a.score);
    const winners = teams.filter(t => t.score === teams[0]?.score);
    return <section className="stream-final-results"><div className="final-confetti" aria-hidden="true">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${i * 2.5}%`, animationDelay: `${i % 8 * .17}s`, background: ['#ffd166', '#68ded2', '#e58ccc'][i % 3] }}/>)}</div><div className="winner-star" aria-hidden="true">★</div><p>{winners.length > 1 ? 'Joint winners' : 'Winner'}</p><h1>{winners.map(t => t.name).join(' & ')}</h1><ol>{teams.map(t => <li key={t.id} className={t.score === teams[0].score ? 'winner-row' : ''}><span>{teams.findIndex(other => other.score === t.score) + 1}</span><strong>{t.name}</strong><b>{money(t.score)}</b></li>)}</ol></section>;
  }
  const team = v.teams.find(t => t.id === v.finalPresentation?.teamId);
  const entry = team && v.finalEntries[team.id];
  return <section className="stream-question stream-final"><div className="stream-category">Final Jeopardy · {v.final.category}</div><FitClue>{v.phase === 'final-judge' ? team && entry ? <div className="final-team-reveal" key={team.id}><h1>{team.name}</h1><div className="final-reveal-value"><span>Answer</span><strong key={entry.answer}>{v.finalPresentation?.answers.includes(team.id) ? entry.answer || 'No answer submitted' : '•••'}</strong></div><div className="final-reveal-value"><span>Wager</span><strong key={entry.wager}>{v.finalPresentation?.wagers.includes(team.id) ? money(entry.wager ?? 0) : '•••'}</strong></div>{entry.judged && <div className={entry.correct ? 'success-text' : 'error-text'}>{entry.correct ? 'Correct' : 'Incorrect'} · {entry.correct ? '+' : '−'}{money(Math.abs(team.score - entry.score))} points</div>}<p>Team total: <b>{money(team.score)}</b></p></div> : <><h1>{v.final.prompt}</h1><p>Answers locked · Waiting for team reveals</p></> : v.phase === 'final-wager' ? <div className="final-wager-category"><p>Category</p><h1>{v.final.category}</h1><h2>Place your wagers</h2></div> : <h1>{v.final.prompt}</h1>}</FitClue></section>;
}

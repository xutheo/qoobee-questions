import { QuoteList } from './quotes';
import { ActivityTimer } from './presentation-controls';

import { PuzzleEditor, PuzzlePlayer, PuzzleResults } from './puzzles';

import { samplePuzzle, type Puzzle } from '../shared/puzzles';

import React, { useState } from 'react';

import { PixelImage } from './pixel-image';

import { BoostCelebration } from './boost';

import { money, points, type ClueData, type View } from '../shared/model';

type Props = { v: View; send: (type: string, payload?: unknown) => Promise<boolean>; disabled: boolean };

export function ClueImage({ clue, v }: { clue: ClueData; v?: View }) { if (clue.image && v?.current?.pixel) return <PixelImage src={clue.image} elapsedMs={v.current.pixel.elapsedMs} revealed={v.current.revealedAnswer}/>; return clue.image ? <img className="clue-image" src={clue.image} alt={clue.imageAlt || 'Question image'}/> : null; }

export function ClueOptions({ clue, update }: { clue: ClueData; update: (patch: Partial<ClueData>) => void }) {

  const [error, setError] = useState(''), [loading, setLoading] = useState(false);

  async function attach(file?: File, quoteIndex?: number) {

    if (!file) return; setError(''); setLoading(true);

    try {

      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP image under 8 MB.');

      const bitmap = await createImageBitmap(file);

      try {

        const canvas = document.createElement('canvas'); let edge = 1280, data = '';

        do { const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); data = canvas.toDataURL('image/webp', .8); edge *= .75; } while (data.length > 180000 && edge > 120);

        if (data.length > 180000) throw new Error('Image is too large. Choose a smaller image.');

        if (quoteIndex !== undefined) update({ quotes: clue.quotes!.map((q,i)=>i===quoteIndex?{...q,image:data}:q) });
        else update({ image: data });

      } finally { bitmap.close(); }

    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }

  }

  return <div className="clue-options"><label>Question type<select value={clue.quotes ? 'quotes' : clue.puzzle?.type || clue.kind || 'question'} onChange={e => update(e.target.value === 'quotes' ? { kind: 'question', boost: false, puzzle: undefined, prompt: clue.prompt || 'Who said it?', quotes: Array.from({length:3},()=>({text:'',source:''})) } : ['bomb','code','timeline','relay'].includes(e.target.value) ? { quotes: undefined, kind: 'group', groupMode: 'time', boost: false, linkLabel: e.target.value === 'bomb' ? 'Bomb defusal' : e.target.value === 'code' ? 'Codebreakers' : e.target.value === 'relay' ? 'Mental Math Relay' : 'Timelines', puzzle: samplePuzzle(e.target.value as Puzzle['type']) } : { quotes: undefined, kind: e.target.value as 'question' | 'group', boost: false, puzzle: undefined })}><option value="question">Question</option><option value="quotes">Who said it? — three quotes</option><option value="group">External group activity</option><option value="bomb">Bomb defusal</option><option value="code">Codebreakers</option><option value="timeline">Timelines</option><option value="relay">Mental Math Relay</option></select></label>{clue.quotes && <fieldset className="quote-editor"><legend>Quotes in reveal order</legend><p>Quote 1 appears automatically. Next quote replaces it with quote 2, then quote 3. Each quote can contain multiline text, an image, or both. Press Enter for a new line.</p>{clue.quotes.map((quote,i)=><div key={i}><label>Quote {i+1}<textarea rows={5} placeholder="Type or paste a quote. Press Enter for line breaks." maxLength={4000} value={quote.text} onChange={e=>update({quotes:clue.quotes!.map((q,j)=>j===i?{...q,text:e.target.value}:q)})}/></label><label>Image for quote {i+1}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={loading} onChange={e=>{void attach(e.target.files?.[0],i);e.target.value='';}}/></label>{quote.image && <><img className="quote-image" src={quote.image} alt={quote.imageAlt || `Quote ${i+1} preview`}/><label>Quote {i+1} image description<input maxLength={200} value={quote.imageAlt || ''} onChange={e=>update({quotes:clue.quotes!.map((q,j)=>j===i?{...q,imageAlt:e.target.value}:q)})}/></label><button type="button" className="secondary" onClick={()=>update({quotes:clue.quotes!.map((q,j)=>j===i?{...q,image:undefined,imageAlt:undefined}:q)})}>Remove quote {i+1} image</button></>}<label>Source / channel and timestamp<input maxLength={300} placeholder="#sanrio-thoughts · 12/17/2024, 8:37:20 PM" value={quote.source} onChange={e=>update({quotes:clue.quotes!.map((q,j)=>j===i?{...q,source:e.target.value}:q)})}/></label></div>)}</fieldset>}{clue.puzzle ? <PuzzleEditor clue={clue} update={update}/> : clue.kind === 'group' ? <><label>Activity name on board<input maxLength={80} value={clue.linkLabel || ''} onChange={e => update({ linkLabel: e.target.value })}/></label><label>Activity link (HTTPS)<input type="url" value={clue.link || ''} onChange={e => update({ link: e.target.value })}/></label><label>Result type<select value={clue.groupMode || 'time'} onChange={e => update({ groupMode: e.target.value as 'time' | 'score' })}><option value="time">Time — Finished button</option><option value="score">Score — text entry</option></select></label>{clue.groupMode === 'score' && <label>Leaderboard order<select value={clue.scoreOrder || 'higher'} onChange={e => update({ scoreOrder: e.target.value as 'higher' | 'lower' })}><option value="higher">Higher scores first</option><option value="lower">Lower scores first</option></select><small>Numbers and fractions (e.g. 4/6) are ranked. Other text stays unranked. Team points are still awarded by the host.</small></label>}</> : <label><input type="checkbox" disabled={!!clue.quotes} checked={!!clue.boost} onChange={e => update({ boost: e.target.checked })}/> Qoobee Boost (team wager)</label>}<label>Attach question image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={loading} onChange={e => { void attach(e.target.files?.[0]); e.target.value = ''; }}/></label>{loading && <p>Preparing image…</p>}{error && <p role="alert">{error}</p>}{clue.image && <><ClueImage clue={clue}/><label>Image description<input maxLength={200} value={clue.imageAlt || ''} onChange={e => update({ imageAlt: e.target.value })}/></label><button type="button" className="secondary" onClick={() => update({ image: undefined, imageAlt: undefined })}>Remove image</button></>}</div>;

}

function Award({ v, send, disabled, teamId }: Props & { teamId: string }) {

  const [amount, setAmount] = useState(String(points(v.board, v.current!.row)));

  const group = v.current!.group!, team = v.teams.find(t => t.id === teamId)!;

  const award = group.awards['team:' + teamId] || v.players.filter(p => p.teamId === teamId).map(p => group.awards[p.id]).find(Boolean);

  return <div className="team-award"><h3>{team.name}</h3>{award ? <><span>{money(award.points)} points awarded</span><button className="secondary" disabled={disabled || group.status !== 'review' || v.current!.state === 'resolved'} aria-label={'Undo points for ' + team.name} onClick={() => void send('undo-group-award', { attemptId: v.current!.id, teamId, entryId: award.entryId })}>Undo</button></> : <form className="activity-award" onSubmit={e => { e.preventDefault(); void send('award-group', { attemptId: v.current!.id, teamId, points: Number(amount), reason: 'Host-selected activity winner' }); }}><label>Points for {team.name}<input type="number" step="1" min="-1000000" max="1000000" required value={amount} onChange={e => setAmount(e.target.value)}/></label><button className="primary" disabled={disabled}>Award points to {team.name}</button></form>}</div>;

}

export function GroupActivity({ v, send, disabled }: Props) {

  const c = v.current!, group = c.group!, clue = v.boards[v.board][c.category].clues[c.row], host = v.role === 'host';

  const submissionKey = group.submissionScope === 'team' ? v.players.find(p=>p.id===v.playerId)?.teamId : v.playerId;
  const mine = submissionKey ? group.submissions[submissionKey] : undefined;

  const [score, setScore] = useState(mine?.score || '');

  const active = v.players.some(p => p.id === v.playerId && p.active), payload = { attemptId: c.id };

  const controls = <>{group.submissionScope === 'team' && <p>One shared answer per team. Any teammate can submit or update it until submissions close.</p>}{!group.teamAnswers && group.status !== 'ready' && <a className="button primary" href={clue.link} target="_blank" rel="noopener noreferrer">Open activity ↗</a>}{active && group.status === 'playing' && (group.mode === 'time' ? <button className="primary large" disabled={disabled || !!mine} onClick={() => void send('group-done', payload)}>Finished</button> : <form onSubmit={e => { e.preventDefault(); void send('submit-group', { ...payload, score }); }}><label>{group.teamAnswers ? (group.submissionScope === 'team' ? "Your team’s answer" : "Your answer") : "Your score"}<input maxLength={100} required value={score} onChange={e => setScore(e.target.value)} placeholder={group.teamAnswers ? "Enter your answer" : "e.g. 4/6"}/></label><button className="primary" disabled={disabled}>{group.teamAnswers ? (mine ? 'Update answer' : 'Submit answer') : (mine ? 'Update score' : 'Submit score')}</button></form>)}{mine && active && group.status === 'playing' && <button className="secondary" disabled={disabled} onClick={() => void send('unfinish-group', payload)}>Unfinish</button>}{mine && <p role="status">{group.submissionScope === 'team' ? 'Team answer: ' : 'Your result: '}{mine.seconds !== null ? mine.seconds.toFixed(2) + ' seconds' : mine.score}</p>}</>;

  if (v.role === 'player' && (clue.puzzle || group.puzzle)) return <PuzzlePlayer v={v} send={send} disabled={disabled}/>;

  if (v.role === 'player') return <section className="player-activity">{controls}</section>;

  return <section className="question-card activity-card"><ActivityTimer v={v}/><span className="eyebrow">GROUP PLAY · {group.mode === 'time' ? 'TIMED EVENT' : 'SCORE EVENT'}</span><h2>{clue.linkLabel || clue.prompt}</h2>{group.teamAnswers && host && <><details className="answer-box"><summary>Accepted answer (host only)</summary><p>{clue.answer}</p></details>{group.status === "review" && !c.revealedAnswer && <button className="secondary" disabled={disabled} onClick={() => void send("reveal")}>Reveal answer on streamed board</button>}</>}{clue.linkLabel && <p>{clue.prompt}</p>}<QuoteList clue={clue} count={c.quotesRevealed}/><ClueImage clue={clue}/>{clue.puzzle && <details className="answer-box"><summary>Host only · puzzle and private clues</summary><p>{clue.puzzle.message}</p><ol>{clue.puzzle.hints.map((hint,i) => <li key={i}>{hint}</li>)}</ol><p>Solution: {(clue.puzzle.type === 'code' ? clue.puzzle.answers : clue.puzzle.solution).join(' → ')}</p></details>}{!group.teamAnswers && !clue.puzzle && group.status !== 'ready' && <a className="button secondary" href={clue.link} target="_blank" rel="noopener noreferrer">Open activity ↗</a>}{host && <><div className="host-clue-actions">{group.status === 'ready' && <button className="primary" disabled={disabled} onClick={() => void send('start-group', payload)}>{clue.puzzle ? 'Broadcast clues & start' : 'Broadcast link & start'}</button>}{group.status === 'review' && c.state !== 'resolved' && <button className="secondary" disabled={disabled} onClick={() => void send('undo-end-group', payload)}>Undo end activity</button>}{group.status === 'playing' && <button className="primary" disabled={disabled} onClick={() => void send('lock-group', payload)}>{group.teamAnswers ? "Close submissions" : "End activity"}</button>}</div><>{group.puzzle && <PuzzleResults v={v}/>}</><div className="activity-results activity-team-groups">{v.teams.map(team => <section className="activity-team" key={team.id}><h3>{team.name}</h3>{group.puzzle?.teams[team.id] && clue.puzzle?.type !== 'relay' && <label>Team operator<select value={group.puzzle.teams[team.id].operator} disabled={disabled} onChange={e => void send('puzzle-operator', { attemptId: c.id, teamId: team.id, playerId: e.target.value })}>{v.players.filter(p => p.teamId === team.id && p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}{group.puzzle?.teams[team.id]?.relay && <div><p>Relay: {group.puzzle.teams[team.id].relay!.order.map(id => v.players.find(p => p.id === id)?.name).join(' → ')}</p><p>Final answer: {group.puzzle.teams[team.id].relay!.answer}</p></div>}{group.submissionScope === 'team' && <div className="activity-result"><strong>Team answer</strong><span>{group.submissions[team.id]?.score || 'Waiting for team answer'}</span></div>}{!group.puzzle && group.submissionScope !== 'team' && v.players.filter(p => p.teamId === team.id).map(p => { const result = group.submissions[p.id]; return <div className="activity-result" key={p.id}><strong>{p.name}</strong><span>{result ? result.seconds !== null ? result.seconds.toFixed(2) + ' seconds' : result.score : 'Waiting for result'}</span></div>; })}{group.status === 'review' && c.state !== 'resolved' && <Award v={v} send={send} disabled={disabled} teamId={team.id}/>}</section>)}</div>{c.state === 'resolved' && <button className="secondary" disabled={disabled} onClick={() => void send('unfinish-activity', payload)}>Unfinish activity</button>}{group.status !== 'playing' && <button className="secondary" disabled={disabled} onClick={() => void send(c.state === 'resolved' || group.status === 'review' ? 'return-board' : 'close-clue')}>{c.state === 'resolved' || group.status === 'review' ? 'Back to the board' : 'Cancel activity'}</button>}</>}</section>;

}

export function BoostClue({ v, send, disabled }: Props) {

  const c = v.current!, clue = v.boards[v.board][c.category].clues[c.row], host = v.role === 'host';

  const [teamId, setTeam] = useState(v.teams[0].id), [wager, setWager] = useState('0');

  const team = v.teams.find(t => t.id === (c.boost?.teamId || teamId))!;

  const representative = v.players.find(p => p.id === c.representatives[team.id]);

  return <section className="question-card activity-card"><BoostCelebration/><span className="eyebrow">TEAM WAGER</span><h2>Qoobee Boost</h2>{!c.boost && c.state !== 'resolved' ? <><p>Agree on a wager as a team. Your selected player answers alone.</p>{host && <form onSubmit={e => { e.preventDefault(); void send('start-boost', { attemptId: c.id, teamId, wager: Number(wager) }); }}><label>Wagering team<select value={teamId} onChange={e => setTeam(e.target.value)}>{v.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p>Selected player: <strong>{representative?.name || 'No selected player'}</strong></p><label>Agreed team wager (0–{money(Math.max(team.score, 1000))})<input required type="number" min="0" max={Math.max(team.score, 1000)} step="1" value={wager} onChange={e => setWager(e.target.value)}/></label><button className="primary" disabled={disabled || !representative || !v.online.includes(representative.id)}>Lock wager & reveal clue</button></form>}{!host && v.teams.map(t => <p key={t.id}>{t.name}: {v.players.find(p => p.id === c.representatives[t.id])?.name || 'No selected player'}</p>)}</> : <><p>{c.boost && `${team.name} · ${money(c.boost.wager)} points · ${representative?.name} answers`}</p><h3>{clue.prompt}</h3><ClueImage clue={clue}/>{(host || c.revealedAnswer) && <details className="answer-box" open={c.revealedAnswer || undefined}><summary>{host ? 'Show accepted answer' : 'The answer'}</summary><p>{clue.answer}</p></details>}{host && c.state === 'answering' && <div className="judge-buttons"><button className="correct" disabled={disabled} onClick={() => void send('judge', { buzzId: c.buzzId, correct: true })}>Correct</button><button className="incorrect" disabled={disabled} onClick={() => void send('judge', { buzzId: c.buzzId, correct: false })}>Incorrect</button></div>}</>}{host && <div className="host-clue-actions">{c.state === 'resolved' ? <><button className="primary" disabled={disabled} onClick={() => void send('return-board')}>Back to the board</button>{!c.revealedAnswer && <button className="secondary" disabled={disabled} onClick={() => void send('reveal')}>Reveal answer</button>}</> : <button className="secondary" disabled={disabled} onClick={() => void send('close-clue')}>Close clue and reveal answer</button>}{v.canUndo && <button className="secondary" disabled={disabled} onClick={() => void send('undo')}>Undo last ruling</button>}</div>}</section>;

}

export function FullscreenButton() {

  const [expanded, setExpanded] = useState(false);

  React.useEffect(() => { const changed = () => { if (!document.fullscreenElement) { setExpanded(false); document.body.classList.remove('stage-mode'); } }; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') changed(); }; document.addEventListener('fullscreenchange', changed); document.addEventListener('keydown', key); return () => { document.body.classList.remove('stage-mode'); document.removeEventListener('fullscreenchange', changed); document.removeEventListener('keydown', key); }; }, []);

  return <button className="secondary fullscreen-toggle" onClick={async () => { if (expanded) { if (document.fullscreenElement) await document.exitFullscreen(); document.body.classList.remove('stage-mode'); setExpanded(false); } else { try { await document.documentElement.requestFullscreen(); } catch { /* Expanded layout remains available on browsers without fullscreen. */ } document.body.classList.add('stage-mode'); setExpanded(true); } }}>{expanded ? 'Exit fullscreen' : 'Fullscreen'}</button>;

}


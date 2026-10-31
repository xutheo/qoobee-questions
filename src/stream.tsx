import {AudienceBomb} from './audience-bomb';
import { AudienceRelay } from './audience-relay';
import { ProgressivePrompt } from './progressive-prompt';
import { WelcomeIntro } from './welcome-intro';
import { TeamIconImage } from './team-icon';
import { TeamAnswerReveal } from './team-answer-reveal';
import { QuoteList } from './quotes';
import { StreamReactions } from './stream-reactions';
import { FitClue } from './fit-clue';
import { ScoreValue, ActivityTimer, StreamMusic } from './presentation-controls';
import { StreamFinal } from './stream-final';
import { GameInstructions, StreamIntro } from './intro';
import { puzzleInstructions } from '../shared/puzzles';
import { PuzzleResults, BombDemo } from './puzzles';
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { type View, money, points, activeTeamPlayer } from '../shared/model';
import { activityLeaders } from '../shared/leaderboard';
import { BoostCelebration } from './boost';
import { ClueImage, FullscreenButton } from './activities';
export function StreamDisplay({ v, connected }: { v: View; connected: boolean }) {
  const boardRef = useRef<HTMLDivElement>(null), questionRef = useRef<HTMLElement>(null);
  const tileBounds = useRef<Record<string, DOMRect>>({});
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const capture = () => { board.querySelectorAll<HTMLElement>('[data-tile]').forEach(tile => { tileBounds.current[tile.dataset.tile!] = tile.getBoundingClientRect(); }); };
    capture(); const observer = new ResizeObserver(capture); observer.observe(board);
    return () => observer.disconnect();
  }, [v.board, !!v.current, v.phase]);
  useLayoutEffect(() => {
    const panel = questionRef.current, current = v.current;
    if (!panel || !current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const origin = tileBounds.current[current.category + '-' + current.row], target = panel.getBoundingClientRect();
    const from = origin ? 'translate(' + (origin.x - target.x) + 'px,' + (origin.y - target.y) + 'px) scale(' + origin.width / target.width + ',' + origin.height / target.height + ')' : 'scale(.92)';
    const animation = panel.animate([{ transform: from, opacity: origin ? 1 : 0 }, { transform: 'none', opacity: 1 }], { duration: 1200, easing: 'cubic-bezier(.22,.7,.2,1)' });
    tileBounds.current = {};
    return () => animation.cancel();
  }, [v.current?.id]);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const start = performance.now(); setElapsed(0); const id = setInterval(() => setElapsed(performance.now() - start), 100); return () => clearInterval(id); }, [v]);
  const c = v.current, clue = c ? v.boards[v.board][c.category].clues[c.row] : null;
  const answeringPlayer = v.players.find(p => p.id === c?.winner);
  const answeringTeam = v.teams.find(t => t.id === answeringPlayer?.teamId);
  const leaderboard = !c?.group?.teamAnswers && c?.group?.status === 'review' && clue ? activityLeaders(c.group, clue, v.players) : null;
  const remaining = Math.max(0, (c?.remainingMs ?? 0) - (connected && !v.paused && !v.storageError && c?.state === 'restricted' ? elapsed : 0));
  const seconds = Math.ceil(remaining / 1000);
  return <main className={'stream-screen' + (v.phase === 'lobby' ? ' stream-lobby' : '')}><StreamReactions cue={v.soundCue} connected={connected}/><div className="stream-controls"><StreamMusic playing={!!v.musicPlaying && connected}/><FullscreenButton/></div>{(v.paused || v.storageError) && <div className="stream-pause-overlay" role="status" aria-live="polite"><div><span className="pause-symbol" aria-hidden="true"><i/><i/></span><strong>Paused</strong></div></div>}<div className="stream-content">{v.phase === 'lobby' ? <WelcomeIntro code={v.code}/> : v.phase === 'board' ? v.intermission ? <div className="stream-message intermission-slide"><h1>Intermission</h1><p>How was your day? Who has the best costume?</p></div> : c && clue ? <section className={"stream-question" + (clue.quotes ? " quote-question" : "")} ref={questionRef} key={c.id}><>{clue.boost && <BoostCelebration/>}</><div className="stream-category">{v.boards[v.board][c.category].title} · {c.example ? 'EXAMPLE · 1 POINT' : clue.boost ? 'Qoobee Boost' : money(points(v.board, c.row))}</div><FitClue><>{c.group?.teamAnswers && c.group.status === 'review' ? <TeamAnswerReveal v={v}/> : clue.puzzle && c.group ? c.group.status === 'ready' ? <div className="puzzle-instructions"><h1>{clue.linkLabel || (clue.puzzle.type === 'bomb' ? 'Bomb defusal' : clue.puzzle.type === 'code' ? 'Codebreakers' : clue.puzzle.type === 'relay' ? 'Mental Math Relay' : 'Timelines')}</h1><h2>How to play</h2><p>{clue.puzzle.instructions?.trim() || puzzleInstructions(clue.puzzle.type)}</p>{clue.puzzle.type === 'bomb' && <BombDemo/>}<strong>Waiting for the host to start</strong></div> : c.group.status === 'review' ? <PuzzleResults v={v}/> : c.group.puzzle?.audienceBomb ? <AudienceBomb v={v}/> : c.group.puzzle?.audienceRelay ? <AudienceRelay v={v}/> : <><h1>{clue.puzzle?.message || clue.prompt}</h1><p>Teams are solving the puzzle</p></> : leaderboard ? <div className="stream-leaderboard"><h1>{c.group!.mode === 'time' ? 'Top 5 times' : 'Top 5 scores'}</h1><p>{clue.linkLabel || clue.prompt}</p>{leaderboard.rows.length ? <ol>{leaderboard.rows.map(row => <li key={row.player.id}><span className="leader-place">{row.rank}</span><div><strong>{row.player.name}</strong><small>{v.teams.find(t => t.id === row.player.teamId)?.name}</small></div><b>{c.group!.mode === 'time' ? row.result.seconds!.toFixed(2) + ' s' : row.result.score}</b></li>)}</ol> : <p>No ranked results submitted.</p>}{leaderboard.unranked > 0 && <p className="unranked-note">{leaderboard.unranked} non-numeric result(s) — host review required.</p>}</div> : <><ProgressivePrompt v={v} connected={connected} text={clue.prompt || (clue.boost ? 'Qoobee Boost' : '')}/><QuoteList clue={clue} count={c.quotesRevealed}/><ClueImage clue={clue} v={v}/></>}</>{c.revealedAnswer && <div className="stream-answer">{clue.answer}</div>}</FitClue><div className="stream-clue-footer"><ActivityTimer v={v}/>{c.boost && <div className="stream-wager">{v.teams.find(t => t.id === c.boost!.teamId)?.name} · Wager: <strong>{money(c.boost.wager)} points</strong></div>}{c.winner && c.state === 'answering' && <div className="stream-buzz-winner"><TeamIconImage icon={answeringTeam?.icon}/><span>ANSWERING</span><strong>{answeringPlayer?.name}</strong><TeamIconImage icon={answeringTeam?.icon}/></div>}{!v.boards[v.board][c.category].openToAll && !c.group && !clue.boost && c.state !== 'resolved' && <div className="stream-countdown"><div className="stream-timer">{c.state === 'open' || c.state === 'answering' && c.previous === 'open' ? 'Open question' : seconds + ' seconds'}{(v.paused || c.state === 'answering') && <small> · Paused</small>}</div><div className="stream-timer-track" role="progressbar" aria-label="Question time remaining" aria-valuemin={0} aria-valuemax={15} aria-valuenow={seconds}><div style={{ width: Math.min(100, remaining / 150) + '%' }}/></div></div>}</div></section> : <div className="stream-board" style={{gridTemplateColumns:`repeat(${v.boards[v.board].length},minmax(0,1fr))`}} ref={boardRef}>{v.boards[v.board].map((category, i) => <section className={"stream-column" + (category.collectAnswers ? " team-submission-category" : category.openToAll ? " open-team-category" : category.teamBased ? " team-based-category" : "")} key={i}><h2>{v.introCategory == null || i < v.introCategory ? category.title : ''}</h2>{category.clues.map((q, r) => <div className={'stream-tile' + (v.introCategory != null && i >= v.introCategory ? ' intro-pending' : '') + (q.used ? ' played' : '') + (q.kind === 'group' ? ' activity-tile' : '')} key={r} data-tile={i + '-' + r}>{q.used || v.introCategory != null && i >= v.introCategory ? '' : money(points(v.board, r))}</div>)}</section>)}</div> : <StreamFinal v={v}/>}{v.instructionsVisible ? <section className="stream-instructions"><FitClue><GameInstructions rules={v.rules}/></FitClue></section> : !v.intermission && <StreamIntro v={v}/>}</div><footer className="stream-scores">{v.teams.map(t => <div key={t.id} className={v.phase === 'board' && v.selectorTeamId === t.id ? 'selecting-team' : ''}><div className="stream-team-total"><TeamIconImage icon={t.icon}/><span>{t.name}</span>{v.phase !== 'lobby' && <ScoreValue value={t.score}/>}<TeamIconImage icon={t.icon}/></div><ul className="stream-team-members">{v.players.filter(p => p.teamId === t.id).map(p => <li key={p.id} className={activeTeamPlayer(v, t.id) === p.id ? 'active-member' : ''}>{p.name}{activeTeamPlayer(v, t.id) === p.id && <b className="member-label">ACTIVE</b>}</li>)}</ul></div>)}</footer></main>;
}

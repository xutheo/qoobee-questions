import { TeamIconPicker } from './team-icon';
import React, { useEffect } from 'react';
import { activeTeamPlayer, type View } from '../shared/model';
import { GroupActivity } from './activities';
type Props = { v: View; send: (type: string, payload?: unknown) => Promise<boolean>; disabled: boolean };
export function PlayerControls({ v, send, disabled }: Props) {
  const c = v.current, me = v.players.find(p => p.id === v.playerId);
  const boost = c && v.boards[v.board][c.category].clues[c.row].boost;
  const eligible = !!me?.active && !!c && !c.group && !boost && !c.lockedTeams.includes(me.teamId) && (c.state === 'open' || c.state === 'restricted' && c.representatives[me.teamId] === me.id);
  const buzz = () => { if (!disabled && eligible && c) void send('buzz', { attemptId: c.id }); };
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat && e.target === document.body) { e.preventDefault(); buzz(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [eligible, disabled, c?.id]);
  if (c?.group && c.group.status !== 'review' && c.state !== 'resolved') return <GroupActivity key={c.id} v={v} send={send} disabled={disabled}/>;
  const label = disabled ? v.paused ? 'PAUSED' : 'CONNECTING' : c?.state === 'answering' && c.winner === me?.id ? 'YOUR ANSWER' : eligible ? 'BUZZ IN' : v.phase === 'lobby' ? 'WAITING FOR HOST' : 'STAND BY';
  return <div className="player-buzzer"><button className={`buzzer ${eligible ? 'ready' : ''}`} disabled={disabled || !eligible} onClick={buzz}><span>ϟ</span>{label}</button></div>;
}
export function PlayerTeam({ v, send, disabled }: Props) {
  const me = v.players.find(p => p.id === v.playerId), team = v.teams.find(t => t.id === me?.teamId);
  if (!team) return null;
  return <section className="my-team-panel"><h2>Your team: {team.name}</h2><TeamIconPicker v={v} send={send} disabled={disabled}/><p>Captain: {v.players.find(p=>p.id===team.captain)?.name || 'Not selected'}</p>{v.phase==='lobby' && me?.active && team.captain===me.id && <label>Choose team captain<select aria-label="Choose team captain" value={team.captain || ''} disabled={disabled} onChange={e=>void send('captain',{teamId:team.id,playerId:e.target.value})}><option value="" disabled>Select a teammate</option>{v.players.filter(p=>p.teamId===team.id && p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}{v.phase === 'board' && !v.current && v.selectorTeamId === team.id && <p>{activeTeamPlayer(v, team.id) === me?.id ? "You select the next question." : `${v.players.find(p => p.id === activeTeamPlayer(v, team.id))?.name || "Your active teammate"} selects the next question.`}</p>}<ul>{v.players.filter(p => p.teamId === team.id).map(p => <li key={p.id} className={activeTeamPlayer(v, team.id) === p.id ? 'active-member' : ''}>{p.name}{activeTeamPlayer(v, team.id) === p.id && <b className="member-label">ACTIVE</b>}{p.id === me?.id ? ' (you)' : ''}{!v.online.includes(p.id) ? ' · offline' : ''}</li>)}</ul>{v.phase === 'lobby' && <label>Switch team<select value={team.id} disabled={disabled} onChange={e => void send('choose-team', { teamId: e.target.value })}>{v.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</section>;
}

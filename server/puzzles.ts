import { makeRelay, fixedRelay } from './relay';
import { randomInt } from 'node:crypto';
import { recolor, teamColors } from './bomb-colors';
import { createHash } from 'node:crypto';
import type { Game, Player, View, Actor } from '../shared/model';
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function startPuzzle(g: Game, representatives: Record<string,string>) {
  const c = g.current!, group = c.group!, config = (c.exampleClue ?? g.boards[g.board][c.category].clues[c.row]).puzzle!;
  group.puzzle = { teams: {} };
  const usedColors = new Set<string>();
  for (const team of g.teams) {
    const members = g.players.filter(p => p.teamId === team.id && p.active);
    if (!members.length) continue;
    check(representatives[team.id], 'Each participating team needs a connected operator.');
    const assignments: Record<string,string[]> = Object.fromEntries(members.map(p => [p.id, []]));
    if (config.type === 'relay') {
      const order = members.map(p => p.id);
      for(let i=order.length-1;i>0;i--){const j=randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];}
      const membersInOrder = [...order];
      while (order.length < 4) order.push(membersInOrder[order.length % membersInOrder.length]);
      const generated = c.example ? fixedRelay(order.map((_,i)=>i===0?'2 + 3':['__ + 2','__ − 1','__ + 3','__ − 2'][(i-1)%4])) : config.relayExpressions && order.length === 4 && Object.keys(group.puzzle.teams).length === 0 ? fixedRelay(config.relayExpressions) : makeRelay(order.length, Object.keys(group.puzzle.teams).length, config.relayDifficulty || 2, config.relayOperations || ['multiply','subtract','divide','add']);
      order.forEach((id,i) => assignments[id].push(generated.expressions[i]));
      group.puzzle.teams[team.id] = { operator: order[order.length-1], assignments, relay: {order,answer:generated.answer}, mistakes:0,progress:[],finishedMs:null,lockedUntil:0 };
      continue;
    }
    const colors = config.type === 'bomb' ? teamColors(config.items, usedColors) : undefined;
    const clues = config.type === 'timeline' ? config.items.map((item,i) => item + ': ' + config.hints[i]) : config.hints.map(hint => colors ? recolor(hint, colors) : hint);
    // Everyone, including the operator, gets a clue; share clues when players outnumber them.
    for (let i=0; i<Math.max(clues.length,members.length); i++) assignments[members[i % members.length].id].push(clues[i % clues.length]);
    group.puzzle.teams[team.id] = { colors, operator: representatives[team.id], assignments, mistakes: 0, progress: [], finishedMs: null, lockedUntil: 0 };
  }
}
export function submitPuzzle(g: Game, player: Player | undefined, p: any) {
  const c = g.current, group = c?.group, config = c && (c.exampleClue ?? g.boards[g.board][c.category].clues[c.row]).puzzle;
  check(player && group?.puzzle && config && group.status === 'playing' && c?.state !== 'resolved' && p.attemptId === c?.id, 'This puzzle is not accepting answers.');
  const team = group.puzzle.teams[player.teamId];
  check(team && team.operator === player.id, 'Only your team operator can submit.');
  check(team.finishedMs === null, 'Your team has already finished.');
  check(group.elapsedMs >= team.lockedUntil, config.type === 'bomb' ? 'Wait one second after a wrong cut.' : 'Your team is locked out for 10 seconds after an incorrect answer.');
  let correct = false;
  if (config.type === 'bomb') {
    const item = config.items.find(item => recolor(item, team.colors || {}) === p.item);
    check(typeof p.item === 'string' && item && !team.progress.includes(item), 'Choose an uncut wire.');
    correct = item === config.solution[team.progress.length];
    if (correct) team.progress.push(item);
  } else if (config.type === 'relay') {
    check(typeof p.answer === 'string' && p.answer.trim().length > 0 && p.answer.length <= 100 && Number.isFinite(Number(p.answer)), 'Enter a numeric answer.');
    correct = Number(p.answer) === team.relay?.answer;
  } else if (config.type === 'code') {
    check(typeof p.answer === 'string' && p.answer.trim().length > 0 && p.answer.length <= 500, 'Enter an answer up to 500 characters.');
    const normalize = (s: string) => s.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
    correct = config.answers.some(a => normalize(a) === normalize(p.answer));
  } else {
    check(Array.isArray(p.order) && p.order.length === config.items.length && new Set(p.order).size === p.order.length && p.order.every((i: unknown) => typeof i === 'string' && config.items.includes(i)), 'Submit every event exactly once.');
    correct = p.order.every((item: string,i: number) => item === config.solution[i]);
  }
  if (!correct) { team.mistakes++; if (config.type === 'timeline' || config.type === 'bomb') team.lockedUntil = group.elapsedMs + (config.type === 'bomb' ? 1000 : 10000); }
  else if (config.type !== 'bomb' || team.progress.length === config.solution.length) team.finishedMs = group.elapsedMs;
}
export function redactPuzzle(view: View, actor: Actor) {
  if (actor.role === 'host') return;
  const c = view.current, ownTeam = view.players.find(p => p.id === actor.playerId)?.teamId;
  for (let b=0;b<2;b++) for (let i=0;i<view.boards[b].length;i++) for(let r=0;r<5;r++) {
    const q = view.boards[b][i].clues[r]; if (!q.puzzle) continue;
    if (b !== view.board || i !== c?.category || r !== c.row) { delete q.puzzle; continue; }
    const own = ownTeam && c.group?.puzzle?.teams[ownTeam];
    if (q.puzzle.type === 'bomb' && own && own.colors) { q.puzzle.items = q.puzzle.items.map(item => recolor(item, own.colors!)); q.puzzle.message = recolor(q.puzzle.message, own.colors); }
    q.puzzle.items.sort((a,b) => createHash('sha256').update(c.id + a).digest('hex').localeCompare(createHash('sha256').update(c.id + b).digest('hex')));
    if (c.group?.status === 'ready') { q.puzzle.message = ''; q.prompt = ''; delete q.image; delete q.imageAlt; }
    delete q.puzzle.relayExpressions;
    q.puzzle.answers = []; q.puzzle.solution = []; q.puzzle.hints = [];
    const team = ownTeam && c.group?.puzzle?.teams[ownTeam];
    if (!team || team.operator !== actor.playerId) q.puzzle.items = [];
  }
  if (c?.group?.puzzle) for (const [id,team] of Object.entries(c.group.puzzle.teams)) {
    team.assignments = id === ownTeam && actor.playerId ? { [actor.playerId]: team.assignments[actor.playerId] || [] } : {};
    if (id !== ownTeam) team.progress = [];
    else if (team.colors) team.progress = team.progress.map(item => recolor(item, team.colors!));
    delete team.colors;
    if (team.relay) { delete team.relay.answer; if(id !== ownTeam) delete team.relay; }
  }
}

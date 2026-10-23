import { gameSchema } from '../shared/model';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { applyCommand, newGame, publicView, selectRepresentatives, hash, pause, fillMissingRepresentatives } from '../server/game.js';
import { sampleContent } from '../shared/sample.js';
import type { Actor, Game } from '../shared/model.js';

const host: Actor = { role: 'host' };
function fixture(size = 3) {
  const g = newGame('host-secret'); g.teams = g.teams.slice(0,2); Object.assign(g, sampleContent());
  for (let t = 0; t < 2; t++) for (let i = 0; i < size; i++) g.players.push({ id: `p${t}-${i}`, name: `Player ${t}-${i}`, teamId: g.teams[t].id, tokenHash: hash(`token${t}-${i}`), active: true, selections: 0 });
  for (const t of g.teams) t.captain = g.players.find(p => p.teamId === t.id)!.id;
  const online = new Set(g.players.map(p => p.id));
  const command = (type: string, payload = {}, at = 0, actor = host, id = randomUUID()) => applyCommand(g, actor, { id, type, payload }, at, online);
  command('start'); return { g, online, command };
}
function open(f: ReturnType<typeof fixture>) { f.command('open-clue', { category: 0, row: 0 }, 1000); }
function representative(g: Game, team = 0): Actor { return { role: 'player', playerId: g.current!.representatives[g.teams[team].id] }; }

test('stable rosters get one turn per cycle and no immediate cycle-boundary repeat', () => {
  const { g, online } = fixture(5);
  let previous: Record<string, string> = {};
  for (let cycle = 0; cycle < 12; cycle++) {
    const seen = new Map(g.teams.map(t => [t.id, new Set<string>()]));
    for (let turn = 0; turn < 5; turn++) { const reps = cycle === 0 && turn === 0 ? g.nextRepresentatives! : selectRepresentatives(g, online); for (const t of g.teams) { assert.ok(!seen.get(t.id)!.has(reps[t.id])); seen.get(t.id)!.add(reps[t.id]); if (cycle > 0 && turn === 0) assert.notEqual(reps[t.id], previous[t.id]); } previous = reps; }
  }
  assert.ok(g.players.every(p => p.selections === 12));
});
test('absent players retain an owed turn and do not block connected teammates', () => {
  const { g, online } = fixture(2); const [a, b] = g.players;
  g.teams[0].queue = [a.id, b.id]; online.delete(a.id);
  assert.equal(selectRepresentatives(g, online)[a.teamId], b.id);
  assert.equal(selectRepresentatives(g, online)[a.teamId], b.id);
  online.add(a.id); assert.equal(selectRepresentatives(g, online)[a.teamId], a.id);
});
test('nonrepresentatives cannot buzz before deadline, but can at the exact deadline', () => {
  const f = fixture(); open(f); const g = f.g;
  const p = g.players.find(p => p.teamId === g.teams[0].id && p.id !== representative(g).playerId)!;
  assert.throws(() => f.command('buzz', { attemptId: g.current!.id }, 10999, { role: 'player', playerId: p.id }), /representing/);
  f.command('buzz', { attemptId: g.current!.id }, 11000, { role: 'player', playerId: p.id });
  assert.equal(g.current!.winner, p.id); assert.equal(g.current!.previous, 'open');
});
test('first valid buzz wins and pauses time; wrong answer resumes exact remainder and locks team', () => {
  const f = fixture(); open(f); const g = f.g;
  const a = representative(g), b = representative(g, 1);
  f.command('buzz', { attemptId: g.current!.id }, 8000, a);
  assert.equal(g.current!.remainingMs, 3000);
  assert.throws(() => f.command('buzz', { attemptId: g.current!.id }, 8001, b), /not available/);
  f.command('judge', { buzzId: g.current!.buzzId, correct: false }, 16000);
  assert.equal(g.teams[0].score, -100); assert.equal(g.current!.deadline, 19000);
  assert.throws(() => f.command('buzz', { attemptId: g.current!.id }, 17000, a), /already answered/);
  f.command('buzz', { attemptId: g.current!.id }, 18000, b);
  f.command('judge', { buzzId: g.current!.buzzId, correct: true }, 25000);
  assert.equal(g.current!.state, 'resolved'); assert.equal(g.teams[1].score, 100);
});
test('retrying committed ruling changes score only once', () => {
  const f = fixture(); open(f); const g = f.g;
  f.command('buzz', { attemptId: g.current!.id }, 2000, representative(g));
  const id = randomUUID(), payload = { buzzId: g.current!.buzzId, correct: true };
  assert.equal(f.command('judge', payload, 3000, host, id), true);
  assert.equal(f.command('judge', payload, 4000, host, id), false);
  assert.equal(g.teams[0].score, 100); assert.equal(g.ledger.length, 1);
});
test('undo restores answer opportunity and creates a compensating ledger entry', () => {
  const f = fixture(); open(f); const g = f.g;
  f.command('buzz', { attemptId: g.current!.id }, 6000, representative(g)); const winner = g.current!.winner;
  f.command('judge', { buzzId: g.current!.buzzId, correct: false }, 12000);
  f.command('undo', {}, 14000);
  assert.equal(g.teams[0].score, 0); assert.equal(g.current!.state, 'answering'); assert.equal(g.current!.winner, winner); assert.equal(g.current!.remainingMs, 5000); assert.equal(g.ledger.length, 2);
});
test('pause and resume preserve timer; unauthorized host commands fail', () => {
  const f = fixture(); open(f); const g = f.g;
  assert.throws(() => f.command('close-clue', {}, 1000, representative(g)), /Only the host/);
  f.command('pause', {}, 9000); assert.equal(g.current!.remainingMs, 2000);
  assert.throws(() => f.command('buzz', { attemptId: g.current!.id }, 10000, representative(g)), /paused/);
  f.command('resume', {}, 100000); assert.equal(g.current!.deadline, 102000);
});
test('player snapshots omit private answers, credentials, rotation queues, and command history', () => {
  const f = fixture(); open(f); const view = publicView(f.g, representative(f.g), f.online, 5000, null);
  assert.equal(view.current!.remainingMs, 6000);
  assert.equal(view.boards[0][0].clues[0].answer, ''); assert.equal(view.boards[0][0].clues[1].prompt, ''); assert.equal(view.final.answer, '');
  const json = JSON.stringify(view); assert.ok(!json.includes('tokenHash')); assert.ok(!json.includes('hostHash')); assert.ok(!json.includes('processed')); assert.ok(!json.includes('queue'));
});
test('Final Jeopardy validates wagers, keeps them private, waits for host closure and applies each score once', () => {
  const f = fixture(1), g = f.g;
  f.command('adjust-score', { teamId: g.teams[0].id, amount: 500, reason: 'Fixture' });
  f.command('advance-board', { skip: true }); f.command('end-intermission'); f.command('advance-board', { skip: true });
  const a: Actor = { role: 'player', playerId: g.teams[0].captain! }, b: Actor = { role: 'player', playerId: g.teams[1].captain! };
  assert.throws(() => f.command('wager', { amount: 2001 }, 0, a), /Wager/);
  f.command('wager', { amount: 2000 }, 0, a); assert.equal(g.finalEntries[g.teams[0].id].wager, 2000);
  f.command('wager', { amount: 400 }, 0, a); f.command('wager', { amount: 0 }, 0, b);
  assert.equal(publicView(g, b, f.online, 0, null).finalEntries[g.teams[0].id].wager, null);
  assert.equal(publicView(g, host, f.online, 0, null).finalEntries[g.teams[0].id].wager, null);
  f.command('lock-wagers', {}, 1000); f.command('final-answer', { answer: 'Africa' }, 10000, a);
  f.command('final-answer', { answer: 'Still open' }, 31000, b); assert.equal(g.finalDeadline,null); f.command('lock-answers',{},31500);
  f.command('judge-final', { teamId: g.teams[0].id, correct: true }, 32000);
  assert.equal(g.teams[0].score, 900);
  assert.throws(() => f.command('judge-final', { teamId: g.teams[0].id, correct: true }, 32000), /already judged/);
  f.command('judge-final', { teamId: g.teams[1].id, correct: false }, 33000); assert.equal(g.phase, 'final-judge'); f.command('finish-final'); assert.equal(g.phase, 'finished');
});
test('recovery pause preserves an accepted buzz and representative rotation', () => {
  const f = fixture(); open(f); f.command('buzz', { attemptId: f.g.current!.id }, 5000, representative(f.g));
  const before = structuredClone(f.g.current); pause(f.g, 500000, 'Recovery');
  assert.deepEqual(f.g.current, before); assert.equal(f.g.paused, true);
});

test('Qoobee Boost keeps the selected representative, hides images until wager, and ends on either ruling', () => {
  const f = fixture(), { g, command } = f;
  Object.assign(g.boards[0][0].clues[0], { boost: true, image: 'data:image/png;base64,aGVsbG8=' });
  command('open-clue', { category: 0, row: 0 });
  const selected = g.current!.representatives[g.teams[0].id], counts = g.players.map(p => p.selections);
  const spectator: Actor = { role: 'display' };
  assert.equal(publicView(g, spectator, f.online, 0, null).boards[0][0].clues[0].image, undefined);
  assert.equal(publicView(g, spectator, f.online, 0, null).boards[0][0].clues[0].prompt, '');
  assert.throws(() => command('start-timer'), /not ready/);
  assert.throws(() => command('start-boost', { attemptId: g.current!.id, teamId: g.teams[0].id, wager: 1001 }), /Wager/);
  command('start-boost', { attemptId: g.current!.id, teamId: g.teams[0].id, wager: 500 });
  assert.equal(g.current!.winner, selected); assert.deepEqual(g.players.map(p => p.selections), counts);
  assert.ok(publicView(g, spectator, f.online, 0, null).boards[0][0].clues[0].image);
  command('judge', { buzzId: g.current!.buzzId, correct: false });
  assert.equal(g.teams[0].score, -500); assert.equal(g.current!.state, 'resolved');
  command('undo'); assert.equal(g.current!.winner, selected); assert.equal(g.teams[0].score, 0);
  command('judge', { buzzId: g.current!.buzzId, correct: true }); assert.equal(g.teams[0].score, 500);
});

test('group completion uses server elapsed time excluding pauses; submissions and awards are protected', () => {
  const f = fixture(), { g, command } = f;
  Object.assign(g.boards[0][0].clues[0], { kind: 'group', link: 'https://example.com/puzzle', groupMode: 'time' });
  command('open-clue', { category: 0, row: 0 }); const attemptId = g.current!.id, player: Actor = { role: 'player', playerId: g.players[0].id };
  assert.equal(g.players.reduce((sum, p) => sum + p.selections, 0), g.teams.length);
  assert.equal(publicView(g, player, f.online, 0, null).boards[0][0].clues[0].link, '');
  command('start-group', { attemptId }, 1000);
  assert.equal(publicView(g, player, f.online, 1000, null).boards[0][0].clues[0].link, 'https://example.com/puzzle');
  command('pause', {}, 4000); command('resume', {}, 14000);
  command('group-done', { attemptId, seconds: 0 }, 17000, player);
  assert.equal(g.current!.group!.submissions[player.playerId!].seconds, 6);
  assert.throws(() => command('group-done', { attemptId }, 18000, player), /already/);
  assert.deepEqual(publicView(g, { role: 'display' }, f.online, 18000, null).current!.group!.submissions, {});
  assert.throws(() => command('award-group', { attemptId, playerId: player.playerId, points: 200, reason: 'Winner' }, 18000, player), /Only the host/);
  command('lock-group', { attemptId }, 18000);
  assert.equal(Object.keys(publicView(g, { role: 'display' }, f.online, 18000, null).current!.group!.submissions).length, 1);
  assert.deepEqual(publicView(g, { role: 'player', playerId: g.players[1].id }, f.online, 18000, null).current!.group!.submissions, {});
  const award = { attemptId, teamId: g.teams[0].id, points: 200, reason: 'Winner' };
  command('award-group', award, 19000); assert.equal(g.teams[0].score, 200);
  assert.throws(() => command('award-group', award, 20000), /already/);
  assert.throws(() => command('group-done', { attemptId }, 20000, { role: 'player', playerId: g.players[1].id }), /not accepting/);
});

test('group score is free text, editable until review and not automatically scored', () => {
  const { g, command } = fixture(); Object.assign(g.boards[0][0].clues[0], { kind: 'group', groupMode: 'score', link: 'https://example.com/puzzle' });
  command('open-clue', { category: 0, row: 0 }); const attemptId = g.current!.id, actor: Actor = { role: 'player', playerId: g.players[0].id };
  command('start-group', { attemptId });
  command('submit-group', { attemptId, score: '4/6' }, 1000, actor);
  command('submit-group', { attemptId, score: '3/6' }, 2000, actor);
  assert.equal(g.current!.group!.submissions[actor.playerId!].score, '3/6'); assert.equal(g.teams[0].score, 0);
  assert.throws(() => command('group-done', { attemptId }, 2000, actor), /not accepting/);
  command('lock-group', { attemptId }, 3000);
  assert.throws(() => command('submit-group', { attemptId, score: '1/6' }, 4000, actor), /closed/);
});

test('automatic countdown, answer reveal and board progression preserve final answer review', () => {
  const f = fixture(1), { g, command } = f;
  command('open-clue', { category: 0, row: 0 }, 2500);
  assert.equal(g.current!.state, 'restricted'); assert.equal(g.current!.deadline, 12500);
  command('buzz', { attemptId: g.current!.id }, 3000, representative(g));
  command('judge', { buzzId: g.current!.buzzId, correct: true }, 3500);
  assert.equal(g.current!.revealedAnswer, true);
  for (const cat of g.boards[0]) for (const q of cat.clues) q.used = true;
  assert.equal(g.board, 0); // The answer remains visible until dismissed.
  command('return-board', {}, 4000); assert.equal(g.board, 1); assert.equal(g.current, null);
  command('end-intermission',{},4500); command('open-clue', { category: 0, row: 0 }, 5000); command('close-clue', {}, 5500);
  for (const cat of g.boards[1]) for (const q of cat.clues) q.used = true;
  command('return-board', {}, 6000); assert.equal(g.phase, 'final-wager'); assert.equal(Object.keys(g.finalEntries).length, 2);
});

test('reconnecting fills an empty representative slot once and preserves already selected players', () => {
  const f = fixture(1), { g, online, command } = f;
  const returning = g.players[1]; online.delete(returning.id); delete g.nextRepresentatives![returning.teamId]; returning.selections = 0;
  command('open-clue', { category: 0, row: 0 }, 1000);
  assert.equal(g.current!.representatives[returning.teamId], undefined);
  const original = g.current!.representatives[g.teams[0].id]; online.add(returning.id);
  assert.equal(fillMissingRepresentatives(g, online), true);
  assert.equal(g.current!.representatives[returning.teamId], returning.id);
  assert.equal(g.current!.representatives[g.teams[0].id], original);
  assert.equal(fillMissingRepresentatives(g, online), false); assert.equal(returning.selections, 1);
  command('buzz', { attemptId: g.current!.id }, 2000, { role: 'player', playerId: returning.id });
  assert.equal(g.current!.winner, returning.id);
});

test('group awards can go directly to a team and cannot be repeated for a teammate', () => {
  const { g, command } = fixture(); Object.assign(g.boards[0][0].clues[0], { kind: 'group', groupMode: 'time', link: 'https://example.com' });
  command('open-clue', { category: 0, row: 0 }); const attemptId = g.current!.id;
  command('start-group', { attemptId }); command('lock-group', { attemptId }, 2000);
  command('award-group', { attemptId, teamId: g.teams[1].id, points: 300, reason: 'Winner' }, 3000);
  assert.equal(g.teams[1].score, 300); assert.equal(g.ledger.at(-1)!.playerId, undefined);
  assert.throws(() => command('award-group', { attemptId, teamId: g.teams[1].id, points: 300, reason: 'Winner' }, 4000), /already/);
});

test('Boost allows the higher of 1000 or the team score and subtracts the full lost wager', () => {
  for (const [starting, wager, ending] of [[100, 1000, -900], [2000, 2000, 0], [-200, 1000, -1200]]) {
    const { g, command } = fixture(1);
    command('adjust-score', { teamId: g.teams[0].id, amount: starting, reason: 'Starting score' });
    g.boards[0][0].clues[0].boost = true;
    command('open-clue', { category: 0, row: 0 });
    const payload = { attemptId: g.current!.id, teamId: g.teams[0].id, wager };
    assert.throws(() => command('start-boost', { ...payload, wager: wager + 1 }), /Wager/);
    command('start-boost', payload);
    command('judge', { buzzId: g.current!.buzzId, correct: false });
    assert.equal(g.teams[0].score, ending);
  }
});

test('removing a lobby team randomly redistributes its players and preserves a valid roster', () => {
  const f = fixture(3), { g, command } = f; g.phase = 'lobby';
  command('add-team', { name: 'Remove me' }); const removed = g.teams[2];
  for (const p of g.players) p.teamId = removed.id;
  for (const t of g.teams) { t.queue = []; t.captain = null; }
  command('remove-team', { teamId: removed.id });
  assert.equal(g.teams.length, 2); assert.ok(g.players.every(p => g.teams.some(t => t.id === p.teamId)));
  assert.throws(() => command('remove-team', { teamId: g.teams[0].id }), /two teams/);
  g.phase = 'board'; assert.throws(() => command('remove-team', { teamId: g.teams[0].id }), /before/);
});

test('empty teams disappear from live views and cannot block Final Jeopardy', () => {
  const { g, command, online } = fixture(1); g.phase = 'lobby'; command('add-team', { name: 'Empty' });
  assert.equal(publicView(g, host, online, 0, null).teams.length, 3);
  command('start'); assert.equal(publicView(g, host, online, 0, null).teams.length, 2);
  assert.equal(publicView(g, { role: 'display' }, online, 0, null).teams.length, 2);
  command('advance-board', { skip: true }); command('end-intermission'); command('advance-board', { skip: true });
  assert.equal(g.finalEntries[g.teams[2].id].wager, 0); assert.equal(g.finalEntries[g.teams[2].id].judged, true);
});

test('unfinish activity restores scoring review without clearing results or duplicating awards', () => {
  const { g, command } = fixture(1); Object.assign(g.boards[0][0].clues[0], { kind: 'group', groupMode: 'time', link: 'https://example.com' });
  command('open-clue', { category: 0, row: 0 }); const attemptId = g.current!.id;
  command('start-group', { attemptId }); command('group-done', { attemptId }, 2000, { role: 'player', playerId: g.players[0].id });
  command('lock-group', { attemptId }, 3000);
  const award = { attemptId, teamId: g.teams[0].id, points: 100, reason: 'Winner' };
  command('award-group', award, 4000); command('close-clue', {}, 5000);
  command('unfinish-activity', { attemptId }, 6000);
  assert.equal(g.current!.state, 'revealed'); assert.equal(g.current!.group!.status, 'review');
  assert.equal(g.current!.group!.submissions[g.players[0].id].seconds, 2); assert.equal(g.teams[0].score, 100);
  assert.throws(() => command('award-group', award, 7000), /already/);
});

test('closing a question reveals its answer without awarding or subtracting points', () => {
  const { g, command, online } = fixture(1);
  command('open-clue', { category: 0, row: 0 });
  command('close-clue', {}, 1000);
  assert.equal(g.current!.state, 'resolved'); assert.equal(g.current!.revealedAnswer, true);
  assert.equal(g.current!.deadline, null); assert.equal(g.ledger.length, 0);
  assert.equal(publicView(g, { role: 'display' }, online, 1000, null).boards[0][0].clues[0].answer, 'Paris');
});

test('selector is a participating team initially, changes on correct answers and is restored by undo', () => {
  const { g, command } = fixture(1); const initial = g.selectorTeamId;
  assert.ok(g.teams.some(t => t.id === initial));
  const other = g.teams.findIndex(t => t.id !== initial);
  command('open-clue', { category: 0, row: 0 });
  command('buzz', { attemptId: g.current!.id }, 1000, representative(g, other));
  command('judge', { buzzId: g.current!.buzzId, correct: true }, 2000);
  assert.equal(g.selectorTeamId, g.teams[other].id);
  command('undo', {}, 3000); assert.equal(g.selectorTeamId, initial);
  command('judge', { buzzId: g.current!.buzzId, correct: false }, 4000); assert.equal(g.selectorTeamId, initial);
});

test('reset requires host confirmation, retains content and identities, clears all game progress', () => {
  const { g, command } = fixture(1);
  const ids = g.players.map(p => [p.id, p.teamId, p.tokenHash]); const question = g.boards[0][0].clues[0].prompt;
  command('open-clue', { category: 0, row: 0 });
  command('buzz', { attemptId: g.current!.id }, 1000, representative(g));
  command('judge', { buzzId: g.current!.buzzId, correct: true }, 2000);
  assert.throws(() => command('reset-game', { confirm: true }, 3000, { role: 'player', playerId: g.players[0].id }), /Only the host/);
  assert.throws(() => command('reset-game', {}, 3000), /Confirm/);
  command('pause', {}, 3000); command('reset-game', { confirm: true }, 4000);
  assert.equal(g.phase, 'lobby'); assert.equal(g.paused, false); assert.equal(g.current, null); assert.equal(g.selectorTeamId, null);
  assert.ok(g.teams.every(t => t.score === 0 && t.queue.length === 0 && t.last === null)); assert.equal(g.ledger.length, 0);
  assert.ok(g.players.every(p => p.selections === 0)); assert.deepEqual(g.players.map(p => [p.id, p.teamId, p.tokenHash]), ids);
  assert.equal(g.boards[0][0].clues[0].used, false); assert.equal(g.boards[0][0].clues[0].prompt, question);
  command('start', {}, 5000); assert.ok(g.selectorTeamId);
});

test('players can undo only their own result while an activity remains open', () => {
  for (const mode of ['time', 'score'] as const) {
    const f = fixture(1), g = f.g;
    Object.assign(g.boards[0][0].clues[0], { kind: 'group', groupMode: mode, link: 'https://example.com' });
    open(f); const payload = { attemptId: g.current!.id }, actor: Actor = { role: 'player', playerId: g.players[0].id };
    f.command('start-group', payload, 1000);
    const submit = (at: number) => f.command(mode === 'time' ? 'group-done' : 'submit-group', { ...payload, score: '42' }, at, actor);
    submit(2000); f.command('unfinish-group', payload, 3000, actor);
    assert.equal(g.current!.group!.submissions[actor.playerId!], undefined);
    assert.throws(() => f.command('unfinish-group', payload, 3100, actor), /No result/);
    submit(4000); if (mode === 'time') assert.equal(g.current!.group!.submissions[actor.playerId!].seconds, 3);
    f.command('lock-group', payload, 5000);
    assert.throws(() => f.command('unfinish-group', payload, 6000, actor), /not accepting/);
  }
});

test('Final wagers allow 2000 for negative scores and larger positive balances', () => {
  for (const balance of [-100, 0, 100, 3000]) {
    const f = fixture(1), g = f.g, team = g.teams[0];
    f.command('adjust-score', { teamId: team.id, amount: balance, reason: 'Fixture' });
    f.command('advance-board', { skip: true }); f.command('end-intermission'); f.command('advance-board', { skip: true });
    const actor: Actor = { role: 'player', playerId: team.captain! }, maximum = Math.max(2000, balance);
    f.command('wager', { amount: maximum }, 0, actor);
    assert.equal(g.finalEntries[team.id].wager, maximum);
    assert.throws(() => f.command('wager', { amount: maximum + 1 }, 0, actor), /Wager/);
  }
});

test('each board introduces six categories under host control',()=>{
 const {g,command}=fixture(1);assert.equal(g.introCategory,0);
 assert.throws(()=>command('next-category',{},0,{role:'player',playerId:g.players[0].id}),/Only the host/);
 for(let i=1;i<=5;i++){command('next-category');assert.equal(g.introCategory,i);}command('next-category');assert.equal(g.introCategory,null);
 command('advance-board',{skip:true});assert.equal(g.board,1);assert.equal(g.introCategory,0);
 command('reset-game',{confirm:true});assert.equal(g.introCategory,null);
});

test('host can kick lobby players and remove captain and rotation references',()=>{
 const {g,command}=fixture(2);command('reset-game',{confirm:true});const victim=g.players[0],team=g.teams.find(t=>t.id===victim.teamId)!;
 team.captain=victim.id;team.queue=[victim.id];team.last=victim.id;
 assert.throws(()=>command('kick-player',{playerId:victim.id},0,{role:'player',playerId:g.players[1].id}),/Only the host/);
 command('kick-player',{playerId:victim.id});assert.ok(!g.players.some(p=>p.id===victim.id));assert.deepEqual(team.queue,[]);assert.equal(team.last,null);assert.equal(team.captain,g.players.find(p=>p.teamId===team.id)!.id);
 command('start');assert.throws(()=>command('kick-player',{playerId:g.players[0].id}),/before the game starts/);
});

test('final reveals are independent, host-controlled, persisted, and scoring waits for an explicit finale', () => {
  const f = fixture(1), { g, command, online } = f;
  g.phase = 'final-judge';
  for (const t of g.teams) g.finalEntries[t.id] = { score: t.score, wager: 700, answer: 'Secret answer', submitted: true, judged: false, correct: null };
  const first = g.teams[0].id, second = g.teams[1].id;
  const display = () => publicView(g, { role: 'display' }, online, 0, null);
  assert.equal(display().finalEntries[second].answer, '');
  command('present-final', { teamId: second, field: 'wager' });
  assert.equal(display().finalPresentation?.teamId, second);
  assert.equal(display().finalEntries[second].wager, 700);
  assert.equal(display().finalEntries[second].answer, '');
  assert.equal(display().finalEntries[first].wager, null);
  command('present-final', { teamId: first, field: 'answer' });
  assert.equal(display().finalEntries[first].answer, 'Secret answer');
  assert.equal(display().finalEntries[first].wager, null);
  assert.throws(() => command('present-final', { teamId: first, field: 'wager' }, 0, { role: 'player', playerId: g.players[0].id }), /Only the host/);
  assert.throws(() => command('finish-final'), /Judge every team/);
  command('judge-final', { teamId: first, correct: false });
  assert.equal(g.teams[0].score, -700);
  assert.equal(display().finalEntries[first].wager, null);
  command('judge-final', { teamId: second, correct: true });
  assert.equal(g.teams[1].score, 700);
  assert.equal(g.phase, 'final-judge');
  assert.deepEqual(gameSchema.parse(JSON.parse(JSON.stringify(g))).finalPresentation, g.finalPresentation);
  command('finish-final');
  assert.equal(g.phase, 'finished');
  command('reset-game', { confirm: true });
  assert.equal(g.finalPresentation, undefined);
});

test('instructions start visible and only the host can toggle them between questions', () => {
  const f = fixture(1);
  assert.equal(f.g.instructionsVisible, true);
  assert.equal(publicView(f.g, { role: 'display' }, f.online, 0, null).instructionsVisible, true);
  assert.throws(() => f.command('show-instructions', { visible: false }, 0, { role: 'player', playerId: f.g.players[0].id }), /Only the host/);
  f.command('show-instructions', { visible: false });
  assert.equal(f.g.introCategory, 0);
  f.command('show-instructions', { visible: true });
  assert.equal(gameSchema.parse(f.g).instructionsVisible, true);
  f.command('show-instructions', { visible: false });
  open(f);
  assert.throws(() => f.command('show-instructions', { visible: true }), /between questions/);
});

test('undo team awards reverses only that award, restores selection, and permits a corrected award', () => {
 const {g,command}=fixture();
 Object.assign(g.boards[0][0].clues[0],{kind:'group',groupMode:'time',link:'https://example.com'});
 command('open-clue',{category:0,row:0});const attemptId=g.current!.id, original=g.selectorTeamId;
 command('start-group',{attemptId});command('lock-group',{attemptId},2000);
 const [a,b]=g.teams;
 command('award-group',{attemptId,teamId:a.id,points:100,reason:'First'});
 command('award-group',{attemptId,teamId:b.id,points:200,reason:'Second'});
 const entryId=g.current!.group!.awards['team:'+b.id].entryId;
 const undo={attemptId,teamId:b.id,entryId};
 assert.throws(()=>command('undo-group-award',undo,0,{role:'player',playerId:g.players[0].id}),/Only the host/);
 command('undo-group-award',undo);assert.equal(b.score,0);assert.equal(a.score,100);assert.equal(g.selectorTeamId,a.id);
 assert.throws(()=>command('undo-group-award',undo),/already been undone/);
 command('undo-group-award',{attemptId,teamId:a.id,entryId:g.current!.group!.awards['team:'+a.id].entryId});
 assert.equal(g.selectorTeamId,original);
 command('award-group',{attemptId,teamId:b.id,points:50,reason:'Corrected'});assert.equal(b.score,50);
 assert.throws(()=>command('undo-group-award',undo),/changed/);
 assert.equal(gameSchema.parse(g).current!.group!.selectorBeforeAwards,original);
});

test('activity review returns directly to the board while keeping awards', () => {
 const {g,command}=fixture();Object.assign(g.boards[0][0].clues[0],{kind:'group',groupMode:'time',link:'https://example.com'});
 command('open-clue',{category:0,row:0});const attemptId=g.current!.id;
 command('start-group',{attemptId});assert.throws(()=>command('return-board'),/Finish this clue/);
 command('lock-group',{attemptId});command('award-group',{attemptId,teamId:g.teams[0].id,points:100,reason:'Winner'});
 command('return-board');assert.equal(g.current,null);assert.equal(g.teams[0].score,100);assert.equal(g.boards[0][0].clues[0].used,true);
});

test('representatives are visible between rounds and are reused when the question opens', () => {
 const {g,command,online}=fixture(3);
 const before=structuredClone(g.nextRepresentatives);
 const selected=g.players.reduce((sum,p)=>sum+p.selections,0);
 assert.equal(Object.keys(before!).length,2);
 assert.deepEqual(publicView(g,{role:'display'},online,0,null).nextRepresentatives,before);
 command('open-clue',{category:0,row:0});assert.deepEqual(g.current!.representatives,before);
 assert.equal(g.players.reduce((sum,p)=>sum+p.selections,0),selected);
 command('close-clue');command('return-board');
 for(const team of g.teams)assert.notEqual(g.nextRepresentatives![team.id],before![team.id]);
 const next=structuredClone(g.nextRepresentatives);
 command('open-clue',{category:0,row:1});assert.deepEqual(g.current!.representatives,next);
 assert.deepEqual(gameSchema.parse(g).nextRepresentatives,next);
});

test('whole-team questions allow nonrepresentatives to buzz immediately and retain team lockouts', () => {
 const {g,command}=fixture(3);g.boards[0][4].openToAll=true;
 command('open-clue',{category:4,row:0},1000);
 assert.equal(g.current!.state,'open');assert.equal(g.current!.deadline,null);
 const teammate=g.players.find(p=>p.teamId===g.teams[0].id && p.id!==g.current!.representatives[p.teamId])!;
 command('buzz',{attemptId:g.current!.id},1001,{role:'player',playerId:teammate.id});
 command('judge',{buzzId:g.current!.buzzId,correct:false},1002);
 assert.equal(g.current!.state,'open');
 assert.throws(()=>command('buzz',{attemptId:g.current!.id},1003,{role:'player',playerId:teammate.id}));
 const other=g.players.find(p=>p.teamId===g.teams[1].id)!;
 command('buzz',{attemptId:g.current!.id},1004,{role:'player',playerId:other.id});assert.equal(g.current!.winner,other.id);
});
test('sixth category opens and its answer remains private', () => {
 const {g,command,online}=fixture();command('open-clue',{category:5,row:4});
 assert.equal(g.current!.category,5);
 assert.equal(publicView(g,{role:'display'},online,0,null).boards[0][5].clues[4].answer,'');
 assert.ok(gameSchema.parse(g));
});

test('Pixel Perfect clock pauses on buzz and pause, resumes after wrong answers, and caps at 30s', () => {
  const f = fixture();
  const cat = f.g.boards[0][0]; cat.pixelPerfect = true;
  cat.clues[0].image = 'data:image/png;base64,AAAA';
  open(f);
  f.command('checkpoint', {}, 6000);
  assert.equal(f.g.current!.pixel!.elapsedMs, 5000);
  const actor = representative(f.g);
  f.command('buzz', { attemptId: f.g.current!.id }, 8000, actor);
  assert.equal(f.g.current!.pixel!.elapsedMs, 7000);
  assert.equal(f.g.current!.pixel!.runningSince, null);
  f.command('judge', { buzzId: f.g.current!.buzzId, correct: false }, 20000);
  assert.equal(f.g.current!.pixel!.elapsedMs, 7000);
  f.command('pause', {}, 23000);
  assert.equal(f.g.current!.pixel!.elapsedMs, 10000);
  f.command('resume', {}, 40000);
  f.command('checkpoint', {}, 45000);
  assert.equal(f.g.current!.pixel!.elapsedMs, 15000);
  assert.equal(f.g.current!.state, 'open');
  f.command('checkpoint', {}, 65000);
  assert.equal(f.g.current!.pixel!.elapsedMs, 30000);
  assert.equal(f.g.current!.pixel!.runningSince, null);
  assert.equal(gameSchema.parse(f.g).current!.pixel!.elapsedMs, 30000);
  f.command('close-clue', {}, 66000);
  assert.equal(f.g.current!.revealedAnswer, true);
});

test('Pixel Perfect supports whole-team buzzing and rejects missing images and incompatible modes', () => {
  const f = fixture();
  const cat = f.g.boards[0][0]; cat.pixelPerfect = true; cat.openToAll = true;
  assert.throws(() => open(f), /requires an image/);
  cat.clues[0].image = 'data:image/png;base64,AAAA';
  cat.clues[0].boost = true;
  assert.throws(() => open(f), /normal buzzer/);
  cat.clues[0].boost = false;
  open(f);
  assert.equal(f.g.current!.state, 'open');
  const player = f.g.players.find(p => p.id !== f.g.current!.representatives[p.teamId])!;
  f.command('buzz', { attemptId: f.g.current!.id }, 6000, { role: 'player', playerId: player.id });
  assert.equal(f.g.current!.winner, player.id);
  assert.equal(f.g.current!.pixel!.elapsedMs, 5000);
  f.command('judge', { buzzId: f.g.current!.buzzId, correct: true }, 7000);
  assert.equal(f.g.current!.pixel!.runningSince, null);
  const view = publicView(f.g, { role: 'display' }, f.online, 7000, null);
  assert.equal(view.current!.revealedAnswer, true);
});

test('host collects private answers from all teams and awards points manually',()=>{
 const f=fixture(2),{g,command,online}=f;g.boards[0][0].openToAll=true;g.boards[0][0].collectAnswers=true;open(f);
 const attemptId=g.current!.id,player={role:'player' as const,playerId:g.players[0].id};
 assert.throws(()=>command('collect-team-answers',{},1100,player));

 assert.equal(g.current!.group!.teamAnswers,true);
 for(const p of g.players.filter(p=>g.current!.representatives[p.teamId]===p.id)) command('submit-group',{attemptId,score:'answer '+p.id},1200,{role:'player',playerId:p.id});
 assert.equal(Object.keys(g.current!.group!.submissions).length,2);
 assert.throws(()=>command('buzz',{attemptId},1300,player));
 command('lock-group',{attemptId},1400);
 assert.deepEqual(publicView(g,{role:'display'},online,1400,null).current!.group!.submissions,{});
 assert.equal(Object.keys(publicView(g,player,online,1400,null).current!.group!.submissions).length,1);
 assert.throws(()=>command('submit-group',{attemptId,score:'late'},1500,player));
 command('award-group',{attemptId,teamId:g.teams[0].id,points:75,reason:'Manual answer'},1500);
 assert.equal(g.teams[0].score,75);
 command('reveal',{},1600);assert.equal(g.current!.revealedAnswer,true);
 command('undo-end-group',{attemptId},1700);assert.equal(g.current!.revealedAnswer,false);
 assert.ok(gameSchema.safeParse(g).success);
});

test('host can skip remaining clues to next board and final',()=>{
 const {g,command}=fixture();
 assert.throws(()=>command('advance-board'));
 assert.throws(()=>command('advance-board',{skip:true},0,{role:'player',playerId:g.players[0].id}));
 command('advance-board',{skip:true});assert.equal(g.board,1);assert.equal(g.introCategory,0);
 assert.ok(g.boards[0].every(c=>c.clues.every(q=>q.used)));
 command('end-intermission'); command('advance-board',{skip:true});assert.equal(g.phase,'final-wager');
});

test('host can reopen locked buzzers without changing previous scores',()=>{
 const f=fixture(1);open(f);const {g,command}=f;const player=representative(g);
 command('buzz',{attemptId:g.current!.id},2000,player);command('judge',{buzzId:g.current!.buzzId,correct:false},3000);
 assert.equal(g.teams[0].score,-100);assert.throws(()=>command('reopen-buzzers',{},4000,player));
 command('reopen-buzzers',{},4000);assert.equal(g.current!.state,'open');assert.equal(g.teams[0].score,-100);
 command('buzz',{attemptId:g.current!.id},4001,player);assert.equal(g.current!.winner,player.playerId);
});
test('only host controls stream music, including while paused',()=>{
 const {g,command}=fixture();assert.throws(()=>command('set-music',{playing:true},0,{role:'player',playerId:g.players[0].id}));
 command('set-music',{playing:true});assert.equal(g.musicPlaying,true);command('pause');command('set-music',{playing:false});assert.equal(g.musicPlaying,false);
});

test('reaction clips are host-only, optional, and follow valid rulings exactly once',()=>{
 const f=fixture(1),{g,command}=f;
 assert.throws(()=>command('play-sound',{kind:'applause'},0,{role:'player',playerId:g.players[0].id}));
 command('play-sound',{kind:'awww'});assert.equal(g.soundCue?.kind,'awww');
 command('play-sound',{kind:'stop'});assert.equal(g.soundCue?.kind,'stop');
 open(f);command('buzz',{attemptId:g.current!.id},2000,representative(g));command('judge',{buzzId:g.current!.buzzId,correct:false},3000);assert.equal(g.soundCue?.kind,'stop');
 command('set-auto-sounds',{enabled:true});command('reopen-buzzers');command('buzz',{attemptId:g.current!.id},4000,representative(g));
 const payload={buzzId:g.current!.buzzId,correct:true},id=randomUUID();command('judge',payload,5000,host,id);assert.equal(g.soundCue?.kind,'applause');const cue=g.soundCue;
 command('judge',payload,5000,host,id);assert.deepEqual(g.soundCue,cue);
 command('pause');command('play-sound',{kind:'awww'});assert.equal(g.soundCue?.kind,'awww');
});

test('quote clues reveal progressively, hide future quotes, and survive saved state', () => {
  const f=fixture();
  f.g.boards[0][0].clues[0]={prompt:'Who said it?',answer:'Author',used:false,quotes:[{text:'First',source:'#general · yesterday'},{text:'Second',source:''},{text:'Third',source:''}]};
  open(f);
  const c=f.g.current!;
  assert.equal(c.quotesRevealed,1);
  const view=()=>publicView(f.g,{role:'display'},f.online,1000,null);
  assert.deepEqual(view().boards[0][0].clues[0].quotes?.map(q=>q.text),['First']);
  assert.equal(view().boards[0][0].clues[0].answer,'');
  assert.throws(()=>f.command('reveal-quote',{attemptId:c.id,revealed:1},1000,representative(f.g)),/host/);
  assert.throws(()=>f.command('reveal-quote',{attemptId:'stale',revealed:1},1000));
  f.command('reveal-quote',{attemptId:c.id,revealed:1},1000);
  assert.equal(view().boards[0][0].clues[0].quotes?.length,2);
  assert.throws(()=>f.command('reveal-quote',{attemptId:c.id,revealed:1},1000));
  assert.equal(gameSchema.parse(JSON.parse(JSON.stringify(f.g))).current?.quotesRevealed,2);
  f.command('reveal-quote',{attemptId:c.id,revealed:2},1000);
  assert.equal(view().boards[0][0].clues[0].quotes?.length,3);
  assert.throws(()=>f.command('reveal-quote',{attemptId:c.id,revealed:3},1000));
  f.command('close-clue',{},1000);f.command('return-board',{},1000);
  assert.deepEqual(view().boards[0][0].clues[0].quotes,[]);
});

test('team submission mode shares one answer per team and keeps other teams private',()=>{
  const f=fixture(), cat=f.g.boards[0][0]; cat.openToAll=true;cat.collectAnswers=true;cat.submissionScope='team';
  open(f);const c=f.g.current!,team=f.g.teams[0],members=f.g.players.filter(p=>p.teamId===team.id);
  const actor=(id:string):Actor=>({role:'player',playerId:id});
  c.representatives[team.id]=members[0].id;
  assert.throws(()=>f.command('submit-group',{attemptId:c.id,score:'Unauthorized'},1000,actor(members[1].id)),/designated/);
  f.command('submit-group',{attemptId:c.id,score:'First guess'},1000,actor(members[0].id));
  f.command('set-team-submitter',{attemptId:c.id,teamId:team.id,playerId:members[1].id},1000);
  f.command('submit-group',{attemptId:c.id,score:'Shared revised guess'},1000,actor(members[1].id));
  assert.equal(Object.keys(c.group!.submissions).length,1);
  assert.equal(c.group!.submissions[team.id].score,'Shared revised guess');
  assert.equal(publicView(f.g,actor(members[2].id),f.online,1000,null).current!.group!.submissions[team.id].score,'Shared revised guess');
  const other=f.g.players.find(p=>p.teamId!==team.id && c.representatives[p.teamId]===p.id)!;
  assert.deepEqual(publicView(f.g,actor(other.id),f.online,1000,null).current!.group!.submissions,{});
  assert.deepEqual(publicView(f.g,{role:'display'},f.online,1000,null).current!.group!.submissions,{});
  f.command('submit-group',{attemptId:c.id,score:'Other guess'},1000,actor(other.id));
  assert.equal(Object.keys(c.group!.submissions).length,2);
  assert.equal(gameSchema.parse(f.g).current?.group?.submissionScope,'team');
  assert.throws(()=>f.command('unfinish-group',{attemptId:c.id},1000,actor(members[2].id)),/designated/);
  f.command('unfinish-group',{attemptId:c.id},1000,actor(members[1].id));
  assert.equal(c.group!.submissions[team.id],undefined);
  assert.equal(c.group!.submissions[other.teamId].score,'Other guess');
  f.command('lock-group',{attemptId:c.id},1000);
  assert.throws(()=>f.command('submit-group',{attemptId:c.id,score:'Late'},1000,actor(members[0].id)));
});

test('legacy individual written answers become the latest shared answer for each team',()=>{
  const f=fixture();f.g.boards[0][0].openToAll=true;f.g.boards[0][0].collectAnswers=true;f.g.boards[0][0].submissionScope='player';open(f);
  const group=f.g.current!.group!;assert.equal(group.submissionScope,'team');
  group.submissionScope='player';
  const members=f.g.players.filter(p=>p.teamId===f.g.teams[0].id);
  group.submissions[members[0].id]={score:'old',seconds:null,submittedAt:'2026-01-01T00:00:00Z',revision:1};
  group.submissions[members[1].id]={score:'latest',seconds:null,submittedAt:'2026-01-01T00:00:01Z',revision:1};
  const view=publicView(f.g,host,f.online,1000,null);
  assert.equal(view.current!.group!.submissionScope,'team');
  assert.equal(view.current!.group!.submissions[f.g.teams[0].id].score,'latest');
  assert.equal(Object.keys(view.current!.group!.submissions).length,1);
  f.command('lock-group',{attemptId:f.g.current!.id},1000);
  assert.equal(group.submissionScope,'team');assert.equal(group.submissions[f.g.teams[0].id].score,'latest');
});

test('future quote images stay private and quote media survives save parsing',()=>{
  const f=fixture(),image='data:image/png;base64,iVBORw0KGgo=';
  f.g.boards[0][0].clues[0]={prompt:'Who posted it?',answer:'Author',used:false,quotes:[{text:'First\nLine two',source:''},{text:'',source:'#channel',image},{text:'Last',source:''}]};
  open(f);
  const view=()=>publicView(f.g,{role:'display'},f.online,1000,null);
  assert.ok(!JSON.stringify(view()).includes(image));
  assert.equal(gameSchema.parse(JSON.parse(JSON.stringify(f.g))).boards[0][0].clues[0].quotes?.[1].image,image);
  f.command('reveal-quote',{attemptId:f.g.current!.id,revealed:1},1000);
  assert.equal(view().boards[0][0].clues[0].quotes?.[1].image,image);
});

test('host navigates to previous quote and clients receive the selected quote',()=>{
 const f=fixture();f.g.boards[0][0].clues[0]={prompt:'Who?',answer:'Author',used:false,quotes:[{text:'One',source:''},{text:'Two',source:''},{text:'Three',source:''}]};open(f);const id=f.g.current!.id;
 assert.throws(()=>f.command('previous-quote',{attemptId:id,revealed:1},1000));
 f.command('reveal-quote',{attemptId:id,revealed:1},1000);
 assert.throws(()=>f.command('previous-quote',{attemptId:id,revealed:2},1000,representative(f.g)),/host/);
 f.command('previous-quote',{attemptId:id,revealed:2},1000);
 assert.equal(f.g.current!.quotesRevealed,1);
 assert.equal(publicView(f.g,{role:'display'},f.online,1000,null).boards[0][0].clues[0].quotes?.length,1);
});
test('shared submissions work independently of whole-team buzzing',()=>{
 const f=fixture();const cat=f.g.boards[0][0];cat.collectAnswers=true;cat.openToAll=false;open(f);
 assert.equal(f.g.current!.group?.teamAnswers,true);assert.equal(f.g.current!.deadline,null);
 const id=f.g.current!.representatives[f.g.teams[0].id];
 f.command('submit-group',{attemptId:f.g.current!.id,score:'Answer'},1000,{role:'player',playerId:id});
 assert.equal(f.g.current!.group!.submissions[f.g.teams[0].id].score,'Answer');
});

test('intermission blocks progression until host continues and controls music',()=>{
 const {g,command}=fixture();command('advance-board',{skip:true});assert.equal(g.intermission,true);assert.equal(g.musicPlaying,true);
 assert.throws(()=>command('open-clue',{category:0,row:0}));assert.throws(()=>command('advance-board',{skip:true}));
 command('end-intermission');assert.equal(g.musicPlaying,false);command('open-clue',{category:0,row:0});
});
test('gold podium gives second half points without stealing selection and prevents duplicate places',()=>{
 const {g,command}=fixture();g.boards[0][0].teamBased=true;g.boards[0][0].clues[0]={prompt:'Activity',answer:'',used:false,kind:'group',link:'https://example.com'};
 command('open-clue',{category:0,row:0});const attemptId=g.current!.id;command('start-group',{attemptId});assert.equal(g.musicPlaying,true);command('lock-group',{attemptId});assert.equal(g.musicPlaying,false);
 g.autoSounds=true;command('award-group',{attemptId,teamId:g.teams[0].id,place:1});command('award-group',{attemptId,teamId:g.teams[1].id,place:2});
 assert.deepEqual(g.teams.map(t=>t.score),[100,50]);assert.equal(g.selectorTeamId,g.teams[0].id);assert.equal(g.soundCue?.kind,'applause');assert.throws(()=>command('award-group',{attemptId,teamId:g.teams[1].id,place:1}));
 assert.equal(gameSchema.parse(g).current!.group!.awards['team:'+g.teams[1].id].place,2);
});
test('shared answers reveal one team at a time, keep others private, and judge with sounds once',()=>{
 const f=fixture(),{g,command}=f;g.boards[0][0].collectAnswers=true;open(f);const attemptId=g.current!.id;assert.equal(g.musicPlaying,true);
 for(let i=0;i<2;i++)command('submit-group',{attemptId,score:'secret'+i},1000,representative(g,i));
 command('lock-group',{attemptId},1000);assert.equal(g.musicPlaying,false);const display=()=>publicView(g,{role:'display'},f.online,1000,null);
 command('present-team-answer',{attemptId,teamId:g.teams[0].id},1000);assert.deepEqual(display().current!.group!.submissions,{});
 command('present-team-answer',{attemptId,teamId:g.teams[0].id,reveal:true},1000);assert.equal(Object.keys(display().current!.group!.submissions).length,1);
 g.autoSounds=true;command('judge-team-answer',{attemptId,teamId:g.teams[0].id,correct:false},1000);assert.equal(g.soundCue?.kind,'awww');assert.equal(g.teams[0].score,-100);
 assert.throws(()=>command('judge-team-answer',{attemptId,teamId:g.teams[0].id,correct:false},1000));
 command('present-team-answer',{attemptId,teamId:g.teams[1].id},1000);assert.equal(display().current!.group!.submissions[g.teams[1].id],undefined);
});
test('next quote clears all team lockouts without undoing scores',()=>{
 const f=fixture(),{g,command}=f;g.boards[0][0].clues[0]={prompt:'Who?',answer:'Person',used:false,quotes:[1,2,3].map(i=>({text:String(i),source:''}))};open(f);
 command('buzz',{attemptId:g.current!.id},1000,representative(g));command('judge',{buzzId:g.current!.buzzId,correct:false},1000);
 command('reveal-quote',{attemptId:g.current!.id,revealed:1},1000);assert.deepEqual(g.current!.lockedTeams,[]);assert.equal(g.current!.state,'open');assert.equal(g.teams[0].score,-100);
 command('buzz',{attemptId:g.current!.id},1000,representative(g));
});

test('category examples use easy relay steps, award exactly one point, and preserve the real board and rotation',()=>{
 for(const size of [2,5]){
  const f=fixture(size),{g,command}=f,cat=g.boards[0][0];cat.teamBased=true;cat.exampleMode=true;
  cat.clues[0]={prompt:'Real relay',answer:'',used:false,kind:'group',puzzle:{type:'relay',message:'Real',items:[],solution:[],answers:[],hints:[],relayDifficulty:5}};
  const original=structuredClone(g.boards),rotation=structuredClone(g.nextRepresentatives),selector=g.selectorTeamId;
  command('show-instructions',{visible:false});assert.equal(g.current!.example,true);assert.equal(g.current!.group!.status,'ready');
  const attemptId=g.current!.id;assert.equal(gameSchema.parse(g).current!.exampleClue?.puzzle?.type,'relay');
  command('start-group',{attemptId},1000);const team=g.current!.group!.puzzle!.teams[g.teams[0].id];
  assert.equal(team.relay!.answer,size===5?7:9);assert.equal(team.relay!.order.length,Math.max(4,size));
  assert.ok(Object.values(team.assignments).flat().every(q=>/^(?:[1-9]|__) [＋+−] [1-9]$/.test(q)));
  const actor:Actor={role:'player',playerId:team.operator};command('submit-puzzle',{attemptId,answer:'999'},1100,actor);
  command('submit-puzzle',{attemptId,answer:String(team.relay!.answer)},1200,actor);
  assert.equal(g.teams[0].score,1);assert.equal(g.teams[1].score,0);assert.equal(g.musicPlaying,true);assert.equal(g.current!.group!.status,'playing');
  const other=g.current!.group!.puzzle!.teams[g.teams[1].id];command('submit-puzzle',{attemptId,answer:String(other.relay!.answer)},1250,{role:'player',playerId:other.operator});assert.equal(g.teams[1].score,0);assert.equal(other.finishedMs,250);assert.equal(Object.keys(g.current!.group!.awards).length,1);
  assert.throws(()=>command('submit-puzzle',{attemptId,answer:String(team.relay!.answer)},1201,actor));
  assert.throws(()=>command('award-group',{attemptId,teamId:g.teams[1].id,place:2},1201));
  assert.throws(()=>command('undo-end-group',{attemptId},1201));
  command('lock-group',{attemptId},1300);assert.equal(g.musicPlaying,false);command('return-board',{},1300);assert.equal(g.current,null);assert.equal(g.introCategory,0);assert.equal(g.selectorTeamId,selector);
  assert.deepEqual(g.boards,original);assert.deepEqual(g.nextRepresentatives,rotation);assert.throws(()=>command('start-example',{},1400));
 }
});
test('bomb example is opt-in during introduction, private, three wires, and wins one point',async()=>{
 const {recolor}=await import('../server/bomb-colors');
 const f=fixture(),{g,command}=f;g.boards[0][0].teamBased=true;g.boards[0][0].clues[0]={prompt:'Real bomb',answer:'',used:false,kind:'group',puzzle:{type:'bomb',message:'Real',items:['Red','Blue'],solution:['Red','Blue'],answers:[],hints:['Red first']}};
 command('show-instructions',{visible:false});assert.equal(g.current,null);
 assert.throws(()=>command('start-example',{},0,{role:'player',playerId:g.players[0].id}),/host/);
 command('start-example');const attemptId=g.current!.id;command('start-group',{attemptId},1000);
 const view=publicView(g,{role:'display'},f.online,1000,null);assert.equal(view.current!.exampleClue,undefined);assert.deepEqual(view.boards[0][0].clues[0].puzzle!.solution,[]);
 const team=g.current!.group!.puzzle!.teams[g.teams[0].id],actor:Actor={role:'player',playerId:team.operator};
 for(const item of g.current!.exampleClue!.puzzle!.solution)command('submit-puzzle',{attemptId,item:recolor(item,team.colors!)},2000,actor);
 assert.equal(g.teams[0].score,1);assert.equal(g.current!.group!.status,'playing');assert.equal(g.current!.exampleClue!.puzzle!.items.length,3);assert.equal(g.current!.exampleClue!.puzzle!.hints.length,3);
 const other=g.current!.group!.puzzle!.teams[g.teams[1].id];for(const item of g.current!.exampleClue!.puzzle!.solution)command('submit-puzzle',{attemptId,item:recolor(item,other.colors!)},2500,{role:'player',playerId:other.operator});assert.equal(g.teams[1].score,0);assert.equal(other.finishedMs,1500);
});
test('enabled examples launch on next category and timeout gives no winner or penalties',async()=>{
 const {advanceTimers}=await import('../server/game');const {g,command}=fixture();const cat=g.boards[0][1];cat.teamBased=true;cat.exampleMode=true;cat.clues[0]={prompt:'Relay',answer:'',used:false,kind:'group',puzzle:{type:'relay',message:'Go',items:[],solution:[],answers:[],hints:[]}};
 command('next-category');assert.equal(g.current!.example,true);assert.equal(g.introCategory,1);
 command('start-group',{attemptId:g.current!.id},1000);g.current!.group!.puzzle!.teams[g.teams[0].id].mistakes=5;
 advanceTimers(g,181000);assert.equal(g.musicPlaying,false);assert.ok(g.teams.every(t=>t.score===0));
 command('return-board',{},181001);command('next-category',{},181002);assert.equal(g.introCategory,2);
});

test('Zoomed Image pauses on buzz and fully reveals after 30 seconds of active guessing',async()=>{
 const {advanceTimers}=await import('../server/game');const f=fixture(),{g,command}=f;
 g.boards[0][0].clues[0].zoom={x:.2,y:.8};g.boards[0][0].clues[0].image='data:image/png;base64,AAAA';open(f);
 command('buzz',{attemptId:g.current!.id},6000,representative(g));advanceTimers(g,31000);
 assert.equal(g.current!.pixel!.elapsedMs,5000);assert.equal(g.current!.pixel!.runningSince,null);
 command('judge',{buzzId:g.current!.buzzId,correct:false},31000);
 advanceTimers(g,55999);assert.equal(g.current!.pixel!.elapsedMs,29999);
 advanceTimers(g,56000);assert.equal(g.current!.pixel!.elapsedMs,30000);assert.equal(g.current!.pixel!.runningSince,null);
});

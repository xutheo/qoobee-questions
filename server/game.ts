import { startPuzzle, submitPuzzle, redactPuzzle } from './puzzles';
import { randomInt, randomUUID, createHash, randomBytes } from 'node:crypto';
import { contentSchema, emptyContent, points, isClueReady, type Actor, type Command, type Game, type View } from '../shared/model.js';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function newGame(hostToken: string, name = 'Friday Night Jeopardy'): Game {
  return { ...emptyContent(), name, schemaVersion: 1, id: randomUUID(), code: randomBytes(4).toString('hex').slice(0, 6).toUpperCase(), hostHash: hash(hostToken), version: 0, savedAt: '', phase: 'lobby', board: 0, selectorTeamId: null,
    teams: ['Qoobsters', 'Qooblings'].map(name => ({ id: randomUUID(), name, score: 0, captain: null, queue: [], last: null })), players: [], current: null, paused: false, recovery: null, ledger: [], processed: {}, finalEntries: {}, finalRemainingMs: 30000, finalDeadline: null, undo: null };
}
export function authenticate(g: Game, credential: string): Actor {
  if (credential && hash(credential) === g.hostHash) return { role: 'host' };
  const player = g.players.find(p => credential && p.tokenHash === hash(credential));
  if (player) return { role: 'player', playerId: player.id };
  throw new Error('This session is no longer valid. Rejoin the game.');
}
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function selectRepresentatives(g: Game, online: Set<string>, onlyTeam?: string) {
  const selected: Record<string, string> = {};
  for (const team of g.teams) {
    if (onlyTeam && team.id !== onlyTeam) continue;
    const roster = g.players.filter(p => p.teamId === team.id && p.active);
    team.queue = team.queue.filter(id => roster.some(p => p.id === id));
    let available = team.queue.find(id => online.has(id));
    if (!available) {
      const next = shuffle(roster.filter(p => online.has(p.id)).map(p => p.id));
      if (next.length > 1 && next[0] === team.last) [next[0], next[1]] = [next[1], next[0]];
      // Disconnected, unserved players keep their place; returning players get their owed turn first.
      team.queue.push(...next.filter(id => !team.queue.includes(id)));
      available = team.queue.find(id => online.has(id));
    }
    if (available) {
      team.queue.splice(team.queue.indexOf(available), 1); team.last = available;
      g.players.find(p => p.id === available)!.selections++;
      selected[team.id] = available;
    }
  }
  return selected;
}
// Reconnecting to a team that had nobody online must restore its restricted-round opportunity.
export function fillMissingRepresentatives(g: Game, online: Set<string>) {
  const c = g.current;
  if (g.phase !== 'board' || c && (c.group && !c.group.teamAnswers || !['restricted', 'revealed'].includes(c.state))) return false;
  const representatives = c ? c.representatives : (g.nextRepresentatives ??= {});
  let changed = false;
  for (const team of g.teams) {
    if (representatives[team.id]) continue;
    const selected = selectRepresentatives(g, online, team.id);
    if (selected[team.id]) { representatives[team.id] = selected[team.id]; changed = true; }
  }
  if (changed) g.version++;
  return changed;
}
function advanceBoard(g: Game) {
  if (g.board === 0) { g.board = 1; g.introCategory = 0; g.intermission = true; g.musicPlaying = true; }
  else { g.introCategory = null; g.phase = 'final-wager'; g.undo = null; for (const t of g.teams) g.finalEntries[t.id] = { score: t.score, wager: g.players.some(p => p.teamId === t.id) ? null : 0, answer: '', submitted: false, judged: !g.players.some(p => p.teamId === t.id), correct: null }; }
}
// Practice uses a separate clue so the real board and player rotation stay intact.
function startExample(g: Game, requested = false) {
  if(g.phase !== 'board' || g.current || g.intermission || g.instructionsVisible || g.introCategory == null) return;
  const category=g.boards[g.board][g.introCategory], key=`${g.board}:${g.introCategory}`;
  const type=category.clues.find(q=>q.puzzle?.type==='relay' || q.puzzle?.type==='bomb')?.puzzle?.type;
  if(!category.teamBased || !['relay','bomb'].includes(type || '') || (!requested && !category.exampleMode) || g.exampleCategories?.includes(key)) return;
  const instructions='Example round: first team to finish wins 1 point. No mistake penalties. The host starts the round when everyone is ready.';
  const puzzle=type==='relay'
    ? {type:'relay' as const,message:'Solve each simple expression and pass the answer to your next teammate.',instructions,relayDifficulty:1,relayOperations:['add' as const],items:[],solution:[],answers:[],hints:[]}
    : {type:'bomb' as const,message:'Share your clues and cut the three wires in order.',instructions,items:['Green ■','Red ★','Blue ●'],solution:['Green ■','Red ★','Blue ●'],answers:[],hints:['Cut the green square wire 1st.','Cut the red star wire 2nd.','Cut the blue circle wire 3rd.']};
  g.current={id:randomUUID(),category:g.introCategory,row:0,example:true,exampleClue:{prompt:'Example round',answer:'',used:false,kind:'group',linkLabel:type==='relay'?'Mental Math example':'Bomb Defusal example',groupMode:'time',puzzle},state:'revealed',representatives:{...g.nextRepresentatives},lockedTeams:[],winner:null,buzzId:null,previous:'restricted',remainingMs:0,deadline:null,revealedAnswer:false,group:{status:'ready',mode:'time',elapsedMs:0,runningSince:null,submissions:{},awards:{}}};
  (g.exampleCategories ??= []).push(key);g.undo=null;
}
export function timerRemaining(g: Game, now: number) {
  if (g.current?.deadline !== null && g.current?.deadline !== undefined) g.current.remainingMs = Math.max(0, g.current.deadline - now);
  if (g.finalDeadline !== null) g.finalRemainingMs = Math.max(0, g.finalDeadline - now);
  if (g.current?.pixel?.runningSince != null) { const pixel = g.current.pixel; pixel.elapsedMs = Math.min(30000, pixel.elapsedMs + Math.max(0, now - pixel.runningSince!)); pixel.runningSince = pixel.elapsedMs < 30000 ? now : null; }
  if (g.current?.group?.runningSince != null) { const group = g.current.group; group.elapsedMs += Math.max(0, now - group.runningSince!); group.runningSince = now; }
}
export function advanceTimers(g: Game, now: number) {
  if (g.paused) return;
  timerRemaining(g, now);
  if (g.current?.state === 'restricted' && g.current.remainingMs <= 0) { g.current.state = 'open'; g.current.deadline = null; }
  const group = g.current?.group;
  if (group?.status === 'playing' && group.timeLimitMs && group.elapsedMs >= group.timeLimitMs) { group.elapsedMs = group.timeLimitMs; endActivity(g); }
}
export function pause(g: Game, now: number, reason: string | null = null) {
  advanceTimers(g, now); g.paused = true; g.recovery = reason;
  if (g.current) g.current.deadline = null;
  if (g.current?.group) g.current.group.runningSince = null;
  if (g.current?.pixel) g.current.pixel.runningSince = null;
  g.finalDeadline = null;
}
function score(g: Game, teamId: string, amount: number, reason: string, playerId?: string) {
  const team = g.teams.find(t => t.id === teamId); requireRule(team, 'Team not found.');
  team.score += amount;
  const entry = { id: randomUUID(), teamId, amount, reason, at: new Date().toISOString(), ...(playerId ? { playerId } : {}) };
  g.ledger.push(entry); return entry;
}
function endActivity(g: Game) {
  const c = g.current!, group = c.group!;
  group.status = 'review'; group.runningSince = null; g.musicPlaying = false;
  if(c.example) return;
  group.penalties ??= {};
  for (const [id, team] of Object.entries(group.puzzle?.teams || {})) {
    const penalty = team.mistakes * points(g.board, c.row) / 2;
    const difference = penalty - (group.penalties[id] || 0);
    if (difference) score(g, id, -difference, 'Team activity mistake penalty');
    group.penalties[id] = penalty;
  }
}
function complete(g: Game) { if (g.current) { g.current.state = 'resolved'; g.current.deadline = null; if (g.current.group) { endActivity(g); } } }
function completeContent(g: Game) {
  requireRule(g.boards.every(b => b.every(c => !c.pixelPerfect || c.clues.every(q => !!q.image && q.kind !== 'group' && !q.boost))), 'Pixel Perfect categories need an image for every question and cannot contain group activities or Qoobee Boost.');
  requireRule(g.boards.every(b => b.every(c => c.title.trim() && c.clues.every(isClueReady))) && Object.values(g.final).every(s => s.trim()), 'Complete all clues, category titles, and Final Jeopardy. External activities need an HTTPS link; team puzzles need valid clues and a complete solution.');
}
// Migrate old in-progress individual written answers to the latest answer per team.
function normalizeWrittenAnswers(g: Pick<Game, 'current' | 'players' | 'teams'>) {
  const group = g.current?.group;
  if (!group?.teamAnswers || group.submissionScope === 'team') return;
  const submissions: typeof group.submissions = {};
  for (const [id, entry] of Object.entries(group.submissions)) {
    const teamId = g.players.find(p => p.id === id)?.teamId ?? g.teams.find(t => t.id === id)?.id;
    if (teamId && (!submissions[teamId] || entry.submittedAt >= submissions[teamId].submittedAt)) submissions[teamId] = entry;
  }
  group.submissionScope = 'team'; group.submissions = submissions;
}
export function applyCommand(g: Game, actor: Actor, command: Command, now: number, online: Set<string>) {
  normalizeWrittenAnswers(g);
  const { type, payload: p = {} } = command;
  requireRule(actor.role !== 'display', 'The display is read only.');
  const actorKey = actor.role === 'host' ? 'host' : actor.playerId!;
  if (Object.hasOwn(g.processed, command.id)) { requireRule(g.processed[command.id].actor === actorKey, 'Invalid command ID.'); return false; }
  if (actor.role === 'host' && command.version !== undefined) requireRule(command.version === g.version, 'The game changed. Please try again.');
  advanceTimers(g, now);
  const player = g.players.find(x => x.id === actor.playerId);
  if (actor.role === 'player') requireRule(player?.active, 'Your player is inactive.');
  const playerCommands = ['buzz', 'wager', 'final-answer', 'choose-team', 'submit-group', 'group-done', 'unfinish-group', 'submit-puzzle'];
  if (actor.role !== 'host') requireRule(playerCommands.includes(type), 'Only the host can do that.');
  if (g.paused) requireRule(['resume', 'checkpoint', 'edit-player', 'captain', 'adjust-score', 'reset-game', 'set-music', 'play-sound', 'set-auto-sounds'].includes(type), 'The game is paused. Wait for the host to resume.');
  const c = g.current;
  const activeClue = c ? c.exampleClue ?? g.boards[g.board][c.category].clues[c.row] : null;
  switch (type) {
    case 'save-content': {
      requireRule(g.phase === 'lobby', 'Boards are locked once the game starts.');
      const content = contentSchema.parse(p); Object.assign(g, content);
      for (const board of g.boards) for (const cat of board) for (const clue of cat.clues) clue.used = false;
      break;
    }
    case 'add-team':
      requireRule(g.phase === 'lobby' && g.teams.length < 12, 'Teams can only be added in the lobby (maximum 12).');
      requireRule(typeof p.name === 'string' && p.name.trim().length > 0 && p.name.trim().length <= 40, 'Enter a team name up to 40 characters.');
      g.teams.push({ id: randomUUID(), name: p.name.trim(), score: 0, captain: null, queue: [], last: null }); break;
    case 'remove-team': {
      requireRule(g.phase === 'lobby', 'Remove teams before the game starts.');
      requireRule(g.teams.length > 2 && g.teams.some(t => t.id === p.teamId), 'Keep at least two teams.');
      const remaining = g.teams.filter(t => t.id !== p.teamId);
      for (const member of g.players.filter(x => x.teamId === p.teamId)) {
        const destination = remaining[randomInt(remaining.length)]; member.teamId = destination.id;
        if (!destination.captain && member.active) destination.captain = member.id;
      }
      g.teams = remaining; g.ledger = g.ledger.filter(e => e.teamId !== p.teamId); break;
    }
    case 'rename-team': {
      requireRule(g.phase === 'lobby', 'Team names are locked during play.');
      const t = g.teams.find(t => t.id === p.teamId); requireRule(t && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 40, 'Enter a valid team name.'); t.name = p.name.trim(); break;
    }
    case 'choose-team': {
      requireRule(g.phase === 'lobby' && player, 'Team changes are only available in the lobby.');
      const t = g.teams.find(t => t.id === p.teamId); requireRule(t, 'Team not found.');
      const old = g.teams.find(t => t.id === player.teamId)!; if (old.captain === player.id) old.captain = g.players.find(x => x.teamId === old.id && x.id !== player.id && x.active)?.id ?? null;
      player.teamId = t.id; if (!t.captain) t.captain = player.id; break;
    }
    case 'kick-player': {
      requireRule(g.phase === 'lobby', 'Kick players only before the game starts.');
      requireRule(g.players.some(x => x.id === p.playerId), 'Player not found.');
      g.players = g.players.filter(x => x.id !== p.playerId);
      for (const t of g.teams) {
        t.queue = t.queue.filter(id => id !== p.playerId);
        if (t.last === p.playerId) t.last = null;
        if (t.captain === p.playerId) t.captain = g.players.find(x => x.teamId === t.id && x.active)?.id ?? null;
      }
      break;
    }
    case 'edit-player': {
      requireRule(g.phase === 'lobby' || (!g.current && g.phase === 'board') || g.paused, 'Manage the roster between clues or while paused.');
      const target = g.players.find(x => x.id === p.playerId); requireRule(target, 'Player not found.');
      if (typeof p.active === 'boolean') { const wasActive = target.active; target.active = p.active; if (target.active && !wasActive) { const t = g.teams.find(t => t.id === target.teamId)!; if (!t.queue.includes(target.id)) t.queue.splice(randomInt(t.queue.length + 1), 0, target.id); } }
      if (p.teamId) { requireRule(g.phase === 'lobby' && g.teams.some(t => t.id === p.teamId), 'Move teams only in the lobby.'); target.teamId = p.teamId; }
      for (const t of g.teams) if (!g.players.some(x => x.id === t.captain && x.teamId === t.id && x.active)) t.captain = g.players.find(x => x.teamId === t.id && x.active)?.id ?? null;
      break;
    }
    case 'captain': {
      const t = g.teams.find(t => t.id === p.teamId); requireRule(t && g.players.some(x => x.id === p.playerId && x.teamId === t.id && x.active), 'Choose an active teammate.'); t.captain = p.playerId; break;
    }
    case 'reset-game':
      requireRule(p.confirm === true, 'Confirm resetting the game.');
      for (const board of g.boards) for (const category of board) for (const clue of category.clues) clue.used = false;
      for (const team of g.teams) { team.score = 0; team.queue = []; team.last = null; }
      for (const member of g.players) member.selections = 0;
      g.phase = 'lobby'; g.exampleCategories=[]; g.board = 0; g.intermission = false; g.musicPlaying = false; g.current = null; g.paused = false; g.recovery = null;
      g.soundCue = {id:command.id,kind:'stop'}; g.musicPlaying = false; g.ledger = []; g.undo = null; g.finalEntries = {}; g.finalPresentation = undefined; g.nextRepresentatives = {}; g.instructionsVisible = false; g.finalRemainingMs = 30000; g.finalDeadline = null; g.selectorTeamId = null; g.introCategory = null; break;
    case 'start':
      requireRule(g.phase === 'lobby', 'The game has already started.'); completeContent(g);
      requireRule(g.teams.filter(t => g.players.some(x => x.active && x.teamId === t.id && online.has(x.id))).length >= 2, 'Connect at least one player on each of two teams.');
      for (const t of g.teams) t.queue = shuffle(g.players.filter(x => x.active && x.teamId === t.id).map(x => x.id));
      { const candidates = g.teams.filter(t => g.players.some(p => p.active && p.teamId === t.id && online.has(p.id))); g.selectorTeamId = candidates[randomInt(candidates.length)].id; }
      g.phase = 'board'; g.nextRepresentatives = selectRepresentatives(g, online); g.introCategory = 0; g.instructionsVisible = true; break;
    case 'show-instructions':
      requireRule(g.phase === 'board' && !g.current && typeof p.visible === 'boolean', 'Instructions can be shown between questions.');
      g.instructionsVisible = p.visible; startExample(g); break;
    case 'start-example': requireRule(g.introCategory != null && !c && !g.intermission, 'Examples are available during category introductions.'); startExample(g,true); requireRule(g.current?.example, 'This category has no available example.'); break;
    case 'end-intermission': requireRule(g.intermission, 'No intermission is active.'); g.intermission = false; g.musicPlaying = false; startExample(g); break;
    case 'next-category':
      g.instructionsVisible = false;
      requireRule(!g.intermission && g.phase === 'board' && !c && g.introCategory != null, 'No category introduction is active.');
      g.introCategory = g.introCategory === g.boards[g.board].length - 1 ? null : g.introCategory + 1; startExample(g); break;
    case 'open-clue':
      g.instructionsVisible = false; {
      requireRule(!g.intermission && g.phase === 'board' && !c, 'Return to the board before choosing a clue.');
      requireRule(Number.isInteger(p.category) && p.category >= 0 && p.category < g.boards[g.board].length && Number.isInteger(p.row) && p.row >= 0 && p.row < 5, 'Invalid clue.');
      const clue = g.boards[g.board][p.category].clues[p.row]; requireRule(!clue.used, 'That clue has already been played.');
      requireRule(!g.boards[g.board][p.category].pixelPerfect || (!!clue.image && clue.kind !== 'group' && !clue.boost), 'Pixel Perfect requires an image and a normal buzzer question.');
      requireRule(!clue.zoom || (!!clue.image && clue.kind !== 'group' && !clue.boost), 'Zoomed Image needs an image and a normal question.');
      clue.used = true; g.undo = null; g.introCategory = null;
      requireRule(!(clue.kind === 'group' && clue.boost), 'Group activities cannot also be Qoobee Boost clues.');
      g.current = { id: randomUUID(), category: p.category, row: p.row, state: clue.kind === 'group' || clue.boost ? 'revealed' : g.boards[g.board][p.category].openToAll ? 'open' : 'restricted', representatives: { ...(g.nextRepresentatives ?? selectRepresentatives(g, online)) }, lockedTeams: [], winner: null, buzzId: null, previous: 'restricted', remainingMs: 10000, deadline: clue.kind === 'group' || clue.boost || g.boards[g.board][p.category].openToAll ? null : now + 10000, revealedAnswer: false,
        ...(g.boards[g.board][p.category].pixelPerfect || clue.zoom ? { pixel: { elapsedMs: 0, runningSince: now } } : {}),
        ...(clue.quotes ? { quotesRevealed: 1 } : {}),
        ...(clue.boost ? { boost: null } : {}), ...(clue.kind === 'group' ? { group: { status: 'ready', mode: clue.groupMode ?? 'time', elapsedMs: 0, runningSince: null, submissions: {}, awards: {} } } : {}) };
      if (g.boards[g.board][p.category].collectAnswers && clue.kind !== 'group' && !clue.boost) { g.current.state = 'revealed'; g.current.deadline = null; g.current.group = {teamAnswers:true,submissionScope:'team',status:'playing',mode:'score',elapsedMs:0,runningSince:now,submissions:{},awards:{}}; }
      if (g.current?.group?.teamAnswers) g.musicPlaying = true;
      break;
    }
    case 'previous-quote':
      requireRule(c && activeClue?.quotes && p.attemptId === c.id && p.revealed === (c.quotesRevealed ?? 1) && (c.quotesRevealed ?? 1) > 1, 'No previous quote available.');
      c.quotesRevealed = (c.quotesRevealed ?? 1) - 1; g.undo = null; break;
    case 'reveal-quote':
      requireRule(c && activeClue?.quotes && p.attemptId === c.id && p.revealed === (c.quotesRevealed ?? 1), 'This quote reveal is out of date.');
      requireRule((c.quotesRevealed ?? 1) < 3, 'All quotes are already revealed.');
      c.quotesRevealed = (c.quotesRevealed ?? 1) + 1;
      if(!c.group && !activeClue.boost && !c.revealedAnswer){c.lockedTeams=[];c.winner=null;c.buzzId=null;c.state='open';c.previous='open';c.deadline=null;}
      g.undo = null; break;
    case 'start-timer': requireRule(c?.state === 'revealed' && !c.group && !activeClue?.boost, 'The clue is not ready for a buzzer timer.'); c.state = 'restricted'; c.deadline = now + c.remainingMs; break;
    case 'play-sound': requireRule(['applause','awww','stop'].includes(p.kind), 'Choose a reaction sound.'); g.soundCue = {id:command.id,kind:p.kind}; break;
    case 'set-auto-sounds': requireRule(typeof p.enabled === 'boolean', 'Choose automatic sounds on or off.'); g.autoSounds = p.enabled; break;
    case 'set-music': requireRule(typeof p.playing === 'boolean', 'Choose play or stop.'); g.musicPlaying = p.playing; break;
    case 'reopen-buzzers':
      requireRule(c && !c.group && !activeClue?.boost && c.lockedTeams.length > 0 && c.state !== 'answering', 'No locked teams to reopen.');
      c.lockedTeams = []; c.state = 'open'; c.winner = null; c.buzzId = null; c.deadline = null; c.revealedAnswer = false; g.undo = null; break;
    case 'start-group':
      requireRule(c?.group?.status === 'ready' && c.state === 'revealed' && p.attemptId === c.id, 'This activity is not ready.');
      if (activeClue?.puzzle) startPuzzle(g, c.representatives); if (['bomb','relay'].includes(activeClue?.puzzle?.type || '')) c.group.timeLimitMs = 180000; c.group.status = 'playing'; c.group.runningSince = now; g.musicPlaying = true; break;
    case 'submit-puzzle':
      submitPuzzle(g, player, p);
      if(c?.example && c.group?.puzzle?.teams[player!.teamId]?.finishedMs != null && Object.keys(c.group.awards).length === 0){
        const entry=score(g,player!.teamId,1,'Example round winner');
        c.group!.awards['team:'+player!.teamId]={points:1,reason:'Example winner',entryId:entry.id,place:1};
        if(g.autoSounds)g.soundCue={id:command.id,kind:'applause'};
      }
      break;
    case 'puzzle-operator': {
      requireRule(c?.group?.puzzle && p.attemptId === c.id, 'No puzzle is active.');
      requireRule(activeClue?.puzzle?.type !== 'relay', 'Only the last relay player can submit.');
      const target = g.players.find(x => x.id === p.playerId && x.active && x.teamId === p.teamId);
      requireRule(target && c.group.puzzle.teams[p.teamId], 'Choose an active team member.');
      c.group.puzzle.teams[p.teamId].operator = target.id; break;
    }
    case 'group-done': {
      requireRule(!activeClue?.puzzle && player && c?.group?.mode === 'time' && c.group.status === 'playing' && c.state !== 'resolved' && p.attemptId === c.id, 'This timed activity is not accepting results.');
      requireRule(!Object.hasOwn(c.group.submissions, player.id), 'Your finish time has already been recorded.');
      c.group.submissions[player.id] = { score: null, seconds: c.group.elapsedMs / 1000, submittedAt: new Date().toISOString(), revision: 1 }; break;
    }
    case 'unfinish-group': {
      requireRule(!activeClue?.puzzle && player && c?.group?.status === 'playing' && c.state !== 'resolved' && p.attemptId === c.id, 'This activity is not accepting changes.');
      if(c.group.teamAnswers) requireRule(c.representatives[player.teamId] === player.id, 'Only your designated team submitter can change the answer.');
      const key = c.group.submissionScope === 'team' ? player.teamId : player.id;
      requireRule(Object.hasOwn(c.group.submissions, key), 'No result to undo.');
      delete c.group.submissions[key]; break;
    }
    case 'set-team-submitter': {
      requireRule(c?.group?.teamAnswers && c.group.status === 'playing' && p.attemptId === c.id, 'No shared submissions are open.');
      const selected = g.players.find(x=>x.id===p.playerId && x.teamId===p.teamId && x.active);
      requireRule(selected, 'Choose an active team member.'); c.representatives[p.teamId] = selected.id; break;
    }
    case 'submit-group': {
      requireRule(player && c?.group?.mode === 'score' && c.group.status === 'playing' && c.state !== 'resolved' && p.attemptId === c.id, 'Score submissions are closed.');
      requireRule(typeof p.score === 'string' && p.score.trim().length > 0 && p.score.length <= 100, 'Enter a score up to 100 characters.');
      if(c.group.teamAnswers) requireRule(c.representatives[player.teamId] === player.id, 'Only your designated team submitter can change the answer.');
      const key = c.group.submissionScope === 'team' ? player.teamId : player.id;
      c.group.submissions[key] = { score: p.score.trim(), seconds: null, submittedAt: new Date().toISOString(), revision: (c.group.submissions[key]?.revision ?? 0) + 1 }; break;
    }
    case 'undo-end-group':
      requireRule(!c?.example, 'Example rounds cannot be reopened.');
      requireRule(c?.group?.status === 'review' && c.state !== 'resolved' && p.attemptId === c.id, 'No ended activity to resume.');
      requireRule(!c.group.timeLimitMs || c.group.elapsedMs < c.group.timeLimitMs, 'The three-minute limit has expired.'); for(const [id, amount] of Object.entries(c.group.penalties || {})) if(amount) score(g,id,amount,'Undo activity mistake penalty'); c.group.penalties = {}; c.group.status = 'playing'; c.group.runningSince = now; if(c.group.teamAnswers) c.revealedAnswer = false; g.musicPlaying = true; break;
    case 'lock-group':
      requireRule(c?.group?.status === 'playing' && c.state !== 'resolved' && p.attemptId === c.id, 'No open group activity.');
      endActivity(g); break;
    case 'present-team-answer': {
      requireRule(c?.group?.teamAnswers && c.group.status === 'review' && p.attemptId === c.id && g.teams.some(t=>t.id===p.teamId), 'Choose a team during answer review.');
      const presentation = c.group.presentation ??= {teamId:null,revealed:[],judgments:{}};
      presentation.teamId=p.teamId;
      if(p.reveal === true && !presentation.revealed.includes(p.teamId)) presentation.revealed.push(p.teamId);
      break;
    }
    case 'judge-team-answer': {
      requireRule(c?.group?.teamAnswers && c.group.status === 'review' && c.state !== 'resolved' && p.attemptId === c.id && c.group.presentation?.revealed.includes(p.teamId) && typeof p.correct === 'boolean', 'Reveal this team answer before judging it.');
      requireRule(!c.group.awards['team:'+p.teamId], 'This team has already been judged.');
      const amount=points(g.board,c.row)*(p.correct?1:-1);
      if(c.group.selectorBeforeAwards === undefined) c.group.selectorBeforeAwards=g.selectorTeamId ?? null;
      const entry=score(g,p.teamId,amount,p.correct?'Correct team answer':'Incorrect team answer');
      c.group.awards['team:'+p.teamId]={points:amount,reason:p.correct?'Correct':'Incorrect',entryId:entry.id};
      c.group.presentation!.judgments[p.teamId]=p.correct;
      if(p.correct) g.selectorTeamId=p.teamId;
      if(g.autoSounds) g.soundCue={id:command.id,kind:p.correct?'applause':'awww'};
      g.undo=null; break;
    }
    case 'award-group': {
      requireRule(!c?.example, 'Example winners receive exactly 1 point automatically.');
      requireRule(c?.group?.status === 'review' && c.state !== 'resolved' && p.attemptId === c.id, 'Lock submissions before awarding points.');
      const teamId = p.teamId;
      if(p.place !== undefined){
        requireRule(g.boards[g.board][c.category].teamBased && [1,2].includes(p.place), 'Choose first or second place for a team challenge.');
        requireRule(!Object.values(c.group.awards).some(a=>a.place===p.place), 'That place has already been awarded.');
        p.points=points(g.board,c.row)/(p.place===2?2:1);p.reason=p.place===2?'Second place':'First place';
      }
      requireRule(g.teams.some(t => t.id === teamId), 'Choose a team.');
      const awardKey = 'team:' + teamId;
      requireRule(!Object.hasOwn(c.group.awards, awardKey) && !g.players.some(x => x.teamId === teamId && Object.hasOwn(c.group!.awards, x.id)), 'This team has already been awarded points.');
      requireRule(Number.isInteger(p.points) && Math.abs(p.points) <= 1000000 && typeof p.reason === 'string' && p.reason.trim().length > 0 && p.reason.length <= 200, 'Enter whole-number points and a reason.');
      if (c.group.selectorBeforeAwards === undefined) c.group.selectorBeforeAwards = g.selectorTeamId ?? null;
      const entry = score(g, teamId, p.points, 'Group play: ' + p.reason.trim());
      if (p.points > 0 && p.place !== 2) g.selectorTeamId = teamId;
      c.group.awards[awardKey] = { points: p.points, reason: p.reason.trim(), entryId: entry.id, ...(p.place ? {place:p.place} : {}) };
      if(g.autoSounds) g.soundCue={id:command.id,kind:p.points>0?'applause':'awww'};
      g.undo = null; break;
    }
    case 'undo-group-award': {
      requireRule(!c?.example, 'Example points are awarded automatically.');
      requireRule(c?.group?.status === 'review' && c.state !== 'resolved' && p.attemptId === c.id, 'Reopen activity review before undoing an award.');
      const key = Object.keys(c.group.awards).find(key => key === 'team:' + p.teamId || g.players.some(player => player.id === key && player.teamId === p.teamId));
      const award = key ? c.group.awards[key] : undefined;
      requireRule(award && award.entryId === p.entryId, 'This award has already been undone or changed.');
      score(g, p.teamId, -award.points, 'Undo group award: ' + award.reason);
      delete c.group.awards[key!];
      if(c.group.presentation) delete c.group.presentation.judgments[p.teamId];
      if (award.points > 0 && award.place !== 2) {
        const remaining = new Set(Object.values(c.group.awards).filter(a => a.points > 0 && a.place !== 2).map(a => a.entryId));
        const last = [...g.ledger].reverse().find(entry => remaining.has(entry.id));
        g.selectorTeamId = last?.teamId ?? c.group.selectorBeforeAwards ?? null;
      }
      g.undo = null; break;
    }
    case 'start-boost': {
      requireRule(c?.state === 'revealed' && activeClue?.boost && !c.boost && p.attemptId === c.id, 'This Qoobee Boost is not ready.');
      const team = g.teams.find(t => t.id === p.teamId);
      requireRule(team && g.players.some(x => x.active && x.id === c.representatives[team.id] && online.has(x.id)), 'Choose a team whose selected player is connected.');
      requireRule(Number.isSafeInteger(p.wager) && p.wager >= 0 && p.wager <= Math.max(team.score, 1000), 'Wager cannot exceed the larger of the team score or 1,000 points.');
      c.boost = { teamId: team.id, wager: p.wager }; c.winner = c.representatives[team.id]; c.buzzId = command.id; c.state = 'answering'; break;
    }
    case 'buzz': {
      requireRule(player && c && !c.group && !activeClue?.boost && p.attemptId === c.id && ['restricted', 'open'].includes(c.state), 'Buzzing is not available.');
      requireRule(!c.lockedTeams.includes(player.teamId), 'Your team has already answered this clue.');
      requireRule(c.state === 'open' || c.representatives[player.teamId] === player.id, 'Your teammate is representing your team.');
      c.previous = c.state as 'restricted' | 'open'; c.state = 'answering'; c.winner = player.id; c.buzzId = command.id; c.deadline = null; g.undo = null; break;
    }
    case 'judge': {
      requireRule(c?.state === 'answering' && c.winner && p.buzzId === c.buzzId && typeof p.correct === 'boolean', 'That answer is no longer awaiting a ruling.');
      if(g.autoSounds) g.soundCue = {id:command.id,kind:p.correct ? 'applause' : 'awww'};
      const respondent = g.players.find(x => x.id === c.winner)!;
      const amount = (c.boost?.wager ?? points(g.board, c.row)) * (p.correct ? 1 : -1);
      const before = structuredClone(c); const entry = score(g, respondent.teamId, amount, p.correct ? 'Correct answer' : 'Incorrect answer', respondent.id);
      g.undo = { current: before, selectorTeamId: g.selectorTeamId ?? null, teamId: respondent.teamId, amount, entryId: entry.id };
      if (p.correct || c.boost) { complete(g); if (p.correct) { c.revealedAnswer = true; g.selectorTeamId = respondent.teamId; } }
      else { c.lockedTeams.push(respondent.teamId); c.winner = null; c.buzzId = null; c.state = c.previous; if (c.state === 'restricted') c.deadline = now + c.remainingMs; if (g.teams.every(t => c.lockedTeams.includes(t.id) || !g.players.some(x => x.teamId === t.id && x.active))) complete(g); }
      break;
    }
    case 'undo': {
      requireRule(g.undo, 'There is no ruling to undo.'); const u = g.undo;
      score(g, u.teamId, -u.amount, `Undo ruling ${u.entryId}`, u.current.winner ?? undefined); g.current = u.current; g.selectorTeamId = u.selectorTeamId ?? null; g.undo = null; break;
    }
    case 'unfinish-activity': requireRule(c?.group && c.state === 'resolved' && p.attemptId === c.id, 'No finished activity to reopen.'); c.state = 'revealed'; c.group.status = 'review'; c.group.runningSince = null; g.undo = null; break;
    case 'close-clue': requireRule(c && c.state !== 'resolved', 'No active clue.'); complete(g); if (!c.group) c.revealedAnswer = true; g.undo = null; break;
    case 'reveal': requireRule(c?.state === 'resolved' && !c.group || c?.group?.teamAnswers && c.group.status === 'review', 'Close a question before revealing the answer.'); c.revealedAnswer = true; g.undo = null; break;
    case 'return-board':
      if(c?.example){requireRule(c.group?.status==='review' || c.state==='resolved','End the example first.');g.current=null;g.musicPlaying=false;g.undo=null;break;}
      requireRule(c?.state === 'resolved' || c?.group?.status === 'review', 'Finish this clue first.'); g.current = null; g.undo = null; if (g.boards[g.board].every(cat => cat.clues.every(q => q.used))) advanceBoard(g); if (g.phase === 'board') g.nextRepresentatives = selectRepresentatives(g, online); else g.nextRepresentatives = {}; break;
    case 'advance-board':
      requireRule(!g.intermission, 'End the intermission first.');
      requireRule(g.phase === 'board' && !c, 'Return to the board first.');
      requireRule(g.boards[g.board].every(cat => cat.clues.every(q => q.used)) || p.skip === true, 'There are still unplayed clues. Confirm ending this board early.');
      for (const cat of g.boards[g.board]) for (const q of cat.clues) q.used = true;
      g.instructionsVisible = false; g.undo = null; advanceBoard(g); if (g.phase === 'board') g.nextRepresentatives = selectRepresentatives(g, online); break;
    case 'wager': {
      requireRule(g.phase === 'final-wager' && player && g.teams.find(t => t.id === player.teamId)?.captain === player.id, 'Only the team captain can submit the wager.');
      const e = g.finalEntries[player.teamId]; requireRule(Number.isInteger(p.amount) && p.amount >= 0 && p.amount <= Math.max(2000, e.score), 'Wager must be between zero and the greater of 2000 or your team score.'); e.wager = p.amount; break;
    }
    case 'lock-wagers':
      requireRule(g.phase === 'final-wager', 'Wagering is closed.');
      requireRule(Object.values(g.finalEntries).every(e => e.wager !== null) || p.zeroMissing === true, 'Some wagers are missing. Confirm assigning zero to those teams.');
      for (const e of Object.values(g.finalEntries)) if (e.wager === null) e.wager = 0;
      g.phase = 'final-answer'; g.finalRemainingMs = 30000; g.finalDeadline = null; break;
    case 'final-answer': {
      requireRule(g.phase === 'final-answer' && player && g.teams.find(t => t.id === player.teamId)?.captain === player.id, 'Only the captain can submit during the answer period.');
      requireRule(typeof p.answer === 'string' && p.answer.trim().length > 0 && p.answer.length <= 4000, 'Enter an answer up to 4,000 characters.');
      const e = g.finalEntries[player.teamId]; e.answer = p.answer.trim(); e.submitted = true; break;
    }
    case 'lock-answers': requireRule(g.phase === 'final-answer', 'Answers are already locked.'); g.phase = 'final-judge'; g.finalDeadline = null; break;
    case 'present-final': {
      requireRule(g.phase === 'final-judge', 'Final answers are not ready to reveal.');
      requireRule(g.finalEntries[p.teamId] && g.players.some(player => player.teamId === p.teamId), 'Choose a participating team.');
      requireRule(['team', 'answer', 'wager'].includes(p.field), 'Choose team, answer, or wager.');
      const presentation = g.finalPresentation ??= { teamId: null, answers: [], wagers: [] };
      presentation.teamId = p.teamId;
      if (p.field !== 'team') { const list = p.field === 'answer' ? presentation.answers : presentation.wagers; if (!list.includes(p.teamId)) list.push(p.teamId); }
      break;
    }
    case 'finish-final':
      requireRule(g.phase === 'final-judge' && Object.values(g.finalEntries).every(e => e.judged), 'Judge every team before showing the leaderboard.');
      g.phase = 'finished'; break;
    case 'judge-final': {
      requireRule(g.phase === 'final-judge', 'Final answers are not ready to judge.');
      const e = g.finalEntries[p.teamId]; requireRule(e && !e.judged && typeof p.correct === 'boolean', 'This team is already judged or invalid.');
      e.correct = e.submitted && p.correct; if(g.autoSounds) g.soundCue = {id:command.id,kind:e.correct ? 'applause' : 'awww'}; e.judged = true; score(g, p.teamId, (e.wager ?? 0) * (e.correct ? 1 : -1), 'Final Jeopardy');
      const presentation = g.finalPresentation ??= { teamId: null, answers: [], wagers: [] };
      presentation.teamId = p.teamId;
      break;
    }
    case 'adjust-score': requireRule(Number.isInteger(p.amount) && Math.abs(p.amount) <= 1000000 && typeof p.reason === 'string' && p.reason.trim().length > 0 && p.reason.length <= 200, 'Enter a whole-number adjustment and a reason.'); score(g, p.teamId, p.amount, p.reason); g.undo = null; break;
    case 'pause': requireRule(g.phase !== 'lobby' && g.phase !== 'finished', 'Pause is only available during gameplay.'); requireRule(!g.paused, 'Already paused.'); pause(g, now); break;
    case 'resume': requireRule(g.paused, 'The game is not paused.'); g.paused = false; g.recovery = null; if (c?.state === 'revealed' && !c.group && !activeClue?.boost) c.state = 'restricted'; if (g.phase === 'board' && !c && g.boards[g.board].every(cat => cat.clues.every(q => q.used))) advanceBoard(g); if (c?.state === 'restricted') { c.remainingMs = Math.min(c.remainingMs, 10000); c.deadline = now + c.remainingMs; } if (c?.group?.status === 'playing') c.group.runningSince = now; if (g.phase === 'final-answer') g.finalDeadline = null; break;
    case 'checkpoint': break;
    default: throw new Error('Unknown command.');
  }
  if (g.current?.pixel) g.current.pixel.runningSince = !g.paused && !g.current.revealedAnswer && (['restricted', 'open'].includes(g.current.state) || g.current.group?.teamAnswers && g.current.group.status === 'playing') && g.current.pixel.elapsedMs < 30000 ? now : null;
  g.processed[command.id] = { actor: actorKey }; g.version++; return true;
}

export function publicView(g: Game, actor: Actor, online: Set<string>, now: number, storageError: string | null): View {
  const { hostHash, processed, undo, ...safe } = structuredClone(g);
  normalizeWrittenAnswers(safe);
  if (!safe.paused) { if (safe.current?.deadline != null) safe.current.remainingMs = Math.max(0, safe.current.deadline - now); if (safe.finalDeadline !== null) safe.finalRemainingMs = Math.max(0, safe.finalDeadline - now); }
  const view: View = { ...safe, players: safe.players.map(({ tokenHash, ...p }) => p), teams: safe.teams.filter(t => safe.phase === 'lobby' || safe.players.some(p => p.teamId === t.id)).map(({ queue, last, ...t }) => t), online: [...online], role: actor.role, playerId: actor.playerId, canUndo: actor.role === 'host' && !!undo, serverNow: now, storageError, wagerReady: Object.entries(g.finalEntries).filter(([, e]) => e.wager !== null).map(([id]) => id), unclaimed: actor.role === 'host' ? g.players.filter(p => !p.tokenHash).map(p => p.id) : [] };
  if(view.current?.exampleClue){view.boards[view.board][view.current.category].clues[view.current.row]=view.current.exampleClue;delete view.current.exampleClue;}
  if (actor.role !== 'host') {
    for (let b = 0; b < 2; b++) for (let i = 0; i < g.boards[b].length; i++) for (let r = 0; r < 5; r++) {
      const q = view.boards[b][i].clues[r];
      const current = b === g.board && g.current?.category === i && g.current.row === r;
      const boostHidden = current && q.boost && !g.current?.boost && g.current?.state !== 'resolved';
      if (q.quotes) q.quotes = current && !boostHidden ? q.quotes.slice(0, g.current?.quotesRevealed ?? 1) : [];
      if (!current || boostHidden) { q.prompt = ''; delete q.image; delete q.imageAlt; }
      if (!current) delete q.boost;
      if (!current || g.current?.group?.status === 'ready') q.link = '';
      if (!current || !g.current?.revealedAnswer) q.answer = '';
    }
    if (g.phase === 'lobby' || g.phase === 'board' || g.phase === 'final-wager') view.final.prompt = '';
    if (g.phase !== 'finished') view.final.answer = '';
  }
  if (actor.role !== 'host' && view.current?.group) {
    const group = view.current.group;
    const key = group.submissionScope === 'team' ? g.players.find(p => p.id === actor.playerId)?.teamId : actor.playerId;
    if(group.teamAnswers && group.status === 'review') group.submissions=Object.fromEntries(Object.entries(group.submissions).filter(([id])=>id===key || group.presentation?.revealed.includes(id)));
    else if (!(actor.role === 'display' && group.status === 'review' && !group.teamAnswers)) group.submissions = key && group.submissions[key] ? { [key]: group.submissions[key] } : {};
  }
  const ownTeam = g.players.find(p => p.id === actor.playerId)?.teamId;
  for (const [teamId, e] of Object.entries(view.finalEntries)) {
    const privileged = ownTeam === teamId || actor.role === 'host' && g.phase === 'final-judge' || g.phase === 'finished';
    if (!privileged) {
      if (!g.finalPresentation?.wagers.includes(teamId)) e.wager = null;
      if (!g.finalPresentation?.answers.includes(teamId)) e.answer = '';
    }
  }
  redactPuzzle(view, actor);
  return view;
}

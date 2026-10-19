import { statePatch } from '../shared/state-patch';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { DiskStore, lockDirectory, validateGame } from './storage.js';
import { advanceTimers, applyCommand, fillMissingRepresentatives, authenticate, hash, newGame, pause, publicView, token } from './game.js';
import type { Actor, Command, Game } from '../shared/model.js';
import { readFile } from 'node:fs/promises';
import { contentSchema } from '../shared/model.js';
import { allowedOrigins, corsMiddleware } from './origins.js';
import { joinPlayer } from './join.js';

const app = express(), http = createServer(app);
const origins = allowedOrigins(process.env.ALLOWED_ORIGINS);
const io = new Server(http, { maxHttpBufferSize: 16 * 1024 * 1024, cors: { origin: [...origins], methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'] } });
const store = new DiskStore(path.resolve(process.env.DATA_DIR || 'data'));
const unlock = await lockDirectory(store.root);
type Room = { game: Game; queue: Promise<unknown>; sockets: Map<string, Actor>; error: string | null; deleted?: boolean; expiry?: ReturnType<typeof setTimeout> };
const rooms = new Map<string, Room>();
const unavailable = new Map<string, string>();
function roomFor(g: Game): Room { const r = { game: g, queue: Promise.resolve(), sockets: new Map(), error: null }; rooms.set(g.id, r); return r; }
for (const id of await store.listIds()) {
  try { const { game, warning } = await store.load(id); if (game.phase !== 'finished') { game.paused = game.phase !== 'lobby'; if (game.current) { game.current.deadline = null; if (game.current.group) game.current.group.runningSince = null; if (game.current.pixel) game.current.pixel.runningSince = null; } game.finalDeadline = null; game.recovery = warning || 'Recovered from disk. Review the roster, then resume when everyone is ready.'; } else game.recovery = warning; roomFor(game); }
  catch (e: any) { unavailable.set(id, e.message); console.error(`Recovery failed for ${id}: ${e.message}`); }
}
const online = (r: Room) => new Set([...r.sockets.values()].filter(a => a.role === 'player').map(a => a.playerId!));
const hasHost = (r: Room) => [...r.sockets.values()].some(a => a.role === 'host');
function sendState(r: Room, socket: Socket, actor: Actor, full = false) {
  const view = publicView(r.game, actor, online(r), performance.now(), r.error);
  if (socket.data.statePatches && socket.data.lastState && !full) socket.emit('state-patch', statePatch(socket.data.lastState, view));
  else socket.emit('state', view);
  if (socket.data.statePatches) socket.data.lastState = view;
}
function emit(r: Room) { if (r.deleted) return; for (const [id, actor] of r.sockets) { const socket = io.sockets.sockets.get(id); if (socket) sendState(r, socket, actor); } }
function enqueue<T>(r: Room, fn: () => Promise<T>): Promise<T> { const task = r.queue.then(() => { if (r.deleted) throw new Error('The host deleted this game.'); return fn(); }); r.queue = task.catch(() => {}); return task; }
function scheduleExpiry(r: Room) {
  clearTimeout(r.expiry);
  const deadline = r.game.current?.deadline ?? r.game.finalDeadline;
  if (deadline === null || r.game.paused || r.error) return;
  r.expiry = setTimeout(() => {
    const now = performance.now();
    enqueue(r, async () => {
      const currentDeadline = r.game.current?.deadline ?? r.game.finalDeadline;
      if (r.game.paused || r.error || currentDeadline !== deadline) return;
      if (now < deadline) { scheduleExpiry(r); return; }
      const next = structuredClone(r.game); advanceTimers(next, now); next.version++; await commit(r, next);
    }).catch(console.error);
  }, Math.max(1, deadline - performance.now()));
}
async function commit(r: Room, next: Game) {
  try { await store.save(next); r.game = next; r.error = null; }
  catch (e) { r.error = 'Saving to disk failed. Gameplay is frozen. Check available disk space and permissions, then retry storage.'; pause(r.game, performance.now()); clearTimeout(r.expiry); emit(r); console.error(e); throw new Error(r.error); }
  scheduleExpiry(r); emit(r);
}
function find(id: string) { const r = rooms.get(id); if (!r) throw new Error(unavailable.get(id) || 'Game not found.'); return r; }
function credential(req: express.Request) { return req.headers.authorization?.replace(/^Bearer /, '') || ''; }
function host(req: express.Request) { const r = find(String(req.params.id)); if (authenticate(r.game, credential(req)).role !== 'host') throw new Error('Host access required.'); return r; }
app.use('/api', corsMiddleware(origins));
app.use(express.json({ limit: '16mb' }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
// Lightweight per-IP rate limiting; connection and command limits also apply below.
const attempts = new Map<string, { count: number; since: number }>();
function rate(key: string, limit: number, windowMs = 60000) { const now = Date.now(); let bucket = attempts.get(key); if (!bucket || now - bucket.since > windowMs) { bucket = { count: 0, since: now }; attempts.set(key, bucket); } if (++bucket.count > limit) throw new Error('Too many requests. Please wait a moment.'); }
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); try { rate(req.ip || 'local', 180); next(); } catch (e: any) { res.status(429).json({ error: e.message }); } });
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/games', async (req, res) => {
  const name = z.string().trim().min(1).max(100).parse(req.body.name); const secret = token(); const g = newGame(secret, name);
  while ([...rooms.values()].some(r => r.game.code === g.code)) g.code = newGame(secret).code;
  await store.save(g); roomFor(g); res.json({ gameId: g.id, token: secret, role: 'host', name: g.name });
});
app.get('/api/rooms/:code', (req, res) => { const r = [...rooms.values()].find(r => r.game.code === req.params.code.toUpperCase()); if (!r) { res.status(404).json({ error: 'Room not found. Check the six-character code.' }); return; } res.json({ name: r.game.name, teams: r.game.teams.map(t => ({ id: t.id, name: t.name })), phase: r.game.phase }); });
app.post('/api/join', async (req, res) => {
  const p = z.object({ code: z.string().length(6), name: z.string().trim().min(1).max(40), teamId: z.string().optional(), token: z.string().min(32).max(128) }).parse(req.body);
  const r = [...rooms.values()].find(r => r.game.code === p.code.toUpperCase()); if (!r) throw new Error('Room not found.');
  const result = await enqueue(r, async () => {
    if (r.error) throw new Error(r.error);
    const next = structuredClone(r.game);
    const id = joinPlayer(next, p, online(r));
    if (next.version !== r.game.version) await commit(r, next);
    return id;
  });
  res.json({ gameId: r.game.id, token: p.token, role: 'player', playerId: result, name: r.game.name });
});
app.get('/api/games/:id', (req, res) => { const r = host(req); res.json({ id: r.game.id, name: r.game.name, phase: r.game.phase, savedAt: r.game.savedAt, code: r.game.code, recovery: r.game.recovery }); });
app.delete('/api/games/:id', async (req, res) => {
  if (unavailable.has(String(req.params.id))) { res.status(409).json({ error: 'This game has damaged saves and host access cannot be verified. Its files have not been deleted.' }); return; }
  if (!rooms.has(String(req.params.id))) { res.status(404).json({ error: 'Game not found.' }); return; }
  const r = host(req);
  await enqueue(r, async () => {
    clearTimeout(r.expiry);
    pause(r.game, performance.now());
    r.error = 'Game deletion is pending. Gameplay is stopped.';
    try { await store.delete(r.game.id); }
    catch (error) { r.error = 'Could not delete all saved game files. Check disk permissions and retry deletion.'; emit(r); throw error; }
    r.deleted = true;
    rooms.delete(r.game.id);
    for (const id of [...r.sockets.keys()]) { io.to(id).emit('game-deleted'); io.sockets.sockets.get(id)?.disconnect(true); }
    r.sockets.clear();
  });
  res.json({ ok: true });
});
app.get('/api/games/:id/sample-content', async (req, res) => { host(req); const json = await readFile(new URL('../public/all-features-sample.json', import.meta.url), 'utf8'); res.json(contentSchema.parse(JSON.parse(json))); });
app.get('/api/games/:id/backup', async (req, res) => {
  const r = host(req); const backup = await enqueue(r, async () => { const next = structuredClone(r.game); pause(next, performance.now(), 'Restored from a downloaded backup. Reassign players, then resume.'); next.hostHash = ''; next.processed = {}; for (const p of next.players) p.tokenHash = ''; return next; });
  res.setHeader('Content-Disposition', `attachment; filename="jeopardy-${r.game.code}-backup.json"`); res.json({ exportVersion: 1, game: backup });
});
app.post('/api/import', async (req, res) => {
  if (req.body.exportVersion !== 1) throw new Error('Unsupported backup format.');
  const g = validateGame(req.body.game); const secret = token(); const fresh = newGame(secret, g.name);
  g.id = fresh.id; g.code = fresh.code; while ([...rooms.values()].some(r => r.game.code === g.code)) g.code = newGame(secret).code;
  g.hostHash = hash(secret); g.processed = {}; g.paused = g.phase !== 'lobby' && g.phase !== 'finished'; g.recovery = 'Backup restored as a new room. Players can join; use Claim saved player to restore their identity.';
  if (g.current) { g.current.deadline = null; if (g.current.group) g.current.group.runningSince = null; if (g.current.pixel) g.current.pixel.runningSince = null; } g.finalDeadline = null; for (const p of g.players) p.tokenHash = '';
  await store.save(g); roomFor(g); res.json({ gameId: g.id, token: secret, role: 'host', name: g.name });
});
app.post('/api/games/:id/claim', async (req, res) => {
  const r = host(req); await enqueue(r, async () => {
    if (r.error) throw new Error(r.error); if (!r.game.paused && r.game.phase !== 'lobby') throw new Error('Pause before assigning a saved player.');
    const next = structuredClone(r.game), original = next.players.find(p => p.id === req.body.savedPlayerId), newcomer = next.players.find(p => p.id === req.body.newPlayerId);
    if (!original || original.tokenHash || !newcomer?.tokenHash || original.id === newcomer.id) throw new Error('Choose a saved player and a newly joined player.');
    if (newcomer.selections || next.ledger.some(e => e.playerId === newcomer.id)) throw new Error('This player has already participated.');
    original.tokenHash = newcomer.tokenHash; next.players = next.players.filter(p => p.id !== newcomer.id);
    for (const t of next.teams) { t.queue = t.queue.filter(id => id !== newcomer.id); if (t.captain === newcomer.id) t.captain = original.teamId === t.id ? original.id : null; }
    next.version++; await commit(r, next);
    for (const [id, actor] of r.sockets) if (actor.playerId === newcomer.id) { actor.playerId = original.id; io.sockets.sockets.get(id)!.data.actor = actor; }
    emit(r);
  }); res.json({ ok: true });
});
app.post('/api/games/:id/retry-storage', async (req, res) => { const r = host(req); await enqueue(r, async () => { const { game, warning } = await store.load(r.game.id); game.paused = game.phase !== 'lobby' && game.phase !== 'finished'; if (game.current) { game.current.deadline = null; if (game.current.group) game.current.group.runningSince = null; } game.finalDeadline = null; game.recovery = warning || 'Storage recovered. Review the last saved state before resuming.'; game.version++; await commit(r, game); }); res.json({ ok: true }); });

io.use((socket, next) => { try {
  rate(`connect:${socket.handshake.address}`, 120);
  const auth = z.object({ gameId: z.string().uuid(), token: z.string().max(128).optional(), role: z.enum(['host', 'player', 'display']), code: z.string().optional(), statePatches: z.boolean().optional() }).parse(socket.handshake.auth);
  const r = find(auth.gameId);
  const actor: Actor = auth.role === 'display' && auth.code === r.game.code ? { role: 'display' } : authenticate(r.game, auth.token || '');
  socket.data.statePatches = auth.statePatches === true; socket.data.room = r; socket.data.actor = actor; next();
} catch (e: any) { next(new Error(e.message)); } });
io.on('connection', (socket: Socket) => {
  const r: Room = socket.data.room, actor: Actor = socket.data.actor;
  if (actor.role === 'player' && !r.game.players.some(p => p.id === actor.playerId)) { socket.emit('player-kicked'); socket.disconnect(true); return; }
  r.sockets.set(socket.id, actor); emit(r);
  if (actor.role === 'player') enqueue(r, async () => {
    if (r.error) return;
    const next = structuredClone(r.game);
    advanceTimers(next, performance.now());
    if (fillMissingRepresentatives(next, online(r))) await commit(r, next);
  }).catch(console.error);
  socket.on('sync', () => { if (!r.deleted) sendState(r, socket, actor, true); });
  socket.on('command', (raw: unknown, ack: (value: unknown) => void) => {
    if (typeof ack !== 'function') return;
    const received = performance.now();
    try {
      rate(`command:${socket.id}`, 120, 10000);
      const command: Command = z.object({ id: z.string().uuid(), type: z.string().max(40), payload: z.any().optional(), version: z.number().int().optional() }).parse(raw);
      enqueue(r, async () => { if (r.error) throw new Error(r.error); const next = structuredClone(r.game); const changed = applyCommand(next, socket.data.actor, command, received, online(r)); if (changed) { await commit(r, next); if (command.type === 'kick-player') { for (const [id, connectedActor] of [...r.sockets]) if (connectedActor.playerId === command.payload?.playerId) { r.sockets.delete(id); io.to(id).emit('player-kicked'); io.sockets.sockets.get(id)?.disconnect(true); } emit(r); } } return { ok: true }; }).then(ack, e => ack({ ok: false, error: e.message }));
    } catch (e: any) { ack({ ok: false, error: e.message }); }
  });
  socket.on('disconnect', () => {
    r.sockets.delete(socket.id); emit(r);
    const now = performance.now();
    if (actor.role === 'host') enqueue(r, async () => { if (!hasHost(r) && !r.game.paused && r.game.phase !== 'finished' && r.game.phase !== 'lobby' && !r.error) { const next = structuredClone(r.game); pause(next, now, 'Host disconnected. Resume when the host returns.'); next.version++; await commit(r, next); } }).catch(console.error);
  });
});
let ticking = false;
const interval = setInterval(async () => {
  if (ticking) return; ticking = true;
  try { await Promise.all([...rooms.values()].map(r => {
    if (r.error || r.game.paused || (r.game.current?.deadline == null && r.game.finalDeadline === null && r.game.current?.group?.runningSince == null && r.game.current?.pixel?.runningSince == null)) return;
    const now = performance.now(); return enqueue(r, async () => { if (r.error || r.game.paused || (r.game.current?.deadline == null && r.game.finalDeadline === null && r.game.current?.group?.runningSince == null && r.game.current?.pixel?.runningSince == null)) return; const next = structuredClone(r.game); const before = `${next.phase}:${next.current?.state}`; advanceTimers(next, now); if (`${next.phase}:${next.current?.state}` !== before) next.version++; await commit(r, next); }).catch(console.error);
  })); } finally { ticking = false; }
}, 1000);
const sweep = setInterval(() => { for (const [key, b] of attempts) if (Date.now() - b.since > 60000) attempts.delete(key); }, 60000);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: error instanceof z.ZodError ? error.issues[0].message : error.message || 'Request failed.' }); });
if (process.argv.includes('--production')) { app.use(express.static(path.resolve('dist'))); app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html'))); }
else { const { createServer } = await import('vite'); const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
const port = Number(process.env.PORT || 3000);
http.listen(port, '0.0.0.0', () => console.log(`Jeopardy is running at http://localhost:${port}\nSave directory: ${store.root}`));
let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; clearInterval(interval); clearInterval(sweep); await Promise.all([...rooms.values()].map(r => enqueue(r, async () => { if (r.game.phase !== 'finished' && !r.error) { const next = structuredClone(r.game); pause(next, performance.now(), 'Server restarted. Resume when ready.'); await commit(r, next); } }).catch(console.error))); await unlock(); io.close(); http.close(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);


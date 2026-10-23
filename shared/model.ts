import { puzzleSchema, puzzleStateSchema, puzzleReady } from './puzzles';
import { z } from 'zod';

export const text = z.string().trim().min(1).max(4000);
export const imageSchema = z.string().max(180000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/);
export const gameLinkSchema = z.string().max(2000).refine(value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }, 'Enter a full HTTPS game link.');
export const clueSchema = z.object({
  prompt: z.string().max(4000), answer: z.string().max(4000), used: z.boolean(),
  quotes: z.array(z.object({ text: z.string().max(4000), source: z.string().max(300), image: imageSchema.optional(), imageAlt: z.string().max(200).optional() })).length(3).optional(),
  zoom: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  image: imageSchema.optional(), imageAlt: z.string().max(200).optional(),
  kind: z.enum(['question', 'group']).optional(), link: z.union([z.literal(''), gameLinkSchema]).optional(),
  linkLabel: z.string().max(80).optional(), groupMode: z.enum(['time', 'score']).optional(), scoreOrder: z.enum(['higher', 'lower']).optional(), boost: z.boolean().optional(), puzzle: puzzleSchema.optional()
});
export type ClueData = z.infer<typeof clueSchema>;
export const isClueReady = (q: ClueData) => !!q.prompt.trim() && (!q.zoom || (!!q.image && q.kind !== 'group' && !q.boost)) && (!q.quotes || (q.kind !== 'group' && !q.boost && q.quotes.every(quote => !!quote.text.trim() || !!quote.image))) && (q.kind === 'group' ? q.puzzle ? puzzleReady(q.puzzle) && !q.boost : !!q.link && gameLinkSchema.safeParse(q.link).success && !q.boost : !!q.answer.trim());
export const categorySchema = z.object({ exampleMode: z.boolean().optional(), collectAnswers: z.boolean().optional(), submissionScope: z.enum(['player', 'team']).optional(), pixelPerfect: z.boolean().optional(), teamBased: z.boolean().optional(), openToAll: z.boolean().optional(), title: z.string().max(100), description: z.string().max(2000).optional(), clues: z.array(clueSchema).length(5) });
export const boardSchema = z.array(categorySchema).min(5).max(6);
export const contentSchema = z.object({
  name: z.string().trim().min(1).max(100), boards: z.array(boardSchema).length(2),
  final: z.object({ category: z.string().max(100), prompt: z.string().max(4000), answer: z.string().max(4000) })
});
export type Content = z.infer<typeof contentSchema>;
const teamSchema = z.object({ id: z.string(), name: z.string().min(1).max(40), score: z.number().int(), captain: z.string().nullable(), queue: z.array(z.string()), last: z.string().nullable() });
const playerSchema = z.object({ id: z.string(), name: z.string().min(1).max(40), teamId: z.string(), tokenHash: z.string(), active: z.boolean(), selections: z.number().int().nonnegative() });
const currentSchema = z.object({ example: z.boolean().optional(), exampleClue: clueSchema.optional(),
  id: z.string(), category: z.number().int().min(0).max(5), row: z.number().int().min(0).max(4),
  state: z.enum(['revealed', 'restricted', 'open', 'answering', 'resolved']),
  representatives: z.record(z.string()), lockedTeams: z.array(z.string()),
  winner: z.string().nullable(), buzzId: z.string().nullable(), previous: z.enum(['restricted', 'open']),
  remainingMs: z.number().nonnegative().max(20000), deadline: z.number().nullable(), revealedAnswer: z.boolean(),
  quotesRevealed: z.number().int().min(1).max(3).optional(),
  pixel: z.object({ elapsedMs: z.number().min(0).max(30000), runningSince: z.number().nullable() }).optional(),
  boost: z.object({ teamId: z.string(), wager: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).nullable().optional(),
  group: z.object({
    puzzle: puzzleStateSchema.optional(), status: z.enum(['ready', 'playing', 'review']), mode: z.enum(['time', 'score']),
    elapsedMs: z.number().nonnegative(), runningSince: z.number().nullable(),
    timeLimitMs: z.number().positive().optional(), penalties: z.record(z.number()).optional(),
    presentation: z.object({ teamId: z.string().nullable(), revealed: z.array(z.string()), judgments: z.record(z.boolean()) }).optional(),
    teamAnswers: z.boolean().optional(), submissionScope: z.enum(['player', 'team']).optional(),
    submissions: z.record(z.object({ score: z.string().max(100).nullable(), seconds: z.number().nonnegative().nullable(), submittedAt: z.string(), revision: z.number().int().positive() })),
    selectorBeforeAwards: z.string().nullable().optional(),
    awards: z.record(z.object({ points: z.number().int(), reason: z.string().max(200), entryId: z.string(), place: z.number().int().min(1).max(2).optional() }))
  }).optional()
});
const ledgerSchema = z.object({ id: z.string(), teamId: z.string(), amount: z.number().int(), reason: z.string(), at: z.string(), playerId: z.string().optional() });
const finalEntrySchema = z.object({ score: z.number().int(), wager: z.number().int().nonnegative().nullable(), answer: z.string().max(4000), submitted: z.boolean(), judged: z.boolean(), correct: z.boolean().nullable() });
export const gameSchema = contentSchema.extend({
  schemaVersion: z.literal(1), id: z.string().uuid(), code: z.string().regex(/^[A-Z0-9]{6}$/),
  hostHash: z.string(), version: z.number().int().nonnegative(), savedAt: z.string(),
  phase: z.enum(['lobby', 'board', 'final-wager', 'final-answer', 'final-judge', 'finished']),
  board: z.number().int().min(0).max(1), teams: z.array(teamSchema).min(2).max(12), players: z.array(playerSchema).max(100),
  nextRepresentatives: z.record(z.string()).optional(),
  autoSounds: z.boolean().optional(), soundCue: z.object({id:z.string(),kind:z.enum(['applause','awww','stop'])}).optional(),
  intermission: z.boolean().optional(), exampleCategories: z.array(z.string()).optional(),
  musicPlaying: z.boolean().optional(),
  instructionsVisible: z.boolean().optional(),
  introCategory: z.number().int().min(0).max(5).nullable().optional(), selectorTeamId: z.string().nullable().optional(),
  current: currentSchema.nullable(), paused: z.boolean(), recovery: z.string().nullable(),
  ledger: z.array(ledgerSchema), processed: z.record(z.object({ actor: z.string() })),
  finalPresentation: z.object({ teamId: z.string().nullable(), answers: z.array(z.string()), wagers: z.array(z.string()) }).optional(),
  finalEntries: z.record(finalEntrySchema), finalRemainingMs: z.number().min(0).max(30000), finalDeadline: z.number().nullable(),
  undo: z.object({ current: currentSchema, selectorTeamId: z.string().nullable().optional(), teamId: z.string(), amount: z.number().int(), entryId: z.string() }).nullable()
});
export type Game = z.infer<typeof gameSchema>;
export type Player = Game['players'][number];
export type Current = NonNullable<Game['current']>;
export type Actor = { role: 'host' | 'player' | 'display'; playerId?: string };
export type Command = { id: string; type: string; payload?: any; version?: number };
export type Session = { gameId: string; token: string; role: 'host' | 'player' | 'display' };
export type View = Omit<Game, 'hostHash' | 'processed' | 'undo' | 'players' | 'teams'> & {
  players: Omit<Player, 'tokenHash'>[]; teams: Omit<Game['teams'][number], 'queue' | 'last'>[];
  online: string[]; role: Actor['role']; playerId?: string; canUndo: boolean; serverNow: number; storageError: string | null; wagerReady: string[]; unclaimed: string[];
};

export function emptyContent(): Content {
  return { name: 'Friday Night Jeopardy', boards: [0, 1].map(() => Array.from({ length: 6 }, () => ({ title: '', clues: Array.from({ length: 5 }, () => ({ prompt: '', answer: '', used: false })) }))), final: { category: '', prompt: '', answer: '' } };
}
export function points(board: number, row: number) { return (board + 1) * (row + 1) * 100; }
export const money = (n: number) => new Intl.NumberFormat('en-US').format(n);

export function activeTeamPlayer(v: View, teamId: string): string | null {
  const c = v.current;
  if (!c && v.phase === 'board') return v.players.find(p => p.id === v.nextRepresentatives?.[teamId] && p.active)?.id ?? null;
  if (!c || c.group || c.lockedTeams.includes(teamId) || c.state === 'resolved' || c.state === 'open') return null;
  if (c.state === 'answering') return v.players.find(p => p.id === c.winner && p.teamId === teamId)?.id ?? null;
  return v.players.find(p => p.id === c.representatives[teamId] && p.active)?.id ?? null;
}

import { z } from 'zod';
export const puzzleSchema = z.object({
  type: z.enum(['bomb', 'code', 'timeline', 'relay']),
  relayExpressions: z.array(z.string().max(200).regex(/^(?:[0-9]+|__)(?: [＋+−×÷] [0-9]+){1,7}$/)).length(4).optional(),
  relayDifficulty: z.number().int().min(1).max(5).optional(),
  relayOperations: z.array(z.enum(['add','subtract','multiply','divide'])).min(1).max(10).optional(),
  message: z.string().max(4000), instructions: z.string().max(4000).optional(),
  hints: z.array(z.string().max(2000)).max(30),
  items: z.array(z.string().max(200)).max(20),
  solution: z.array(z.string().max(200)).max(20),
  answers: z.array(z.string().max(500)).max(20)
});
export type Puzzle = z.infer<typeof puzzleSchema>;
export const puzzleStateSchema = z.object({ audienceBomb:z.object({items:z.array(z.string()),hints:z.array(z.string()),solution:z.array(z.string()).optional(),progress:z.array(z.string()),mistakes:z.number(),defused:z.boolean(),lockedUntil:z.number()}).optional(), audienceRelay: z.object({expressions:z.array(z.string()).length(4),answer:z.number().optional(),revealed:z.boolean()}).optional(), teams: z.record(z.object({
  relay: z.object({ order: z.array(z.string()), answer: z.number().optional() }).optional(),
  colors: z.record(z.string()).optional(),
  operator: z.string(), assignments: z.record(z.array(z.string().max(2400))),
  mistakes: z.number().int().nonnegative(), progress: z.array(z.string()),
  finishedMs: z.number().nonnegative().nullable(), lockedUntil: z.number().nonnegative()
})) });
export function puzzleReady(p: Puzzle) {
  if (!p.message.trim()) return false;
  if (p.type === 'relay') return true;
  if (p.type === 'code') return p.answers.some(a => a.trim()) && p.hints.length > 0 && p.hints.every(h => h.trim());
  return p.items.length >= 2 && p.items.every(i => i.trim()) && new Set(p.items).size === p.items.length && (p.type === 'bomb' ? p.items.length <= 5 && p.solution.length > 0 && p.solution.length <= p.items.length : p.solution.length === p.items.length) && new Set(p.solution).size === p.solution.length && p.solution.every(i => p.items.includes(i)) && (p.type === 'timeline' ? p.hints.length === p.items.length && p.hints.every(h => h.trim()) : p.hints.length > 0 && p.hints.every(h => h.trim()));
}
export function samplePuzzle(type: Puzzle['type']): Puzzle {
  if (type === 'relay') return { type, message: 'Pass each answer to the next teammate. Only the final player submits.', relayDifficulty: 2, relayOperations: ['multiply','subtract','divide','add'], items: [], solution: [], answers: [], hints: [] };
  if (type === 'code') return { type, message: 'H V R U — What four-letter word is hidden here?', items: [], solution: [], answers: ['ROSE'], hints: ['Each letter was shifted forward by the same amount.', 'The shift is the number of sides on a triangle.', 'Read the encrypted message backward before decoding.', 'The answer grows in a garden.'] };
  if (type === 'timeline') return { type, message: 'Arrange these events from earliest to latest.', items: ['First powered flight', 'Moon landing', 'World Wide Web proposed'], solution: ['First powered flight', 'Moon landing', 'World Wide Web proposed'], answers: [], hints: ['The Wright brothers flew in 1903.', 'Apollo 11 landed in 1969.', 'Tim Berners-Lee proposed the Web in 1989.'] };
  return { type, message: 'Cut all four wires in the correct order.', items: ['Red ★', 'Blue ●', 'Yellow ▲', 'Green ■'], solution: ['Blue ●', 'Green ■', 'Red ★', 'Yellow ▲'], answers: [], hints: ['The circle is cut first.', 'The square follows the circle.', 'The star comes immediately before the triangle.', 'The triangle is last.'] };
}

export function puzzleInstructions(type: Puzzle['type']): string {
  const shared = 'When the host starts, each teammate receives private clues. Discuss your clues with your team. One operator uses the controls to submit your solution.';
  if (type === 'relay') return 'Each team gets at least four expressions in relay order. Teams with fewer than four players repeat players in the order, so some players get multiple numbered steps. Teams of four or more get one expression per player. Use PEMDAS to solve your expression, then tell the next player your result. Multiplication and division are evaluated left to right, followed by addition and subtraction left to right. Use the previous answer in the blank. Only the final player submits. Wrong answers add a mistake and lock submissions for one second. Fastest completion wins. Each mistake costs half the clue value when results are shown.';
  if (type === 'bomb') return 'Cut the bomb wires in the correct order to successfully defuse the bomb. Clues are shared among teammates, with one player operating the bomb panel. The operator also receives a clue; some clues are shared when players outnumber clues. Some wires may need to remain uncut. Combine the clues to successfully cut the bomb. Fastest completion wins. Each mistake costs half the clue value when results are shown.';
  if (type === 'code') return shared + '\nCombine your clues to decode the shared message. Your operator submits the answer. Wrong answers count as mistakes. Fastest completion wins. Each mistake costs half the clue value when results are shown.';
  return shared + '\nEach teammate receives event clues. Help your operator arrange all events from earliest to latest. Incorrect orders lock your team out for 10 seconds. Fastest correct completion wins.';
}

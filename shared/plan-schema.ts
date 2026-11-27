import {newRectangles} from './rectangles';
import { z } from 'zod';
import { newTower, validateTowerStacks, type Plan } from './plan';

const text=z.string().max(2000), index=z.number().int().min(0).max(2), side=z.number().int().min(0).max(1);
const integer=z.number().int().safe(), count=z.number().int().safe().min(0);
const three=<T extends z.ZodTypeAny>(schema:T)=>z.array(schema).length(3);
const two=<T extends z.ZodTypeAny>(schema:T)=>z.array(schema).length(2);
const currentPlanSchema:z.ZodType<Plan>=z.object({
 rectangles:z.object({winner:index.optional(),difficulty:z.enum(['easy','medium','hard']),grid:z.array(z.array(z.union([z.number().int().min(-99).max(99).nullable(),z.literal('hole')])).min(2).max(12)).min(2).max(8).refine(g=>g.every(r=>r.length===g[0].length)),target:integer,mode:z.enum(['exact','at-least']),phase:z.enum(['ready','open','answer','result']),locked:three(z.boolean()),buzz:index.nullable(),roundDeadline:z.number().nullable(),result:text}),version:z.literal(1),orderVersion:z.literal(2),remainingGames:z.array(index.or(z.literal(3)).or(z.literal(4))).max(4).optional(),musicPlaying:z.boolean(),teams:three(z.object({name:z.string().min(1).max(30),score:integer})),
 phase:z.enum(['setup','wager','rules','play','ranking','result','complete']),game:z.number().int().min(0).max(4),
 wagers:three(count),points:three(z.number().finite().refine(n=>Number.isSafeInteger(n*2))),pair:z.number().int().min(0).max(3),matchReady:z.boolean(),
 bet:z.object({team:index,pick:index,amount:count}).nullable(),matches:z.array(z.object({pair:index,winner:index.nullable()})).max(3),ranks:z.array(index).max(3),history:z.array(text).max(10000),deadline:z.number().finite().min(0).nullable(),
 poker:z.object({flipStarted:z.number().finite().optional(),cards:z.array(z.object({rank:z.number().int().min(2).max(14),suit:z.number().int().min(0).max(3)})).length(19),phase:z.enum(['ready','flipping','memorize','answer','review','reveal']),revealed:three(z.boolean()),answers:three(text),hands:z.array(text).max(3),result:text}),
 tower:z.object({motion:z.object({blocks:z.array(text).max(16),flip:z.boolean(),sequence:count}).optional(),stacks:z.array(z.array(z.string().regex(/^(?:[+−×])?[2357]$/)).max(16)).length(4),target:integer,height:z.number().int().min(1).max(16),phase:z.enum(['ready','bid','challenge','build','result']),bids:z.array(z.object({team:index,moves:z.number().int().min(1).max(99),value:z.union([z.literal(1),z.literal(2)])})).max(3),moves:count,result:text}),
 equation:z.object({simultaneous:z.literal(true),secrets:two(text),guesses:z.array(z.object({team:side,text:z.string().length(9),lights:z.array(z.enum(['red','yellow','green'])).length(9)})).max(1000),turn:side,solved:two(z.boolean()),phase:z.enum(['setup','play','result']),result:text,winner:index.nullable()}),
 gradation:z.object({rows:two(z.array(z.number().int().min(0).max(9)).max(7)),used:two(z.array(z.number().int().min(0).max(6)).max(7)),selected:two(z.number().int().min(0).max(6).nullable()),lead:side,points:two(count),streak:two(count),phase:z.enum(['setup','lead','reply','reveal','set']),result:text,winner:index.nullable()}),
 word:z.object({usedWords:z.array(text).max(200).optional(),envelopes:three(z.array(text).max(5)),chosen:z.array(text).length(6),turn:z.number().int().min(0).max(5),stage:z.number().int().min(1).max(3),practice:z.boolean().optional(),fallbackClue:z.object({word:text,score:z.number().min(0).max(100)}).optional(),phase:z.enum(['setup','clue','fallback','guess','reveal','done']),clues:z.array(z.object({word:text,score:z.number().min(0).max(100),stage:z.number().int().min(1).max(3)})).max(33),guesses:three(text),result:text,next:z.boolean()})
}).superRefine((s,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 try{validateTowerStacks(s.tower.stacks);}catch{fail('Tower needs the 16 distinct number, addition, subtraction, and multiplication blocks for 2, 3, 5, 7.');}
 if(['build','challenge'].includes(s.tower.phase)&&!s.tower.bids.length)fail('Tower needs a bidder.');
 if(s.phase==='play'&&(s.game===1||s.game===3)&&s.pair>=3)fail('Invalid active pairing.');
 if(s.gradation.phase!=='setup'&&s.gradation.rows.some(a=>a.length!==7))fail('Incomplete cube arrangements.');
 if(s.equation.phase!=='setup'&&s.equation.secrets.some(a=>a.length!==9))fail('Incomplete equations.');
 if(s.phase==='result'&&(s.ranks.length!==3||new Set(s.ranks).size!==3))fail('Invalid placements.');
});

// Upgrade the original nine-block save without discarding team totals or gauntlet progress.
function migratePlanSave(input: unknown): unknown {
 if(!input||typeof input!=='object')return input;
 const s=structuredClone(input) as Plan;
 if(s.version!==1||!Array.isArray(s.tower?.stacks)||!s.tower.stacks.every(Array.isArray))return input;
 if(s.tower.stacks.flat().length===9){
   s.tower=newTower();
   if(Array.isArray(s.history))s.history.push('Tower upgraded to the 16-block set. The current tower puzzle was reset; team scores and wagers were preserved.');
   if(s.game===0&&s.phase==='play'){s.phase='rules';s.deadline=null;}
 }
 if(!s.rectangles){s.rectangles=newRectangles();s.tower=newTower();if(s.game===0&&['play','rules'].includes(s.phase)){s.phase='rules';s.points=[0,0,0];s.deadline=null;s.history.push('Tower replaced with Count the Rectangles. Current game points reset; gauntlet balances and wagers preserved.');}}
 if(!s.orderVersion){
 const oldGame=s.game;
 if(oldGame===1||oldGame===2){s.game=oldGame===1?2:1;s.remainingGames=Array.from({length:4-oldGame},(_,i)=>oldGame+i+1).map(n=>n===1?2:n===2?1:n);}
 s.orderVersion=2;
 }
 s.rectangles.difficulty??='easy';
 s.musicPlaying??=false;
 if(s.game===0&&s.rectangles.phase==='answer')s.deadline=null;
 if(s.poker)s.poker.revealed??=[0,1,2].map(()=>s.poker.phase==='reveal');
 if(s.equation&&!s.equation.simultaneous){s.equation.simultaneous=true;if(s.equation.phase==='play'&&s.equation.guesses.length%2){s.equation.guesses.pop();s.equation.solved=[false,false];}s.equation.turn=0;}

 return s;
}
export const planSchema=z.preprocess(migratePlanSave,currentPlanSchema);

import { planSchema } from '../shared/plan-schema';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPlan, newPoker, pokerRank, compareHands, arithmetic, validEquation, equationLights, parseRow, parseCards, wager, moveTower, gradeTower, settleGame, settleMatch, nextGame, publicPlan, towerChallenge, TOWER_BLOCKS, validateTowerStacks, skipGame, adjustPlanScore } from '../shared/plan';

test('poker evaluates wheel, flush, full house and kickers without using suits',()=>{
 const hand=(r:number[],s=[0,1,2,3,0])=>pokerRank(r.map((rank,i)=>({rank,suit:s[i]})));
 assert.equal(hand([14,2,3,4,5]).name,'Straight');
 assert.equal(hand([14,2,3,4,5]).value[1],5);
 assert.equal(hand([10,11,12,13,14],[1,1,1,1,1]).name,'Straight flush');
 assert.equal(hand([4,4,4,7,7]).name,'Full house');
 assert(compareHands(hand([7,7,14,10,3]).value,hand([7,7,14,9,8]).value)>0);
 assert.equal(compareHands(hand([7,7,14,10,3]).value,hand([7,7,14,10,3],[2,3,1,2,3]).value),0);
 for(let i=0;i<40;i++)assert.equal(new Set(newPoker().cards.map(c=>`${c.rank}-${c.suit}`)).size,19);
 assert.deepEqual(parseCards('A, P'),[0,15]);assert.throws(()=>parseCards('A A'));
});
test('equation parser enforces precedence, exact length, zero power and safe syntax',()=>{
 assert.equal(arithmetic('5+3×2'),11);assert.equal(arithmetic('2^3^2'),512);
 assert.equal(arithmetic('9^0'),1);assert.equal(validEquation('12+3*4=24'),'12+3×4=24');
 for(const bad of ['1/0','01+2','alert(1)','0^0','2++2','2^9999'])assert.throws(()=>arithmetic(bad));
 assert.throws(()=>validEquation('12+3×4=25'));
 const lights=equationLights('12+3×4=24','444444444');
 assert.equal(lights.filter(x=>x==='green').length,2);assert.equal(lights.filter(x=>x==='yellow').length,0);
 assert.equal(equationLights('12+3×4=24','421234+×=')[0],'yellow');
});
test('gradation enforces order, supply, sum, and seven cubes',()=>{
 assert.deepEqual(parseRow('0,1,2,4,6,8,9'),[0,1,2,4,6,8,9]);
 assert.deepEqual(parseRow('0 0 1 1 2 2 3'),[0,0,1,1,2,2,3]);
 for(const row of ['0 0 0 1 2 3 4','9 8 6 4 2 1 0','1 2 3','3 4 5 6 7 8 9','0 1 2 3 4 5 10'])assert.throws(()=>parseRow(row));
});
test('tower group flip counts as one move and exact bid controls scoring',()=>{
 const s=newPlan();s.tower.phase='build';s.tower.bids=[{team:0,moves:1,value:2}];
 s.tower.stacks=[['×5','+3','2'],[],TOWER_BLOCKS.filter(b=>!['×5','+3','2'].includes(b)),[]];
 moveTower(s.tower,0,0,3,true);assert.deepEqual(s.tower.stacks[0],['2','+3','×5']);
 gradeTower(s);assert.equal(s.points[0],2);
 s.tower.phase='build';s.tower.bids=[{team:1,moves:2,value:1}];s.tower.moves=0;
 gradeTower(s);assert.equal(s.points[1],-1);
 assert.throws(()=>moveTower(s.tower,0,1,1,false));
 for(let i=0;i<30;i++){const c=towerChallenge(newPlan().tower.stacks);assert(c.height>=3&&c.height<=5&&Number.isInteger(c.target));}
});
test('placement settlement is once only, score ordered, and wagers pay even money',()=>{
 const s=newPlan();s.phase='ranking';s.points=[5,2,1];s.wagers=[200,100,1000];
 assert.throws(()=>settleGame(s,[1,0,2]));assert.throws(()=>settleGame(s,[0,0,2]));
 settleGame(s,[0,1,2]);assert.deepEqual(s.teams.map(t=>t.score),[1500,1100,100]);
 assert.throws(()=>settleGame(s,[0,1,2]));
 nextGame(s);assert.equal(s.game,1);assert.equal(s.phase,'wager');assert.deepEqual(s.wagers,[0,0,0]);
 for(const n of [-1,1.2,NaN,Infinity,1001])assert.throws(()=>wager(n,1000));wager(1000,1000);
});
test('round robin settles spectator bets and all three wins exactly once',()=>{
 const s=newPlan();s.phase='play';s.game=1;s.wagers=[900,900,900];
 for(const [pair,winner,idle] of [[0,0,2],[1,2,1],[2,1,0]]){
 s.matchReady=true;s.bet={team:idle,pick:winner,amount:100};assert.equal(s.pair,pair);settleMatch(s,winner);
 }
 assert.deepEqual(s.points,[1,1,1]);assert(s.teams.every(t=>t.score===1100));assert.equal(s.phase,'ranking');
 assert.throws(()=>settleMatch(s,0));settleGame(s,[2,0,1]);assert.equal(s.teams[2].score,1300);
});
test('audience snapshot never includes unrevealed secrets or pending answers',()=>{
 const s=newPlan();s.phase='wager';assert(!JSON.stringify(publicPlan(s)).includes('Count the Rectangles'));
 s.phase='play';s.game=1;s.matchReady=true;s.equation.secrets=['12+3×4=24','30−6×2=18'];
 assert(!JSON.stringify(publicPlan(s)).includes('12+3×4=24'));
 s.game=4;s.word.phase='clue';s.word.chosen[0]='SECRETWORD';s.word.guesses=['','PRIVATEGUESS',''];
 assert(!JSON.stringify(publicPlan(s)).includes('SECRETWORD'));assert(!JSON.stringify(publicPlan(s)).includes('PRIVATEGUESS'));
 s.game=2;s.poker.phase='answer';s.poker.answers=['A P','B C','D E'];assert(!JSON.stringify(publicPlan(s)).includes('A P'));
 s.game=3;s.gradation.rows=[[0,1,2,4,6,8,9],[0,1,2,4,6,8,9]];s.gradation.phase='reply';s.gradation.selected=[6,null];
 const v=publicPlan(s);assert.equal(v.cups![0].selected!.shade,'Dark');assert.equal(v.cups![0].selected!.value,undefined);assert(!JSON.stringify(v).includes('0,1,2,4,6,8,9'));
});

test('new tower inventory has every requested block exactly once, with no division',()=>{
 const s=newPlan(),blocks=s.tower.stacks.flat();
 assert.equal(blocks.length,16);assert.equal(new Set(blocks).size,16);
 for(const n of [2,3,5,7])for(const op of ['','+','−','×'])assert(blocks.includes(op+n));
 validateTowerStacks(s.tower.stacks);
 assert.throws(()=>validateTowerStacks([['÷2',...blocks.slice(1)],[],[],[]]));
 assert.throws(()=>validateTowerStacks([[...blocks.slice(1),'3'],[],[],[]]));
 assert(planSchema.safeParse(s).success);
 s.tower.bids=[{team:1,moves:3,value:1}];s.tower.phase='challenge';s.phase='play';
 
 s.tower.phase='build';s.deadline=Date.now()-5000;
 
 assert.equal(planSchema.parse(s).deadline,s.deadline);
});

test('legacy saves upgrade tower without losing scores, bets or other games',()=>{
 const s=newPlan();s.phase='play';s.teams[0].score=1200;s.wagers=[100,200,300];s.points=[3,2,1];
 s.tower.stacks=[['2','+3','×4'],['5','−2','×3'],['7','+4','÷2'],[]];
 const upgraded=planSchema.parse(s);
 assert.equal(upgraded.tower.stacks.flat().length,16);assert.equal(upgraded.phase,'rules');
 assert.equal(upgraded.teams[0].score,1200);assert.deepEqual(upgraded.wagers,s.wagers);assert.deepEqual(upgraded.points,s.points);
 s.game=1;assert.equal(planSchema.parse(s).phase,'play');
});

test('skip moves through all games, voids outstanding wagers and preserves settled scores',()=>{
 const s=newPlan();s.phase='play';s.teams[0].score=1100;s.points=[4,2,1];s.wagers=[100,100,100];
 s.bet={team:2,pick:0,amount:200};s.deadline=Date.now()+30000;
 skipGame(s);assert.equal(s.game,1);assert.equal(s.phase,'wager');assert.equal(s.teams[0].score,1100);
 assert.deepEqual(s.points,[0,0,0]);assert.deepEqual(s.wagers,[0,0,0]);assert.equal(s.bet,null);assert.equal(s.deadline,null);
 for(let i=0;i<4;i++)skipGame(s);
 assert.equal(s.phase,'complete');assert(planSchema.safeParse(s).success);
 assert.throws(()=>skipGame(s));
});

test('host adjustments separate game and overall scores, retain wagers, and persist',()=>{
 const s=newPlan();s.phase='play';s.wagers=[500,0,0];
 adjustPlanScore(s,0,'overall',800);adjustPlanScore(s,0,'game',-2);
 assert.equal(s.teams[0].score,800);assert.equal(s.points[0],-2);
 assert.throws(()=>adjustPlanScore(s,0,'overall',499));
 s.bet={team:0,pick:1,amount:100};assert.throws(()=>adjustPlanScore(s,0,'overall',550));
 adjustPlanScore(s,1,'overall',-100);wager(0,-100);assert.throws(()=>wager(1,-100));
 assert(planSchema.safeParse(s).success);assert(s.history.every(h=>h.includes('Host adjustment')));
 assert.throws(()=>adjustPlanScore(s,0,'game',NaN));assert.throws(()=>adjustPlanScore(s,0,'game',2.25));
 s.phase='result';assert.throws(()=>adjustPlanScore(s,0,'game',10));
});

test('every game has a rules-only audience phase before play',()=>{
 const s=newPlan();s.phase='rules';
 for(let i=0;i<5;i++){
 s.game=i;const screen=publicPlan(s);
 assert(screen.rules&&screen.rules.length>2);assert.equal(screen.message,'How to play');
 assert.equal(screen.stacks,undefined);assert.equal(screen.cards,undefined);assert.equal(screen.rows,undefined);
 }
});

import {countRectangles,newRectangles} from '../shared/rectangles';
import {lockPokerAnswers,revealPokerTeam,submitEquationRound,pokerHandName} from '../shared/plan';
test('rectangle counts include single cells, overlaps, blank areas and negative cancellation',()=>{
 assert.equal(countRectangles([[1,2,1]],3),2);
 assert.equal(countRectangles([[null,null],[null,null]],0),9);
 assert.equal(countRectangles([[2,-2]],0),1);
 assert.equal(countRectangles([[1,2,1]],3,'at-least'),3);
 for(let i=0;i<30;i++){const r=newRectangles();assert(countRectangles(r.grid,r.target)>0);}
 const s=newPlan();s.phase='play';s.rectangles.phase='open';assert.equal(publicPlan(s).rectangles?.answer,undefined);s.rectangles.phase='result';assert.equal(publicPlan(s).rectangles?.answer,countRectangles(s.rectangles.grid,s.rectangles.target));
});
test('poker reveals only the chosen team with exactly two chips and scores only after all reveals',()=>{
 const s=newPlan();s.game=2;s.phase='play';s.poker.phase='answer';lockPokerAnswers(s,['AB','CD','EF']);
 assert(publicPlan(s).cards!.every(c=>c.chips.length===0));revealPokerTeam(s,1);
 assert.equal(publicPlan(s).cards!.flatMap(c=>c.chips).length,2);assert(publicPlan(s).cards!.flatMap(c=>c.chips).every(t=>t===1));
 assert.equal(publicPlan(s).handLabels![0],'');assert.deepEqual(s.points,[0,0,0]);assert.throws(()=>revealPokerTeam(s,1));
 revealPokerTeam(s,0);revealPokerTeam(s,2);assert.equal(s.poker.phase,'reveal');assert.throws(()=>revealPokerTeam(s,2));
 assert.equal(pokerHandName([14,14,2,5,9].map((rank,i)=>({rank,suit:i%4}))),'Aces One Pair');
});
test('equation guesses validate atomically and equal-turn solves tie',()=>{
 const s=newPlan();s.phase='play';s.game=1;s.matchReady=true;s.equation.phase='play';s.equation.secrets=['12+3×4=24','30−6×2=18'];
 assert.throws(()=>submitEquationRound(s,['30-6*2=18','bad']));assert.equal(s.equation.guesses.length,0);
 submitEquationRound(s,['30-6*2=18','12+3*4=24']);assert.equal(s.equation.guesses.length,2);assert.equal(s.equation.phase,'result');assert.equal(s.equation.winner,null);
});

test('old Tower saves migrate once without clearing a new rectangle timer',()=>{
 const old:any=newPlan();delete old.rectangles;old.game=0;old.phase='play';old.points=[3,2,1];old.teams[0].score=1400;old.wagers=[200,0,0];old.tower.phase='build';old.tower.bids=[{team:0,moves:1,value:1}];
 const next=planSchema.parse(old);assert.equal(next.phase,'rules');assert.deepEqual(next.points,[0,0,0]);assert.equal(next.teams[0].score,1400);assert.deepEqual(next.wagers,[200,0,0]);next.phase='play';next.rectangles.phase='open';next.deadline=Date.now()+10000;next.rectangles.roundDeadline=next.deadline;assert.equal(planSchema.parse(next).deadline,next.deadline);
});
test('new gauntlets use the requested order and old saves finish remaining games once',()=>{
 const s=newPlan(),names:string[]=[];
 for(let i=0;i<5;i++){s.phase='play';names.push(publicPlan(s).title);skipGame(s);}
 assert.deepEqual(names,['Count the Rectangles','Equation Decrypto','Memory Poker','Gradation','Hidden Word']);
 for(const oldGame of [1,2]){const old:any=newPlan();delete old.orderVersion;old.game=oldGame;old.phase='play';old.points=[3,2,1];const migrated=planSchema.parse(old);assert.equal(migrated.game,oldGame===1?2:1);assert.deepEqual(migrated.points,[3,2,1]);const played:number[]=[];while(migrated.phase!=='complete'){played.push(migrated.game);skipGame(migrated);}assert.deepEqual(played,oldGame===1?[2,1,3,4]:[1,3,4]);}
});
import {publishWordClue,applyClosestClue,wordThreshold,gradePoker} from '../shared/plan';
test('draws advance, refund spectator bets, and tied placements split awards and refund first-place wagers',()=>{
 const s=newPlan();s.phase='play';s.game=1;s.matchReady=true;s.bet={team:2,pick:0,amount:300};settleMatch(s,null);
 assert.equal(s.pair,1);assert.deepEqual(s.points,[0,0,0]);assert.equal(s.teams[2].score,1000);assert.equal(s.matches[0].winner,null);
 for(const [points,expected] of [[[2,2,0],[1250,1250,1000]],[[2,1,1],[1400,1050,1050]],[[0,0,0],[1200,1200,1200]]] as const){
 const p=newPlan();p.game=3;p.phase='ranking';p.points=[...points];p.wagers=[100,100,100];settleGame(p,[0,1,2]);assert.deepEqual(p.teams.map(t=>t.score),expected);assert(planSchema.safeParse(p).success);
 }
});
test('compact cubes, full poker board review, and half point ties persist',()=>{
 assert.deepEqual(parseRow('0011223'),[0,0,1,1,2,2,3]);
 const s=newPlan();s.game=2;s.phase='play';s.poker.phase='answer';s.poker.cards=[{rank:14,suit:0},{rank:14,suit:1},...Array.from({length:14},(_,i)=>({rank:2+i%7,suit:i%4})),{rank:14,suit:2},{rank:14,suit:3},{rank:9,suit:2}];
 lockPokerAnswers(s,['AB','AB','CD']);assert(publicPlan(s).cards!.every(c=>c.card));revealPokerTeam(s,0);revealPokerTeam(s,1);revealPokerTeam(s,2);assert.deepEqual(s.points,[.5,.5,0]);assert(planSchema.safeParse(s).success);
 s.poker.phase='answer';lockPokerAnswers(s,['AB','AB','AB']);revealPokerTeam(s,0);revealPokerTeam(s,1);revealPokerTeam(s,2);assert.deepEqual(s.points,[.5,.5,0]);
});
test('word thresholds increase and ten failed clues trigger an automatic fallback',()=>{
 assert.deepEqual([1,2,3].map(wordThreshold),[90,93,95]);
 const s=newPlan();s.game=4;s.phase='play';s.word.practice=false;s.word.phase='clue';s.word.chosen[0]='forest';s.word.stage=2;
 publishWordClue(s,'trees',92);assert.equal(s.word.phase,'clue');for(let i=1;i<10;i++)publishWordClue(s,'clue'+i,80);assert.equal(s.word.phase,'fallback');
 applyClosestClue(s,'woodland',94);assert.equal(s.word.phase,'guess');assert.equal(s.word.fallbackClue?.word,'woodland');assert(!JSON.stringify(publicPlan(s)).includes('forest'));
});

test('tailored poker deals offer two pair or better and their promised stronger hand with unique cards',()=>{
 const deals=['two-pair','trips','straight','flush','full-house','four-kind','straight-flush'] as const;
 const minimum=[2,3,4,5,6,7,8];
 for(const [index,deal] of deals.entries())for(let round=0;round<60;round++){
  const p=newPoker(deal);assert.equal(p.cards.length,19);assert.equal(new Set(p.cards.map(c=>`${c.rank}-${c.suit}`)).size,19);
  const strengths:number[]=[];
  for(let a=0;a<16;a++)for(let b=a+1;b<16;b++)strengths.push(pokerRank([p.cards[a],p.cards[b],...p.cards.slice(16)]).value[0]);
  assert(Math.max(...strengths)>=minimum[index],deal+' must offer its intended hand');
  assert(Math.max(...strengths)>=2,'Every deal must offer two pair or a higher-ranked hand');
 }
});

import {pokerDealForRoll} from '../shared/plan';
test('poker generation uses the requested weighted distribution',()=>{
 const counts:Record<string,number>={};
 for(let i=0;i<1000;i++){const deal=pokerDealForRoll((i+.5)/1000);counts[deal]=(counts[deal]||0)+1;}
 assert.deepEqual(counts,{'two-pair':250,trips:125,straight:200,flush:200,'full-house':125,'four-kind':50,'straight-flush':50});
 assert.equal(pokerDealForRoll(.25),'trips');assert.equal(pokerDealForRoll(.95),'straight-flush');
});

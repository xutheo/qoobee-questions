import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countRectangles,newRectangles,rectangleExamples,type RectangleCell} from '../shared/rectangles';
import {newPlan,publicPlan} from '../shared/plan';
import {planSchema} from '../shared/plan-schema';
test('holes exclude every crossing rectangle while visible blanks remain countable',()=>{
 const ring:RectangleCell[][]=[[null,null,null],[null,'hole',null],[null,null,null]];
 assert.equal(countRectangles(ring,0),20);
 assert.equal(countRectangles([[1,1,1],[1,'hole',1],[1,1,1]],2),8);
 assert.equal(countRectangles([[1,'hole',1]],2,'at-least'),0);
 assert.equal(countRectangles([[null,null],[null,'hole']],0),5);
});
test('all difficulty levels generate solvable boards and survive save validation',()=>{
 for(const difficulty of ['easy','medium','hard'] as const)for(let i=0;i<30;i++){
 const r=newRectangles(difficulty);assert(countRectangles(r.grid,r.target,r.mode)>=0);assert.equal(r.difficulty,difficulty);
 if(difficulty==='easy'){assert(r.grid.length>=3&&r.grid.length<=5&&r.grid[0].length>=3&&r.grid[0].length<=5);assert.equal(r.grid.flat().includes('hole'),false);}
 if(difficulty==='medium'){assert(r.grid.length>=6&&r.grid.length<=7&&r.grid[0].length>=6&&r.grid[0].length<=7);}
 if(difficulty==='hard'){assert(r.grid.flat().includes('hole'));assert([8,11].includes(r.grid[0].length));}
 const s=newPlan();s.rectangles=r;assert.deepEqual(planSchema.parse(s).rectangles,r);
 }
});
test('opening and wagering audience copy is minimal and legacy puzzles default easy',()=>{
 const s=newPlan(),v=publicPlan(s);assert.equal(v.intro,true);assert.equal(v.title,"Qoobee's Plan");assert.equal(v.subtitle,'');assert.equal(v.message,'');
 s.phase='wager';assert.equal(publicPlan(s).message,'');
 const old:any=structuredClone(s);delete old.rectangles.difficulty;assert.equal(planSchema.parse(old).rectangles.difficulty,'easy');
});

test('pictured puzzles keep their targets and are in the generation pool',()=>{
 const examples=rectangleExamples();assert.equal(countRectangles(examples[1].grid,6),52);assert.equal(countRectangles(examples[2].grid,0),114);assert.deepEqual(examples.map(r=>countRectangles(r.grid,r.target,r.mode)),[0,52,114,1]);
 for(const difficulty of ['medium','hard'] as const)for(const choice of [0,.75]){let i=0;const result=newRectangles(difficulty,()=>i++===0?0:choice);assert.deepEqual(result,examples.filter(e=>e.difficulty===difficulty)[choice===0?0:1]);}
});

test('generation spans all easy dimensions and both complete and perforated medium boards',()=>{
 let seed=123456;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const easy=new Set<string>(),medium=new Set<string>(),holes=new Set<boolean>();
 for(let i=0;i<200;i++){const a=newRectangles('easy',random),b=newRectangles('medium',random);easy.add(a.grid.length+'x'+a.grid[0].length);medium.add(b.grid.length+'x'+b.grid[0].length);holes.add(b.grid.flat().includes('hole'));assert(countRectangles(a.grid,a.target)>0);assert(countRectangles(b.grid,b.target,b.mode)>0);}
 assert.equal(easy.size,9);assert.equal(medium.size,4);assert.equal(holes.size,2);
});

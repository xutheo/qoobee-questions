import {rectangleExamples} from '../shared/rectangles';
import { test, expect, type Page } from '@playwright/test';
import { newPlan, PLAN_GAMES, type Plan } from '../shared/plan';
async function seed(page:Page,s:Plan){await page.goto('/');await page.evaluate(s=>localStorage.setItem('qoobee-plan-v1',JSON.stringify(s)),s);await page.goto('/?plan=host');}
test('memory auto-hides, collects all three answers, reveals once and finishes at five',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=2;s.points=[4,0,0];s.poker.phase='memorize';s.deadline=Date.now()+1500;
 // Team A can make four aces; the other teams cannot.
 s.poker.cards=[{rank:14,suit:0},{rank:14,suit:1},...Array.from({length:14},(_,i)=>({rank:2+i%7,suit:Math.floor(i/7)})),{rank:14,suit:2},{rank:14,suit:3},{rank:9,suit:2}];
 await seed(page,s);const audience=await context.newPage();await audience.goto('/?plan=display');
 await expect(page.getByRole('button',{name:'Lock all answers'})).toBeVisible({timeout:6000});
 await expect(audience.getByRole('img',{name:'Face-down card'})).toHaveCount(16);
 for(const [i,answer] of ['A B','C D','E F'].entries())await page.getByLabel(`Team ${String.fromCharCode(65+i)} · two letters`).fill(answer);
 await expect(audience.getByText('A B',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Lock all answers'}).click();
 await page.getByRole('button',{name:'Reveal Team A’s hand'}).click();
 await expect(audience.getByLabel('Team A chip')).toHaveCount(2);
 await expect(audience.getByLabel('Team B chip')).toHaveCount(0);
 await expect(audience.getByText('Aces Four of a Kind',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reveal Team B’s hand'}).click();
 await page.getByRole('button',{name:'Reveal Team C’s hand'}).click();
 await expect(audience.getByText('Team A wins the round.')).toBeVisible();
 await audience.setViewportSize({width:1280,height:720});expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await audience.screenshot({path:'artifacts/plan-poker-reveal.png',fullPage:true});
 await page.getByRole('button',{name:'Finish Memory Poker'}).click();
 await page.getByRole('button',{name:'Award placements and settle wagers'}).click();
 await expect(page.getByRole('alert')).toContainText('tiebreaker');
 await page.getByLabel('Host-run tiebreaker completed').check();await page.getByRole('button',{name:'Award placements and settle wagers'}).click();
 await expect(page.getByRole('heading',{name:'Game settled'})).toBeVisible();
});
test('equation round robin, private secrets, even-money spectator bets, cyclic tie',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=1;await seed(page,s);
 const audience=await context.newPage();await audience.goto('/?plan=display');
 for(const [match,pair,winnerSide] of [[0,[0,1],0],[1,[0,2],1],[2,[1,2],0]] as const){
 const idle=3-pair[0]-pair[1];await page.getByLabel('Predicted winner').selectOption(String(pair[winnerSide]));
 await page.getByLabel(`Team ${String.fromCharCode(65+idle)} spectator wager`).fill('100');
 await page.getByRole('button',{name:'Lock spectator wager and prepare match'}).click();
 await page.getByLabel(`Equation set by Team ${String.fromCharCode(65+pair[0])}`).fill('12+3*4=24');
 await page.getByLabel(`Equation set by Team ${String.fromCharCode(65+pair[1])}`).fill('30-6*2=18');
 await page.getByRole('button',{name:'Lock equations and start'}).click();
 await expect(audience.getByText('12+3×4=24',{exact:true})).toHaveCount(0);
 await page.getByLabel(`Team ${String.fromCharCode(65+pair[0])}’s guess`).fill(winnerSide===0?'30-6*2=18':'012345678');
 await page.getByLabel(`Team ${String.fromCharCode(65+pair[1])}’s guess`).fill(winnerSide===1?'12+3*4=24':'012345678');
 await page.getByRole('button',{name:'Submit both guesses and show lights'}).click();
 await page.getByRole('button',{name:'Record match winner'}).click();
 }
 await expect(page.getByRole('heading',{name:'Confirm game placements'})).toBeVisible();
 await expect(page.locator('.plan-scores').getByText('1,100',{exact:true})).toHaveCount(3);
 await expect(page.locator('.plan-scores').getByText('Points: 1',{exact:true})).toHaveCount(3);
});
test('gradation hides cup positions, resolves one seven-cup match',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=3;s.matchReady=true;await seed(page,s);
 const audience=await context.newPage();await audience.goto('/?plan=display');
 for(let set=0;set<1;set++){
 await page.getByLabel('Team A · seven numbers').fill('1,2,3,4,5,6,7');
 await page.getByLabel('Team B · seven numbers').fill('0,1,2,3,4,5,6');
 await page.getByRole('button',{name:'Lock cubes and start set'}).click();
 for(let cup=0;cup<7;cup++){
 await page.locator('.plan-cup-controls button').nth(cup).click();
 await page.getByRole('button',{name:'Submit cup',exact:true}).click();
 if(cup===0){await expect(audience.getByText('Dark cup selected',{exact:true})).toBeVisible();await expect(audience.locator('.plan-cup-controls')).toHaveCount(0);}
 await page.locator('.plan-cup-controls button').nth(cup).click();
 await page.getByRole('button',{name:'Submit cup',exact:true}).click();
 await page.getByRole('button',{name:cup===6?'Finish match':'Next cup',exact:true}).click();
 }
 await page.getByRole('button',{name:'Record match winner'}).click();
 }
 await expect(page.getByRole('heading',{name:'Match 2: Team A vs Team C'})).toBeVisible();
 await expect(page.locator('.plan-scores').getByText('Points: 1',{exact:true})).toHaveCount(1);
});
test('hidden word simultaneous guesses, staged setter points and double second round',async({page})=>{
 const s=newPlan();s.phase='play';s.game=4;s.word.practice=false;s.word.envelopes=[['forest','mirror','bridge','pillow','thunder'],['ocean','clock','garden','shadow','bottle'],['candle','window','river','ladder','feather']];await seed(page,s);
 for(let round=0;round<2;round++){
 for(let team=0;team<3;team++)await page.getByLabel(`Secret word for Team ${String.fromCharCode(65+team)}`).selectOption(s.word.envelopes[team][round]);
 await page.getByRole('button',{name:`Lock words and begin round ${round+1}`}).click();
 for(let setter=0;setter<3;setter++){
 await page.getByLabel('Clue word',{exact:true}).fill('related');await page.getByLabel('Similarity (%)',{exact:true}).fill('95');
 await page.getByRole('button',{name:'Publish clue and similarity'}).click();
 for(let i=0;i<3;i++)if(i!==setter)await page.getByLabel(`Team ${String.fromCharCode(65+i)}’s answer`).fill(s.word.envelopes[setter][round]);
 await page.getByRole('button',{name:'Reveal answers and score stage'}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 }
 await expect(page.getByRole('heading',{name:'Confirm game placements'})).toBeVisible();
 await expect(page.locator('.plan-scores').getByText('Points: 6',{exact:true})).toHaveCount(3);
 await page.getByLabel('Host-run tiebreaker completed').check();await page.getByRole('button',{name:'Award placements and settle wagers'}).click();
 await page.getByRole('button',{name:'Show final standings'}).click();await expect(page.getByRole('heading',{name:'Gauntlet complete'})).toBeVisible();
});

test('hidden word setter accumulates stage awards and projection fits a 720p screen',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=4;s.word.practice=false;s.word.phase='guess';s.word.chosen=['forest','ocean','candle','','',''];
 await seed(page,s);
 for(let stage=1;stage<=3;stage++){
 if(stage>1){await page.getByLabel('Clue word',{exact:true}).fill(`clue${stage}`);await page.getByRole('button',{name:'Publish clue and similarity'}).click();}
 await page.getByLabel('Team B’s answer').fill('pass');await page.getByLabel('Team C’s answer').fill('pass');
 await page.getByRole('button',{name:'Reveal answers and score stage'}).click();
 await expect(page.locator('.plan-scores').getByText(`Points: ${stage*(stage+1)/2}`,{exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 const p=newPlan();p.game=2;p.phase='play';p.poker.phase='answer';p.deadline=Date.now()+60000;
 await seed(page,p);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(audience.locator('.plan-card-slot')).toHaveCount(16);
 const overflow=await audience.evaluate(()=>document.documentElement.scrollHeight>window.innerHeight+2);
 expect(overflow).toBe(false);
 await audience.screenshot({path:'artifacts/plan-memory-720.png',fullPage:true});
});

test('host adjusts both score types, undoes, and skips through rules for every game',async({page,context})=>{
 const s=newPlan();s.phase='play';s.wagers=[200,0,0];await seed(page,s);
 const audience=await context.newPage();await audience.goto('/?plan=display');
 await page.getByText('Adjust points',{exact:true}).click();
 await page.getByLabel('Points to add (negative to subtract)').fill('250');
 await page.getByRole('button',{name:'Apply point adjustment'}).click();
 await expect(audience.locator('.plan-scores article').first().getByText('1,250',{exact:true})).toBeVisible();
 await expect(audience.locator('.plan-team-box .score-change.positive')).toHaveText('+250');
 await page.getByLabel('Score to adjust').selectOption('game');
 await page.getByLabel('Points to add (negative to subtract)').fill('4');
 await page.getByRole('button',{name:'Apply point adjustment'}).click();
 await expect(audience.locator('.plan-scores article').first().getByText('Points: 4',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Undo last action'}).click();
 await expect(audience.locator('.plan-scores article').first().getByText('Points: 0',{exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('.plan-scores').getByText('1,250',{exact:true})).toBeVisible();
 for(const name of ['Equation Decrypto','Memory Poker','Gradation','Hidden Word']){
 await page.getByRole('button',{name:'Next game',exact:true}).click();
 await page.getByRole('button',{name:'Skip current game and continue'}).click();
 await expect(page.getByRole('heading',{name:'Category wagers'})).toBeVisible();
 await page.getByRole('button',{name:'Lock wagers and reveal game'}).click();
 await expect(audience.locator('.plan-rules-screen')).toBeVisible();
 await expect(audience.getByRole('heading',{name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:`Start ${name}`,exact:true}).click();
 await expect(audience.locator('.plan-rules-screen')).toHaveCount(0);
 }
 await page.getByRole('button',{name:'End gauntlet',exact:true}).click();
 await page.getByRole('button',{name:'Skip final game and show totals'}).click();
 await expect(page.getByRole('heading',{name:'Gauntlet complete',exact:true})).toBeVisible();
 await expect(page.locator('.stream-final-results').getByText('1,250',{exact:true})).toBeVisible();
});

test('all rules screens fit a 720p audience display',async({page,context})=>{
 const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});
 for(let game=0;game<5;game++){
 const s=newPlan();s.phase='rules';s.game=game;await seed(page,s);
 await audience.goto('/?plan=display');
 await expect(audience.getByRole('heading',{name:PLAN_GAMES[game].name,exact:true})).toBeVisible();
 await expect(audience.locator('.plan-rules-screen')).toBeVisible();
 expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);
 await audience.screenshot({path:`artifacts/plan-rules-${game}.png`,fullPage:true});
 }
});

test('rectangles wrong answers lock only this round, scoring, undo and first to three',async({page,context})=>{
 const s=newPlan();s.phase='play';s.points=[2,0,0];s.rectangles.grid=[[1,2,1],[null,null,null]];s.rectangles.target=3;
 await seed(page,s);const audience=await context.newPage();await audience.goto('/?plan=display');
 await page.getByRole('button',{name:'Show puzzle'}).click();
 await page.getByRole('button',{name:'Team B buzzed'}).click();await page.getByLabel('Team B’s rectangle count').fill('999');await page.getByRole('button',{name:'Check answer'}).click();
 await expect(page.getByRole('button',{name:'Team B locked out'})).toBeDisabled();await expect(page.locator('.plan-scores article').nth(1)).toContainText('Points: 0');
 await page.getByRole('button',{name:'Team A buzzed'}).click();await page.getByLabel('Team A’s rectangle count').fill('4');await page.getByRole('button',{name:'Check answer'}).click();
 await expect(audience.getByText('4 rectangles',{exact:true})).toBeVisible();await audience.setViewportSize({width:1280,height:720});expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await audience.screenshot({path:'artifacts/plan-rectangles.png',fullPage:true});await expect(audience.locator('.plan-scores article').first()).toContainText('Points: 3');
 await page.getByRole('button',{name:'Finish Count the Rectangles'}).click();await expect(page.getByRole('heading',{name:'Confirm game placements'})).toBeVisible();
});
test('fullscreen hides controls and music follows the host',async({page,context})=>{
 await seed(page,newPlan());const audience=await context.newPage();await audience.goto('/?plan=display');
 await page.getByRole('button',{name:'Play Jeopardy music'}).click();await expect(page.getByRole('button',{name:'Stop Jeopardy music'})).toHaveAttribute('aria-pressed','true');
 await audience.getByRole('button',{name:'Fullscreen',exact:true}).click();await expect(audience.locator('.plan-audience-controls')).toBeHidden();
 await audience.evaluate(()=>document.exitFullscreen());await expect(audience.locator('.plan-audience-controls')).toBeVisible();
 await page.getByRole('button',{name:'Stop Jeopardy music'}).click();
});

test('rectangle answer has no timer and the host can unlock a team',async({page})=>{
 const s=newPlan();s.phase='play';await seed(page,s);await page.clock.install();await page.getByRole('button',{name:'Show puzzle'}).click();await page.getByRole('button',{name:'Team A buzzed'}).click();await page.clock.fastForward(70000);
 await expect(page.getByLabel(/Team A.*rectangle count/)).toBeVisible();await page.getByLabel(/Team A.*rectangle count/).fill('99999');await page.getByRole('button',{name:'Check answer'}).click();
 await page.getByText('Allow teams to re-answer',{exact:true}).click();await page.getByRole('button',{name:/Allow Team A/}).click();await expect(page.getByRole('button',{name:'Team A buzzed'})).toBeEnabled();
});
test('opening screen, centered headers and difficulty shapes persist and fit 720p',async({page,context})=>{
 const s=newPlan();await seed(page,s);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(audience.getByRole('heading',{name:"Qoobee's Plan",exact:true})).toBeVisible();await expect(audience.locator('.plan-stage .eyebrow')).toHaveCount(0);await expect(audience.locator('.plan-stage header p')).toHaveCount(0);await expect(audience.locator('.plan-scores article')).toHaveCount(3);await audience.screenshot({path:'artifacts/plan-opening.png',fullPage:true});
 await page.getByRole('button',{name:'Start gauntlet',exact:true}).click();await expect(audience.getByText(/Back your team/)).toHaveCount(0);await page.getByRole('button',{name:'Lock wagers and reveal game'}).click();await page.getByRole('button',{name:'Start Count the Rectangles',exact:true}).click();
 for(const difficulty of ['easy','medium','hard']){
 await page.getByLabel('Puzzle difficulty').selectOption(difficulty);await page.getByRole('button',{name:'Generate new puzzle'}).click();await page.reload();await expect(page.getByLabel('Puzzle difficulty')).toHaveValue(difficulty);await page.getByRole('button',{name:'Show puzzle'}).click();
 const cells=audience.locator('.plan-number-grid>div');const count=await cells.count();expect(count).toBeGreaterThanOrEqual(difficulty==='easy'?9:difficulty==='medium'?36:64);expect(count).toBeLessThanOrEqual(difficulty==='easy'?25:difficulty==='medium'?49:66);
 if(difficulty==='hard')expect(await audience.locator('.plan-grid-hole').count()).toBeGreaterThan(0);
 expect(await audience.locator('.plan-stage>header').evaluate(e=>getComputedStyle(e).textAlign)).toBe('center');expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);
 await audience.screenshot({path:`artifacts/plan-rectangles-${difficulty}.png`,fullPage:true});await page.getByRole('button',{name:'End round and reveal count'}).click();expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await page.getByRole('button',{name:'Next puzzle',exact:true}).click();
 }
});
test('Equation Decrypto histories sit side by side and gameplay prompts are omitted',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=1;s.matchReady=true;s.equation.phase='play';s.equation.secrets=['12+3×4=24','30−6×2=18'];s.equation.guesses=Array.from({length:14},(_,i)=>({team:i%2,text:'012345678',lights:Array.from({length:9},(_,j)=>['green','yellow','red'][j%3])}));
 await seed(page,s);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 const boards=audience.locator('.plan-equation-boards .plan-row');await expect(boards).toHaveCount(2);const a=await boards.nth(0).boundingBox(),b=await boards.nth(1).boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);expect(b!.x).toBeGreaterThan(a!.x+a!.width);await expect(audience.locator('.plan-announcement')).toHaveCount(0);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await audience.screenshot({path:'artifacts/plan-equation-side-by-side.png',fullPage:true});
 for(let game=0;game<5;game++){const state=newPlan();state.phase='play';state.game=game;state.matchReady=true;await seed(page,state);await audience.goto('/?plan=display');await expect(audience.locator('.plan-announcement')).toHaveCount(0);}
});

test('gradation cup selection stays private until submitted and can be changed',async({page,context})=>{
 const s=newPlan();s.phase='play';s.game=3;s.matchReady=true;s.gradation.phase='lead';s.gradation.rows=[[0,1,2,4,6,8,9],[0,1,2,4,6,8,9]];await seed(page,s);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(page.getByRole('button',{name:'Submit cup',exact:true})).toBeDisabled();await page.locator('.plan-cup-controls button').nth(0).click();await expect(audience.locator('.plan-cup.selected')).toHaveCount(0);await page.locator('.plan-cup-controls button').nth(3).click();await expect(page.locator('.plan-cup-controls button').nth(3)).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Submit cup',exact:true}).click();await expect(audience.getByText('White cup selected',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Submit cup',exact:true})).toBeDisabled();
 await page.locator('.plan-cup-controls button').nth(1).click();await expect(audience.locator('.plan-cup.selected')).toHaveCount(1);await expect(audience.locator('.plan-number-cube')).toHaveCount(0);await page.getByRole('button',{name:'Submit cup',exact:true}).click();await expect(audience.locator('.plan-cup.selected')).toHaveCount(2);await expect(page.getByRole('button',{name:'Next cup',exact:true})).toBeVisible();await expect(audience.getByRole('img',{name:'Revealed cube: 4',exact:true})).toBeVisible();await expect(audience.getByRole('img',{name:'Revealed cube: 1',exact:true})).toBeVisible();expect(await audience.locator('.plan-cup-showcase .plan-cup-shell').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('plan-cup-lift');await expect.poll(()=>audience.locator('.plan-number-cube').first().evaluate(e=>getComputedStyle(e).opacity)).toBe('1');expect(await audience.locator('.plan-cup-showcase').first().evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(150);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await audience.screenshot({path:'artifacts/plan-gradation-reveal.png',fullPage:true});
});

test('final leaderboard uses ranked winner rows and confetti without duplicate captions',async({page,context})=>{
 const s=newPlan();s.phase='complete';s.teams[0].score=1200;s.teams[1].score=1600;s.teams[2].score=1400;await seed(page,s);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(audience.getByText('Gauntlet complete',{exact:true})).toHaveCount(0);await expect(audience.getByText('Final standings',{exact:true})).toHaveCount(1);await expect(audience.locator('.stream-final-results li').first()).toContainText('Team B');await expect(audience.locator('.winner-row')).toHaveCount(1);await expect(audience.locator('.final-confetti i')).toHaveCount(40);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await audience.screenshot({path:'artifacts/plan-final-leaderboard.png',fullPage:true});
 s.teams[0].score=1600;await seed(page,s);await audience.reload();await expect(audience.getByText('Joint winners',{exact:true})).toBeVisible();await expect(audience.locator('.winner-row')).toHaveCount(2);
});
test('all wager categories are centered with the wager prompt and no game counter',async({page,context})=>{
 const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});
 for(let game=0;game<5;game++){const s=newPlan();s.game=game;s.phase='wager';await seed(page,s);await audience.goto('/?plan=display');await expect(audience.getByText('Place your wagers',{exact:true})).toBeVisible();await expect(audience.getByText(/Game \d of 5/)).toHaveCount(0);const header=await audience.locator('.plan-stage>header').boundingBox();expect(Math.abs(header!.y+header!.height/2-360)).toBeLessThan(10);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);}
});

test('pictured rectangle boards fit the audience while using more vertical space',async({page,context})=>{
 const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});
 for(const r of rectangleExamples()){const s=newPlan();s.phase='play';s.rectangles=r;s.rectangles.phase='open';await seed(page,s);await audience.goto('/?plan=display');const box=await audience.locator('.plan-number-grid').boundingBox();expect(box!.height).toBeGreaterThan(350);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);await page.getByRole('button',{name:'End round and reveal count'}).click();expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);}
});
test('practice includes all teams, automatic fallback opens guesses, and scores stay unchanged',async({page,context})=>{
 const s=newPlan();s.game=4;s.phase='play';await seed(page,s);await page.getByLabel('Practice word bank').selectOption('forest');await page.getByRole('button',{name:'Start practice round'}).click();
 await expect(page.getByRole('button',{name:'Estimate similarity with AI'})).toHaveCount(0);
 for(let i=0;i<10;i++){await page.getByLabel('Clue word',{exact:true}).fill('clue'+i);await page.getByLabel('Similarity (%)',{exact:true}).fill('80');await page.getByRole('button',{name:'Publish clue and similarity'}).click();}
 await expect(page.getByText('Highest-scoring entered clue: clue0 · 80%')).toBeVisible();
 for(const team of ['A','B','C'])await page.getByLabel(`Team ${team}’s answer`).fill('forest');await page.getByRole('button',{name:'Reveal answers and score stage'}).click();await expect(page.locator('.plan-scores').getByText('Points: 0',{exact:true})).toHaveCount(3);await page.getByRole('button',{name:'Finish practice and prepare game'}).click();await expect(page.getByRole('button',{name:'Lock words and begin round 1'})).toBeVisible();
});
test('draws advance without replay and game results show a shared leaderboard',async({page,context})=>{
 const s=newPlan();s.game=1;s.phase='play';s.matchReady=true;s.equation.phase='result';s.equation.secrets=['12+3*4=24','30-6*2=18'];s.equation.winner=null;s.bet={team:2,pick:0,amount:300};await seed(page,s);await page.getByRole('button',{name:'Record draw and next match'}).click();await expect(page.getByRole('heading',{name:'Match 2: Team A vs Team C'})).toBeVisible();
 const g=newPlan();g.game=3;g.phase='play';g.matchReady=true;g.gradation.phase='set';g.gradation.rows=[[0,0,1,1,2,2,3],[0,0,1,1,2,2,3]];g.gradation.points=[2,2];g.gradation.winner=null;await seed(page,g);await page.getByRole('button',{name:'Record draw and next match'}).click();await expect(page.getByRole('heading',{name:'Match 2: Team A vs Team C'})).toBeVisible();
 g.phase='ranking';g.points=[1,1,0];g.wagers=[100,100,100];await seed(page,g);await page.getByRole('button',{name:'Award placements and settle wagers'}).click();const audience=await context.newPage();await audience.goto('/?plan=display');await expect(audience.locator('.stream-final-results li')).toHaveCount(3);await expect(audience.locator('.winner-row')).toHaveCount(2);await expect(audience.locator('.final-confetti i')).toHaveCount(0);
});

test('game settlement preserves bottom totals and animates placement and wager deltas',async({page,context})=>{
 const s=newPlan();s.game=1;s.phase='ranking';s.points=[2,1,0];s.wagers=[100,100,100];await seed(page,s);
 const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(audience.locator('.plan-team-box')).toHaveCount(3);
 await page.getByRole('button',{name:'Award placements and settle wagers'}).click();
 await expect(audience.locator('.stream-final-results')).toBeVisible();
 await expect(audience.locator('.plan-team-box').first()).toContainText('1,400');
 await expect(audience.locator('.plan-team-box .score-change').first()).toHaveText('+400');
 await expect(audience.locator('.plan-team-box').nth(1).locator('.score-change')).toHaveText('+100');
 await expect(audience.locator('.final-confetti')).toHaveCount(0);
 expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);
 await audience.screenshot({path:'artifacts/plan-game-results-totals.png',fullPage:true});
});

test('hidden word groups clue sets, highlights stage thresholds, and reveals guesses above totals',async({page,context})=>{
 const s=newPlan();s.game=4;s.phase='play';s.word.practice=true;s.word.phase='reveal';s.word.chosen[0]='forest';s.word.guesses=['oak','pine','bark'];s.word.clues=[{word:'tree',score:90,stage:1},{word:'leaf',score:89,stage:1},{word:'grove',score:93,stage:2},{word:'log',score:92,stage:2},{word:'woodland',score:95,stage:3},{word:'woods',score:94,stage:3}];
 await seed(page,s);const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});await audience.goto('/?plan=display');
 await expect(audience.locator('.plan-clue-set')).toHaveCount(3);await expect(audience.locator('.qualifying-clue')).toHaveCount(3);
 for(let i=0;i<3;i++){await expect(audience.locator('.plan-clue-set').nth(i).locator('.plan-clues>div')).toHaveCount(2);await expect(audience.locator('.plan-scores article').nth(i).locator('.plan-team-guess')).toHaveText(s.word.guesses[i]);}
 await expect(audience.locator('.plan-result-rows')).toHaveCount(0);expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);
 await audience.screenshot({path:'artifacts/plan-word-clue-sets.png',fullPage:true});
 s.word.phase='guess';await seed(page,s);await audience.reload();await expect(audience.locator('.plan-team-guess')).toHaveCount(0);
});

import {publicPlan,lockPokerAnswers,revealPokerTeam} from '../shared/plan';
test('poker and hidden word reveals keep boards and score boxes stationary',async({page,context})=>{
 const audience=await context.newPage();await audience.setViewportSize({width:1280,height:720});
 for(const game of [2,4]){
  const s=newPlan();s.game=game;s.phase='play';s.poker.phase='answer';s.word.phase='guess';s.word.chosen[0]='forest';s.word.clues=[{word:'tree',score:91,stage:1}];
  await seed(page,s);await audience.goto('/?plan=display');const selector=game===2?'.plan-cards':'.plan-clue-sets';
  const before=await audience.locator(selector).boundingBox(),scores=await audience.locator('.plan-team-box').first().boundingBox();
  if(game===2){lockPokerAnswers(s,['AB','CD','EF']);for(let i=0;i<3;i++)revealPokerTeam(s,i);}else{s.word.phase='reveal';s.word.guesses=['oak','pine','bark'];s.word.result='No correct guesses. No points in practice.';}
  await page.evaluate(screen=>localStorage.setItem('qoobee-plan-screen-v1',JSON.stringify(screen)),publicPlan(s));
  await expect(audience.locator('.plan-play-area>.plan-result')).not.toBeEmpty();
  const after=await audience.locator(selector).boundingBox(),afterScores=await audience.locator('.plan-team-box').first().boundingBox();
  expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);expect(Math.abs(after!.height-before!.height)).toBeLessThan(1);expect(Math.abs(afterScores!.y-scores!.y)).toBeLessThan(1);
  expect(await audience.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(722);
 }
});

test('audience frame fills wide screens and keeps mascots inside its corners',async({page,context})=>{
 const s=newPlan();s.phase='wager';await seed(page,s);const audience=await context.newPage();
 for(const width of [1280,2560]){await audience.setViewportSize({width,height:900});await audience.goto('/?plan=display');const frame=await audience.locator('.plan-stage').boundingBox();expect(frame!.width).toBe(width);expect(frame!.height).toBe(900);for(const img of await audience.locator('.plan-corner-mascots img').all()){const b=await img.boundingBox();expect(b!.x).toBeGreaterThan(frame!.x);expect(b!.x+b!.width).toBeLessThan(frame!.x+frame!.width);expect(b!.y).toBeGreaterThan(frame!.y);}}
});

test('memory reveal flips A through P before starting the memorization timer',async({page})=>{
 const s=newPlan();s.game=2;s.phase='play';await seed(page,s);await page.clock.install();
 await page.getByRole('button',{name:'Show cards'}).click();await expect(page.locator('.plan-flip-inner')).toHaveCount(16);await expect(page.locator('.plan-clock')).toHaveCount(0);
 const delays=await page.locator('.plan-flip-inner').evaluateAll(els=>els.map(e=>parseFloat((e as HTMLElement).style.animationDelay)));expect(Math.abs(delays[15]-delays[0]-1800)).toBeLessThan(100);
 await page.clock.fastForward(2000);await expect(page.getByRole('button',{name:'Hide cards and collect answers'})).toHaveCount(0);
 await page.clock.fastForward(500);await expect(page.getByRole('button',{name:'Hide cards and collect answers'})).toBeVisible();await expect(page.locator('.plan-clock')).toHaveText('0:30');
 await page.clock.fastForward(30000);await expect(page.getByRole('button',{name:'Lock all answers'})).toBeVisible();
});

test('new clues flash over a dimmed board then land in their set with qualifying gold flair',async({page,context})=>{
 const s=newPlan();s.game=4;s.phase='play';s.word.practice=false;s.word.phase='clue';s.word.chosen[0]='forest';await seed(page,s);const audience=await context.newPage();await audience.goto('/?plan=display');await expect(audience.locator('.plan-clue-flash')).toHaveCount(0);
 for(const [word,score] of [['leaf',80],['grove',95]] as const){await page.getByLabel('Clue word',{exact:true}).fill(word);await page.getByLabel('Similarity (%)',{exact:true}).fill(String(score));await page.getByRole('button',{name:'Publish clue and similarity'}).click();
 const flash=audience.locator('.plan-clue-flash');await expect(flash).toContainText(word);await expect(flash).toContainText(score+'%');await expect(audience.locator('.plan-clue-veil')).toBeVisible();await expect(audience.locator('.plan-clue-flash.is-qualified')).toHaveCount(score>=90?1:0);await expect(flash).toHaveCount(0,{timeout:5000});await expect(audience.locator('.plan-clue-set').first().getByText(word,{exact:true})).toBeVisible();}
 await audience.reload();await expect(audience.locator('.plan-clue-flash')).toHaveCount(0);
});

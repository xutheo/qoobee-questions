import {newRectangles,countRectangles,type RectangleCell,type RectanglePuzzle} from './rectangles';
// Host-operated gauntlet. Arrays always use the same three team indices.
export const PLAN_GAMES = [
  { name: 'Count the Rectangles', category: 'Math / Spatial Recognition', rules: "Count all rectangles whose enclosed numbers total the target.\nAnyone from any team can answer.\nA wrong answer will lock your team out of the round.\nA correct answer earns the team 1 point.\nFirst to 3 points wins." },
  { name: 'Equation Decrypto', category: 'Logic', rules: "Each team will play each other team once.\nEach team secretly sets a valid 9-character equation that is hidden.\nBoth teams will submit a guess at the same time. The guesses do not have to be valid equations.\nThe game will provide feedback on the guesses: Green = Correct Position, Yellow = Elsewhere, and Red = Nowhere.\nFirst team to identify an equation correctly will win the match. Ties are possible.\nThe idle team can wager up to 150 points on who they believe will win the match." },
  { name: 'Memory Poker', category: 'Memory', rules: "Each team nominates 1 representative per round and it must be fair.\nA grid of 16 playing cards will be displayed for 30 seconds. Memorize as much as you can.\nThe cards will be flipped and 3 community cards will be displayed.\nPick two of the flipped cards within 60 seconds to make a 5 card poker hand.\nThe strongest hand earns 1 point; 2-way ties earn 0.5 points; 3-way ties earn 0 points.\nFirst to 5 points wins." },
  { name: 'Gradation', category: 'Psychological', rules: "Each team will play each other team once.\nEach team is given 7 cups shaded dark / gray / light gray / white / light gray / gray / dark.\nEach team secretly puts one cube with a value from 0–9 in each cup in ascending order. You may use the same number at most 2 times and the total sum can be at most 30.\nEach round, teams submit a cup one at a time. The team that submitted a higher number earns 1 point.\nThe winner of the previous round leads the next round and ties keep the same lead.\nAfter all cups have been submitted, the team with the higher points wins the match.\nThe idle team can wager up to 150 points on who they believe will win the match." },
  { name: 'Hidden Word', category: 'Semantics', rules: "Every team selects one hidden word chosen from a 5-word bank of nouns (no pronouns).\nThe goal is to guess the active team’s hidden word. Every team is active once per round, over 2 rounds.\nThe active team gives a clue. The host enters the clue and its similarity percentage, which are displayed for everyone.\nAt 90% similarity or higher, the other teams submit guesses. Below 90%, give another clue.\nAfter 10 clues below the threshold, the host supplies a new highest-valued clue and its similarity percentage.\nThe active team runs up to 3 sets of guesses, earning +1, +2, then +3 points if nobody guesses. The similarity threshold rises to 93% for set 2 and 95% for set 3.\nCorrectly guessing another team’s hidden word earns your team +1 point.\nPoints are doubled in round 2." },
] as const;
export const PAIRS = [[0, 1], [0, 2], [1, 2]] as const;
export const shades = ['Dark', 'Grey', 'Light', 'White', 'Light', 'Grey', 'Dark'];
export type Card = { rank: number; suit: number };
export const POKER_FLIP_MS=2400;
export type Poker = { flipStarted?:number; cards: Card[]; phase: 'ready'|'flipping'|'memorize'|'answer'|'review'|'reveal'; revealed: boolean[]; answers: string[]; hands: string[]; result: string };
export type TowerMotion = { blocks: string[]; flip: boolean; sequence: number };
export type Tower = { motion?: TowerMotion; stacks: string[][]; target: number; height: number; phase: 'ready'|'bid'|'challenge'|'build'|'result'; bids: { team: number; moves: number; value: number }[]; moves: number; result: string };
export type Equation = { simultaneous: true; secrets: string[]; guesses: { team: number; text: string; lights: string[] }[]; turn: number; solved: boolean[]; phase: 'setup'|'play'|'result'; result: string; winner: number|null };
export type Gradation = { rows: number[][]; used: number[][]; selected: (number|null)[]; lead: number; points: number[]; streak: number[]; phase: 'setup'|'lead'|'reply'|'reveal'|'set'; result: string; winner: number|null };
export type Word = { usedWords?:string[]; envelopes: string[][]; chosen: string[]; turn: number; stage: number; phase: 'setup'|'clue'|'fallback'|'guess'|'reveal'|'done'; practice?:boolean; fallbackClue?:{word:string;score:number}; clues: { word: string; score: number; stage: number }[]; guesses: string[]; result: string; next: boolean };
export type Plan = { version: 1; orderVersion:2; remainingGames?:number[]; rectangles:RectanglePuzzle; musicPlaying: boolean; teams: { name: string; score: number }[]; phase: 'setup'|'wager'|'rules'|'play'|'ranking'|'result'|'complete'; game: number; wagers: number[]; points: number[]; pair: number; matchReady: boolean; bet: { team: number; pick: number; amount: number }|null; matches: { pair: number; winner: number|null }[]; ranks: number[]; history: string[]; deadline: number|null; poker: Poker; tower: Tower; equation: Equation; gradation: Gradation; word: Word };
export function shuffle<T>(items: T[]): T[] { const a = [...items]; for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export type PokerDeal = 'two-pair'|'trips'|'straight'|'flush'|'full-house'|'four-kind'|'straight-flush';
export function pokerDealForRoll(roll:number):PokerDeal {
 assert(Number.isFinite(roll)&&roll>=0&&roll<1,'Poker roll must be between 0 (inclusive) and 1 (exclusive).');
 if(roll<.25)return 'two-pair';
 if(roll<.375)return 'trips';
 if(roll<.575)return 'straight';
 if(roll<.775)return 'flush';
 if(roll<.9)return 'full-house';
 if(roll<.95)return 'four-kind';
 return 'straight-flush';
}
export function newPoker(deal:PokerDeal=pokerDealForRoll(Math.random())): Poker {
 const ranks=shuffle(Array.from({length:13},(_,i)=>i+2)),suits=shuffle([0,1,2,3]);
 const card=(rank:number,suit:number):Card=>({rank,suit});
 let hand:Card[];
 if(deal==='two-pair')hand=[card(ranks[0],suits[0]),card(ranks[0],suits[1]),card(ranks[1],suits[0]),card(ranks[1],suits[1]),card(ranks[2],suits[2])];
 else if(deal==='trips')hand=[card(ranks[0],suits[0]),card(ranks[0],suits[1]),card(ranks[0],suits[2]),card(ranks[1],suits[0]),card(ranks[2],suits[1])];
 else if(deal==='full-house')hand=[card(ranks[0],suits[0]),card(ranks[0],suits[1]),card(ranks[0],suits[2]),card(ranks[1],suits[0]),card(ranks[1],suits[1])];
 else if(deal==='four-kind')hand=[...suits.map(s=>card(ranks[0],s)),card(ranks[1],suits[0])];
 else if(deal==='flush')hand=ranks.slice(0,5).map(r=>card(r,suits[0]));
 else {const start=2+Math.floor(Math.random()*9);hand=Array.from({length:5},(_,i)=>card(start+i,deal==='straight-flush'?suits[0]:suits[i%4]));}
 const arranged=shuffle(hand),community=arranged.slice(0,3),required=arranged.slice(3);
 const remaining=shuffle(Array.from({length:52},(_,i)=>card(2+i%13,Math.floor(i/13))).filter(c=>![...community,...required].some(p=>p.rank===c.rank&&p.suit===c.suit)));
 const board=shuffle([...required,...remaining.slice(0,16-required.length)]);
 return {cards:[...board,...shuffle(community)],phase:'ready',revealed:[false,false,false],answers:['','',''],hands:[],result:''};
}
export const TOWER_BLOCKS = [2,3,5,7].flatMap(n=>[String(n), '+'+n, '−'+n, '×'+n]);
export function validateTowerStacks(stacks:string[][]) {
 assert(stacks.length===4 && stacks.flat().length===16 && new Set(stacks.flat()).size===16 && stacks.flat().every(b=>TOWER_BLOCKS.includes(b)), 'Use exactly one of each 2, 3, 5, 7 as a number, addition, subtraction, and multiplication block: 16 blocks across four stacks. No division.');
}
export function newTower(): Tower { const blocks=shuffle(TOWER_BLOCKS);return {stacks:[0,1,2,3].map(i=>blocks.slice(i*4,i*4+4)),target:17,height:3,phase:'ready',bids:[],moves:0,result:''}; }
export function newEquation(): Equation {return {simultaneous:true,secrets:['',''],guesses:[],turn:0,solved:[false,false],phase:'setup',result:'',winner:null};}
export function newGradation(lead=0,streak=[0,0]): Gradation { return {rows:[[],[]],used:[[],[]],selected:[null,null],lead,points:[0,0],streak,phase:'setup',result:'',winner:null}; }
export const WORD_BANK = 'forest mirror bridge pillow thunder ocean clock garden shadow bottle candle window river ladder feather mountain island desert valley glacier volcano meadow waterfall lake beach cave canyon cloud rain snow wind storm rainbow sunrise moon star planet comet stone crystal diamond pearl gold silver copper marble sand clay wood paper glass metal fabric thread needle button zipper basket bucket spoon fork plate bowl kettle oven bread cheese honey apple orange lemon cherry peach grape melon carrot potato onion mushroom flower rose lily orchid tulip seed leaf root branch bark grass moss fern shell coral dolphin whale shark turtle eagle owl sparrow fox wolf bear deer rabbit horse tiger lion elephant butterfly dragonfly spider ant bee beetle piano violin guitar trumpet drum flute bell whistle camera telescope compass map anchor sail wheel engine train bicycle airplane ship castle tower palace temple library museum theater school hospital market village city lantern umbrella suitcase key lock door carpet curtain blanket mattress soap towel brush comb necklace bracelet ring crown helmet glove boot ribbon balloon kite puzzle book pencil ink paint canvas sculpture statue treasure coin'.split(' ');
export function wordEnvelopes(used:string[]=[]):string[][]{const excluded=new Set(used.map(w=>w.trim().toLowerCase()));const pool=shuffle(WORD_BANK.filter(w=>!excluded.has(w)));return [0,1,2].map(i=>pool.slice(i*5,i*5+5));}
export function newWord(usedWords:string[]=[]): Word {return {usedWords:[...usedWords],envelopes:wordEnvelopes(usedWords),chosen:['','','','','',''],turn:0,stage:1,phase:'setup',practice:true,clues:[],guesses:['','',''],result:'',next:false};}
export function newPlan(): Plan {return {version:1,orderVersion:2,rectangles:newRectangles(),musicPlaying:false,teams:['Team A','Team B','Team C'].map(name=>({name,score:1000})),phase:'setup',game:0,wagers:[0,0,0],points:[0,0,0],pair:0,matchReady:false,bet:null,matches:[],ranks:[],history:[],deadline:null,poker:newPoker(),tower:newTower(),equation:newEquation(),gradation:newGradation(),word:newWord()};}
export function assert(ok: unknown, message: string): asserts ok {if(!ok) throw new Error(message);}
export function wager(amount: number, balance: number) {assert(Number.isSafeInteger(amount)&&amount>=0&&amount<=Math.max(0,balance),'Wager must be a whole number between zero and the available balance.');}
export const normalizeEquation = (text: string) => text.replace(/\s/g,'').replace(/\*/g,'×').replace(/\//g,'÷').replace(/-/g,'−');
// Deliberately a parser, never eval: standard precedence and right-associative powers.
export function arithmetic(input: string): number {
 const s=normalizeEquation(input); let p=0;
 const number=():number=>{const m=/^(0|[1-9]\d*)/.exec(s.slice(p));assert(m,'Expected a number.');p+=m[0].length;return Number(m[0]);};
 const power=():number=>{let n=number();if(s[p]==='^'){p++;const e=power();assert(!(n===0&&e===0),'0^0 is not allowed.');n=n**e;}return n;};
 const product=():number=>{let n=power();while(s[p]==='×'||s[p]==='÷'){const op=s[p++],r=power();assert(op!=='÷'||r!==0,'Division by zero.');n=op==='×'?n*r:n/r;}return n;};
 const sum=():number=>{let n=product();while(s[p]==='+'||s[p]==='−'){const op=s[p++],r=product();n=op==='+'?n+r:n-r;}return n;};
 const value=sum();assert(p===s.length&&Number.isFinite(value)&&Math.abs(value)<=1e12,'Invalid or excessively large expression.');return value;
}
export function validEquation(text: string): string {const s=normalizeEquation(text);assert(s.length===9,'The equation must fill exactly 9 cells.');const parts=s.split('=');assert(parts.length===2,'Use exactly one equals sign.');assert(Math.abs(arithmetic(parts[0])-arithmetic(parts[1]))<1e-9,'Both sides must be equal.');return s;}
export function equationLights(secret:string, guess:string):string[]{const lights=Array(9).fill('red'),remaining=secret.split('');for(let i=0;i<9;i++)if(guess[i]===remaining[i]){lights[i]='green';remaining[i]='';}for(let i=0;i<9;i++)if(lights[i]!=='green'){const j=remaining.indexOf(guess[i]);if(j>=0){lights[i]='yellow';remaining[j]='';}}return lights;}
export function pokerRank(cards:Card[]):{value:number[];name:string}{
 assert(cards.length===5,'A hand needs five cards.');const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a);const groups=[...new Set(ranks)].map(r=>[r,ranks.filter(x=>x===r).length]).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);const flush=cards.every(c=>c.suit===cards[0].suit);const unique=[...new Set(ranks)];const straight=unique.length===5?(unique[0]-unique[4]===4?unique[0]:unique.join(',')==='14,5,4,3,2'?5:0):0;
 let value:number[],name:string;if(flush&&straight){value=[8,straight];name='Straight flush';}else if(groups[0][1]===4){value=[7,...groups.map(g=>g[0])];name='Four of a kind';}else if(groups[0][1]===3&&groups[1][1]===2){value=[6,...groups.map(g=>g[0])];name='Full house';}else if(flush){value=[5,...ranks];name='Flush';}else if(straight){value=[4,straight];name='Straight';}else if(groups[0][1]===3){value=[3,...groups.map(g=>g[0])];name='Three of a kind';}else if(groups[0][1]===2&&groups[1][1]===2){value=[2,...groups.map(g=>g[0])];name='Two pair';}else if(groups[0][1]===2){value=[1,...groups.map(g=>g[0])];name='One pair';}else{value=[0,...ranks];name='High card';}return {value,name};
}
export function compareHands(a:number[],b:number[]):number {for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
export function parseCards(text:string):number[]{const picks=text.toUpperCase().replace(/[^A-P]/g,'').split('').map(c=>c.charCodeAt(0)-65);assert(picks.length===2&&picks[0]!==picks[1],'Enter two different card letters, A–P.');return picks;}
export function gradePoker(s:Plan){assert(s.poker.phase==='review'&&s.poker.revealed.every(Boolean),'Reveal every team before scoring.');const ranks=s.poker.answers.map(a=>pokerRank([...parseCards(a).map(i=>s.poker.cards[i]),...s.poker.cards.slice(16)]));const best=ranks.reduce((a,b)=>compareHands(a.value,b.value)>=0?a:b);const winners=ranks.map((r,i)=>compareHands(r.value,best.value)===0?i:-1).filter(i=>i>=0);s.poker.hands=s.poker.answers.map(a=>pokerHandName([...parseCards(a).map(i=>s.poker.cards[i]),...s.poker.cards.slice(16)]));s.poker.phase='reveal';s.deadline=null;if(winners.length===1){s.points[winners[0]]++;s.poker.result=`${s.teams[winners[0]].name} wins the round.`;}else if(winners.length===2){winners.forEach(i=>s.points[i]+=.5);s.poker.result=winners.map(i=>s.teams[i].name).join(' and ')+' tie: +0.5 points each.';}else s.poker.result='Three-way tie. No points awarded.';}
const rankSingular:Record<number,string>={2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine',10:'Ten',11:'Jack',12:'Queen',13:'King',14:'Ace'};
const rankPlural:Record<number,string>={2:'Twos',3:'Threes',4:'Fours',5:'Fives',6:'Sixes',7:'Sevens',8:'Eights',9:'Nines',10:'Tens',11:'Jacks',12:'Queens',13:'Kings',14:'Aces'};
export function pokerHandName(cards:Card[]):string {
 const {value:v}=pokerRank(cards),high=rankSingular[v[1]],plural=rankPlural[v[1]];
 switch(v[0]){
 case 8:return high+'-high Straight Flush';case 7:return plural+' Four of a Kind';
 case 6:return plural+' over '+rankPlural[v[2]]+' Full House';case 5:return high+'-high Flush';
 case 4:return high+'-high Straight';case 3:return plural+' Three of a Kind';
 case 2:return plural+' and '+rankPlural[v[2]]+' Two Pair';case 1:return plural+' One Pair';
 default:return high+' High Card';
 }
}
export function lockPokerAnswers(s:Plan,answers:string[]){
 assert(s.poker.phase==='answer','Answers are not open.');assert(answers.length===3,'Collect all three teams’ answers.');answers.forEach(parseCards);
 s.poker.answers=[...answers];s.poker.revealed=[false,false,false];s.poker.phase='review';s.deadline=null;
 s.poker.hands=answers.map(a=>pokerHandName([...parseCards(a).map(i=>s.poker.cards[i]),...s.poker.cards.slice(16)]));
}
export function revealPokerTeam(s:Plan,team:number){
 assert(s.poker.phase==='review'&&Number.isInteger(team)&&team>=0&&team<3&&!s.poker.revealed[team],'Choose an unrevealed team.');
 s.poker.revealed[team]=true;if(s.poker.revealed.every(Boolean))gradePoker(s);
}
export function submitEquationRound(s:Plan,answers:string[]){
 const q=s.equation;assert(s.game===1&&s.matchReady&&q.phase==='play','No active Equation Decrypto round.');
 assert(answers.length===2,'Enter both teams’ guesses.');const guesses=answers.map(normalizeEquation);
 assert(guesses.every(g=>g.length===9&&/^[0-9+−×÷^=]+$/.test(g)),'Each guess must have exactly nine allowed symbols.');
 const results=guesses.map((text,team)=>({team,text,lights:equationLights(q.secrets[1-team],text)}));
 q.guesses.push(...results);q.solved=results.map(r=>r.lights.every(c=>c==='green'));q.turn=0;
 if(q.solved.some(Boolean)){
 q.phase='result';q.winner=q.solved.every(Boolean)?null:PAIRS[s.pair][q.solved[0]?0:1];
 q.result=q.winner===null?'Both teams solved this round. Match drawn.':s.teams[q.winner].name+' wins the match.';
 }
}
export function moveTower(t:Tower,from:number,to:number,count:number,flip:boolean){assert(t.phase==='build','Start the attempt first.');assert([from,to].every(x=>Number.isInteger(x)&&x>=0&&x<4),'Choose valid stacks.');assert(Number.isInteger(count)&&count>0&&count<=t.stacks[from].length,'Choose a valid number of top blocks.');assert(from!==to||flip,'Moving in place requires a flip.');assert(t.moves<t.bids.at(-1)!.moves,'No moves remain.');const bundle=t.stacks[from].splice(0,count);if(flip)bundle.reverse();t.stacks[to].unshift(...bundle);t.moves++;t.motion={blocks:[...bundle],flip,sequence:(t.motion?.sequence||0)+1};}
export function towerValue(stack:string[]):number|null{try{assert(/^\d+$/.test(stack[0]||'')&&stack.slice(1).every(b=>/^[+−×-]\d+$/.test(b)),'A tower must start with one number, followed by operator blocks.');return arithmetic(stack.join(''));}catch{return null;}}
export function towerChallenge(stacks:string[][]):{target:number;height:number}{const blocks=stacks.flat();const plain=blocks.filter(b=>/^\d+$/.test(b));const operators=blocks.filter(b=>/^[+−×-]\d+$/.test(b));assert(plain.length&&operators.length>=2,'A puzzle needs a plain number and at least two operator blocks.');for(let attempt=0;attempt<200;attempt++){const height=3+Math.floor(Math.random()*Math.min(3,operators.length-1));const arrangement=[shuffle(plain)[0],...shuffle(operators).slice(0,height-1)];const target=towerValue(arrangement);if(target!==null&&Number.isInteger(target)&&target>0&&target<1000&&!stacks.some(a=>a.length===height&&towerValue(a)===target))return {target,height};}throw new Error('Could not generate a fresh target for this block set. Enter a target manually.');}
export function gradeTower(s:Plan){const t=s.tower;assert(t.phase==='build','No active attempt.');const b=t.bids.at(-1)!;const success=t.moves===b.moves&&t.stacks.some(a=>a.length===t.height&&towerValue(a)===t.target);s.points[b.team]+=success?b.value:-b.value;t.result=`${s.teams[b.team].name}: ${success?'+':'−'}${b.value} point${b.value===1?'':'s'}.`;t.phase='result';s.deadline=null;}
export function parseRow(text:string):number[]{const input=text.trim();const a=(/^\d{7}$/.test(input)?input.split(''):input.split(/[\s,]+/)).map(Number);assert(a.length===7&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=9),'Enter seven whole numbers, 0–9.');assert(a.every((n,i)=>!i||n>=a[i-1]),'Cubes must be in nondecreasing order.');assert(a.every(n=>a.filter(x=>x===n).length<=2),'Only two copies of each number are available.');assert(a.reduce((a,b)=>a+b,0)<=30,'The seven numbers must total at most 30.');return a;}
export const roundRobin=(s:Plan)=>s.game===1||s.game===3;
export function settleMatch(s:Plan,winner:number|null){
 assert(s.matchReady&&s.pair<3,'No active match.');assert(winner===null||PAIRS[s.pair].includes(winner as never),'Winner must be in this match.');
 if(winner!==null)s.points[winner]++;s.matches.push({pair:s.pair,winner});
 if(s.bet){const b=s.bet,delta=winner===null?0:b.pick===winner?b.amount:-b.amount;s.teams[b.team].score+=delta;s.history.push(s.teams[b.team].name+': spectator wager '+(winner===null?'refunded (draw)':String(delta))+'.');}
 s.bet=null;s.matchReady=false;s.pair++;s.deadline=null;if(s.pair===3)s.phase='ranking';else{s.equation=newEquation();s.gradation=newGradation();}
}
export function settleGame(s:Plan,order:number[]){
 assert(s.phase==='ranking','Finish the game before awarding places.');assert(order.length===3&&new Set(order).size===3&&order.every(n=>Number.isInteger(n)&&n>=0&&n<3),'Choose each team exactly once.');assert(order.every((team,i)=>!i||s.points[order[i-1]]>=s.points[team]),'Placements must follow game scores.');s.ranks=order;
 order.forEach((team,place)=>{const tied=roundRobin(s)?order.filter(t=>s.points[t]===s.points[team]):[team],first=roundRobin(s)?order.findIndex(t=>s.points[t]===s.points[team]):place;
 const prize=tied.reduce((sum,_,i)=>sum+300-(first+i)*100,0)/tied.length;
 const delta=first===0?(tied.length>1?0:s.wagers[team]):-s.wagers[team];s.teams[team].score+=prize+delta;
 s.history.push(PLAN_GAMES[s.game].name+' · '+s.teams[team].name+': '+(tied.length>1?'tied ':'')+'place '+(first+1)+', +'+prize+', wager '+delta+'.');});s.phase='result';s.deadline=null;
}
export const wordThreshold=(stage:number)=>[90,93,95][stage-1];
export function publishWordClue(s:Plan,word:string,score:number){const q=s.word;assert(q.phase==='clue','Clues are not open.');word=word.trim();assert(word&&word.toLowerCase()!==q.chosen[q.turn].toLowerCase(),'Give a clue other than the secret word.');assert(!q.clues.some(c=>c.word.toLowerCase()===word.toLowerCase()),'That clue has already been given.');assert(Number.isFinite(score)&&score>=0&&score<=100,'Similarity must be 0–100.');assert(q.clues.filter(c=>c.stage===q.stage).length<10,'Ten clues used.');q.clues.push({word,score,stage:q.stage});if(score>=wordThreshold(q.stage)){q.phase='guess';s.deadline=Date.now()+300000;}else if(q.clues.filter(c=>c.stage===q.stage).length===10){q.phase='fallback';s.deadline=null;}}
export function applyClosestClue(s:Plan,word:string,score:number){assert(s.word.phase==='fallback','No host clue is pending.');assert(!s.word.clues.some(c=>c.word.toLowerCase()===word.trim().toLowerCase()),'Enter a new clue.');assert(score>=Math.max(...s.word.clues.filter(c=>c.stage===s.word.stage).map(c=>c.score)),'Use a percentage at least as high as the previous clues.');assert(word.trim()&&word.trim().toLowerCase()!==s.word.chosen[s.word.turn].toLowerCase(),'Closest clue must not be the secret.');assert(Number.isFinite(score)&&score>=0&&score<=100,'Invalid similarity.');s.word.fallbackClue={word:word.trim(),score};s.word.clues.push({word:word.trim(),score,stage:s.word.stage});s.word.phase='guess';s.deadline=Date.now()+300000;}
export function nextGame(s:Plan){
 assert(s.phase==='result','Award places first, or explicitly skip the game.');
 s.deadline=null;s.bet=null;s.matchReady=false;
 if(s.game===4){s.phase='complete';return;}
 s.game=s.remainingGames?.shift()??s.game+1;s.phase='wager';s.wagers=[0,0,0];s.points=[0,0,0];s.pair=0;s.matches=[];s.ranks=[];
 s.poker=newPoker();s.tower=newTower();s.equation=newEquation();s.gradation=newGradation();s.word=newWord();
}
export function skipGame(s:Plan){
 assert(s.phase!=='setup'&&s.phase!=='complete','There is no game to skip.');
 if(s.phase!=='result')s.history.push(PLAN_GAMES[s.game].name+': skipped by host. No placement awards; outstanding game and spectator wagers voided. Previously settled spectator wagers remain.');
 s.phase='result';s.wagers=[0,0,0];s.bet=null;nextGame(s);
}
export function adjustPlanScore(s:Plan,team:number,scope:'overall'|'game',value:number){
 assert(Number.isInteger(team)&&team>=0&&team<3,'Choose a team.');
 assert(Number.isSafeInteger(value*2)&&(scope==='game'||Number.isInteger(value))&&Math.abs(value)<=100000000,'Enter a whole gauntlet score or half-point game score between −100,000,000 and 100,000,000.');
 const before=scope==='overall'?s.teams[team].score:s.points[team];
 if(scope==='overall'){
   const reserved=['rules','play','ranking'].includes(s.phase)?s.wagers[team]+(s.bet?.team===team?s.bet.amount:0):0;
   assert(reserved===0||value>=reserved,'This team has '+reserved+' points reserved in active wagers. The total cannot be lower until those wagers are settled or voided.');
   s.teams[team].score=value;
 }else{
   assert(s.phase==='play'||s.phase==='ranking','Game scores can be adjusted during play or before placements are awarded.');
   s.points[team]=value;
 }
 s.history.push('Host adjustment · '+s.teams[team].name+' · '+(scope==='overall'?'Gauntlet':PLAN_GAMES[s.game].name)+': '+before+' → '+value+'.');
}
// Only this allowlisted snapshot is sent to the audience window. No secret inputs.
export type PlanScreen = {pokerPhase?:Poker['phase'];pokerFlipStarted?:number;gameResults?:{id:string;name:string;score:number;rank:number}[];equationExample?:boolean;gradationExample?:boolean;rectangleExample?:boolean;wagering?:boolean;finale?:boolean;intro?:boolean;rowsLayout?:'side-by-side';rectangles?:{grid:RectangleCell[][];target:number;mode:string;locked:boolean[];answer?:number};title:string;subtitle:string;teams:Plan['teams'];points:number[];message:string;cards?:{label:string;card?:Card;chips:number[]}[];stacks?:string[][];towerMotion?:TowerMotion;rules?:string[];rows?:{label:string;cells:{text:string;color?:string}[]}[];clues?:{word:string;score:number;stage:number}[];teamGuesses?:string[];deadline:number|null;musicPlaying:boolean;result?:string;handLabels?:string[];community?:Card[];cups?:{team:number;points:number;streak:number;selected?:{shade:string;value?:number};remaining:number;remainingShades:string[];revealed:boolean}[];history?:string[]};
export const cardText=(c:Card)=>`${({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[c.rank]||c.rank}${['♠','♥','♦','♣'][c.suit]}`;
export function publicPlan(s:Plan):PlanScreen{const g=PLAN_GAMES[s.game];const v:PlanScreen={title:s.phase==='wager'?g.category:s.phase==='setup'||s.phase==='complete'?"Qoobee’s Plan":g.name,subtitle:'',teams:s.teams,points:s.points,message:'',deadline:s.deadline,musicPlaying:s.musicPlaying};
 if(s.phase==='setup'){v.intro=true;v.subtitle='';v.title="Qoobee's Plan";return v;}
 if(s.phase==='wager'){v.wagering=true;return v;}
 if(s.phase==='rules'){v.message='How to play';v.rules=g.rules.split('\n');if(s.game===1)v.equationExample=true;if(s.game===3)v.gradationExample=true;if(s.game===0)v.rectangleExample=true;return v;}
 if(s.phase==='complete'){v.finale=true;v.title='Final standings';v.subtitle='';return v;}
 if(s.phase==='ranking'){v.result='Game complete';return v;}
 if(s.phase==='result'){v.gameResults=s.ranks.map((t,i)=>({id:String(t),name:s.teams[t].name,score:s.points[t],rank:roundRobin(s)?s.ranks.findIndex(other=>s.points[other]===s.points[t])+1:i+1}));return v;}
 if(s.game===0){const r=s.rectangles;v.result=r.result;v.message=r.phase==='ready'?'Ready for the next puzzle?':r.phase==='answer'?s.teams[r.buzz!].name+' to answer':r.phase==='open'?'Buzz when you know the count.':'';if(r.phase!=='ready')v.rectangles={grid:r.grid,target:r.target,mode:r.mode,locked:r.locked,answer:r.phase==='result'?countRectangles(r.grid,r.target,r.mode):undefined};}
 if(s.game===2){
 const p=s.poker;v.pokerPhase=p.phase;v.pokerFlipStarted=p.flipStarted;v.result=p.result;v.message=p.result?'':({ready:'Ready to memorize?',flipping:'Revealing cards',memorize:'Memorize the board',answer:'Choose two card letters, A–P',review:'Revealing team hands',reveal:'Round complete'}[p.phase]);
 const picks=p.revealed.map((shown,i)=>shown?parseCards(p.answers[i]):[]);
 v.cards=p.cards.slice(0,16).map((card,i)=>({label:String.fromCharCode(65+i),card:p.phase==='flipping'||p.phase==='memorize'||p.phase==='review'||p.phase==='reveal'||picks.some(a=>a.includes(i))?card:undefined,chips:picks.flatMap((a,team)=>a.includes(i)?[team]:[])}));
 if(['answer','review','reveal'].includes(p.phase))v.community=p.cards.slice(16);
 v.handLabels=p.revealed.map((shown,i)=>shown?p.hands[i]:'');
 }

 if(s.game===1||s.game===3){const pair=PAIRS[s.pair];v.subtitle=`Match ${s.pair+1} / 3 · ${s.teams[pair[0]].name} vs ${s.teams[pair[1]].name}`;if(!s.matchReady){return v;}if(s.game===1){const e=s.equation;v.rowsLayout='side-by-side';v.result=e.result;v.message=e.result?'':e.phase==='setup'?'Teams are setting their secret equations.':'Both teams: submit your guesses for this round.';
 v.rows=pair.map((team,i)=>({label:s.teams[team].name,cells:e.guesses.filter(g=>g.team===i).flatMap(g=>g.text.split('').map((text,j)=>({text,color:g.lights[j]})))}));
 }else{const d=s.gradation;v.result=d.result;v.message=d.result?'':d.phase==='setup'?'Teams are preparing their secret cubes.':s.teams[pair[d.phase==='reply'?1-d.lead:d.lead]].name+' to play';
 v.cups=pair.map((team,i)=>({team,points:d.points[i],streak:d.streak[i],remaining:7-d.used[i].length,remainingShades:shades.filter((_,position)=>!d.used[i].includes(position)),revealed:d.phase==='reveal'||d.phase==='set',selected:d.selected[i]===null?undefined:{shade:shades[d.selected[i]!],...((d.phase==='reveal'||d.phase==='set')?{value:d.rows[i][d.selected[i]!]}:{})}}));
 }}

 if(s.game===4){const w=s.word;v.subtitle=w.practice?'Practice · Host’s hidden word':`Round ${Math.floor(w.turn/3)+1} · ${s.teams[w.turn%3].name} sets · Stage ${w.stage}`;v.result=w.result;v.message=w.result?'':(w.phase==='setup'?'Teams are choosing their hidden words.':w.phase==='guess'?'Both guessing teams: submit your answers.':'Listen to the clues.');v.clues=w.clues;if(w.phase==='reveal')v.teamGuesses=w.guesses.map((guess,i)=>!w.practice&&i===w.turn%3?'':guess);}
 v.message='';
 return v;
}

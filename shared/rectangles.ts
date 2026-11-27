export type RectangleCell=number|null|'hole';
export type RectangleDifficulty='easy'|'medium'|'hard';
export type RectanglePuzzle={winner?:number;difficulty:RectangleDifficulty;grid:RectangleCell[][];target:number;mode:'exact'|'at-least';phase:'ready'|'open'|'answer'|'result';locked:boolean[];buzz:number|null;roundDeadline:number|null;result:string};
// A hole is absent board area, distinct from a visible blank cell (zero).
export function countRectangles(grid:RectangleCell[][],target:number,mode:'exact'|'at-least'='exact'){
 let count=0;const h=grid.length,w=grid[0]?.length||0;
 for(let top=0;top<h;top++)for(let bottom=top;bottom<h;bottom++)for(let left=0;left<w;left++)for(let right=left;right<w;right++){
 let sum=0,valid=true;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const cell=grid[y][x];if(cell==='hole')valid=false;else sum+=cell??0;}
 if(valid&&(mode==='exact'?sum===target:sum>=target))count++;
 }return count;
}

function puzzle(difficulty:RectangleDifficulty,grid:RectangleCell[][],target:number,mode:RectanglePuzzle['mode']='exact'):RectanglePuzzle{
 return {difficulty,grid,target,mode,phase:'ready',locked:[false,false,false],buzz:null,roundDeadline:null,result:''};
}
// Transcribed from the supplied boards. Dots denote absent cells, not zeros.
export function rectangleExamples():RectanglePuzzle[]{
 const perforated=['1.1111.1','1111.111','11.1111.','.1111.11','111.1111','1.1111.1','1111.111','11.1111.'].map(row=>[...row].map(c=>c==='.'?'hole' as const:1));
 const tops=[1,1,2,3,1,0,3,0,1,2,3],bottoms=[4,4,3,3,5,4,3,3,3,3,3];
 const branches:RectangleCell[][]=Array.from({length:6},(_,y)=>tops.map((top,x)=>y<top||y>bottoms[x]?'hole':y===3&&(x===3||x===6)?1:null));
 const cross:RectangleCell[][]=Array.from({length:7},(_,y)=>Array.from({length:7},(_,x)=>x===3&&y<3?64:x===3&&y>3?16:y===3&&x<3?4:y===3&&x>3?1:null));
 return [puzzle('hard',perforated,5),puzzle('medium',Array.from({length:6},()=>Array(6).fill(1)),6),puzzle('hard',branches,0),puzzle('medium',cross,147)];
}
export function newRectangles(difficulty:RectangleDifficulty='easy',random:()=>number=Math.random):RectanglePuzzle{
 const examples=rectangleExamples().filter(p=>p.difficulty===difficulty);
 if(examples.length&&random()<.25)return examples[Math.floor(random()*examples.length)];
 const h=difficulty==='easy'?3+Math.floor(random()*3):difficulty==='medium'?6+Math.floor(random()*2):6;
 const w=difficulty==='easy'?3+Math.floor(random()*3):difficulty==='medium'?6+Math.floor(random()*2):11;
 const pattern=random(),uniform=1+Math.floor(random()*4),cy=Math.floor(h/2),cx=Math.floor(w/2);
 const arms=[1,4,16,64];
 const grid:RectangleCell[][]=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>{
 if(pattern<.3)return uniform;
 if(pattern<.6)return x===cx&&y<cy?arms[3]:x===cx&&y>cy?arms[2]:y===cy&&x<cx?arms[1]:y===cy&&x>cx?arms[0]:null;
 return random()<(difficulty==='hard'?.85:.25)?null:Math.floor(random()*9)-3;
 }));
 if(difficulty==='medium'&&random()<.5){
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if((x+y)%2===0&&random()<.55)grid[y][x]='hole';
 grid[2][2]='hole';
 }
 if(difficulty==='hard'){
 const tops=[1,1,2,3,1,0,3,0,1,2,3],bottoms=[4,4,3,3,5,4,3,3,3,3,3],mirror=random()<.5;
 for(let x=0;x<w;x++){const col=mirror?w-1-x:x,top=Math.max(0,Math.min(3,tops[col]+(random()<.3?1:0)));for(let y=0;y<h;y++)if(y<top||y>bottoms[col])grid[y][x]='hole';}
 }
 let target=0,seen=0;
 for(let top=0;top<h;top++)for(let bottom=top;bottom<h;bottom++)for(let left=0;left<w;left++)for(let right=left;right<w;right++){
 let sum=0,valid=true;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const c=grid[y][x];if(c==='hole')valid=false;else sum+=c??0;}
 if(valid&&random()<1/++seen)target=sum;
 }
 return puzzle(difficulty,grid,target);
}

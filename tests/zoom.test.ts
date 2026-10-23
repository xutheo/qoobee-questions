import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomCrop} from '../src/zoom-image';
test('zoom crops stay within image at edges and reveal full image after 30 seconds',()=>{
 for(const x of [0,.5,1]) for(const y of [0,.5,1]) for(let ms=0;ms<=30000;ms+=5000){const c=zoomCrop(800,600,x,y,ms);assert.ok(c.x>=0 && c.y>=0 && c.x+c.w<=800 && c.y+c.h<=600);}
 assert.equal(zoomCrop(800,600,.5,.5,4999).w,200);assert.equal(zoomCrop(800,600,.5,.5,5000).w,800/3);
 for(const [step,factor] of [4,3,2.5,2,1.5,1.25,1].entries()) assert.equal(zoomCrop(800,600,.5,.5,step*5000).w,800/factor);
 assert.deepEqual(zoomCrop(800,600,0,1,30000),{x:0,y:0,w:800,h:600});assert.equal(zoomCrop(800,600,.5,.5,0,true).w,800);
});

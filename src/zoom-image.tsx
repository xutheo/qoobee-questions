import React, {useEffect,useRef} from 'react';
export function zoomCrop(width:number,height:number,x:number,y:number,elapsedMs:number,revealed=false){
 const factor=[4,3,2.5,2,1.5,1.25,1][revealed?6:Math.max(0,Math.min(6,Math.floor(elapsedMs/5000)))];
 const w=width/factor,h=height/factor;
 return {x:Math.max(0,Math.min(width-w,x*width-w/2)),y:Math.max(0,Math.min(height-h,y*height-h/2)),w,h};
}
export function ZoomImage({src,focus,elapsedMs,revealed}:{src:string;focus:{x:number;y:number};elapsedMs:number;revealed:boolean}){
 const ref=useRef<HTMLCanvasElement>(null),stage=Math.floor(elapsedMs/5000);
 useEffect(()=>{let cancelled=false;const image=new Image();image.onload=()=>{const canvas=ref.current;if(cancelled || !canvas)return;canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const crop=zoomCrop(canvas.width,canvas.height,focus.x,focus.y,stage*5000,revealed);canvas.getContext('2d')?.drawImage(image,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);};image.src=src;return()=>{cancelled=true;};},[src,focus.x,focus.y,stage,revealed]);
 return <canvas ref={ref} className="clue-image" role="img" aria-label="Zoomed image — identify the picture"/>;
}

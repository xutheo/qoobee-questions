import React, {useLayoutEffect,useRef} from 'react';

// Measure the space actually left after controls, scores, category and buzzer.
// Physical monitor pixels are not usable CSS pixels (zoom, scaling and window chrome).
export function FitClue({children}:{children:React.ReactNode}) {
 const box=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const outer=box.current!,inner=content.current!;let frame=0,disposed=false;
  const fit=()=>{
   frame=0;if(disposed)return;
   const scale=Math.min(1,Math.max(0,outer.clientHeight-4)/Math.max(1,inner.offsetHeight),Math.max(0,outer.clientWidth-4)/Math.max(1,inner.scrollWidth));
   inner.style.transform=`translate(-50%, -50%) scale(${scale})`;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule);observer.observe(outer);observer.observe(inner);
  const mutations=new MutationObserver(schedule);mutations.observe(inner,{childList:true,subtree:true,characterData:true});
  outer.addEventListener('load',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);document.addEventListener('fullscreenchange',schedule);
  void document.fonts.ready.then(schedule);fit();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();outer.removeEventListener('load',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);document.removeEventListener('fullscreenchange',schedule);};
 },[]);
 return <div className="stream-clue-body" ref={box}><div className="stream-clue-fit" ref={content}>{children}</div></div>;
}

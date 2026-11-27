import React,{useLayoutEffect,useRef} from 'react';

// Fit actual wrapped text and examples, rather than estimating by character count.
export function PlanRules({children}:{children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const box=ref.current!,list=box.querySelector('ol')!;
  let frame=0,disposed=false;
  const fit=()=>{
   frame=0;if(disposed)return;
   const stage=box.closest('.plan-stage')!,footer=stage.querySelector('.plan-scores')!;
   const audience=!!box.closest('.plan-audience');
   const available=audience?Math.max(100,window.innerHeight-box.getBoundingClientRect().top-footer.getBoundingClientRect().height-76):Math.max(300,Math.min(750,window.innerHeight-260));
   let low=12,high=48;
   for(let i=0;i<10;i++){
    const size=(low+high)/2;list.style.fontSize=size+'px';
    if(box.getBoundingClientRect().height<=available&&box.scrollWidth<=box.clientWidth+1)low=size;else high=size;
   }
   list.style.fontSize=Math.floor(low*0.8*10)/10+'px';
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule);observer.observe(box.parentElement!);
  window.addEventListener('resize',schedule);document.addEventListener('fullscreenchange',schedule);
  void document.fonts.ready.then(()=>{if(!disposed)schedule();});fit();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);document.removeEventListener('fullscreenchange',schedule);};
 },[children]);
 return <div className="plan-rules-screen" ref={ref}>{children}</div>;
}



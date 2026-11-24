import React, {useEffect,useState} from 'react';
const preferenceKey='qoobee-keep-screen-awake';
export function KeepAwake() {
 const supported=window.isSecureContext && 'wakeLock' in navigator;
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}});
 const [status,setStatus]=useState('Off'),[retry,setRetry]=useState(0);
 useEffect(()=>{
  try{localStorage.setItem(preferenceKey,String(enabled));}catch{}
  if(!supported || !enabled){setStatus('Off');return;}
  let disposed=false,pending=false,lock:WakeLockSentinel|null=null;
  async function acquire(){
   if(disposed || pending || lock && !lock.released)return;
   if(document.visibilityState!=='visible'){setStatus('Waiting for this tab');return;}
   pending=true;setStatus('Activating…');
   try{
    const next=await navigator.wakeLock.request('screen');
    if(disposed){await next.release();return;}
    lock=next;setStatus('Active');
    next.addEventListener('release',()=>{if(disposed || lock!==next)return;lock=null;setStatus(document.visibilityState==='visible'?'Released by device — retry':'Waiting for this tab');});
   }catch{if(!disposed)setStatus('Unavailable — retry');}
   finally{pending=false;}
  }
  const visibility=()=>{if(document.visibilityState==='visible')void acquire();};
  document.addEventListener('visibilitychange',visibility);
  void acquire();
  return()=>{disposed=true;document.removeEventListener('visibilitychange',visibility);if(lock)void lock.release().catch(()=>{});};
 },[enabled,supported,retry]);
 return <div className="keep-awake"><label><input type="checkbox" checked={enabled && supported} disabled={!supported} onChange={e=>setEnabled(e.target.checked)}/>Keep screen awake</label><span role="status">{!supported ? !window.isSecureContext?'Requires HTTPS':'Not supported by this browser':status}</span>{supported && enabled && status.includes('retry') && <button className="text-link" onClick={()=>setRetry(n=>n+1)}>Retry</button>}</div>;
}

import type {Express,Request} from 'express';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {planSchema} from '../shared/plan-schema';
import {publicPlan,type Plan} from '../shared/plan';
export function registerPlanSessions(app:Express){
 const rooms=new Map<string,{token:string;controller:string;state:Plan;revision:number;updated:number}>();
 const prune=()=>{for(const [id,r] of rooms)if(Date.now()-r.updated>12*60*60*1000)rooms.delete(id);};
 const authorized=(req:Request)=>{const r=rooms.get(String(req.params.id));return r&&req.headers.authorization===`Bearer ${r.token}`?r:undefined;};
 app.post('/api/plan-sessions',(req,res)=>{prune();const parsed=planSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'Invalid game state.'});return;}if(rooms.size>=100){res.status(429).json({error:'Too many sessions. Try later.'});return;}const id=randomUUID(),token=randomUUID();rooms.set(id,{token,controller:'',state:parsed.data,revision:0,updated:Date.now()});const port=req.get('host')?.split(':').pop();const addresses=Object.values(networkInterfaces()).flat().filter(a=>a?.family==='IPv4'&&!a.internal).map(a=>`${req.protocol}://${a!.address}${port&&/^\d+$/.test(port)?':'+port:''}`);res.json({id,token,addresses});});
 app.post('/api/plan-sessions/:id/claim',(req,res)=>{const r=authorized(req);if(!r){res.status(403).json({error:'Session expired or host link is invalid.'});return;}r.controller=randomUUID();r.updated=Date.now();res.json({state:r.state,controller:r.controller,revision:r.revision});});
 app.post('/api/plan-sessions/:id/state',(req,res)=>{const r=authorized(req);if(!r){res.status(403).json({error:'Session expired. Create a new shared session.'});return;}if(req.body.controller!==r.controller){res.status(409).json({error:'Control moved to another device. Reload this host link to take control here.'});return;}const parsed=planSchema.safeParse(req.body.state);if(!parsed.success){res.status(400).json({error:'Invalid game update.'});return;}if(JSON.stringify(r.state)!==JSON.stringify(parsed.data)){r.state=parsed.data;r.revision++;}r.updated=Date.now();res.json({revision:r.revision});});
 app.get('/api/plan-sessions/:id/display',(req,res)=>{prune();const r=rooms.get(String(req.params.id));res.setHeader('Cache-Control','no-store');if(!r){res.status(404).json({error:'Session unavailable. Start a shared session from the host.'});return;}res.json({revision:r.revision,screen:publicPlan(r.state)});});
}

import sys,json,datetime as dt,pathlib
sys.dont_write_bytecode=True
sys.path.insert(0,r'C:\Users\zhaok\Desktop\whodle\whodle\picker')
from app import Discord,config,snowflake,UTC
client_token,guild,_=config();client=Discord(client_token)
assert client.get('/guilds/'+guild)['name']=='Sussy Times'
start=dt.datetime(2024,1,1,tzinfo=UTC);end=dt.datetime(2025,3,2,tzinfo=UTC)
report={'start':start.isoformat(),'end':end.isoformat(),'match':'One or more t/T characters and optional whitespace only; includes bot messages; March 1 inclusive UTC; excludes #t','channels':[],'warnings':[]}
output=pathlib.Path(r'C:\Users\zhaok\Documents\ChatGPT\jeopardy web-app\exports\discord-t-other-channels-2024-2025.json')
def save():
    report['total']=sum(c['count'] for c in report['channels']);report['scanned']=sum(c['scanned'] for c in report['channels']);report['totalTs']=sum(c['totalTs'] for c in report['channels'])
    output.write_text(json.dumps(report,indent=2),encoding='utf-8')
channels=client.get('/guilds/'+guild+'/channels');targets={c['id']:c for c in channels if c['type'] in (0,5,2,13)}
try:
    for t in client.get('/guilds/'+guild+'/threads/active')['threads']:targets[t['id']]=t
except ValueError as e:report['warnings'].append('Active threads: '+str(e))
for c in channels:
    if c['type'] not in (0,5,15,16):continue
    kinds=['public']+(['private','joined/private'] if c['type']==0 else [])
    for kind in kinds:
        before=None
        while True:
            path='/channels/'+c['id']+('/users/@me/threads/archived/private' if kind=='joined/private' else '/threads/archived/'+kind)
            params={'limit':100}
            if before:params['before']=before
            try:data=client.get(path,params)
            except ValueError as e:
                report['warnings'].append(c['name']+' archived '+kind+': '+str(e));break
            batch=data.get('threads',[])
            for t in batch:targets[t['id']]=t
            if not data.get('has_more') or not batch:break
            before=batch[-1]['id'] if kind=='joined/private' else batch[-1]['thread_metadata']['archive_timestamp']
    print('Discovered threads for '+c['name'],flush=True)
report['targets']=len(targets);save()
for c in targets.values():
    if c['name']=='t' and c.get('type')==0:continue
    row={'id':c['id'],'name':c['name'],'count':0,'totalTs':0,'scanned':0,'complete':False};report['channels'].append(row)
    before=snowflake(end)
    try:
        while True:
            batch=client.get('/channels/'+c['id']+'/messages',{'limit':100,'before':before})
            if not batch:break
            done=False
            for m in batch:
                stamp=dt.datetime.fromisoformat(m['timestamp'].replace('Z','+00:00'))
                if stamp<start:done=True;break
                if stamp>=end:continue
                row['scanned']+=1
                content=''.join(m.get('content','').split()).lower()
                if content and set(content)=={'t'}:row['count']+=1;row['totalTs']+=len(content)
            before=batch[-1]['id']
            if row['scanned'] and row['scanned']%10000==0:
                save();print(c['name']+': '+str(row['scanned'])+' scanned, '+str(row['count'])+' matches',flush=True)
            if done or len(batch)<100:break
        row['complete']=True
    except ValueError as e:report['warnings'].append(c['name']+': '+str(e))
    save();print('Finished '+c['name']+': '+str(row['count'])+' matches ('+str(row['scanned'])+' scanned)',flush=True)
report['finished']=True;save();print('TOTAL '+str(report['total'])+'; scanned '+str(report['scanned'])+'; warnings '+str(len(report['warnings'])),flush=True)

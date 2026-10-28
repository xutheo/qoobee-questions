import sys,json,datetime as dt,pathlib,collections
sys.dont_write_bytecode=True
sys.path.insert(0,r'C:\Users\zhaok\Desktop\whodle\whodle\picker')
from app import Discord,config,snowflake,UTC
token,guild,_=config();client=Discord(token)
assert client.get('/guilds/'+guild)['name']=='Sussy Times'
channel=next(c for c in client.get('/guilds/'+guild+'/channels') if c['name']=='t' and c['type']==0)
start=dt.datetime(2024,1,1,tzinfo=UTC);end=dt.datetime.now(UTC)
report={'channel':'t','channelId':channel['id'],'start':start.isoformat(),'end':end.isoformat(),'rule':'One or more ASCII t/T characters, ignoring all whitespace; no other characters. Includes bot messages.','scannedMessages':0,'matchingMessages':0,'totalTs':0,'histogram':{},'complete':False}
before=snowflake(end);hist=collections.Counter()
while True:
 batch=client.get('/channels/'+channel['id']+'/messages',{'limit':100,'before':before})
 if not batch:break
 stop=False
 for m in batch:
  stamp=dt.datetime.fromisoformat(m['timestamp'].replace('Z','+00:00'))
  if stamp<start:stop=True;break
  if stamp>=end:continue
  report['scannedMessages']+=1
  content=''.join(m.get('content','').split()).lower()
  if content and set(content)=={'t'}:
   report['matchingMessages']+=1;report['totalTs']+=len(content);hist[len(content)]+=1
 before=batch[-1]['id']
 if report['scannedMessages']%1000==0:print('Scanned',report['scannedMessages'],flush=True)
 if stop or len(batch)<100:break
report['histogram']={str(k):v for k,v in sorted(hist.items())};report['complete']=True
path=pathlib.Path('exports/discord-t-repeat-count.json');path.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2),flush=True)

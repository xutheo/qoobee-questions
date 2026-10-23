import sys,json,datetime as dt,pathlib
sys.dont_write_bytecode=True
sys.path.insert(0,r'C:\Users\zhaok\Desktop\whodle\whodle\picker')
from app import Discord,config,snowflake,UTC
token,guild,_=config();client=Discord(token)
channels=client.get('/guilds/'+guild+'/channels')
channel=next(c for c in channels if c['name']=='t' and c['type']==0)
start=dt.datetime(2024,1,1,tzinfo=UTC);end=dt.datetime.now(UTC)
report={'channel':'t','channelId':channel['id'],'start':start.isoformat(),'end':end.isoformat(),'rule':'content.strip().lower() == t','scanned':0,'total':0,'exactLowercase':0,'exactUppercase':0,'withWhitespace':0}
before=snowflake(end)
while True:
    batch=client.get('/channels/'+channel['id']+'/messages',{'limit':100,'before':before})
    if not batch:break
    stop=False
    for m in batch:
        stamp=dt.datetime.fromisoformat(m['timestamp'].replace('Z','+00:00'))
        if stamp<start:stop=True;break
        if stamp>=end:continue
        report['scanned']+=1
        content=m.get('content','')
        if content.strip().lower()=='t':
            report['total']+=1
            report['exactLowercase' if content=='t' else 'exactUppercase' if content=='T' else 'withWhitespace']+=1
    before=batch[-1]['id']
    if stop or len(batch)<100:break
path=pathlib.Path(r'C:\Users\zhaok\Documents\ChatGPT\jeopardy web-app\exports\discord-t-channel-count.json')
path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2),flush=True)

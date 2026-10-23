"""Local read-only Discord picker. Python standard library only."""
import ast, datetime as dt, json, os, pathlib, threading, time, urllib.request, urllib.error, urllib.parse, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT=pathlib.Path(__file__).resolve().parent
API='https://discord.com/api/v10'
UTC=dt.timezone.utc

def config():
    tree=ast.parse((ROOT.parent/'scripts/generate_data.py').read_text(encoding='utf-8'))
    values={}
    for node in tree.body:
        if isinstance(node,ast.Assign):
            for target in node.targets:
                if isinstance(target,ast.Name) and target.id in ('TOKEN','GUILD_ID','CHANNEL_MAP'):
                    try: values[target.id]=ast.literal_eval(node.value)
                    except (ValueError,TypeError): pass
    token=os.environ.get('DISCORD_TOKEN') or values.get('TOKEN')
    if not token: raise ValueError('Set DISCORD_TOKEN or configure TOKEN in scripts/generate_data.py.')
    return token,str(values['GUILD_ID']),values.get('CHANNEL_MAP',{})

class Discord:
    def __init__(self,token): self.token=token;self.lock=threading.Lock()
    def get(self,path,params=None):
        url=API+path+('?' + urllib.parse.urlencode(params) if params else '')
        with self.lock:
            for attempt in range(6):
                try:
                    req=urllib.request.Request(url,headers={'Authorization':'Bot '+self.token,'User-Agent':'WhodlePicker/1.0'})
                    with urllib.request.urlopen(req,timeout=30) as response:
                        data=json.load(response)
                        if response.headers.get('X-RateLimit-Remaining')=='0': time.sleep(min(60,float(response.headers.get('X-RateLimit-Reset-After','1'))))
                        return data
                except urllib.error.HTTPError as error:
                    if error.code==429:
                        try: delay=float(json.load(error).get('retry_after',2))
                        except Exception: delay=2
                        time.sleep(min(60,max(.1,delay)));continue
                    if error.code>=500 and attempt<5:time.sleep(2**attempt);continue
                    hints={401:'Bot token rejected. Update the server-side token.',403:'Bot lacks access. Check View Channel, Read Message History, and relevant intents.',404:'Discord resource not found.'}
                    raise ValueError(hints.get(error.code,f'Discord returned HTTP {error.code}.')) from None
                except (urllib.error.URLError,TimeoutError):
                    raise ValueError('Could not reach Discord. Check the connection and retry.') from None
        raise ValueError('Discord rate limit persisted. Please retry later.')

def dates(start,end):
    a=dt.datetime.combine(dt.date.fromisoformat(start),dt.time.min,UTC)
    b=dt.datetime.combine(dt.date.fromisoformat(end)+dt.timedelta(days=1),dt.time.min,UTC)
    if a>=b:raise ValueError('End date must be on or after start date.')
    return a,b

def snowflake(date):return str(max(0,(int(date.timestamp()*1000)-1420070400000)<<22))

def images(message):
    result=[]
    for item in message.get('attachments',[]):
        if (item.get('content_type','').startswith('image/') or item.get('filename','').lower().endswith(('.png','.jpg','.jpeg','.gif','.webp'))):
            if item.get('url','').startswith('https://'):result.append(item['url'])
    for embed in message.get('embeds',[]):
        image=embed.get('image') or (embed.get('thumbnail') if embed.get('type') in ('image','gifv') else None)
        if image and image.get('url','').startswith('https://'):result.append(image['url'])
    return list(dict.fromkeys(result))

def match(message,user,start,end,mode,minimum,unit):
    if str(message.get('author',{}).get('id'))!=user or message.get('author',{}).get('bot'):return False
    stamp=dt.datetime.fromisoformat(message['timestamp'].replace('Z','+00:00'))
    if not start<=stamp<end:return False
    text=message.get('content','').strip()
    length=len(text.split()) if unit=='words' else len(text)
    return length>=minimum and (bool(text) if mode=='quote' else bool(images(message)))

def save_results(filters, job):
    folder=ROOT/'results'
    folder.mkdir(exist_ok=True)
    stamp=dt.datetime.now(UTC)
    name=f"{stamp.strftime('%Y%m%dT%H%M%S%fZ')}-{filters['mode']}-{filters['user']}-{uuid.uuid4().hex[:8]}.json"
    target=folder/name
    payload={'exportedAt':stamp.isoformat(),'filters':filters,'status':job['status'],
             'scanned':job.get('scanned',0),'matched':job.get('matched',0),
             'warnings':job.get('warnings',[]),'results':job.get('results',[])}
    temporary=target.with_suffix('.tmp')
    try:
        temporary.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return str(target)

def run_search(client,guild,channels,p,job):
    try:
        start,end=dates(p['start'],p['end']);user=p['user'];minimum=int(p.get('minimum',0));limit=int(p.get('limit',20000))
        if not user.isdecimal() or not 15<=len(user)<=22:raise ValueError('Choose a user or enter their numeric Discord ID.')
        if not 0<=minimum<=4000 or not 100<=limit<=100000:raise ValueError('Invalid minimum length or scan limit.')
        mode=p['mode'];unit=p.get('unit','characters')
        if mode not in ('quote','post') or unit not in ('characters','words'):raise ValueError('Invalid filter.')
        member=client.get(f'/guilds/{guild}/members/{user}')
        author=member.get('nick') or member['user'].get('global_name') or member['user']['username']
        selected=p.get('channels') or [c['id'] for c in channels]
        if not isinstance(selected,list) or any(x not in {c['id'] for c in channels} for x in selected):raise ValueError('Choose channels from this server.')
        picked=[];seen=set();matched=0;scanned=0;warnings=[]
        for channel in channels:
            if channel['id'] not in selected:continue
            before=snowflake(end);job.update(channel=channel['name'])
            while scanned<limit and not job.get('cancel'):
                try: batch=client.get('/channels/'+channel['id']+'/messages',{'limit':100,'before':before})
                except ValueError as e:warnings.append(channel['name']+': '+str(e));break
                if not batch:break
                before=batch[-1]['id'];stop=False
                for message in batch:
                    stamp=dt.datetime.fromisoformat(message['timestamp'].replace('Z','+00:00'))
                    if stamp<start:stop=True;break
                    if scanned>=limit:break
                    scanned+=1
                    if not match(message,user,start,end,mode,minimum,unit):continue
                    urls=images(message);text=message.get('content','').strip();key=message['id']
                    if key in seen:continue
                    seen.add(key);matched+=1
                    item={'messageId':message['id'],'authorId':user,'answer':author,'type':mode,'text':text,'images':urls if mode=='post' else [],'timestamp':message['timestamp'],'channel':channel['name'],'discordUrl':f'https://discord.com/channels/{guild}/{channel["id"]}/{message["id"]}'}
                    picked.append(item)
                job.update(scanned=scanned,matched=matched,results=picked)
                if stop or len(batch)<100:break
            if scanned>=limit or job.get('cancel'):break
        if scanned>=limit:warnings.append('Scan limit reached: results include only scanned history, not the entire date range. Increase the limit or narrow channels/dates.')
        if matched==0:warnings.append('No matching messages found in scanned history. Image-only posts require minimum length 0. Empty content may mean Message Content Intent is disabled.')
        final_status='cancelled' if job.get('cancel') else 'done'
        job.update(warnings=warnings,results=picked)
        try:
            job['savedFile']=save_results(p,{**job,'status':final_status})
        except OSError:
            warnings.append('Could not automatically save results to disk. Use Download results JSON to keep them.')
        job['status']=final_status
    except (ValueError,KeyError,TypeError) as e:job.update(status='error',error=str(e))
    except Exception:job.update(status='error',error='Unexpected search failure. Check your filter values and try again.')

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def reply(self,data,status=200):
        body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
    def allowed(self):
        host=self.headers.get('Host','');origin=self.headers.get('Origin')
        return host in (f'127.0.0.1:{PORT}',f'localhost:{PORT}') and (not origin or origin in (f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}'))
    def do_GET(self):
        if not self.allowed():self.reply({'error':'Local access only.'},403);return
        parsed=urllib.parse.urlparse(self.path);query=urllib.parse.parse_qs(parsed.query)
        try:
            if parsed.path=='/':
                body=(ROOT/'index.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
            elif parsed.path=='/api/info':self.reply({'guild':GUILD_NAME,'bot':BOT_NAME,'channels':CHANNELS})
            elif parsed.path=='/api/users':
                q=query.get('q',[''])[0].strip()
                if not q:raise ValueError('Enter a name or user ID.')
                members=[CLIENT.get(f'/guilds/{GUILD}/members/{q}')] if q.isdecimal() else CLIENT.get(f'/guilds/{GUILD}/members/search',{'query':q,'limit':100})
                self.reply([{'id':m['user']['id'],'name':m.get('nick') or m['user'].get('global_name') or m['user']['username'],'username':m['user']['username']} for m in members if not m['user'].get('bot')])
            elif parsed.path=='/api/job':
                snapshot=dict(JOBS.get(query.get('id',[''])[0],{'status':'error','error':'Search not found.'}))
                if snapshot['status']=='running':snapshot.pop('results',None)
                self.reply(snapshot)
            else:self.reply({'error':'Not found'},404)
        except ValueError as e:self.reply({'error':str(e)},400)
    def do_POST(self):
        if not self.allowed():self.reply({'error':'Local access only.'},403);return
        try:
            n=int(self.headers.get('Content-Length',0))
            if not 0<n<20000:raise ValueError('Invalid request size.')
            p=json.loads(self.rfile.read(n))
            if self.path=='/api/search':
                with JOB_LOCK:
                    if any(j['status']=='running' for j in JOBS.values()):raise ValueError('A search is already running. Wait or cancel it first.')
                    JOBS.clear();key=uuid.uuid4().hex;job={'status':'running','scanned':0,'matched':0,'results':[]};JOBS[key]=job
                threading.Thread(target=run_search,args=(CLIENT,GUILD,CHANNELS,p,job),daemon=True).start();self.reply({'id':key})
            elif self.path=='/api/cancel':
                if p.get('id') in JOBS:JOBS[p['id']]['cancel']=True
                self.reply({'ok':True})
            else:self.reply({'error':'Not found'},404)
        except (ValueError,TypeError) as e:self.reply({'error':str(e)},400)

if __name__=='__main__':
    PORT=int(os.environ.get('PICKER_PORT','3010'));JOBS={};JOB_LOCK=threading.Lock()
    try:
        token,GUILD,configured=config();CLIENT=Discord(token)
        BOT_NAME=CLIENT.get('/users/@me')['username'];GUILD_NAME=CLIENT.get('/guilds/'+GUILD)['name']
        if GUILD_NAME!='Sussy Times':raise ValueError('Configured server is not Sussy Times. Update GUILD_ID in the scraper configuration.')
        # Explicitly scoped to the existing scraper channel list, not every private channel.
        CHANNELS=[{'id':c['id'],'name':c['name']} for c in CLIENT.get('/guilds/'+GUILD+'/channels') if c['id'] in {str(x) for x in configured.values()} and c['type'] in (0,5)]
        if not CHANNELS:raise ValueError('No configured text channels are accessible.')
        print(f'Whodle picker ready: http://127.0.0.1:{PORT} ({len(CHANNELS)} configured channels)',flush=True)
        ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
    except (ValueError,OSError) as e:print('Startup failed: '+str(e),flush=True);raise SystemExit(1)

# Original synthesized reaction clips, generated locally; no third-party recordings.
import math,random,wave,struct
from pathlib import Path
random.seed(23)
sr=22050
out=Path('public/audio')
def save(name,x):
 peak=max(abs(v) for v in x) or 1
 with wave.open(str(out/name),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr)
  f.writeframes(b''.join(struct.pack('<h',int(v/peak*26000)) for v in x))
x=[0.]*(sr*3)
for k in range(125):
 start=int(random.uniform(0,2.7)*sr);amp=random.uniform(.2,1)*(1-start/len(x))**.4
 for j in range(int(.09*sr)):
  if start+j<len(x): x[start+j]+=random.uniform(-1,1)*amp*math.exp(-j/(sr*.016))
save('applause.wav',x)
x=[0.]*(sr*2)
for voice in range(7):
 pitch=130+voice*19;phase=random.random()*6.28
 for i in range(len(x)):
  t=i/sr;u=t/2;env=min(1,t/.15)*max(0,1-u)**.65
  f=pitch*(1.12-.3*u);phase+=2*math.pi*f/sr
  for h in range(1,24):
   freq=h*f
   amp=(math.exp(-((freq-(650-250*u))/130)**2)+.5*math.exp(-((freq-1000)/180)**2)+.2*math.exp(-((freq-2400)/250)**2))/h
   x[i]+=env*amp*math.sin(h*phase)
save('awww.wav',x)

import json,base64,io,copy
from pathlib import Path
from PIL import Image,ImageOps
source=Path(r'C:/Users/zhaok/Desktop/jelley-qoobee-questions.json')
data=json.loads(source.read_text(encoding='utf-8-sig'));cats={c['title']:copy.deepcopy(c) for b in data['boards'] for c in b}
def image(name):
    with Image.open(Path('images-for-qb-questions')/name) as raw:
        im=ImageOps.exif_transpose(raw).convert('RGBA');im.thumbnail((1280,1280))
        while True:
            out=io.BytesIO();im.save(out,format='WEBP',quality=85)
            url='data:image/webp;base64,'+base64.b64encode(out.getvalue()).decode()
            if len(url)<=180000:return url
            im=im.resize((max(1,int(im.width*.8)),max(1,int(im.height*.8))))
def cat(title,pairs,**flags):return dict(title=title,**flags,clues=[dict(prompt=p,answer=a,used=False) for p,a in pairs])
sussy=cat('Sussy Times',[
('Who is this?','Tofu'),
('Who created Sussy Times and in what year?','Brendan / Chowder & 2018'),
("How many A's are in Anthony & Annie's family (first name only)?",'6'),
('Of the people currently in attendance, how many of them have jobs?','7'),
('In 2022, this Sussy Times member created ARAM stats and rankings for members who participated in in-house ARAM games.','Dekkar')])
sussy['clues'][0].update(image=image('tofu.jpg'),imageAlt='Identify the pictured subject.')
lol=cat('LOL Halloween',[
('Name this skin.','Zombie Brand'),
('Haunted Maokai, Headless Hecarim and Underworld Twisted Fate accompanied the 2012 remake of this now-removed League map.','Twisted Treeline'),
('This 2010 Halloween skin became famous due to its splash art that featured the champion with a distorted and terrifying face that players said looked like the stuff of nightmares.','Lollipoppy'),
('When was the last year that Riot Games released a Halloween skin?','2022'),
('This Halloween skin line has by far the most skins with 16 skins and 2 prestige skins.','Bewitching')])
lol['clues'][0].update(image=image('lol-brand.png'),imageAlt='Identify this League of Legends skin.')
mon=cat('Qoobeemon',[('Name this Pokémon.',a) for a in ['Abra','Graveler','Heracross','Machoke','Wooper']])
for q in mon['clues']:q.update(image=image('qoobee-'+q['answer'].lower()+'.png'),imageAlt='Identify the Pokémon fused with Qoobee.')
stats=cat('Server Stats',[
('How many roles are there that are tied to the theme of the server?','9'),
('How many "Cha"s (case insensitive) are currently in Donald\'s Discord name in Sussy Times?','7'),
('As of October 1st, in 2026, there have been 20113 messages sent in Sussy Times. How many messages did dvrx (Mark), the top messenger, send?','4467'),
('How many times was the @arom? role mentioned since the start of this year?','150'),
('In 2024, Farm Merge Valley was all the rage in Sussy Times. Players went to other players\' farms and notified them of this with the message "t". How many "t"s or "T"s were sent in the server?','517')],openToAll=True,collectAnswers=True,submissionScope='team')
quote_sets=[('Ed / mrshu',[
("I did a 3.5lb bowl in like 12 minutes, granted there wasn't much else in there",'#sanrio-thoughts · 9/28/2026, 9:31:30 PM'),
('lost like 2 lbs of weight from sweating on the way home','#arom-stats · 3/17/2025, 8:03:11 PM'),
('thought you might be interested in some biometrics of mkbhd playing frisbee','#sanrio-thoughts · 12/19/2024, 8:47:57 PM')]),
('Arjun / spatika',[
('Soooo any hangouters this weekend? Pocket pokemon? Poker? Normal board games?','#jelley-events · 2/26/2025, 9:12:48 PM'),
('Hmmmm could be down. 2 movies back to back doe? hmmm','#jelley-events · 10/5/2024, 10:49:34 PM'),
("Apparently Subha has a class till 7 so we'll be there around 730",'#jelley-events · 3/3/2026, 5:21 PM')]),
('donald / doncha',[
('I need the verdict so I can bring it up to second court ya know','#defendant-donald · 9/28/2023, 3:11:14 PM'),
('kk. I might go to LA tuesday night or wednesday morning','#stream-archive · 6/23/2023, 9:58:49 AM'),
('still gymming @Costco Food Court   probs join the next game','#arom-stats · 3/22/2025, 7:54:43 PM')]),
('anthony / misder',[
("Pretty late but just tested positive for COVID, for those that were at Sunday's get-together.",'#jelley-events · 7/25/2024, 11:35:45 AM'),
('Anyone want to try this discord rpg autobattler? Need 3 more for a party. Maybe @selffir?\nhttps://discord.com/invite/boxbox-dungeon-server','#sanrio-thoughts · 5/30/2024, 7:13:34 AM'),
('Rip going to be late cause ava is refusing to take a bath - I read the rules tho','#general · 7/28/2026, 5:39:45 PM')]),
('v / infinit ori_',[
('i was looking at "black bean mayo" when you were sharing the menu and wondering if you can really categorize that with regular mayo','#sanrio-thoughts · 1/28/2026, 9:07:07 PM'),
('i followed roffles?? is following different than friending??','#sanrio-thoughts · 12/17/2024, 9:51:32 PM'),
('5am minimum for edg g2 to start....it is kinda cooked','#valorant · 2/22/2025, 4:13:49 AM')])]
quotes=cat('whosaidit',[('Who said it?',answer.replace('infinit ori_','infinitori_')) for answer,qs in quote_sets],openToAll=True,collectAnswers=False)
for q,(_,entries) in zip(quotes['clues'],quote_sets):q['quotes']=[dict(text=t,source=s) for t,s in entries]
cats['Pixel Perfect'].update(openToAll=True,collectAnswers=False,teamBased=False)
cats['Spooky Stats'].update(openToAll=True,collectAnswers=True,submissionScope='team',teamBased=False)
for title in ['Mental Math Relay','Bomb Defusal']:cats[title].update(teamBased=True,openToAll=False,collectAnswers=False)
data['boards']=[[cats['Ghost Pokemon'],sussy,cats['Homonyms'],cats['Pixel Perfect'],cats['Spooky Stats'],cats['Mental Math Relay']],[lol,mon,cats['Qoobee Questions'],quotes,stats,cats['Bomb Defusal']]]
for board in data['boards']:
    for c in board:
        for q in c['clues']:q['used']=False
out=Path('exports/jelley-qoobee-questions-6-categories.json');out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(out.resolve()));print('Bytes:',out.stat().st_size)

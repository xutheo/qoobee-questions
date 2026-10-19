import {readFileSync,writeFileSync} from 'node:fs';
import {allModesSampleContent} from '../shared/sample';
import {contentSchema,isClueReady} from '../shared/model';
import {sampleBombLevels} from '../shared/sample-bombs';
const category=(title:string,pairs:string[][],extra={})=>({title,...extra,clues:pairs.map(([prompt,answer])=>({prompt,answer,used:false}))});
const sample=allModesSampleContent();
const bombs=sampleBombLevels();
bombs[0].hints[1]='The star wire is cut before the square wire.';
bombs[2].hints[0]='Only the wires with convex polygon shapes will be cut.';
bombs[3].hints=['Cut the shape with the most lines of symmetry third.','The red wire is cut before the purple wire.','Any wire with a polygon shape with less than 4 sides should not be cut at all.','The green wire should be cut first.'];
bombs[3].solution=['Green ■','Red ★','Blue ●','Purple ◆'];
const ghost=category('Ghost Pokemon',[
['Name this pokemon.','Duskull'],
['This pokemon was the only ghost pokemon to be released in generation II.','Misdreavus'],
['This pokemon has this pokedex entry: "It wears a rag fashioned into a Pikachu costume in an effort to look less scary. Unfortunately, the costume only makes it creepier."','Mimikyu'],
['This generation IV electric/ghost pokemon was introduced in Diamond & Pearl with only one form. However, in Pokemon Platinum, it received additional forms dependent on the type of household appliance it possesses.','Rotom'],
['This ghost pokemon is named ゴースト (Gosuto) in Japanese, which translates to "Ghost". What is its English name?','Haunter']]);
Object.assign(ghost.clues[0],{image:'data:image/png;base64,'+readFileSync('images-for-qb-questions/duskull.png').toString('base64'),imageAlt:'Identify this mystery Pokemon.'});
const content=contentSchema.parse({name:'Edward — Qoobee Questions',boards:[[
category('Edward',[
  [
    "What is Ed's birthday?",
    "August 2nd"
  ],
  [
    "How many eggs did Ed eat in under 50 seconds?",
    "12"
  ],
  [
    "What Pokémon plush was in Ed's bedroom that he got from Japan?",
    "Ditto"
  ],
  [
    "What soft drink did Ed like / was known for as a kid?",
    "Fanta"
  ],
  [
    "What character is Ed's Steam profile picture?",
    "Squidward"
  ]
]),
category('Teamfight Tactics',[
  [
    "Without special bonuses, how much gold must you save to reach maximum base interest?",
    "50 gold"
  ],
  [
    "By combining copies, how many one-star copies of the same champion are needed to make a four-star champion?",
    "27 / Twenty-seven"
  ],
  [
    "What happens when you equip all three Tactician items — Crown, Cape, and Shield — on the same champion?",
    "Infinite money / Infinite gold"
  ],
  [
    "Which TFT set introduced Hextech Augments?",
    "Gizmos & Gadgets / Gizmos and Gadgets / Set 6"
  ],
  [
    "In the original Dragonlands set, a Dragon occupied two team slots but counted as how many units toward its marked origin trait?",
    "3 / Three"
  ]
]),
category('Homonyms',[
['Flying mammal found in caves; Piece of equipment found in baseball','Bat'],
['Financial institution; Land along a river','Bank'],
['Cylindrical container; The act of firing someone','Can'],
['Secret agent; SI unit for the amount of a substance','Mole'],
['Formal agreement between two parties; Process of becoming smaller in size','Contract']]),
category('Spooky Stats',[
['How many bones are typically in a human skeleton?','206'],
['What percentage of Americans plan to celebrate Halloween this year?','74%'],
['4.8 million Americans are planning to dress up as a witch, the top ranked costume for adults. How many Americans are expected to dress up as Batman, the third ranked costume?','2 million'],
['In October 2026, a Rhode Island grower set a new world record for the heaviest pumpkin. How many pounds did it weigh?','3,156 lbs'],
['How many billions of dollars are Americans projected to spend on Halloween in 2026?','13.5 billion']],{openToAll:true}),
sample.boards[1][2]
],[ghost,
category('Qoobee Questions',[
['This title is often given to a female monarch.','Queen'],
['This is a 14-line poem traditionally written in iambic pentameter with a strict rhyme scheme and a thematic turn.','Sonnet'],
['This chemical element is known as Sn on the periodic table with atomic number 50. It is commonly used to coat steel cans for food, beverages, and oils.','Tin'],
['This quantum version of the classic binary bit is the basic building block of quantum computers, allowing them to perform certain types of calculations in ways that classical computers cannot.','Qubit'],
['Derived from a Latin word meaning "everywhere," this ten-letter adjective describes something that seems to be present or encountered in all places at once.','Ubiquitous']]),
category('Magic: The Gathering',[
  [
    "Name all five colors of mana in Magic: The Gathering.",
    "White, blue, black, red, and green"
  ],
  [
    "In Commander, how many cards are in your deck, including your commander or commanders?",
    "100 / One hundred"
  ],
  [
    "Which keyword makes any nonzero amount of damage a source deals to a creature count as lethal damage?",
    "Deathtouch"
  ],
  [
    "Which keyword lets you cast an instant or sorcery from your graveyard for an alternative cost, then exiles it when it leaves the stack?",
    "Flashback"
  ],
  [
    "Which keyword action lets you choose any number of permanents and/or players with counters, then give each another counter of every kind it already has?",
    "Proliferate"
  ]
]),
{...sample.boards[1][4],title:'Pixel Perfect'},
{title:'Bomb Defusal',teamBased:true,clues:bombs.map(puzzle=>({prompt:puzzle.message,answer:'',used:false,kind:'group',groupMode:'time',linkLabel:'Bomb defusal',puzzle}))}
]],final:{"category":"Seattle","prompt":"Seattle is known by this colorful nickname, inspired by the lush evergreen scenery surrounding the city.","answer":"Emerald City"}});
if(content.boards.some(board=>board.length!==5||board.some(c=>c.clues.some(q=>!isClueReady(q)))))throw Error('Invalid clues');
writeFileSync('exports/jelley-qoobee-questions.json',JSON.stringify(content,null,2));
console.log('Validated 2 boards, 5 categories each, 50 ready clues. Embedded Duskull and five Pixel Perfect images. Seattle Final Jeopardy included.');

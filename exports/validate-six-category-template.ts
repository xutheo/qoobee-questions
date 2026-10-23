import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {contentSchema,isClueReady} from '../shared/model';
const d=contentSchema.parse(JSON.parse(readFileSync('exports/jelley-qoobee-questions-6-categories.json','utf8')));
assert.deepEqual(d.boards.map(b=>b.map(c=>c.title)),[['Ghost Pokemon','Sussy Times','Homonyms','Pixel Perfect','Spooky Stats','Mental Math Relay'],['LOL Halloween','Qoobeemon','Qoobee Questions','whosaidit','Server Stats','Bomb Defusal']]);
for(const b of d.boards)for(const c of b){assert.equal(c.clues.length,5);for(const q of c.clues)assert.ok(isClueReady(q),c.title+' has incomplete clue');}
for(const b of d.boards){assert.ok(b[3].openToAll&&!b[3].collectAnswers);assert.ok(!b[4].openToAll&&b[4].collectAnswers);assert.ok(b[5].teamBased);}
assert.ok(d.boards[1][3].clues.every(q=>q.quotes?.length===3&&q.quotes.every(x=>x.source.startsWith('#'))));
assert.ok(d.boards[1][1].clues.every(q=>q.image));
console.log('Validated: 2 boards, 6 categories each, 60 ready questions, 15 sourced quotes, correct category modes.');

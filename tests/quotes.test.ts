import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QuoteList} from '../src/quotes';
import {clueSchema,isClueReady} from '../shared/model';
const clue={prompt:'Who said it?',answer:'Someone',used:false,quotes:[{text:'First quote',source:'#channel · timestamp'},{text:'Second quote',source:''},{text:'Third quote',source:''}]};
test('quote display shows only the current quote and its source',()=>{
  const first=renderToStaticMarkup(React.createElement(QuoteList,{clue,count:1}));
  assert.match(first,/First quote/);assert.match(first,/#channel/);assert.doesNotMatch(first,/Second quote|Third quote/);
  const second=renderToStaticMarkup(React.createElement(QuoteList,{clue:{...clue,quotes:clue.quotes.slice(0,2)},count:2}));
  assert.match(second,/Second quote/);assert.doesNotMatch(second,/First quote|Third quote|#channel/);
  const all=renderToStaticMarkup(React.createElement(QuoteList,{clue,count:3}));
  assert.equal((all.match(/<blockquote/g)||[]).length,1);
  assert.match(all,/Third quote/);assert.doesNotMatch(all,/First quote|Second quote/);
});
test('quote editor content requires three nonempty quotes and an answer',()=>{
  assert.ok(isClueReady(clueSchema.parse(clue)));
  assert.equal(clueSchema.safeParse({...clue,quotes:clue.quotes.slice(0,2)}).success,false);
  assert.equal(isClueReady({...clue,quotes:clue.quotes.map(q=>({...q,text:''}))}),false);
});

test('quotes support multiline text, image-only entries and one image per current quote',()=>{
  const image='data:image/png;base64,iVBORw0KGgo=';
  const rich=clueSchema.parse({...clue,quotes:[{text:'Line one\nLine two',source:'#channel',image,imageAlt:'Quote screenshot'},{text:'',source:'',image},{text:'Last text',source:''}]});
  assert.ok(isClueReady(rich));
  const first=renderToStaticMarkup(React.createElement(QuoteList,{clue:rich,count:1}));
  assert.match(first,/Line one\nLine two/);assert.match(first,/alt="Quote screenshot"/);
  const second=renderToStaticMarkup(React.createElement(QuoteList,{clue:rich,count:2}));
  assert.match(second,/<img/);assert.doesNotMatch(second,/Line one|Last text/);
  const third=renderToStaticMarkup(React.createElement(QuoteList,{clue:rich,count:3}));
  assert.doesNotMatch(third,/<img/);
  assert.equal(clueSchema.safeParse({...clue,quotes:[{text:'',source:'',image:'javascript:alert(1)'},...clue.quotes.slice(1)]}).success,false);
});

test('host quote preview shows all three while streamed view shows only selected quote',()=>{
 const host=renderToStaticMarkup(React.createElement(QuoteList,{clue,count:2,showAll:true}));
 assert.match(host,/First quote/);assert.match(host,/Second quote/);assert.match(host,/Third quote/);assert.match(host,/current-quote/);
});

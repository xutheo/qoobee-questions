import React from 'react';
import type {View} from '../shared/model';
export function AudienceRelay({v}:{v:View}) {
 const relay=v.current?.group?.puzzle?.audienceRelay;
 if(!relay)return null;
 return <section className="audience-relay"><h2>Audience Mental Math</h2><p>Carry each answer into the next step. Use order of operations.</p><ol>{relay.expressions.map((text,i)=><li key={i}>{text}</li>)}</ol>{relay.revealed && <strong>Answer: {relay.answer}</strong>}</section>;
}

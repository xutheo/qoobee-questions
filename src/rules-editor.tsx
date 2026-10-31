import React, {useState} from 'react';
import {defaultRules} from '../shared/rules';
export function RulesEditor({rules,send,disabled}:{rules?:string;send:(type:string,payload?:unknown)=>Promise<boolean>;disabled:boolean}) {
 const [editing,setEditing]=useState(false),[text,setText]=useState('');
 if(!editing)return <button className="secondary" disabled={disabled} onClick={()=>{setText(rules ?? defaultRules);setEditing(true);}}>Edit opening rules</button>;
 return <form onSubmit={async e=>{e.preventDefault();if(await send('set-rules',{rules:text}))setEditing(false);}}><label>Opening rules<textarea rows={12} maxLength={12000} required value={text} onChange={e=>setText(e.target.value)}/></label><p className="small">The first line of each rule is bold. Press Enter once for supporting text under the same rule, or Enter twice to start the next numbered rule. The streamed panel automatically scales the text to fit.</p><div className="host-clue-actions"><button className="primary" disabled={disabled || !text.trim()}>Save rules</button><button type="button" className="secondary" onClick={()=>setText(defaultRules)}>Restore default text</button><button type="button" className="secondary" onClick={()=>setEditing(false)}>Cancel</button></div></form>;
}

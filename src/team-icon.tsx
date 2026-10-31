import React from 'react';
import { selectableTeamIcons, teamIconPath, type TeamIcon } from '../shared/team-icons';
import { type View } from '../shared/model';
import { basePath } from './environment';

export function TeamIconImage({icon}: {icon?: TeamIcon}) {
  if (!icon) return <span className="team-icon" aria-label="No Qoobee selected"/>;
  return <img className="team-icon" src={basePath + teamIconPath(icon)} alt={`${icon || 'witch'} Qoobee`}/>;
}
export function TeamIconPicker({v,send,disabled}: {v:View;send:(type:string,payload?:unknown)=>Promise<boolean>;disabled:boolean}) {
  const me=v.players.find(p=>p.id===v.playerId),team=v.teams.find(t=>t.id===me?.teamId);
  if(v.phase!=='lobby' || !me?.active || !team || team.captain!==me.id) return null;
  return <details className="team-icon-picker"><summary>Choose your team’s Qoobee</summary><div role="group" aria-label="Team icon">{selectableTeamIcons.map(icon=>{const owner=v.teams.find(t=>t.id!==team.id && t.icon===icon);return <button key={icon} className="secondary" aria-pressed={team.icon===icon} disabled={disabled || !!owner} title={owner ? `Selected by ${owner.name}` : icon} onClick={()=>void send('set-team-icon',{icon})}><TeamIconImage icon={icon}/><span>{icon}</span>{owner && <small>Taken by {owner.name}</small>}</button>;})}</div></details>;
}

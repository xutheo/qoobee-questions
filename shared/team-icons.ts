export const teamIcons = ['witch', 'pumpkin', 'vampire', 'mummy', 'devil', 'piplup', 'sylas'] as const;
// Retain retired IDs for loading existing saved games.
export const selectableTeamIcons = teamIcons.filter(icon => icon !== 'sylas');
export type TeamIcon = typeof teamIcons[number];
export function teamIconPath(icon: TeamIcon = 'witch') {
  return icon === 'witch' ? 'qoobee-transparent.png' : icon === 'vampire' ? 'team-icons/vampire-ears.png' : icon === 'devil' ? 'team-icons/devil-upright.png' : icon === 'piplup' ? 'team-icons/piplup-no-ears.png' : icon === 'sylas' ? 'team-icons/sylas-bust.png' : `team-icons/${icon}.png`;
}

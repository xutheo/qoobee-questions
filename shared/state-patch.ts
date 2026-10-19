import type { View } from './model';

export type StatePatch = { set: Partial<View>; unset: (keyof View)[] };
// Diff only already-redacted views, never the private authoritative game.
export function statePatch(previous: View, next: View): StatePatch {
  const set: Partial<View> = {}, unset: (keyof View)[] = [];
  for (const key of Object.keys(next) as (keyof View)[]) {
    if (next[key] === undefined) { if (Object.hasOwn(previous, key)) unset.push(key); continue; }
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) Object.assign(set, { [key]: next[key] });
  }
  for (const key of Object.keys(previous) as (keyof View)[]) if (!Object.hasOwn(next, key)) unset.push(key);
  return { set, unset };
}
export function applyStatePatch(previous: View, patch: StatePatch): View {
  const next = { ...previous, ...patch.set };
  for (const key of patch.unset) delete (next as any)[key];
  return next;
}

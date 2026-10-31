export const relayOperationCounts = [2, 3.5, 5, 6.5, 8] as const;
export function relayOperationCount(level: number) { return relayOperationCounts[Math.max(0, Math.min(4, Math.trunc(level) - 1))]; }

export function relayStepOperationCount(level:number,index:number,count:number) {
 const average=relayOperationCount(level);
 return Math.floor(average)+(average%1 && index<Math.ceil(count/2) ? 1 : 0);
}

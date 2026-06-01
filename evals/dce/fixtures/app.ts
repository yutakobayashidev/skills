export function usedFunction() { return 42; }
function unusedHelper() { return 'never called'; }
export const kept = 1;
const dead = 2;
function alsoDead() { return 'orphan'; }
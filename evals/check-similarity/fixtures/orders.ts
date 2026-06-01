export interface Order { id: number; total: number; }
export function getOrders() { return [{ id: 1, total: 100 }]; }
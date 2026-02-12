export interface AppContext { userId?: string; tenantId?: string; sessionId?: string; }
export function getContext(): AppContext { return {}; }
export function setContext(_ctx: Partial<AppContext>): void {}

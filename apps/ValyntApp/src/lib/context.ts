export interface AppContext { userId?: string; tenantId?: string; sessionId?: string; }

let currentContext: AppContext = {};

export function getContext(): AppContext {
  return { ...currentContext };
}

export function setContext(ctx: Partial<AppContext>): void {
  currentContext = { ...currentContext, ...ctx };
}

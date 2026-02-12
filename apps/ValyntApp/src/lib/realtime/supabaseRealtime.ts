export interface RealtimeChannel {
  subscribe(): void;
  unsubscribe(): void;
  on(event: string, callback: (payload: unknown) => void): RealtimeChannel;
}

export function createRealtimeChannel(_name: string): RealtimeChannel {
  return {
    subscribe: () => {},
    unsubscribe: () => {},
    on: function() { return this; },
  };
}

export function subscribeToChanges(_table: string, _callback: (payload: unknown) => void): () => void {
  return () => {};
}

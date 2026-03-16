// Stub — entry point access control (full implementation pending)

export type EntryPoint = string;
export type KernelIntent = string;
export interface EntryPointConfig {
  entryPoint: EntryPoint;
  allowedIntents: KernelIntent[];
}
export interface IntentBinding {
  intent: KernelIntent;
  handler: string;
}

export function assertEntryPointAccess(_entryPoint: EntryPoint, _intent: KernelIntent): void {
  // no-op stub
}

export class EntryPointViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntryPointViolationError";
  }
}

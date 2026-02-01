declare module "opossum" {
  export default class CircuitBreaker<TArgs extends unknown[] = unknown[], TResult = unknown> {
    constructor(
      action: (...args: TArgs) => Promise<TResult> | TResult,
      options?: Record<string, unknown>
    );
    stats: Record<string, unknown>;
    opened: boolean;
    halfOpen: boolean;
    fire(...args: TArgs): Promise<TResult>;
    close(): void;
    on(event: string, handler: (...args: unknown[]) => void): this;
  }
}

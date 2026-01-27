/**
 * Circuit Breaker Interface
 */

export interface ICircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getState(): 'closed' | 'open' | 'half_open';
  getMetrics(): {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
  };
}

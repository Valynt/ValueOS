/**
 * Resilience Module - Circuit Breaker
 * 
 * Re-exports CircuitBreaker from services for centralized resilience patterns
 */

export { CircuitBreaker } from '../../services/CircuitBreaker.js';
export { CircuitBreakerManager } from '../../services/CircuitBreakerManager.js';
export { RedisCircuitBreaker } from '../../services/RedisCircuitBreaker.js';

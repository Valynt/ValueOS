/**
 * Result Type Pattern
 *
 * Standardized error handling across packages using a Result monad.
 * Eliminates null/undefined ambiguity and provides composable error handling.
 *
 * @example
 * const result = await fetchUser(id);
 * if (result.ok) {
 *   console.log(result.value.name);
 * } else {
 *   console.error(result.error.message);
 * }
 */
export type Result<T, E = Error> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
/**
 * Result constructors and utilities
 */
export declare const Result: {
    /**
     * Create a successful result
     */
    ok<T>(value: T): Result<T, never>;
    /**
     * Create a failed result
     */
    err<E>(error: E): Result<never, E>;
    /**
     * Check if result is successful
     */
    isOk<T, E>(result: Result<T, E>): result is {
        ok: true;
        value: T;
    };
    /**
     * Check if result is failed
     */
    isErr<T, E>(result: Result<T, E>): result is {
        ok: false;
        error: E;
    };
    /**
     * Map the success value
     */
    map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
    /**
     * Map the error value
     */
    mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
    /**
     * Chain results (flatMap)
     */
    flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
    /**
     * Unwrap the value or return a fallback
     */
    unwrapOr<T, E>(result: Result<T, E>, fallback: T): T;
    /**
     * Unwrap the value or compute a fallback from the error
     */
    unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T;
    /**
     * Unwrap the value or throw the error
     */
    unwrap<T, E>(result: Result<T, E>): T;
    /**
     * Wrap a function that might throw into a Result
     */
    fromTry<T>(fn: () => T): Result<T, Error>;
    /**
     * Wrap an async function that might throw into a Result
     */
    fromTryAsync<T>(fn: () => Promise<T>): AsyncResult<T, Error>;
    /**
     * Combine multiple results into a single result
     * Returns the first error if any result is an error
     */
    all<T extends readonly Result<unknown, unknown>[]>(results: T): Result<{ [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never; }, T[number] extends Result<unknown, infer E> ? E : never>;
    /**
     * Match on success or failure with exhaustive pattern matching
     */
    match<T, E, U>(result: Result<T, E>, handlers: {
        ok: (value: T) => U;
        err: (error: E) => U;
    }): U;
};
/**
 * Type guard to narrow Result to success
 */
export declare function isOk<T, E>(result: Result<T, E>): result is {
    ok: true;
    value: T;
};
/**
 * Type guard to narrow Result to failure
 */
export declare function isErr<T, E>(result: Result<T, E>): result is {
    ok: false;
    error: E;
};
//# sourceMappingURL=result.d.ts.map
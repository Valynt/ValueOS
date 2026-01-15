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

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Result constructors and utilities
 */
export const Result = {
  /**
   * Create a successful result
   */
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },

  /**
   * Create a failed result
   */
  err<E>(error: E): Result<never, E> {
    return { ok: false, error };
  },

  /**
   * Check if result is successful
   */
  isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok;
  },

  /**
   * Check if result is failed
   */
  isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
  },

  /**
   * Map the success value
   */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.ok) {
      return Result.ok(fn(result.value));
    }
    return result;
  },

  /**
   * Map the error value
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    if (!result.ok) {
      return Result.err(fn(result.error));
    }
    return result;
  },

  /**
   * Chain results (flatMap)
   */
  flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    if (result.ok) {
      return fn(result.value);
    }
    return result;
  },

  /**
   * Unwrap the value or return a fallback
   */
  unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
    if (result.ok) {
      return result.value;
    }
    return fallback;
  },

  /**
   * Unwrap the value or compute a fallback from the error
   */
  unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
    if (result.ok) {
      return result.value;
    }
    return fn(result.error);
  },

  /**
   * Unwrap the value or throw the error
   */
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok) {
      return result.value;
    }
    throw result.error;
  },

  /**
   * Wrap a function that might throw into a Result
   */
  fromTry<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn());
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  },

  /**
   * Wrap an async function that might throw into a Result
   */
  async fromTryAsync<T>(fn: () => Promise<T>): AsyncResult<T, Error> {
    try {
      return Result.ok(await fn());
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  },

  /**
   * Combine multiple results into a single result
   * Returns the first error if any result is an error
   */
  all<T extends readonly Result<unknown, unknown>[]>(
    results: T
  ): Result<
    { [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never },
    T[number] extends Result<unknown, infer E> ? E : never
  > {
    const values: unknown[] = [];
    for (const result of results) {
      if (!result.ok) {
        return result as any;
      }
      values.push(result.value);
    }
    return Result.ok(values) as any;
  },

  /**
   * Match on success or failure with exhaustive pattern matching
   */
  match<T, E, U>(
    result: Result<T, E>,
    handlers: {
      ok: (value: T) => U;
      err: (error: E) => U;
    }
  ): U {
    if (result.ok) {
      return handlers.ok(result.value);
    }
    return handlers.err(result.error);
  },
};

/**
 * Type guard to narrow Result to success
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard to narrow Result to failure
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

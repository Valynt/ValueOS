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
/**
 * Result constructors and utilities
 */
export const Result = {
    /**
     * Create a successful result
     */
    ok(value) {
        return { ok: true, value };
    },
    /**
     * Create a failed result
     */
    err(error) {
        return { ok: false, error };
    },
    /**
     * Check if result is successful
     */
    isOk(result) {
        return result.ok;
    },
    /**
     * Check if result is failed
     */
    isErr(result) {
        return !result.ok;
    },
    /**
     * Map the success value
     */
    map(result, fn) {
        if (result.ok) {
            return Result.ok(fn(result.value));
        }
        return result;
    },
    /**
     * Map the error value
     */
    mapErr(result, fn) {
        if (!result.ok) {
            return Result.err(fn(result.error));
        }
        return result;
    },
    /**
     * Chain results (flatMap)
     */
    flatMap(result, fn) {
        if (result.ok) {
            return fn(result.value);
        }
        return result;
    },
    /**
     * Unwrap the value or return a fallback
     */
    unwrapOr(result, fallback) {
        if (result.ok) {
            return result.value;
        }
        return fallback;
    },
    /**
     * Unwrap the value or compute a fallback from the error
     */
    unwrapOrElse(result, fn) {
        if (result.ok) {
            return result.value;
        }
        return fn(result.error);
    },
    /**
     * Unwrap the value or throw the error
     */
    unwrap(result) {
        if (result.ok) {
            return result.value;
        }
        throw result.error;
    },
    /**
     * Wrap a function that might throw into a Result
     */
    fromTry(fn) {
        try {
            return Result.ok(fn());
        }
        catch (e) {
            return Result.err(e instanceof Error ? e : new Error(String(e)));
        }
    },
    /**
     * Wrap an async function that might throw into a Result
     */
    async fromTryAsync(fn) {
        try {
            return Result.ok(await fn());
        }
        catch (e) {
            return Result.err(e instanceof Error ? e : new Error(String(e)));
        }
    },
    /**
     * Combine multiple results into a single result
     * Returns the first error if any result is an error
     */
    all(results) {
        const values = [];
        for (const result of results) {
            if (!result.ok) {
                return result;
            }
            values.push(result.value);
        }
        return Result.ok(values);
    },
    /**
     * Match on success or failure with exhaustive pattern matching
     */
    match(result, handlers) {
        if (result.ok) {
            return handlers.ok(result.value);
        }
        return handlers.err(result.error);
    },
};
/**
 * Type guard to narrow Result to success
 */
export function isOk(result) {
    return result.ok;
}
/**
 * Type guard to narrow Result to failure
 */
export function isErr(result) {
    return !result.ok;
}
//# sourceMappingURL=result.js.map
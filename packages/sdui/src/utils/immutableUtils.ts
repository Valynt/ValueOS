/**
 * Utility functions for performing immutable updates on objects using spread operators.
 */

/**
 * Performs a shallow immutable update on an object.
 * @param obj The original object to update.
 * @param updates A partial object containing the properties to update.
 * @returns A new object with the updates applied, leaving the original unchanged.
 */
export function immutableUpdate<T extends Record<string, any>>(obj: T, updates: Partial<T>): T {
  return { ...obj, ...updates };
}

/**
 * Performs a deep immutable update on an object at a specified path using dot notation or array paths.
 * @param obj The original object to update.
 * @param path A string with dot notation (e.g., 'a.b.c') or an array of keys/indices (e.g., ['a', 'b', 0, 'c']).
 * @param valueOrUpdater The new value, or a function that receives the current value and returns the new value.
 * @returns A new object with the nested update applied, leaving the original unchanged.
 */
export function immutableNestedUpdate<T>(
  obj: T,
  path: string | (string | number)[],
  valueOrUpdater: unknown | ((current: unknown) => unknown)
): T {
  const pathArray = typeof path === "string" ? path.split(".") : path;
  return setNestedValue(obj, pathArray, valueOrUpdater);
}

function setNestedValue(obj: unknown, path: (string | number)[], valueOrUpdater: unknown): unknown {
  if (path.length === 0) {
    // If updater is a function, call it with the current value
    if (typeof valueOrUpdater === "function") {
      return (valueOrUpdater as (current: unknown) => unknown)(obj);
    }
    return valueOrUpdater;
  }
  const [key, ...rest] = path;
  if (Array.isArray(obj)) {
    const index = typeof key === "number" ? key : parseInt(key as string, 10);
    if (isNaN(index)) throw new Error(`Invalid array index: ${key}`);
    const newArray = [...obj];
    newArray[index] = setNestedValue(obj[index], rest, valueOrUpdater);
    return newArray;
  } else {
    const record = (obj ?? {}) as Record<string, unknown>;
    return { ...record, [key as string]: setNestedValue(record[key as string], rest, valueOrUpdater) };
  }
}

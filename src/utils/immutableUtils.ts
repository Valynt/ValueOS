/**
 * Immutable Utilities
 *
 * Provides efficient immutable update utilities to replace deep cloning.
 * Uses structural sharing and optimized updates for better performance.
 */

/**
 * Deeply immutable update using structural sharing
 * Avoids the performance cost of JSON.parse(JSON.stringify())
 */
export function immutableUpdate<T>(obj: T, updates: Partial<T>): T {
  if (obj === null || obj === undefined) {
    return { ...updates } as T;
  }

  // Simple shallow update for most cases
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return { ...obj, ...updates } as T;
  }

  // For objects, create new instance with merged properties
  const result = { ...obj };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }

  return result;
}

/**
 * Immutable array update with optimized operations
 */
export function immutableArrayUpdate<T>(
  array: T[],
  operation: 'add' | 'remove' | 'update' | 'reorder',
  payload: {
    item?: T;
    index?: number;
    fromIndex?: number;
    toIndex?: number;
    predicate?: (item: T) => boolean;
    updater?: (item: T) => T;
  }
): T[] {
  switch (operation) {
    case 'add':
      if (payload.item === undefined) return array;
      return payload.index !== undefined
        ? [...array.slice(0, payload.index), payload.item, ...array.slice(payload.index)]
        : [...array, payload.item];

    case 'remove':
      if (payload.index !== undefined) {
        return array.filter((_, i) => i !== payload.index);
      }
      if (payload.predicate) {
        return array.filter(payload.predicate);
      }
      return array;

    case 'update':
      if (payload.index !== undefined && payload.updater) {
        return array.map((item, i) =>
          i === payload.index ? payload.updater!(item) : item
        );
      }
      if (payload.predicate && payload.updater) {
        return array.map(item =>
          payload.predicate!(item) ? payload.updater!(item) : item
        );
      }
      return array;

    case 'reorder':
      if (payload.fromIndex !== undefined && payload.toIndex !== undefined) {
        const newArray = [...array];
        const [moved] = newArray.splice(payload.fromIndex, 1);
        newArray.splice(payload.toIndex, 0, moved);
        return newArray;
      }
      return array;

    default:
      return array;
  }
}

/**
 * Immutable nested object update
 */
export function immutableNestedUpdate<T>(
  obj: T,
  path: string[],
  updater: (value: any) => any
): T {
  if (path.length === 0) {
    return updater(obj);
  }

  const [head, ...tail] = path;
  const current = (obj as any)[head];

  if (current === undefined || current === null) {
    return obj;
  }

  const updated = immutableNestedUpdate(current, tail, updater);

  // Only create new object if the nested value actually changed
  if (current === updated) {
    return obj;
  }

  return {
    ...obj,
    [head]: updated
  };
}

/**
 * Efficient deep merge for objects
 */
export function immutableMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    if (sourceValue === undefined) continue;

    const targetValue = result[key];

    if (
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue) &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue)
    ) {
      // Recursively merge nested objects
      result[key] = immutableMerge(targetValue, sourceValue as any);
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Performance-optimized deep freeze (development only)
 */
export function deepFreeze<T>(obj: T): T {
  if (process.env.NODE_ENV !== 'development') {
    return obj;
  }

  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return Object.freeze(obj);
}

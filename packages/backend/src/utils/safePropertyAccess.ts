/**
 * Safe property access utilities to address security/detect-object-injection
 */

/* eslint-disable security/detect-object-injection -- This file provides safe property access utilities */

/**
 * Safely access a property on an object using a key that may be user-controlled.
 * Returns undefined if the key is not in the allowed keys or not an own property.
 */
export function safeGet<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: string | number | symbol,
  allowedKeys?: readonly K[]
): T[K] | undefined {
  if (allowedKeys && !allowedKeys.includes(key as K)) {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key as K] as T[K];
  }
  return undefined;
}

/**
 * Safely access a string property on a Record<string, any> with type validation.
 */
export function safeRecordGet(
  obj: Record<string, unknown>,
  key: string,
  allowedKeys?: readonly string[]
): unknown | undefined {
  if (allowedKeys && !allowedKeys.includes(key)) {
    return undefined;
  }
  // Only access own properties, not inherited
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return obj[key];
  }
  return undefined;
}

/**
 * Type-safe enum value lookup - validates key is a known enum key.
 */
export function safeEnumLookup<T extends Record<string, V>, V>(
  enumObj: T,
  key: string
): V | undefined {
  const keys = Object.keys(enumObj) as Array<keyof T>;
  if (keys.includes(key as keyof T)) {
    return enumObj[key as keyof T];
  }
  return undefined;
}

/**
 * Safe property access with default value
 */
export function safeGetWithDefault<T>(
  obj: Record<string, T>,
  key: string,
  defaultValue: T,
  allowedKeys?: readonly string[]
): T {
  const value = safeRecordGet(obj, key, allowedKeys);
  return value !== undefined ? (value as T) : defaultValue;
}

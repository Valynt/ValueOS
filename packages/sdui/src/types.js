/**
 * Type definitions for the SDUI runtime engine
 */
/**
 * Type guard to check if props have hydration data
 */
export function hasHydrationData(props) {
    return (typeof props === 'object' &&
        props !== null &&
        '_hydrated' in props &&
        typeof props._hydrated === 'object');
}
/**
 * Type guard to check if error is a hydration error
 */
export function isHydrationError(error) {
    return (error.message.includes('hydration') ||
        error.message.includes('fetch') ||
        error.message.includes('timeout'));
}
/**
 * Type guard to check if error is a validation error
 */
export function isValidationError(error) {
    return error.name === 'SDUIValidationError' || error.message.includes('validation');
}
/**
 * Type guard to check if error is a component error
 */
export function isComponentError(error) {
    return (error.message.includes('component') &&
        !isHydrationError(error) &&
        !isValidationError(error));
}
//# sourceMappingURL=types.js.map
"use strict";
/**
 * Type definitions for the SDUI runtime engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasHydrationData = hasHydrationData;
exports.isHydrationError = isHydrationError;
exports.isValidationError = isValidationError;
exports.isComponentError = isComponentError;
/**
 * Type guard to check if props have hydration data
 */
function hasHydrationData(props) {
    return (typeof props === 'object' &&
        props !== null &&
        '_hydrated' in props &&
        typeof props._hydrated === 'object');
}
/**
 * Type guard to check if error is a hydration error
 */
function isHydrationError(error) {
    return (error.message.includes('hydration') ||
        error.message.includes('fetch') ||
        error.message.includes('timeout'));
}
/**
 * Type guard to check if error is a validation error
 */
function isValidationError(error) {
    return error.name === 'SDUIValidationError' || error.message.includes('validation');
}
/**
 * Type guard to check if error is a component error
 */
function isComponentError(error) {
    return (error.message.includes('component') &&
        !isHydrationError(error) &&
        !isValidationError(error));
}
//# sourceMappingURL=types.js.map
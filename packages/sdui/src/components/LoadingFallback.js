import { Loader2 } from 'lucide-react';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Loading fallback component shown during data hydration
 *
 * @example
 * ```tsx
 * <LoadingFallback
 *   componentName="UserProfile"
 *   message="Loading user data..."
 *   size="medium"
 * />
 * ```
 */
export const LoadingFallback = ({ componentName, message, size = 'medium', showComponentName = false, }) => {
    const sizeClasses = {
        small: 'p-3',
        medium: 'p-4',
        large: 'p-6',
    };
    const iconSizes = {
        small: 'h-4 w-4',
        medium: 'h-5 w-5',
        large: 'h-6 w-6',
    };
    const textSizes = {
        small: 'text-xs',
        medium: 'text-sm',
        large: 'text-base',
    };
    return (_jsxs("div", { className: `rounded-lg border border-blue-200 bg-blue-50 ${sizeClasses[size]}`, role: "status", "aria-live": "polite", "aria-busy": "true", "data-testid": "loading-fallback", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Loader2, { className: `${iconSizes[size]} text-blue-600 animate-spin`, "aria-hidden": "true" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: `${textSizes[size]} font-medium text-blue-900`, children: message || 'Loading component...' }), showComponentName && (_jsx("p", { className: `${textSizes[size]} text-blue-700 opacity-75 mt-0.5`, children: componentName }))] })] }), _jsxs("span", { className: "sr-only", children: ["Loading ", componentName] })] }));
};
/**
 * Skeleton loading component for more detailed loading states
 */
export const SkeletonLoader = ({ lines = 3, className = '' }) => {
    return (_jsx("div", { className: `space-y-3 ${className}`, "data-testid": "skeleton-loader", children: Array.from({ length: lines }).map((_, index) => (_jsx("div", { className: "h-4 bg-gray-200 rounded animate-pulse", style: {
                width: `${Math.random() * 30 + 70}%`,
            } }, index))) }));
};
/**
 * Card skeleton for loading card-based components
 */
export const CardSkeleton = ({ className = '' }) => {
    return (_jsxs("div", { className: `rounded-lg border border-gray-200 bg-white p-4 ${className}`, "data-testid": "card-skeleton", children: [_jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: "h-10 w-10 bg-gray-200 rounded animate-pulse" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-4 bg-gray-200 rounded animate-pulse w-1/3" }), _jsx("div", { className: "h-3 bg-gray-200 rounded animate-pulse w-1/2" })] })] }), _jsx(SkeletonLoader, { lines: 3 })] }));
};
//# sourceMappingURL=LoadingFallback.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardSkeleton = exports.SkeletonLoader = exports.LoadingFallback = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
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
const LoadingFallback = ({ componentName, message, size = 'medium', showComponentName = false, }) => {
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: `rounded-lg border border-blue-200 bg-blue-50 ${sizeClasses[size]}`, role: "status", "aria-live": "polite", "aria-busy": "true", "data-testid": "loading-fallback", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: `${iconSizes[size]} text-blue-600 animate-spin`, "aria-hidden": "true" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("p", { className: `${textSizes[size]} font-medium text-blue-900`, children: message || 'Loading component...' }), showComponentName && ((0, jsx_runtime_1.jsx)("p", { className: `${textSizes[size]} text-blue-700 opacity-75 mt-0.5`, children: componentName }))] })] }), (0, jsx_runtime_1.jsxs)("span", { className: "sr-only", children: ["Loading ", componentName] })] }));
};
exports.LoadingFallback = LoadingFallback;
/**
 * Skeleton loading component for more detailed loading states
 */
const SkeletonLoader = ({ lines = 3, className = '' }) => {
    return ((0, jsx_runtime_1.jsx)("div", { className: `space-y-3 ${className}`, "data-testid": "skeleton-loader", children: Array.from({ length: lines }).map((_, index) => ((0, jsx_runtime_1.jsx)("div", { className: "h-4 bg-gray-200 rounded animate-pulse", style: {
                width: `${Math.random() * 30 + 70}%`,
            } }, index))) }));
};
exports.SkeletonLoader = SkeletonLoader;
/**
 * Card skeleton for loading card-based components
 */
const CardSkeleton = ({ className = '' }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `rounded-lg border border-gray-200 bg-white p-4 ${className}`, "data-testid": "card-skeleton", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3 mb-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-10 w-10 bg-gray-200 rounded animate-pulse" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-4 bg-gray-200 rounded animate-pulse w-1/3" }), (0, jsx_runtime_1.jsx)("div", { className: "h-3 bg-gray-200 rounded animate-pulse w-1/2" })] })] }), (0, jsx_runtime_1.jsx)(exports.SkeletonLoader, { lines: 3 })] }));
};
exports.CardSkeleton = CardSkeleton;
//# sourceMappingURL=LoadingFallback.js.map
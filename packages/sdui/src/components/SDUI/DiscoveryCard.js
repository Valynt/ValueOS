"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryCard = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const ConfidenceDisplay_1 = require("../Agent/ConfidenceDisplay");
const statusConfig = {
    new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    in_progress: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    validated: { label: "Validated", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};
const DiscoveryCard = ({ title, description, category, tags, confidence, status, onExplore, onDismiss, className = "", }) => {
    const statusInfo = status ? statusConfig[status] : null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mb-1", children: [category && ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground uppercase tracking-wider", children: category })), statusInfo && ((0, jsx_runtime_1.jsx)("span", { className: `text-xs px-2 py-0.5 rounded-full border ${statusInfo.color}`, children: statusInfo.label }))] }), (0, jsx_runtime_1.jsx)("h3", { className: "text-base font-semibold text-foreground truncate", children: title }), description && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground mt-1 line-clamp-2", children: description }))] }), confidence !== undefined && ((0, jsx_runtime_1.jsx)(ConfidenceDisplay_1.ConfidenceDisplay, { data: { score: confidence }, size: "sm", showLabel: false }))] }), tags && tags.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-1.5 mt-3", children: tags.map((tag) => ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Tag, { className: "w-3 h-3" }), tag] }, tag))) })), (onExplore || onDismiss) && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mt-4 pt-3 border-t border-border", children: [onExplore && ((0, jsx_runtime_1.jsxs)("button", { onClick: onExplore, className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "w-3.5 h-3.5" }), "Explore"] })), onDismiss && ((0, jsx_runtime_1.jsxs)("button", { onClick: onDismiss, className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "w-3.5 h-3.5" }), "Dismiss"] }))] }))] }));
};
exports.DiscoveryCard = DiscoveryCard;
exports.DiscoveryCard.displayName = "DiscoveryCard";
exports.default = exports.DiscoveryCard;
//# sourceMappingURL=DiscoveryCard.js.map
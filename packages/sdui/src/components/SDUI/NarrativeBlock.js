"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarrativeBlock = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const ConfidenceDisplay_1 = require("../Agent/ConfidenceDisplay");
const typeConfig = {
    insight: { icon: lucide_react_1.Lightbulb, borderColor: "border-l-blue-500", iconColor: "text-blue-400" },
    recommendation: { icon: lucide_react_1.ArrowUpRight, borderColor: "border-l-green-500", iconColor: "text-green-400" },
    warning: { icon: lucide_react_1.AlertTriangle, borderColor: "border-l-yellow-500", iconColor: "text-yellow-400" },
    summary: { icon: lucide_react_1.FileText, borderColor: "border-l-purple-500", iconColor: "text-purple-400" },
};
const NarrativeBlock = ({ content, author, timestamp, type = "summary", confidence, sources, className = "", }) => {
    const [showSources, setShowSources] = (0, react_1.useState)(false);
    const config = typeConfig[type];
    const Icon = config.icon;
    return ((0, jsx_runtime_1.jsx)("div", { className: `bg-card border border-border border-l-4 ${config.borderColor} rounded-lg p-4 ${className}`, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)(Icon, { className: `w-5 h-5 ${config.iconColor} shrink-0 mt-0.5` }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 flex-wrap mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", children: type }), confidence !== undefined && ((0, jsx_runtime_1.jsx)(ConfidenceDisplay_1.ConfidenceDisplay, { data: { score: confidence }, size: "sm", showLabel: false }))] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-foreground leading-relaxed whitespace-pre-wrap", children: content }), (author || timestamp) && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3 mt-3 text-xs text-muted-foreground", children: [author && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.User, { className: "w-3 h-3" }), author] })), timestamp && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "w-3 h-3" }), timestamp] }))] })), sources && sources.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 pt-3 border-t border-border", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: () => setShowSources(!showSources), className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors", children: [showSources ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "w-3 h-3" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "w-3 h-3" })), sources.length, " source", sources.length !== 1 ? "s" : ""] }), showSources && ((0, jsx_runtime_1.jsx)("ul", { className: "mt-2 space-y-1", children: sources.map((source, i) => ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { className: "w-3 h-3 shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "truncate", children: source })] }, i))) }))] }))] })] }) }));
};
exports.NarrativeBlock = NarrativeBlock;
exports.NarrativeBlock.displayName = "NarrativeBlock";
exports.default = exports.NarrativeBlock;
//# sourceMappingURL=NarrativeBlock.js.map
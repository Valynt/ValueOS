import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronRight, Clock, ExternalLink, FileText, Lightbulb, User, } from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";
const typeConfig = {
    insight: { icon: Lightbulb, borderColor: "border-l-blue-500", iconColor: "text-blue-400" },
    recommendation: { icon: ArrowUpRight, borderColor: "border-l-green-500", iconColor: "text-green-400" },
    warning: { icon: AlertTriangle, borderColor: "border-l-yellow-500", iconColor: "text-yellow-400" },
    summary: { icon: FileText, borderColor: "border-l-purple-500", iconColor: "text-purple-400" },
};
export const NarrativeBlock = ({ content, author, timestamp, type = "summary", confidence, sources, className = "", }) => {
    const [showSources, setShowSources] = useState(false);
    const config = typeConfig[type];
    const Icon = config.icon;
    return (_jsx("div", { className: `bg-card border border-border border-l-4 ${config.borderColor} rounded-lg p-4 ${className}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Icon, { className: `w-5 h-5 ${config.iconColor} shrink-0 mt-0.5` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-2", children: [_jsx("span", { className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", children: type }), confidence !== undefined && (_jsx(ConfidenceDisplay, { data: { score: confidence }, size: "sm", showLabel: false }))] }), _jsx("div", { className: "text-sm text-foreground leading-relaxed whitespace-pre-wrap", children: content }), (author || timestamp) && (_jsxs("div", { className: "flex items-center gap-3 mt-3 text-xs text-muted-foreground", children: [author && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(User, { className: "w-3 h-3" }), author] })), timestamp && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), timestamp] }))] })), sources && sources.length > 0 && (_jsxs("div", { className: "mt-3 pt-3 border-t border-border", children: [_jsxs("button", { onClick: () => setShowSources(!showSources), className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors", children: [showSources ? (_jsx(ChevronDown, { className: "w-3 h-3" })) : (_jsx(ChevronRight, { className: "w-3 h-3" })), sources.length, " source", sources.length !== 1 ? "s" : ""] }), showSources && (_jsx("ul", { className: "mt-2 space-y-1", children: sources.map((source, i) => (_jsxs("li", { className: "flex items-center gap-1.5 text-xs text-muted-foreground", children: [_jsx(ExternalLink, { className: "w-3 h-3 shrink-0" }), _jsx("span", { className: "truncate", children: source })] }, i))) }))] }))] })] }) }));
};
NarrativeBlock.displayName = "NarrativeBlock";
export default NarrativeBlock;
//# sourceMappingURL=NarrativeBlock.js.map
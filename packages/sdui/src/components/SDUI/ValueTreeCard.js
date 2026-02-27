"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueTreeCard = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const statusColors = {
    active: "text-blue-400",
    at_risk: "text-yellow-400",
    achieved: "text-green-400",
};
const TreeNode = ({ node, depth, expanded, toggle, onNodeClick }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const statusColor = node.status ? statusColors[node.status] ?? "text-muted-foreground" : "text-muted-foreground";
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: `flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors cursor-pointer`, style: { paddingLeft: `${depth * 20 + 8}px` }, onClick: () => {
                    if (hasChildren)
                        toggle(node.id);
                    onNodeClick?.(node.id);
                }, children: [hasChildren ? (isExpanded ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "w-4 h-4 text-muted-foreground shrink-0" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "w-4 h-4 text-muted-foreground shrink-0" }))) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Circle, { className: `w-2.5 h-2.5 ${statusColor} shrink-0 ml-0.5 mr-0.5`, fill: "currentColor" })), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-foreground truncate flex-1", children: node.label }), node.value !== undefined && ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground font-mono shrink-0", children: node.value })), node.status && ((0, jsx_runtime_1.jsx)("span", { className: `text-[10px] px-1.5 py-0.5 rounded ${node.status === "active"
                            ? "bg-blue-500/20 text-blue-400"
                            : node.status === "at_risk"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-green-500/20 text-green-400"}`, children: node.status.replace("_", " ") }))] }), hasChildren && isExpanded && ((0, jsx_runtime_1.jsx)("div", { children: node.children.map((child) => ((0, jsx_runtime_1.jsx)(TreeNode, { node: child, depth: depth + 1, expanded: expanded, toggle: toggle, onNodeClick: onNodeClick }, child.id))) }))] }));
};
const ValueTreeCard = ({ nodes, title, expandedIds, onNodeClick, onToggle, className = "", }) => {
    const [localExpanded, setLocalExpanded] = (0, react_1.useState)(() => new Set(expandedIds ?? []));
    const toggle = (0, react_1.useCallback)((id) => {
        setLocalExpanded((prev) => {
            const next = new Set(prev);
            const willExpand = !next.has(id);
            if (willExpand) {
                next.add(id);
            }
            else {
                next.delete(id);
            }
            onToggle?.(id, willExpand);
            return next;
        });
    }, [onToggle]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [title && ((0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-foreground mb-3", children: title })), (0, jsx_runtime_1.jsx)("div", { className: "space-y-0.5", children: nodes.map((node) => ((0, jsx_runtime_1.jsx)(TreeNode, { node: node, depth: 0, expanded: localExpanded, toggle: toggle, onNodeClick: onNodeClick }, node.id))) })] }));
};
exports.ValueTreeCard = ValueTreeCard;
exports.ValueTreeCard.displayName = "ValueTreeCard";
exports.default = exports.ValueTreeCard;
//# sourceMappingURL=ValueTreeCard.js.map
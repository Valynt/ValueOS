"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrityVetoPanel = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const ConfidenceDisplay_1 = require("./ConfidenceDisplay");
const IntegrityVetoPanel = ({ issues, onResolve, onDismiss, className = "", }) => {
    const [selectedIssue, setSelectedIssue] = (0, react_1.useState)(null);
    const [showDetails, setShowDetails] = (0, react_1.useState)(false);
    const getSeverityColor = (severity) => {
        switch (severity) {
            case "critical":
                return "border-red-500 bg-red-50";
            case "high":
                return "border-orange-500 bg-orange-50";
            case "medium":
                return "border-yellow-500 bg-yellow-50";
            case "low":
                return "border-blue-500 bg-blue-50";
            default:
                return "border-gray-500 bg-gray-50";
        }
    };
    const getSeverityIcon = (severity) => {
        switch (severity) {
            case "critical":
            case "high":
                return (0, jsx_runtime_1.jsx)(lucide_react_1.XCircle, { className: "w-5 h-5 text-red-600" });
            case "medium":
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "w-5 h-5 text-yellow-600" });
            case "low":
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "w-5 h-5 text-blue-600" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "w-5 h-5 text-gray-600" });
        }
    };
    const getIssueTypeLabel = (type) => {
        switch (type) {
            case "low_confidence":
                return "Low Confidence";
            case "hallucination":
                return "Potential Hallucination";
            case "data_integrity":
                return "Data Integrity Issue";
            case "logic_error":
                return "Logic Error";
            default:
                return "Integrity Issue";
        }
    };
    if (issues.length === 0) {
        return null;
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mb-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "w-5 h-5 text-orange-600" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "Integrity Veto Panel" }), (0, jsx_runtime_1.jsxs)("span", { className: "bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium", children: [issues.length, " issue", issues.length !== 1 ? "s" : ""] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: issues.map((issue) => ((0, jsx_runtime_1.jsxs)("div", { className: `border-2 rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${getSeverityColor(issue.severity)}`, onClick: () => setSelectedIssue(issue), children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [getSeverityIcon(issue.severity), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: getIssueTypeLabel(issue.issueType) }), (0, jsx_runtime_1.jsx)(ConfidenceDisplay_1.ConfidenceDisplay, { data: { score: issue.confidence }, size: "sm", showLabel: false })] }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-muted-foreground", children: new Date(issue.timestamp).toLocaleTimeString() })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground mb-2", children: issue.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        onResolve(issue.id, "accept");
                                    }, className: "px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors", children: "Accept" }), (0, jsx_runtime_1.jsx)("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        onResolve(issue.id, "reject");
                                    }, className: "px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors", children: "Reject" }), (0, jsx_runtime_1.jsx)("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        setSelectedIssue(issue);
                                        setShowDetails(true);
                                    }, className: "px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors", children: "Compare & Resolve" }), (0, jsx_runtime_1.jsx)("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        onDismiss(issue.id);
                                    }, className: "px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors", children: "Dismiss" })] })] }, issue.id))) }), selectedIssue && showDetails && ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-4 border-b border-border flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Compare & Resolve" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-muted-foreground", children: [getIssueTypeLabel(selectedIssue.issueType), " - ", selectedIssue.description] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                        setSelectedIssue(null);
                                        setShowDetails(false);
                                    }, className: "p-2 hover:bg-secondary rounded", children: (0, jsx_runtime_1.jsx)(lucide_react_1.XCircle, { className: "w-5 h-5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 overflow-y-auto p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "font-medium text-red-600 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "w-4 h-4" }), "Original Output (Flagged)"] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-red-50 border border-red-200 rounded p-3", children: (0, jsx_runtime_1.jsx)("pre", { className: "text-sm whitespace-pre-wrap", children: JSON.stringify(selectedIssue.originalOutput, null, 2) }) }), (0, jsx_runtime_1.jsx)(ConfidenceDisplay_1.ConfidenceDisplay, { data: { score: selectedIssue.confidence }, size: "sm" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "font-medium text-green-600 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "w-4 h-4" }), "Suggested Fix"] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-green-50 border border-green-200 rounded p-3", children: selectedIssue.suggestedFix ? ((0, jsx_runtime_1.jsx)("pre", { className: "text-sm whitespace-pre-wrap", children: JSON.stringify(selectedIssue.suggestedFix, null, 2) })) : ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: "No suggestion available" })) })] })] }), selectedIssue.metadata && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-medium mb-2", children: "Additional Details" }), (0, jsx_runtime_1.jsx)("div", { className: "bg-secondary/50 rounded p-3", children: (0, jsx_runtime_1.jsx)("pre", { className: "text-xs whitespace-pre-wrap", children: JSON.stringify(selectedIssue.metadata, null, 2) }) })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 border-t border-border flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                        onResolve(selectedIssue.id, "reject");
                                        setSelectedIssue(null);
                                        setShowDetails(false);
                                    }, className: "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors", children: "Reject Original" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                        onResolve(selectedIssue.id, "accept");
                                        setSelectedIssue(null);
                                        setShowDetails(false);
                                    }, className: "px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors", children: "Accept Original" }), selectedIssue.suggestedFix && ((0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                        onResolve(selectedIssue.id, "modify", selectedIssue.suggestedFix);
                                        setSelectedIssue(null);
                                        setShowDetails(false);
                                    }, className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors", children: "Use Suggested Fix" }))] })] }) }))] }));
};
exports.IntegrityVetoPanel = IntegrityVetoPanel;
exports.default = exports.IntegrityVetoPanel;
//# sourceMappingURL=IntegrityVetoPanel.js.map
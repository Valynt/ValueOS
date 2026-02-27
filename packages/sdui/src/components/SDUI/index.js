import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
// Placeholder components - these need to be implemented
export const AgentResponseCard = () => (_jsx("div", { children: "AgentResponseCard - Not implemented" }));
export const AgentWorkflowPanel = () => (_jsx("div", { children: "AgentWorkflowPanel - Not implemented" }));
export const Breadcrumbs = () => _jsx("div", { children: "Breadcrumbs - Not implemented" });
export const ConfidenceIndicator = () => (_jsx("div", { children: "ConfidenceIndicator - Not implemented" }));
export const DataTable = () => _jsx("div", { children: "DataTable - Not implemented" });
export const ExpansionBlock = () => _jsx("div", { children: "ExpansionBlock - Not implemented" });
export const InfoBanner = () => _jsx("div", { children: "InfoBanner - Not implemented" });
export const IntegrityReviewPanel = () => (_jsx("div", { children: "IntegrityReviewPanel - Not implemented" }));
export const LifecyclePanel = () => _jsx("div", { children: "LifecyclePanel - Not implemented" });
export const MetricBadge = () => _jsx("div", { children: "MetricBadge - Not implemented" });
export const RealizationDashboard = () => (_jsx("div", { children: "RealizationDashboard - Not implemented" }));
export const ScenarioSelector = () => _jsx("div", { children: "ScenarioSelector - Not implemented" });
export const SDUIForm = () => _jsx("div", { children: "SDUIForm - Not implemented" });
export const SectionErrorFallback = () => (_jsx("div", { children: "SectionErrorFallback - Not implemented" }));
export const SideNavigation = () => _jsx("div", { children: "SideNavigation - Not implemented" });
export const TabBar = () => _jsx("div", { children: "TabBar - Not implemented" });
export const ValueCommitForm = () => _jsx("div", { children: "ValueCommitForm - Not implemented" });
export const JsonViewer = () => _jsx("div", { children: "JsonViewer - Not implemented" });
export const TextBlock = () => _jsx("div", { children: "TextBlock - Not implemented" });
export const ConfirmationDialog = () => (_jsx("div", { children: "ConfirmationDialog - Not implemented" }));
export const ValueHypothesisCard = () => (_jsx("div", { children: "ValueHypothesisCard - Not implemented" }));
export const ProgressBar = () => _jsx("div", { children: "ProgressBar - Not implemented" });
export const ComponentPreview = () => _jsx("div", { children: "ComponentPreview - Not implemented" });
// Re-export implemented components from their own files
export { DiscoveryCard } from "./DiscoveryCard";
export { KPIForm } from "./KPIForm";
export { InteractiveChart } from "./InteractiveChart";
export { ValueTreeCard } from "./ValueTreeCard";
export { NarrativeBlock } from "./NarrativeBlock";
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
export const UnknownComponentFallback = ({ componentName = "Unknown", props, className = "", }) => {
    const [showProps, setShowProps] = useState(false);
    return (_jsxs("div", { "data-testid": "unknown-component-fallback", className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [_jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-yellow-500 shrink-0" }), _jsxs("span", { className: "text-sm font-medium", children: ["Unknown component: ", _jsx("code", { className: "text-xs bg-secondary px-1.5 py-0.5 rounded", children: componentName })] })] }), isDev && props && Object.keys(props).length > 0 && (_jsxs("div", { className: "mt-3", children: [_jsxs("button", { onClick: () => setShowProps(!showProps), className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors", children: [showProps ? _jsx(ChevronDown, { className: "w-3 h-3" }) : _jsx(ChevronRight, { className: "w-3 h-3" }), "Requested props"] }), showProps && (_jsx("pre", { className: "mt-2 text-xs bg-secondary/50 rounded p-2 overflow-auto max-h-48 text-muted-foreground", children: JSON.stringify(props, null, 2) }))] }))] }));
};
UnknownComponentFallback.displayName = "UnknownComponentFallback";
//# sourceMappingURL=index.js.map
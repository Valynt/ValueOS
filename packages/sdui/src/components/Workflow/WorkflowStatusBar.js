import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { CheckCircle, Circle, XCircle, SkipForward, Loader2, Bot } from "lucide-react";
import { ConfidenceDisplay } from "../Agent/ConfidenceDisplay";
const stageIcon = {
    pending: Circle,
    active: Loader2,
    completed: CheckCircle,
    failed: XCircle,
    skipped: SkipForward,
};
const stageColor = {
    pending: "text-muted-foreground",
    active: "text-primary",
    completed: "text-green-400",
    failed: "text-red-400",
    skipped: "text-muted-foreground/50",
};
const connectorColor = {
    pending: "bg-border",
    active: "bg-primary/50",
    completed: "bg-green-400",
    failed: "bg-red-400",
    skipped: "bg-border/50",
};
export const WorkflowStatusBar = ({ stages, currentStageId, agentName, confidence, startedAt, className = "", }) => {
    return (_jsxs("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [agentName && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm text-foreground font-medium", children: [_jsx(Bot, { className: "w-4 h-4 text-primary" }), agentName] })), startedAt && (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["Started ", startedAt] }))] }), confidence !== undefined && (_jsx(ConfidenceDisplay, { data: { score: confidence }, size: "sm", showLabel: false }))] }), _jsx("div", { className: "flex items-center", children: stages.map((stage, i) => {
                    const Icon = stageIcon[stage.status];
                    const color = stageColor[stage.status];
                    const isCurrent = stage.id === currentStageId;
                    return (_jsxs(React.Fragment, { children: [_jsxs("div", { className: `flex flex-col items-center gap-1 min-w-0 ${isCurrent ? "scale-110" : ""} transition-transform`, children: [_jsx(Icon, { className: `w-5 h-5 ${color} ${stage.status === "active" ? "animate-spin" : ""}` }), _jsx("span", { className: `text-[10px] leading-tight text-center truncate max-w-[72px] ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`, children: stage.label })] }), i < stages.length - 1 && (_jsx("div", { className: `flex-1 h-0.5 mx-1.5 rounded-full ${connectorColor[stage.status]}` }))] }, stage.id));
                }) })] }));
};
WorkflowStatusBar.displayName = "WorkflowStatusBar";
export default WorkflowStatusBar;
//# sourceMappingURL=WorkflowStatusBar.js.map
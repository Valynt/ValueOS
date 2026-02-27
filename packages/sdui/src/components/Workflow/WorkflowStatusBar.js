"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowStatusBar = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const lucide_react_1 = require("lucide-react");
const ConfidenceDisplay_1 = require("../Agent/ConfidenceDisplay");
const stageIcon = {
    pending: lucide_react_1.Circle,
    active: lucide_react_1.Loader2,
    completed: lucide_react_1.CheckCircle,
    failed: lucide_react_1.XCircle,
    skipped: lucide_react_1.SkipForward,
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
const WorkflowStatusBar = ({ stages, currentStageId, agentName, confidence, startedAt, className = "", }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [agentName && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1.5 text-sm text-foreground font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Bot, { className: "w-4 h-4 text-primary" }), agentName] })), startedAt && ((0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-muted-foreground", children: ["Started ", startedAt] }))] }), confidence !== undefined && ((0, jsx_runtime_1.jsx)(ConfidenceDisplay_1.ConfidenceDisplay, { data: { score: confidence }, size: "sm", showLabel: false }))] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center", children: stages.map((stage, i) => {
                    const Icon = stageIcon[stage.status];
                    const color = stageColor[stage.status];
                    const isCurrent = stage.id === currentStageId;
                    return ((0, jsx_runtime_1.jsxs)(react_1.default.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: `flex flex-col items-center gap-1 min-w-0 ${isCurrent ? "scale-110" : ""} transition-transform`, children: [(0, jsx_runtime_1.jsx)(Icon, { className: `w-5 h-5 ${color} ${stage.status === "active" ? "animate-spin" : ""}` }), (0, jsx_runtime_1.jsx)("span", { className: `text-[10px] leading-tight text-center truncate max-w-[72px] ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`, children: stage.label })] }), i < stages.length - 1 && ((0, jsx_runtime_1.jsx)("div", { className: `flex-1 h-0.5 mx-1.5 rounded-full ${connectorColor[stage.status]}` }))] }, stage.id));
                }) })] }));
};
exports.WorkflowStatusBar = WorkflowStatusBar;
exports.WorkflowStatusBar.displayName = "WorkflowStatusBar";
exports.default = exports.WorkflowStatusBar;
//# sourceMappingURL=WorkflowStatusBar.js.map
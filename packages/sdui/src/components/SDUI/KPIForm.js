import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Send, Target } from "lucide-react";
const unitSuffix = {
    currency: "$",
    percentage: "%",
};
function getInputType(kpiType) {
    return kpiType === "text" ? "text" : "number";
}
export const KPIForm = ({ kpis, values = {}, onChange, onSubmit, readOnly = false, className = "", }) => {
    const handleChange = (kpi, raw) => {
        if (!onChange)
            return;
        const value = kpi.type === "text" ? raw : Number(raw);
        onChange(kpi.id, value);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(values);
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: `bg-card border border-border rounded-lg p-4 space-y-4 ${className}`, children: [kpis.map((kpi) => {
                const currentValue = values[kpi.id] ?? "";
                const suffix = kpi.unit ?? unitSuffix[kpi.type] ?? "";
                const hasTarget = kpi.target !== undefined;
                return (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { htmlFor: `kpi-${kpi.id}`, className: "flex items-center justify-between text-sm font-medium text-foreground", children: [_jsx("span", { children: kpi.label }), hasTarget && (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-muted-foreground", children: [_jsx(Target, { className: "w-3 h-3" }), "Target: ", kpi.target, suffix] }))] }), _jsxs("div", { className: "relative", children: [kpi.type === "currency" && (_jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground", children: "$" })), _jsx("input", { id: `kpi-${kpi.id}`, type: getInputType(kpi.type), value: currentValue, onChange: (e) => handleChange(kpi, e.target.value), readOnly: readOnly, min: kpi.min, max: kpi.max, step: kpi.type === "percentage" ? "0.1" : undefined, className: `w-full rounded border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${kpi.type === "currency" ? "pl-7" : ""} ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`, placeholder: `Enter ${kpi.label.toLowerCase()}` }), suffix && kpi.type !== "currency" && (_jsx("span", { className: "absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground", children: suffix }))] })] }, kpi.id));
            }), !readOnly && onSubmit && (_jsxs("button", { type: "submit", className: "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), "Submit"] }))] }));
};
KPIForm.displayName = "KPIForm";
export default KPIForm;
//# sourceMappingURL=KPIForm.js.map
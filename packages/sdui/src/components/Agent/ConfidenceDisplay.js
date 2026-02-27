import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
export const ConfidenceDisplay = ({ data, size = "md", showTrend = true, showLabel = true, className = "", }) => {
    const { score, label, trend, previousScore } = data;
    const getConfidenceColor = (score) => {
        if (score >= 0.8)
            return "text-green-600 bg-green-50 border-green-200";
        if (score >= 0.6)
            return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };
    const getConfidenceLabel = (score) => {
        if (score >= 0.9)
            return "Very High";
        if (score >= 0.8)
            return "High";
        if (score >= 0.7)
            return "Good";
        if (score >= 0.6)
            return "Moderate";
        if (score >= 0.5)
            return "Low";
        return "Very Low";
    };
    const getTrendIcon = () => {
        if (!showTrend || !trend)
            return null;
        switch (trend) {
            case "up":
                return _jsx(TrendingUp, { className: "w-3 h-3 text-green-600" });
            case "down":
                return _jsx(TrendingDown, { className: "w-3 h-3 text-red-600" });
            default:
                return _jsx(Minus, { className: "w-3 h-3 text-gray-600" });
        }
    };
    const sizeClasses = {
        sm: "px-2 py-1 text-xs",
        md: "px-3 py-1.5 text-sm",
        lg: "px-4 py-2 text-base",
    };
    const percentage = Math.round(score * 100);
    return (_jsxs("div", { className: `inline-flex items-center gap-2 rounded-lg border ${getConfidenceColor(score)} ${sizeClasses[size]} ${className}`, children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("span", { className: "font-semibold", children: [percentage, "%"] }), getTrendIcon()] }), showLabel && (_jsx("span", { className: "text-muted-foreground", children: label || getConfidenceLabel(score) })), _jsx("div", { className: "w-12 h-1.5 bg-white/50 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-current rounded-full transition-all duration-300", style: { width: `${percentage}%` } }) })] }));
};
export default ConfidenceDisplay;
//# sourceMappingURL=ConfidenceDisplay.js.map
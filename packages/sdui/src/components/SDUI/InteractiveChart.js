import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
// Default chart colors using CSS custom property fallbacks
const DEFAULT_COLORS = [
    "hsl(var(--chart-1, 220 70% 50%))",
    "hsl(var(--chart-2, 160 60% 45%))",
    "hsl(var(--chart-3, 30 80% 55%))",
    "hsl(var(--chart-4, 280 65% 60%))",
    "hsl(var(--chart-5, 340 75% 55%))",
];
const commonAxisProps = {
    tick: { fill: "hsl(var(--muted-foreground, 0 0% 64%))", fontSize: 12 },
    axisLine: { stroke: "hsl(var(--border, 0 0% 20%))" },
    tickLine: { stroke: "hsl(var(--border, 0 0% 20%))" },
};
const tooltipStyle = {
    contentStyle: {
        backgroundColor: "hsl(var(--card, 0 0% 10%))",
        border: "1px solid hsl(var(--border, 0 0% 20%))",
        borderRadius: "0.375rem",
        color: "hsl(var(--foreground, 0 0% 95%))",
        fontSize: "0.75rem",
    },
};
export const InteractiveChart = ({ type, data, title, xAxisLabel, yAxisLabel, colors, height = 300, showLegend = false, showTooltip = true, className = "", }) => {
    const chartColors = colors ?? DEFAULT_COLORS;
    const renderChart = () => {
        switch (type) {
            case "bar":
                return (_jsxs(BarChart, { data: data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), _jsx(XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), _jsx(YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && _jsx(Tooltip, { ...tooltipStyle }), showLegend && _jsx(Legend, {}), _jsx(Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: data.map((_, i) => (_jsx(Cell, { fill: chartColors[i % chartColors.length] }, i))) })] }));
            case "line":
                return (_jsxs(LineChart, { data: data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), _jsx(XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), _jsx(YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && _jsx(Tooltip, { ...tooltipStyle }), showLegend && _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "value", stroke: chartColors[0], strokeWidth: 2, dot: { fill: chartColors[0], r: 4 }, activeDot: { r: 6 } })] }));
            case "area":
                return (_jsxs(AreaChart, { data: data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), _jsx(XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), _jsx(YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && _jsx(Tooltip, { ...tooltipStyle }), showLegend && _jsx(Legend, {}), _jsx(Area, { type: "monotone", dataKey: "value", stroke: chartColors[0], fill: chartColors[0], fillOpacity: 0.2, strokeWidth: 2 })] }));
            case "pie":
                return (_jsxs(PieChart, { children: [showTooltip && _jsx(Tooltip, { ...tooltipStyle }), showLegend && _jsx(Legend, {}), _jsx(Pie, { data: data, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: "80%", strokeWidth: 1, stroke: "hsl(var(--border, 0 0% 20%))", children: data.map((_, i) => (_jsx(Cell, { fill: chartColors[i % chartColors.length] }, i))) })] }));
        }
    };
    return (_jsxs("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [title && (_jsx("h3", { className: "text-sm font-semibold text-foreground mb-3", children: title })), _jsx(ResponsiveContainer, { width: "100%", height: height, children: renderChart() })] }));
};
InteractiveChart.displayName = "InteractiveChart";
export default InteractiveChart;
//# sourceMappingURL=InteractiveChart.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveChart = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const recharts_1 = require("recharts");
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
const InteractiveChart = ({ type, data, title, xAxisLabel, yAxisLabel, colors, height = 300, showLegend = false, showTooltip = true, className = "", }) => {
    const chartColors = colors ?? DEFAULT_COLORS;
    const renderChart = () => {
        switch (type) {
            case "bar":
                return ((0, jsx_runtime_1.jsxs)(recharts_1.BarChart, { data: data, children: [(0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), (0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { ...tooltipStyle }), showLegend && (0, jsx_runtime_1.jsx)(recharts_1.Legend, {}), (0, jsx_runtime_1.jsx)(recharts_1.Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: data.map((_, i) => ((0, jsx_runtime_1.jsx)(recharts_1.Cell, { fill: chartColors[i % chartColors.length] }, i))) })] }));
            case "line":
                return ((0, jsx_runtime_1.jsxs)(recharts_1.LineChart, { data: data, children: [(0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), (0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { ...tooltipStyle }), showLegend && (0, jsx_runtime_1.jsx)(recharts_1.Legend, {}), (0, jsx_runtime_1.jsx)(recharts_1.Line, { type: "monotone", dataKey: "value", stroke: chartColors[0], strokeWidth: 2, dot: { fill: chartColors[0], r: 4 }, activeDot: { r: 6 } })] }));
            case "area":
                return ((0, jsx_runtime_1.jsxs)(recharts_1.AreaChart, { data: data, children: [(0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border, 0 0% 20%))" }), (0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "name", ...commonAxisProps, label: xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { ...commonAxisProps, label: yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined }), showTooltip && (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { ...tooltipStyle }), showLegend && (0, jsx_runtime_1.jsx)(recharts_1.Legend, {}), (0, jsx_runtime_1.jsx)(recharts_1.Area, { type: "monotone", dataKey: "value", stroke: chartColors[0], fill: chartColors[0], fillOpacity: 0.2, strokeWidth: 2 })] }));
            case "pie":
                return ((0, jsx_runtime_1.jsxs)(recharts_1.PieChart, { children: [showTooltip && (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, { ...tooltipStyle }), showLegend && (0, jsx_runtime_1.jsx)(recharts_1.Legend, {}), (0, jsx_runtime_1.jsx)(recharts_1.Pie, { data: data, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: "80%", strokeWidth: 1, stroke: "hsl(var(--border, 0 0% 20%))", children: data.map((_, i) => ((0, jsx_runtime_1.jsx)(recharts_1.Cell, { fill: chartColors[i % chartColors.length] }, i))) })] }));
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: `bg-card border border-border rounded-lg p-4 ${className}`, children: [title && ((0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-foreground mb-3", children: title })), (0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: height, children: renderChart() })] }));
};
exports.InteractiveChart = InteractiveChart;
exports.InteractiveChart.displayName = "InteractiveChart";
exports.default = exports.InteractiveChart;
//# sourceMappingURL=InteractiveChart.js.map
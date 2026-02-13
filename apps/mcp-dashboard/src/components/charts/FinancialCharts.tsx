import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TimeSeriesData {
  period: string;
  value: number;
  [key: string]: number | string | boolean | null;
}

interface FinancialChartProps {
  data: TimeSeriesData[];
  title: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showLegend?: boolean;
}

export const FinancialLineChart: React.FC<FinancialChartProps> = ({
  data,
  title,
  height = 300,
  color = "#3B82F6",
  showGrid = true,
  showLegend = false,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
            // Use Tailwind classes for tooltip styling
            wrapperClassName="text-gray-700 bg-white border border-gray-200 rounded-lg"
          />
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const FinancialBarChart: React.FC<FinancialChartProps> = ({
  data,
  title,
  height = 300,
  color = "#10B981",
  showGrid = true,
  showLegend = false,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
            wrapperClassName="text-gray-700 bg-white border border-gray-200 rounded-lg"
          />
          {showLegend && <Legend />}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease" | "neutral";
  };
  icon?: React.ReactNode;
  format?: "currency" | "percentage" | "number";
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  format = "number",
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === "string") return val;

    switch (format) {
      case "currency":
        return `$${val.toLocaleString()}`;
      case "percentage":
        return `${val}%`;
      default:
        return val.toLocaleString();
    }
  };

  const getChangeColor = () => {
    if (!change) return "text-gray-500";
    switch (change.type) {
      case "increase":
        return "text-green-600";
      case "decrease":
        return "text-red-600";
      default:
        return "text-gray-500";
    }
  };

  const getChangeIcon = () => {
    if (!change) return null;
    switch (change.type) {
      case "increase":
        return "↗";
      case "decrease":
        return "↘";
      default:
        return "→";
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{formatValue(value)}</p>
          {change && (
            <p className={`text-sm flex items-center ${getChangeColor()}`}>
              <span className="mr-1">{getChangeIcon()}</span>
              {change.value > 0 ? "+" : ""}
              {change.value}%
            </p>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  );
};

interface SentimentGaugeProps {
  sentiment: {
    overall: "positive" | "neutral" | "negative";
    score: number;
    confidence: number;
  };
  title?: string;
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({
  sentiment,
  title = "Sentiment Analysis",
}) => {
  const getSentimentColor = () => {
    switch (sentiment.overall) {
      case "positive":
        return "#10B981";
      case "negative":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getSentimentEmoji = () => {
    switch (sentiment.overall) {
      case "positive":
        return "😊";
      case "negative":
        return "😔";
      default:
        return "😐";
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <span className="text-3xl mr-3">{getSentimentEmoji()}</span>
          <div>
            <p className="text-sm font-medium text-gray-600">Overall Sentiment</p>
            <p className={`text-lg font-semibold capitalize ${getSentimentColor()}`}>
              {sentiment.overall}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Score</p>
          <p className="text-lg font-semibold">{sentiment.score.toFixed(2)}</p>
        </div>
      </div>

      {/* Confidence indicator */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Confidence</span>
          <span>{(sentiment.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            className={`h-2 rounded-full transition-all duration-300 w-[${sentiment.confidence * 100}%] ${getSentimentColor()}`}
          />
        </div>
      </div>

      {/* Sentiment score bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-3 bg-gray-400 rounded-full" />
            <div
              className="absolute top-0 w-1 h-3 rounded-full transition-all duration-300"
              style={{
                left: `${50 + sentiment.score * 50}%`,
                backgroundColor: getSentimentColor(),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationListProps {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: number;
    priority: string;
  }>;
  maxItems?: number;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  maxItems = 10,
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-red-500 bg-red-50";
      case "high":
        return "border-orange-500 bg-orange-50";
      case "medium":
        return "border-yellow-500 bg-yellow-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const recentNotifications = notifications.slice(0, maxItems);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Notifications</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {recentNotifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No recent notifications</div>
        ) : (
          recentNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border-l-4 ${getPriorityColor(notification.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <p className="text-xs text-gray-500">{formatTime(notification.timestamp)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

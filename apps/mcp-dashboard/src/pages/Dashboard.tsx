import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getDashboardPageData } from "../services/pageDataClient";

import {
  FinancialLineChart,
  MetricCard,
  NotificationList,
} from "../components/charts/FinancialCharts";
import { useWebSocket } from "../index";

interface DashboardStats {
  totalRequests: number;
  activeUsers: number;
  systemHealth: "healthy" | "warning" | "error";
  apiUsage: number;
}

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

export default function Dashboard() {
  const { notifications, subscribe, unsubscribe, isConnected } = useWebSocket();
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    activeUsers: 0,
    systemHealth: "healthy",
    apiUsage: 0,
  });
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<Array<{ period: string; value: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to real-time data
    const unsubscribeMarket = subscribe("market.overview", (data) => {
      if (Array.isArray(data.data.marketData)) {
        setMarketData(data.data.marketData as MarketData[]);
      }
    });

    const unsubscribeActivity = subscribe("system.activity", (data) => {
      setRecentActivity((prev) => [data.data, ...prev.slice(0, 9)]);
    });

    // Fetch initial data
    fetchDashboardData();

    return () => {
      unsubscribeMarket();
      unsubscribeActivity();
    };
  }, [subscribe, unsubscribe]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await getDashboardPageData();
      setStats(payload.stats);
      setMarketData(payload.marketData);
      setRevenueData(payload.revenueData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setError("Unable to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthIcon = () => {
    switch (stats.systemHealth) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = () => {
    switch (stats.systemHealth) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome to your MCP Financial Intelligence platform
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {getHealthIcon()}
          <span className={`text-sm font-medium ${getHealthColor()}`}>
            System {stats.systemHealth}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span className="text-sm text-gray-500">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 p-3">{error}</div>}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Requests"
          value={isLoading ? "..." : stats.totalRequests.toLocaleString()}
          change={{ value: 12.5, type: "increase" }}
          icon={<Activity className="w-6 h-6" />}
        />
        <MetricCard
          title="Active Users"
          value={isLoading ? "..." : stats.activeUsers}
          change={{ value: 8.2, type: "increase" }}
          icon={<Building2 className="w-6 h-6" />}
        />
        <MetricCard
          title="API Usage"
          value={isLoading ? "..." : `${stats.apiUsage}%`}
          change={{ value: -2.1, type: "decrease" }}
          icon={<TrendingUp className="w-6 h-6" />}
          format="percentage"
        />
        <MetricCard
          title="System Health"
          value={stats.systemHealth}
          icon={getHealthIcon()}
        />
      </div>

      {/* Charts and Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-1">
          <FinancialLineChart
            data={revenueData}
            title="Revenue Trend"
            height={350}
            color="#3B82F6"
          />
        </div>

        {/* Market Overview */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Market Overview
          </h3>
          <div className="space-y-4">
            {marketData.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{stock.symbol}</p>
                  <p className="text-sm text-gray-500">
                    ${stock.price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}
                  </p>
                  <p
                    className={`text-sm ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    ({stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity and Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No recent activity
              </p>
            ) : (
              recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 py-2">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {activity.description || "System activity"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <NotificationList notifications={notifications} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <Building2 className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Search Companies</h4>
            <p className="text-sm text-gray-600">Find and analyze companies</p>
          </button>

          <button className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">Run Forecast</h4>
            <p className="text-sm text-gray-600">
              Generate financial forecasts
            </p>
          </button>

          <button className="p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
            <Activity className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900">API Management</h4>
            <p className="text-sm text-gray-600">Manage your API keys</p>
          </button>
        </div>
      </div>
    </div>
  );
}

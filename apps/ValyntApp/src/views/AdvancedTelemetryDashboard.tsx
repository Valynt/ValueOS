import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Activity, AlertCircle } from "lucide-react";
import {
  LineChart,
  LineChartArea,
  LineChartXAxis,
  LineChartYAxis,
  LineChartTooltip,
  ResponsiveContainer,
} from "recharts";
import { agentTelemetryService } from "../services/agents/telemetry/AgentTelemetryService";
import { AgentType } from "../services/agent-types";

interface TelemetryData {
  systemHealth: any;
  metrics: any;
  alerts: any[];
  timeWindow: { start: Date; end: Date };
}

export default function AdvancedTelemetryDashboard() {
  const [data, setData] = useState<TelemetryData>({
    systemHealth: null,
    metrics: null,
    alerts: [],
    timeWindow: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end: new Date(),
    },
  });

  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

  useEffect(() => {
    const fetchData = () => {
      const systemHealth = agentTelemetryService.getSystemHealth();
      const metrics = agentTelemetryService.getValueLifecycleMetrics(data.timeWindow);
      const alerts = agentTelemetryService.checkPerformanceThresholds();

      setData((prev) => ({
        ...prev,
        systemHealth,
        metrics,
        alerts,
      }));
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, data.timeWindow]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unhealthy":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4" />;
      case "degraded":
        return <AlertTriangle className="w-4 h-4" />;
      case "unhealthy":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 p-6">
      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(data.systemHealth?.status)}
              <span className={`text-2xl font-bold ${getStatusColor(data.systemHealth?.status)}`}>
                {data.systemHealth?.score || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {data.systemHealth?.status || "Unknown"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Traces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth?.activeTraces || 0}</div>
            <p className="text-xs text-muted-foreground">Currently executing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.systemHealth?.errorRate !== undefined
                ? (100 - data.systemHealth.errorRate).toFixed(1)
                : "0.0"}
              %
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(data.systemHealth?.avgResponseTime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">P50 latency</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Performance Alerts</h3>
          <div className="grid grid-cols-1 gap-2">
            {data.alerts.map((alert, index) => (
              <Card key={index} className={getSeverityColor(alert.severity)}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">{alert.message}</h4>
                      <p className="text-sm opacity-90 mt-1">{alert.recommendation}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs">Threshold: {alert.threshold}</span>
                        <span className="text-xs">Current: {alert.currentValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Agent Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.metrics?.agentMetrics &&
                Object.entries(data.metrics.agentMetrics).map(([agentType, metrics]) => (
                  <div key={agentType} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium capitalize">{agentType} Agent</h4>
                      <Badge
                        variant={
                          metrics.successRate > 90
                            ? "default"
                            : metrics.successRate > 70
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {metrics.successRate.toFixed(1)}% Success
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Executions</p>
                        <p className="font-medium">{metrics.executions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Time</p>
                        <p className="font-medium">{formatTime(metrics.avgExecutionTime)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Cost</p>
                        <p className="font-medium">{formatCurrency(metrics.avgCost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Throughput</p>
                        <p className="font-medium">{metrics.throughput.toFixed(1)}/hr</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Value Lifecycle Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold">{data.metrics?.totalExecutions || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Overall Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data.metrics?.overallSuccessRate?.toFixed(1) || "0.0"}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Value Generated</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.metrics?.totalValueGenerated || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data.metrics?.totalCost || 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">ROI</span>
                    <span className="font-medium">{data.metrics?.roi?.toFixed(1) || "0.0"}%</span>
                  </div>
                  <Progress value={Math.min(data.metrics?.roi || 0, 100)} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Avg Value per Execution</span>
                  </div>
                  <Progress
                    value={(data.metrics?.avgValuePerExecution / 1000) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(data.metrics?.avgValuePerExecution || 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[]}>
              <LineChartXAxis dataKey="time" />
              <LineChartYAxis />
              <LineChartTooltip />
              <LineChartArea dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

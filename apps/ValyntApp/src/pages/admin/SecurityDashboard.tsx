/**
 * Security Monitoring Dashboard
 * Real-time security metrics and event monitoring for administrators
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SecurityMetrics {
  timestamp: string;
  metrics: Record<string, number>;
  derived: {
    totalEvents: number;
    blockedEvents: number;
    errorEvents: number;
    blockRate: number;
    errorRate: number;
  };
}

interface SecurityEvent {
  type: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  outcome: "allowed" | "blocked" | "error" | "warning";
  reason?: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface SecurityAlert {
  id: string;
  type: "info" | "warning" | "danger";
  title: string;
  description: string;
  count: number;
  timestamp: string;
}

interface DashboardData {
  timestamp: string;
  kpis: {
    totalSecurityEvents: number;
    blockedThreats: number;
    activeAlerts: number;
    securityScore: number;
  };
  metrics: Record<string, number>;
  recentEvents: SecurityEvent[];
  charts: {
    eventsByCategory: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    eventsOverTime: Array<{ timestamp: string; count: number }>;
  };
}

export function SecurityDashboard() {
  const [selectedTimeframe, _setSelectedTimeframe] = useState<"1h" | "24h" | "7d">("24h");
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useQuery({
    queryKey: ["security-dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const res = await apiClient.get<DashboardData>("/api/admin/security/dashboard");
      if (!res.data) throw new Error("Empty response from security dashboard");
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const res = await apiClient.get<{ alerts: SecurityAlert[]; count: number }>("/api/admin/security/alerts");
      return res.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Reset metrics mutation
  const resetMetricsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<unknown>("/api/admin/security/reset-metrics", {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["security-alerts"] });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "blocked":
        return "text-red-600";
      case "error":
        return "text-red-500";
      case "warning":
        return "text-yellow-600";
      case "allowed":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security dashboard...</span>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load security dashboard data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time security metrics and threat monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["security-dashboard"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => resetMetricsMutation.mutate()}
            disabled={resetMetricsMutation.isPending}
          >
            Reset Metrics
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      {alertsData?.alerts && alertsData.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Active Alerts ({alertsData.count})
          </h2>
          <div className="space-y-2">
            {alertsData.alerts.map((alert) => (
              <Alert key={alert.id} variant={alert.type === "danger" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>
                  {alert.description} • {formatTimestamp(alert.timestamp)}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.kpis.totalSecurityEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Security events monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Threats</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboardData?.kpis.blockedThreats || 0}
            </div>
            <p className="text-xs text-muted-foreground">Threats successfully blocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboardData?.kpis.securityScore || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Overall security health</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{alertsData?.count || 0}</div>
            <p className="text-xs text-muted-foreground">Currently active alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Latest security events with real-time updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {dashboardData?.recentEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getSeverityColor(event.severity)}`} />
                      <div>
                        <div className="font-medium">{event.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.category} • {event.reason || "No reason provided"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={getOutcomeColor(event.outcome)}>
                        {event.outcome}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                {(!dashboardData?.recentEvents || dashboardData.recentEvents.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No security events recorded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Events by Outcome</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(dashboardData?.charts.eventsByOutcome || {}).map(
                    ([outcome, count]) => (
                      <div key={outcome} className="flex justify-between">
                        <span className="capitalize">{outcome}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Block Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center">
                  {dashboardData?.derived.blockRate.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Threats successfully blocked
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Events by Category</CardTitle>
              <CardDescription>Security events grouped by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(dashboardData?.charts.eventsByCategory || {}).map(
                  ([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="capitalize">{category.replace("_", " ")}</span>
                      </div>
                      <Badge>{count}</Badge>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

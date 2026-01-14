import React, { useState, useEffect } from "react";
import {
  Users,
  Activity,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  HardDrive,
  Zap,
  Settings,
  UserPlus,
  Ban,
  Eye,
} from "lucide-react";
import { MetricCard } from "../components/charts/FinancialCharts";

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  systemHealth: "healthy" | "warning" | "error";
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  lastLogin: Date;
  apiKeys: number;
  requestsThisMonth: number;
}

interface SystemAlert {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export default function AdminPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalRequests: 0,
    errorRate: 0,
    avgResponseTime: 0,
    systemHealth: "healthy",
    uptime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    diskUsage: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    try {
      // Mock system data - would come from backend
      setMetrics({
        totalUsers: 1247,
        activeUsers: 892,
        totalRequests: 456789,
        errorRate: 0.023,
        avgResponseTime: 245,
        systemHealth: "healthy",
        uptime: 99.8,
        memoryUsage: 68,
        cpuUsage: 45,
        diskUsage: 72,
      });

      setUsers([
        {
          id: "user_1",
          email: "john.doe@example.com",
          name: "John Doe",
          role: "admin",
          status: "active",
          lastLogin: new Date("2024-01-20T10:30:00Z"),
          apiKeys: 2,
          requestsThisMonth: 15420,
        },
        {
          id: "user_2",
          email: "jane.smith@example.com",
          name: "Jane Smith",
          role: "user",
          status: "active",
          lastLogin: new Date("2024-01-19T15:45:00Z"),
          apiKeys: 1,
          requestsThisMonth: 8750,
        },
        {
          id: "user_3",
          email: "bob.johnson@example.com",
          name: "Bob Johnson",
          role: "user",
          status: "inactive",
          lastLogin: new Date("2024-01-10T09:15:00Z"),
          apiKeys: 1,
          requestsThisMonth: 2340,
        },
      ]);

      setAlerts([
        {
          id: "alert_1",
          type: "warning",
          title: "High Memory Usage",
          message: "Memory usage is above 80% threshold",
          timestamp: new Date("2024-01-20T08:30:00Z"),
          resolved: false,
        },
        {
          id: "alert_2",
          type: "error",
          title: "Database Connection Issue",
          message: "Temporary database connection failure detected",
          timestamp: new Date("2024-01-20T07:15:00Z"),
          resolved: true,
        },
        {
          id: "alert_3",
          type: "info",
          title: "System Maintenance",
          message: "Scheduled maintenance completed successfully",
          timestamp: new Date("2024-01-19T22:00:00Z"),
          resolved: true,
        },
      ]);

      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load system data:", error);
      setIsLoading(false);
    }
  };

  const getHealthIcon = () => {
    switch (metrics.systemHealth) {
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
    switch (metrics.systemHealth) {
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

  const getStatusColor = (status: User["status"]) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "inactive":
        return "text-gray-600 bg-gray-100";
      case "suspended":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getAlertIcon = (type: SystemAlert["type"]) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(1)}%`;
  };

  const formatUsage = (usage: number) => {
    return `${usage.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600">System administration and monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          {getHealthIcon()}
          <span className={`text-sm font-medium ${getHealthColor()}`}>
            System {metrics.systemHealth}
          </span>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change={{ value: 8.2, type: "increase" }}
          icon={<Users className="w-6 h-6" />}
        />
        <MetricCard
          title="Active Users"
          value={metrics.activeUsers.toLocaleString()}
          change={{ value: 12.1, type: "increase" }}
          icon={<Activity className="w-6 h-6" />}
        />
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests.toLocaleString()}
          change={{ value: 15.3, type: "increase" }}
          icon={<Database className="w-6 h-6" />}
        />
        <MetricCard
          title="Error Rate"
          value={`${(metrics.errorRate * 100).toFixed(2)}%`}
          change={{ value: -2.1, type: "decrease" }}
          icon={<AlertTriangle className="w-6 h-6" />}
        />
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Uptime</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUptime(metrics.uptime)}
              </p>
            </div>
            <Server className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUsage(metrics.memoryUsage)}
              </p>
            </div>
            <HardDrive className="w-8 h-8 text-green-500" />
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${metrics.memoryUsage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUsage(metrics.cpuUsage)}
              </p>
            </div>
            <Zap className="w-8 h-8 text-orange-500" />
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full"
                style={{ width: `${metrics.cpuUsage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                User Management
              </h3>
              <p className="text-sm text-gray-600">
                Manage system users and permissions
              </p>
            </div>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Keys
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requests (This Month)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.apiKeys}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.requestsThisMonth.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLogin.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-yellow-600 hover:text-yellow-900">
                        <Settings className="w-4 h-4" />
                      </button>
                      {user.status === "active" ? (
                        <button className="text-red-600 hover:text-red-900">
                          <Ban className="w-4 h-4" />
                        </button>
                      ) : (
                        <button className="text-green-600 hover:text-green-900">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Alerts */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">System Alerts</h3>
          <p className="text-sm text-gray-600">
            Recent system events and alerts
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {alerts.map((alert) => (
            <div key={alert.id} className="px-6 py-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">{getAlertIcon(alert.type)}</div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {alert.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    {alert.timestamp.toLocaleString()}
                    {alert.resolved && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="px-6 py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              All Systems Normal
            </h3>
            <p className="text-gray-600">No active alerts or issues detected</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
            <Database className="w-8 h-8 text-blue-500 mb-2" />
            <h4 className="font-medium text-gray-900">System Backup</h4>
            <p className="text-sm text-gray-600">Create system backup</p>
          </button>

          <button className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left">
            <Shield className="w-8 h-8 text-green-500 mb-2" />
            <h4 className="font-medium text-gray-900">Security Scan</h4>
            <p className="text-sm text-gray-600">Run security audit</p>
          </button>

          <button className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors text-left">
            <Settings className="w-8 h-8 text-orange-500 mb-2" />
            <h4 className="font-medium text-gray-900">System Config</h4>
            <p className="text-sm text-gray-600">Update system settings</p>
          </button>
        </div>
      </div>
    </div>
  );
}

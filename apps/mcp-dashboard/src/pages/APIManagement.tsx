import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Key,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  FinancialLineChart,
  MetricCard,
} from "../components/charts/FinancialCharts";
import { useAuth } from "../contexts/AuthContext";

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  lastUsed?: Date;
  usage: {
    requests: number;
    quota: number;
    resetDate: Date;
  };
}

interface UsageData {
  period: string;
  requests: number;
  errors: number;
  latency: number;
}

export default function APIManagement() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApiKeys();
    loadUsageData();
  }, []);

  const loadApiKeys = async () => {
    try {
      // This would fetch real API keys from the backend
      // For now, using mock data
      const mockKeys: APIKey[] = [
        {
          id: "key_1",
          name: "Production API Key",
          key: "mcp_prod_abc123def456ghi789",
          createdAt: new Date("2024-01-15"),
          lastUsed: new Date("2024-01-20"),
          usage: {
            requests: 15420,
            quota: 50000,
            resetDate: new Date("2024-02-01"),
          },
        },
        {
          id: "key_2",
          name: "Development API Key",
          key: "mcp_dev_xyz789uvw456rst123",
          createdAt: new Date("2024-01-10"),
          lastUsed: new Date("2024-01-19"),
          usage: {
            requests: 2340,
            quota: 10000,
            resetDate: new Date("2024-02-01"),
          },
        },
      ];
      setApiKeys(mockKeys);
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  };

  const loadUsageData = async () => {
    try {
      // Mock usage data
      const mockUsage: UsageData[] = [
        { period: "Jan 1", requests: 1200, errors: 12, latency: 245 },
        { period: "Jan 2", requests: 1350, errors: 8, latency: 238 },
        { period: "Jan 3", requests: 1180, errors: 15, latency: 252 },
        { period: "Jan 4", requests: 1420, errors: 6, latency: 231 },
        { period: "Jan 5", requests: 1380, errors: 10, latency: 239 },
        { period: "Jan 6", requests: 1290, errors: 9, latency: 244 },
        { period: "Jan 7", requests: 1450, errors: 7, latency: 228 },
      ];
      setUsageData(mockUsage);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load usage data:", error);
      setIsLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      // This would create a real API key via backend
      const newKey: APIKey = {
        id: `key_${Date.now()}`,
        name: newKeyName.trim(),
        key: `mcp_${newKeyName.toLowerCase().replace(/\s+/g, "_")}_${Math.random().toString(36).substring(2, 15)}`,
        createdAt: new Date(),
        usage: {
          requests: 0,
          quota: 10000,
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      };

      setApiKeys((prev) => [...prev, newKey]);
      setNewKeyName("");
      setShowCreateKey(false);
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this API key? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      // This would delete the API key via backend
      setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
    } catch (error) {
      console.error("Failed to delete API key:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could show a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const formatKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key;
    return `${key.substring(0, 8)}${"•".repeat(key.length - 16)}${key.substring(key.length - 8)}`;
  };

  const getUsagePercentage = (usage: APIKey["usage"]) => {
    return (usage.requests / usage.quota) * 100;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-yellow-600";
    return "text-green-600";
  };

  const totalRequests = apiKeys.reduce(
    (sum, key) => sum + key.usage.requests,
    0
  );
  const totalQuota = apiKeys.reduce((sum, key) => sum + key.usage.quota, 0);
  const avgLatency =
    usageData.length > 0
      ? usageData.reduce((sum, d) => sum + d.latency, 0) / usageData.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Management</h1>
          <p className="text-gray-600">
            Manage your API keys and monitor usage
          </p>
        </div>
        <button
          onClick={() => setShowCreateKey(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create API Key
        </button>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          change={{ value: 12.5, type: "increase" }}
          icon={<BarChart3 className="w-6 h-6" />}
        />
        <MetricCard
          title="API Usage"
          value={`${((totalRequests / totalQuota) * 100).toFixed(1)}%`}
          change={{ value: -2.1, type: "decrease" }}
          icon={<TrendingUp className="w-6 h-6" />}
          format="percentage"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${avgLatency.toFixed(0)}ms`}
          change={{ value: -5.2, type: "decrease" }}
          icon={<Clock className="w-6 h-6" />}
        />
      </div>

      {/* API Keys Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
          <p className="text-sm text-gray-600">
            Manage your API keys and monitor usage
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {apiKeys.map((apiKey) => {
            const usagePercentage = getUsagePercentage(apiKey.usage);
            const isVisible = visibleKeys.has(apiKey.id);

            return (
              <div key={apiKey.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Key className="w-5 h-5 text-gray-400" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {apiKey.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          Created {apiKey.createdAt.toLocaleDateString()}
                          {apiKey.lastUsed &&
                            ` • Last used ${apiKey.lastUsed.toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center space-x-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Usage</span>
                          <span
                            className={`font-medium ${getUsageColor(usagePercentage)}`}
                          >
                            {apiKey.usage.requests.toLocaleString()} /{" "}
                            {apiKey.usage.quota.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(usagePercentage, 100)}%`,
                              backgroundColor:
                                usagePercentage >= 90
                                  ? "#DC2626"
                                  : usagePercentage >= 75
                                    ? "#D97706"
                                    : "#10B981",
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Resets on{" "}
                          {apiKey.usage.resetDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex items-center space-x-2">
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title={isVisible ? "Hide API Key" : "Show API Key"}
                    >
                      {isVisible ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Copy API Key"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deleteApiKey(apiKey.id)}
                      className="p-2 text-red-400 hover:text-red-600"
                      title="Delete API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isVisible && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-mono text-gray-800 break-all">
                      {apiKey.key}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {apiKeys.length === 0 && (
          <div className="px-6 py-8 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No API keys found
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first API key to start using the MCP API
            </p>
            <button
              onClick={() => setShowCreateKey(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </button>
          </div>
        )}
      </div>

      {/* Usage Analytics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Usage Analytics
        </h3>
        {!isLoading && (
          <FinancialLineChart
            data={usageData.map((d) => ({
              period: d.period,
              value: d.requests,
            }))}
            title="API Requests Over Time"
            height={300}
            color="#3B82F6"
          />
        )}
      </div>

      {/* Create API Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              onClick={() => setShowCreateKey(false)}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Key className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Create API Key
                  </h3>
                  <div className="mt-4">
                    <label
                      htmlFor="keyName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      API Key Name
                    </label>
                    <input
                      type="text"
                      id="keyName"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g., Production API Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={createApiKey}
                  disabled={!newKeyName.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Create Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateKey(false);
                    setNewKeyName("");
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                <p className="font-medium mb-2">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Copy your API key immediately - it won't be shown again
                  </li>
                  <li>Each key has a monthly usage quota</li>
                  <li>
                    Keep your API keys secure and never share them publicly
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

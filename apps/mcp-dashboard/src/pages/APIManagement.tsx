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
import { useEffect, useState } from "react";

import { getApiManagementPageData } from "../services/pageDataClient";
import {
  FinancialLineChart,
  MetricCard,
} from "../components/charts/FinancialCharts";
import { useAuth } from "../contexts/AuthContext";
import { ConfirmDialog } from "../index";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();

  }, []);

  const loadApiKeys = async () => {
    try {
      const payload = await getApiManagementPageData();
      const keys: APIKey[] = payload.apiKeys.map((key) => ({
        ...key,
        createdAt: new Date(key.createdAt),
        lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
        usage: {
          ...key.usage,
          resetDate: new Date(key.usage.resetDate),
        },
      }));
      setApiKeys(keys);
      setUsageData(payload.usageData as UsageData[]);
    } catch (error) {
      console.error("Failed to load API management data:", error);
      setError("Unable to load API management data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsageData = async () => {
    // Usage data now loads through loadApiKeys/getApiManagementPageData
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

  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);
  const deleteApiKey = (keyId: string) => {
    setConfirmDeleteKeyId(keyId);
  };

  const handleConfirmDeleteKey = async () => {
    if (!confirmDeleteKeyId) return;
    try {
      setApiKeys((prev) => prev.filter((key) => key.id !== confirmDeleteKeyId));
    } catch (error) {
      console.error("Failed to delete API key:", error);
    } finally {
      setConfirmDeleteKeyId(null);
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
    <>
      <div className="space-y-6">
        {error && <div className="rounded-md bg-red-50 text-red-700 p-3">{error}</div>}
        {/* Header */}
        {/* ...existing code... */}
      </div>
      {confirmDeleteKeyId && (
        <ConfirmDialog
          open={!!confirmDeleteKeyId}
          onOpenChange={(open) => !open && setConfirmDeleteKeyId(null)}
          title="Delete API Key"
          description="Are you sure you want to delete this API key? This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDeleteKey}
        />
      )}
    </>
  );
}

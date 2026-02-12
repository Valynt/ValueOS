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

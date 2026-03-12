export interface ApiResponse<T> {
  data: T;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface DashboardPagePayload {
  stats: {
    totalRequests: number;
    activeUsers: number;
    systemHealth: "healthy" | "warning" | "error";
    apiUsage: number;
  };
  marketData: Array<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
  }>;
  revenueData: Array<{ period: string; value: number }>;
}

export interface ApiManagementPayload {
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed?: string;
    usage: {
      requests: number;
      quota: number;
      resetDate: string;
    };
  }>;
  usageData: Array<{ period: string; requests: number; errors: number; latency: number }>;
}

export async function getDashboardPageData(): Promise<DashboardPagePayload> {
  return fetchJson<DashboardPagePayload>("/api/mcp-dashboard/pages/dashboard");
}

export async function getApiManagementPageData(): Promise<ApiManagementPayload> {
  return fetchJson<ApiManagementPayload>("/api/mcp-dashboard/pages/api-management");
}

import { useQuery } from "@tanstack/react-query";

import { DsrQueueItem } from "./types";

import { apiClient } from "@/api/client/unified-api-client";


export function DsrPage() {
  const { data } = useQuery({
    queryKey: ["compliance-dsr"],
    queryFn: async () => {
      const res = await apiClient.get<{ queue: DsrQueueItem[] }>("/api/admin/compliance/dsr");
      return res.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Data Subject Requests</h2>
      <div className="rounded border bg-white p-4 space-y-3">
        {data?.queue.map((request) => (
          <div key={request.id} className="border rounded p-3">
            <div className="text-sm font-medium">{request.request_type.toUpperCase()} · {request.subject_ref}</div>
            <div className="text-xs text-gray-600">Status: {request.status}</div>
            <div className="text-xs text-gray-400">Due {new Date(request.due_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

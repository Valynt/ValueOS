import { useEffect, useState } from "react";

import { getApiManagementPageData } from "../services/pageDataClient";

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


export default function APIManagement() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);

  useEffect(() => {
    void loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const payload = await getApiManagementPageData();
      const keys: APIKey[] = payload.apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        key: key.key,
        createdAt: new Date(key.createdAt),
        ...(key.lastUsed !== undefined ? { lastUsed: new Date(key.lastUsed) } : {}),
        usage: {
          requests: key.usage.requests,
          quota: key.usage.quota,
          resetDate: new Date(key.usage.resetDate),
        },
      }));
      setApiKeys(keys);
    } catch (err) {
      console.error("Failed to load API management data:", err);
      setError("Unable to load API management data");
    }
  };

  const handleConfirmDeleteKey = async () => {
    if (!confirmDeleteKeyId) return;
    try {
      setApiKeys((prev) => prev.filter((key) => key.id !== confirmDeleteKeyId));
    } catch (err) {
      console.error("Failed to delete API key:", err);
    } finally {
      setConfirmDeleteKeyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 text-red-700 p-3">{error}</div>}
      {confirmDeleteKeyId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete API Key</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this API key? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                onClick={() => setConfirmDeleteKeyId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                onClick={() => void handleConfirmDeleteKey()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-500">
        {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""} configured
      </p>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";

interface AgentStatus {
  name: string;
  policy_version: string;
  killed: boolean;
}

async function fetchAgents(): Promise<AgentStatus[]> {
  const res = await fetch("/api/admin/agents", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch agents (${res.status})`);
  const data = (await res.json()) as { agents: AgentStatus[] };
  return data.agents;
}

async function setKillSwitch(name: string, killed: boolean): Promise<void> {
  const res = await fetch(
    `/api/admin/agents/${encodeURIComponent(name)}/kill-switch`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ killed }),
    },
  );
  if (!res.ok) throw new Error(`Failed to update kill switch (${res.status})`);
}

export default function AgentAdminPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgents(await fetchAgents());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (agent: AgentStatus) => {
    setToggling(agent.name);
    try {
      await setKillSwitch(agent.name, !agent.killed);
      setAgents((prev) =>
        prev.map((a) =>
          a.name === agent.name ? { ...a, killed: !a.killed } : a,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Agent Administration</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-6 font-medium">Agent</th>
              <th className="py-2 pr-6 font-medium">Policy version</th>
              <th className="py-2 pr-6 font-medium">Status</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.name} className="border-b hover:bg-gray-50">
                <td className="py-3 pr-6 font-mono">{agent.name}</td>
                <td className="py-3 pr-6 text-gray-600">
                  {agent.policy_version}
                </td>
                <td className="py-3 pr-6">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      agent.killed
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {agent.killed ? "Killed" : "Active"}
                  </span>
                </td>
                <td className="py-3">
                  <button
                    onClick={() => void handleToggle(agent)}
                    disabled={toggling === agent.name}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                      agent.killed
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    {toggling === agent.name
                      ? "…"
                      : agent.killed
                        ? "Re-enable"
                        : "Kill"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
